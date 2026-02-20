import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About IESA",
  description:
    "Learn about the Industrial Engineering Students' Association at the University of Ibadan — our mission, vision, and impact.",
};

export default function AboutLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
