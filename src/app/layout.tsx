import type { Metadata } from "next";
import { DM_Sans, DM_Mono, Playfair_Display } from "next/font/google";
import "./globals.css";
import { Suspense } from "react";
import { AnalyticsScripts } from "./_components/AnalyticsScripts";
import { AnalyticsPageView } from "./_components/AnalyticsPageView";
import { ThemeScript } from "./_components/ThemeScript";
import PostHogProvider from "@/components/PostHogProvider";

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
  title: {
    default: "Byline — Know what ranks. Say what matters.",
    template: "%s | Byline",
  },
  description:
    "Real keyword data. AI-generated content. An editorial agent that rewrites what's holding you back. Built for serious content operators.",
  openGraph: {
    type: "website",
    siteName: "Byline",
    title: "Byline — Know what ranks. Say what matters.",
    description:
      "Real keyword data. AI-generated content. An editorial agent that rewrites what's holding you back. Built for serious content operators.",
    url: "https://app.bylineseo.com",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Byline — AI SEO content platform",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Byline — Know what ranks. Say what matters.",
    description:
      "Real keyword data. AI-generated content. An editorial agent that rewrites what's holding you back. Built for serious content operators.",
    images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
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
          <Suspense fallback={null}>
            <AnalyticsPageView />
          </Suspense>
          {children}
        </PostHogProvider>
      </body>
    </html>
  );
}
