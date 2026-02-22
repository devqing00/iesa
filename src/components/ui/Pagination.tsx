"use client";

interface PaginationProps {
  page: number;
  totalPages: number;
  onPage: (p: number) => void;
  className?: string;
}

export default function Pagination({ page, totalPages, onPage, className = "" }: PaginationProps) {
  if (totalPages <= 1) return null;

  // Build page window: show up to 5 pages centred on current
  const pages: (number | "…")[] = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    if (page > 3) pages.push("…");
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i);
    if (page < totalPages - 2) pages.push("…");
    pages.push(totalPages);
  }

  const btn = (label: string | number, target: number, active = false, disabled = false) => (
    <button
      key={`${label}-${target}`}
      onClick={() => !disabled && onPage(target)}
      disabled={disabled}
      className={[
        "h-9 min-w-[2.25rem] px-2 rounded-xl border-[3px] font-display font-black text-sm transition-all",
        active
          ? "bg-navy border-navy text-lime shadow-[3px_3px_0_0_#C8F31D]"
          : disabled
          ? "bg-ghost border-cloud text-slate cursor-not-allowed"
          : "bg-snow border-navy text-navy hover:bg-lime press-3 press-black",
      ].join(" ")}
    >
      {label}
    </button>
  );

  return (
    <div className={`flex items-center justify-center gap-1.5 ${className}`}>
      {btn("‹", page - 1, false, page === 1)}
      {pages.map((p, i) =>
        p === "…" ? (
          <span key={`ellipsis-${i}`} className="h-9 min-w-[2.25rem] flex items-center justify-center text-slate font-bold text-sm">
            …
          </span>
        ) : (
          btn(p, p as number, p === page)
        )
      )}
      {btn("›", page + 1, false, page === totalPages)}
    </div>
  );
}
