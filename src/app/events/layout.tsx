import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Events",
  description:
    "Browse upcoming and past events from the Industrial Engineering Students' Association — workshops, seminars, socials, and more.",
};

export default function EventsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
