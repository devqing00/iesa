"use client";

const CENTRAL_EXCOS = [
  { name: "John Doe", role: "President", level: "500L", phone: "08012345678", photo: "", email: "president@iesa.edu" },
  { name: "Jane Smith", role: "Vice President", level: "500L", phone: "08023456789", photo: "", email: "vicepresident@iesa.edu" },
  { name: "Samuel Lee", role: "Secretary", level: "400L", phone: "08034567890", photo: "", email: "secretary@iesa.edu" },
  { name: "Aisha Bello", role: "Financial Secretary", level: "400L", phone: "08045678901", photo: "", email: "finance@iesa.edu" },
  { name: "Chinedu Okafor", role: "PRO", level: "400L", phone: "08056789012", photo: "", email: "pro@iesa.edu" },
];

export default function CentralExcosPage() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
      {CENTRAL_EXCOS.map((exco) => (
        <div key={exco.email} className="bg-background/60 backdrop-blur-xl border-1 border-primary/10 rounded-xl p-6 flex flex-col items-center text-center group hover:shadow-sharp-md transition-shadow">
          <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-3xl mb-3 group-hover:scale-110 transition-transform">
            {exco.name[0]}
          </div>
          <h3 className="font-bold text-lg text-foreground mb-1">{exco.name}</h3>
          <p className="text-primary font-bold text-xs mb-1 flex items-center gap-2">
            {exco.role}
            <span className="bg-primary/10 text-primary px-2 py-0.5 rounded-full text-[10px] border border-primary/20">{exco.level}</span>
          </p>
          <div className="flex flex-col gap-1 items-center">
            <a href={`mailto:${exco.email}`} className="text-foreground/60 text-xs hover:text-primary transition-colors block">{exco.email}</a>
            <a href={`tel:${exco.phone}`} className="text-foreground/60 text-xs hover:text-primary transition-colors block">{exco.phone}</a>
          </div>
        </div>
      ))}
    </div>
  );
}
