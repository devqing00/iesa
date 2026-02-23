/**
 * IESA Department Logo Component
 * Uses the actual IESA logo SVG from /public/assets/images/logo.svg
 */

import Image from "next/image";

interface IesaLogoProps {
  className?: string;
  size?: number;
}

export function IesaLogo({ className = "", size = 80 }: IesaLogoProps) {
  return (
    <Image
      src="/assets/images/logo.svg"
      alt="IESA - Industrial Engineering Students' Association"
      width={size}
      height={size}
      className={className}
      priority
    />
  );
}

/**
 * Simplified text-only logo for headers
 */
export function IesaTextLogo({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <IesaLogo size={40} />
      <div>
        <div className="font-display font-black text-xl text-navy leading-none">IESA</div>
        <div className="text-[8px] text-navy/60 uppercase tracking-wider font-bold leading-none mt-0.5">
          Industrial Engineering
        </div>
      </div>
    </div>
  );
}

