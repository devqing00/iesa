"use client";

import Image from "next/image";
import Link from "next/link";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import { useAuth } from "@/context/AuthContext";

export default function Home() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-snow overflow-x-hidden">
      {/* ✦ Text decorators — interspersed with diamond sparkles */}
      <span className="fixed top-28 left-[18%] text-lime/15 text-lg pointer-events-none z-0 select-none">✦</span>
      <span className="fixed top-[40%] right-[10%] text-coral/12 text-xl pointer-events-none z-0 select-none">✦</span>
      <span className="fixed top-[55%] left-[5%] text-lavender/15 text-base pointer-events-none z-0 select-none">✦</span>
      <span className="fixed bottom-[25%] right-[25%] text-teal/12 text-lg pointer-events-none z-0 select-none">✦</span>
      <span className="fixed bottom-[10%] left-[22%] text-sunny/15 text-sm pointer-events-none z-0 select-none">✦</span>

      {/* Diamond sparkle decorators */}
      {/* Top area sparkles */}
      <svg className="fixed top-16 left-[10%] w-6 h-6 text-lime/20 pointer-events-none z-0" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 0l1.5 7.5L21 9l-7.5 1.5L12 18l-1.5-7.5L3 9l7.5-1.5z" />
      </svg>
      <svg className="fixed top-32 right-[12%] w-8 h-8 text-coral/15 pointer-events-none z-0" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 0l1.5 7.5L21 9l-7.5 1.5L12 18l-1.5-7.5L3 9l7.5-1.5z" />
      </svg>
      <svg className="fixed top-24 left-[25%] w-5 h-5 text-lavender/20 pointer-events-none z-0" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 0l1.5 7.5L21 9l-7.5 1.5L12 18l-1.5-7.5L3 9l7.5-1.5z" />
      </svg>
      <svg className="fixed top-[45%] left-[8%] w-7 h-7 text-teal/15 pointer-events-none z-0" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 0l1.5 7.5L21 9l-7.5 1.5L12 18l-1.5-7.5L3 9l7.5-1.5z" />
      </svg>
      <svg className="fixed top-[60%] right-[20%] w-6 h-6 text-sunny/20 pointer-events-none z-0" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 0l1.5 7.5L21 9l-7.5 1.5L12 18l-1.5-7.5L3 9l7.5-1.5z" />
      </svg>
      <svg className="fixed bottom-[30%] left-[15%] w-5 h-5 text-coral/20 pointer-events-none z-0" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 0l1.5 7.5L21 9l-7.5 1.5L12 18l-1.5-7.5L3 9l7.5-1.5z" />
      </svg>
      <svg className="fixed bottom-[15%] right-[30%] w-8 h-8 text-lavender/12 pointer-events-none z-0" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 0l1.5 7.5L21 9l-7.5 1.5L12 18l-1.5-7.5L3 9l7.5-1.5z" />
      </svg>
      {/* Subtle organic shapes */}
      <svg className="fixed top-20 right-[5%] w-24 h-24 text-lime/5 pointer-events-none z-0" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
        <path fill="currentColor" d="M41.5,-58.4C53.2,-49.3,61.7,-36.6,66.8,-22.5C71.9,-8.4,73.6,7.1,69.3,21.2C65,35.3,54.7,48,42.1,56.8C29.5,65.6,14.8,70.5,-0.9,71.8C-16.5,73.1,-33,70.8,-46.8,62.5C-60.6,54.2,-71.7,39.9,-76.3,23.8C-80.9,7.7,-79,-10.2,-71.8,-25.1C-64.6,-40,-52.1,-52,-38.3,-60.8C-24.5,-69.6,-9.4,-75.2,3.9,-80.3C17.2,-85.4,29.8,-67.5,41.5,-58.4Z" transform="translate(100 100)" />
      </svg>

      {/* SHARED HEADER */}
      <Header />

      <main className="relative z-10 pt-16">
        {/* HERO SECTION - BENTO LAYOUT */}
        <section className="py-12 sm:py-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            {/* Small tag */}
            <div className="inline-flex items-center gap-2 bg-sunny border-[3px] border-navy rounded-full px-3 py-1 mb-6">
              <svg className="w-3 h-3 text-navy" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10.394 2.08a1 1 0 00-.788 0l-7 3a1 1 0 000 1.84L5.25 8.051a.999.999 0 01.356-.257l4-1.714a1 1 0 11.788 1.838L7.667 9.088l1.94.831a1 1 0 00.787 0l7-3a1 1 0 000-1.838l-7-3zM3.31 9.397L5 10.12v4.102a8.969 8.969 0 00-1.05-.174 1 1 0 01-.89-.89 11.115 11.115 0 01.25-3.762zM9.3 16.573A9.026 9.026 0 007 14.935v-3.957l1.818.78a3 3 0 002.364 0l5.508-2.361a11.026 11.026 0 01.25 3.762 1 1 0 01-.89.89 8.968 8.968 0 00-5.35 2.524 1 1 0 01-1.4 0zM6 18a1 1 0 001-1v-2.065a8.935 8.935 0 00-2-.712V17a1 1 0 001 1z"/>
              </svg>
              <span className="font-display text-[10px] font-black text-navy uppercase tracking-widest">Est. 2018</span>
            </div>

            {/* Main bento grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
              {/* Hero text - spans 2 columns */}
              <div className="lg:col-span-2">
                <div className="relative">
                  <svg className="absolute -top-8 -left-6 w-10 h-10 text-sunny/60" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 0l1.5 7.5L21 9l-7.5 1.5L12 18l-1.5-7.5L3 9l7.5-1.5z" />
                  </svg>
                  <span className="absolute -top-5 -left-1 text-sunny/40 text-sm select-none">✦</span>
                  <svg className="absolute top-4 -right-8 w-8 h-8 text-coral/40" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 0l1.5 7.5L21 9l-7.5 1.5L12 18l-1.5-7.5L3 9l7.5-1.5z" />
                  </svg>
                  <span className="absolute top-8 -right-3 text-coral/30 text-xs select-none">✦</span>
                  <h1 className="font-display text-[2.5rem] sm:text-[4rem] lg:text-[5.5rem] leading-[0.9] text-navy mb-6 sm:mb-8 font-black relative">
                    <span className="">Industrial Engineering</span><br />
                    <span className="inline-block bg-lime border-[4px] sm:border-[6px] border-navy px-4 sm:px-8 py-2 sm:py-3 rotate-[-1deg] shadow-[6px_6px_0_0_#000] sm:shadow-[10px_10px_0_0_#000]">
                      Redefined
                    </span>
                  </h1>
                </div>

                <p className="font-display text-sm sm:text-base lg:text-lg text-navy max-w-xl mb-8 leading-relaxed font-medium">
                  Join <span className="font-black">500+ students</span> at University of Ibadan's premier engineering association.
                </p>

                <div className="flex flex-col sm:flex-row gap-3">
                  <Link
                    href="/register"
                    className="font-display text-center bg-lime border-[4px] border-navy rounded-full px-6 sm:px-8 py-3 text-sm font-black text-navy uppercase tracking-wide hover:translate-y-[2px] shadow-[5px_5px_0_0_#0F0F2D] hover:shadow-[3px_3px_0_0_#0F0F2D] transition-all"
                  >
                    Join IESA →
                  </Link>
                  <Link
                    href="#about"
                    className="font-display text-center bg-snow border-[4px] border-navy rounded-full px-6 sm:px-8 py-3 text-sm font-black text-navy uppercase tracking-wide shadow-[5px_5px_0_0_#000]"
                  >
                    Learn More
                  </Link>
                </div>

              </div>

              {/* Hero image card */}
              <div className="lg:row-span-2">
                <div className="bg-lavender border-[4px] border-navy rounded-3xl p-4 sm:p-6 h-full shadow-[8px_8px_0_0_#000]">
                  <div className="aspect-[4/5] bg-gradient-to-br from-teal-light to-coral-light border-[3px] border-navy rounded-2xl overflow-hidden relative mb-4">
                    <Image
                      src="https://images.unsplash.com/photo-1523240795612-9a054b0db644?q=80&w=600"
                      alt="IESA Community"
                      fill
                      className="object-cover mix-blend-multiply"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-navy/50 to-transparent" />
                    <div className="absolute bottom-3 left-3 right-3">
                      <p className="font-display text-white text-sm sm:text-base font-bold">Community First</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex gap-2">
                      <div className="w-8 h-8 bg-snow border-[3px] border-navy rounded-full flex items-center justify-center">
                        <svg className="w-4 h-4 text-navy" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <div className="w-8 h-8 bg-snow border-[3px] border-navy rounded-full flex items-center justify-center">
                        <svg className="w-4 h-4 text-navy" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <div className="w-8 h-8 bg-snow border-[3px] border-navy rounded-full flex items-center justify-center">
                        <svg className="w-4 h-4 text-navy" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                        </svg>
                      </div>
                    </div>
                    <span className="font-display text-xs font-bold text-navy uppercase">UI Engineering</span>
                  </div>
                </div>
              </div>

              {/* Quick info cards */}
              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                <div className="bg-coral border-[3px] border-navy rounded-2xl p-4 shadow-[4px_4px_0_0_#000]">
                  <svg className="w-8 h-8 text-navy mb-2" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 015.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0014.5 4c-1.255 0-2.443.29-3.5.804V12a1 1 0 11-2 0V4.804z" />
                  </svg>
                  <p className="font-display text-xs font-bold text-navy">Academic Excellence</p>
                </div>
                <div className="bg-teal border-[3px] border-navy rounded-2xl p-4 shadow-[4px_4px_0_0_#000]">
                  <svg className="w-8 h-8 text-navy mb-2" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
                  </svg>
                  <p className="font-display text-xs font-bold text-navy">Networking</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ABOUT SECTION - BENTO LAYOUT */}
        <section id="about" className="py-12 sm:py-20 bg-lime">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <div className="relative inline-block mb-8 sm:mb-12">
              <svg className="absolute -top-6 -right-10 w-9 h-9 text-navy/30" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0l1.5 7.5L21 9l-7.5 1.5L12 18l-1.5-7.5L3 9l7.5-1.5z" />
              </svg>
              <span className="absolute -top-3 -right-4 text-navy/20 text-xs select-none">✦</span>
              <svg className="absolute -bottom-4 -left-8 w-7 h-7 text-coral/50" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0l1.5 7.5L21 9l-7.5 1.5L12 18l-1.5-7.5L3 9l7.5-1.5z" />
              </svg>
              <span className="absolute -bottom-1 -left-3 text-coral/35 text-xs select-none">✦</span>
              <h2 className="font-display text-3xl sm:text-5xl lg:text-6xl text-navy font-black">
                About <span className="bg-snow border-[4px] border-navy px-4 sm:px-6 py-2 inline-block rotate-[-2deg] shadow-[6px_6px_0_0_#000]">IESA</span>
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              {/* Mission card */}
              <div className="bg-coral border-[4px] border-navy rounded-3xl p-6 sm:p-8 shadow-[8px_8px_0_0_#000] rotate-[-1deg] hover:rotate-0 transition-transform">
                <div className="w-12 h-12 sm:w-14 sm:h-14 bg-navy rounded-full flex items-center justify-center mb-4">
                  <svg className="w-6 h-6 sm:w-8 sm:h-8 text-lime" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
                  </svg>
                </div>
                <h3 className="font-display text-xl sm:text-2xl text-navy mb-3 font-black"><span className="brush-highlight brush-coral">Our Mission</span></h3>
                <p className="font-display text-sm sm:text-base text-navy/80 leading-relaxed font-medium">
                  Empower students through academic excellence and industry connections.
                </p>
              </div>

              {/* Image card */}
              <div className="bg-snow border-[4px] border-navy rounded-3xl p-4 sm:p-6 shadow-[8px_8px_0_0_#000]">
                <div className="aspect-square bg-gradient-to-br from-lavender-light to-teal-light border-[3px] border-navy rounded-2xl overflow-hidden relative mb-3">
                  <Image
                    src="https://images.unsplash.com/photo-1522202176988-66273c2fd55f?q=80&w=600"
                    alt="Community"
                    fill
                    className="object-cover mix-blend-multiply"
                  />
                </div>
                <p className="font-display text-xs sm:text-sm text-center font-bold text-navy">Building Tomorrow's Engineers</p>
              </div>

              {/* Vision card */}
              <div className="bg-sunny border-[4px] border-navy rounded-3xl p-6 sm:p-8 shadow-[8px_8px_0_0_#000] rotate-[1deg] hover:rotate-0 transition-transform">
                <div className="w-12 h-12 sm:w-14 sm:h-14 bg-navy rounded-full flex items-center justify-center mb-4">
                  <svg className="w-6 h-6 sm:w-8 sm:h-8 text-sunny" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                  </svg>
                </div>
                <h3 className="font-display text-xl sm:text-2xl text-navy mb-3 font-black"><span className="brush-highlight brush-coral">Our Vision</span></h3>
                <p className="font-display text-sm sm:text-base text-navy/80 leading-relaxed font-medium">
                  Africa's leading industrial engineering student community.
                </p>
              </div>
            </div>

            {/* CTA card */}
            <div className="mt-6 sm:mt-10 bg-navy border-[4px] border-navy rounded-3xl p-8 sm:p-12 lg:p-16 text-center">
              <h3 className="font-display text-3xl sm:text-5xl lg:text-6xl text-lime mb-4 sm:mb-6 font-black">Join 500+ Students</h3>
              <p className="font-display text-base sm:text-lg lg:text-xl text-ghost/80 mb-6 sm:mb-8 max-w-2xl mx-auto font-medium">
                Access workshops, resources, and a network of future engineers.
              </p>
              <Link
                href="/register"
                className="font-display inline-block bg-lime border-[4px] border-lime rounded-full px-8 sm:px-12 py-3 sm:py-4 text-sm sm:text-base font-black text-navy uppercase tracking-wide hover:translate-y-[2px] shadow-[6px_6px_0_0_#000] hover:shadow-[4px_4px_0_0_#000] transition-all"
              >
                Become a Member →
              </Link>
            </div>
          </div>
        </section>

        {/* ACTIVITIES SECTION - BENTO WITH IMAGES */}
        <section id="activities" className="py-12 sm:py-20 bg-snow">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <div className="relative mb-8 sm:mb-12 text-center">
              <svg className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-16 w-10 h-10 text-teal/50" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0l1.5 7.5L21 9l-7.5 1.5L12 18l-1.5-7.5L3 9l7.5-1.5z" />
              </svg>
              <span className="absolute -top-10 left-1/2 translate-x-4 text-teal/35 text-sm select-none">✦</span>
              <svg className="absolute -top-8 left-[35%] w-6 h-6 text-lavender/40" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0l1.5 7.5L21 9l-7.5 1.5L12 18l-1.5-7.5L3 9l7.5-1.5z" />
              </svg>
              <span className="absolute -top-4 left-[33%] text-lavender/30 text-xs select-none">✦</span>
              <svg className="absolute -top-6 right-[38%] w-7 h-7 text-sunny/45" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0l1.5 7.5L21 9l-7.5 1.5L12 18l-1.5-7.5L3 9l7.5-1.5z" />
              </svg>
              <span className="absolute -top-2 right-[36%] text-sunny/30 text-xs select-none">✦</span>
              <h2 className="font-display text-3xl sm:text-5xl lg:text-6xl text-navy font-black">
                <span className="brush-highlight">What We</span> <span className="bg-lavender border-[4px] border-navy px-4 sm:px-6 py-2 inline-block rotate-[-2deg] shadow-[6px_6px_0_0_#000]">Offer</span>
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
              {[
                {
                  title: "Workshops",
                  desc: "Technical training and certifications",
                  tags: ["CAD", "Python", "Leadership"],
                  bg: "bg-lavender",
                  img: "https://images.unsplash.com/photo-1524178232363-1fb2b075b655?q=80&w=800",
                },
                {
                  title: "Networking",
                  desc: "Industry talks and career fairs",
                  tags: ["Career Fair", "Talks", "Events"],
                  bg: "bg-teal",
                  img: "https://images.unsplash.com/photo-1511632765486-a01980e01a18?q=80&w=800",
                },
                {
                  title: "Resources",
                  desc: "Study materials and tutoring",
                  tags: ["Past Qs", "Library", "Tutoring"],
                  bg: "bg-coral",
                  img: "https://images.unsplash.com/photo-1529390079861-591de354faf5?q=80&w=800",
                },
                {
                  title: "Mentorship",
                  desc: "Connect with alumni and industry",
                  tags: ["Alumni", "Seniors", "Industry"],
                  bg: "bg-sunny",
                  img: "https://images.unsplash.com/photo-1552664730-d307ca884978?q=80&w=800",
                },
              ].map((item, i) => (
                <div
                  key={i}
                  className={`${item.bg} border-[4px] border-navy rounded-3xl p-6 shadow-[8px_8px_0_0_#000] hover:shadow-[5px_5px_0_0_#000] hover:translate-y-[2px] transition-all`}
                >
                  <div className="aspect-video bg-gradient-to-br from-lime-light to-coral-light border-[3px] border-navy rounded-2xl overflow-hidden relative mb-4">
                    <Image
                      src={item.img}
                      alt={item.title}
                      fill
                      className="object-cover mix-blend-multiply"
                    />
                  </div>
                  <h3 className="font-display text-xl sm:text-2xl text-navy mb-2 font-black">{item.title}</h3>
                  <p className="font-display text-sm text-navy/80 mb-4 font-medium">{item.desc}</p>
                  <div className="flex gap-2 flex-wrap">
                    {item.tags.map((tag, j) => (
                      <span
                        key={j}
                        className="font-display bg-snow border-[2px] border-navy rounded-full px-3 py-1 text-xs font-bold text-navy uppercase shadow-[2px_2px_0_0_#000]"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA SECTION */}
        <section className="py-16 sm:py-24 bg-coral">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
            <div className="inline-block bg-navy rounded-full px-4 py-1.5 mb-6">
              <span className="font-display text-xs font-black text-lime uppercase tracking-widest">Ready to Join?</span>
            </div>

            <h2 className="font-display text-4xl sm:text-6xl lg:text-7xl text-navy mb-6 sm:mb-8 leading-none font-black">
              <span className="brush-highlight brush-coral">Start Your</span><br />Journey Today
            </h2>

            <p className="font-display text-base sm:text-xl text-navy mb-8 sm:mb-12 max-w-2xl mx-auto font-black">
              Join 500+ students building the future of engineering in Nigeria
            </p>

            <div className="flex flex-col sm:flex-row justify-center gap-4">
              <Link
                href="/register"
                className="font-display bg-lime border-[4px] border-navy rounded-full px-10 py-4 text-base font-black text-navy uppercase tracking-wide hover:translate-y-[2px] shadow-[8px_8px_0_0_#0F0F2D] hover:shadow-[4px_4px_0_0_#0F0F2D] transition-all"
              >
                Sign Up Free →
              </Link>
              <Link
                href="/login"
                className="font-display bg-snow border-[4px] border-navy rounded-full px-10 py-4 text-base font-black text-navy uppercase tracking-wide shadow-[8px_8px_0_0_#000]"
              >
                Login
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* SHARED FOOTER */}
      <Footer />
    </div>
  );
}
