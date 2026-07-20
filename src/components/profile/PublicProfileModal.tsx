"use client";

import { useState, useEffect } from "react";
import { getApiUrl } from "@/lib/api";
import { Modal } from "@/components/ui/Modal";
import { useAuth } from "@/context/AuthContext";

interface PublicProfileModalProps {
  userId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onMessage?: (user: { id: string; name: string; email: string }) => void;
}

export default function PublicProfileModal({ userId, isOpen, onClose, onMessage }: PublicProfileModalProps) {
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const { firebaseUser } = useAuth();

  useEffect(() => {
    if (isOpen && userId) {
      loadProfile();
    } else {
      setProfile(null);
      setError(null);
    }
  }, [isOpen, userId]);

  const loadProfile = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = firebaseUser ? await firebaseUser.getIdToken() : null;
      const res = await fetch(getApiUrl(`/api/v1/users/${userId}`), {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error("Could not load user profile");
      const data = await res.json();
      setProfile(data);
    } catch (err: any) {
      setError(err.message || "Failed to load profile.");
    } finally {
      setLoading(false);
    }
  };

  const initials = (name?: string) => {
    if (!name) return "?";
    return name.substring(0, 2).toUpperCase();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="User Profile"
      size="sm"
    >
      {loading ? (
        <div className="flex justify-center p-8">
          <div className="w-8 h-8 border-4 border-navy border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : error ? (
        <div className="p-8 text-center text-coral/80 text-sm font-bold">{error}</div>
      ) : profile ? (
        <div className="flex flex-col items-center py-6 px-4">
          <div className="w-24 h-24 rounded-full bg-teal-light border-[3px] border-navy flex items-center justify-center shrink-0 mb-4 overflow-hidden">
            {profile.profilePhotoURL ? (
              <img src={profile.profilePhotoURL} className="w-full h-full object-cover" alt="" />
            ) : (
              <span className="font-display font-black text-3xl text-navy">
                {initials(`${profile.firstName} ${profile.lastName}`)}
              </span>
            )}
          </div>
          <h2 className="font-display font-black text-2xl text-navy text-center">
            {profile.firstName} {profile.lastName}
          </h2>
          {profile.role !== "student" && (
            <span className="mt-2 inline-block px-3 py-1 bg-lavender border-2 border-navy rounded-lg text-xs font-black text-navy uppercase tracking-widest">
              {profile.role}
            </span>
          )}
          
          <div className="mt-6 w-full space-y-4 bg-snow border-2 border-navy/15 rounded-2xl p-5">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-blue/10 flex items-center justify-center text-blue">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/>
                </svg>
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate uppercase tracking-wider">Department</p>
                <p className="text-sm font-bold text-navy">{profile.department || "Industrial Engineering"}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-coral/10 flex items-center justify-center text-coral">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                </svg>
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate uppercase tracking-wider">Level</p>
                <p className="text-sm font-bold text-navy">{profile.currentLevel ? `${profile.currentLevel} Level` : "N/A"}</p>
              </div>
            </div>
          </div>
          
          {onMessage && (
            <button
              onClick={() => {
                onClose();
                onMessage({
                  id: profile._id || profile.id,
                  name: `${profile.firstName} ${profile.lastName}`,
                  email: profile.email
                });
              }}
              className="w-full flex items-center justify-center gap-2 py-3 bg-coral text-snow rounded-xl font-display font-black text-sm press-3 border-[3px] border-navy hover:bg-coral/90 transition-colors mt-6"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z" />
              </svg>
              Message
            </button>
          )}
        </div>
      ) : null}
    </Modal>
  );
}
