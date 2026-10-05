// Acacia's badge is a 3-4-5 right triangle (shortest side as the base), so the
// Curriculum tab uses one instead of a generic lucide triangle. Same props
// shape as a lucide icon; legs are 13.5 x 18 so the hypotenuse is exactly 22.5.
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
      fill="currentColor"
      stroke="currentColor"
      strokeWidth={1}
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M5.25 3v18h13.5z" />
    </svg>
  );
}
