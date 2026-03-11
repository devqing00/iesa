"use client";

import { useEffect, useRef, useState } from "react";

const CONFETTI_COLORS = [
  "#C8F31D", // lime
  "#9B72CF", // lavender
  "#E8614D", // coral
  "#5BD4C0", // teal
  "#E0C340", // sunny
  "#FF69B4", // pink
  "#FFD700", // gold
];

/**
 * Full-screen birthday confetti overlay.
 *
 * Shows once per session (uses sessionStorage) so users aren't
 * bombarded on every page navigation. Lasts ~4 seconds with a
 * gentle gravity+fade animation.
 */
export function BirthdayConfetti() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Only show once per browser session
    const key = "iesa_birthday_confetti_shown";
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
    setVisible(true);
  }, []);

  useEffect(() => {
    if (!visible) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = window.innerWidth;
    const H = window.innerHeight;
    canvas.width = W;
    canvas.height = H;

    interface Particle {
      x: number;
      y: number;
      w: number;
      h: number;
      color: string;
      vx: number;
      vy: number;
      rot: number;
      rotSpeed: number;
      opacity: number;
    }

    const particles: Particle[] = Array.from({ length: 120 }, () => ({
      x: Math.random() * W,
      y: Math.random() * -H * 0.6,
      w: 5 + Math.random() * 7,
      h: 7 + Math.random() * 10,
      color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
      vx: (Math.random() - 0.5) * 3,
      vy: 2 + Math.random() * 4,
      rot: Math.random() * 360,
      rotSpeed: (Math.random() - 0.5) * 10,
      opacity: 1,
    }));

    let raf: number;
    let frame = 0;
    const maxFrames = 240; // ~4 seconds at 60fps

    function animate() {
      frame++;
      ctx!.clearRect(0, 0, W, H);

      const fadeStart = maxFrames * 0.65;

      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.rotSpeed;
        p.vy += 0.03; // gravity

        if (frame > fadeStart) {
          p.opacity = Math.max(0, 1 - (frame - fadeStart) / (maxFrames - fadeStart));
        }

        ctx!.save();
        ctx!.translate(p.x, p.y);
        ctx!.rotate((p.rot * Math.PI) / 180);
        ctx!.globalAlpha = p.opacity;
        ctx!.fillStyle = p.color;
        ctx!.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx!.restore();
      }

      if (frame < maxFrames) {
        raf = requestAnimationFrame(animate);
      } else {
        setVisible(false);
      }
    }

    raf = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf);
  }, [visible]);

  if (!visible) return null;

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 w-full h-full pointer-events-none z-[9999]"
      aria-hidden="true"
    />
  );
}
