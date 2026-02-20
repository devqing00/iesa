export default function DashboardLoading() {
  return (
    <div className="flex-1 p-6 md:p-8 space-y-8 animate-pulse">
      {/* Header skeleton */}
      <div className="space-y-2">
        <div className="h-3 w-24 bg-cloud rounded-2xl" />
        <div className="h-8 w-64 bg-cloud rounded-2xl" />
      </div>

      {/* Stats grid skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-snow border-[3px] border-navy rounded-2xl p-6 space-y-3 shadow-[4px_4px_0_0_#000]">
            <div className="h-3 w-20 bg-cloud rounded-2xl" />
            <div className="h-6 w-16 bg-cloud rounded-2xl" />
            <div className="h-3 w-32 bg-cloud rounded-2xl" />
          </div>
        ))}
      </div>

      {/* Content skeleton */}
      <div className="bg-snow border-[3px] border-navy rounded-2xl p-6 space-y-4 shadow-[4px_4px_0_0_#000]">
        <div className="h-5 w-40 bg-cloud rounded-2xl" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 bg-cloud rounded-2xl" />
          ))}
        </div>
      </div>
    </div>
  );
}
