import { useTheme } from "next-themes";
import Image from "next/image";

export default function AboutSection() {
  const { theme } = useTheme();
  return (
    <section
      id="about"
      className="relative z-20 w-full max-w-7xl px-4 py-24 mx-auto"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
        <div>
          <span className="inline-block px-4 py-2 rounded-full bg-primary/10 text-primary text-xs font-bold tracking-widest uppercase mb-6">
            Who We Are
          </span>
          <h2 className="text-4xl md:text-5xl font-bold font-heading text-foreground mb-6 leading-tight">
            Empowering the Next Generation of Engineers
          </h2>
          <p className="text-lg text-foreground/70 leading-relaxed mb-8">
            The Integrated Engineering Student Association (IESA) is dedicated
            to fostering academic excellence, professional development, and
            community among engineering students. We bridge the gap between
            classroom theory and industry practice.
          </p>
          <button className="px-8 py-4 rounded-xl bg-foreground text-background font-bold text-sm hover:opacity-90 transition-opacity shadow-lg">
            Learn More About Us
          </button>
        </div>
        <div className="relative h-125 rounded-4xl overflow-hidden shadow-2xl group">
          {/* Theme-aware illustration: light / dark variants */}
          {theme === "dark" ? (
            <Image
              src="/assets/images/illust-light.webp"
              alt="About illustration (light)"
              fill
              className="object-cover z-0"
              priority={false}
            />
          ) : (
            <Image
              src="/assets/images/illust-dark.webp"
              alt="About illustration (dark)"
              fill
              className="object-cover z-0"
              priority={false}
            />
          )}
          <div className="absolute inset-0 bg-linear-to-tr from-primary/20 to-transparent z-10 mix-blend-overlay"></div>
          <div className="absolute inset-0 flex items-center justify-center text-foreground/20 font-heading font-bold text-9xl opacity-20 select-none z-20 pointer-events-none">
            IESA
          </div>
        </div>
      </div>
    </section>
  );
}
