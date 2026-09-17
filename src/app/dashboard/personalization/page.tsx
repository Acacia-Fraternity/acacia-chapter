import { cookies } from "next/headers";
import { PersonalizationForm } from "@/components/personalization-form";

export default async function PersonalizationPage() {
  const cookieStore = await cookies();
  const themeCookie = cookieStore.get("acacia-theme")?.value;
  const iconCookie = cookieStore.get("acacia-icon")?.value;

  const initialTheme =
    themeCookie === "light" || themeCookie === "dark" ? themeCookie : "system";
  const initialIcon = iconCookie === "crest" ? "crest" : "mark";

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Personalization</h1>
      <PersonalizationForm initialTheme={initialTheme} initialIcon={initialIcon} />
    </div>
  );
}
