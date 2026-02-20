"use client";

import Link from "next/link";
import { useState } from "react";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import { useToast } from "@/components/ui/Toast";

export default function ContactPage() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    subject: "",
    message: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const toast = useToast();


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    // Simulate form submission
    await new Promise((resolve) => setTimeout(resolve, 1000));
    toast.success("Message Sent", "We'll get back to you soon.");
    setFormData({ name: "", email: "", subject: "", message: "" });
    setIsSubmitting(false);
  };

  return (
    <div className="min-h-screen bg-ghost text-navy overflow-x-hidden">
      {/* ✦ and diamond decorators */}
      <span className="fixed top-24 right-[15%] text-coral/12 text-xl pointer-events-none z-0 select-none">✦</span>
      <span className="fixed top-[50%] left-[8%] text-teal/15 text-lg pointer-events-none z-0 select-none">✦</span>
      <span className="fixed bottom-[30%] right-[22%] text-lavender/12 text-base pointer-events-none z-0 select-none">✦</span>
      <svg className="fixed top-20 left-[10%] w-6 h-6 text-lime/20 pointer-events-none z-0" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 0l1.5 7.5L21 9l-7.5 1.5L12 18l-1.5-7.5L3 9l7.5-1.5z" />
      </svg>
      <svg className="fixed top-[45%] right-[10%] w-7 h-7 text-sunny/15 pointer-events-none z-0" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 0l1.5 7.5L21 9l-7.5 1.5L12 18l-1.5-7.5L3 9l7.5-1.5z" />
      </svg>
      <svg className="fixed bottom-[20%] left-[15%] w-5 h-5 text-coral/20 pointer-events-none z-0" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 0l1.5 7.5L21 9l-7.5 1.5L12 18l-1.5-7.5L3 9l7.5-1.5z" />
      </svg>

      {/* SHARED HEADER */}
      <Header />

      <main id="main-content">
      {/* ============================================
          HERO SECTION
          ============================================ */}
      <section className="pt-32 pb-12 sm:pb-16 relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Small tag */}
          <div className="inline-flex items-center gap-2 bg-teal border-[3px] border-navy rounded-full px-3 py-1 mb-6">
            <span className="text-[10px] font-display font-black text-navy uppercase tracking-widest">✦ Contact</span>
          </div>

          {/* Hero Content */}
          <div className="max-w-4xl space-y-8">
            <h1 className="font-display font-black text-[2.5rem] sm:text-[4rem] lg:text-[5rem] leading-[0.9] text-navy">
              <span className="brush-highlight">Get in</span>
              <br />
              <span className="inline-block bg-coral border-[4px] sm:border-[6px] border-navy px-4 sm:px-6 py-2 rotate-[-1deg] shadow-[6px_6px_0_0_#000]">Touch</span>
            </h1>
            <p className="font-display font-medium text-base sm:text-lg text-navy/60 max-w-2xl leading-relaxed">
              Have questions about IESA? Want to collaborate or partner with us?
              We&apos;d love to hear from you.
            </p>
          </div>
        </div>
      </section>

      {/* ============================================
          CONTACT SECTION
          ============================================ */}
      <section className="py-16 sm:py-20 bg-snow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
            {/* Contact Form */}
            <div className="bg-snow border-[4px] border-navy rounded-3xl p-6 sm:p-8 shadow-[8px_8px_0_0_#000]">
              <h2 className="font-display font-black text-2xl sm:text-3xl text-navy mb-6">
                <span className="brush-highlight">Send a</span> Message
              </h2>
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-2">
                  <label htmlFor="contact-name" className="font-display font-bold text-xs text-navy uppercase tracking-wider">Name</label>
                  <input
                    id="contact-name"
                    type="text"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    className="w-full px-4 py-3 bg-ghost border-[3px] border-navy rounded-xl font-display font-medium text-sm text-navy placeholder:text-slate focus:outline-none focus:border-lime focus:shadow-[3px_3px_0_0_#C8F31D] transition-all"
                    placeholder="Your full name"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="contact-email" className="font-display font-bold text-xs text-navy uppercase tracking-wider">Email</label>
                  <input
                    id="contact-email"
                    type="email"
                    value={formData.email}
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                    className="w-full px-4 py-3 bg-ghost border-[3px] border-navy rounded-xl font-display font-medium text-sm text-navy placeholder:text-slate focus:outline-none focus:border-lime focus:shadow-[3px_3px_0_0_#C8F31D] transition-all"
                    placeholder="your.email@example.com"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="contact-subject" className="font-display font-bold text-xs text-navy uppercase tracking-wider">Subject</label>
                  <input
                    id="contact-subject"
                    type="text"
                    value={formData.subject}
                    onChange={(e) =>
                      setFormData({ ...formData, subject: e.target.value })
                    }
                    className="w-full px-4 py-3 bg-ghost border-[3px] border-navy rounded-xl font-display font-medium text-sm text-navy placeholder:text-slate focus:outline-none focus:border-lime focus:shadow-[3px_3px_0_0_#C8F31D] transition-all"
                    placeholder="What is this about?"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="contact-message" className="font-display font-bold text-xs text-navy uppercase tracking-wider">Message</label>
                  <textarea
                    id="contact-message"
                    value={formData.message}
                    onChange={(e) =>
                      setFormData({ ...formData, message: e.target.value })
                    }
                    rows={6}
                    className="w-full px-4 py-3 bg-ghost border-[3px] border-navy rounded-xl font-display font-medium text-sm text-navy placeholder:text-slate focus:outline-none focus:border-lime focus:shadow-[3px_3px_0_0_#C8F31D] transition-all resize-none"
                    placeholder="Your message..."
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full font-display font-black bg-lime border-[4px] border-navy rounded-2xl px-8 py-4 text-sm text-navy uppercase tracking-wide shadow-[5px_5px_0_0_#0F0F2D] hover:shadow-[8px_8px_0_0_#0F0F2D] hover:translate-x-[-2px] hover:translate-y-[-2px] transition-all disabled:opacity-50"
                >
                  {isSubmitting ? "Sending..." : "Send Message →"}
                </button>
              </form>
            </div>

            {/* Contact Info */}
            <div className="space-y-6">
              {/* Address Card */}
              <div className="bg-lavender border-[4px] border-navy rounded-3xl p-6 sm:p-8 shadow-[6px_6px_0_0_#000]">
                <div className="w-12 h-12 bg-snow border-[3px] border-navy rounded-full flex items-center justify-center mb-4 shadow-[3px_3px_0_0_#000]">
                  <svg className="w-6 h-6 text-navy" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                  </svg>
                </div>
                <h3 className="font-display font-black text-lg text-navy mb-2">Our Location</h3>
                <p className="font-display font-medium text-sm text-navy/80 leading-relaxed">
                  Department of Industrial &amp; Production Engineering
                  <br />
                  Faculty of Technology
                  <br />
                  University of Ibadan, Nigeria
                </p>
              </div>

              {/* Email Card */}
              <div className="bg-teal border-[4px] border-navy rounded-3xl p-6 sm:p-8 shadow-[6px_6px_0_0_#000]">
                <div className="w-12 h-12 bg-snow border-[3px] border-navy rounded-full flex items-center justify-center mb-4 shadow-[3px_3px_0_0_#000]">
                  <svg className="w-6 h-6 text-navy" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                    <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                  </svg>
                </div>
                <h3 className="font-display font-black text-lg text-navy mb-2">Email Us</h3>
                <a
                  href="mailto:iesa@ui.edu.ng"
                  className="font-display font-bold text-sm text-navy hover:text-navy/60 transition-colors"
                >
                  iesa@ui.edu.ng
                </a>
              </div>

              {/* Social Card */}
              <div className="bg-sunny border-[4px] border-navy rounded-3xl p-6 sm:p-8 shadow-[6px_6px_0_0_#000]">
                <div className="w-12 h-12 bg-snow border-[3px] border-navy rounded-full flex items-center justify-center mb-4 shadow-[3px_3px_0_0_#000]">
                  <svg className="w-6 h-6 text-navy" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
                  </svg>
                </div>
                <h3 className="font-display font-black text-lg text-navy mb-3">Follow Us</h3>
                <div className="flex gap-3">
                  {[
                    { label: "Twitter", href: "https://twitter.com/iesa_ui", icon: <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /> },
                    { label: "Instagram", href: "https://instagram.com/iesa_ui", icon: <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" /> },
                    { label: "LinkedIn", href: "https://linkedin.com/company/iesa-ui", icon: <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" /> },
                  ].map((social) => (
                    <a
                      key={social.label}
                      href={social.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-10 h-10 bg-snow border-[3px] border-navy rounded-full flex items-center justify-center hover:bg-lime hover:scale-110 transition-all duration-200 shadow-[2px_2px_0_0_#000]"
                      aria-label={social.label}
                    >
                      <svg className="w-5 h-5 text-navy" fill="currentColor" viewBox="0 0 24 24">
                        {social.icon}
                      </svg>
                    </a>
                  ))}
                </div>
              </div>

              {/* Office Hours Card */}
              <div className="bg-snow border-[4px] border-navy rounded-3xl p-6 sm:p-8 shadow-[6px_6px_0_0_#000]">
                <h3 className="font-display font-black text-lg text-navy mb-4">Office Hours</h3>
                <div className="space-y-3 font-display font-medium text-sm">
                  <div className="flex justify-between">
                    <span className="text-navy/60">Monday - Friday</span>
                    <span className="font-bold text-navy">9:00 AM - 5:00 PM</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-navy/60">Saturday</span>
                    <span className="font-bold text-navy">10:00 AM - 2:00 PM</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-navy/60">Sunday</span>
                    <span className="font-bold text-slate">Closed</span>
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
      <section className="py-16 sm:py-20 bg-lime">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Section Header */}
          <div className="relative inline-block mb-10 sm:mb-14">
            <h2 className="font-display font-black text-3xl sm:text-5xl text-navy">
              <span className="brush-highlight brush-lime">FAQ</span>
            </h2>
          </div>

          {/* FAQ Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[
              {
                question: "How do I become a member of IESA?",
                answer: "All students in the Department of Industrial & Production Engineering are automatically members. To access full benefits, register on our platform.",
              },
              {
                question: "What are the membership fees?",
                answer: "Membership is free for all IPE students. Some special events may have nominal registration fees.",
              },
              {
                question: "How can I volunteer or join the executive team?",
                answer: "Elections are held annually. You can also volunteer for committees by contacting the General Secretary.",
              },
              {
                question: "Can non-IPE students attend IESA events?",
                answer: "Yes! Most of our events are open to all students, though some may have limited capacity for members first.",
              },
            ].map((faq, i) => (
              <div key={i} className="bg-snow border-[4px] border-navy rounded-3xl p-6 sm:p-8 shadow-[6px_6px_0_0_#000]">
                <h3 className="font-display font-black text-base sm:text-lg text-navy mb-3">{faq.question}</h3>
                <p className="font-display font-medium text-sm text-navy/80 leading-relaxed">
                  {faq.answer}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>
      </main>

      {/* SHARED FOOTER */}
      <Footer />
    </div>
  );
}
