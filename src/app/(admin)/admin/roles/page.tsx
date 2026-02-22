"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { withAuth, PermissionGate } from "@/lib/withAuth";
import { getApiUrl } from "@/lib/api";
import { ConfirmModal } from "@/components/ui/Modal";
import { toast } from "sonner";

/* ─── Types ──────────────────────────────── */

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
  permissions?: string[];
  user?: User;
  session?: Session;
  createdAt: string;
}

// ── Position catalogue ─────────────────────────────────────────────────────
const POSITIONS = [
  // ── Executive ──────────────────────────────────────────────────────
  { group: "Executive Officers",       value: "president",                         label: "President" },
  { group: "Executive Officers",       value: "vice_president",                    label: "Vice President" },
  { group: "Executive Officers",       value: "general_secretary",                 label: "General Secretary" },
  { group: "Executive Officers",       value: "assistant_general_secretary",       label: "Asst. General Secretary" },
  { group: "Executive Officers",       value: "financial_secretary",               label: "Financial Secretary" },
  { group: "Executive Officers",       value: "treasurer",                         label: "Treasurer" },
  { group: "Executive Officers",       value: "pro",                               label: "Public Relations Officer" },
  { group: "Executive Officers",       value: "welfare_officer",                   label: "Welfare Officer" },
  // ── Directors ────────────────────────────────────────────────────── 
  { group: "Directors",                value: "director_of_socials",               label: "Director of Socials" },
  { group: "Directors",                value: "director_of_sports",                label: "Director of Sports" },
  { group: "Directors",                value: "director_of_academics",             label: "Director of Academics" },
  { group: "Directors",                value: "director_of_information",           label: "Director of Information" },
  // ── Class Representatives ─────────────────────────────────────────
  { group: "Class Representatives",    value: "class_rep_100L",                    label: "100L Class Rep" },
  { group: "Class Representatives",    value: "class_rep_200L",                    label: "200L Class Rep" },
  { group: "Class Representatives",    value: "class_rep_300L",                    label: "300L Class Rep" },
  { group: "Class Representatives",    value: "class_rep_400L",                    label: "400L Class Rep" },
  { group: "Class Representatives",    value: "class_rep_500L",                    label: "500L Class Rep" },
  { group: "Class Representatives",    value: "asst_class_rep_100L",              label: "100L Asst. Class Rep" },
  { group: "Class Representatives",    value: "asst_class_rep_200L",              label: "200L Asst. Class Rep" },
  { group: "Class Representatives",    value: "asst_class_rep_300L",              label: "300L Asst. Class Rep" },
  { group: "Class Representatives",    value: "asst_class_rep_400L",              label: "400L Asst. Class Rep" },
  { group: "Class Representatives",    value: "asst_class_rep_500L",              label: "500L Asst. Class Rep" },
  // ── Committee Heads ───────────────────────────────────────────────
  { group: "Committee Heads",          value: "committee_head_press",              label: "Press Committee Head" },
  { group: "Committee Heads",          value: "committee_head_technical",          label: "Technical Committee Head" },
  { group: "Committee Heads",          value: "committee_head_social",             label: "Social Committee Head" },
  { group: "Committee Heads",          value: "committee_head_welfare",            label: "Welfare Committee Head" },
  { group: "Committee Heads",          value: "committee_head_sports",             label: "Sports Committee Head" },
  { group: "Committee Heads",          value: "committee_head_academic",           label: "Academic Committee Head" },
  // ── Unit Heads ────────────────────────────────────────────────────
  { group: "Unit Heads",               value: "unit_head_photography",             label: "Photography Unit Head" },
  { group: "Unit Heads",               value: "unit_head_logistics",               label: "Logistics Unit Head" },
  { group: "Unit Heads",               value: "unit_head_security",                label: "Security Unit Head" },
  { group: "Unit Heads",               value: "unit_head_decoration",              label: "Decoration Unit Head" },
  // ── Admin Roles ───────────────────────────────────────────────────
  { group: "Admin Roles",              value: "admin",                             label: "Administrator" },
  { group: "Admin Roles",              value: "super_admin",                       label: "Super Administrator" },
];

const POSITION_GROUPS = Array.from(new Set(POSITIONS.map((p) => p.group)));

/* ─── Component ──────────────────────────── */

function RolesPage() {
  const { user, userProfile, loading: authLoading, getAccessToken } = useAuth();
  const [roles, setRoles] = useState<Role[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; id: string }>({ isOpen: false, id: "" });

  // Filter
  const [filterSession, setFilterSession] = useState<string>("all");

  // Form state
  const [formData, setFormData] = useState({
    userId: "",
    sessionId: "",
    position: "",
  });

  // User search in assign modal
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);

  // Custom / free-text position
  const [useCustomPosition, setUseCustomPosition] = useState(false);
  const [customPosition, setCustomPosition] = useState("");

  // Permissions edit state
  const [editPermsRole, setEditPermsRole] = useState<Role | null>(null);
  const [permCatalogue, setPermCatalogue] = useState<Record<string, { key: string; description: string }[]>>({});
  const [defaultPermsByPosition, setDefaultPermsByPosition] = useState<Record<string, string[]>>({});
  const [selectedPerms, setSelectedPerms] = useState<Set<string>>(new Set());
  const [savingPerms, setSavingPerms] = useState(false);

  /* ── Fetch ──────────────────────── */

  useEffect(() => {
    if (user && userProfile) {
      fetchData();
      fetchPermCatalogue();
    }
  }, [user, userProfile]);

  const fetchData = async () => {
    try {
      const token = await getAccessToken();
      if (!token) return;

      const [rolesRes, usersRes, sessionsRes] = await Promise.all([
        fetch(getApiUrl("/api/v1/roles/"), { headers: { Authorization: `Bearer ${token}` } }),
        fetch(getApiUrl("/api/v1/users/"), { headers: { Authorization: `Bearer ${token}` } }),
        fetch(getApiUrl("/api/v1/sessions/"), { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      if (!rolesRes.ok || !usersRes.ok || !sessionsRes.ok) {
        throw new Error("Failed to fetch data");
      }

      const [rolesData, usersData, sessionsData] = await Promise.all([
        rolesRes.json(),
        usersRes.json(),
        sessionsRes.json(),
      ]);

      setRoles(rolesData);
      setUsers(usersData);
      setSessions(sessionsData);

      const activeSession = sessionsData.find((s: Session) => s.isActive);
      if (activeSession) {
        setFilterSession(activeSession.id);
        if (!formData.sessionId) {
          setFormData((prev) => ({ ...prev, sessionId: activeSession.id }));
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch data");
    } finally {
      setLoading(false);
    }
  };

  /* ── Create ─────────────────────── */

  const handleCreateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const effectivePosition = useCustomPosition ? customPosition.trim() : formData.position;
    if (!effectivePosition) {
      setError("Please select or enter a position.");
      return;
    }
    try {
      const token = await getAccessToken();
      if (!token) return;

      const response = await fetch(getApiUrl("/api/v1/roles/"), {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ ...formData, position: effectivePosition }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Failed to assign role");
      }

      setFormData({ userId: "", sessionId: formData.sessionId, position: "" });
      setCustomPosition("");
      setUseCustomPosition(false);
      setUserSearchQuery("");
      setUserDropdownOpen(false);
      setShowModal(false);
      await fetchData();
      toast.success("Role assigned successfully");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to assign role";
      setError(msg);
      toast.error(msg);
    }
  };

  /* ── Delete ─────────────────────── */

  const handleDeleteRole = (roleId: string) => {
    setDeleteConfirm({ isOpen: true, id: roleId });
  };

  const confirmDeleteRole = async (roleId: string) => {
    try {
      const token = await getAccessToken();
      if (!token) return;

      const response = await fetch(getApiUrl(`/api/v1/roles/${roleId}`), {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) throw new Error("Failed to delete role");
      await fetchData();
      toast.success("Role removed");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to delete role";
      setError(msg);
      toast.error(msg);
    }
  };

  /* ── Permissions Catalogue ────────── */

  const fetchPermCatalogue = async () => {
    try {
      const token = await getAccessToken();
      if (!token) return;
      const [catalogRes, defaultsRes] = await Promise.all([
        fetch(getApiUrl("/api/v1/roles/permissions"), { headers: { Authorization: `Bearer ${token}` } }),
        fetch(getApiUrl("/api/v1/roles/permissions/defaults"), { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      if (catalogRes.ok) {
        const data = await catalogRes.json();
        setPermCatalogue(data.grouped || {});
      }
      if (defaultsRes.ok) {
        const data = await defaultsRes.json();
        setDefaultPermsByPosition(data.defaults || {});
      }
    } catch { /* silent */ }
  };

  /* ── Edit Permissions ─────────────── */

  const openEditPerms = (role: Role) => {
    setEditPermsRole(role);
    setSelectedPerms(new Set(role.permissions || []));
  };

  const togglePerm = (key: string) => {
    setSelectedPerms((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const savePermissions = async () => {
    if (!editPermsRole) return;
    setSavingPerms(true);
    try {
      const token = await getAccessToken();
      if (!token) return;
      const response = await fetch(getApiUrl(`/api/v1/roles/${editPermsRole.id}`), {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ permissions: Array.from(selectedPerms) }),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.detail || "Failed to update permissions");
      }
      setEditPermsRole(null);
      await fetchData();
      toast.success("Permissions updated");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to save permissions";
      setError(msg);
      toast.error(msg);
    } finally {
      setSavingPerms(false);
    }
  };

  /* ── Derived ────────────────────── */

  const filteredRoles =
    filterSession === "all" ? roles : roles.filter((role) => role.sessionId === filterSession);

  const executiveRoles = filteredRoles.filter((r) => {
    const g = POSITIONS.find(p => p.value === r.position)?.group;
    return !g || !["Class Representatives"].includes(g);
  });
  const classRepRoles = filteredRoles.filter((r) => {
    const g = POSITIONS.find(p => p.value === r.position)?.group;
    return g === "Class Representatives";
  });

  // Filtered users for the searchable dropdown
  const userSearchLower = userSearchQuery.toLowerCase();
  const filteredUsers = userSearchLower
    ? users.filter(
        (u) =>
          `${u.firstName} ${u.lastName}`.toLowerCase().includes(userSearchLower) ||
          (u.matricNumber || "").toLowerCase().includes(userSearchLower) ||
          u.email.toLowerCase().includes(userSearchLower)
      )
    : users;

  const selectedUser = users.find((u) => u.id === formData.userId);

  const getPositionLabel = (position: string) => {
    return POSITIONS.find((p) => p.value === position)?.label || position.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
  };

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
            <span className="brush-highlight">Role</span> Management
          </h1>
          <p className="text-sm text-navy/60 mt-1">Assign executive positions and class representatives for each session</p>
        </div>
        <PermissionGate permission="role:create">
          <button
            type="button"
            onClick={() => setShowModal(true)}
            className="self-start bg-lime border-[4px] border-navy press-3 press-navy px-6 py-2.5 rounded-2xl font-display font-bold text-sm text-navy transition-all flex items-center gap-2"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path fillRule="evenodd" d="M12 3.75a.75.75 0 0 1 .75.75v6.75h6.75a.75.75 0 0 1 0 1.5h-6.75v6.75a.75.75 0 0 1-1.5 0v-6.75H4.5a.75.75 0 0 1 0-1.5h6.75V4.5a.75.75 0 0 1 .75-.75Z" clipRule="evenodd" />
            </svg>
            Assign Role
          </button>
        </PermissionGate>
      </div>

      {/* ── Error ── */}
      {error && (
        <div role="alert" className="bg-coral-light border-[3px] border-coral rounded-2xl p-4">
          <p className="text-coral text-sm font-bold">{error}</p>
        </div>
      )}

      {/* ── Stats + Filter ── */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Session Filter */}
        <div className="bg-snow border-[4px] border-navy rounded-3xl p-5 shadow-[4px_4px_0_0_#000] flex flex-col justify-between">
          <label htmlFor="filter-session-select" className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate mb-3 block">Filter Session</label>
          <select
            id="filter-session-select"
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

        {/* Executive Count */}
        <div className="bg-teal border-[4px] border-navy rounded-3xl p-5 shadow-[4px_4px_0_0_#000] rotate-[0.5deg] hover:rotate-0 transition-transform">
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-snow/60 mb-1">Executive</p>
          <p className="font-display font-black text-3xl text-snow">{executiveRoles.length}</p>
          <span className="inline-flex mt-1 px-2.5 py-0.5 rounded-full bg-snow/20 text-snow/80 text-xs font-bold">Positions filled</span>
        </div>

        {/* Class Rep Count */}
        <div className="bg-lavender border-[4px] border-navy rounded-3xl p-5 shadow-[4px_4px_0_0_#000] rotate-[-0.5deg] hover:rotate-0 transition-transform">
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-snow/60 mb-1">Class Reps</p>
          <p className="font-display font-black text-3xl text-snow">{classRepRoles.length}</p>
          <span className="inline-flex mt-1 px-2.5 py-0.5 rounded-full bg-snow/20 text-snow/80 text-xs font-bold">Representatives</span>
        </div>

        {/* Total */}
        <div className="bg-snow border-[4px] border-navy rounded-3xl p-5 shadow-[4px_4px_0_0_#000]" aria-live="polite">
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate mb-1">Total</p>
          <p className="font-display font-black text-3xl text-navy">{filteredRoles.length}</p>
          <span className="inline-flex mt-1 px-2.5 py-0.5 rounded-full bg-cloud text-slate text-xs font-bold">Active roles</span>
        </div>
      </div>

      {/* ── Executive Team ── */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <h2 className="font-display font-bold text-xl text-navy">Executive Team</h2>
          <span className="px-3 py-1 bg-cloud text-slate text-xs font-bold rounded-full">{executiveRoles.length}</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {executiveRoles.length === 0 ? (
            <div className="col-span-full bg-snow border-[4px] border-navy rounded-3xl p-12 text-center shadow-[4px_4px_0_0_#000]">
              <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-lime-light flex items-center justify-center">
                <svg className="w-7 h-7 text-lime-dark" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M8.25 6.75a3.75 3.75 0 1 1 7.5 0 3.75 3.75 0 0 1-7.5 0ZM15.75 9.75a3 3 0 1 1 6 0 3 3 0 0 1-6 0ZM2.25 9.75a3 3 0 1 1 6 0 3 3 0 0 1-6 0ZM6.31 15.117A6.745 6.745 0 0 1 12 12a6.745 6.745 0 0 1 6.709 7.498.75.75 0 0 1-.372.568A12.696 12.696 0 0 1 12 21.75c-2.305 0-4.47-.612-6.337-1.684a.75.75 0 0 1-.372-.568 6.787 6.787 0 0 1 1.019-4.38Z" />
                  <path d="M5.082 14.254a8.287 8.287 0 0 0-1.308 5.135 9.687 9.687 0 0 1-1.764-.44l-.115-.04a.563.563 0 0 1-.373-.487l-.01-.121a3.75 3.75 0 0 1 3.57-4.047ZM20.226 19.389a8.287 8.287 0 0 0-1.308-5.135 3.75 3.75 0 0 1 3.57 4.047l-.01.121a.563.563 0 0 1-.373.486l-.115.04c-.567.2-1.156.349-1.764.441Z" />
                </svg>
              </div>
              <p className="text-sm text-navy/60 font-medium">No executive positions assigned</p>
            </div>
          ) : (
            executiveRoles.map((role) => {
              const initials = role.user ? `${role.user.firstName[0]}${role.user.lastName[0]}` : "??";
              return (
                <div key={role.id} className="bg-snow border-[4px] border-navy rounded-3xl p-6 press-4 press-black transition-all group">
                  <div className="flex items-start justify-between mb-4">
                    <span className="px-3 py-1 rounded-full bg-lime-light text-teal text-xs font-bold">
                      {getPositionLabel(role.position)}
                    </span>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => openEditPerms(role)}
                        className="p-1.5 rounded-xl hover:bg-lavender-light text-slate hover:text-lavender transition-colors"
                        title="Edit permissions"
                        aria-label={`Edit permissions for ${role.user?.firstName || ""} ${role.user?.lastName || ""}`}
                      >
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                          <path fillRule="evenodd" d="M12 1.5a5.25 5.25 0 0 0-5.25 5.25v3a3 3 0 0 0-3 3v6.75a3 3 0 0 0 3 3h10.5a3 3 0 0 0 3-3v-6.75a3 3 0 0 0-3-3v-3c0-2.9-2.35-5.25-5.25-5.25Zm3.75 8.25v-3a3.75 3.75 0 1 0-7.5 0v3h7.5Z" clipRule="evenodd" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDeleteRole(role.id)}
                        className="p-1.5 rounded-xl hover:bg-coral-light text-slate hover:text-coral transition-colors"
                        title="Remove role"
                        aria-label={`Remove ${role.user?.firstName || ""} ${role.user?.lastName || ""} from ${getPositionLabel(role.position)}`}
                      >
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                          <path fillRule="evenodd" d="M16.5 4.478v.227a48.816 48.816 0 0 1 3.878.512.75.75 0 1 1-.256 1.478l-.209-.035-1.005 13.07a3 3 0 0 1-2.991 2.77H8.084a3 3 0 0 1-2.991-2.77L4.087 6.66l-.209.035a.75.75 0 0 1-.256-1.478A48.567 48.567 0 0 1 7.5 4.705v-.227c0-1.564 1.213-2.9 2.816-2.951a52.662 52.662 0 0 1 3.369 0c1.603.051 2.815 1.387 2.815 2.951Zm-6.136-1.452a51.196 51.196 0 0 1 3.273 0C14.39 3.05 15 3.684 15 4.478v.113a49.488 49.488 0 0 0-6 0v-.113c0-.794.609-1.428 1.364-1.452Zm-.355 5.945a.75.75 0 1 0-1.5.058l.347 9a.75.75 0 1 0 1.499-.058l-.346-9Zm5.48.058a.75.75 0 1 0-1.498-.058l-.347 9a.75.75 0 0 0 1.5.058l.345-9Z" clipRule="evenodd" />
                        </svg>
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-xl bg-teal-light flex items-center justify-center text-sm font-bold text-teal shrink-0">
                      {initials}
                    </div>
                    <div>
                      <p className="font-display font-bold text-navy">{role.user?.firstName} {role.user?.lastName}</p>
                      <p className="text-xs text-navy/50">{role.user?.email}</p>
                    </div>
                  </div>
                  {role.user?.matricNumber && (
                    <p className="text-xs text-slate mb-3">{role.user.matricNumber}</p>
                  )}
                  <div className="pt-3 border-t-[3px] border-navy/10">
                    <span className="text-xs text-slate">Assigned {new Date(role.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ── Class Representatives ── */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <h2 className="font-display font-bold text-xl text-navy">Class Representatives</h2>
          <span className="px-3 py-1 bg-cloud text-slate text-xs font-bold rounded-full">{classRepRoles.length}</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {classRepRoles.length === 0 ? (
            <div className="col-span-full bg-snow border-[4px] border-navy rounded-3xl p-12 text-center shadow-[4px_4px_0_0_#000]">
              <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-lavender-light flex items-center justify-center">
                <svg className="w-7 h-7 text-lavender" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M4.5 6.375a4.125 4.125 0 1 1 8.25 0 4.125 4.125 0 0 1-8.25 0ZM14.25 8.625a3.375 3.375 0 1 1 6.75 0 3.375 3.375 0 0 1-6.75 0ZM1.5 19.125a7.125 7.125 0 0 1 14.25 0v.003l-.001.119a.75.75 0 0 1-.363.63 13.067 13.067 0 0 1-6.761 1.873c-2.472 0-4.786-.684-6.76-1.873a.75.75 0 0 1-.364-.63l-.001-.122ZM17.25 19.128l-.001.144a2.25 2.25 0 0 1-.233.96 10.088 10.088 0 0 0 5.06-1.01.75.75 0 0 0 .42-.643 4.875 4.875 0 0 0-6.957-4.611 8.586 8.586 0 0 1 1.71 5.157v.003Z" />
                </svg>
              </div>
              <p className="text-sm text-navy/60 font-medium">No class representatives assigned</p>
            </div>
          ) : (
            classRepRoles.map((role) => {
              const initials = role.user ? `${role.user.firstName[0]}${role.user.lastName[0]}` : "??";
              return (
                <div key={role.id} className="bg-snow border-[4px] border-navy rounded-3xl p-6 press-4 press-black transition-all group">
                  <div className="flex items-start justify-between mb-4">
                    <span className="px-3 py-1 rounded-full bg-lavender-light text-lavender text-xs font-bold">
                      {getPositionLabel(role.position)}
                    </span>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => openEditPerms(role)}
                        className="p-1.5 rounded-xl hover:bg-lavender-light text-slate hover:text-lavender transition-colors"
                        title="Edit permissions"
                        aria-label={`Edit permissions for ${role.user?.firstName || ""} ${role.user?.lastName || ""}`}
                      >
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                          <path fillRule="evenodd" d="M12 1.5a5.25 5.25 0 0 0-5.25 5.25v3a3 3 0 0 0-3 3v6.75a3 3 0 0 0 3 3h10.5a3 3 0 0 0 3-3v-6.75a3 3 0 0 0-3-3v-3c0-2.9-2.35-5.25-5.25-5.25Zm3.75 8.25v-3a3.75 3.75 0 1 0-7.5 0v3h7.5Z" clipRule="evenodd" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDeleteRole(role.id)}
                        className="p-1.5 rounded-xl hover:bg-coral-light text-slate hover:text-coral transition-colors"
                        title="Remove role"
                        aria-label={`Remove ${role.user?.firstName || ""} ${role.user?.lastName || ""} from ${getPositionLabel(role.position)}`}
                      >
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                          <path fillRule="evenodd" d="M16.5 4.478v.227a48.816 48.816 0 0 1 3.878.512.75.75 0 1 1-.256 1.478l-.209-.035-1.005 13.07a3 3 0 0 1-2.991 2.77H8.084a3 3 0 0 1-2.991-2.77L4.087 6.66l-.209.035a.75.75 0 0 1-.256-1.478A48.567 48.567 0 0 1 7.5 4.705v-.227c0-1.564 1.213-2.9 2.816-2.951a52.662 52.662 0 0 1 3.369 0c1.603.051 2.815 1.387 2.815 2.951Zm-6.136-1.452a51.196 51.196 0 0 1 3.273 0C14.39 3.05 15 3.684 15 4.478v.113a49.488 49.488 0 0 0-6 0v-.113c0-.794.609-1.428 1.364-1.452Zm-.355 5.945a.75.75 0 1 0-1.5.058l.347 9a.75.75 0 1 0 1.499-.058l-.346-9Zm5.48.058a.75.75 0 1 0-1.498-.058l-.347 9a.75.75 0 0 0 1.5.058l.345-9Z" clipRule="evenodd" />
                        </svg>
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-xl bg-lavender-light flex items-center justify-center text-sm font-bold text-lavender shrink-0">
                      {initials}
                    </div>
                    <div>
                      <p className="font-display font-bold text-navy">{role.user?.firstName} {role.user?.lastName}</p>
                      <p className="text-xs text-navy/50">{role.user?.email}</p>
                    </div>
                  </div>
                  {role.user?.matricNumber && (
                    <p className="text-xs text-slate mb-3">{role.user.matricNumber}</p>
                  )}
                  <div className="pt-3 border-t-[3px] border-navy/10">
                    <span className="text-xs text-slate">Assigned {new Date(role.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ── Assign Role Modal ── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 pt-4 pb-20 md:p-6">
          <div className="absolute inset-0 bg-navy/50" onClick={() => {
            setShowModal(false);
            setUserSearchQuery("");
            setUserDropdownOpen(false);
          }} />

          <div className="relative bg-snow border-[4px] border-navy rounded-3xl p-8 w-full max-w-md max-h-[85vh] overflow-y-auto shadow-[4px_4px_0_0_#000]">
            <div className="flex items-center justify-between mb-6">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate mb-1">New Assignment</p>
                <h2 className="font-display font-black text-xl text-navy">Assign Role</h2>
              </div>
              <button
                onClick={() => {
                  setShowModal(false);
                  setUserSearchQuery("");
                  setUserDropdownOpen(false);
                }}
                className="p-2 rounded-xl hover:bg-cloud transition-colors"
                aria-label="Close modal"
              >
                <svg className="w-5 h-5 text-navy/60" viewBox="0 0 24 24" fill="currentColor">
                  <path fillRule="evenodd" d="M5.47 5.47a.75.75 0 0 1 1.06 0L12 10.94l5.47-5.47a.75.75 0 1 1 1.06 1.06L13.06 12l5.47 5.47a.75.75 0 1 1-1.06 1.06L12 13.06l-5.47 5.47a.75.75 0 0 1-1.06-1.06L10.94 12 5.47 6.53a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleCreateRole} className="space-y-5">

              {/* ── User search combobox ── */}
              <div className="space-y-1.5">
                <label className="text-sm font-bold text-navy">User</label>
                {/* Selected user chip */}
                {selectedUser ? (
                  <div className="flex items-center justify-between px-4 py-3 bg-lime-light border-[3px] border-navy rounded-2xl">
                    <div>
                      <p className="font-bold text-sm text-navy">{selectedUser.firstName} {selectedUser.lastName}</p>
                      <p className="text-[11px] text-slate">{selectedUser.matricNumber || selectedUser.email}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setFormData({ ...formData, userId: "" });
                        setUserSearchQuery("");
                        setUserDropdownOpen(true);
                      }}
                      className="p-1 rounded-lg hover:bg-cloud transition-colors"
                      aria-label="Change user"
                    >
                      <svg className="w-4 h-4 text-navy/60" viewBox="0 0 24 24" fill="currentColor">
                        <path fillRule="evenodd" d="M5.47 5.47a.75.75 0 0 1 1.06 0L12 10.94l5.47-5.47a.75.75 0 1 1 1.06 1.06L13.06 12l5.47 5.47a.75.75 0 1 1-1.06 1.06L12 13.06l-5.47 5.47a.75.75 0 0 1-1.06-1.06L10.94 12 5.47 6.53a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <div className="relative">
                      <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate pointer-events-none" viewBox="0 0 24 24" fill="currentColor">
                        <path fillRule="evenodd" d="M10.5 3.75a6.75 6.75 0 1 0 0 13.5 6.75 6.75 0 0 0 0-13.5ZM2.25 10.5a8.25 8.25 0 1 1 14.59 5.28l4.69 4.69a.75.75 0 1 1-1.06 1.06l-4.69-4.69A8.25 8.25 0 0 1 2.25 10.5Z" clipRule="evenodd" />
                      </svg>
                      <input
                        type="text"
                        placeholder="Search by name, matric no. or email…"
                        value={userSearchQuery}
                        onChange={(e) => { setUserSearchQuery(e.target.value); setUserDropdownOpen(true); }}
                        onFocus={() => setUserDropdownOpen(true)}
                        onBlur={() => {
                          // Delay closing to allow click events on dropdown items to fire
                          setTimeout(() => setUserDropdownOpen(false), 200);
                        }}
                        className="w-full pl-10 pr-4 py-3 bg-ghost border-[3px] border-navy rounded-2xl text-navy text-sm placeholder:text-slate focus:outline-none transition-all"
                      />
                    </div>
                    {userDropdownOpen && filteredUsers.length > 0 && (
                      <div className="absolute z-10 top-full mt-1 w-full bg-snow border-[3px] border-navy rounded-2xl shadow-[4px_4px_0_0_#000] max-h-52 overflow-y-auto">
                        {filteredUsers.slice(0, 30).map((u) => (
                          <button
                            type="button"
                            key={u.id}
                            onClick={() => {
                              setFormData({ ...formData, userId: u.id });
                              setUserSearchQuery("");
                              setUserDropdownOpen(false);
                            }}
                            className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-lime-light text-left transition-colors"
                          >
                            <div className="w-7 h-7 rounded-lg bg-lavender flex items-center justify-center shrink-0">
                              <span className="text-snow text-[10px] font-black">{u.firstName[0]}{u.lastName[0]}</span>
                            </div>
                            <div className="min-w-0">
                              <p className="font-bold text-sm text-navy truncate">{u.firstName} {u.lastName}</p>
                              <p className="text-[11px] text-slate truncate">{u.matricNumber || u.email}</p>
                            </div>
                          </button>
                        ))}
                        {filteredUsers.length > 30 && (
                          <p className="px-4 py-2 text-xs text-slate font-bold border-t border-cloud">
                            Showing first 30 results. Refine your search.
                          </p>
                        )}
                      </div>
                    )}
                    {userDropdownOpen && filteredUsers.length === 0 && userSearchQuery && (
                      <div className="absolute z-10 top-full mt-1 w-full bg-snow border-[3px] border-navy rounded-2xl shadow-[4px_4px_0_0_#000] px-4 py-3">
                        <p className="text-sm text-navy/60 font-bold">No users found for &ldquo;{userSearchQuery}&rdquo;</p>
                      </div>
                    )}
                  </div>
                )}
                {/* Hidden required input to enforce selection */}
                <input type="hidden" value={formData.userId || ""} required />
              </div>

              {/* ── Session ── */}
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

              {/* ── Position / Custom ── */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-bold text-navy">Position</label>
                  <button
                    type="button"
                    onClick={() => { setUseCustomPosition(!useCustomPosition); setFormData({ ...formData, position: "" }); setCustomPosition(""); }}
                    className="text-[11px] font-bold text-lavender hover:text-lavender/70 transition-colors"
                  >
                    {useCustomPosition ? "← Choose from list" : "Custom position →"}
                  </button>
                </div>

                {useCustomPosition ? (
                  <input
                    type="text"
                    placeholder="e.g. Level Coordinator, Quiz Master…"
                    value={customPosition}
                    onChange={(e) => setCustomPosition(e.target.value)}
                    className="w-full px-4 py-3 bg-ghost border-[3px] border-navy rounded-2xl text-navy text-sm placeholder:text-slate focus:outline-none transition-all"
                    required
                  />
                ) : (
                  <select
                    id="position-select"
                    value={formData.position}
                    onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                    className="w-full px-4 py-3 bg-ghost border-[3px] border-navy rounded-2xl text-navy text-sm appearance-none cursor-pointer transition-all"
                    required
                  >
                    <option value="">Select a position</option>
                    {POSITION_GROUPS.map((group) => (
                      <optgroup key={group} label={group}>
                        {POSITIONS.filter((p) => p.group === group).map((position) => (
                          <option key={position.value} value={position.value}>{position.label}</option>
                        ))}
                      </optgroup>
                    ))}
                    <optgroup label="──────────">
                      <option value="" disabled>Or use &ldquo;Custom position&rdquo; above</option>
                    </optgroup>
                  </select>
                )}
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setUserSearchQuery("");
                    setUserDropdownOpen(false);
                  }}
                  className="flex-1 px-5 py-2.5 rounded-2xl border-[3px] border-navy text-navy text-sm font-bold hover:bg-cloud transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!formData.userId || !formData.sessionId || (!useCustomPosition ? !formData.position : !customPosition.trim())}
 className="flex-1 px-5 py-2.5 rounded-2xl bg-navy border-[3px] border-navy text-lime text-sm font-bold press-4 press-lime disabled:opacity-40 transition-all"
                >
                  Assign
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
          confirmDeleteRole(deleteConfirm.id);
          setDeleteConfirm({ isOpen: false, id: "" });
        }}
        title="Remove Role"
        message="Are you sure you want to remove this role assignment?"
        confirmLabel="Remove"
        variant="danger"
      />

      {/* ── Edit Permissions Modal ── */}
      {editPermsRole && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-navy/60" onClick={() => setEditPermsRole(null)} />
          <div className="relative bg-snow border-[4px] border-navy rounded-3xl w-full max-w-2xl shadow-[4px_4px_0_0_#000] max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="flex items-start justify-between p-7 pb-5 border-b-[3px] border-navy/10">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate mb-1">Role Permissions</p>
                <h2 className="font-display font-black text-xl text-navy">
                  {editPermsRole.user?.firstName} {editPermsRole.user?.lastName}
                </h2>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className="px-2.5 py-0.5 rounded-full bg-lime-light text-navy text-xs font-bold">
                    {getPositionLabel(editPermsRole.position)}
                  </span>
                  <span className="text-xs text-slate">
                    {(defaultPermsByPosition[editPermsRole.position] || []).length} default ·{" "}
                    {selectedPerms.size} extra selected
                  </span>
                </div>
              </div>
              <button
                onClick={() => setEditPermsRole(null)}
                className="p-2 rounded-xl hover:bg-cloud transition-colors mt-1"
                aria-label="Close"
              >
                <svg className="w-5 h-5 text-navy/60" viewBox="0 0 24 24" fill="currentColor">
                  <path fillRule="evenodd" d="M5.47 5.47a.75.75 0 0 1 1.06 0L12 10.94l5.47-5.47a.75.75 0 1 1 1.06 1.06L13.06 12l5.47 5.47a.75.75 0 1 1-1.06 1.06L12 13.06l-5.47 5.47a.75.75 0 0 1-1.06-1.06L10.94 12 5.47 6.53a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
                </svg>
              </button>
            </div>

            {/* Info banner */}
            <div className="mx-7 mt-4 px-4 py-3 rounded-2xl bg-lavender-light border-[2px] border-lavender/30 flex items-start gap-2.5">
              <svg className="w-4 h-4 text-lavender mt-0.5 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm8.706-1.442c1.146-.573 2.437.463 2.126 1.706l-.709 2.836.042-.02a.75.75 0 0 1 .67 1.34l-.04.022c-1.147.573-2.438-.463-2.127-1.706l.71-2.836-.042.02a.75.75 0 1 1-.671-1.34l.041-.022ZM12 9a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z" clipRule="evenodd" />
              </svg>
              <p className="text-xs text-navy/70 leading-relaxed">
                <span className="font-bold">Default permissions</span> (shown greyed) come from this person&apos;s position and are always active.
                Use the checkboxes to grant <span className="font-bold">extra permissions</span> on top of those defaults.
              </p>
            </div>

            {/* Permission groups (scrollable) */}
            <div className="flex-1 overflow-y-auto px-7 py-5 space-y-5">
              {Object.entries(permCatalogue).map(([domain, perms]) => {
                const positionDefaults = new Set(defaultPermsByPosition[editPermsRole.position] || []);
                return (
                  <div key={domain}>
                    <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate mb-2 capitalize">{domain}</p>
                    <div className="bg-ghost border-[2px] border-navy/10 rounded-2xl divide-y divide-navy/10">
                      {perms.map(({ key, description }) => {
                        const isDefault = positionDefaults.has(key);
                        const isChecked = isDefault || selectedPerms.has(key);
                        return (
                          <label
                            key={key}
                            className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors rounded-2xl ${
                              isDefault ? "opacity-60" : "hover:bg-cloud/50"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              disabled={isDefault}
                              onChange={() => !isDefault && togglePerm(key)}
                              className="w-4 h-4 rounded border-[2px] border-navy accent-navy cursor-pointer disabled:cursor-default shrink-0"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-mono text-xs font-bold text-navy">{key}</span>
                                {isDefault && (
                                  <span className="px-1.5 py-0.5 rounded bg-cloud text-slate text-[9px] font-bold uppercase tracking-wide">default</span>
                                )}
                              </div>
                              <p className="text-xs text-slate mt-0.5">{description}</p>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
              {Object.keys(permCatalogue).length === 0 && (
                <div className="text-center py-8 text-navy/40 text-sm">Loading permissions…</div>
              )}
            </div>

            {/* Footer */}
            <div className="flex gap-3 p-7 pt-5 border-t-[3px] border-navy/10">
              <button
                onClick={() => setEditPermsRole(null)}
                className="flex-1 px-5 py-2.5 rounded-2xl border-[3px] border-navy text-navy text-sm font-bold hover:bg-cloud transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={savePermissions}
                disabled={savingPerms}
                className="flex-1 px-5 py-2.5 rounded-2xl bg-lime border-[3px] border-navy text-navy text-sm font-bold press-3 press-navy transition-all disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {savingPerms ? "Saving…" : "Save Permissions"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default withAuth(RolesPage, {
  anyPermission: ["role:create", "role:view", "role:edit"],
});
