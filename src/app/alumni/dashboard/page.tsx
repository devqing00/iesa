"use client";

import { useAuth } from "@/context/AuthContext";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import Link from "next/link";
import { useState, useEffect } from "react";
import { getApiUrl } from "@/lib/api";
import { toast } from "sonner";

export default function AlumniDashboardPage() {
  const { user, getAccessToken } = useAuth();
  const [loading, setLoading] = useState(false);

  // Simple direct Paystack donation
  const handleDonation = async (amount: number) => {
    if (!user) return;
    setLoading(true);
    try {
      const token = await getAccessToken();
      const res = await fetch(getApiUrl("/api/v1/payments/init"), {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          amount: amount,
          type: "donation",
          metadata: { email: user.email }
        })
      });
      if (!res.ok) throw new Error("Failed to initialize donation");
      const data = await res.json();
      if (data.authorizationUrl) {
        window.location.href = data.authorizationUrl;
      } else {
        throw new Error("No payment URL returned");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Donation failed";
      toast.error("Error", { description: msg });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-ghost pb-20 md:pb-8">
      <DashboardHeader title="Alumni Overview" />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        
        {/* Hero Section */}
        <div className="bg-navy rounded-[28px] p-8 md:p-12 shadow-[8px_8px_0_0_#000] relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-10">
            <svg className="w-48 h-48 text-snow" viewBox="0 0 24 24" fill="currentColor">
              <path fillRule="evenodd" d="M12.963 2.286a.75.75 0 0 0-1.071-.136 9.742 9.742 0 0 0-3.539 6.176 7.547 7.547 0 0 1-1.705-1.715.75.75 0 0 0-1.152-.082A9 9 0 1 0 15.68 4.534a7.46 7.46 0 0 1-2.717-2.248ZM15.75 14.25a3.75 3.75 0 1 1-7.313-1.172c.628.465 1.35.81 2.133 1a5.99 5.99 0 0 1 1.925-3.546 3.75 3.75 0 0 1 3.255 3.718Z" clipRule="evenodd" />
            </svg>
          </div>
          
          <div className="relative z-10 max-w-2xl">
            <p className="text-lime text-sm font-bold tracking-widest uppercase mb-4">Welcome Back</p>
            <h1 className="text-4xl md:text-5xl font-display font-black text-snow mb-6">
              IESA Alumni Network
            </h1>
            <p className="text-snow/70 text-lg mb-8 leading-relaxed">
              Connect with fellow graduates, offer mentorship to current students, and give back to the department.
            </p>
            <div className="flex flex-wrap gap-4">
              <Link href="/alumni/directory" className="bg-lime text-navy px-6 py-3 rounded-xl font-bold press-3 border-2 border-transparent">
                Browse Directory
              </Link>
              <Link href="/alumni/mentorship" className="bg-transparent border-2 border-snow text-snow px-6 py-3 rounded-xl font-bold press-3 hover:bg-snow/10">
                Update Mentorship
              </Link>
            </div>
          </div>
        </div>

        {/* Quick Stats / Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          <div className="bg-snow rounded-3xl p-6 md:p-8 border-[3px] border-navy shadow-[4px_4px_0_0_#000]">
            <div className="w-12 h-12 bg-lavender-light rounded-2xl flex items-center justify-center mb-6">
              <svg className="w-6 h-6 text-lavender" viewBox="0 0 24 24" fill="currentColor">
                <path fillRule="evenodd" d="M7.5 6a4.5 4.5 0 1 1 9 0 4.5 4.5 0 0 1-9 0ZM3.751 20.105a8.25 8.25 0 0 1 16.498 0 .75.75 0 0 1-.437.695A18.683 18.683 0 0 1 12 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 0 1-.437-.695Z" clipRule="evenodd" />
              </svg>
            </div>
            <h3 className="text-2xl font-display font-black text-navy mb-2">Network</h3>
            <p className="text-slate text-sm mb-6">Find and connect with other graduated Industrial Engineering students.</p>
            <Link href="/alumni/directory" className="inline-flex items-center text-navy font-bold hover:text-lavender transition-colors">
              View Directory &rarr;
            </Link>
          </div>

          <div className="bg-teal rounded-3xl p-6 md:p-8 border-[3px] border-navy shadow-[4px_4px_0_0_#000]">
            <div className="w-12 h-12 bg-snow/20 rounded-2xl flex items-center justify-center mb-6">
              <svg className="w-6 h-6 text-snow" viewBox="0 0 24 24" fill="currentColor">
                <path fillRule="evenodd" d="M12.963 2.286a.75.75 0 0 0-1.071-.136 9.742 9.742 0 0 0-3.539 6.176 7.547 7.547 0 0 1-1.705-1.715.75.75 0 0 0-1.152-.082A9 9 0 1 0 15.68 4.534a7.46 7.46 0 0 1-2.717-2.248ZM15.75 14.25a3.75 3.75 0 1 1-7.313-1.172c.628.465 1.35.81 2.133 1a5.99 5.99 0 0 1 1.925-3.546 3.75 3.75 0 0 1 3.255 3.718Z" clipRule="evenodd" />
              </svg>
            </div>
            <h3 className="text-2xl font-display font-black text-snow mb-2">Give Back</h3>
            <p className="text-snow/80 text-sm mb-6">Support IESA initiatives and events by making a donation.</p>
            <div className="flex gap-3">
              <button onClick={() => handleDonation(5000)} disabled={loading} className="px-4 py-2 bg-snow text-navy rounded-xl font-bold text-sm press-2 border-2 border-navy">
                ₦5,000
              </button>
              <button onClick={() => handleDonation(10000)} disabled={loading} className="px-4 py-2 bg-snow text-navy rounded-xl font-bold text-sm press-2 border-2 border-navy">
                ₦10,000
              </button>
            </div>
          </div>
          
        </div>
      </div>
    </div>
  );
}
