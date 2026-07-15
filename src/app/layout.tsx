import { Bricolage_Grotesque } from "next/font/google";
import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";
import Script from "next/script";

const bricolage = Bricolage_Grotesque({ subsets: ["latin"], variable: '--font-display' });

export const metadata: Metadata = {
  title: {
    default: "IESA | Industrial Engineering Students' Association",
    template: "%s | IESA Platform",
  },
  manifest: "/manifest.webmanifest",
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
        className={`${bricolage.variable} antialiased`}
      >
        <a href="#main-content" className="skip-link">
          Skip to main content
        </a>
        {/* Polyfill structuredClone for Safari < 15.4 (iPhone 7 Plus, older iPads).
            Firebase v11 uses structuredClone internally — missing it causes silent
            SDK failure and an infinite loading spinner on old iOS devices. */}
        <Script id="structuredclone-polyfill" strategy="beforeInteractive">{`
          if (typeof structuredClone === 'undefined') {
            (function() {
              var clone = function(x, seen) {
                if (x === null || typeof x !== 'object') return x;
                if (x instanceof Date) return new Date(x.getTime());
                if (x instanceof RegExp) return new RegExp(x.source, x.flags);
                if (x instanceof Map) {
                  var m = new Map();
                  x.forEach(function(v, k) { m.set(clone(k, seen), clone(v, seen)); });
                  return m;
                }
                if (x instanceof Set) {
                  var s = new Set();
                  x.forEach(function(v) { s.add(clone(v, seen)); });
                  return s;
                }
                if (typeof ArrayBuffer !== 'undefined' && x instanceof ArrayBuffer) {
                  return x.slice(0);
                }
                if (typeof ArrayBuffer !== 'undefined' && ArrayBuffer.isView(x)) {
                  var ctor = x.constructor;
                  return new ctor(x.buffer.slice(0), x.byteOffset, x.length);
                }
                if (seen.has(x)) return seen.get(x);
                if (Array.isArray(x)) {
                  var a = [];
                  seen.set(x, a);
                  x.forEach(function(v, i) { a[i] = clone(v, seen); });
                  return a;
                }
                var proto = Object.getPrototypeOf ? Object.getPrototypeOf(x) : x.__proto__;
                var o = Object.create ? Object.create(proto) : {};
                seen.set(x, o);
                for (var k in x) {
                  if (Object.prototype.hasOwnProperty.call(x, k)) {
                    o[k] = clone(x[k], seen);
                  }
                }
                return o;
              };
              
              var robustStructuredClone = function(val) {
                return clone(val, new Map());
              };

              self.structuredClone = robustStructuredClone;
              if (typeof window !== 'undefined') window.structuredClone = robustStructuredClone;
              if (typeof globalThis !== 'undefined') globalThis.structuredClone = robustStructuredClone;
            })();
          }
        `}</Script>
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
