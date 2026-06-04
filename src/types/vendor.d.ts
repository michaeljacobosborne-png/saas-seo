// Type stubs for packages listed in package.json but not yet installed locally.
// Vercel installs them at build time; these stubs let TypeScript pass locally.

declare module '@vercel/analytics/react' {
  export function Analytics(props?: { mode?: 'auto' | 'production' | 'development' }): JSX.Element | null
}

declare module '@vercel/speed-insights/next' {
  export function SpeedInsights(): JSX.Element | null
}

declare module 'posthog-js' {
  interface PostHog {
    init(key: string, options?: Record<string, unknown>): void
    capture(event: string, properties?: Record<string, unknown>): void
    identify(id: string, properties?: Record<string, unknown>): void
    reset(): void
  }
  const posthog: PostHog
  export default posthog
}

declare module 'posthog-js/react' {
  import type { ReactNode } from 'react'
  interface PostHog {
    capture(event: string, properties?: Record<string, unknown>): void
    identify(id: string, properties?: Record<string, unknown>): void
    reset(): void
  }
  export function usePostHog(): PostHog | null
  export function PostHogProvider(props: { client: unknown; children: ReactNode }): JSX.Element
}
