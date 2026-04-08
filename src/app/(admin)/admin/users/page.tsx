"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { getApiUrl } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { throwApiError, getErrorMessage } from "@/lib/adminApiError";
import Pagination from "@/components/ui/Pagination";
import { Modal, ConfirmModal } from "@/components/ui/Modal";
import { withAuth, PermissionGate } from "@/lib/withAuth";
import { HelpButton, ToolHelpModal, useToolHelp } from "@/components/ui/ToolHelpModal";

/* ─── Types ──────────────────────────────── */

interface User {
  _id: string;
  id?: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  level?: number;
  currentLevel?: string;
  admissionYear?: number;
  matricNumber?: string;
  phone?: string;
  dateOfBirth?: string;
  emailVerified?: boolean;
  hasCompletedOnboarding?: boolean;
  isExternalStudent?: boolean;
  createdAt?: string;
  updatedAt?: string;
  department?: string;
  isActive?: boolean;
}

interface BirthdayUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  matricNumber?: string;
  currentLevel?: string;
  department?: string;
  activeRoles?: string[];
  daysUntil: number;
  birthdayMonth: number;
  birthdayDay: number;
  nextBirthday: string;
}

interface RoleAssignment {
  userId: string;
  position: string;
  societyId?: string | null;
  societyName?: string | null;
  isActive?: boolean;
  session?: {
    isActive?: boolean;
  };
}

interface AssignedRoleTag {
  key: string;
  position: string;
  label: string;
}

const POSITION_LABELS: Record<string, string> = {
  president: "President",
  vice_president: "Vice President",
  general_secretary: "General Secretary",
  assistant_general_secretary: "Asst. General Secretary",
  treasurer: "Treasurer",
  social_director: "Social Director",
  sports_secretary: "Sports Secretary",
  assistant_sports_secretary: "Asst. Sports Secretary",
  pro: "Public Relations Officer",
  financial_secretary: "Financial Secretary",
  class_rep_100L: "100L Class Rep",
  class_rep_200L: "200L Class Rep",
  class_rep_300L: "300L Class Rep",
  class_rep_400L: "400L Class Rep",
  class_rep_500L: "500L Class Rep",
  asst_class_rep_100L: "100L Asst. Class Rep",
  asst_class_rep_200L: "200L Asst. Class Rep",
  asst_class_rep_300L: "300L Asst. Class Rep",
  asst_class_rep_400L: "400L Asst. Class Rep",
  asst_class_rep_500L: "500L Asst. Class Rep",
  freshers_coordinator: "Freshers Coordinator",
  academic_lead: "Academic Lead",
  committee_academic_member: "Academic Team Member",
  timp_lead: "TIMP Lead",
  iepod_hub_director: "IEPOD Hub Director",
  iepod_hub_lead: "IEPOD Hub Lead",
  iepod_conference_lead: "IEPOD Conference Lead",
  iepod_program_coordinator: "IEPOD Program Coordinator",
  iepod_communications_officer: "IEPOD Communications Officer",
  iepod_communications_officer_1: "IEPOD Communications Officer 1",
  admin: "Administrator",
  super_admin: "Super Administrator",
};

const EXEC_POSITIONS = new Set([
  "president",
  "vice_president",
  "general_secretary",
  "assistant_general_secretary",
  "treasurer",
  "social_director",
  "sports_secretary",
  "assistant_sports_secretary",
  "pro",
  "financial_secretary",
]);

function getPositionLabel(position: string): string {
  return POSITION_LABELS[position] || position.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function getRoleAssignmentLabel(role: Pick<RoleAssignment, "position" | "societyName">): string {
  const base = getPositionLabel(role.position);
  if (role.position === "iepod_hub_lead" && role.societyName) {
    return `${base} (${role.societyName})`;
  }
  return base;
}

function getPositionBadge(position: string): string {
  if (position === "admin" || position === "super_admin") return "bg-lavender-light text-lavender";
  if (position === "timp_lead") return "bg-teal-light text-teal";
  if (position.startsWith("iepod_")) return "bg-coral-light text-coral";
  if (position.startsWith("class_rep_") || position.startsWith("asst_class_rep_") || position === "freshers_coordinator") return "bg-sunny-light text-navy";
  if (position.includes("head") || position.endsWith("_lead") || position === "academic_lead") return "bg-lime-light text-navy";
  if (position.includes("member")) return "bg-cloud text-navy/70";
  if (EXEC_POSITIONS.has(position)) return "bg-coral-light text-coral";
  return "bg-cloud text-navy/60";
}

function formatBirthdayDate(month: number, day: number): string {
  const date = new Date(2024, month - 1, day);
  return date.toLocaleDateString("en-NG", { month: "short", day: "numeric" });
}

/* ─── Component ──────────────────────────── */

function AdminUsersPage() {
  const { getAccessToken } = useAuth();
  const { showHelp, openHelp, closeHelp } = useToolHelp("admin-users");
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [deptFilter, setDeptFilter] = useState("all");
  const [levelFilter, setLevelFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState<"time" | "name" | "level">("time");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalUsers, setTotalUsers] = useState(0);
  const ITEMS_PER_PAGE = 15;

  /* ── Edit modal state ─── */
  const [editUser, setEditUser] = useState<User | null>(null);
  const [editRole, setEditRole] = useState<"student" | "exco" | "admin">("student");
  const [editLevel, setEditLevel] = useState("");
  const [editAdmissionYear, setEditAdmissionYear] = useState("");
  const [editIsActive, setEditIsActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [viewLoading, setViewLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);
  const [deleting, setDeleting] = useState(false);

  // ── Tab ──────────────────────────────────────
  const [activeTab, setActiveTab] = useState<"users" | "birthdays">("users");
  const [usersFiltersOpen, setUsersFiltersOpen] = useState(false);
  const [birthdaysFiltersOpen, setBirthdaysFiltersOpen] = useState(false);
  const usersFiltersRef = useRef<HTMLDivElement>(null);
  const birthdaysFiltersRef = useRef<HTMLDivElement>(null);

  // ── Birthdays ────────────────────────────────
  const BD_PER_PAGE = 20;
  const [bdSearch, setBdSearch] = useState("");
  const [bdDept, setBdDept] = useState("all");
  const [bdDaysAhead, setBdDaysAhead] = useState(90);
  const [bdLevel, setBdLevel] = useState("all");
  const [bdSortBy, setBdSortBy] = useState<"time" | "name" | "level">("time");
  const [bdSortOrder, setBdSortOrder] = useState<"asc" | "desc">("asc");
  const [bdItems, setBdItems] = useState<BirthdayUser[]>([]);
  const [bdLoading, setBdLoading] = useState(false);
  const [bdTotal, setBdTotal] = useState(0);
  const [bdPage, setBdPage] = useState(1);
  const [activePositionsByUserId, setActivePositionsByUserId] = useState<Record<string, AssignedRoleTag[]>>({});
  const [exportingUsersPdf, setExportingUsersPdf] = useState(false);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const token = await getAccessToken();
      const params = new URLSearchParams();
      params.set("limit", String(ITEMS_PER_PAGE));
      params.set("skip", String((page - 1) * ITEMS_PER_PAGE));
      if (roleFilter !== "all") params.set("role", roleFilter);
      if (deptFilter !== "all") params.set("department", deptFilter);
      if (levelFilter !== "all") params.set("level", levelFilter);
      if (statusFilter !== "all") params.set("status", statusFilter);
      params.set("sort_by", sortBy);
      params.set("sort_order", sortOrder);
      if (searchQuery.trim()) params.set("search", searchQuery.trim());

      const response = await fetch(getApiUrl(`/api/v1/users/?${params}`), {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (response.ok) {
        const data = await response.json();
        const items = data.items ?? data;
        const total = data.total ?? items.length;
        const mappedData = items.map((item: User & { _id?: string }) => ({
          ...item,
          id: item.id || item._id,
        }));
        setUsers(mappedData);
        setTotalUsers(total);
      }
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to load users"));
    } finally {
      setLoading(false);
    }
  }, [getAccessToken, page, roleFilter, deptFilter, levelFilter, statusFilter, sortBy, sortOrder, searchQuery]);

  useEffect(() => {
    const debounce = setTimeout(() => fetchUsers(), searchQuery ? 300 : 0);
    return () => clearTimeout(debounce);
  }, [fetchUsers, searchQuery]);

  const fetchRoleAssignments = useCallback(async () => {
    try {
      const token = await getAccessToken();
      const response = await fetch(getApiUrl("/api/v1/roles/"), {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!response.ok) {
        setActivePositionsByUserId({});
        return;
      }
      const roles: RoleAssignment[] = await response.json();
      const mapped: Record<string, AssignedRoleTag[]> = {};

      for (const role of roles) {
        if (!role?.userId || !role?.position) continue;
        if (role.isActive === false) continue;
        if (role.session?.isActive === false) continue;
        if (!mapped[role.userId]) mapped[role.userId] = [];
        const roleKey = role.position === "iepod_hub_lead"
          ? `${role.position}:${role.societyId || role.societyName || "__unspecified__"}`
          : role.position;
        if (!mapped[role.userId].some((entry) => entry.key === roleKey)) {
          mapped[role.userId].push({
            key: roleKey,
            position: role.position,
            label: getRoleAssignmentLabel(role),
          });
        }
      }

      setActivePositionsByUserId(mapped);
    } catch {
      setActivePositionsByUserId({});
    }
  }, [getAccessToken]);

  useEffect(() => {
    fetchRoleAssignments();
  }, [fetchRoleAssignments]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;

      if (usersFiltersRef.current && !usersFiltersRef.current.contains(target)) {
        setUsersFiltersOpen(false);
      }

      if (birthdaysFiltersRef.current && !birthdaysFiltersRef.current.contains(target)) {
        setBirthdaysFiltersOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setUsersFiltersOpen(false);
        setBirthdaysFiltersOpen(false);
      }
    }

    if (usersFiltersOpen || birthdaysFiltersOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleEscape);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [usersFiltersOpen, birthdaysFiltersOpen]);

  const fetchBirthdays = useCallback(async () => {
    setBdLoading(true);
    try {
      const token = await getAccessToken();
      const params = new URLSearchParams();
      params.set("limit", String(BD_PER_PAGE));
      params.set("skip", String((bdPage - 1) * BD_PER_PAGE));
      params.set("days_ahead", String(bdDaysAhead));
      if (bdDept !== "all") params.set("department", bdDept);
      if (bdLevel !== "all") params.set("level", bdLevel);
      params.set("sort_by", bdSortBy);
      params.set("sort_order", bdSortOrder);
      if (bdSearch.trim()) params.set("search", bdSearch.trim());
      const res = await fetch(getApiUrl(`/api/v1/users/birthdays?${params.toString()}`), {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error("Failed to load birthdays");
      const data = await res.json();
      setBdItems(data.items ?? []);
      setBdTotal(data.total ?? 0);
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to load birthdays"));
    } finally {
      setBdLoading(false);
    }
  }, [getAccessToken, bdPage, bdDaysAhead, bdDept, bdLevel, bdSortBy, bdSortOrder, bdSearch]);

  useEffect(() => {
    if (activeTab !== "birthdays") return;
    const debounce = setTimeout(() => fetchBirthdays(), bdSearch ? 300 : 0);
    return () => clearTimeout(debounce);
  }, [fetchBirthdays, bdSearch, activeTab]);

  const totalPages = Math.ceil(totalUsers / ITEMS_PER_PAGE);

  const exportUsersPDF = async () => {
    setExportingUsersPdf(true);
    try {
      const token = await getAccessToken();
      const params = new URLSearchParams();
      if (roleFilter !== "all") params.set("role", roleFilter);
      if (deptFilter !== "all") params.set("department", deptFilter);
      if (levelFilter !== "all") params.set("level", levelFilter);
      if (statusFilter !== "all") params.set("status", statusFilter);
      params.set("sort_by", sortBy);
      params.set("sort_order", sortOrder);
      if (searchQuery.trim()) params.set("search", searchQuery.trim());

      const res = await fetch(getApiUrl(`/api/v1/users/export/pdf?${params.toString()}`), {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) await throwApiError(res, "export users PDF");

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `iesa-users-${new Date().toISOString().split("T")[0]}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Users PDF exported");
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to export users PDF"));
    } finally {
      setExportingUsersPdf(false);
    }
  };
  const bdTotalPages = Math.ceil(bdTotal / BD_PER_PAGE);
  const todayCount = useMemo(() => bdItems.filter((b) => b.daysUntil === 0).length, [bdItems]);

  // Reset to page 1 when filter/search changes
  const handleSearch = (v: string) => { setSearchQuery(v); setPage(1); };
  const handleRoleFilter = (v: string) => { setRoleFilter(v); setPage(1); };
  const handleDeptFilter = (v: string) => { setDeptFilter(v); setPage(1); };
  const handleLevelFilter = (v: string) => { setLevelFilter(v); setPage(1); };
  const handleStatusFilter = (v: string) => { setStatusFilter(v); setPage(1); };
  const handleSortBy = (v: "time" | "name" | "level") => { setSortBy(v); setPage(1); };
  const handleSortOrder = (v: "asc" | "desc") => { setSortOrder(v); setPage(1); };
  const handleBdSearch = (v: string) => { setBdSearch(v); setBdPage(1); };
  const handleBdDept = (v: string) => { setBdDept(v); setBdPage(1); };
  const handleBdRange = (v: string) => { setBdDaysAhead(Number(v)); setBdPage(1); };
  const handleBdLevel = (v: string) => { setBdLevel(v); setBdPage(1); };
  const handleBdSortBy = (v: "time" | "name" | "level") => { setBdSortBy(v); setBdPage(1); };
  const handleBdSortOrder = (v: "asc" | "desc") => { setBdSortOrder(v); setBdPage(1); };

  const activeUsers = users.filter((u) => u.isActive !== false).length;
  const externalCount = users.filter((u) => u.department && u.department !== "Industrial Engineering").length;

  /* ── Edit modal handlers ─── */
  const openEdit = (user: User) => {
    setSelectedUser(null);
    setEditUser(user);
    setEditRole((user.role === "admin" || user.role === "exco") ? user.role : "student");
    setEditLevel(user.currentLevel || "");
    setEditAdmissionYear(user.admissionYear ? String(user.admissionYear) : "");
    setEditIsActive(user.isActive !== false);
  };

  const closeEdit = () => {
    setEditUser(null);
    setSaving(false);
  };

  const handleSave = async () => {
    if (!editUser) return;
    setSaving(true);
    const token = await getAccessToken();
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    try {
      // 1. Update academic info if changed
      const academicChanged =
        editLevel !== (editUser.currentLevel || "") ||
        editAdmissionYear !== (editUser.admissionYear ? String(editUser.admissionYear) : "");

      if (academicChanged) {
        const params = new URLSearchParams();
        if (editLevel) params.set("current_level", editLevel);
        if (editAdmissionYear) params.set("admission_year", editAdmissionYear);
        const res = await fetch(
          getApiUrl(`/api/v1/users/${editUser._id}/academic-info?${params}`),
          { method: "PATCH", headers }
        );
        if (!res.ok) await throwApiError(res, "update academic info");
      }

      // 1b. Update role if changed
      const roleChanged = editRole !== (editUser.role || "student");
      if (roleChanged) {
        const res = await fetch(
          getApiUrl(`/api/v1/users/${editUser._id}/role?new_role=${editRole}`),
          { method: "PATCH", headers }
        );
        if (!res.ok) await throwApiError(res, "update user role");
      }

      // 2. Toggle status if changed
      const statusChanged = editIsActive !== (editUser.isActive !== false);
      if (statusChanged) {
        const res = await fetch(
          getApiUrl(`/api/v1/users/${editUser._id}/status?is_active=${editIsActive}`),
          { method: "PATCH", headers }
        );
        if (!res.ok) await throwApiError(res, "update user status");
      }

      toast.success("User updated successfully");
      closeEdit();
      fetchUsers();
      fetchRoleAssignments();
    } catch (err) {
      toast.error(getErrorMessage(err, "Update failed"));
    } finally {
      setSaving(false);
    }
  };

  const openUserDetails = async (user: User) => {
    setSelectedUser(user);
    setViewLoading(true);
    try {
      const token = await getAccessToken();
      const response = await fetch(getApiUrl(`/api/v1/users/${user._id}`), {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!response.ok) {
        await throwApiError(response, "load user details");
        return;
      }
      const data = await response.json();
      setSelectedUser((prev) => ({ ...(prev || user), ...data, id: data.id || data._id }));
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to load user details"));
    } finally {
      setViewLoading(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const token = await getAccessToken();
      const headers: Record<string, string> = {};
      if (token) headers.Authorization = `Bearer ${token}`;

      const response = await fetch(getApiUrl(`/api/v1/users/${deleteTarget._id}`), {
        method: "DELETE",
        headers,
      });
      if (!response.ok) {
        await throwApiError(response, "delete user");
        return;
      }

      toast.success("User deleted successfully");
      setDeleteTarget(null);
      setSelectedUser((prev) => (prev?._id === deleteTarget._id ? null : prev));
      fetchUsers();
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to delete user"));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      <ToolHelpModal toolId="admin-users" isOpen={showHelp} onClose={closeHelp} />
      <div className="flex justify-end mb-3">
        <HelpButton onClick={openHelp} />
      </div>
      {/* ── Header ─────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-end gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate mb-1">
            Administration
          </p>
          <h1 className="font-display font-black text-3xl md:text-4xl text-navy">
            <span className="brush-highlight">User</span> Management
          </h1>
          <p className="text-navy/60 text-sm mt-1">
            Manage all users and their permissions
          </p>
        </div>
        <div className="flex gap-1 p-1 bg-ghost border-[3px] border-navy rounded-2xl">
          <button
            onClick={() => {
              setActiveTab("users");
              setBirthdaysFiltersOpen(false);
            }}
            className={`px-5 py-2 rounded-[10px] text-sm font-bold transition-all ${
              activeTab === "users" ? "bg-navy text-lime" : "text-navy hover:bg-cloud"
            }`}
          >
            All Users
          </button>
          <button
            onClick={() => {
              setActiveTab("birthdays");
              setUsersFiltersOpen(false);
            }}
            className={`px-5 py-2 rounded-[10px] text-sm font-bold transition-all ${
              activeTab === "birthdays" ? "bg-sunny border-2 border-navy text-navy" : "text-navy hover:bg-cloud"
            }`}
          >
            Birthdays
          </button>
        </div>
      </div>

      {activeTab === "users" && (<>
      {/* ── Stats Bento Grid ───────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Total Users — lime accent */}
        <div className="bg-snow border-[3px] border-navy rounded-3xl p-6 press-4 press-black hover:-translate-y-1 transition-all">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate">Total</p>
            <div className="w-10 h-10 rounded-xl bg-lime border-[3px] border-navy flex items-center justify-center">
              <svg aria-hidden="true" className="w-5 h-5 text-navy" viewBox="0 0 24 24" fill="currentColor">
                <path fillRule="evenodd" d="M8.25 6.75a3.75 3.75 0 1 1 7.5 0 3.75 3.75 0 0 1-7.5 0ZM15.75 9.75a3 3 0 1 1 6 0 3 3 0 0 1-6 0ZM2.25 9.75a3 3 0 1 1 6 0 3 3 0 0 1-6 0ZM6.31 15.117A6.745 6.745 0 0 1 12 12a6.745 6.745 0 0 1 6.709 7.498.75.75 0 0 1-.372.568A12.696 12.696 0 0 1 12 21.75c-2.305 0-4.47-.612-6.337-1.684a.75.75 0 0 1-.372-.568 6.787 6.787 0 0 1 1.019-4.38Z" clipRule="evenodd" />
              </svg>
            </div>
          </div>
          <div className="font-display font-black text-4xl text-navy">{totalUsers}</div>
          <span className="text-navy/60 text-xs">Registered users</span>
        </div>

        {/* Active Users — teal accent */}
        <div className="bg-teal border-[3px] border-navy rounded-3xl p-6 shadow-[4px_4px_0_0_#000] rotate-[0.5deg] hover:rotate-0 transition-all">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-snow/60">Active</p>
            <div className="w-10 h-10 rounded-xl bg-snow/20 flex items-center justify-center">
              <svg aria-hidden="true" className="w-5 h-5 text-snow" viewBox="0 0 24 24" fill="currentColor">
                <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm13.36-1.814a.75.75 0 1 0-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 0 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.14-.094l3.75-5.25Z" clipRule="evenodd" />
              </svg>
            </div>
          </div>
          <div className="font-display font-black text-4xl text-snow">{activeUsers}</div>
          <span className="text-snow/70 text-xs">Currently active</span>
        </div>

        {/* External Students — snow card */}
        <div className="bg-snow border-[3px] border-navy rounded-3xl p-6 press-4 press-black hover:-translate-y-1 transition-all">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate">External</p>
            <div className="w-10 h-10 rounded-xl bg-lavender-light flex items-center justify-center">
              <svg aria-hidden="true" className="w-5 h-5 text-lavender" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 21a9.004 9.004 0 0 0 8.716-6.747M12 21a9.004 9.004 0 0 1-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 0 1 7.843 4.582M12 3a8.997 8.997 0 0 0-7.843 4.582m15.686 0A11.953 11.953 0 0 1 12 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0 1 21 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0 1 12 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 0 1 3 12c0-1.605.42-3.113 1.157-4.418" />
              </svg>
            </div>
          </div>
          <div className="font-display font-black text-4xl text-navy">{externalCount}</div>
          <span className="text-navy/60 text-xs">External students (this page)</span>
        </div>
      </div>

      {/* ── Filters & Search ───────────────────────── */}
      <div className="relative" ref={usersFiltersRef}>
        <div className="flex flex-col md:flex-row gap-3">
          <div className="flex-1">
            <div className="relative">
              <svg aria-hidden="true" className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate" viewBox="0 0 24 24" fill="currentColor">
                <path fillRule="evenodd" d="M10.5 3.75a6.75 6.75 0 1 0 0 13.5 6.75 6.75 0 0 0 0-13.5ZM2.25 10.5a8.25 8.25 0 1 1 14.59 5.28l4.69 4.69a.75.75 0 1 1-1.06 1.06l-4.69-4.69A8.25 8.25 0 0 1 2.25 10.5Z" clipRule="evenodd" />
              </svg>
              <input
                type="text"
                placeholder="Search users..."
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-ghost border-[3px] border-navy rounded-2xl text-navy text-sm placeholder:text-slate transition-colors"
              />
            </div>
          </div>

          <button
            type="button"
            onClick={() => setUsersFiltersOpen((prev) => !prev)}
            className="px-5 py-3 bg-snow border-[3px] border-navy rounded-2xl text-navy text-sm font-bold press-3 press-black"
            aria-expanded={usersFiltersOpen}
          >
            Filters
          </button>

          <PermissionGate permission="user:export">
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                const headers = ["Name", "Email", "Department", "Role", "Status"];
                const rows = users.map((u) => [
                  `${u.firstName} ${u.lastName}`,
                  u.email,
                  u.department === "Industrial Engineering" ? "IPE" : (u.department || "External"),
                  (() => {
                    const uid = u._id || u.id || "";
                    const assigned = activePositionsByUserId[uid] || [];
                    if (assigned.length > 0) return assigned.map((item) => item.label).join(" | ");
                    if (u.role === "admin") return "admin";
                    if (u.role === "exco") return "exco";
                    return "student";
                  })(),
                  u.isActive !== false ? "Active" : "Inactive",
                ]);
                const csv = [headers, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
                const blob = new Blob([csv], { type: "text/csv" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `iesa-users-${new Date().toISOString().split("T")[0]}.csv`;
                a.click();
                URL.revokeObjectURL(url);
              }}
              className="px-5 py-3 bg-navy border-[3px] border-lime rounded-2xl text-snow text-sm font-bold flex items-center gap-2 press-3 press-lime transition-all"
              title="Export filtered users as CSV"
            >
              <svg aria-hidden="true" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Export CSV
            </button>
            <button
              onClick={exportUsersPDF}
              disabled={exportingUsersPdf}
              className="px-5 py-3 bg-lime border-[3px] border-navy rounded-2xl text-navy text-sm font-bold flex items-center gap-2 press-3 press-navy transition-all disabled:opacity-50"
              title="Export filtered users as PDF"
            >
              <svg aria-hidden="true" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              {exportingUsersPdf ? "Exporting..." : "Export PDF"}
            </button>
          </div>
          </PermissionGate>
        </div>

        {usersFiltersOpen && (
          <div className="absolute right-0 top-[calc(100%+0.5rem)] z-20 w-full md:w-[760px] bg-snow border-[3px] border-navy rounded-3xl p-4 shadow-[5px_5px_0_0_#000]">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              <select
                value={roleFilter}
                onChange={(e) => handleRoleFilter(e.target.value)}
                aria-label="Filter by role"
                className="px-4 py-3 bg-ghost border-[3px] border-navy rounded-2xl text-navy text-sm appearance-none cursor-pointer"
              >
                <option value="all">All Roles</option>
                <option value="student">Students Only</option>
                <option value="admin">Admins</option>
                <option value="exco">Exco (Account Role)</option>
              </select>

              <select
                value={deptFilter}
                onChange={(e) => handleDeptFilter(e.target.value)}
                aria-label="Filter by department"
                className="px-4 py-3 bg-ghost border-[3px] border-navy rounded-2xl text-navy text-sm appearance-none cursor-pointer"
              >
                <option value="all">All Departments</option>
                <option value="ipe">IPE Students</option>
                <option value="external">External Students</option>
              </select>

              <select
                value={levelFilter}
                onChange={(e) => handleLevelFilter(e.target.value)}
                aria-label="Filter by level"
                className="px-4 py-3 bg-ghost border-[3px] border-navy rounded-2xl text-navy text-sm appearance-none cursor-pointer"
              >
                <option value="all">All Levels</option>
                <option value="100L">100L</option>
                <option value="200L">200L</option>
                <option value="300L">300L</option>
                <option value="400L">400L</option>
                <option value="500L">500L</option>
              </select>

              <select
                value={statusFilter}
                onChange={(e) => handleStatusFilter(e.target.value)}
                aria-label="Filter by status"
                className="px-4 py-3 bg-ghost border-[3px] border-navy rounded-2xl text-navy text-sm appearance-none cursor-pointer"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>

              <select
                value={sortBy}
                onChange={(e) => handleSortBy(e.target.value as "time" | "name" | "level")}
                aria-label="Sort by"
                className="px-4 py-3 bg-ghost border-[3px] border-navy rounded-2xl text-navy text-sm appearance-none cursor-pointer"
              >
                <option value="time">Sort: Time</option>
                <option value="name">Sort: Name</option>
                <option value="level">Sort: Level</option>
              </select>

              <select
                value={sortOrder}
                onChange={(e) => handleSortOrder(e.target.value as "asc" | "desc")}
                aria-label="Sort order"
                className="px-4 py-3 bg-ghost border-[3px] border-navy rounded-2xl text-navy text-sm appearance-none cursor-pointer"
              >
                <option value="desc">Descending</option>
                <option value="asc">Ascending</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* ── Table Section ──────────────────────────── */}
      <div>
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-display font-black text-lg text-navy">User Directory</h2>
          <span className="px-3 py-1 rounded-md bg-cloud text-navy/60 text-xs font-bold">
            {totalUsers} total {totalPages > 1 && `· page ${page}/${totalPages}`}
          </span>
        </div>

        <div className="relative bg-snow border-[3px] border-navy rounded-3xl overflow-hidden shadow-[4px_4px_0_0_#000]">
          {loading && (
            <div className="absolute inset-0 z-10 bg-snow/70 backdrop-blur-[1px] flex items-center justify-center">
              <div className="w-8 h-8 border-[3px] border-navy border-t-transparent rounded-full animate-spin" />
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b-[3px] border-navy bg-ghost">
                  <th scope="col" className="text-left p-4 text-[10px] font-bold uppercase tracking-[0.12em] text-slate">Name</th>
                  <th scope="col" className="text-left p-4 text-[10px] font-bold uppercase tracking-[0.12em] text-slate hidden md:table-cell">Email</th>
                  <th scope="col" className="text-left p-4 text-[10px] font-bold uppercase tracking-[0.12em] text-slate hidden lg:table-cell">Dept</th>
                  <th scope="col" className="text-left p-4 text-[10px] font-bold uppercase tracking-[0.12em] text-slate">Roles</th>
                  <th scope="col" className="text-left p-4 text-[10px] font-bold uppercase tracking-[0.12em] text-slate hidden md:table-cell">Status</th>
                  <th scope="col" className="text-left p-4 text-[10px] font-bold uppercase tracking-[0.12em] text-slate">Actions</th>
                </tr>
              </thead>
              <tbody>
                {!loading && users.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-12 text-center">
                      <div className="w-14 h-14 mx-auto rounded-2xl bg-cloud flex items-center justify-center mb-3">
                        <svg aria-hidden="true" className="w-6 h-6 text-slate" viewBox="0 0 24 24" fill="currentColor">
                          <path fillRule="evenodd" d="M8.25 6.75a3.75 3.75 0 1 1 7.5 0 3.75 3.75 0 0 1-7.5 0ZM15.75 9.75a3 3 0 1 1 6 0 3 3 0 0 1-6 0ZM2.25 9.75a3 3 0 1 1 6 0 3 3 0 0 1-6 0Z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <p className="text-navy/60 text-sm font-medium">No users found</p>
                    </td>
                  </tr>
                ) : (
                  users.map((user) => (
                    <tr
                      key={user.id || user._id}
                      className="border-b-[2px] border-cloud last:border-b-0 hover:bg-ghost/50 transition-colors cursor-pointer"
                      onClick={() => openUserDetails(user)}
                    >
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-lime-light border-[2px] border-navy/10 flex items-center justify-center text-xs font-bold text-navy shrink-0">
                            {user.firstName[0]}{user.lastName[0]}
                          </div>
                          <div>
                            <div className="font-bold text-navy text-sm">
                              {user.firstName} {user.lastName}
                            </div>
                            {(user.currentLevel || user.level) && (
                              <div className="text-xs text-slate mt-0.5">{String(user.currentLevel || user.level).replace(/L$/i, "").replace(/^null$/i, "?")} Level</div>
                            )}
                            <div className="text-xs text-slate mt-0.5 md:hidden truncate max-w-[150px]">
                              {user.email}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="p-4 text-navy/60 text-sm hidden md:table-cell">{user.email}</td>
                      <td className="p-4 hidden lg:table-cell">
                        <span className={`inline-flex items-center px-3 py-1 rounded-md text-xs font-bold ${
                          user.department === "Industrial Engineering"
                            ? "bg-lime-light text-navy"
                            : "bg-lavender-light text-lavender"
                        }`}>
                          {user.department === "Industrial Engineering" ? "IPE" : user.department || "External"}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {(() => {
                            const uid = user._id || user.id || "";
                            const assigned = (activePositionsByUserId[uid] || []).filter(
                              (entry) => !["student", "admin", "super_admin"].includes(entry.position)
                            );
                            const hasExecutivePosition = assigned.some((entry) => EXEC_POSITIONS.has(entry.position));

                            const studentChip = (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-[10px] font-bold bg-lime-light text-navy">
                                student
                              </span>
                            );

                            const adminChip =
                              user.role === "admin" || (activePositionsByUserId[uid] || []).some((entry) => entry.position === "admin" || entry.position === "super_admin")
                                ? (
                                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-[10px] font-bold bg-lavender-light text-lavender">
                                    admin
                                  </span>
                                )
                                : null;

                            const excoChip =
                              hasExecutivePosition
                                  ? (
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-[10px] font-bold bg-coral-light text-coral">
                                      exco
                                    </span>
                                  )
                                  : null;

                            return (
                              <>
                                {studentChip}
                                {adminChip}
                                {excoChip}
                                {assigned.map((entry) => (
                                  <span
                                    key={entry.key}
                                    className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-[10px] font-bold ${getPositionBadge(entry.position)}`}
                                  >
                                    {entry.label}
                                  </span>
                                ))}
                              </>
                            );
                          })()}
                        </div>
                      </td>
                      <td className="p-4 hidden md:table-cell">
                        <span className={`inline-flex items-center px-3 py-1 rounded-md text-xs font-bold ${
                          user.isActive !== false
                            ? "bg-teal-light text-teal"
                            : "bg-cloud text-slate"
                        }`}>
                          {user.isActive !== false ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              openUserDetails(user);
                            }}
                            className="px-3 py-1.5 rounded-xl text-xs font-bold text-navy bg-ghost border-[2px] border-navy/20 hover:border-navy transition-all"
                          >
                            View
                          </button>
                          <PermissionGate anyPermission={["user:edit", "user:edit_academic", "user:edit_role"]}>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                openEdit(user);
                              }}
                              className="px-3 py-1.5 rounded-xl text-xs font-bold text-navy/60 hover:text-navy hover:bg-cloud border-[2px] border-transparent hover:border-navy/10 transition-all"
                            >
                              Edit
                            </button>
                          </PermissionGate>
                          <PermissionGate permission="user:delete">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteTarget(user);
                              }}
                              className="px-3 py-1.5 rounded-xl text-xs font-bold text-coral bg-coral-light border-[2px] border-coral/50 hover:bg-coral hover:text-snow transition-all"
                            >
                              Delete
                            </button>
                          </PermissionGate>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
        <Pagination page={page} totalPages={totalPages} onPage={setPage} className="mt-5" />
      </div>
      </>)}

      {/* ── Birthdays Tab ────────────────────────── */}
      {activeTab === "birthdays" && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-snow border-[3px] border-navy rounded-3xl p-5 shadow-[4px_4px_0_0_#000]">
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate">Showing</p>
              <p className="font-display font-black text-4xl text-navy mt-1">{bdTotal}</p>
              <p className="text-xs text-slate">Within next {bdDaysAhead} days</p>
            </div>
            <div className="bg-lime border-[3px] border-navy rounded-3xl p-5 shadow-[4px_4px_0_0_#0F0F2D]">
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-navy/60">Today</p>
              <p className="font-display font-black text-4xl text-navy mt-1">{todayCount}</p>
              <p className="text-xs text-navy/70">Birthdays today</p>
            </div>
            <div className="bg-snow border-[3px] border-navy rounded-3xl p-5 shadow-[4px_4px_0_0_#000]">
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate">Window</p>
              <p className="font-display font-black text-4xl text-navy mt-1">{bdDaysAhead}</p>
              <p className="text-xs text-slate">Days ahead</p>
            </div>
          </div>

          <div className="relative" ref={birthdaysFiltersRef}>
            <div className="flex flex-col md:flex-row gap-3">
              <div className="flex-1">
                <input
                  type="text"
                  placeholder="Search by name, email, or matric number..."
                  value={bdSearch}
                  onChange={(e) => handleBdSearch(e.target.value)}
                  className="w-full px-4 py-3 bg-ghost border-[3px] border-navy rounded-2xl text-navy text-sm placeholder:text-slate"
                />
              </div>
              <button
                type="button"
                onClick={() => setBirthdaysFiltersOpen((prev) => !prev)}
                className="px-5 py-3 bg-snow border-[3px] border-navy rounded-2xl text-navy text-sm font-bold press-3 press-black"
                aria-expanded={birthdaysFiltersOpen}
              >
                Filters
              </button>
            </div>

            {birthdaysFiltersOpen && (
              <div className="absolute right-0 top-[calc(100%+0.5rem)] z-20 w-full md:w-[760px] bg-snow border-[3px] border-navy rounded-3xl p-4 shadow-[5px_5px_0_0_#000]">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  <select
                    value={bdDept}
                    onChange={(e) => handleBdDept(e.target.value)}
                    aria-label="Filter by department"
                    className="px-4 py-3 bg-ghost border-[3px] border-navy rounded-2xl text-sm text-navy"
                  >
                    <option value="all">All Departments</option>
                    <option value="ipe">IPE Students</option>
                    <option value="external">External Students</option>
                  </select>
                  <select
                    value={String(bdDaysAhead)}
                    onChange={(e) => handleBdRange(e.target.value)}
                    aria-label="Date range"
                    className="px-4 py-3 bg-ghost border-[3px] border-navy rounded-2xl text-sm text-navy"
                  >
                    <option value="30">Next 30 days</option>
                    <option value="60">Next 60 days</option>
                    <option value="90">Next 90 days</option>
                    <option value="180">Next 180 days</option>
                    <option value="365">Next 365 days</option>
                  </select>
                  <select
                    value={bdLevel}
                    onChange={(e) => handleBdLevel(e.target.value)}
                    aria-label="Filter birthdays by level"
                    className="px-4 py-3 bg-ghost border-[3px] border-navy rounded-2xl text-sm text-navy"
                  >
                    <option value="all">All Levels</option>
                    <option value="100L">100L</option>
                    <option value="200L">200L</option>
                    <option value="300L">300L</option>
                    <option value="400L">400L</option>
                    <option value="500L">500L</option>
                  </select>
                  <select
                    value={bdSortBy}
                    onChange={(e) => handleBdSortBy(e.target.value as "time" | "name" | "level")}
                    aria-label="Sort birthdays by"
                    className="px-4 py-3 bg-ghost border-[3px] border-navy rounded-2xl text-sm text-navy"
                  >
                    <option value="time">Sort: Time</option>
                    <option value="name">Sort: Name</option>
                    <option value="level">Sort: Level</option>
                  </select>
                  <select
                    value={bdSortOrder}
                    onChange={(e) => handleBdSortOrder(e.target.value as "asc" | "desc")}
                    aria-label="Birthday sort order"
                    className="px-4 py-3 bg-ghost border-[3px] border-navy rounded-2xl text-sm text-navy"
                  >
                    <option value="asc">Ascending</option>
                    <option value="desc">Descending</option>
                  </select>
                </div>
              </div>
            )}
          </div>

          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-display font-black text-lg text-navy">Birthday List</h2>
              <span className="px-3 py-1 rounded-md bg-cloud text-navy/60 text-xs font-bold">
                {bdTotal} total{bdTotalPages > 1 && ` · page ${bdPage}/${bdTotalPages}`}
              </span>
            </div>
            <div className="relative bg-snow border-[3px] border-navy rounded-3xl overflow-hidden shadow-[4px_4px_0_0_#000]">
              {bdLoading && (
                <div className="absolute inset-0 z-10 bg-snow/70 backdrop-blur-[1px] flex items-center justify-center">
                  <div className="w-8 h-8 border-[3px] border-navy border-t-transparent rounded-full animate-spin" />
                </div>
              )}
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b-[3px] border-navy bg-ghost">
                      <th scope="col" className="text-left p-4 text-[10px] font-bold uppercase tracking-[0.12em] text-slate">Student</th>
                      <th scope="col" className="text-left p-4 text-[10px] font-bold uppercase tracking-[0.12em] text-slate hidden md:table-cell">Email</th>
                      <th scope="col" className="text-left p-4 text-[10px] font-bold uppercase tracking-[0.12em] text-slate">Birthday</th>
                      <th scope="col" className="text-left p-4 text-[10px] font-bold uppercase tracking-[0.12em] text-slate hidden lg:table-cell">Department</th>
                    </tr>
                  </thead>
                  <tbody>
                    {!bdLoading && bdItems.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="p-12 text-center text-sm text-slate">No birthdays found in this window.</td>
                      </tr>
                    ) : (
                      bdItems.map((item) => {
                        const dueLabel = item.daysUntil === 0 ? "Today" : item.daysUntil === 1 ? "Tomorrow" : `In ${item.daysUntil} days`;
                        return (
                          <tr key={item.id} className="border-b-2 border-cloud last:border-b-0 hover:bg-ghost/50 transition-colors">
                            <td className="p-4">
                              <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl bg-lime-light border-2 border-navy/20 flex items-center justify-center text-xs font-bold text-navy shrink-0">
                                  {item.firstName?.[0] || "?"}{item.lastName?.[0] || ""}
                                </div>
                                <div className="min-w-0">
                                  <p className="text-sm font-bold text-navy truncate">{item.firstName} {item.lastName}</p>
                                  <p className="text-xs text-slate truncate">{item.currentLevel || "Student"}{item.matricNumber ? ` • ${item.matricNumber}` : ""}</p>
                                  {item.activeRoles && item.activeRoles.length > 0 && (
                                    <div className="flex flex-wrap gap-1 mt-1.5">
                                      {item.activeRoles.slice(0, 3).map((roleLabel) => (
                                        <span
                                          key={roleLabel}
                                          className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-cloud text-navy"
                                          title={roleLabel}
                                        >
                                          {roleLabel}
                                        </span>
                                      ))}
                                      {item.activeRoles.length > 3 && (
                                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-ghost text-slate">
                                          +{item.activeRoles.length - 3} more
                                        </span>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="p-4 text-sm text-navy-muted hidden md:table-cell">{item.email}</td>
                            <td className="p-4">
                              <div className="flex flex-col">
                                <span className="text-sm font-bold text-navy">{formatBirthdayDate(item.birthdayMonth, item.birthdayDay)}</span>
                                <span className="text-xs text-slate">{dueLabel}</span>
                              </div>
                            </td>
                            <td className="p-4 hidden lg:table-cell">
                              <span className="inline-flex items-center px-3 py-1 rounded-md text-xs font-bold bg-cloud text-navy">
                                {item.department || "—"}
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            <Pagination page={bdPage} totalPages={bdTotalPages} onPage={setBdPage} className="mt-5" />
          </div>
        </>
      )}

      {/* ── Edit User Modal ──────────────────────── */}
      <Modal
        isOpen={!!editUser}
        onClose={closeEdit}
        title="Edit User"
        description={editUser ? `${editUser.firstName} ${editUser.lastName} · ${editUser.email}` : ""}
        size="md"
        footer={
          <>
            <button
              onClick={closeEdit}
              className="px-5 py-2.5 rounded-xl text-sm font-bold text-navy border-[2px] border-navy/20 hover:bg-cloud transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-5 py-2.5 bg-lime border-[3px] border-navy rounded-xl text-sm font-bold text-navy press-3 press-navy disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save Changes"}
            </button>
          </>
        }
      >
        <div className="space-y-6">
          <PermissionGate permission="user:edit_role">
            <div>
              <h3 className="font-display text-sm text-navy mb-3">Role</h3>
              <div>
                <label htmlFor="edit-role" className="block text-xs font-bold text-slate mb-1.5">Account Role</label>
                <select
                  id="edit-role"
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value as "student" | "exco" | "admin")}
                  className="w-full px-3 py-2.5 bg-ghost border-[2px] border-navy/20 rounded-xl text-navy text-sm"
                >
                  <option value="student">Student</option>
                  <option value="exco">Exco (Account)</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            </div>
          </PermissionGate>

          {/* Academic Info */}
          <PermissionGate permission="user:edit_academic">
            <div>
              <h3 className="font-display text-sm text-navy mb-3">Academic Information</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="edit-level" className="block text-xs font-bold text-slate mb-1.5">Current Level</label>
                  <select
                    id="edit-level"
                    value={editLevel}
                    onChange={(e) => setEditLevel(e.target.value)}
                    className="w-full px-3 py-2.5 bg-ghost border-[2px] border-navy/20 rounded-xl text-navy text-sm"
                  >
                    <option value="">Not set</option>
                    <option value="100L">100L</option>
                    <option value="200L">200L</option>
                    <option value="300L">300L</option>
                    <option value="400L">400L</option>
                    <option value="500L">500L</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="edit-admission" className="block text-xs font-bold text-slate mb-1.5">Admission Year</label>
                  <input
                    id="edit-admission"
                    type="number"
                    min={2000}
                    max={2030}
                    placeholder="e.g. 2023"
                    value={editAdmissionYear}
                    onChange={(e) => setEditAdmissionYear(e.target.value)}
                    className="w-full px-3 py-2.5 bg-ghost border-[2px] border-navy/20 rounded-xl text-navy text-sm placeholder:text-slate"
                  />
                </div>
              </div>
            </div>
          </PermissionGate>

          {/* Status Toggle */}
          <PermissionGate permission="user:edit">
            <div>
              <h3 className="font-display text-sm text-navy mb-3">Account Status</h3>
              <button
                type="button"
                onClick={() => setEditIsActive(!editIsActive)}
                className={`flex items-center gap-3 w-full p-4 rounded-2xl border-[2px] transition-colors ${
                  editIsActive
                    ? "bg-teal-light border-teal"
                    : "bg-cloud border-navy/20"
                }`}
              >
                <div className={`w-10 h-6 rounded-full relative transition-colors ${
                  editIsActive ? "bg-teal" : "bg-slate/30"
                }`}>
                  <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-snow shadow transition-transform ${
                    editIsActive ? "left-[18px]" : "left-0.5"
                  }`} />
                </div>
                <span className="text-sm font-bold text-navy">
                  {editIsActive ? "Active" : "Inactive"}
                </span>
                <span className="text-xs text-slate ml-auto">
                  {editIsActive ? "User can sign in" : "User is locked out"}
                </span>
              </button>
            </div>
          </PermissionGate>
        </div>
      </Modal>

      {/* ── View User Modal ──────────────────────── */}
      <Modal
        isOpen={!!selectedUser}
        onClose={() => setSelectedUser(null)}
        title="User Details"
        description={selectedUser ? `${selectedUser.firstName} ${selectedUser.lastName} · ${selectedUser.email}` : ""}
        size="md"
        footer={
          <>
            <button
              onClick={() => setSelectedUser(null)}
              className="px-5 py-2.5 rounded-xl text-sm font-bold text-navy border-[2px] border-navy/20 hover:bg-cloud transition-colors"
            >
              Close
            </button>
            <PermissionGate anyPermission={["user:edit", "user:edit_academic", "user:edit_role"]}>
              <button
                onClick={() => selectedUser && openEdit(selectedUser)}
                className="px-5 py-2.5 bg-lime border-[3px] border-navy rounded-xl text-sm font-bold text-navy press-3 press-navy"
              >
                Edit User
              </button>
            </PermissionGate>
          </>
        }
      >
        {selectedUser && (
          <div className="space-y-4">
            {viewLoading && <p className="text-xs font-bold text-slate uppercase tracking-wider">Loading latest details…</p>}
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="bg-ghost rounded-xl p-3"><p className="text-xs text-slate">Matric Number</p><p className="font-bold text-navy">{selectedUser.matricNumber || "—"}</p></div>
              <div className="bg-ghost rounded-xl p-3"><p className="text-xs text-slate">Phone</p><p className="font-bold text-navy">{selectedUser.phone || "—"}</p></div>
              <div className="bg-ghost rounded-xl p-3"><p className="text-xs text-slate">Department</p><p className="font-bold text-navy">{selectedUser.department || "—"}</p></div>
              <div className="bg-ghost rounded-xl p-3"><p className="text-xs text-slate">Roles</p><p className="font-bold text-navy">{(() => {
                const uid = selectedUser._id || selectedUser.id || "";
                const assigned = activePositionsByUserId[uid] || [];
                if (assigned.length > 0) return assigned.map((item) => item.label).join(", ");
                return selectedUser.role || "—";
              })()}</p></div>
              <div className="bg-ghost rounded-xl p-3"><p className="text-xs text-slate">Current Level</p><p className="font-bold text-navy">{selectedUser.currentLevel || "—"}</p></div>
              <div className="bg-ghost rounded-xl p-3"><p className="text-xs text-slate">Admission Year</p><p className="font-bold text-navy">{selectedUser.admissionYear || "—"}</p></div>
              <div className="bg-ghost rounded-xl p-3"><p className="text-xs text-slate">Date of Birth</p><p className="font-bold text-navy">{selectedUser.dateOfBirth ? new Date(selectedUser.dateOfBirth).toLocaleDateString() : "—"}</p></div>
              <div className="bg-ghost rounded-xl p-3"><p className="text-xs text-slate">Status</p><p className="font-bold text-navy">{selectedUser.isActive !== false ? "Active" : "Inactive"}</p></div>
              <div className="bg-ghost rounded-xl p-3"><p className="text-xs text-slate">Email Verified</p><p className="font-bold text-navy">{selectedUser.emailVerified ? "Yes" : "No"}</p></div>
              <div className="bg-ghost rounded-xl p-3"><p className="text-xs text-slate">Onboarding</p><p className="font-bold text-navy">{selectedUser.hasCompletedOnboarding ? "Completed" : "Incomplete"}</p></div>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => !deleting && setDeleteTarget(null)}
        onConfirm={handleDeleteUser}
        title="Delete User"
        message={`Delete ${deleteTarget?.firstName || "this"} ${deleteTarget?.lastName || "user"}? This action is permanent, removes related user data, and anonymizes financial records kept for audit.`}
        confirmLabel="Delete"
        variant="danger"
        isLoading={deleting}
      />
    </div>
  );
}

export default withAuth(AdminUsersPage, {
  requiredPermission: "user:view_all",
});