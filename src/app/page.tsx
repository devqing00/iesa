import Image from "next/image";
import Link from "next/link";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";

export default function Home() {
  return (
    <div className="min-h-screen bg-snow overflow-x-hidden">
      {/* Subtle diamond sparkle decorators */}
      <svg
        className="fixed top-16 left-[10%] w-5 h-5 text-navy/8 pointer-events-none z-0"
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="currentColor"
      >
        <path d="M12 0l1.5 7.5L21 9l-7.5 1.5L12 18l-1.5-7.5L3 9l7.5-1.5z" />
      </svg>
      <svg
        className="fixed top-32 right-[12%] w-6 h-6 text-navy/6 pointer-events-none z-0"
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="currentColor"
      >
        <path d="M12 0l1.5 7.5L21 9l-7.5 1.5L12 18l-1.5-7.5L3 9l7.5-1.5z" />
      </svg>
      <svg
        className="fixed top-[45%] left-[8%] w-5 h-5 text-navy/6 pointer-events-none z-0"
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="currentColor"
      >
        <path d="M12 0l1.5 7.5L21 9l-7.5 1.5L12 18l-1.5-7.5L3 9l7.5-1.5z" />
      </svg>
      <svg
        className="fixed top-[60%] right-[20%] w-4 h-4 text-navy/8 pointer-events-none z-0"
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="currentColor"
      >
        <path d="M12 0l1.5 7.5L21 9l-7.5 1.5L12 18l-1.5-7.5L3 9l7.5-1.5z" />
      </svg>

      <Header />

      <main id="main-content" className="relative z-10 pt-14 sm:pt-16">
        {/* ═══ HERO ═══ */}
        <section className="relative md:min-h-[calc(100vh-5rem)] flex flex-col justify-center overflow-hidden">
          {/* Background image with gradient overlay */}
          <div className="absolute inset-0 z-0">
            <Image
              src="https://images.unsplash.com/photo-1519389950473-47ba0277781c?q=80&w=1920"
              alt=""
              fill
              priority
              sizes="100vw"
              className="object-cover"
              aria-hidden="true"
            />
            <div className="absolute inset-0 bg-linear-to-r from-navy/95 via-navy/80 to-navy/40" />
            <div className="absolute inset-0 bg-linear-to-t from-navy/60 to-transparent" />
          </div>

          {/* Accent lime stripe */}
          <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-lime z-10 hidden md:block" />

          {/* Content */}
          <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 py-20 sm:py-28 md:py-0">
            <div className="max-w-2xl">
              <h1 className="font-display font-black text-[3rem] sm:text-[4.5rem] lg:text-[6rem] leading-[0.88] text-snow mb-6">
                Engineering
                <br />
                <span className="text-lime">Excellence</span>
                <br />
                Starts Here
              </h1>

              <p className="font-display text-base sm:text-lg text-snow/75 max-w-lg mb-8 leading-relaxed font-medium">
                Join IESA — the premier industrial engineering student
                association at the University of Ibadan, building Africa&apos;s
                next generation of engineers.
              </p>

              <div className="flex flex-col sm:flex-row gap-3 mb-14">
                <Link
                  href="/register"
                  className="font-display text-center bg-lime border-[3px] border-navy rounded-full px-8 py-3.5 text-sm font-black text-navy uppercase tracking-wide press-3 press-navy transition-all"
                >
                  Join IESA →
                </Link>
                <Link
                  href="/about"
                  className="font-display text-center bg-snow/10 backdrop-blur-sm border-[3px] border-snow/40 rounded-full px-8 py-3.5 text-sm font-black text-snow uppercase tracking-wide hover:bg-snow/20 transition-all"
                >
                  Our Story
                </Link>
              </div>
            </div>
          </div>

          {/* Floating badge bottom-right */}
          <div className="absolute bottom-8 right-8 hidden lg:block z-10">
            <div className="bg-lime border-[3px] border-navy rounded-2xl px-5 py-3 shadow-[4px_4px_0_0_#000] rotate-[2deg]">
              <p className="font-display font-black text-[10px] text-navy uppercase tracking-widest mb-0.5">
                Est. 2018
              </p>
              <p className="font-display font-black text-base text-navy">
                UI Engineering
              </p>
            </div>
          </div>
        </section>

        {/* ═══ ABOUT ═══ */}
        <section id="about" className="py-12 sm:py-20 bg-ghost">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <div className="mb-8 sm:mb-12">
              <h2 className="font-display text-3xl sm:text-5xl lg:text-6xl text-navy font-black">
                About{" "}
                <span className="inline-block bg-snow border-[3px] border-navy px-4 sm:px-6 py-2 rotate-[-2deg] shadow-[3px_3px_0_0_#000]">
                  IESA
                </span>
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              {/* Mission */}
              <div className="bg-coral border-[3px] border-navy rounded-3xl p-6 sm:p-8 shadow-[3px_3px_0_0_#000] rotate-[-1deg] hover:rotate-0 transition-transform">
                <div className="w-12 h-12 sm:w-14 sm:h-14 bg-navy rounded-full flex items-center justify-center mb-4">
                  <svg
                    className="w-6 h-6 sm:w-8 sm:h-8 text-snow"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <h3 className="font-display text-xl sm:text-2xl text-snow mb-3 font-black">
                  Our Mission
                </h3>
                <p className="font-display text-sm sm:text-base text-snow/85 leading-relaxed font-medium">
                  Empower students through academic excellence and industry
                  connections.
                </p>
              </div>

              {/* Image card */}
              <div className="bg-snow border-[3px] border-navy rounded-3xl p-4 sm:p-6 shadow-[3px_3px_0_0_#000]">
                <div className="aspect-square bg-gradient-to-br from-lavender-light to-teal-light border-[2px] border-navy rounded-2xl overflow-hidden relative mb-3">
                  <Image
                    src="https://images.unsplash.com/photo-1522202176988-66273c2fd55f?q=80&w=600"
                    alt="Community"
                    fill
                    sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    className="object-cover mix-blend-multiply"
                  />
                </div>
                <p className="font-display text-xs sm:text-sm text-center font-bold text-navy">
                  Building Tomorrow&apos;s Engineers
                </p>
              </div>

              {/* Vision */}
              <div className="bg-sunny border-[3px] border-navy rounded-3xl p-6 sm:p-8 shadow-[3px_3px_0_0_#000] rotate-[1deg] hover:rotate-0 transition-transform">
                <div className="w-12 h-12 sm:w-14 sm:h-14 bg-navy rounded-full flex items-center justify-center mb-4">
                  <svg
                    className="w-6 h-6 sm:w-8 sm:h-8 text-sunny"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <h3 className="font-display text-xl sm:text-2xl text-navy mb-3 font-black">
                  Our Vision
                </h3>
                <p className="font-display text-sm sm:text-base text-navy/80 leading-relaxed font-medium">
                  Africa&apos;s leading industrial engineering student
                  community.
                </p>
              </div>
            </div>

            {/* CTA card */}
            <div className="mt-6 sm:mt-10 bg-navy border-[3px] border-navy rounded-3xl p-8 sm:p-12 lg:p-16 text-center">
              <h3 className="font-display text-3xl sm:text-5xl lg:text-6xl text-snow mb-4 sm:mb-6 font-black">
                Join 500+ Students
              </h3>
              <p className="font-display text-base sm:text-lg lg:text-xl text-ghost/80 mb-6 sm:mb-8 max-w-2xl mx-auto font-medium">
                Access workshops, resources, and a network of future engineers.
              </p>
              <Link
                href="/register"
                className="font-display inline-block bg-snow border-[3px] border-navy rounded-full px-8 sm:px-12 py-3 sm:py-4 text-sm sm:text-base font-black text-navy uppercase tracking-wide press-3 press-black transition-all"
              >
                Become a Member →
              </Link>
            </div>
          </div>
        </section>

        {/* ═══ WHAT WE OFFER ═══ */}
        <section id="activities" className="py-12 sm:py-20 bg-snow">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <div className="mb-8 sm:mb-12 text-center">
              <h2 className="font-display text-3xl sm:text-5xl lg:text-6xl text-navy font-black">
                What We{" "}
                <span className="inline-block bg-lavender border-[3px] border-navy px-4 sm:px-6 py-2 rotate-[-2deg] shadow-[3px_3px_0_0_#000]">
                  Offer
                </span>
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
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
                  light: false,
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
                  className={`${item.bg} border-[3px] border-navy rounded-3xl p-6 press-3 press-black transition-all`}
                >
                  <div className="aspect-video bg-gradient-to-br from-ghost to-lavender-light border-[2px] border-navy rounded-2xl overflow-hidden relative mb-4">
                    <Image
                      src={item.img}
                      alt={item.title}
                      fill
                      sizes="(max-width: 768px) 100vw, 50vw"
                      className="object-cover mix-blend-multiply"
                    />
                  </div>
                  <h3
                    className={`font-display text-xl sm:text-2xl ${item.light === false ? "text-snow" : "text-navy"} mb-2 font-black`}
                  >
                    {item.title}
                  </h3>
                  <p
                    className={`font-display text-sm ${item.light === false ? "text-snow/80" : "text-navy/80"} mb-4 font-medium`}
                  >
                    {item.desc}
                  </p>
                  <div className="flex gap-2 flex-wrap">
                    {item.tags.map((tag, j) => (
                      <span
                        key={j}
                        className="font-display bg-snow border-[2px] border-navy rounded-full px-3 py-1 text-xs font-bold text-navy uppercase"
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

        {/* ═══ CTA ═══ */}
        <section className="py-16 sm:py-24 bg-coral">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
            <div className="inline-block bg-navy rounded-full px-4 py-1.5 mb-6">
              <span className="font-display text-xs font-black text-snow uppercase tracking-widest">
                Ready to Join?
              </span>
            </div>

            <h2 className="font-display text-4xl sm:text-6xl lg:text-7xl text-snow mb-6 sm:mb-8 leading-none font-black">
              Start Your
              <br />
              Journey Today
            </h2>

            <p className="font-display text-base sm:text-xl text-snow/90 mb-8 sm:mb-12 max-w-2xl mx-auto font-bold">
              Join 500+ students building the future of engineering in Nigeria
            </p>

            <div className="flex flex-col sm:flex-row justify-center gap-4">
              <Link
                href="/register"
                className="font-display bg-snow border-[3px] border-navy rounded-full px-10 py-4 text-base font-black text-navy uppercase tracking-wide press-3 press-black transition-all"
              >
                Sign Up Free →
              </Link>
              <Link
                href="/login"
                className="font-display bg-transparent border-[3px] border-snow rounded-full px-10 py-4 text-base font-black text-snow uppercase tracking-wide hover:bg-snow/10 transition-all"
              >
                Login
              </Link>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
