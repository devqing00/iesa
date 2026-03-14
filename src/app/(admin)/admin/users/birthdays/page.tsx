"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import Pagination from "@/components/ui/Pagination";
import { useAuth } from "@/context/AuthContext";
import { getApiUrl } from "@/lib/api";
import { getErrorMessage } from "@/lib/adminApiError";
import { withAuth } from "@/lib/withAuth";

interface BirthdayUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  matricNumber?: string;
  currentLevel?: string;
  department?: string;
  daysUntil: number;
  birthdayMonth: number;
  birthdayDay: number;
  nextBirthday: string;
}

function formatBirthdayDate(month: number, day: number): string {
  const date = new Date(2024, month - 1, day);
  return date.toLocaleDateString("en-NG", { month: "short", day: "numeric" });
}

function AdminUsersBirthdaysPage() {
  const { getAccessToken } = useAuth();

  const [searchQuery, setSearchQuery] = useState("");
  const [deptFilter, setDeptFilter] = useState("all");
  const [daysAhead, setDaysAhead] = useState(90);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filtersRef = useRef<HTMLDivElement>(null);

  const [items, setItems] = useState<BirthdayUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);

  const [page, setPage] = useState(1);
  const ITEMS_PER_PAGE = 20;

  const fetchBirthdays = useCallback(async () => {
    setLoading(true);
    try {
      const token = await getAccessToken();
      const params = new URLSearchParams();
      params.set("limit", String(ITEMS_PER_PAGE));
      params.set("skip", String((page - 1) * ITEMS_PER_PAGE));
      params.set("days_ahead", String(daysAhead));
      if (deptFilter !== "all") params.set("department", deptFilter);
      if (searchQuery.trim()) params.set("search", searchQuery.trim());

      const response = await fetch(getApiUrl(`/api/v1/users/birthdays?${params.toString()}`), {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (!response.ok) {
        throw new Error("Failed to load birthdays");
      }

      const data = await response.json();
      setItems(data.items ?? []);
      setTotal(data.total ?? 0);
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to load birthdays"));
    } finally {
      setLoading(false);
    }
  }, [daysAhead, deptFilter, getAccessToken, page, searchQuery]);

  useEffect(() => {
    const debounce = setTimeout(() => fetchBirthdays(), searchQuery ? 300 : 0);
    return () => clearTimeout(debounce);
  }, [fetchBirthdays, searchQuery]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (filtersRef.current && !filtersRef.current.contains(target)) {
        setFiltersOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setFiltersOpen(false);
      }
    }

    if (filtersOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleEscape);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [filtersOpen]);

  const totalPages = Math.ceil(total / ITEMS_PER_PAGE);

  const todayCount = useMemo(() => items.filter((item) => item.daysUntil === 0).length, [items]);

  const handleSearch = (value: string) => {
    setSearchQuery(value);
    setPage(1);
  };

  const handleDeptFilter = (value: string) => {
    setDeptFilter(value);
    setPage(1);
  };

  const handleRange = (value: string) => {
    setDaysAhead(Number(value));
    setPage(1);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-7">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate mb-1">Admin · Users</p>
          <h1 className="font-display font-black text-3xl md:text-4xl text-navy">
            <span className="brush-highlight">Birthdays</span> List
          </h1>
          <p className="text-slate text-sm mt-1">Upcoming student birthdays in your selected window.</p>
        </div>
        <Link
          href="/admin/users"
          className="px-4 py-2.5 rounded-2xl bg-snow border-[3px] border-navy text-navy text-sm font-bold press-3 press-black"
        >
          Back to Users
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-snow border-[3px] border-navy rounded-3xl p-5 shadow-[4px_4px_0_0_#000]">
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate">Showing</p>
          <p className="font-display font-black text-4xl text-navy mt-1">{total}</p>
          <p className="text-xs text-slate">Within next {daysAhead} days</p>
        </div>
        <div className="bg-lime border-[3px] border-navy rounded-3xl p-5 shadow-[4px_4px_0_0_#0F0F2D]">
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-navy/60">Today</p>
          <p className="font-display font-black text-4xl text-navy mt-1">{todayCount}</p>
          <p className="text-xs text-navy/70">On this page</p>
        </div>
        <div className="bg-snow border-[3px] border-navy rounded-3xl p-5 shadow-[4px_4px_0_0_#000]">
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate">Window</p>
          <p className="font-display font-black text-4xl text-navy mt-1">{daysAhead}</p>
          <p className="text-xs text-slate">Days ahead</p>
        </div>
      </div>

      <div className="relative" ref={filtersRef}>
        <div className="flex flex-col md:flex-row gap-3">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search by name, email, or matric number..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              className="w-full px-4 py-3 bg-ghost border-[3px] border-navy rounded-2xl text-navy text-sm placeholder:text-slate"
            />
          </div>

          <button
            type="button"
            onClick={() => setFiltersOpen((prev) => !prev)}
            className="px-5 py-3 bg-snow border-[3px] border-navy rounded-2xl text-navy text-sm font-bold press-3 press-black"
            aria-expanded={filtersOpen ? "true" : "false"}
          >
            Filters
          </button>
        </div>

        {filtersOpen && (
          <div className="absolute right-0 top-[calc(100%+0.5rem)] z-20 w-full md:w-[520px] bg-snow border-[3px] border-navy rounded-3xl p-4 shadow-[5px_5px_0_0_#000]">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <select
                value={deptFilter}
                onChange={(e) => handleDeptFilter(e.target.value)}
                aria-label="Filter by department"
                className="px-4 py-3 bg-ghost border-[3px] border-navy rounded-2xl text-sm text-navy"
              >
                <option value="all">All Departments</option>
                <option value="ipe">IPE Students</option>
                <option value="external">External Students</option>
              </select>

              <select
                value={String(daysAhead)}
                onChange={(e) => handleRange(e.target.value)}
                aria-label="Filter by date range"
                className="px-4 py-3 bg-ghost border-[3px] border-navy rounded-2xl text-sm text-navy"
              >
                <option value="30">Next 30 days</option>
                <option value="60">Next 60 days</option>
                <option value="90">Next 90 days</option>
                <option value="180">Next 180 days</option>
                <option value="365">Next 365 days</option>
              </select>
            </div>
          </div>
        )}
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
                <th scope="col" className="text-left p-4 text-[10px] font-bold uppercase tracking-[0.12em] text-slate">Student</th>
                <th scope="col" className="text-left p-4 text-[10px] font-bold uppercase tracking-[0.12em] text-slate hidden md:table-cell">Email</th>
                <th scope="col" className="text-left p-4 text-[10px] font-bold uppercase tracking-[0.12em] text-slate">Birthday</th>
                <th scope="col" className="text-left p-4 text-[10px] font-bold uppercase tracking-[0.12em] text-slate hidden lg:table-cell">Department</th>
              </tr>
            </thead>
            <tbody>
              {!loading && items.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-12 text-center text-sm text-slate">No birthdays found for this filter.</td>
                </tr>
              ) : (
                items.map((item) => {
                  const dueLabel =
                    item.daysUntil === 0 ? "Today" : item.daysUntil === 1 ? "Tomorrow" : `In ${item.daysUntil} days`;

                  return (
                    <tr key={item.id} className="border-b-2 border-cloud last:border-b-0 hover:bg-ghost/50 transition-colors">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-lime-light border-2 border-navy/20 flex items-center justify-center text-xs font-bold text-navy shrink-0">
                            {item.firstName?.[0] || "?"}
                            {item.lastName?.[0] || ""}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-navy truncate">{item.firstName} {item.lastName}</p>
                            <p className="text-xs text-slate truncate">{item.currentLevel || "Student"}{item.matricNumber ? ` • ${item.matricNumber}` : ""}</p>
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

      <Pagination page={page} totalPages={totalPages} onPage={setPage} className="mt-1" />
    </div>
  );
}

export default withAuth(AdminUsersBirthdaysPage, {
  requiredPermission: "user:view_all",
});
