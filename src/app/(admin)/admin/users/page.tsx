"use client";

import { useState } from "react";

export default function AdminUsersPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");

  return (
    <div className="p-4 md:p-6 lg:p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl md:text-4xl font-heading font-bold text-[var(--foreground)] mb-2">
          User Management
        </h1>
        <p className="text-[var(--foreground)]/60">
          Manage all users and their permissions
        </p>
      </div>

      {/* Filters & Search */}
      <div className="mb-6 flex flex-col md:flex-row gap-4">
        <div className="flex-1">
          <div className="relative">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-[var(--foreground)]/40"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search users..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-lg bg-[var(--glass-bg)] backdrop-blur-[var(--glass-blur)] border border-[var(--glass-border)] text-[var(--foreground)] placeholder:text-[var(--foreground)]/40 focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
            />
          </div>
        </div>

        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="px-4 py-2 rounded-lg bg-[var(--glass-bg)] backdrop-blur-[var(--glass-blur)] border border-[var(--glass-border)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
        >
          <option value="all">All Roles</option>
          <option value="student">Students</option>
          <option value="admin">Admins</option>
        </select>

        <button className="px-6 py-2 rounded-lg bg-[var(--primary)] text-white font-medium hover:opacity-90 transition-opacity">
          Add User
        </button>
      </div>

      {/* Users Table */}
      <div className="rounded-xl bg-[var(--glass-bg)] backdrop-blur-[var(--glass-blur)] border border-[var(--glass-border)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--glass-border)]">
                <th className="text-left p-4 text-sm font-semibold text-[var(--foreground)]/80">Name</th>
                <th className="text-left p-4 text-sm font-semibold text-[var(--foreground)]/80">Email</th>
                <th className="text-left p-4 text-sm font-semibold text-[var(--foreground)]/80">Role</th>
                <th className="text-left p-4 text-sm font-semibold text-[var(--foreground)]/80">Status</th>
                <th className="text-left p-4 text-sm font-semibold text-[var(--foreground)]/80">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={5} className="p-8 text-center text-[var(--foreground)]/60">
                  User list coming soon...
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
