"use client";

import { useState, useTransition } from "react";
import { setTheme } from "@/app/dashboard/personalization/actions";

type Theme = "light" | "dark" | "system";

export function PersonalizationForm({ initialTheme }: { initialTheme: Theme }) {
  const [theme, setThemeState] = useState<Theme>(initialTheme);
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
    </div>
  );
}
