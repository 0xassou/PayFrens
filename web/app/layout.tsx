import type {Metadata, Viewport} from "next";
import {ThemeScript} from "@/components/theme/theme-script";
import {APP_NAME, APP_TAGLINE, APP_URL, absoluteUrl} from "@/lib/env";
import {Providers} from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: {default: APP_NAME, template: `%s · ${APP_NAME}`},
  description: APP_TAGLINE,
  applicationName: APP_NAME,
  openGraph: {
    title: APP_NAME,
    description: APP_TAGLINE,
    url: APP_URL,
    siteName: APP_NAME,
    images: [{url: absoluteUrl("/api/og"), width: 1200, height: 800}],
    type: "website",
  },
  other: {
    // Embed metadata for the app's own root. Individual splits override this
    // with a card showing their live progress — see app/split/[id]/page.tsx.
    "fc:miniapp": JSON.stringify({
      version: "1",
      imageUrl: absoluteUrl("/api/og"),
      button: {
        title: "Split a bill",
        action: {
          type: "launch_miniapp",
          name: APP_NAME,
          url: APP_URL,
          splashImageUrl: absoluteUrl("/splash.png"),
          splashBackgroundColor: "#0A0E1A",
        },
      },
    }),
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // No pinch-zoom: this renders inside Base App's sheet, where a zoomed
  // viewport cannot be reset by the user.
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: [
    {media: "(prefers-color-scheme: light)", color: "#FAFBFF"},
    {media: "(prefers-color-scheme: dark)", color: "#0A0E1A"},
  ],
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    // suppressHydrationWarning: ThemeScript mutates <html> before React
    // hydrates, which is the entire point of it.
    <html lang="en" suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body className="min-h-dvh bg-app text-content antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
