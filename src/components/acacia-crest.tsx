import Image from "next/image";

/**
 * Acacia's official coat of arms, downloaded from acacia.org as a white-
 * background line-art file (crest-black.png) since that's the only clean
 * vector-style version they ship. To sit on the dark sidebar without a
 * visible white box around it, it's inverted (white lines, transparent-
 * looking black fill) and composited with mix-blend-mode: screen — screen
 * treats black as fully transparent and white as opaque, so the artwork
 * reads as a clean white emblem directly on whatever dark background sits
 * behind it, with no box, no border, no white rectangle.
 */
export function AcaciaCrest({ size = 32 }: { size?: number }) {
  return (
    <span
      className="inline-flex items-center justify-center shrink-0 overflow-hidden"
      style={{ width: size, height: size }}
    >
      <Image
        src="/brand/crest-black.png"
        alt="Acacia crest"
        width={size}
        height={size}
        className="object-contain h-full w-full"
        style={{ filter: "invert(1)", mixBlendMode: "screen" }}
      />
    </span>
  );
}
