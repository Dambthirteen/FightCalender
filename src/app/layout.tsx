import type { Metadata, Viewport } from "next";
import { Bebas_Neue, Sora } from "next/font/google";
import "./globals.css";
import { UserProvider } from "@/components/UserProvider";
import BottomNav from "@/components/BottomNav";

// Display: Fight-Poster-Optik (kondensiert, wuchtig). Body: Sora (eigenständig, klar).
const display = Bebas_Neue({ weight: "400", subsets: ["latin"], variable: "--font-display" });
const sans = Sora({ subsets: ["latin"], variable: "--font-body", display: "swap" });

export const metadata: Metadata = {
  title: "Fight Calendar",
  description: "NFT Köln — Wer kommt diese Woche?",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Fight Calendar",
    statusBarStyle: "black-translucent",
  },
};

// Sorgt im WebView/Simulator für App-Feeling: volle Gerätebreite,
// kein Pinch-Zoom, Inhalte bis unter die Notch (Safe-Area).
export const viewport: Viewport = {
  themeColor: "#0a0a0a",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de" className={`${display.variable} ${sans.variable}`}>
      <body className="min-h-screen">
        <UserProvider>
          {children}
          <BottomNav />
        </UserProvider>
      </body>
    </html>
  );
}
