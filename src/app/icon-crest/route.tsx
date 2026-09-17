import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";
import fs from "node:fs";
import path from "node:path";

export const runtime = "nodejs";

// Acacia's official coat of arms (downloaded from acacia.org, not
// recreated), composited onto a white square so it works as a home-screen
// icon — the source file is a tall rectangle (1275x1500), not square.
export async function GET(request: NextRequest) {
  const size = Number(request.nextUrl.searchParams.get("size")) || 512;

  const filePath = path.join(process.cwd(), "public/brand/crest-full-color.png");
  const buffer = fs.readFileSync(filePath);
  const dataUri = `data:image/png;base64,${buffer.toString("base64")}`;

  const width = size * 0.72;
  const height = width * (1500 / 1275);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#ffffff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={dataUri} width={width} height={height} alt="" />
      </div>
    ),
    { width: size, height: size },
  );
}
