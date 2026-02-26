import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "IESA Team — Leadership & Executives",
  description:
    "Meet the IESA leadership team — the Central Executives, Class Representatives, and Committee Heads serving the Industrial Engineering Students' Association at the University of Ibadan.",
};

export default function TeamLayout({ children }: { children: React.ReactNode }) {
  return children;
}
