import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

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
        className={`${inter.variable} antialiased`}
      >
        <a href="#main-content" className="skip-link">
          Skip to main content
        </a>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
