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

  // One dropdown per tab, in the catalog's order.
  const groups = Array.from(new Set(PERMISSIONS.map((p) => p.group)));

  return (
    <div className="space-y-2">
      {groups.map((group) => {
        const perms = PERMISSIONS.filter((p) => p.group === group);
        return (
          <details key={group} className="rounded-lg border border-surface-border">
            <summary className="flex cursor-pointer items-center justify-between gap-3 px-3 py-2.5 text-sm font-medium">
              <span>{group}</span>
              <span className="flex gap-3 text-xs font-normal text-muted-foreground">
                {ROLES.map((r) => {
                  const on = perms.filter((p) => isOn(r.value, p.key, p.defaults[r.value])).length;
                  return (
                    <span key={r.value}>
                      {r.label} {on}/{perms.length}
                    </span>
                  );
                })}
              </span>
            </summary>

            <table className="w-full border-t border-surface-border text-sm">
              <thead>
                <tr className="text-left text-xs text-muted">
                  <th className="px-3 py-1.5 font-medium">Setting</th>
                  {ROLES.map((r) => (
                    <th key={r.value} className="w-20 px-3 py-1.5 text-center font-medium">
                      {r.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {perms.map((p) => {
                  const label = p.path ? `Open the ${p.label} tab` : p.label;
                  return (
                    <tr key={p.key} className="border-t border-surface-border">
                      <td className="px-3 py-1.5">{label}</td>
                      {ROLES.map((r) => (
                        <td key={r.value} className="px-3 py-1.5 text-center">
                          <input
                            type="checkbox"
                            checked={isOn(r.value, p.key, p.defaults[r.value])}
                            disabled={pending}
                            onChange={(e) => toggle(r.value, p.key, e.target.checked)}
                            aria-label={`${label} for ${r.label}`}
                          />
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </details>
        );
      })}
      {error && <p className="text-xs text-red-600">{error}</p>}
      <p className="text-xs text-muted-foreground">
        Open a tab to change its settings; changes save as you tick them. The counts show how many
        of that tab&apos;s settings each role has on. Admins always have full access. A person&apos;s
        role comes from their Pledge / Exec boxes below (neither = Active). Per-person boxes like
        Chat, React, Calendar and Pledge cmte still apply on top of this.
      </p>
    </div>
  );
}
