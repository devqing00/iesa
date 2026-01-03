import { useTheme } from "next-themes";
import Image from "next/image";

export default function Footer() {
  const { theme } = useTheme();
  return (
    <footer id="contact" className="relative z-20 w-full py-12 px-8 border-t border-foreground/5 bg-background/50 backdrop-blur-sm mt-20">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 relative text-primary">
             {theme === "light" ? (
            <Image src="/assets/images/logo.svg" alt="IESA Logo" fill className="object-contain" />
          ) : (
            <Image src="/assets/images/logo-light.svg" alt="IESA Logo" fill className="object-contain" />
          )}
          </div>
          <span className="font-heading font-bold text-lg tracking-tight text-foreground">IESA</span>
        </div>
        
        <div className="flex gap-8 text-sm font-medium text-foreground/60">
          <a href="#" className="hover:text-foreground transition-colors">About</a>
          <a href="#" className="hover:text-foreground transition-colors">Events</a>
          <a href="#" className="hover:text-foreground transition-colors">Resources</a>
          <a href="#" className="hover:text-foreground transition-colors">Contact</a>
        </div>

        <div className="text-xs text-foreground/40 font-medium">
          © {new Date().getFullYear()} IESA. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
