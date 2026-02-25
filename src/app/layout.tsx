import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";

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
  manifest: "/manifest.json",
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
      <head>
        <meta name="theme-color" content="#0F0F2D" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <link rel="apple-touch-icon" href="/assets/images/logo.svg" />
      </head>
      <body
        className="antialiased"
      >
        <a href="#main-content" className="skip-link">
          Skip to main content
        </a>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
