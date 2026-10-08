import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

const AUTH_PROTECTED = ['/dashboard', '/brand', '/keywords', '/articles']

/**
 * The apex served a full duplicate of the app with every canonical pointing at
 * app.bylineseo.com (our own engine scored it 4/6 on fetch and canonical).
 * Pages move permanently to the canonical host. /api (excluded by the matcher)
 * and /auth stay put, so a webhook or sign-in callback registered against the
 * apex keeps working.
 */
const CANONICAL_HOST = 'app.bylineseo.com'
const REDIRECT_HOSTS = new Set(['bylineseo.com'])

export async function proxy(request: NextRequest) {
  const host = (request.headers.get('host') ?? '').toLowerCase().split(':')[0]
  if (REDIRECT_HOSTS.has(host) && !request.nextUrl.pathname.startsWith('/auth')) {
    const url = new URL(request.nextUrl.pathname + request.nextUrl.search, `https://${CANONICAL_HOST}`)
    return NextResponse.redirect(url, 308)
  }

  // Forward the current path to Server Components via a request header so the
  // dashboard layout can decide whether to push the user to brand onboarding.
  const forwardedHeaders = () => {
    const headers = new Headers(request.headers)
    headers.set('x-pathname', request.nextUrl.pathname)
    return headers
  }

  let supabaseResponse = NextResponse.next({ request: { headers: forwardedHeaders() } })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request: { headers: forwardedHeaders() } })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Refresh session — do not run any logic between createServerClient and getUser
  const { data: { user } } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname
  const isProtected = AUTH_PROTECTED.some((p) => pathname.startsWith(p))

  if (isProtected && !user) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
