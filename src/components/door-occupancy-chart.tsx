import { CHAPTER_TZ } from "@/lib/chapter-time";

// Step line of people inside over the party window. Server-rendered SVG.
export function DoorOccupancyChart({
  taps,
  startMs,
  endMs,
  nowMs,
}: {
  taps: { direction: string; created_at: string }[];
  startMs: number;
  endMs: number;
  nowMs: number;
}) {
  const W = 600;
  const H = 240;
  const pad = { l: 36, r: 12, t: 12, b: 28 };

  let baseline = 0;
  const events: { t: number; v: number }[] = [];
  for (const tap of taps) {
    const t = new Date(tap.created_at).getTime();
    const d = tap.direction === "in" ? 1 : -1;
    if (t < startMs) baseline += d;
    else if (t <= endMs) events.push({ t, v: d });
  }
  events.sort((a, b) => a.t - b.t);

  const points: { t: number; n: number }[] = [{ t: startMs, n: Math.max(0, baseline) }];
  let n = baseline;
  for (const e of events) {
    n += e.v;
    points.push({ t: e.t, n: Math.max(0, n) });
  }
  // Stop the line at "now" while the party is still going.
  const lastT = Math.min(endMs, Math.max(nowMs, points[points.length - 1].t));
  points.push({ t: lastT, n: points[points.length - 1].n });

  const peak = Math.max(5, ...points.map((p) => p.n));
  const x = (t: number) => pad.l + ((t - startMs) / (endMs - startMs)) * (W - pad.l - pad.r);
  const y = (v: number) => H - pad.b - (v / peak) * (H - pad.t - pad.b);

  let d = `M ${x(points[0].t)} ${y(points[0].n)}`;
  for (let i = 1; i < points.length; i++) {
    d += ` H ${x(points[i].t)} V ${y(points[i].n)}`;
  }

  const ticks: number[] = [];
  for (let t = startMs; t <= endMs; t += 60 * 60 * 1000) ticks.push(t);
  const yTicks = [0, Math.round(peak / 2), peak];
  const label = (ms: number) =>
    new Date(ms).toLocaleTimeString("en-US", {
      timeZone: CHAPTER_TZ,
      hour: "numeric",
      minute: "2-digit",
    });

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="People at the party over time">
      {yTicks.map((v) => (
        <g key={v}>
          <line x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} stroke="currentColor" opacity={0.12} />
          <text x={pad.l - 6} y={y(v) + 4} textAnchor="end" fontSize={11} fill="currentColor" opacity={0.6}>
            {v}
          </text>
        </g>
      ))}
      {ticks.map((t) => (
        <text key={t} x={x(t)} y={H - 8} textAnchor="middle" fontSize={11} fill="currentColor" opacity={0.6}>
          {label(t)}
        </text>
      ))}
      <path d={d} fill="none" stroke="#008675" strokeWidth={2.5} strokeLinejoin="round" />
    </svg>
  );
}
