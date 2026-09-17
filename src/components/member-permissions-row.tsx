"use client";

import { useState, useTransition } from "react";
import {
  setMemberRole,
  setMemberCanChat,
  setMemberCanReact,
} from "@/app/dashboard/admin/actions";
import type { Profile } from "@/lib/types";

export function MemberPermissionsRow({
  member,
  isSelf,
}: {
  member: Profile;
  isSelf: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(action: () => Promise<void>) {
    setError(null);
    startTransition(async () => {
      try {
        await action();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Update failed");
      }
    });
  }

  return (
    <li className="rounded-md border border-surface-border px-3 py-2">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <span className="text-sm">
          {member.full_name || "(no name set)"}
          {isSelf && <span className="text-muted-foreground"> (you)</span>}
        </span>

        <div className="flex items-center gap-4 text-xs">
          <label className="flex items-center gap-1.5">
            <input
              type="checkbox"
              checked={member.can_chat}
              disabled={isPending}
              onChange={(e) =>
                run(() => setMemberCanChat(member.id, e.target.checked))
              }
            />
            Chat
          </label>

          <label className="flex items-center gap-1.5">
            <input
              type="checkbox"
              checked={member.can_react}
              disabled={isPending}
              onChange={(e) =>
                run(() => setMemberCanReact(member.id, e.target.checked))
              }
            />
            React
          </label>

          <select
            value={member.role}
            disabled={isPending || isSelf}
            onChange={(e) =>
              run(() =>
                setMemberRole(member.id, e.target.value as "member" | "admin"),
              )
            }
            className="rounded border border-surface-border px-1.5 py-0.5 text-xs disabled:opacity-50"
          >
            <option value="member">member</option>
            <option value="admin">admin</option>
          </select>
        </div>
      </div>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </li>
  );
}
