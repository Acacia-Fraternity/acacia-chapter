import type { Metadata } from "next";
import { Archivo, EB_Garamond } from "next/font/google";
import { cookies } from "next/headers";
import "./globals.css";

// Acacia's real brand typeface (Founders Grotesk, with Neue Helvetica as
// their own approved fallback) is commercial and can't be embedded here.
// Archivo is the closest free substitute — same grotesque-sans structure,
// full weight range (we use 500/600/700 to match Founders Grotesk's
// Medium/Semibold/Bold usage for body/subheads/headlines).
const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

// Chapter letters are carved in classical Roman-style serif capitals. Only the
// Greek subset is loaded, so this family covers Greek characters and anything
// else (the Latin text) falls through to Archivo.
const greekLetters = EB_Garamond({
  variable: "--font-greek",
  subsets: ["greek"],
  weight: ["600"],
});

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Acacia",
    description: "Chapter attendance, involvement, and chat tracker",
    // Setting `icons` here REPLACES Next's automatic <link rel="icon"> for
    // src/app/icon.svg, so the tab icon has to be declared explicitly or the
    // browser shows a blank globe. Safari ignores SVG favicons, hence the PNG.
    icons: {
      icon: [
        { url: "/icon.svg", type: "image/svg+xml" },
        { url: "/icon-mark?size=64", type: "image/png", sizes: "64x64" },
      ],
      apple: "/icon-mark?size=180",
    },
  };
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const cookieStore = await cookies();
  const theme = cookieStore.get("acacia-theme")?.value;
  const dataTheme = theme === "light" || theme === "dark" ? theme : undefined;

  return (
    <html
      lang="en"
      data-theme={dataTheme}
      className={`${archivo.variable} ${greekLetters.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans bg-background text-foreground">
        {children}
      </body>
    </html>
  );
}
