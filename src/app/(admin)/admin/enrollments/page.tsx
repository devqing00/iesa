"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { withAuth, PermissionGate } from "@/lib/withAuth";

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

function EnrollmentsPage() {
  const { user, userProfile, loading: authLoading } = useAuth();
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  
  // Filters
  const [filterSession, setFilterSession] = useState<string>("all");
  const [filterLevel, setFilterLevel] = useState<string>("all");

  // Form state
  const [formData, setFormData] = useState({
    studentId: "",
    sessionId: "",
    level: "100L"
  });

  // Fetch data
  useEffect(() => {
    if (user && userProfile) {
      fetchData();
    }
  }, [user, userProfile]);

  const fetchData = async () => {
    try {
      const token = await user?.getIdToken();
      if (!token) return;

      // Fetch enrollments, students, and sessions in parallel
      const [enrollmentsRes, studentsRes, sessionsRes] = await Promise.all([
        fetch("/api/enrollments", {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch("/api/users", {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch("/api/sessions", {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);

      if (!enrollmentsRes.ok || !studentsRes.ok || !sessionsRes.ok) {
        throw new Error("Failed to fetch data");
      }

      const [enrollmentsData, studentsData, sessionsData] = await Promise.all([
        enrollmentsRes.json(),
        studentsRes.json(),
        sessionsRes.json()
      ]);

      setEnrollments(enrollmentsData);
      // Cast to a typed user DTO, filter by role, then map to Student shape
      const users = studentsData as UserDTO[];
      const studentUsers: Student[] = users
        .filter((u) => u.role === "student")
        .map(({ role, ...rest }) => rest as Student);
      setStudents(studentUsers);
      setSessions(sessionsData);
      
      // Set default session to active session
      const activeSession = sessionsData.find((s: Session) => s.isActive);
      if (activeSession && !formData.sessionId) {
        setFormData(prev => ({ ...prev, sessionId: activeSession.id }));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch data");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateEnrollment = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      const token = await user?.getIdToken();
      if (!token) return;

      const response = await fetch("/api/enrollments", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(formData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Failed to create enrollment");
      }

      // Reset form and close modal
      setFormData({ studentId: "", sessionId: formData.sessionId, level: "100L" });
      setShowModal(false);
      
      // Refresh data
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create enrollment");
    }
  };

  const handleDeleteEnrollment = async (enrollmentId: string) => {
    if (!confirm("Are you sure you want to delete this enrollment?")) return;

    try {
      const token = await user?.getIdToken();
      if (!token) return;

      const response = await fetch(`/api/enrollments/${enrollmentId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!response.ok) {
        throw new Error("Failed to delete enrollment");
      }

      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete enrollment");
    }
  };

  // Filter enrollments
  const filteredEnrollments = enrollments.filter(enrollment => {
    if (filterSession !== "all" && enrollment.sessionId !== filterSession) return false;
    if (filterLevel !== "all" && enrollment.level !== filterLevel) return false;
    return true;
  });

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--primary)]"></div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-heading font-bold text-[var(--foreground)]">
            Enrollment Management
          </h1>
          <p className="text-[var(--foreground)]/60 mt-1">
            Assign students to academic sessions with their current level
          </p>
        </div>
        <PermissionGate permission="enrollment:create">
          <button
            type="button"
            onClick={() => setShowModal(true)}
            className="px-4 py-2 bg-[var(--primary)] text-white rounded-lg hover:opacity-90 transition-opacity"
          >
            <svg className="h-5 w-5 inline mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Enroll Student
          </button>
        </PermissionGate>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
          <p className="text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-4 bg-[var(--glass-bg)] backdrop-blur-[var(--glass-blur)] border border-[var(--glass-border)] rounded-xl p-4">
        <div className="flex-1">
          <label htmlFor="filter-session" className="block text-sm font-medium text-[var(--foreground)]/70 mb-2">
            Filter by Session
          </label>
          <select
            id="filter-session"
            value={filterSession}
            onChange={(e) => setFilterSession(e.target.value)}
            className="w-full px-3 py-2 bg-[var(--background)] border border-[var(--glass-border)] rounded-lg text-[var(--foreground)]"
          >
            <option value="all">All Sessions</option>
            {sessions.map(session => (
              <option key={session.id} value={session.id}>
                {session.name} {session.isActive && "(Active)"}
              </option>
            ))}
          </select>
        </div>

        <div className="flex-1">
          <label htmlFor="filter-level" className="block text-sm font-medium text-[var(--foreground)]/70 mb-2">
            Filter by Level
          </label>
          <select
            id="filter-level"
            value={filterLevel}
            onChange={(e) => setFilterLevel(e.target.value)}
            className="w-full px-3 py-2 bg-[var(--background)] border border-[var(--glass-border)] rounded-lg text-[var(--foreground)]"
          >
            <option value="all">All Levels</option>
            {LEVELS.map(level => (
              <option key={level} value={level}>{level}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-[var(--glass-bg)] backdrop-blur-[var(--glass-blur)] border border-[var(--glass-border)] rounded-xl p-6">
          <div className="text-2xl font-bold text-[var(--primary)]">{enrollments.length}</div>
          <div className="text-sm text-[var(--foreground)]/60">Total Enrollments</div>
        </div>
        <div className="bg-[var(--glass-bg)] backdrop-blur-[var(--glass-blur)] border border-[var(--glass-border)] rounded-xl p-6">
          <div className="text-2xl font-bold text-[var(--primary)]">{students.length}</div>
          <div className="text-sm text-[var(--foreground)]/60">Total Students</div>
        </div>
        <div className="bg-[var(--glass-bg)] backdrop-blur-[var(--glass-blur)] border border-[var(--glass-border)] rounded-xl p-6">
          <div className="text-2xl font-bold text-[var(--primary)]">{filteredEnrollments.length}</div>
          <div className="text-sm text-[var(--foreground)]/60">Filtered Results</div>
        </div>
      </div>

      {/* Enrollments Table */}
      <div className="bg-[var(--glass-bg)] backdrop-blur-[var(--glass-blur)] border border-[var(--glass-border)] rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-[var(--primary)]/10 border-b border-[var(--glass-border)]">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-[var(--foreground)]/70 uppercase tracking-wider">
                  Student
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-[var(--foreground)]/70 uppercase tracking-wider">
                  Matric Number
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-[var(--foreground)]/70 uppercase tracking-wider">
                  Session
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-[var(--foreground)]/70 uppercase tracking-wider">
                  Level
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-[var(--foreground)]/70 uppercase tracking-wider">
                  Enrolled
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-[var(--foreground)]/70 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--glass-border)]">
              {filteredEnrollments.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-[var(--foreground)]/60">
                    No enrollments found
                  </td>
                </tr>
              ) : (
                filteredEnrollments.map(enrollment => (
                  <tr key={enrollment.id} className="hover:bg-[var(--primary)]/5">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-[var(--foreground)]">
                        {enrollment.student?.firstName} {enrollment.student?.lastName}
                      </div>
                      <div className="text-sm text-[var(--foreground)]/60">
                        {enrollment.student?.email}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-[var(--foreground)]">
                      {enrollment.student?.matricNumber || "N/A"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-[var(--foreground)]">
                          {enrollment.session?.name}
                        </span>
                        {enrollment.session?.isActive && (
                          <span className="px-2 py-1 text-xs bg-green-500/20 text-green-600 dark:text-green-400 rounded">
                            Active
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-3 py-1 text-sm bg-[var(--primary)]/20 text-[var(--primary)] rounded-full">
                        {enrollment.level}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-[var(--foreground)]/60">
                      {new Date(enrollment.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                      <button
                        onClick={() => handleDeleteEnrollment(enrollment.id)}
                        className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                        aria-label={`Delete enrollment for ${enrollment.student?.firstName || ""} ${enrollment.student?.lastName || ""}`}
                        title="Delete enrollment"
                      >
                        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        <span className="sr-only">Delete enrollment</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Enrollment Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-[var(--background)] rounded-xl max-w-md w-full p-6 border border-[var(--glass-border)]">
            <h2 className="text-2xl font-heading font-bold text-[var(--foreground)] mb-4">
              Enroll Student
            </h2>
            <form onSubmit={handleCreateEnrollment} className="space-y-4">
              <div>
                <label htmlFor="student-select" className="block text-sm font-medium text-[var(--foreground)]/70 mb-2">
                  Student
                </label>
                <select
                  id="student-select"
                  value={formData.studentId}
                  onChange={(e) => setFormData({ ...formData, studentId: e.target.value })}
                  className="w-full px-3 py-2 bg-[var(--background)] border border-[var(--glass-border)] rounded-lg text-[var(--foreground)]"
                  required
                >
                  <option value="">Select a student</option>
                  {students.map(student => (
                    <option key={student.id} value={student.id}>
                      {student.firstName} {student.lastName} ({student.matricNumber || student.email})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="session-select" className="block text-sm font-medium text-[var(--foreground)]/70 mb-2">
                  Session
                </label>
                <select
                  id="session-select"
                  value={formData.sessionId}
                  onChange={(e) => setFormData({ ...formData, sessionId: e.target.value })}
                  className="w-full px-3 py-2 bg-[var(--background)] border border-[var(--glass-border)] rounded-lg text-[var(--foreground)]"
                  required
                >
                  <option value="">Select a session</option>
                  {sessions.map(session => (
                    <option key={session.id} value={session.id}>
                      {session.name} {session.isActive && "(Active)"}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="level-select" className="block text-sm font-medium text-[var(--foreground)]/70 mb-2">
                  Level
                </label>
                <select
                  id="level-select"
                  value={formData.level}
                  onChange={(e) => setFormData({ ...formData, level: e.target.value })}
                  className="w-full px-3 py-2 bg-[var(--background)] border border-[var(--glass-border)] rounded-lg text-[var(--foreground)]"
                  required
                >
                  {LEVELS.map(level => (
                    <option key={level} value={level}>{level}</option>
                  ))}
                </select>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2 border border-[var(--glass-border)] rounded-lg text-[var(--foreground)] hover:bg-[var(--glass-bg)] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-[var(--primary)] text-white rounded-lg hover:opacity-90 transition-opacity"
                >
                  Enroll
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default withAuth(EnrollmentsPage, {
  anyPermission: ["enrollment:create", "enrollment:view", "enrollment:edit"]
});
