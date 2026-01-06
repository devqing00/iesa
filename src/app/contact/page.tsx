"use client";

import Image from "next/image";
import Link from "next/link";
import { useSyncExternalStore, useState } from "react";
import { useTheme } from "next-themes";

// Hydration helper
const emptySubscribe = () => () => {};
const getSnapshot = () => true;
const getServerSnapshot = () => false;

export default function ContactPage() {
  const mounted = useSyncExternalStore(
    emptySubscribe,
    getSnapshot,
    getServerSnapshot
  );
  const { theme, setTheme } = useTheme();
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    subject: "",
    message: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!mounted) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    // Simulate form submission
    await new Promise((resolve) => setTimeout(resolve, 1000));
    alert("Message sent! We'll get back to you soon.");
    setFormData({ name: "", email: "", subject: "", message: "" });
    setIsSubmitting(false);
  };

  return (
    <div className="min-h-screen bg-bg-primary text-text-primary">
      {/* ============================================
          NAVIGATION HEADER
          ============================================ */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-bg-primary/90 backdrop-blur-sm border-b border-border">
        <div className="section-container flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3">
            <div className="w-8 h-8 relative">
              {theme === "light" ? (
                <Image
                  src="/assets/images/logo.svg"
                  alt="IESA"
                  fill
                  className="object-contain"
                />
              ) : (
                <Image
                  src="/assets/images/logo-light.svg"
                  alt="IESA"
                  fill
                  className="object-contain"
                />
              )}
            </div>
            <span className="font-display text-xl">IESA</span>
          </Link>

          {/* Center Nav */}
          <nav className="hidden md:flex items-center gap-8">
            <Link
              href="/about"
              className="text-label text-text-secondary hover:text-text-primary transition-colors"
            >
              About
            </Link>
            <Link
              href="/history"
              className="text-label text-text-secondary hover:text-text-primary transition-colors"
            >
              History
            </Link>
            <Link
              href="/events"
              className="text-label text-text-secondary hover:text-text-primary transition-colors"
            >
              Events
            </Link>
            <Link
              href="/contact"
              className="text-label text-text-primary transition-colors"
            >
              Contact
            </Link>
          </nav>

          {/* Right Actions */}
          <div className="flex items-center gap-4">
            <button
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="p-2 hover:bg-bg-secondary rounded transition-colors"
              aria-label="Toggle theme"
            >
              {theme === "dark" ? (
                <svg
                  className="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z"
                  />
                </svg>
              ) : (
                <svg
                  className="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z"
                  />
                </svg>
              )}
            </button>
            <Link
              href="/login"
              className="btn-editorial btn-editorial-plus hidden sm:inline-flex"
            >
              Login
            </Link>
          </div>
        </div>
      </header>

      {/* ============================================
          HERO SECTION
          ============================================ */}
      <section className="pt-32 pb-20 relative overflow-hidden">
        <div className="section-container">
          {/* Top Row */}
          <div className="flex justify-between items-center mb-12">
            <span className="page-number">Page 01</span>
            <span className="text-label-sm text-text-muted flex items-center gap-2">
              <span>✦</span> Contact
            </span>
          </div>

          {/* Hero Content */}
          <div className="max-w-4xl space-y-8">
            <h1 className="font-display text-display-lg">
              Get in
              <br />
              Touch
            </h1>
            <p className="text-body text-text-secondary max-w-2xl text-lg leading-relaxed">
              Have questions about IESA? Want to collaborate or partner with us?
              We&apos;d love to hear from you.
            </p>
          </div>
        </div>
      </section>

      {/* ============================================
          CONTACT SECTION
          ============================================ */}
      <section className="py-20 border-t border-border">
        <div className="section-container">
          {/* Section Header */}
          <div className="flex justify-between items-center mb-16">
            <div className="flex items-center gap-4">
              <span className="text-label text-text-muted">01</span>
              <span className="text-label">Contact Us</span>
            </div>
            <span className="page-number">Page 02</span>
          </div>

          {/* Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
            {/* Contact Form */}
            <div className="space-y-8">
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-label-sm text-text-muted">Name</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    className="w-full px-4 py-3 bg-bg-card border border-border text-text-primary text-body placeholder:text-text-muted focus:outline-none focus:border-border-dark transition-colors"
                    placeholder="Your full name"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-label-sm text-text-muted">Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                    className="w-full px-4 py-3 bg-bg-card border border-border text-text-primary text-body placeholder:text-text-muted focus:outline-none focus:border-border-dark transition-colors"
                    placeholder="your.email@example.com"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-label-sm text-text-muted">
                    Subject
                  </label>
                  <input
                    type="text"
                    value={formData.subject}
                    onChange={(e) =>
                      setFormData({ ...formData, subject: e.target.value })
                    }
                    className="w-full px-4 py-3 bg-bg-card border border-border text-text-primary text-body placeholder:text-text-muted focus:outline-none focus:border-border-dark transition-colors"
                    placeholder="What is this about?"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-label-sm text-text-muted">
                    Message
                  </label>
                  <textarea
                    value={formData.message}
                    onChange={(e) =>
                      setFormData({ ...formData, message: e.target.value })
                    }
                    rows={6}
                    className="w-full px-4 py-3 bg-bg-card border border-border text-text-primary text-body placeholder:text-text-muted focus:outline-none focus:border-border-dark transition-colors resize-none"
                    placeholder="Your message..."
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="btn-editorial btn-editorial-plus w-full disabled:opacity-50"
                >
                  {isSubmitting ? "Sending..." : "+ Send Message +"}
                </button>
              </form>
            </div>

            {/* Contact Info */}
            <div className="space-y-8">
              {/* Info Cards */}
              <div className="space-y-6">
                <div className="page-frame p-8 space-y-4">
                  <span className="text-label-sm text-text-muted flex items-center gap-2">
                    <span>◆</span> Location
                  </span>
                  <p className="text-body text-text-primary">
                    Department of Industrial & Production Engineering
                    <br />
                    Faculty of Technology
                    <br />
                    University of Ibadan
                    <br />
                    Ibadan, Nigeria
                  </p>
                </div>

                <div className="page-frame p-8 space-y-4">
                  <span className="text-label-sm text-text-muted flex items-center gap-2">
                    <span>◆</span> Email
                  </span>
                  <a
                    href="mailto:iesa@ui.edu.ng"
                    className="text-body text-text-primary hover:text-text-secondary transition-colors"
                  >
                    iesa@ui.edu.ng
                  </a>
                </div>

                <div className="page-frame p-8 space-y-4">
                  <span className="text-label-sm text-text-muted flex items-center gap-2">
                    <span>◆</span> Social Media
                  </span>
                  <div className="flex items-center gap-6">
                    <a
                      href="#"
                      className="text-text-muted hover:text-text-primary transition-colors"
                      aria-label="Twitter"
                    >
                      <svg
                        className="w-6 h-6"
                        fill="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path d="M8.29 20.251c7.547 0 11.675-6.253 11.675-11.675 0-.178 0-.355-.012-.53A8.348 8.348 0 0022 5.92a8.19 8.19 0 01-2.357.646 4.118 4.118 0 001.804-2.27 8.224 8.224 0 01-2.605.996 4.107 4.107 0 00-6.993 3.743 11.65 11.65 0 01-8.457-4.287 4.106 4.106 0 001.27 5.477A4.072 4.072 0 012.8 9.713v.052a4.105 4.105 0 003.292 4.022 4.095 4.095 0 01-1.853.07 4.108 4.108 0 003.834 2.85A8.233 8.233 0 012 18.407a11.616 11.616 0 006.29 1.84" />
                      </svg>
                    </a>
                    <a
                      href="#"
                      className="text-text-muted hover:text-text-primary transition-colors"
                      aria-label="Instagram"
                    >
                      <svg
                        className="w-6 h-6"
                        fill="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          fillRule="evenodd"
                          d="M12.315 2c2.43 0 2.784.013 3.808.06 1.064.049 1.791.218 2.427.465a4.902 4.902 0 011.772 1.153 4.902 4.902 0 011.153 1.772c.247.636.416 1.363.465 2.427.048 1.067.06 1.407.06 4.123v.08c0 2.643-.012 2.987-.06 4.043-.049 1.064-.218 1.791-.465 2.427a4.902 4.902 0 01-1.153 1.772 4.902 4.902 0 01-1.772 1.153c-.636.247-1.363.416-2.427.465-1.067.048-1.407.06-4.123.06h-.08c-2.643 0-2.987-.012-4.043-.06-1.064-.049-1.791-.218-2.427-.465a4.902 4.902 0 01-1.772-1.153 4.902 4.902 0 01-1.153-1.772c-.247-.636-.416-1.363-.465-2.427-.047-1.024-.06-1.379-.06-3.808v-.63c0-2.43.013-2.784.06-3.808.049-1.064.218-1.791.465-2.427a4.902 4.902 0 011.153-1.772A4.902 4.902 0 015.45 2.525c.636-.247 1.363-.416 2.427-.465C8.901 2.013 9.256 2 11.685 2h.63zm-.081 1.802h-.468c-2.456 0-2.784.011-3.807.058-.975.045-1.504.207-1.857.344-.467.182-.8.398-1.15.748-.35.35-.566.683-.748 1.15-.137.353-.3.882-.344 1.857-.047 1.023-.058 1.351-.058 3.807v.468c0 2.456.011 2.784.058 3.807.045.975.207 1.504.344 1.857.182.466.399.8.748 1.15.35.35.683.566 1.15.748.353.137.882.3 1.857.344 1.054.048 1.37.058 4.041.058h.08c2.597 0 2.917-.01 3.96-.058.976-.045 1.505-.207 1.858-.344.466-.182.8-.398 1.15-.748.35-.35.566-.683.748-1.15.137-.353.3-.882.344-1.857.048-1.055.058-1.37.058-4.041v-.08c0-2.597-.01-2.917-.058-3.96-.045-.976-.207-1.505-.344-1.858a3.097 3.097 0 00-.748-1.15 3.098 3.098 0 00-1.15-.748c-.353-.137-.882-.3-1.857-.344-1.023-.047-1.351-.058-3.807-.058zM12 6.865a5.135 5.135 0 110 10.27 5.135 5.135 0 010-10.27zm0 1.802a3.333 3.333 0 100 6.666 3.333 3.333 0 000-6.666zm5.338-3.205a1.2 1.2 0 110 2.4 1.2 1.2 0 010-2.4z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </a>
                    <a
                      href="#"
                      className="text-text-muted hover:text-text-primary transition-colors"
                      aria-label="LinkedIn"
                    >
                      <svg
                        className="w-6 h-6"
                        fill="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                      </svg>
                    </a>
                  </div>
                </div>
              </div>

              {/* Office Hours */}
              <div className="page-frame p-8 space-y-4">
                <span className="text-label-sm text-text-muted flex items-center gap-2">
                  <span>◆</span> Office Hours
                </span>
                <div className="space-y-2 text-body">
                  <div className="flex justify-between">
                    <span className="text-text-secondary">Monday - Friday</span>
                    <span className="text-text-primary">9:00 AM - 5:00 PM</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-secondary">Saturday</span>
                    <span className="text-text-primary">
                      10:00 AM - 2:00 PM
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-secondary">Sunday</span>
                    <span className="text-text-muted">Closed</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================
          FAQ SECTION
          ============================================ */}
      <section className="py-20 bg-bg-secondary border-t border-border">
        <div className="section-container">
          {/* Section Header */}
          <div className="flex justify-between items-center mb-16">
            <div className="flex items-center gap-4">
              <span className="text-label text-text-muted">02</span>
              <span className="text-label">Frequently Asked Questions</span>
            </div>
            <span className="page-number">Page 03</span>
          </div>

          {/* FAQ Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {[
              {
                question: "How do I become a member of IESA?",
                answer:
                  "All students in the Department of Industrial & Production Engineering are automatically members. To access full benefits, register on our platform.",
              },
              {
                question: "What are the membership fees?",
                answer:
                  "Membership is free for all IPE students. Some special events may have nominal registration fees.",
              },
              {
                question: "How can I volunteer or join the executive team?",
                answer:
                  "Elections are held annually. You can also volunteer for committees by contacting the General Secretary.",
              },
              {
                question: "Can non-IPE students attend IESA events?",
                answer:
                  "Yes! Most of our events are open to all students, though some may have limited capacity for members first.",
              },
            ].map((faq, i) => (
              <div key={i} className="page-frame p-8 space-y-4">
                <h3 className="font-display text-lg">{faq.question}</h3>
                <p className="text-body text-text-secondary text-sm leading-relaxed">
                  {faq.answer}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================
          FOOTER
          ============================================ */}
      <footer className="py-12 border-t border-border">
        <div className="section-container">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-label-sm text-text-muted">
              © {new Date().getFullYear()} IESA. All rights reserved.
            </p>
            <p className="text-label-sm text-text-muted flex items-center gap-2">
              <span>✦</span> University of Ibadan, Nigeria
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
