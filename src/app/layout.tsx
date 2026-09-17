import type { Metadata } from "next";
import { Archivo } from "next/font/google";
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

export async function generateMetadata(): Promise<Metadata> {
  const cookieStore = await cookies();
  const icon = cookieStore.get("acacia-icon")?.value === "crest" ? "icon-crest" : "icon-mark";

  return {
    title: "Acacia",
    description: "Chapter attendance, involvement, and chat tracker",
    icons: {
      apple: `/${icon}?size=180`,
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
      className={`${archivo.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans bg-background text-foreground">
        {children}
      </body>
    </html>
  );
}
