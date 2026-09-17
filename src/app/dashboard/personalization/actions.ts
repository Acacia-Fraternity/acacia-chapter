"use server";

import { cookies } from "next/headers";

const ONE_YEAR = 60 * 60 * 24 * 365;

export async function setTheme(theme: "light" | "dark" | "system") {
  const cookieStore = await cookies();
  cookieStore.set("acacia-theme", theme, { maxAge: ONE_YEAR, path: "/" });
}

export async function setIconPreference(icon: "mark" | "crest") {
  const cookieStore = await cookies();
  cookieStore.set("acacia-icon", icon, { maxAge: ONE_YEAR, path: "/" });
}
