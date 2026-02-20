export default function AdminLoading() {
  return (
    <div className="flex-1 p-6 md:p-8 space-y-8 animate-pulse">
      {/* Header skeleton */}
      <div className="flex justify-between items-center">
        <div className="space-y-2">
          <div className="h-8 w-48 bg-cloud rounded-2xl" />
          <div className="h-4 w-64 bg-cloud rounded-2xl" />
        </div>
        <div className="h-10 w-32 bg-cloud rounded-2xl" />
      </div>

      {/* Stats skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="card p-6 space-y-3">
            <div className="h-4 w-24 bg-cloud rounded-2xl" />
            <div className="h-8 w-16 bg-cloud rounded-2xl" />
          </div>
        ))}
      </div>

      {/* Table skeleton */}
      <div className="card p-6 space-y-4">
        <div className="h-5 w-32 bg-cloud rounded-2xl" />
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-14 bg-cloud rounded-2xl" />
          ))}
        </div>
      </div>
    </div>
  );
}
