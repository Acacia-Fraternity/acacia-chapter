"use client";

import { useTransition } from "react";
import { setLivesInHouse } from "@/app/dashboard/house-presence/actions";

export function LivesInHouseToggle({
  userId,
  livesInHouse,
  canEdit,
}: {
  userId: string;
  livesInHouse: boolean;
  canEdit: boolean;
}) {
  const [isPending, startTransition] = useTransition();

  if (!canEdit) {
    return (
      <span
        className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
          livesInHouse
            ? "bg-acacia-blue/15 text-acacia-blue"
            : "bg-surface-border text-muted"
        }`}
      >
        {livesInHouse ? "Live-in" : "Live-out"}
      </span>
    );
  }

  return (
    <label
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium cursor-pointer ${
        livesInHouse ? "bg-acacia-blue/15 text-acacia-blue" : "bg-surface-border text-muted"
      } ${isPending ? "opacity-50" : ""}`}
    >
      <input
        type="checkbox"
        checked={livesInHouse}
        disabled={isPending}
        onChange={(e) =>
          startTransition(() => setLivesInHouse(userId, e.target.checked))
        }
        className="sr-only"
      />
      {livesInHouse ? "Live-in" : "Live-out"}
    </label>
  );
}
