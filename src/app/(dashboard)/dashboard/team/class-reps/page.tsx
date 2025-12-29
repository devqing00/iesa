"use client";

const CLASS_REPS = [
  {
    name: "Emeka Obi",
    role: "100L Class Rep",
    phone: "08011112222",
    level: "100L",
    photo: "",
    email: "100lrep@iesa.edu",
  },
  {
    name: "Mary Johnson",
    role: "100L Asst. Rep",
    phone: "08011113333",
    level: "100L",
    photo: "",
    email: "100lrep2@iesa.edu",
  },
  {
    name: "Femi Adeyemi",
    role: "200L Class Rep",
    phone: "08022223333",
    level: "200L",
    photo: "",
    email: "200lrep@iesa.edu",
  },
  {
    name: "Grace Udo",
    role: "200L Asst. Rep",
    phone: "08022224444",
    level: "200L",
    photo: "",
    email: "200lrep2@iesa.edu",
  },
  {
    name: "Ahmed Yusuf",
    role: "300L Class Rep",
    phone: "08033334444",
    level: "300L",
    photo: "",
    email: "300lrep@iesa.edu",
  },
  {
    name: "Blessing Eze",
    role: "300L Asst. Rep",
    phone: "08033335555",
    level: "300L",
    photo: "",
    email: "300lrep2@iesa.edu",
  },
  {
    name: "Tunde Bello",
    role: "400L Class Rep",
    phone: "08044445555",
    level: "400L",
    photo: "",
    email: "400lrep@iesa.edu",
  },
  {
    name: "Ada Nwosu",
    role: "400L Asst. Rep",
    phone: "08044446666",
    level: "400L",
    photo: "",
    email: "400lrep2@iesa.edu",
  },
  {
    name: "John Doe",
    role: "500L Class Rep",
    phone: "08055556666",
    level: "500L",
    photo: "",
    email: "500lrep@iesa.edu",
  },
  {
    name: "Jane Smith",
    role: "500L Asst. Rep",
    phone: "08055557777",
    level: "500L",
    photo: "",
    email: "500lrep2@iesa.edu",
  },
];

export default function ClassRepsPage() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
      {CLASS_REPS.map((rep) => (
        <div
          key={rep.email}
          className="bg-background/60 backdrop-blur-xl border border-foreground/10 rounded-xl p-6 flex flex-col items-center text-center group hover:shadow-lg transition-shadow"
        >
          <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-3xl mb-3 group-hover:scale-110 transition-transform">
            {rep.name[0]}
          </div>
          <h3 className="font-bold text-lg text-foreground mb-1">{rep.name}</h3>
          <p className="text-primary font-bold text-xs mb-1 flex items-center gap-2">
            {rep.role}
            {/* <span className="bg-primary/10 text-primary px-2 py-0.5 rounded-full text-[10px] border border-primary/20">
              {rep.level}
            </span> */}
          </p>
          <div className="flex flex-col gap-1 items-center">
            <a
              href={`mailto:${rep.email}`}
              className="text-foreground/60 text-xs hover:text-primary transition-colors block"
            >
              {rep.email}
            </a>
            <a
              href={`tel:${rep.phone}`}
              className="text-foreground/60 text-xs hover:text-primary transition-colors block"
            >
              {rep.phone}
            </a>
          </div>
        </div>
      ))}
    </div>
  );
}
