import Link from "next/link";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-ghost text-navy overflow-x-hidden flex flex-col">
      <Header />

      {/* ✦ Decorators */}
      <span className="fixed top-32 left-[8%] text-lime/15 text-3xl font-black pointer-events-none z-0 select-none">✦</span>
      <span className="fixed top-48 right-[12%] text-coral/12 text-2xl font-black pointer-events-none z-0 select-none">✦</span>
      <span className="fixed bottom-36 left-[15%] text-lavender/15 text-xl font-black pointer-events-none z-0 select-none">✦</span>
      <svg className="fixed top-24 right-[6%] w-5 h-5 text-sunny/18 pointer-events-none z-0" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0l1.5 7.5L21 9l-7.5 1.5L12 18l-1.5-7.5L3 9l7.5-1.5z" /></svg>
      <svg className="fixed bottom-[25%] right-[8%] w-4 h-4 text-lime/12 pointer-events-none z-0" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0l1.5 7.5L21 9l-7.5 1.5L12 18l-1.5-7.5L3 9l7.5-1.5z" /></svg>

      <main className="flex-1 flex items-center justify-center p-8 pt-24">
        <div className="max-w-lg w-full text-center space-y-8">
          {/* Tag */}
          <div className="inline-block bg-coral border-[3px] border-navy rounded-full px-4 py-1.5">
            <span className="font-display text-xs font-black text-navy uppercase tracking-widest">✦ Page Not Found</span>
          </div>

          {/* Big 404 */}
          <h1 className="font-display font-black text-8xl sm:text-9xl text-navy leading-none">
            4<span className="inline-block bg-lime border-[4px] border-navy px-3 sm:px-5 py-1 rotate-[-3deg] shadow-[4px_4px_0_0_#000]">0</span>4
          </h1>

          {/* Description */}
          <p className="font-display font-medium text-base sm:text-lg text-navy/60 max-w-sm mx-auto">
            The page you&apos;re looking for doesn&apos;t exist or has been moved.
            Check the URL or navigate back.
          </p>

          {/* Decorative Line */}
          <div className="flex items-center justify-center gap-4">
            <div className="w-16 h-[3px] bg-navy/15 rounded-full" />
            <span className="text-lime text-xl font-black">✦</span>
            <div className="w-16 h-[3px] bg-navy/15 rounded-full" />
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Link
              href="/"
              className="bg-lime border-[4px] border-navy press-3 press-navy px-8 py-4 rounded-2xl font-display font-black text-base text-navy transition-all"
            >
              Back to Home
            </Link>
            <Link
              href="/dashboard"
              className="bg-transparent border-[3px] border-navy px-8 py-4 rounded-2xl font-display font-black text-base text-navy hover:bg-navy hover:text-lime transition-all"
            >
              Dashboard
            </Link>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
