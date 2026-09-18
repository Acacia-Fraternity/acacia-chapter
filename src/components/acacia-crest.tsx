import Image from "next/image";

/**
 * Acacia's official coat of arms, full color (gold shield, black fess,
 * green wreath, blue ribbon) with its white background chroma-keyed out
 * to real alpha transparency — Acacia only ever ships this artwork on a
 * solid white background, so this transparent version was generated once
 * from their official file (see git history for the one-off script) rather
 * than faking transparency with a blend-mode trick, which would have
 * darkened/desaturated the actual colors against a dark sidebar.
 */
export function AcaciaCrest({ size = 32 }: { size?: number }) {
  return (
    <span
      className="inline-flex items-center justify-center shrink-0"
      style={{ width: size, height: size }}
    >
      <Image
        src="/brand/crest-transparent.png"
        alt="Acacia crest"
        width={size}
        height={size}
        className="object-contain h-full w-full"
      />
    </span>
  );
}
