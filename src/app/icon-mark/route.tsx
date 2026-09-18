import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";

export const runtime = "nodejs";

// The same official "A" mark as src/app/icon.svg (the browser tab favicon),
// re-rendered at whatever pixel size the caller asks for — used by
// manifest.ts (Android/Chrome "Add to Home Screen") and the apple-touch-icon
// link (iOS), both of which need real raster images, not an SVG file.
export async function GET(request: NextRequest) {
  const size = Number(request.nextUrl.searchParams.get("size")) || 512;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#F9E547",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <svg width={size * 0.72} height={size * 0.72} viewBox="0 0 800 800">
          <path
            fill="#1E1E1E"
            d="M515.46,505.43l-90.24-228.34h-85.81l12.89,32.04l-42.76,112.27c-2.18,0.17-4.41,0.29-6.2,0.29
	c-21.55,0-39.3-16.08-42.02-36.89c-1.2,0.3-6.52,1.37-13.13,5.51c-13.43,8.22-22.43,22.98-22.43,39.89
	c0,25.83,22.49,46.58,48.32,47.31c2.24,0.09,7.97-0.06,14.5-1.05l-11.04,28.98c-5.07,10.66-22.5,12.8-36.71,13.63v16.57h96.01
	v-16.57c-18.79-1.47-26-4.79-26-16.95c0-3.68,1.1-8.1,2.95-13.26l8.33-24.99c5.34-2.68,10.9-5.57,17.13-8.8
	c10.24-5.24,23.81-11.5,38.94-14.36c20.2-3.82,28.12,4.25,31.06,9.42l3.09,7.8l11.79,30.2c1.84,5.52,2.95,9.94,2.95,13.63
	c0,12.52-11.05,16.57-27.99,17.31v16.57h138.12v-16.57C526.51,517.21,519.14,514.64,515.46,505.43z M375.06,416.08
	c-10.9-1.06-24.26,0.46-37.54,2.15l28.04-80.01,32.93,84.54C393.28,419.92,390.04,417.54,375.06,416.08z"
          />
        </svg>
      </div>
    ),
    { width: size, height: size },
  );
}
