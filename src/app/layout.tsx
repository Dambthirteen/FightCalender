import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { UserProvider } from "@/components/UserProvider";

const geist = Geist({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Fight Calendar",
  description: "NFT Köln — Wer kommt diese Woche?",
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
