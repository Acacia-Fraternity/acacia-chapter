"use client";

import { useState, useTransition } from "react";
import { setTheme, setIconPreference } from "@/app/dashboard/personalization/actions";

type Theme = "light" | "dark" | "system";
type Icon = "mark" | "crest";

export function PersonalizationForm({
  initialTheme,
  initialIcon,
}: {
  initialTheme: Theme;
  initialIcon: Icon;
}) {
  const [theme, setThemeState] = useState<Theme>(initialTheme);
  const [icon, setIconState] = useState<Icon>(initialIcon);
  const [, startTransition] = useTransition();

  function applyTheme(next: Theme) {
    setThemeState(next);
    if (next === "system") {
      document.documentElement.removeAttribute("data-theme");
    } else {
      document.documentElement.setAttribute("data-theme", next);
    }
    startTransition(() => {
      setTheme(next);
    });
  }

  function applyIcon(next: Icon) {
    setIconState(next);
    startTransition(() => {
      setIconPreference(next);
    });
  }

  return (
    <div className="space-y-8 max-w-md">
      <section className="space-y-2">
        <h2 className="text-sm font-medium text-muted">Appearance</h2>
        <div className="flex gap-2">
          {(["light", "dark", "system"] as const).map((option) => (
            <button
              key={option}
              onClick={() => applyTheme(option)}
              className={`flex-1 rounded-md border px-3 py-2 text-sm capitalize ${
                theme === option
                  ? "border-acacia-gold bg-acacia-gold/10 font-semibold"
                  : "border-surface-border"
              }`}
            >
              {option}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          &quot;System&quot; follows your phone or browser&apos;s own light/dark
          setting.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-medium text-muted">Home screen icon</h2>
        <p className="text-xs text-muted-foreground">
          Choose which Acacia mark appears if you add this app to your
          phone&apos;s home screen. If you&apos;ve already added it, remove and
          re-add the shortcut for the change to take effect — phones cache
          the icon at the moment you add it, they don&apos;t update it later.
        </p>
        <div className="flex gap-3">
          {(["mark", "crest"] as const).map((option) => (
            <button
              key={option}
              onClick={() => applyIcon(option)}
              className={`flex-1 rounded-lg border p-3 flex flex-col items-center gap-2 ${
                icon === option
                  ? "border-acacia-gold bg-acacia-gold/10"
                  : "border-surface-border"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/icon-${option}?size=96`}
                alt={option === "mark" ? "Acacia A" : "Acacia Crest"}
                width={64}
                height={64}
                className="rounded-lg"
              />
              <span className="text-xs">
                {option === "mark" ? "Acacia A" : "Crest"}
              </span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
