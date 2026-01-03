export default function StatsSection() {
  const stats = [
    { label: "Years of Legacy", value: "25+" },
    { label: "Future Engineers", value: "800+" },
    { label: "Alumni Network", value: "1.5k+" },
    { label: "Corporate Partners", value: "10+" },
  ];

  return (
    <section id="stats" className="relative z-20 w-full py-20 bg-foreground/5 border-y border-foreground/5 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {stats.map((stat, index) => (
            <div key={index} className="text-center">
              <div className="text-4xl md:text-5xl font-black font-heading text-primary mb-2">
                {stat.value}
              </div>
              <div className="text-xs font-bold tracking-widest uppercase text-foreground/60">
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
