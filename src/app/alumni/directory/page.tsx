"use client";

import { useAuth } from "@/context/AuthContext";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import { useState, useEffect } from "react";
import { getApiUrl } from "@/lib/api";
import { toast } from "sonner";
import Image from "next/image";
import { resolveProfileImageUrl } from "@/lib/profileImage";

interface AlumniUser {
  id: string;
  firstName: string;
  lastName: string;
  currentLevel: string;
  profilePictureUrl?: string;
  openToMentorship: boolean;
  mentorshipBio?: string;
  skills?: string[];
  bio?: string;
  email: string;
}

export default function AlumniDirectoryPage() {
  const { getAccessToken } = useAuth();
  const [loading, setLoading] = useState(true);
  const [alumni, setAlumni] = useState<AlumniUser[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const fetchAlumni = async () => {
      try {
        const token = await getAccessToken();
        const res = await fetch(getApiUrl("/api/v1/alumni/directory"), {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) throw new Error("Failed to load directory");
        const data = await res.json();
        setAlumni(data);
      } catch (err: unknown) {
        toast.error("Error", { description: err instanceof Error ? err.message : "Failed to load directory" });
      } finally {
        setLoading(false);
      }
    };
    fetchAlumni();
  }, [getAccessToken]);

  const filteredAlumni = alumni.filter(a => {
    const term = search.toLowerCase();
    return (
      a.firstName.toLowerCase().includes(term) ||
      a.lastName.toLowerCase().includes(term) ||
      (a.skills && a.skills.some(s => s.toLowerCase().includes(term)))
    );
  });

  return (
    <div className="min-h-screen bg-ghost pb-20 md:pb-8">
      <DashboardHeader title="Alumni Directory" />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        
        <div className="bg-snow rounded-3xl p-6 border-[3px] border-navy shadow-[4px_4px_0_0_#000] flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="font-display font-black text-2xl text-navy">Network & Connect</h2>
            <p className="text-sm text-slate mt-1">Find fellow graduates by name or skills.</p>
          </div>
          
          <div className="relative w-full md:w-72">
            <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate" viewBox="0 0 24 24" fill="currentColor">
              <path fillRule="evenodd" d="M10.5 3.75a6.75 6.75 0 1 0 0 13.5 6.75 6.75 0 0 0 0-13.5ZM2.25 10.5a8.25 8.25 0 1 1 14.59 5.28l4.69 4.69a.75.75 0 1 1-1.06 1.06l-4.69-4.69A8.25 8.25 0 0 1 2.25 10.5Z" clipRule="evenodd" />
            </svg>
            <input
              type="text"
              placeholder="Search alumni..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-ghost border-[3px] border-navy text-sm text-navy placeholder:text-slate focus:outline-none focus:border-lime transition-colors"
            />
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1,2,3,4,5,6].map(i => (
              <div key={i} className="bg-snow rounded-3xl border-[3px] border-navy p-6 animate-pulse h-48" />
            ))}
          </div>
        ) : filteredAlumni.length === 0 ? (
          <div className="bg-snow rounded-3xl border-[3px] border-navy p-16 text-center shadow-[4px_4px_0_0_#000]">
            <p className="text-navy font-bold text-lg">No alumni found.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredAlumni.map(person => (
              <div key={person.id} className="bg-snow rounded-3xl border-[3px] border-navy p-6 shadow-[4px_4px_0_0_#000] flex flex-col hover:-translate-y-1 transition-transform">
                <div className="flex items-start gap-4 mb-4">
                  <div className="relative w-16 h-16 rounded-2xl overflow-hidden border-2 border-navy shrink-0 bg-ghost">
                    {person.profilePictureUrl ? (
                      <Image src={resolveProfileImageUrl(person.profilePictureUrl)} alt={person.firstName} fill className="object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-lavender-light text-lavender font-bold text-xl">
                        {person.firstName.charAt(0)}{person.lastName.charAt(0)}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-display font-black text-lg text-navy truncate">
                      {person.firstName} {person.lastName}
                    </h3>
                    <p className="text-xs font-bold text-slate uppercase tracking-wider">{person.currentLevel}</p>
                    {person.openToMentorship && (
                      <span className="inline-block mt-1 px-2 py-0.5 rounded-md bg-lime-light text-navy border border-navy/20 text-[10px] font-bold">
                        Open to Mentorship
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex-1 text-sm text-slate space-y-2 mb-4">
                  {person.openToMentorship && person.mentorshipBio && (
                    <p className="line-clamp-2">" {person.mentorshipBio} "</p>
                  )}
                  {!person.openToMentorship && person.bio && (
                    <p className="line-clamp-2">{person.bio}</p>
                  )}
                </div>

                {person.skills && person.skills.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {person.skills.slice(0, 3).map((skill, i) => (
                      <span key={i} className="px-2 py-1 bg-ghost rounded-md text-[10px] font-bold text-navy/70 border border-navy/10">
                        {skill}
                      </span>
                    ))}
                    {person.skills.length > 3 && (
                      <span className="px-2 py-1 bg-ghost rounded-md text-[10px] font-bold text-navy/50">
                        +{person.skills.length - 3}
                      </span>
                    )}
                  </div>
                )}

                <a
                  href={`mailto:${person.email}`}
                  className="mt-auto block w-full py-2.5 bg-navy text-snow text-center rounded-xl font-bold text-sm press-2 border-2 border-navy hover:bg-navy/90 transition-colors"
                >
                  Contact
                </a>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
