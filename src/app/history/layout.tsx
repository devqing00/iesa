import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Our History",
  description:
    "Explore the rich history of the Industrial Engineering Students' Association at the University of Ibadan.",
};

export default function HistoryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
