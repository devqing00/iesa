"use client";

const COMMITTEES = [
  {
    name: "Fatima Musa",
    role: "Academic Committee Head",
    level: "400L",
    phone: "08067890123",
    photo: "",
    email: "academic@iesa.edu",
  },
  {
    name: "Bola Ajayi",
    role: "Welfare Committee Head",
    level: "400L",
    phone: "08078901234",
    photo: "",
    email: "welfare@iesa.edu",
  },
  {
    name: "Tunde Ojo",
    role: "Sports Committee Head",
    level: "300L",
    phone: "08089012345",
    photo: "",
    email: "sports@iesa.edu",
  },
  {
    name: "Ngozi Umeh",
    role: "Socials Committee Head",
    level: "300L",
    phone: "08090123456",
    photo: "",
    email: "socials@iesa.edu",
  },
];

export default function CommitteesPage() {
  return (
    <div>
      {/* Section Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <span className="text-label text-text-muted">◆</span>
          <span className="text-label-sm text-text-muted">Committees</span>
        </div>
        <h2 className="font-display text-display-sm">Committee Heads</h2>
        <p className="text-text-secondary text-body text-sm mt-2">
          Leading various committees to serve student interests and welfare
        </p>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {COMMITTEES.map((person, index) => (
          <div
            key={person.email}
            className="page-frame p-6 group hover:-translate-y-0.5 transition-transform"
          >
            {/* Avatar & Badge */}
            <div className="flex items-start justify-between mb-4">
              <div className="relative">
                <div className="w-16 h-16 bg-charcoal dark:bg-cream rounded-full flex items-center justify-center text-cream dark:text-charcoal font-display text-2xl">
                  {person.name[0]}
                </div>
                <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-charcoal dark:bg-cream border-2 border-bg-primary rounded-full flex items-center justify-center">
                  <svg
                    className="w-3 h-3 text-cream dark:text-charcoal"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 00.75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 00-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0112 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 01-.673-.38m0 0A2.18 2.18 0 013 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 013.413-.387m7.5 0V5.25A2.25 2.25 0 0013.5 3h-3a2.25 2.25 0 00-2.25 2.25v.894m7.5 0a48.667 48.667 0 00-7.5 0M12 12.75h.008v.008H12v-.008z"
                    />
                  </svg>
                </div>
              </div>
              <span className="page-number">
                {String(index + 1).padStart(2, "0")}
              </span>
            </div>

            {/* Name & Role */}
            <h3 className="font-display text-lg mb-1">{person.name}</h3>
            <div className="flex items-center gap-2 mb-4">
              <span className="text-label-sm text-text-muted">
                {person.role}
              </span>
              <span className="text-text-muted">·</span>
              <span className="text-label-sm text-text-muted">
                {person.level}
              </span>
            </div>

            {/* Contact */}
            <div className="space-y-2 pt-4 border-t border-border">
              <a
                href={`mailto:${person.email}`}
                className="flex items-center gap-2 text-text-secondary hover:text-text-primary transition-colors"
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
                <span className="text-label-sm truncate">{person.email}</span>
              </a>
              <a
                href={`tel:${person.phone}`}
                className="flex items-center gap-2 text-text-secondary hover:text-text-primary transition-colors"
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
                <span className="text-label-sm">{person.phone}</span>
              </a>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
