"use client";

import { Moon, Sun, Sparkles, Compass } from "lucide-react";
import { CircadianAnalysis } from "@/lib/analytics/circadian";

interface CircadianCardProps {
  circadian: CircadianAnalysis;
}

export function CircadianCard({ circadian }: CircadianCardProps) {
  const {
    workdayMidpoint = "03:15",
    freeDayMidpoint = "04:30",
    socialJetlagMinutes = 75,
    socialJetlagHours = 1.3,
    socialJetlagSeverity = "mild",
    melatoninWindowStart = "20:30",
    melatoninWindowEnd = "22:00",
    optimalWakeWindowStart = "06:15",
    optimalWakeWindowEnd = "06:45",
    circadianAlignmentScore = 88,
    chronotype = "intermediate",
  } = circadian || {};

  const jetlagBadge = {
    minimal: "bg-emerald-950/70 text-emerald-300 border-emerald-800/40",
    mild: "bg-amber-950/70 text-amber-300 border-amber-800/40",
    moderate: "bg-orange-950/70 text-orange-300 border-orange-800/40",
    severe: "bg-rose-950/70 text-rose-300 border-rose-800/40",
  }[socialJetlagSeverity] || "bg-emerald-950/70 text-emerald-300 border-emerald-800/40";

  return (
    <div className="rounded-2xl border border-zinc-800/80 bg-[#0C0C0E] p-5 shadow-xl flex flex-col justify-between">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Compass className="w-4 h-4 text-violet-400" />
          <h3 className="font-semibold text-white text-base">Circadian Alignment</h3>
        </div>
        <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-mono font-medium bg-violet-950/70 text-violet-300 border border-violet-800/50">
          <Sparkles className="w-3 h-3 text-violet-400" />
          {circadianAlignmentScore}/100 Match
        </div>
      </div>

      {/* Midpoints & Social Jetlag */}
      <div className="my-4 grid grid-cols-2 gap-3">
        {/* Workday Midpoint */}
        <div className="p-3 rounded-xl bg-zinc-950/60 border border-zinc-800/60 flex flex-col justify-between">
          <span className="text-[11px] text-zinc-500 uppercase tracking-wider font-mono">Workday Midpoint</span>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="text-xl font-bold font-mono text-zinc-100">{workdayMidpoint}</span>
            <span className="text-[10px] text-zinc-500 font-mono">am</span>
          </div>
        </div>

        {/* Free Day Midpoint */}
        <div className="p-3 rounded-xl bg-zinc-950/60 border border-zinc-800/60 flex flex-col justify-between">
          <span className="text-[11px] text-zinc-500 uppercase tracking-wider font-mono">Free Day Midpoint</span>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="text-xl font-bold font-mono text-amber-300">{freeDayMidpoint}</span>
            <span className="text-[10px] text-zinc-500 font-mono">am</span>
          </div>
        </div>
      </div>

      {/* Social Jetlag Metric */}
      <div className="p-3 rounded-xl bg-zinc-950/80 border border-zinc-800/70 flex items-center justify-between mb-4">
        <div>
          <span className="text-xs font-medium text-zinc-300 block">Social Jetlag</span>
          <span className="text-[11px] text-zinc-500">Sleep phase shift on weekends</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold font-mono text-white">
            {socialJetlagMinutes} min
          </span>
          <span className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase font-semibold border ${jetlagBadge}`}>
            {socialJetlagSeverity}
          </span>
        </div>
      </div>

      {/* Circadian Gates: Melatonin & Optimal Wake */}
      <div className="grid grid-cols-2 gap-3 pt-2 border-t border-zinc-900">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-violet-950/50 border border-violet-800/40 flex items-center justify-center shrink-0">
            <Moon className="w-4 h-4 text-violet-400" />
          </div>
          <div>
            <span className="text-[10px] text-zinc-500 uppercase font-mono block">Melatonin Window</span>
            <span className="text-xs font-mono font-medium text-zinc-200">
              {melatoninWindowStart} - {melatoninWindowEnd}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-amber-950/50 border border-amber-800/40 flex items-center justify-center shrink-0">
            <Sun className="w-4 h-4 text-amber-400" />
          </div>
          <div>
            <span className="text-[10px] text-zinc-500 uppercase font-mono block">Optimal Wake</span>
            <span className="text-xs font-mono font-medium text-zinc-200">
              {optimalWakeWindowStart} - {optimalWakeWindowEnd}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
