import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "IEPOD Hub",
  description:
    "The Industrial Engineering Product Development Hub — discover your niche, build your team, and compete in hackathons.",
  openGraph: {
    title: "IEPOD Hub | IESA",
    description:
      "The Industrial Engineering Product Development Hub — discover your niche, build your team, and compete in hackathons.",
  },
};

export default function IepodLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
