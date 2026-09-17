import { createClient } from "@/lib/supabase/server";
import { upsertParkingSpot, clearParkingSpot } from "./actions";
import type { Profile, ParkingSpot } from "@/lib/types";

export default async function ParkingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: profile }, { data: profiles }, { data: spots }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user!.id).single<Profile>(),
    supabase.from("profiles").select("*").order("full_name").returns<Profile[]>(),
    supabase.from("parking_spots").select("*").returns<ParkingSpot[]>(),
  ]);

  const isAdmin = profile?.role === "admin";
  const spotByUserId = new Map((spots ?? []).map((s) => [s.user_id, s]));

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Parking</h1>
      <p className="text-sm text-muted-foreground">
        Everyone can see who&apos;s parked where. You can edit your own entry —
        admins can edit anyone&apos;s.
      </p>

      <ul className="space-y-2">
        {profiles?.map((member) => {
          const spot = spotByUserId.get(member.id);
          const canEdit = member.id === user!.id || isAdmin;

          return (
            <li key={member.id} className="rounded-lg border border-surface-border p-3">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-medium text-sm">
                    {member.full_name || "(no name set)"}
                  </p>
                  {spot && (spot.spot_number || spot.license_plate || spot.make_model) ? (
                    <p className="text-sm text-muted mt-0.5">
                      {spot.spot_number && <>Spot {spot.spot_number}</>}
                      {spot.spot_number && (spot.license_plate || spot.make_model) && " · "}
                      {spot.license_plate && <>{spot.license_plate}</>}
                      {spot.license_plate && spot.make_model && " · "}
                      {spot.make_model}
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground mt-0.5">
                      No parking info on file
                    </p>
                  )}
                  {spot?.notes && (
                    <p className="text-xs text-muted-foreground mt-0.5">{spot.notes}</p>
                  )}
                </div>

                {canEdit && (
                  <details className="shrink-0">
                    <summary className="cursor-pointer text-xs text-acacia-blue">
                      Edit
                    </summary>
                    <form
                      action={upsertParkingSpot.bind(null, member.id)}
                      className="mt-2 space-y-2 w-56"
                    >
                      <input
                        name="spot_number"
                        placeholder="Spot number"
                        defaultValue={spot?.spot_number ?? ""}
                        className="w-full rounded-md border border-surface-border px-2 py-1 text-xs"
                      />
                      <input
                        name="license_plate"
                        placeholder="License plate"
                        defaultValue={spot?.license_plate ?? ""}
                        className="w-full rounded-md border border-surface-border px-2 py-1 text-xs"
                      />
                      <input
                        name="make_model"
                        placeholder="Make/model/color"
                        defaultValue={spot?.make_model ?? ""}
                        className="w-full rounded-md border border-surface-border px-2 py-1 text-xs"
                      />
                      <input
                        name="notes"
                        placeholder="Notes (optional)"
                        defaultValue={spot?.notes ?? ""}
                        className="w-full rounded-md border border-surface-border px-2 py-1 text-xs"
                      />
                      <div className="flex items-center gap-3">
                        <button
                          type="submit"
                          className="rounded-md bg-acacia-gold text-acacia-black px-2 py-1 text-xs font-semibold"
                        >
                          Save
                        </button>
                        {spot && (
                          <button
                            formAction={clearParkingSpot.bind(null, member.id)}
                            className="text-xs text-red-600"
                          >
                            Clear
                          </button>
                        )}
                      </div>
                    </form>
                  </details>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
