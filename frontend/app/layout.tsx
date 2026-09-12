import type { Metadata, Viewport } from "next";
import { Mukta, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/auth";

/**
 * Mukta carries Devanagari and Latin in one family, which is the reason it was
 * chosen over a prettier Latin-only face: a Hindi report and its English
 * translation have to sit in the same paragraph without changing texture.
 *
 * Plex Mono carries every number, reference and timestamp. Figures line up
 * in a column when they are tabular, and a coordinator comparing scores down
 * a list is doing exactly that.
 */
const mukta = Mukta({
  subsets: ["latin", "devanagari"],
  weight: ["300", "400", "500", "600", "700", "800"],
  variable: "--font-mukta",
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "JharSetu — Government of Jharkhand",
    template: "%s · JharSetu",
  },
  description:
    "A district-level bridge from a citizen's report to a verified problem, a college's solution, a funded need, and delivered work. Department of Disaster Management, Government of Jharkhand.",
  applicationName: "JharSetu",
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0B2A4A",
  colorScheme: "light",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${mukta.variable} ${plexMono.variable}`}>
      <body>
        <a
          href="#main"
          className="btn sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50"
        >
          Skip to content
        </a>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
