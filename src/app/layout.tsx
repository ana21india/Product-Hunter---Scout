import type { Metadata, Viewport } from "next";
import { Inter, Inter_Tight, Caveat } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const interTight = Inter_Tight({ subsets: ["latin"], variable: "--font-tight", display: "swap", weight: ["500", "600", "700"] });
const caveat = Caveat({ subsets: ["latin"], variable: "--font-hand", display: "swap", weight: ["500", "600"] });

export const metadata: Metadata = {
  title: "Partnership Scout",
  description: "Ranked outreach list of Product Hunt launches from the last 7 days.",
};
export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${interTight.variable} ${caveat.variable}`}>
      <body>{children}</body>
    </html>
  );
}
