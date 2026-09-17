import Image from "next/image";

/**
 * Acacia Fraternity's official "A" mark (downloaded from acacia.org/graphics-logo).
 * Per the fraternity's own brand guide, this artwork must never be redrawn or
 * recolored outside the black/white/gold treatments they specify — always
 * render the real file, never approximate it with text/CSS.
 */
export function AcaciaMark({
  size = 32,
  variant = "badge",
}: {
  size?: number;
  variant?: "badge" | "black" | "white";
}) {
  if (variant === "badge") {
    return (
      <span
        className="inline-flex items-center justify-center rounded-full bg-acacia-gold shrink-0"
        style={{ width: size, height: size }}
      >
        <Image
          src="/brand/acacia-logo-black.svg"
          alt="Acacia"
          width={size * 0.55}
          height={size * 0.55}
        />
      </span>
    );
  }

  return (
    <Image
      src={`/brand/acacia-logo-${variant}.svg`}
      alt="Acacia"
      width={size}
      height={size}
    />
  );
}
