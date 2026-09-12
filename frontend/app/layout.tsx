import type { Metadata } from "next";
import { Mukta, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

const mukta = Mukta({
  variable: "--font-mukta",
  subsets: ["latin", "devanagari"],
  weight: ["300", "400", "500", "600", "700", "800"],
  display: "swap",
});

const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-ibm-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "JharSetu | From Local Need to Collective Action",
  description:
    "Government of Jharkhand Societal Challenge Exchange: Connecting citizen reports to university R&D, industry CSR funding, and verified impact.",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${mukta.variable} ${ibmPlexMono.variable}`}>
      <body className="min-h-screen flex flex-col bg-[#F4F6F5] text-[#102027]">
        {children}
      </body>
    </html>
  );
}
