"use client";

import { useEffect, useState } from "react";

// A web page cannot truly block screenshots — the OS takes them, and neither
// iOS nor Android tells a web app one happened. This is a set of deterrents:
// it blanks the app when the window loses focus or a screenshot shortcut is
// pressed, and blocks printing/copying/saving images.
// Real blocking on phones needs a native app (Android FLAG_SECURE).

export function ScreenProtection() {
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

  return (
    <>
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
