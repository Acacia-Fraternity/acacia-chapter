import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Acacia",
    short_name: "Acacia",
    description: "Chapter attendance, involvement, and chat tracker",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#1e1e1e",
    theme_color: "#1e1e1e",
    icons: [
      { src: "/icon-mark?size=192", sizes: "192x192", type: "image/png" },
      { src: "/icon-mark?size=512", sizes: "512x512", type: "image/png" },
    ],
  };
}
