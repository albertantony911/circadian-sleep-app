"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard,
  Radio,
  SlidersHorizontal,
  Moon,
  Zap,
  Menu,
  X,
  RefreshCw,
} from "lucide-react";

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  const navItems = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard },
    { href: "/settings/sources", label: "Sources & Sync", icon: Radio },
    { href: "/settings/schedule", label: "Schedule & Rhythm", icon: SlidersHorizontal },
  ];

  const handleQuickSync = async () => {
    try {
      setSyncing(true);
      setSyncMessage(null);
      const res = await fetch("/api/sync/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: "fitbit" }),
      });
      const data = await res.json();
      if (res.status === 429) {
        setSyncMessage(data.message || data.error || "Rate limited");
      } else if (data.success) {
        setSyncMessage("Sync completed");
        window.location.reload();
      }
    } catch {
      setSyncMessage("Sync failed");
    } finally {
      setSyncing(false);
      setTimeout(() => setSyncMessage(null), 4000);
    }
  };

  return (
    <div className="min-h-screen bg-[#09090B] text-zinc-100 flex flex-col md:flex-row antialiased selection:bg-violet-600/30 selection:text-violet-200">
      {/* Desktop Sidebar (>= 768px) */}
      <aside className="hidden md:flex flex-col w-64 border-r border-zinc-800/80 bg-[#0C0C0E] p-5 shrink-0 justify-between">
        <div className="space-y-6">
          {/* Logo & Brand */}
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-violet-600 via-indigo-600 to-amber-500 p-[1px] shadow-lg shadow-violet-900/20">
              <div className="w-full h-full bg-[#09090B] rounded-[11px] flex items-center justify-center group-hover:bg-transparent transition-colors">
                <Moon className="w-5 h-5 text-violet-400 group-hover:text-white transition-colors" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-semibold tracking-tight text-white text-base">Nadir</span>
                <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-violet-950/80 text-violet-300 border border-violet-800/50">
                  PWA
                </span>
              </div>
              <p className="text-xs text-zinc-500 font-mono">Circadian Engine</p>
            </div>
          </Link>

          {/* Navigation Links */}
          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    isActive
                      ? "bg-violet-950/40 text-violet-300 border border-violet-800/40 shadow-sm shadow-violet-900/30"
                      : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60 border border-transparent"
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? "text-violet-400" : "text-zinc-500"}`} />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Quick Sync & Ingestion Status */}
        <div className="space-y-3 pt-6 border-t border-zinc-900">
          <div className="p-3 rounded-lg bg-zinc-950/80 border border-zinc-800/60">
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="text-zinc-400 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Cloud Shield
              </span>
              <span className="text-[10px] font-mono text-zinc-500">Rate-Proof</span>
            </div>
            <button
              onClick={handleQuickSync}
              disabled={syncing}
              className="w-full flex items-center justify-center gap-2 py-2 px-3 text-xs font-medium rounded-md bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-700/60 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-violet-400 ${syncing ? "animate-spin" : ""}`} />
              {syncing ? "Syncing Delta..." : "Sync Delta Now"}
            </button>
            {syncMessage && (
              <p className="mt-1.5 text-[11px] text-center text-amber-400/90 font-mono">
                {syncMessage}
              </p>
            )}
          </div>

          <div className="flex items-center justify-between px-1 text-[11px] text-zinc-500">
            <span>Health Connect Bridge</span>
            <span className="font-mono text-emerald-400 text-[10px]">Active</span>
          </div>
        </div>
      </aside>

      {/* Mobile Top Header (< 768px) */}
      <header className="md:hidden flex items-center justify-between px-4 py-3 border-b border-zinc-800/80 bg-[#0C0C0E] sticky top-0 z-40">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-violet-600 to-amber-500 p-[1px]">
            <div className="w-full h-full bg-[#09090B] rounded-[7px] flex items-center justify-center">
              <Moon className="w-4 h-4 text-violet-400" />
            </div>
          </div>
          <div>
            <span className="font-semibold tracking-tight text-white text-sm">Nadir</span>
            <span className="text-[9px] font-mono ml-1.5 text-violet-400">SLEEP</span>
          </div>
        </Link>
        <button
          onClick={handleQuickSync}
          disabled={syncing}
          className="flex items-center gap-1.5 text-xs py-1.5 px-3 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-300 font-medium active:scale-95 transition-transform"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-violet-400 ${syncing ? "animate-spin" : ""}`} />
          {syncing ? "Syncing" : "Sync"}
        </button>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto pb-20 md:pb-6 p-4 md:p-8 max-w-7xl mx-auto w-full">
        {children}
      </main>

      {/* Mobile Bottom Navigation Bar (< 768px, 44px min tap targets, safe-area padding) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#0C0C0E]/95 backdrop-blur-md border-t border-zinc-800/90 flex items-center justify-around px-2 py-2 safe-area-pb">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center min-w-[64px] min-h-[48px] px-3 py-1 rounded-xl transition-all ${
                isActive
                  ? "text-violet-400 font-semibold"
                  : "text-zinc-500 hover:text-zinc-300 font-normal"
              }`}
            >
              <Icon className={`w-5 h-5 mb-0.5 ${isActive ? "text-violet-400" : "text-zinc-500"}`} />
              <span className="text-[11px] tracking-tight">{item.label.split(" ")[0]}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
