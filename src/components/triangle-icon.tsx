// Acacia's badge is a 3-4-5 right triangle, so the Curriculum tab uses one
// instead of a generic lucide triangle. Same props shape as a lucide icon.
export function TriangleIcon({
  size = 20,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M4 20V8l16 12z" />
    </svg>
  );
}
