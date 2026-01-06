"use client";

const CENTRAL_EXCOS = [
  {
    name: "John Doe",
    role: "President",
    level: "500L",
    phone: "08012345678",
    photo: "",
    email: "president@iesa.edu",
  },
  {
    name: "Jane Smith",
    role: "Vice President",
    level: "500L",
    phone: "08023456789",
    photo: "",
    email: "vicepresident@iesa.edu",
  },
  {
    name: "Samuel Lee",
    role: "Secretary",
    level: "400L",
    phone: "08034567890",
    photo: "",
    email: "secretary@iesa.edu",
  },
  {
    name: "Aisha Bello",
    role: "Financial Secretary",
    level: "400L",
    phone: "08045678901",
    photo: "",
    email: "finance@iesa.edu",
  },
  {
    name: "Chinedu Okafor",
    role: "PRO",
    level: "400L",
    phone: "08056789012",
    photo: "",
    email: "pro@iesa.edu",
  },
];

export default function CentralExcosPage() {
  return (
    <div>
      {/* Section Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <span className="text-label text-text-muted">◆</span>
          <span className="text-label-sm text-text-muted">Leadership</span>
        </div>
        <h2 className="font-display text-display-sm">Central Executives</h2>
        <p className="text-text-secondary text-body text-sm mt-2">
          Leadership team guiding the department towards excellence
        </p>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {CENTRAL_EXCOS.map((exco, index) => (
          <div
            key={exco.email}
            className="page-frame p-6 group hover:-translate-y-0.5 transition-transform"
          >
            {/* Avatar & Badge */}
            <div className="flex items-start justify-between mb-4">
              <div className="relative">
                <div className="w-16 h-16 bg-charcoal dark:bg-cream rounded-full flex items-center justify-center text-cream dark:text-charcoal font-display text-2xl">
                  {exco.name[0]}
                </div>
                <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-charcoal dark:bg-cream border-2 border-bg-primary rounded-full flex items-center justify-center">
                  <span className="text-cream dark:text-charcoal text-[10px]">
                    ✦
                  </span>
                </div>
              </div>
              <span className="page-number">
                {String(index + 1).padStart(2, "0")}
              </span>
            </div>

            {/* Name & Role */}
            <h3 className="font-display text-lg mb-1">{exco.name}</h3>
            <div className="flex items-center gap-2 mb-4">
              <span className="text-label-sm text-text-muted">{exco.role}</span>
              <span className="text-text-muted">·</span>
              <span className="text-label-sm text-text-muted">
                {exco.level}
              </span>
            </div>

            {/* Contact */}
            <div className="space-y-2 pt-4 border-t border-border">
              <a
                href={`mailto:${exco.email}`}
                className="flex items-center gap-2 text-text-secondary hover:text-text-primary transition-colors group/link"
              >
                <svg
                  className="w-3.5 h-3.5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"
                  />
                </svg>
                <span className="text-label-sm truncate">{exco.email}</span>
              </a>
              <a
                href={`tel:${exco.phone}`}
                className="flex items-center gap-2 text-text-secondary hover:text-text-primary transition-colors group/link"
              >
                <svg
                  className="w-3.5 h-3.5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z"
                  />
                </svg>
                <span className="text-label-sm">{exco.phone}</span>
              </a>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
