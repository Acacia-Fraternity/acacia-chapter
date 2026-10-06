// Browsers and phones give web apps no way to block or detect a screenshot, so
// the chat is stamped with the viewer's name instead: any leaked screenshot
// traces back to whoever took it. Real blocking needs a native app.
export function ChatWatermark({ name }: { name: string }) {
  const safe = name.replace(/[<>&"']/g, "");
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' width='260' height='140'>` +
    `<text x='20' y='90' transform='rotate(-25 130 70)' font-family='sans-serif' ` +
    `font-size='15' font-weight='600' fill='%23808080' fill-opacity='0.22'>${safe}</text></svg>`;
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-40"
      style={{ backgroundImage: `url("data:image/svg+xml;utf8,${svg}")` }}
    />
  );
}
