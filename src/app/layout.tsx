import type { Metadata } from "next";
import { Archivo } from "next/font/google";
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

export const metadata: Metadata = {
  title: "Acacia",
  description: "Chapter attendance and involvement tracker",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${archivo.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
