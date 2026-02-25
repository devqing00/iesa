import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Blog",
  description:
    "Latest news, updates, and articles from the Industrial Engineering Students' Association, University of Ibadan.",
  openGraph: {
    title: "Blog | IESA",
    description:
      "Latest news, updates, and articles from the Industrial Engineering Students' Association.",
  },
};

export default function BlogLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
