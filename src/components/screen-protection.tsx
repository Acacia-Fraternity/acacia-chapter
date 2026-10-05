"use client";

import { useEffect, useMemo, useState } from "react";

// A web page cannot truly block screenshots — the OS takes them, and neither
// iOS nor Android tells a web app one happened. This is a set of deterrents:
// it blanks the app when the window loses focus or a screenshot shortcut is
// pressed, blocks printing/copying/saving images, and stamps the viewer's
// name across the screen so a leaked screenshot points back to who took it.
// Real blocking on phones needs a native app (Android FLAG_SECURE).

function escapeXml(text: string) {
  return text.replace(/[<>&"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

export function ScreenProtection({ label }: { label: string }) {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    let releaseTimer: ReturnType<typeof setTimeout> | undefined;

    const hide = () => {
      clearTimeout(releaseTimer);
      setHidden(true);
    };
    const showIfActive = () => {
      if (document.visibilityState === "visible" && document.hasFocus()) {
        setHidden(false);
      }
    };

    const onKeyDown = (e: KeyboardEvent) => {
      const printScreen = e.key === "PrintScreen";
      // Windows Snipping Tool, and the macOS screenshot shortcuts.
      const snip = e.metaKey && e.shiftKey && (e.code === "KeyS" || /^Digit[345]$/.test(e.code));
      if (!printScreen && !snip) return;
      hide();
      // PrintScreen puts the capture on the clipboard — overwrite it.
      navigator.clipboard?.writeText(" ").catch(() => {});
      releaseTimer = setTimeout(showIfActive, 1500);
    };
    const onContextMenu = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target?.closest("input, textarea")) e.preventDefault();
    };
    const onCopy = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target?.closest("input, textarea")) e.preventDefault();
    };

    window.addEventListener("blur", hide);
    window.addEventListener("focus", showIfActive);
    document.addEventListener("visibilitychange", () =>
      document.visibilityState === "hidden" ? hide() : showIfActive(),
    );
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyDown);
    document.addEventListener("contextmenu", onContextMenu);
    document.addEventListener("copy", onCopy);

    return () => {
      clearTimeout(releaseTimer);
      window.removeEventListener("blur", hide);
      window.removeEventListener("focus", showIfActive);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyDown);
      document.removeEventListener("contextmenu", onContextMenu);
      document.removeEventListener("copy", onCopy);
    };
  }, []);

  const watermark = useMemo(() => {
    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" width="260" height="160">` +
      `<text x="20" y="90" font-family="sans-serif" font-size="15" fill="#808080" ` +
      `transform="rotate(-25 130 80)">${escapeXml(label)}</text></svg>`;
    return `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`;
  }, [label]);

  return (
    <>
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-[9000] opacity-[0.12]"
        style={{ backgroundImage: watermark }}
      />
      {hidden && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-background p-6 text-center">
          <p className="text-sm text-muted">
            Content is hidden while this window isn&apos;t in focus.
            <br />
            Click here to continue.
          </p>
        </div>
      )}
    </>
  );
}
