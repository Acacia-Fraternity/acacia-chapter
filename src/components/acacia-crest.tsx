import Image from "next/image";

/**
 * Acacia's official coat of arms (downloaded from acacia.org/graphics-coat-of-arms).
 * Only ever shipped by Acacia on a white background, so it always sits in
 * its own white chip regardless of the surrounding theme.
 */
export function AcaciaCrest({ size = 32 }: { size?: number }) {
  return (
    <span
      className="inline-flex items-center justify-center rounded-md bg-white shrink-0 p-0.5"
      style={{ width: size, height: size }}
    >
      <Image
        src="/brand/crest-full-color.png"
        alt="Acacia crest"
        width={size}
        height={size}
        className="object-contain h-full w-full"
      />
    </span>
  );
}
