/**
 * Lightweight skeleton loader — replaces full-page spinners.
 * Shows animated placeholder rows so the layout stays visible.
 */
export default function PageSkeleton({ rows = 5 }) {
  return (
    <div className="space-y-3 animate-pulse">
      {/* Title placeholder */}
      <div className="h-7 w-48 bg-white/5 rounded-lg" />
      <div className="h-4 w-64 bg-white/5 rounded-lg mb-6" />
      {/* Row placeholders */}
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-14 bg-white/5 rounded-xl" />
      ))}
    </div>
  );
}
