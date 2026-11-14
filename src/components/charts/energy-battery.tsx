"use client";

import { BatteryCharging, Battery, Zap, Info } from "lucide-react";

interface EnergyBatteryProps {
  batteryPct: number;
  decayedDebtHours: number;
  cumulativeDebtHours: number;
  statusLabel: string;
  status: "surplus" | "optimal" | "mild" | "moderate" | "severe";
  advice: string;
}

export function EnergyBatteryGauge({
  batteryPct = 92,
  decayedDebtHours = 0.8,
  cumulativeDebtHours = 1.2,
  statusLabel = "Well Rested",
  status = "optimal",
  advice = "Low sleep debt. Your natural circadian alertness is strong.",
}: EnergyBatteryProps) {
  // Theme styling based on status
  const theme = {
    surplus: {
      color: "from-emerald-500 to-teal-400",
      text: "text-emerald-400",
      badge: "bg-emerald-950/60 text-emerald-300 border-emerald-800/40",
      border: "border-emerald-500/30",
    },
    optimal: {
      color: "from-emerald-500 to-emerald-400",
      text: "text-emerald-400",
      badge: "bg-emerald-950/60 text-emerald-300 border-emerald-800/40",
      border: "border-emerald-500/30",
    },
    mild: {
      color: "from-amber-500 to-yellow-400",
      text: "text-amber-400",
      badge: "bg-amber-950/60 text-amber-300 border-amber-800/40",
      border: "border-amber-500/30",
    },
    moderate: {
      color: "from-orange-500 to-amber-500",
      text: "text-orange-400",
      badge: "bg-orange-950/60 text-orange-300 border-orange-800/40",
      border: "border-orange-500/30",
    },
    severe: {
      color: "from-rose-600 to-red-500",
      text: "text-rose-400",
      badge: "bg-rose-950/60 text-rose-300 border-rose-800/40",
      border: "border-rose-500/30",
    },
  }[status] || {
    color: "from-emerald-500 to-emerald-400",
    text: "text-emerald-400",
    badge: "bg-emerald-950/60 text-emerald-300 border-emerald-800/40",
    border: "border-emerald-500/30",
  };

  return (
    <div className="rounded-2xl border border-zinc-800/80 bg-[#0C0C0E] p-5 shadow-xl flex flex-col justify-between">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-amber-400" />
          <h3 className="font-semibold text-white text-base">Energy Battery</h3>
        </div>
        <span className={`px-2.5 py-0.5 rounded-full text-xs font-mono font-medium border ${theme.badge}`}>
          {statusLabel}
        </span>
      </div>

      {/* Main Gauge Graphic */}
      <div className="my-5 flex items-center gap-6">
        {/* Battery Container */}
        <div className="relative flex items-center">
          <div className="w-16 h-28 rounded-xl border-2 border-zinc-700 bg-zinc-950 p-1 flex flex-col justify-end overflow-hidden shadow-inner">
            {/* Battery Liquid Level */}
            <div
              className={`w-full rounded-lg bg-gradient-to-t ${theme.color} transition-all duration-700`}
              style={{ height: `${batteryPct}%` }}
            />
          </div>
          {/* Battery Positive Terminal */}
          <div className="w-4 h-2 bg-zinc-700 rounded-t-sm absolute -top-2 left-1/2 transform -translate-x-1/2" />
        </div>

        {/* Numeric Readout */}
        <div className="space-y-1">
          <div className="flex items-baseline gap-1.5">
            <span className="text-4xl font-bold tracking-tight text-white font-mono">
              {batteryPct}%
            </span>
            <span className="text-xs text-zinc-500 font-mono">capacity</span>
          </div>
          <p className="text-xs text-zinc-400">
            Weighted sleep debt:{" "}
            <span className={`font-mono font-semibold ${theme.text}`}>
              {decayedDebtHours > 0 ? `+${decayedDebtHours}h` : `${decayedDebtHours}h`}
            </span>
          </p>
          <p className="text-[11px] text-zinc-500 font-mono">
            14-day total unweighted: {cumulativeDebtHours}h
          </p>
        </div>
      </div>

      {/* Advice Pill */}
      <div className="p-3 rounded-xl bg-zinc-950/70 border border-zinc-800/70 text-xs text-zinc-300 flex items-start gap-2.5">
        <Info className="w-4 h-4 text-violet-400 shrink-0 mt-0.5" />
        <p className="leading-relaxed">{advice}</p>
      </div>
    </div>
  );
}
