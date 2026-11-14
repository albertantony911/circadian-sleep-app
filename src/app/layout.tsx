import type { Metadata, Viewport } from "next";
import { AppShell } from "@/components/layout/app-shell";
import { PwaRegister } from "@/components/pwa-register";
import "./globals.css";

export const metadata: Metadata = {
  title: "Nadir • Circadian & Sleep Engine",
  description: "Minimalist, rate-limit proof circadian rhythm tracking, sleep debt modeling, and hypnograms.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Nadir Sleep",
  },
};

export const viewport: Viewport = {
  themeColor: "#09090B",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark bg-[#09090B]">
      <body className="bg-[#09090B] text-zinc-100 min-h-screen">
        <PwaRegister />
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
