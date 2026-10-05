import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { PersonalizationForm } from "@/components/personalization-form";
import { NotificationSettings } from "@/components/notification-settings";

export default async function PersonalizationPage() {
  const cookieStore = await cookies();
  const themeCookie = cookieStore.get("acacia-theme")?.value;

  const initialTheme =
    themeCookie === "light" || themeCookie === "dark" ? themeCookie : "system";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: prefs } = await supabase
    .from("notification_prefs")
    .select("*")
    .eq("user_id", user!.id)
    .maybeSingle();

  return (
    <div className="space-y-8 max-w-md">
      <h1 className="text-lg font-semibold">Personalization</h1>
      <PersonalizationForm initialTheme={initialTheme} />
      <NotificationSettings
        userId={user!.id}
        initial={{
          remind_15m: prefs?.remind_15m ?? false,
          remind_1h: prefs?.remind_1h ?? false,
          remind_1d: prefs?.remind_1d ?? false,
        }}
        initialSubscriptions={prefs?.push_subscriptions ?? []}
        vapidPublicKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ""}
      />
    </div>
  );
}
