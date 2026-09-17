import type { MetadataRoute } from "next";
import { cookies } from "next/headers";

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const cookieStore = await cookies();
  const icon = cookieStore.get("acacia-icon")?.value === "crest" ? "icon-crest" : "icon-mark";

  return {
    name: "Acacia",
    short_name: "Acacia",
    description: "Chapter attendance, involvement, and chat tracker",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#1e1e1e",
    theme_color: "#1e1e1e",
    icons: [
      { src: `/${icon}?size=192`, sizes: "192x192", type: "image/png" },
      { src: `/${icon}?size=512`, sizes: "512x512", type: "image/png" },
    ],
  };
}
