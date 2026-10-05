import type { NextRequest } from "next/server";

// Browsers fetch <link rel="manifest"> without cookies, so the home-screen
// icon choice can't come from the acacia-icon cookie here (it silently always
// served the A). layout.tsx puts the choice in this URL's query string instead.
export function GET(request: NextRequest) {
  const icon =
    request.nextUrl.searchParams.get("icon") === "crest" ? "icon-crest" : "icon-mark";

  return Response.json(
    {
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
    },
    {
      headers: {
        "content-type": "application/manifest+json",
        "cache-control": "no-store",
      },
    },
  );
}
