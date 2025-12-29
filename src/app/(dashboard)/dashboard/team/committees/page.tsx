"use client";

const COMMITTEES = [
  { name: "Fatima Musa", role: "Academic Committee Head", level: "400L", phone: "08067890123", photo: "", email: "academic@iesa.edu" },
  { name: "Bola Ajayi", role: "Welfare Committee Head", level: "400L", phone: "08078901234", photo: "", email: "welfare@iesa.edu" },
  { name: "Tunde Ojo", role: "Sports Committee Head", level: "300L", phone: "08089012345", photo: "", email: "sports@iesa.edu" },
  { name: "Ngozi Umeh", role: "Socials Committee Head", level: "300L", phone: "08090123456", photo: "", email: "socials@iesa.edu" },
];

export default function CommitteesPage() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
      {COMMITTEES.map((person) => (
        <div key={person.email} className="bg-background/60 backdrop-blur-xl border-1 border-primary/10 rounded-xl p-6 flex flex-col items-center text-center group hover:shadow-sharp-md transition-shadow">
          <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-3xl mb-3 group-hover:scale-110 transition-transform">
            {person.name[0]}
          </div>
          <h3 className="font-bold text-lg text-foreground mb-1">{person.name}</h3>
          <p className="text-primary font-bold text-xs mb-1 flex items-center gap-2">
            {person.role}
            <span className="bg-primary/10 text-primary px-2 py-0.5 rounded-full text-[10px] border border-primary/20">{person.level}</span>
          </p>
          <div className="flex flex-col gap-1 items-center">
            <a href={`mailto:${person.email}`} className="text-foreground/60 text-xs hover:text-primary transition-colors block">{person.email}</a>
            <a href={`tel:${person.phone}`} className="text-foreground/60 text-xs hover:text-primary transition-colors block">{person.phone}</a>
          </div>
        </div>
      ))}
    </div>
  );
}
