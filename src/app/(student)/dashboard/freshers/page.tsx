"use client";

import { useEffect, useState } from "react";
import { withAuth } from "@/lib/withAuth";
import { ClassRepPortal } from "@/app/(admin)/admin/class-rep/page";
import { useAuth } from "@/context/AuthContext";
import { getApiUrl } from "@/lib/api";

function FreshersCoordinatorPage() {
  const { getAccessToken } = useAuth();
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function verifyAccess() {
      try {
        const token = await getAccessToken();
        const res = await fetch(getApiUrl("/api/v1/class-rep/freshers/verify"), {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!cancelled) setAllowed(res.ok);
      } catch {
        if (!cancelled) setAllowed(false);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    verifyAccess();
    return () => {
      cancelled = true;
    };
  }, [getAccessToken]);

  if (loading) {
    return <div className="min-h-screen bg-ghost" />;
  }

  if (!allowed) {
    return (
      <div className="min-h-screen bg-ghost flex items-center justify-center p-6">
        <div className="max-w-lg w-full bg-snow border-[4px] border-navy rounded-3xl p-6 shadow-[8px_8px_0_0_#000]">
          <h1 className="font-display font-black text-display-sm text-navy">Freshers Access Restricted</h1>
          <p className="mt-3 text-slate text-body">
            This portal is reserved for the active Freshers Coordinator role (100L) in the current session.
          </p>
        </div>
      </div>
    );
  }

  return <ClassRepPortal variant="freshers" />;
}

export default withAuth(FreshersCoordinatorPage, {
  requiredPermission: "freshers:manage",
});
