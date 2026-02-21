"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { withAuth, PermissionGate } from "@/lib/withAuth";
import { getApiUrl } from "@/lib/api";
import { ConfirmModal } from "@/components/ui/Modal";

/* ─── Types ──────────────────────────────── */

interface Student {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  matricNumber: string;
}

interface UserDTO {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  matricNumber?: string;
  role?: string;
}

interface Session {
  id: string;
  name: string;
  isActive: boolean;
}

interface Enrollment {
  id: string;
  studentId: string;
  sessionId: string;
  level: string;
  student?: Student;
  session?: Session;
  createdAt: string;
}

const LEVELS = ["100L", "200L", "300L", "400L", "500L"];

/* ─── Component ──────────────────────────── */

function EnrollmentsPage() {
  const { user, userProfile, loading: authLoading, getAccessToken } = useAuth();
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; id: string }>({ isOpen: false, id: "" });

  // Filters
  const [filterSession, setFilterSession] = useState<string>("all");
  const [filterLevel, setFilterLevel] = useState<string>("all");

  // Form state
  const [formData, setFormData] = useState({
    studentId: "",
    sessionId: "",
    level: "100L",
  });

  /* ── Fetch ──────────────────────── */

  useEffect(() => {
    if (user && userProfile) {
      fetchData();
    }
  }, [user, userProfile]);

  const fetchData = async () => {
    try {
      const token = await getAccessToken();
      if (!token) return;

      const [enrollmentsRes, studentsRes, sessionsRes] = await Promise.all([
        fetch(getApiUrl("/api/v1/enrollments/"), { headers: { Authorization: `Bearer ${token}` } }),
        fetch(getApiUrl("/api/v1/users/"), { headers: { Authorization: `Bearer ${token}` } }),
        fetch(getApiUrl("/api/v1/sessions/"), { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      if (!enrollmentsRes.ok || !studentsRes.ok || !sessionsRes.ok) {
        throw new Error("Failed to fetch data");
      }

      const [enrollmentsData, studentsData, sessionsData] = await Promise.all([
        enrollmentsRes.json(),
        studentsRes.json(),
        sessionsRes.json(),
      ]);

      setEnrollments(enrollmentsData);
      const users = studentsData as UserDTO[];
      const studentUsers: Student[] = users
        .filter((u) => u.role === "student")
        .map(({ role: _unused, ...rest }) => rest as Student);
      setStudents(studentUsers);
      setSessions(sessionsData);

      const activeSession = sessionsData.find((s: Session) => s.isActive);
      if (activeSession && !formData.sessionId) {
        setFormData((prev) => ({ ...prev, sessionId: activeSession.id }));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch data");
    } finally {
      setLoading(false);
    }
  };

  /* ── Create ─────────────────────── */

  const handleCreateEnrollment = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const token = await getAccessToken();
      if (!token) return;

      const response = await fetch(getApiUrl("/api/v1/enrollments/"), {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Failed to create enrollment");
      }

      setFormData({ studentId: "", sessionId: formData.sessionId, level: "100L" });
      setShowModal(false);
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create enrollment");
    }
  };

  /* ── Delete ─────────────────────── */

  const handleDeleteEnrollment = (enrollmentId: string) => {
    setDeleteConfirm({ isOpen: true, id: enrollmentId });
  };

  const confirmDeleteEnrollment = async (enrollmentId: string) => {
    try {
      const token = await getAccessToken();
      if (!token) return;

      const response = await fetch(getApiUrl(`/api/v1/enrollments/${enrollmentId}`), {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) throw new Error("Failed to delete enrollment");
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete enrollment");
    }
  };

  /* ── Filter ─────────────────────── */

  const filteredEnrollments = enrollments.filter((enrollment) => {
    if (filterSession !== "all" && enrollment.sessionId !== filterSession) return false;
    if (filterLevel !== "all" && enrollment.level !== filterLevel) return false;
    return true;
  });

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-10 h-10 border-[3px] border-navy border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  /* ── Render ─────────────────────── */

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate mb-1">Administration</p>
          <h1 className="font-display font-black text-3xl md:text-4xl text-navy">
            <span className="brush-highlight">Enrollment</span> Management
          </h1>
          <p className="text-sm text-navy/60 mt-1">Assign students to academic sessions with their current level</p>
        </div>
        <PermissionGate permission="enrollment:create">
          <button
            type="button"
            onClick={() => setShowModal(true)}
            className="self-start bg-lime border-[4px] border-navy shadow-[5px_5px_0_0_#0F0F2D] px-6 py-2.5 rounded-2xl font-display font-bold text-sm text-navy hover:shadow-[7px_7px_0_0_#0F0F2D] hover:translate-x-[-1px] hover:translate-y-[-1px] transition-all flex items-center gap-2"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path fillRule="evenodd" d="M12 3.75a.75.75 0 0 1 .75.75v6.75h6.75a.75.75 0 0 1 0 1.5h-6.75v6.75a.75.75 0 0 1-1.5 0v-6.75H4.5a.75.75 0 0 1 0-1.5h6.75V4.5a.75.75 0 0 1 .75-.75Z" clipRule="evenodd" />
            </svg>
            Enroll Student
          </button>
        </PermissionGate>
      </div>

      {/* ── Error Alert ── */}
      {error && (
        <div role="alert" className="bg-coral-light border-[3px] border-coral rounded-2xl p-4">
          <p className="text-coral text-sm font-bold">{error}</p>
        </div>
      )}

      {/* ── Stats ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-snow border-[4px] border-navy rounded-3xl p-6 shadow-[6px_6px_0_0_#000]">
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate mb-1">Total</p>
          <p className="font-display font-black text-3xl text-navy">{enrollments.length}</p>
          <p className="text-xs text-navy/40 mt-1">Enrollments</p>
        </div>
        <div className="bg-teal border-[4px] border-navy rounded-3xl p-6 shadow-[6px_6px_0_0_#000] rotate-[0.5deg] hover:rotate-0 transition-transform">
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-snow/60 mb-1">Students</p>
          <p className="font-display font-black text-3xl text-snow">{students.length}</p>
          <p className="text-xs text-snow/40 mt-1">Registered</p>
        </div>
        <div className="bg-lavender border-[4px] border-navy rounded-3xl p-6 shadow-[6px_6px_0_0_#000] rotate-[-0.5deg] hover:rotate-0 transition-transform" aria-live="polite">
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-snow/60 mb-1">Filtered</p>
          <p className="font-display font-black text-3xl text-snow">{filteredEnrollments.length}</p>
          <p className="text-xs text-snow/40 mt-1">Results</p>
        </div>
      </div>

      {/* ── Filters ── */}
      <div className="bg-snow border-[4px] border-navy rounded-3xl p-5 shadow-[6px_6px_0_0_#000]">
        <p className="text-sm font-bold text-navy mb-4">Filters</p>
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 space-y-1.5">
            <label htmlFor="filter-session" className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate">Session</label>
            <select
              id="filter-session"
              value={filterSession}
              onChange={(e) => setFilterSession(e.target.value)}
              className="w-full px-4 py-3 bg-ghost border-[3px] border-navy rounded-2xl text-navy text-sm appearance-none cursor-pointer transition-all"
            >
              <option value="all">All Sessions</option>
              {sessions.map((session) => (
                <option key={session.id} value={session.id}>
                  {session.name} {session.isActive && "(Active)"}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1 space-y-1.5">
            <label htmlFor="filter-level" className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate">Level</label>
            <select
              id="filter-level"
              value={filterLevel}
              onChange={(e) => setFilterLevel(e.target.value)}
              className="w-full px-4 py-3 bg-ghost border-[3px] border-navy rounded-2xl text-navy text-sm appearance-none cursor-pointer transition-all"
            >
              <option value="all">All Levels</option>
              {LEVELS.map((level) => (
                <option key={level} value={level}>{level}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* ── Enrollments Table ── */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display font-bold text-lg text-navy">Enrollment Records</h2>
          <span className="px-3 py-1 bg-cloud text-slate text-xs font-bold rounded-full">{filteredEnrollments.length} records</span>
        </div>
        <div className="bg-snow border-[4px] border-navy rounded-3xl overflow-hidden shadow-[6px_6px_0_0_#000]">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b-[4px] border-navy bg-navy">
                  <th scope="col" className="text-left px-6 py-3 text-[10px] font-bold uppercase tracking-[0.12em] text-lime/80">Student</th>
                  <th scope="col" className="hidden md:table-cell text-left px-6 py-3 text-[10px] font-bold uppercase tracking-[0.12em] text-lime/80">Matric Number</th>
                  <th scope="col" className="hidden md:table-cell text-left px-6 py-3 text-[10px] font-bold uppercase tracking-[0.12em] text-lime/80">Session</th>
                  <th scope="col" className="text-left px-6 py-3 text-[10px] font-bold uppercase tracking-[0.12em] text-lime/80">Level</th>
                  <th scope="col" className="hidden md:table-cell text-left px-6 py-3 text-[10px] font-bold uppercase tracking-[0.12em] text-lime/80">Enrolled</th>
                  <th scope="col" className="text-right px-6 py-3 text-[10px] font-bold uppercase tracking-[0.12em] text-lime/80">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredEnrollments.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-16 text-center">
                      <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-sunny-light flex items-center justify-center">
                        <svg className="w-7 h-7 text-sunny" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M5.25 6.31c0-.448.334-.81.75-.81h12c.416 0 .75.362.75.81v4.94c0 .448-.334.81-.75.81H6c-.416 0-.75-.362-.75-.81V6.31Z" />
                          <path fillRule="evenodd" d="M3.375 3C2.339 3 1.5 3.84 1.5 4.875v11.25C1.5 17.16 2.34 18 3.375 18H9.75v1.5H6a.75.75 0 0 0 0 1.5h12a.75.75 0 0 0 0-1.5h-3.75V18h6.375c1.035 0 1.875-.84 1.875-1.875V4.875C22.5 3.839 21.66 3 20.625 3H3.375Zm0 13.5h17.25a.375.375 0 0 0 .375-.375V4.875a.375.375 0 0 0-.375-.375H3.375A.375.375 0 0 0 3 4.875v11.25c0 .207.168.375.375.375Z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <p className="text-sm text-navy/60 font-medium">No enrollments found</p>
                    </td>
                  </tr>
                ) : (
                  filteredEnrollments.map((enrollment, idx) => {
                    const accentBgs = ["bg-lavender-light", "bg-teal-light", "bg-coral-light", "bg-sunny-light"];
                    const accentTexts = ["text-lavender", "text-teal", "text-coral", "text-sunny"];
                    return (
                      <tr key={enrollment.id} className="border-b-[3px] border-navy/10 last:border-b-0 hover:bg-ghost transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-xl ${accentBgs[idx % 4]} flex items-center justify-center text-xs font-bold ${accentTexts[idx % 4]} shrink-0`}>
                              {enrollment.student ? `${enrollment.student.firstName[0]}${enrollment.student.lastName[0]}` : "?"}
                            </div>
                            <div>
                              <div className="text-sm font-bold text-navy">
                                {enrollment.student?.firstName} {enrollment.student?.lastName}
                              </div>
                              <div className="text-xs text-slate mt-0.5">{enrollment.student?.email}</div>
                            </div>
                          </div>
                        </td>
                        <td className="hidden md:table-cell px-6 py-4 whitespace-nowrap text-sm text-navy/60">
                          {enrollment.student?.matricNumber || "N/A"}
                        </td>
                        <td className="hidden md:table-cell px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-navy/60">{enrollment.session?.name}</span>
                            {enrollment.session?.isActive && (
                              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-teal-light text-teal">Active</span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="px-3 py-1 rounded-full text-xs font-bold bg-cloud text-navy">{enrollment.level}</span>
                        </td>
                        <td className="hidden md:table-cell px-6 py-4 whitespace-nowrap text-sm text-navy/60">
                          {enrollment.createdAt
                            ? new Date(enrollment.createdAt).toLocaleDateString()
                            : "N/A"}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <button
                            onClick={() => handleDeleteEnrollment(enrollment.id)}
                            className="p-2 rounded-xl hover:bg-coral-light transition-colors"
                            aria-label={`Delete enrollment for ${enrollment.student?.firstName || ""} ${enrollment.student?.lastName || ""}`}
                            title="Delete enrollment"
                          >
                            <svg className="w-4 h-4 text-slate hover:text-coral" viewBox="0 0 24 24" fill="currentColor">
                              <path fillRule="evenodd" d="M16.5 4.478v.227a48.816 48.816 0 0 1 3.878.512.75.75 0 1 1-.256 1.478l-.209-.035-1.005 13.07a3 3 0 0 1-2.991 2.77H8.084a3 3 0 0 1-2.991-2.77L4.087 6.66l-.209.035a.75.75 0 0 1-.256-1.478A48.567 48.567 0 0 1 7.5 4.705v-.227c0-1.564 1.213-2.9 2.816-2.951a52.662 52.662 0 0 1 3.369 0c1.603.051 2.815 1.387 2.815 2.951Zm-6.136-1.452a51.196 51.196 0 0 1 3.273 0C14.39 3.05 15 3.684 15 4.478v.113a49.488 49.488 0 0 0-6 0v-.113c0-.794.609-1.428 1.364-1.452Zm-.355 5.945a.75.75 0 1 0-1.5.058l.347 9a.75.75 0 1 0 1.499-.058l-.346-9Zm5.48.058a.75.75 0 1 0-1.498-.058l-.347 9a.75.75 0 0 0 1.5.058l.345-9Z" clipRule="evenodd" />
                            </svg>
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── Create Enrollment Modal ── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 pt-4 pb-20 md:p-6">
          <div className="absolute inset-0 bg-navy/50" onClick={() => setShowModal(false)} />

          <div className="relative bg-snow border-[4px] border-navy rounded-3xl p-8 w-full max-w-md max-h-[80vh] md:max-h-[85vh] overflow-y-auto shadow-[10px_10px_0_0_#000]">
            <div className="flex items-center justify-between mb-6">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate mb-1">New Enrollment</p>
                <h2 className="font-display font-black text-xl text-navy">Enroll Student</h2>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 rounded-xl hover:bg-cloud transition-colors"
                aria-label="Close modal"
              >
                <svg className="w-5 h-5 text-navy/60" viewBox="0 0 24 24" fill="currentColor">
                  <path fillRule="evenodd" d="M5.47 5.47a.75.75 0 0 1 1.06 0L12 10.94l5.47-5.47a.75.75 0 1 1 1.06 1.06L13.06 12l5.47 5.47a.75.75 0 1 1-1.06 1.06L12 13.06l-5.47 5.47a.75.75 0 0 1-1.06-1.06L10.94 12 5.47 6.53a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleCreateEnrollment} className="space-y-5">
              <div className="space-y-1.5">
                <label htmlFor="student-select" className="text-sm font-bold text-navy">Student</label>
                <select
                  id="student-select"
                  value={formData.studentId}
                  onChange={(e) => setFormData({ ...formData, studentId: e.target.value })}
                  className="w-full px-4 py-3 bg-ghost border-[3px] border-navy rounded-2xl text-navy text-sm appearance-none cursor-pointer transition-all"
                  required
                >
                  <option value="">Select a student</option>
                  {students.map((student) => (
                    <option key={student.id} value={student.id}>
                      {student.firstName} {student.lastName} ({student.matricNumber || student.email})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="session-select" className="text-sm font-bold text-navy">Session</label>
                <select
                  id="session-select"
                  value={formData.sessionId}
                  onChange={(e) => setFormData({ ...formData, sessionId: e.target.value })}
                  className="w-full px-4 py-3 bg-ghost border-[3px] border-navy rounded-2xl text-navy text-sm appearance-none cursor-pointer transition-all"
                  required
                >
                  <option value="">Select a session</option>
                  {sessions.map((session) => (
                    <option key={session.id} value={session.id}>
                      {session.name} {session.isActive && "(Active)"}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="level-select" className="text-sm font-bold text-navy">Level</label>
                <select
                  id="level-select"
                  value={formData.level}
                  onChange={(e) => setFormData({ ...formData, level: e.target.value })}
                  className="w-full px-4 py-3 bg-ghost border-[3px] border-navy rounded-2xl text-navy text-sm appearance-none cursor-pointer transition-all"
                  required
                >
                  {LEVELS.map((level) => (
                    <option key={level} value={level}>{level}</option>
                  ))}
                </select>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-5 py-2.5 rounded-2xl border-[3px] border-navy text-navy text-sm font-bold hover:bg-cloud transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-5 py-2.5 rounded-2xl bg-navy border-[3px] border-navy text-lime text-sm font-bold hover:shadow-[4px_4px_0_0_#C8F31D] transition-all"
                >
                  Enroll
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={deleteConfirm.isOpen}
        onClose={() => setDeleteConfirm({ isOpen: false, id: "" })}
        onConfirm={() => {
          confirmDeleteEnrollment(deleteConfirm.id);
          setDeleteConfirm({ isOpen: false, id: "" });
        }}
        title="Delete Enrollment"
        message="Are you sure you want to delete this enrollment?"
        confirmLabel="Delete"
        variant="danger"
      />
    </div>
  );
}

export default withAuth(EnrollmentsPage, {
  anyPermission: ["enrollment:create", "enrollment:view", "enrollment:edit"],
});
