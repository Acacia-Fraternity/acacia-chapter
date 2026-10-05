// The chapter is in Bloomington, IN. Server code (Server Components, Server
// Actions) runs in UTC on Vercel, so formatting a stored timestamp or parsing
// a typed time without naming this zone silently shifts every event by 4-5
// hours. Client components render in the brother's own browser zone.
export const CHAPTER_TZ = "America/Indiana/Indianapolis";

export function formatChapterTime(
  iso: string,
  options: Intl.DateTimeFormatOptions,
): string {
  return new Date(iso).toLocaleString("en-US", { timeZone: CHAPTER_TZ, ...options });
}

function zoneOffsetMs(utcMs: number): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: CHAPTER_TZ,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
      .formatToParts(new Date(utcMs))
      .map((p) => [p.type, p.value]),
  );
  const wallAsUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  return wallAsUtc - Math.floor(utcMs / 1000) * 1000;
}

/**
 * Turns a <input type="datetime-local"> value ("2026-10-05T19:00"), which is
 * a wall-clock time with no zone, into the UTC instant that is 7 PM in
 * Bloomington — including across daylight-saving changes.
 */
export function chapterWallTimeToIso(local: string): string {
  // datetime-local gives "YYYY-MM-DDTHH:mm" (no seconds); read it as if UTC
  // first, then correct by the zone offset below.
  const withSeconds = local.length === 16 ? `${local}:00` : local;
  const wallAsUtc = Date.parse(`${withSeconds}Z`);
  if (Number.isNaN(wallAsUtc)) throw new Error("Invalid date/time");
  // Two passes because the offset depends on the instant being solved for.
  let utc = wallAsUtc - zoneOffsetMs(wallAsUtc);
  utc = wallAsUtc - zoneOffsetMs(utc);
  return new Date(utc).toISOString();
}
