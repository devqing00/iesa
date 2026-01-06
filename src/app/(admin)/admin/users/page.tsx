"use client";

import { useState, useEffect } from "react";

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

export default function AdminUsersPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const response = await fetch("/api/v1/users");
      if (response.ok) {
        const data = await response.json();
        const mappedData = data.map((item: User & { _id?: string }) => ({
          ...item,
          id: item.id || item._id,
        }));
        setUsers(mappedData);
      }
    } catch (error) {
      console.error("Error fetching users:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      user.firstName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.lastName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = roleFilter === "all" || user.role === roleFilter;
    return matchesSearch && matchesRole;
  });

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
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
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
                <th className="text-left p-4 text-sm font-semibold text-[var(--foreground)]/80">
                  Name
                </th>
                <th className="text-left p-4 text-sm font-semibold text-[var(--foreground)]/80">
                  Email
                </th>
                <th className="text-left p-4 text-sm font-semibold text-[var(--foreground)]/80">
                  Role
                </th>
                <th className="text-left p-4 text-sm font-semibold text-[var(--foreground)]/80">
                  Status
                </th>
                <th className="text-left p-4 text-sm font-semibold text-[var(--foreground)]/80">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan={5}
                    className="p-8 text-center text-[var(--foreground)]/60"
                  >
                    Loading users...
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="p-8 text-center text-[var(--foreground)]/60"
                  >
                    No users found
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => (
                  <tr
                    key={user.id}
                    className="border-b border-[var(--glass-border)] hover:bg-[var(--glass-bg)]/50 transition-colors"
                  >
                    <td className="p-4">
                      <div className="font-medium text-[var(--foreground)]">
                        {user.firstName} {user.lastName}
                      </div>
                      {user.level && (
                        <div className="text-sm text-[var(--foreground)]/60">
                          {user.level} Level
                        </div>
                      )}
                    </td>
                    <td className="p-4 text-[var(--foreground)]/80">
                      {user.email}
                    </td>
                    <td className="p-4">
                      <span
                        className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                          user.role === "admin"
                            ? "bg-purple-500/10 text-purple-500"
                            : "bg-blue-500/10 text-blue-500"
                        }`}
                      >
                        {user.role}
                      </span>
                    </td>
                    <td className="p-4">
                      <span
                        className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                          user.isActive !== false
                            ? "bg-green-500/10 text-green-500"
                            : "bg-red-500/10 text-red-500"
                        }`}
                      >
                        {user.isActive !== false ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="p-4">
                      <button className="text-[var(--primary)] hover:underline text-sm">
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
    </div>
  );
}
