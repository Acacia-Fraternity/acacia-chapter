"use client";

import { useState, useTransition } from "react";
import { setRolePermission } from "@/app/dashboard/admin/actions";
import { PERMISSIONS, ROLES, type Role } from "@/lib/permissions";

export function RoleAccessMatrix({
  stored,
}: {
  stored: { role: string; permission: string; allowed: boolean }[];
}) {
  const [values, setValues] = useState(
    () => new Map(stored.map((r) => [`${r.role}:${r.permission}`, r.allowed])),
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function isOn(role: Role, key: string, fallback: boolean) {
    return values.get(`${role}:${key}`) ?? fallback;
  }

  function toggle(role: Role, key: string, next: boolean) {
    setError(null);
    const id = `${role}:${key}`;
    const previous = values.get(id);
    setValues((m) => new Map(m).set(id, next));
    startTransition(async () => {
      try {
        await setRolePermission(role, key, next);
      } catch (err) {
        // Put the box back so the screen never claims a change that didn't save.
        setValues((m) => {
          const copy = new Map(m);
          if (previous === undefined) copy.delete(id);
          else copy.set(id, previous);
          return copy;
        });
        setError(err instanceof Error ? err.message : "Couldn't save");
      }
    });
  }

  const groups = ["Tabs", "Chat channels", "Actions"] as const;

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border border-surface-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-surface-border text-left text-xs text-muted">
              <th className="px-3 py-2 font-medium">Access</th>
              {ROLES.map((r) => (
                <th key={r.value} className="w-20 px-3 py-2 text-center font-medium">
                  {r.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {groups.map((group) => (
              <FragmentRows key={group} group={group} isOn={isOn} toggle={toggle} pending={pending} />
            ))}
          </tbody>
        </table>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <p className="text-xs text-muted-foreground">
        Changes save as you tick them. Admins always have full access. A person&apos;s role comes
        from their Pledge / Exec boxes below (neither = Active). Per-person boxes like Chat,
        React, Calendar and Pledge cmte still apply on top of this.
      </p>
    </div>
  );
}

function FragmentRows({
  group,
  isOn,
  toggle,
  pending,
}: {
  group: string;
  isOn: (role: Role, key: string, fallback: boolean) => boolean;
  toggle: (role: Role, key: string, next: boolean) => void;
  pending: boolean;
}) {
  return (
    <>
      <tr className="bg-surface-border/40">
        <td colSpan={4} className="px-3 py-1 text-xs font-semibold uppercase tracking-wide text-muted">
          {group}
        </td>
      </tr>
      {PERMISSIONS.filter((p) => p.group === group).map((p) => (
        <tr key={p.key} className="border-t border-surface-border">
          <td className="px-3 py-1.5">{p.label}</td>
          {ROLES.map((r) => (
            <td key={r.value} className="px-3 py-1.5 text-center">
              <input
                type="checkbox"
                checked={isOn(r.value, p.key, p.defaults[r.value])}
                disabled={pending}
                onChange={(e) => toggle(r.value, p.key, e.target.checked)}
                aria-label={`${p.label} for ${r.label}`}
              />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}
