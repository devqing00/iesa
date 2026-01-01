"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { withAuth, PermissionGate } from "@/lib/withAuth";

interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  matricNumber?: string;
  profilePhotoURL?: string;
  role: string;
}

interface Session {
  id: string;
  name: string;
  isActive: boolean;
}

interface Role {
  id: string;
  userId: string;
  sessionId: string;
  position: string;
  user?: User;
  session?: Session;
  createdAt: string;
}

const POSITIONS = [
  { value: "president", label: "President" },
  { value: "vice_president", label: "Vice President" },
  { value: "general_secretary", label: "General Secretary" },
  { value: "assistant_general_secretary", label: "Assistant General Secretary" },
  { value: "financial_secretary", label: "Financial Secretary" },
  { value: "treasurer", label: "Treasurer" },
  { value: "director_of_socials", label: "Director of Socials" },
  { value: "director_of_sports", label: "Director of Sports" },
  { value: "pro", label: "Public Relations Officer" },
  { value: "class_rep_100L", label: "100L Class Rep" },
  { value: "class_rep_200L", label: "200L Class Rep" },
  { value: "class_rep_300L", label: "300L Class Rep" },
  { value: "class_rep_400L", label: "400L Class Rep" },
  { value: "class_rep_500L", label: "500L Class Rep" }
];

function RolesPage() {
  const { user, userProfile, loading: authLoading } = useAuth();
  const [roles, setRoles] = useState<Role[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  
  // Filter
  const [filterSession, setFilterSession] = useState<string>("all");

  // Form state
  const [formData, setFormData] = useState({
    userId: "",
    sessionId: "",
    position: ""
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

      // Fetch roles, users, and sessions in parallel
      const [rolesRes, usersRes, sessionsRes] = await Promise.all([
        fetch("/api/roles", {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch("/api/users", {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch("/api/sessions", {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);

      if (!rolesRes.ok || !usersRes.ok || !sessionsRes.ok) {
        throw new Error("Failed to fetch data");
      }

      const [rolesData, usersData, sessionsData] = await Promise.all([
        rolesRes.json(),
        usersRes.json(),
        sessionsRes.json()
      ]);

      setRoles(rolesData);
      setUsers(usersData);
      setSessions(sessionsData);
      
      // Set default session to active session
      const activeSession = sessionsData.find((s: Session) => s.isActive);
      if (activeSession) {
        setFilterSession(activeSession.id);
        if (!formData.sessionId) {
          setFormData(prev => ({ ...prev, sessionId: activeSession.id }));
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch data");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      const token = await user?.getIdToken();
      if (!token) return;

      const response = await fetch("/api/roles", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(formData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Failed to assign role");
      }

      // Reset form and close modal
      setFormData({ userId: "", sessionId: formData.sessionId, position: "" });
      setShowModal(false);
      
      // Refresh data
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to assign role");
    }
  };

  const handleDeleteRole = async (roleId: string) => {
    if (!confirm("Are you sure you want to remove this role assignment?")) return;

    try {
      const token = await user?.getIdToken();
      if (!token) return;

      const response = await fetch(`/api/roles/${roleId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!response.ok) {
        throw new Error("Failed to delete role");
      }

      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete role");
    }
  };

  // Filter roles by session
  const filteredRoles = filterSession === "all" 
    ? roles 
    : roles.filter(role => role.sessionId === filterSession);

  // Group roles by category
  const executiveRoles = filteredRoles.filter(r => 
    !r.position.startsWith("class_rep_")
  );
  const classRepRoles = filteredRoles.filter(r => 
    r.position.startsWith("class_rep_")
  );

  const getPositionLabel = (position: string) => {
    return POSITIONS.find(p => p.value === position)?.label || position;
  };

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
            Role Management
          </h1>
          <p className="text-[var(--foreground)]/60 mt-1">
            Assign executive positions and class representatives for each session
          </p>
        </div>
        <PermissionGate permission="role:create">
          <button
            onClick={() => setShowModal(true)}
            className="px-4 py-2 bg-[var(--primary)] text-white rounded-lg hover:opacity-90 transition-opacity"
          >
            <svg className="h-5 w-5 inline mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Assign Role
          </button>
        </PermissionGate>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
          <p className="text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Session Filter */}
      <div className="bg-[var(--glass-bg)] backdrop-blur-[var(--glass-blur)] border border-[var(--glass-border)] rounded-xl p-4">
        <label htmlFor="filter-session-select" className="block text-sm font-medium text-[var(--foreground)]/70 mb-2">
          Filter by Session
        </label>
        <select
          id="filter-session-select"
          value={filterSession}
          onChange={(e) => setFilterSession(e.target.value)}
          className="w-full md:w-64 px-3 py-2 bg-[var(--background)] border border-[var(--glass-border)] rounded-lg text-[var(--foreground)]"
        >
          <option value="all">All Sessions</option>
          {sessions.map(session => (
            <option key={session.id} value={session.id}>
              {session.name} {session.isActive && "(Active)"}
            </option>
          ))}
        </select>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-[var(--glass-bg)] backdrop-blur-[var(--glass-blur)] border border-[var(--glass-border)] rounded-xl p-6">
          <div className="text-2xl font-bold text-[var(--primary)]">{executiveRoles.length}</div>
          <div className="text-sm text-[var(--foreground)]/60">Executive Positions</div>
        </div>
        <div className="bg-[var(--glass-bg)] backdrop-blur-[var(--glass-blur)] border border-[var(--glass-border)] rounded-xl p-6">
          <div className="text-2xl font-bold text-[var(--primary)]">{classRepRoles.length}</div>
          <div className="text-sm text-[var(--foreground)]/60">Class Representatives</div>
        </div>
        <div className="bg-[var(--glass-bg)] backdrop-blur-[var(--glass-blur)] border border-[var(--glass-border)] rounded-xl p-6">
          <div className="text-2xl font-bold text-[var(--primary)]">{filteredRoles.length}</div>
          <div className="text-sm text-[var(--foreground)]/60">Total Roles</div>
        </div>
      </div>

      {/* Executive Team */}
      <div className="bg-[var(--glass-bg)] backdrop-blur-[var(--glass-blur)] border border-[var(--glass-border)] rounded-xl p-6">
        <h2 className="text-xl font-heading font-bold text-[var(--foreground)] mb-4">
          Executive Team
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {executiveRoles.length === 0 ? (
            <div className="col-span-full text-center py-8 text-[var(--foreground)]/60">
              No executive positions assigned
            </div>
          ) : (
            executiveRoles.map(role => (
              <div key={role.id} className="border border-[var(--glass-border)] rounded-lg p-4 hover:bg-[var(--primary)]/5 transition-colors">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="text-sm font-medium text-[var(--primary)] uppercase tracking-wide mb-1">
                      {getPositionLabel(role.position)}
                    </div>
                    <div className="text-lg font-semibold text-[var(--foreground)]">
                      {role.user?.firstName} {role.user?.lastName}
                    </div>
                    <div className="text-sm text-[var(--foreground)]/60">
                      {role.user?.email}
                    </div>
                    {role.user?.matricNumber && (
                      <div className="text-sm text-[var(--foreground)]/60">
                        {role.user.matricNumber}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => handleDeleteRole(role.id)}
                    className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                    title="Remove role"
                  >
                    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <div className="text-xs text-[var(--foreground)]/50">
                  Assigned {new Date(role.createdAt).toLocaleDateString()}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Class Representatives */}
      <div className="bg-[var(--glass-bg)] backdrop-blur-[var(--glass-blur)] border border-[var(--glass-border)] rounded-xl p-6">
        <h2 className="text-xl font-heading font-bold text-[var(--foreground)] mb-4">
          Class Representatives
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {classRepRoles.length === 0 ? (
            <div className="col-span-full text-center py-8 text-[var(--foreground)]/60">
              No class representatives assigned
            </div>
          ) : (
            classRepRoles.map(role => (
              <div key={role.id} className="border border-[var(--glass-border)] rounded-lg p-4 hover:bg-[var(--primary)]/5 transition-colors">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="text-sm font-medium text-[var(--primary)] uppercase tracking-wide mb-1">
                      {getPositionLabel(role.position)}
                    </div>
                    <div className="text-lg font-semibold text-[var(--foreground)]">
                      {role.user?.firstName} {role.user?.lastName}
                    </div>
                    <div className="text-sm text-[var(--foreground)]/60">
                      {role.user?.email}
                    </div>
                    {role.user?.matricNumber && (
                      <div className="text-sm text-[var(--foreground)]/60">
                        {role.user.matricNumber}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => handleDeleteRole(role.id)}
                    className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                    title="Remove role"
                  >
                    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <div className="text-xs text-[var(--foreground)]/50">
                  Assigned {new Date(role.createdAt).toLocaleDateString()}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Assign Role Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-[var(--background)] rounded-xl max-w-md w-full p-6 border border-[var(--glass-border)]">
            <h2 className="text-2xl font-heading font-bold text-[var(--foreground)] mb-4">
              Assign Role
            </h2>
            <form onSubmit={handleCreateRole} className="space-y-4">
              <div>
                <label htmlFor="user-select" className="block text-sm font-medium text-[var(--foreground)]/70 mb-2">
                  User
                </label>
                <select
                  id="user-select"
                  value={formData.userId}
                  onChange={(e) => setFormData({ ...formData, userId: e.target.value })}
                  className="w-full px-3 py-2 bg-[var(--background)] border border-[var(--glass-border)] rounded-lg text-[var(--foreground)]"
                  required
                >
                  <option value="">Select a user</option>
                  {users.map(user => (
                    <option key={user.id} value={user.id}>
                      {user.firstName} {user.lastName} ({user.matricNumber || user.email})
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
                <label htmlFor="position-select" className="block text-sm font-medium text-[var(--foreground)]/70 mb-2">
                  Position
                </label>
                <select
                  id="position-select"
                  value={formData.position}
                  onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                  className="w-full px-3 py-2 bg-[var(--background)] border border-[var(--glass-border)] rounded-lg text-[var(--foreground)]"
                  required
                >
                  <option value="">Select a position</option>
                  <optgroup label="Executive Positions">
                    {POSITIONS.filter(p => !p.value.startsWith("class_rep_")).map(position => (
                      <option key={position.value} value={position.value}>
                        {position.label}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Class Representatives">
                    {POSITIONS.filter(p => p.value.startsWith("class_rep_")).map(position => (
                      <option key={position.value} value={position.value}>
                        {position.label}
                      </option>
                    ))}
                  </optgroup>
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
                  Assign
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default withAuth(RolesPage, {
  anyPermission: ["role:create", "role:view", "role:edit"]
});
