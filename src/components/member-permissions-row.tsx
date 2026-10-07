"use client";

import { useState, useTransition } from "react";
import {
  setMemberRole,
  setMemberCanChat,
  setMemberCanReact,
  setMemberIsPledge,
  setMemberCanEditCalendar,
  setMemberIsExec,
  setMemberOnPledgeCommittee,
  resetMemberPassword,
} from "@/app/dashboard/admin/actions";
import type { Profile } from "@/lib/types";

export function MemberPermissionsRow({
  member,
  isSelf,
  hours,
}: {
  member: Profile;
  isSelf: boolean;
  hours: number;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState<string | null>(null);
  const [customPassword, setCustomPassword] = useState("");

  function handleReset() {
    if (!window.confirm(`Set a new password for ${member.full_name || "this member"}? Their old one stops working.`)) return;
    setError(null);
    setNewPassword(null);
    startTransition(async () => {
      try {
        setNewPassword(await resetMemberPassword(member.id, customPassword));
        setCustomPassword("");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Reset failed");
      }
    });
  }

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
          {hours > 0 && (
            <span className="ml-2 text-xs text-acacia-green">{hours} hrs</span>
          )}
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

          <label className="flex items-center gap-1.5">
            <input
              type="checkbox"
              checked={member.can_edit_calendar}
              disabled={isPending}
              onChange={(e) =>
                run(() => setMemberCanEditCalendar(member.id, e.target.checked))
              }
            />
            Calendar
          </label>

          <label className="flex items-center gap-1.5">
            <input
              type="checkbox"
              checked={member.is_pledge}
              disabled={isPending}
              onChange={(e) =>
                run(() => setMemberIsPledge(member.id, e.target.checked))
              }
            />
            Pledge
          </label>

          <label className="flex items-center gap-1.5">
            <input
              type="checkbox"
              checked={member.is_exec}
              disabled={isPending}
              onChange={(e) =>
                run(() => setMemberIsExec(member.id, e.target.checked))
              }
            />
            Exec
          </label>

          <label className="flex items-center gap-1.5">
            <input
              type="checkbox"
              checked={member.on_pledge_committee}
              disabled={isPending}
              onChange={(e) =>
                run(() => setMemberOnPledgeCommittee(member.id, e.target.checked))
              }
            />
            Pledge cmte
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

          <input
            value={customPassword}
            onChange={(e) => setCustomPassword(e.target.value)}
            placeholder="New password (blank = random)"
            className="w-48 rounded border border-surface-border px-1.5 py-0.5 text-xs"
          />
          <button
            type="button"
            disabled={isPending}
            onClick={handleReset}
            className="rounded border border-surface-border px-1.5 py-0.5 text-xs disabled:opacity-50"
          >
            Reset password
          </button>
        </div>
      </div>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      {newPassword && (
        <p className="mt-1 text-xs text-acacia-green">
          New password (share it directly, it won&apos;t be shown again):{" "}
          <code>{newPassword}</code>
        </p>
      )}
    </li>
  );
}
