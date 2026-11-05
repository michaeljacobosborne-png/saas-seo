import type { Metadata } from "next";
import { DM_Sans, DM_Mono, Playfair_Display } from "next/font/google";
import "./globals.css";
import { Suspense } from "react";
import { AnalyticsScripts } from "./_components/AnalyticsScripts";
import { AnalyticsPageView } from "./_components/AnalyticsPageView";
import { ThemeScript } from "./_components/ThemeScript";
import PostHogProvider from "@/components/PostHogProvider";
import { RedditPixel } from "@/components/RedditPixel";
import { createClient } from "@/lib/supabase/server";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  axes: ["opsz"],
});

const dmMono = DM_Mono({
  variable: "--font-dm-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  weight: ["700", "900"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://app.bylineseo.com"),
  // Defaults for pages that set no title of their own. Images come from the
  // generated cards (opengraph-image.tsx / twitter-image.tsx in each segment).
  title: {
    default: "Byline: AI search readiness, scored from your page",
    template: "%s | Byline",
  },
  description:
    "Byline scores whether AI search can reach, parse and lift a clean passage from your pages, with the evidence behind every finding.",
  openGraph: {
    type: "website",
    siteName: "Byline",
    title: "Byline: AI search readiness, scored from your page",
    description:
      "Two scores, rule-derived in code, with the evidence behind every finding. It does not measure AI visibility.",
    url: "https://app.bylineseo.com",
  },
  twitter: {
    card: "summary_large_image",
    title: "Byline: AI search readiness, scored from your page",
    description: "Rule-derived scores for AI search readiness, with the evidence shown.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
    },
  },
  // Emits <meta name="google-site-verification" content="..."> only when the env
  // var is set, so Michael can verify bylineseo.com in GSC with a single env var.
  ...(process.env.GOOGLE_SITE_VERIFICATION
    ? { verification: { google: process.env.GOOGLE_SITE_VERIFICATION } }
    : {}),
  // Facebook domain verification (required for pixel attribution & conversion API)
  other: {
    'facebook-domain-verification': 'd773dmc1g6sjagtg6izsgop6iwuqcn',
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Best-effort logged-in email for Reddit Pixel advanced matching. Null on
  // marketing/auth pages (visitor not signed in) — the pixel then plain-inits.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${dmSans.variable} ${dmMono.variable} ${playfair.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <PostHogProvider>
          <ThemeScript />
          <AnalyticsScripts />
          <RedditPixel email={user?.email ?? null} />
          <Suspense fallback={null}>
            <AnalyticsPageView />
          </Suspense>
          {children}
        </PostHogProvider>
      </body>
    </html>
  );
}
