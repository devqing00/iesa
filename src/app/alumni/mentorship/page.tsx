"use client";

import { useAuth } from "@/context/AuthContext";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import { useState, useEffect } from "react";
import { getApiUrl } from "@/lib/api";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

export default function AlumniMentorshipPage() {
  const { userProfile, getAccessToken, refreshUserProfile } = useAuth();
  const router = useRouter();
  
  const [loading, setLoading] = useState(false);
  const [openToMentorship, setOpenToMentorship] = useState(false);
  const [mentorshipBio, setMentorshipBio] = useState("");

  useEffect(() => {
    if (userProfile) {
      setOpenToMentorship(userProfile.openToMentorship ?? false);
      setMentorshipBio(userProfile.mentorshipBio ?? "");
    }
  }, [userProfile]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const token = await getAccessToken();
      const res = await fetch(getApiUrl("/api/v1/users/me"), {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          openToMentorship,
          mentorshipBio
        })
      });
      if (!res.ok) throw new Error("Failed to update profile");
      await refreshUserProfile();
      toast.success("Mentorship preferences updated!");
      router.push("/alumni/dashboard");
    } catch (err: unknown) {
      toast.error("Error", { description: err instanceof Error ? err.message : "Failed to update" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-ghost pb-20 md:pb-8">
      <DashboardHeader title="Mentorship Settings" />
      
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        <div className="bg-snow rounded-3xl p-6 md:p-10 border-[3px] border-navy shadow-[4px_4px_0_0_#000]">
          <h2 className="text-2xl font-display font-black text-navy mb-2">Offer Mentorship</h2>
          <p className="text-slate text-sm mb-8">
            Help guide the next generation of Industrial Engineering students. By opting in, current students and fellow alumni can contact you for advice, resume reviews, and career guidance.
          </p>

          <form onSubmit={handleSave} className="space-y-6">
            
            {/* Toggle */}
            <div className="flex items-center justify-between p-4 bg-ghost rounded-2xl border-2 border-navy/10">
              <div>
                <p className="font-bold text-navy">Open to Mentorship</p>
                <p className="text-xs text-slate mt-1">Show a badge on your profile and allow contact.</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={openToMentorship}
                  onChange={(e) => setOpenToMentorship(e.target.checked)}
                />
                <div className="w-11 h-6 bg-slate/30 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-lime border-2 border-navy/20"></div>
              </label>
            </div>

            {/* Bio */}
            {openToMentorship && (
              <div className="space-y-2 animate-in fade-in slide-in-from-top-4 duration-300">
                <label className="block text-sm font-bold text-navy">
                  Mentorship Bio <span className="text-coral">*</span>
                </label>
                <textarea
                  required={openToMentorship}
                  value={mentorshipBio}
                  onChange={(e) => setMentorshipBio(e.target.value)}
                  placeholder="E.g. I can help with resume reviews, mock interviews, and advice for getting into product management..."
                  className="w-full h-32 px-4 py-3 bg-ghost border-[3px] border-navy rounded-2xl text-navy placeholder:text-slate focus:outline-none focus:border-lime resize-none text-sm transition-colors"
                />
                <p className="text-xs text-slate text-right">{mentorshipBio.length}/1000</p>
              </div>
            )}

            <div className="pt-4 flex justify-end">
              <button
                type="submit"
                disabled={loading}
                className="px-8 py-3 bg-lime text-navy rounded-xl font-bold press-2 border-2 border-navy disabled:opacity-50"
              >
                {loading ? "Saving..." : "Save Preferences"}
              </button>
            </div>
          </form>

        </div>

      </div>
    </div>
  );
}
