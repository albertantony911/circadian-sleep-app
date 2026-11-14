"use client";

import { BiologicalMilestone } from "@/lib/science/circadian-copilot";
import { Sun, Focus, Moon, Coffee, Utensils, Zap, Clock } from "lucide-react";

interface CircadianTimelineBarProps {
  milestones: BiologicalMilestone[];
}

export function CircadianTimelineBar({ milestones }: CircadianTimelineBarProps) {
  const getCategoryIcon = (category: BiologicalMilestone["category"]) => {
    switch (category) {
      case "light":
        return Sun;
      case "focus":
        return Focus;
      case "nap":
        return Zap;
      case "caffeine":
        return Coffee;
      case "nutrition":
        return Utensils;
      case "sleep":
        return Moon;
      default:
        return Clock;
    }
  };

  return (
    <div className="rounded-2xl border border-zinc-800/80 bg-[#0C0C0E] p-5 shadow-xl space-y-4">
      <div className="flex items-center justify-between border-b border-zinc-900 pb-3">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-violet-400" />
          <h3 className="font-semibold text-white text-base">Live 24-Hour Circadian Co-Pilot</h3>
        </div>
        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-violet-950/70 text-violet-300 border border-violet-800/40">
          Process C Anchor
        </span>
      </div>

      {/* Milestones Horizontal / Grid Progress */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-2.5">
        {milestones.map((m) => {
          const Icon = getCategoryIcon(m.category);
          const isActive = m.status === "active";
          const isUpcoming = m.status === "upcoming";

          return (
            <div
              key={m.id}
              className={`p-3 rounded-xl border flex flex-col justify-between gap-2 transition-all relative overflow-hidden ${
                isActive
                  ? "bg-violet-950/40 border-violet-500/60 shadow-lg shadow-violet-900/20 ring-1 ring-violet-500/50"
                  : isUpcoming
                  ? "bg-zinc-950/70 border-zinc-800/80 hover:border-zinc-700"
                  : "bg-zinc-950/40 border-zinc-900 opacity-60"
              }`}
            >
              {isActive && (
                <div className="absolute top-1 right-1.5 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-[9px] font-mono text-emerald-400 font-semibold uppercase">Now</span>
                </div>
              )}

              <div className="space-y-1">
                <div className="flex items-center gap-1.5">
                  <Icon
                    className={`w-3.5 h-3.5 ${
                      isActive ? "text-violet-300" : isUpcoming ? "text-zinc-400" : "text-zinc-600"
                    }`}
                  />
                  <span
                    className={`text-xs font-semibold truncate ${
                      isActive ? "text-white" : "text-zinc-300"
                    }`}
                  >
                    {m.shortLabel}
                  </span>
                </div>
                <div className="text-[11px] font-mono text-amber-300/90 font-medium">
                  {m.timeWindow}
                </div>
              </div>

              <p className="text-[10px] text-zinc-400 leading-tight line-clamp-2">
                {m.actionTip}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
