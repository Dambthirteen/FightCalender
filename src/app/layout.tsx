import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { UserProvider } from "@/components/UserProvider";

const geist = Geist({ subsets: ["latin"] });

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
    <html lang="de" className={geist.className}>
      <body className="min-h-screen bg-[#0a0a0a]">
        <UserProvider>{children}</UserProvider>
      </body>
    </html>
  );
}
