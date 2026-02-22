"use client";

import { useState, useEffect, useCallback } from "react";
import { getApiUrl } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import Pagination from "@/components/ui/Pagination";

/* ─── Types ──────────────────────────────── */

interface User {
  _id: string;
  id?: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  level?: number;
  department?: string;
  isActive?: boolean;
}

/* ─── Component ──────────────────────────── */

export default function AdminUsersPage() {
  const { getAccessToken } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const ITEMS_PER_PAGE = 15;

  const fetchUsers = useCallback(async () => {
    try {
      const token = await getAccessToken();
      const response = await fetch(getApiUrl("/api/v1/users/"), {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (response.ok) {
        const data = await response.json();
        const mappedData = data.map((item: User & { _id?: string }) => ({
          ...item,
          id: item.id || item._id,
        }));
        setUsers(mappedData);
      }
    } catch {
      toast.error("Failed to load users");
    } finally {
      setLoading(false);
    }
  }, [getAccessToken]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      user.firstName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.lastName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = roleFilter === "all" || user.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const totalPages = Math.ceil(filteredUsers.length / ITEMS_PER_PAGE);
  const paginatedUsers = filteredUsers.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  // Reset to page 1 when filter/search changes
  const handleSearch = (v: string) => { setSearchQuery(v); setPage(1); };
  const handleRoleFilter = (v: string) => { setRoleFilter(v); setPage(1); };

  const totalUsers = users.length;
  const activeUsers = users.filter((u) => u.isActive !== false).length;
  const adminCount = users.filter((u) => u.role === "admin").length;

  return (
    <div className="max-w-7xl mx-auto space-y-8">
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
      </div>

      {/* ── Stats Bento Grid ───────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Total Users — lime accent */}
        <div className="bg-snow border-[4px] border-navy rounded-3xl p-6 press-4 press-black hover:-translate-y-1 transition-all">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate">Total</p>
            <div className="w-10 h-10 rounded-xl bg-lime border-[3px] border-navy flex items-center justify-center">
              <svg className="w-5 h-5 text-navy" viewBox="0 0 24 24" fill="currentColor">
                <path fillRule="evenodd" d="M8.25 6.75a3.75 3.75 0 1 1 7.5 0 3.75 3.75 0 0 1-7.5 0ZM15.75 9.75a3 3 0 1 1 6 0 3 3 0 0 1-6 0ZM2.25 9.75a3 3 0 1 1 6 0 3 3 0 0 1-6 0ZM6.31 15.117A6.745 6.745 0 0 1 12 12a6.745 6.745 0 0 1 6.709 7.498.75.75 0 0 1-.372.568A12.696 12.696 0 0 1 12 21.75c-2.305 0-4.47-.612-6.337-1.684a.75.75 0 0 1-.372-.568 6.787 6.787 0 0 1 1.019-4.38Z" clipRule="evenodd" />
              </svg>
            </div>
          </div>
          <div className="font-display font-black text-4xl text-navy">{totalUsers}</div>
          <span className="text-navy/60 text-xs">Registered users</span>
        </div>

        {/* Active Users — teal accent */}
        <div className="bg-teal border-[4px] border-navy rounded-3xl p-6 shadow-[4px_4px_0_0_#000] rotate-[0.5deg] hover:rotate-0 transition-all">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-snow/60">Active</p>
            <div className="w-10 h-10 rounded-xl bg-snow/20 flex items-center justify-center">
              <svg className="w-5 h-5 text-snow" viewBox="0 0 24 24" fill="currentColor">
                <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm13.36-1.814a.75.75 0 1 0-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 0 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.14-.094l3.75-5.25Z" clipRule="evenodd" />
              </svg>
            </div>
          </div>
          <div className="font-display font-black text-4xl text-snow">{activeUsers}</div>
          <span className="text-snow/70 text-xs">Currently active</span>
        </div>

        {/* Admins — snow card */}
        <div className="bg-snow border-[4px] border-navy rounded-3xl p-6 press-4 press-black hover:-translate-y-1 transition-all">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate">Admins</p>
            <div className="w-10 h-10 rounded-xl bg-lavender-light flex items-center justify-center">
              <svg className="w-5 h-5 text-lavender" viewBox="0 0 24 24" fill="currentColor">
                <path fillRule="evenodd" d="M12.516 2.17a.75.75 0 0 0-1.032 0 11.209 11.209 0 0 1-7.877 3.08.75.75 0 0 0-.722.515A12.74 12.74 0 0 0 2.25 9.75c0 5.942 4.064 10.933 9.563 12.348a.749.749 0 0 0 .374 0c5.499-1.415 9.563-6.406 9.563-12.348 0-1.39-.223-2.73-.635-3.985a.75.75 0 0 0-.722-.516l-.143.001c-2.996 0-5.717-1.17-7.734-3.08Zm3.094 8.016a.75.75 0 1 0-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 0 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.14-.094l3.75-5.25Z" clipRule="evenodd" />
              </svg>
            </div>
          </div>
          <div className="font-display font-black text-4xl text-navy">{adminCount}</div>
          <span className="text-navy/60 text-xs">Admin accounts</span>
        </div>
      </div>

      {/* ── Filters & Search ───────────────────────── */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="flex-1">
          <div className="relative">
            <svg className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate" viewBox="0 0 24 24" fill="currentColor">
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

        <select
          value={roleFilter}
          onChange={(e) => handleRoleFilter(e.target.value)}
          aria-label="Filter by role"
          className="px-5 py-3 bg-ghost border-[3px] border-navy rounded-2xl text-navy text-sm appearance-none cursor-pointer"
        >
          <option value="all">All Roles</option>
          <option value="student">Students</option>
          <option value="admin">Admins</option>
        </select>
      </div>

      {/* ── Table Section ──────────────────────────── */}
      <div>
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-display font-black text-lg text-navy">User Directory</h2>
          <span className="px-3 py-1 rounded-full bg-cloud text-navy/60 text-xs font-bold">
            {filteredUsers.length} of {totalUsers} {totalPages > 1 && `· page ${page}/${totalPages}`}
          </span>
        </div>

        <div className="bg-snow border-[4px] border-navy rounded-3xl overflow-hidden shadow-[4px_4px_0_0_#000]">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b-[3px] border-navy bg-ghost">
                  <th scope="col" className="text-left p-4 text-[10px] font-bold uppercase tracking-[0.12em] text-slate">Name</th>
                  <th scope="col" className="text-left p-4 text-[10px] font-bold uppercase tracking-[0.12em] text-slate hidden md:table-cell">Email</th>
                  <th scope="col" className="text-left p-4 text-[10px] font-bold uppercase tracking-[0.12em] text-slate">Role</th>
                  <th scope="col" className="text-left p-4 text-[10px] font-bold uppercase tracking-[0.12em] text-slate hidden md:table-cell">Status</th>
                  <th scope="col" className="text-left p-4 text-[10px] font-bold uppercase tracking-[0.12em] text-slate">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={5} className="p-12 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-10 h-10 border-[3px] border-navy border-t-transparent rounded-full animate-spin" />
                        <span className="text-navy/60 text-sm">Loading users...</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-12 text-center">
                      <div className="w-14 h-14 mx-auto rounded-2xl bg-cloud flex items-center justify-center mb-3">
                        <svg className="w-6 h-6 text-slate" viewBox="0 0 24 24" fill="currentColor">
                          <path fillRule="evenodd" d="M8.25 6.75a3.75 3.75 0 1 1 7.5 0 3.75 3.75 0 0 1-7.5 0ZM15.75 9.75a3 3 0 1 1 6 0 3 3 0 0 1-6 0ZM2.25 9.75a3 3 0 1 1 6 0 3 3 0 0 1-6 0Z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <p className="text-navy/60 text-sm font-medium">No users found</p>
                    </td>
                  </tr>
                ) : (
                  paginatedUsers.map((user) => (
                    <tr key={user.id} className="border-b-[2px] border-cloud last:border-b-0 hover:bg-ghost/50 transition-colors">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-lime-light border-[2px] border-navy/10 flex items-center justify-center text-xs font-bold text-navy shrink-0">
                            {user.firstName[0]}{user.lastName[0]}
                          </div>
                          <div>
                            <div className="font-bold text-navy text-sm">
                              {user.firstName} {user.lastName}
                            </div>
                            {user.level && (
                              <div className="text-xs text-slate mt-0.5">{user.level} Level</div>
                            )}
                            <div className="text-xs text-slate mt-0.5 md:hidden truncate max-w-[150px]">
                              {user.email}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="p-4 text-navy/60 text-sm hidden md:table-cell">{user.email}</td>
                      <td className="p-4">
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${
                          user.role === "admin"
                            ? "bg-lavender-light text-lavender"
                            : user.role === "exco"
                            ? "bg-coral-light text-coral"
                            : "bg-cloud text-navy/60"
                        }`}>
                          {user.role}
                        </span>
                      </td>
                      <td className="p-4 hidden md:table-cell">
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${
                          user.isActive !== false
                            ? "bg-teal-light text-teal"
                            : "bg-cloud text-slate"
                        }`}>
                          {user.isActive !== false ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="p-4">
                        <button className="px-4 py-1.5 rounded-xl text-xs font-bold text-navy/60 hover:text-navy hover:bg-cloud border-[2px] border-transparent hover:border-navy/10 transition-all">
                          Edit
                        </button>
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
    </div>
  );
}
