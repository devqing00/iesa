import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";
import Script from "next/script";

export const metadata: Metadata = {
  title: {
    default: "IESA | Industrial Engineering Students' Association",
    template: "%s | IESA Platform",
  },
  description:
    "Official platform of the Industrial Engineering Students' Association, University of Ibadan. Access your dashboard, events, academic resources, and community tools.",
  keywords: [
    "IESA",
    "Industrial Engineering",
    "University of Ibadan",
    "Student Association",
    "Academic Platform",
  ],
  openGraph: {
    title: "IESA | Industrial Engineering Students' Association",
    description:
      "Official platform of the Industrial Engineering Students' Association, University of Ibadan.",
    type: "website",
    locale: "en_NG",
    siteName: "IESA Platform",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className="antialiased"
      >
        <a href="#main-content" className="skip-link">
          Skip to main content
        </a>
        {/* Unregister lingering legacy PWA workers, but keep push-sw.js */}
        <Script id="unregister-sw" strategy="afterInteractive">{`
          if ('serviceWorker' in navigator) {
            navigator.serviceWorker.getRegistrations().then(function(regs) {
              regs.forEach(function(r) {
                var scriptUrl =
                  (r.active && r.active.scriptURL) ||
                  (r.waiting && r.waiting.scriptURL) ||
                  (r.installing && r.installing.scriptURL) ||
                  '';

                var isPushWorker = scriptUrl.indexOf('/push-sw.js') !== -1;
                var isLegacyPwaWorker =
                  scriptUrl.endsWith('/sw.js') ||
                  scriptUrl.indexOf('/service-worker.js') !== -1 ||
                  scriptUrl.indexOf('workbox') !== -1;

                if (isLegacyPwaWorker && !isPushWorker) {
                  r.unregister();
                }
              });
            });
          }
        `}</Script>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
