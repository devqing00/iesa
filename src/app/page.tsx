"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import AboutSection from "@/components/home/AboutSection";
import StatsSection from "@/components/home/StatsSection";

export default function Home() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 0);
    return () => clearTimeout(timer);
  }, []);

  if (!mounted) return null;

  const engineeringImages = [
    "https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?q=80&w=600&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1537462713205-e512641654ab?q=80&w=600&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1504917595217-d4dc5ebe6122?q=80&w=600&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1565043589221-1a6fd9ae45c7?q=80&w=600&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1581092160562-40aa08e78837?q=80&w=600&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1581092335397-9583eb92d232?q=80&w=600&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1581094794329-c8112a89af12?q=80&w=600&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1581092918056-0c4c3acd3789?q=80&w=600&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?q=80&w=600&auto=format&fit=crop",
  ];

  // Split images for columns
  const col1 = [
    ...engineeringImages.slice(0, 3),
    ...engineeringImages.slice(0, 3),
    ...engineeringImages.slice(0, 3),
  ];
  const col2 = [
    ...engineeringImages.slice(3, 6),
    ...engineeringImages.slice(3, 6),
    ...engineeringImages.slice(3, 6),
  ];
  const col3 = [
    ...engineeringImages.slice(6, 9),
    ...engineeringImages.slice(6, 9),
    ...engineeringImages.slice(6, 9),
  ];

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden font-sans selection:bg-primary selection:text-white bg-background text-foreground transition-colors duration-300">
      {/* 1. THE ANCHOR: Infinite Engineering Marquee */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none opacity-[0.5] dark:opacity-[0.5] grayscale select-none">
        <div className="grid grid-cols-3 gap-8 h-[150vh] w-[120vw] -ml-[10vw] -mt-[25vh] transform rotate-[-5deg]">
          {/* Column 1 - Up */}
          <div className="relative h-full overflow-hidden">
            <div className="animate-marquee-up flex flex-col gap-8">
              {col1.map((src, i) => (
                <div
                  key={`c1-${i}`}
                  className="relative w-full aspect-3/4 rounded-2xl overflow-hidden"
                >
                  <Image
                    src={src}
                    alt="Engineering"
                    fill
                    className="object-cover"
                  />
                </div>
              ))}
            </div>
          </div>
          {/* Column 2 - Down */}
          <div className="relative h-full overflow-hidden pt-20">
            <div className="animate-marquee-down flex flex-col gap-8">
              {col2.map((src, i) => (
                <div
                  key={`c2-${i}`}
                  className="relative w-full aspect-3/4 rounded-2xl overflow-hidden"
                >
                  <Image
                    src={src}
                    alt="Engineering"
                    fill
                    className="object-cover"
                  />
                </div>
              ))}
            </div>
          </div>
          {/* Column 3 - Up */}
          <div className="relative h-full overflow-hidden">
            <div className="animate-marquee-up flex flex-col gap-8">
              {col3.map((src, i) => (
                <div
                  key={`c3-${i}`}
                  className="relative w-full aspect-3/4 rounded-2xl overflow-hidden"
                >
                  <Image
                    src={src}
                    alt="Engineering"
                    fill
                    className="object-cover"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Vignette & Gradient Overlays to blend edges */}
        {/* <div className="absolute inset-0 bg-linear-to-b from-[#F2F2F0] via-transparent to-[#F2F2F0] z-10 dark:from-[#0A1F11] dark:to-[#0A1F11]"></div> */}
        <div className="absolute inset-0 bg-linear-to-r from-[#F2F2F0] via-transparent to-[#F2F2F0] z-10 dark:from-[#0A1F11] dark:to-[#0A1F11]"></div>
      </div>

      {/* Background Gradients for Atmosphere */}
      {/* <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute top-0 left-0 w-full h-full bg-linear-to-b from-[#F2F2F0]/80 via-transparent to-[#F2F2F0]/80 z-10 dark:from-[#0A1F11]/80 dark:to-[#0A1F11]/80"></div>
      </div> */}

      <Header />

      {/* Main Content */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-4">
        {/* Hero Title */}
        <div className="text-center mb-24 mt-16 relative z-20 flex flex-col items-center">
          {/* <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-foreground/5 border border-foreground/10 backdrop-blur-md mb-8 animate-in fade-in slide-in-from-bottom-4 duration-1000">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
            <span className="text-xs font-bold tracking-[0.2em] uppercase text-foreground/60">Official Student Portal</span>
          </div> */}

          <h1 className="text-[10rem] md:text-[13rem] lg:text-[15rem] leading-[0.8] text-center font-black font-heading text-foreground mb-6 select-none transition-all drop-shadow-2xl">
            IESA
          </h1>

          <div className="mx-auto">
            <p className="max-w-90 lg:max-w-100 text-md md:text-xl text-center font-medium text-foreground/70 tracking-wide">
              Sustainable Industrial & Production Engineering — Designing
              efficient, low-impact systems
            </p>
          </div>
        </div>

        {/* 3. REFINED GLASS CARDS */}
        <div
          id="events"
          className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-7xl px-4 relative z-20 mb-24"
        >
          {/* Card 1 */}
          <div className="group relative h-110 rounded-[1.2rem] overflow-hidden transition-all duration-500 hover:-translate-y-2 hover:shadow-2xl">
            {/* Frosted Glass Effect - Gradient Opacity */}
            <div className="absolute inset-0 bg-linear-to-b from-white/40 to-white/10 dark:from-white/10 dark:to-white/5 backdrop-blur-lg border border-white/30 dark:border-white/10 rounded-[1.2rem] z-0 transition-colors shadow-[0_8px_32px_0_rgba(31,38,135,0.07)]"></div>

            <div className="relative z-10 h-full flex flex-col items-center justify-between p-8 text-center">
              {/* Top Label */}
              <span className="inline-block px-4 py-3 rounded-lg bg-white/90 dark:bg-black/20 backdrop-blur-sm border border-white/20 text-[9px] font-black tracking-[0.2em] uppercase text-foreground/70">
                RESOURCES
              </span>

              {/* Center Icon */}
              <div className="w-20 h-20 flex items-center justify-center text-foreground transform group-hover:scale-110 transition-transform duration-500">
                <svg
                  className="w-full h-full"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                  />
                </svg>
              </div>

              {/* Bottom Content */}
              <div className="w-full">
                <h3 className="text-2xl font-bold font-heading leading-tight text-foreground mb-2 uppercase tracking-wide">
                  ACADEMIC
                  <br />
                  LIBRARY
                </h3>
                {/* <div className="h-1 w-12 bg-foreground/20 mx-auto my-4 rounded-lg"></div> */}
                <p className="text-xs text-foreground/60 font-medium leading-relaxed max-w-50 mx-auto">
                  PAST QUESTIONS &<br />
                  STUDY MATERIALS
                </p>
              </div>
            </div>
          </div>

          {/* Card 2 */}
          <div className="group relative h-110 rounded-[1.2rem] overflow-hidden transition-all duration-500 hover:-translate-y-2 hover:shadow-2xl">
            <div className="absolute inset-0 bg-linear-to-b from-white/40 to-white/10 dark:from-white/10 dark:to-white/5 backdrop-blur-lg border border-white/30 dark:border-white/10 rounded-[1.2rem] z-0 transition-colors shadow-[0_8px_32px_0_rgba(31,38,135,0.07)]"></div>

            <div className="relative z-10 h-full flex flex-col items-center justify-between p-8 text-center">
              <span className="inline-block px-4 py-3 rounded-lg bg-white/90 dark:bg-black/20 backdrop-blur-sm border border-white/20 text-[9px] font-black tracking-[0.2em] uppercase text-foreground/70">
                MANAGEMENT
              </span>

              <div className="w-20 h-20 flex items-center justify-center text-foreground transform group-hover:scale-110 transition-transform duration-500">
                <svg
                  className="w-full h-full"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"
                  />
                </svg>
              </div>

              <div className="w-full">
                <h3 className="text-2xl font-bold font-heading leading-tight text-foreground mb-2 uppercase tracking-wide">
                  DEPARTMENTAL
                  <br />
                  ACTIVITIES
                </h3>
                {/* <div className="h-1 w-12 bg-foreground/20 mx-auto my-4 rounded-lg"></div> */}
                <p className="text-xs text-foreground/60 font-medium leading-relaxed max-w-50 mx-auto">
                  DUES, EVENTS &<br />
                  EXECUTIVE ROLES
                </p>
              </div>
            </div>
          </div>

          {/* Card 3 */}
          <div className="group relative h-110 rounded-[1.2rem] overflow-hidden transition-all duration-500 hover:-translate-y-2 hover:shadow-2xl">
            <div className="absolute inset-0 bg-linear-to-b from-white/40 to-white/10 dark:from-white/10 dark:to-white/5 backdrop-blur-lg border border-white/30 dark:border-white/10 rounded-[1.2rem] z-0 transition-colors shadow-[0_8px_32px_0_rgba(31,38,135,0.07)]"></div>

            <div className="relative z-10 h-full flex flex-col items-center justify-between p-8 text-center">
              <span className="inline-block px-4 py-3 rounded-lg bg-white/90 dark:bg-black/20 backdrop-blur-sm border border-white/20 text-[9px] font-black tracking-[0.2em] uppercase text-foreground/70">
                DEVELOPMENT
              </span>

              <div className="w-20 h-20 flex items-center justify-center text-foreground transform group-hover:scale-110 transition-transform duration-500">
                <svg
                  className="w-full h-full"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M13 10V3L4 14h7v7l9-11h-7z"
                  />
                </svg>
              </div>

              <div className="w-full">
                <h3 className="text-2xl font-bold font-heading leading-tight text-foreground mb-2 uppercase tracking-wide">
                  STUDENT
                  <br />
                  GROWTH
                </h3>
                {/* <div className="h-1 w-12 bg-foreground/20 mx-auto my-4 rounded-lg"></div> */}
                <p className="text-xs text-foreground/60 font-medium leading-relaxed max-w-50 mx-auto">
                  CGPA TRACKING &<br />
                  OPPORTUNITIES
                </p>
              </div>
            </div>
          </div>
        </div>

        <StatsSection />
        <AboutSection />
      </main>

      <Footer />
    </div>
  );
}
