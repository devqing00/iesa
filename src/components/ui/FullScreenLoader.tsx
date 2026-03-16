type FullScreenLoaderProps = {
  size?: "sm" | "md";
  label?: string;
};

const sizeClasses: Record<NonNullable<FullScreenLoaderProps["size"]>, string> = {
  sm: "h-10 w-10",
  md: "h-12 w-12",
};

export default function FullScreenLoader({
  size = "md",
  label,
}: FullScreenLoaderProps) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-ghost">
      <div className="space-y-4 text-center">
        <div
          className={`animate-spin rounded-full ${sizeClasses[size]} border-[3px] border-navy border-t-transparent mx-auto`}
        />
        {label ? (
          <p className="font-display font-bold text-xs text-slate uppercase tracking-wider">
            {label}
          </p>
        ) : null}
      </div>
    </div>
  );
}