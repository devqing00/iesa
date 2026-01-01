"use client";

/**
 * Admin Dashboard - Session Management
 * 
 * Create, view, and manage academic sessions.
 * Only admins and excos can access this page.
 */

import DashboardHeader from "@/components/dashboard/DashboardHeader";
import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { useSession } from "@/context/SessionContext";
import { Calendar, Plus, CheckCircle } from "lucide-react";
import { withAuth, PermissionGate } from "@/lib/withAuth";

interface Session {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  currentSemester: 1 | 2;
  isActive: boolean;
  createdAt: string;
}

function AdminSessionsPage() {
  const { user } = useAuth();
  const { refreshSessions } = useSession();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    startDate: "",
    endDate: "",
    currentSemester: 1 as 1 | 2,
    isActive: false,
  });

  const fetchSessions = useCallback(async () => {
    if (!user) return;

    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/sessions', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setSessions(data);
      }
    } catch (error) {
      console.error('Error fetching sessions:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/sessions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        setShowCreateModal(false);
        setFormData({
          name: "",
          startDate: "",
          endDate: "",
          currentSemester: 1,
          isActive: false,
        });
        await fetchSessions();
        await refreshSessions();
      }
    } catch (error) {
      console.error('Error creating session:', error);
    }
  };

  const toggleActive = async (sessionId: string) => {
    if (!user) return;

    try {
      const token = await user.getIdToken();
      const response = await fetch(`/api/sessions/${sessionId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ isActive: true }),
      });

      if (response.ok) {
        await fetchSessions();
        await refreshSessions();
      }
    } catch (error) {
      console.error('Error toggling session:', error);
    }
  };


  return (
    <div className="min-h-screen flex flex-col">
      <DashboardHeader title="Admin - Session Management" />

      <div className="p-4 md:p-8 space-y-6">
        {/* Header with Create Button */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-foreground">Academic Sessions</h2>
            <p className="text-foreground/50 text-sm">Manage academic years and semesters</p>
          </div>
          <PermissionGate permission="session:create">
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg font-bold text-sm hover:bg-primary/90 transition-transform active:scale-95"
            >
              <Plus className="h-4 w-4" />
              New Session
            </button>
          </PermissionGate>
        </div>

        {/* Sessions List */}
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sessions.map((session) => (
              <div
                key={session.id}
                className={`rounded-xl p-6 border-2 transition-all ${
                  session.isActive
                    ? 'bg-primary/10 border-primary'
                    : 'bg-background/60 border-foreground/5 hover:border-foreground/20'
                }`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-xl font-bold text-foreground mb-1">{session.name}</h3>
                    <p className="text-sm text-foreground/50">
                      Semester {session.currentSemester}
                    </p>
                  </div>
                  {session.isActive && (
                    <span className="bg-primary text-white text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1">
                      <CheckCircle className="h-3 w-3" />
                      Active
                    </span>
                  )}
                </div>

                <div className="space-y-2 mb-4">
                  <div className="flex items-center gap-2 text-sm text-foreground/60">
                    <Calendar className="h-4 w-4" />
                    <span>
                      {new Date(session.startDate).toLocaleDateString()} -{' '}
                      {new Date(session.endDate).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                {!session.isActive && (
                  <button
                    onClick={() => toggleActive(session.id)}
                    className="w-full bg-primary/10 text-primary px-4 py-2 rounded-lg font-bold text-sm hover:bg-primary/20 transition-colors"
                  >
                    Set as Active
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Create Session Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-background rounded-xl p-6 max-w-md w-full border border-foreground/10">
              <h3 className="text-xl font-bold text-foreground mb-4">Create New Session</h3>

              <form onSubmit={handleCreateSession} className="space-y-4">
                <div>
                  <label htmlFor="sessionName" className="block text-sm font-bold text-foreground/70 mb-2">
                    Session Name (e.g., 2024/2025)
                  </label>
                  <input
                    id="sessionName"
                    type="text"
                    required
                    pattern="\d{4}/\d{4}"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="2024/2025"
                    title="Session name in format YYYY/YYYY"
                    className="w-full px-4 py-2 rounded-lg border border-foreground/10 bg-background/50 focus:border-primary focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="startDate" className="block text-sm font-bold text-foreground/70 mb-2">
                      Start Date
                    </label>
                    <input
                      id="startDate"
                      type="date"
                      required
                      value={formData.startDate}
                      onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                      title="Start date of the session"
                      className="w-full px-4 py-2 rounded-lg border border-foreground/10 bg-background/50 focus:border-primary focus:outline-none"
                    />
                  </div>

                  <div>
                    <label htmlFor="endDate" className="block text-sm font-bold text-foreground/70 mb-2">
                      End Date
                    </label>
                    <input
                      id="endDate"
                      type="date"
                      required
                      value={formData.endDate}
                      onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                      title="End date of the session"
                      className="w-full px-4 py-2 rounded-lg border border-foreground/10 bg-background/50 focus:border-primary focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="currentSemester" className="block text-sm font-bold text-foreground/70 mb-2">
                    Current Semester
                  </label>
                  <select
                    id="currentSemester"
                    value={formData.currentSemester}
                    onChange={(e) => setFormData({ ...formData, currentSemester: parseInt(e.target.value) as 1 | 2 })}
                    title="Current semester for the session"
                    className="w-full px-4 py-2 rounded-lg border border-foreground/10 bg-background/50 focus:border-primary focus:outline-none"
                  >
                    <option value={1}>Semester 1</option>
                    <option value={2}>Semester 2</option>
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="isActive"
                    checked={formData.isActive}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                    className="rounded"
                    title="Set session as active"
                  />
                  <label htmlFor="isActive" className="text-sm text-foreground/70">
                    Set as active session (will deactivate others)
                  </label>
                </div>

                <div className="flex gap-4 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="flex-1 px-4 py-2 rounded-lg border border-foreground/10 hover:bg-foreground/5 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 bg-primary text-white px-4 py-2 rounded-lg font-bold hover:bg-primary/90 transition-colors"
                  >
                    Create Session
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default withAuth(AdminSessionsPage, {
  anyPermission: ["session:create", "session:edit"]
});
