"use client";

import { useState } from "react";
import { Clock, ShieldCheck } from "lucide-react";

interface ConsistencyItem {
  date: string;
  dayName: string;
  startHours: number;
  endHours: number;
  durationHours: number;
  sleepScore: number;
  efficiency: number;
  source: string;
}

interface ConsistencyChartProps {
  data: ConsistencyItem[];
  targetBedHours?: number; // e.g. 22.5 (22:30)
  targetWakeHours?: number; // e.g. 6.5 (06:30)
}

export function ConsistencyChart({
  data = [],
  targetBedHours = 22.5,
  targetWakeHours = 6.5,
}: ConsistencyChartProps) {
  const [activeTooltip, setActiveTooltip] = useState<ConsistencyItem | null>(null);

  // Normalize hour position on a 20:00 (8pm) to 12:00 (12pm noon) scale (16 hours window)
  // Scale range: 20.0 to 36.0 (where next day 06:00 is 30.0, 12:00 is 36.0)
  const scaleStart = 20.0;
  const scaleTotalHours = 16.0;

  function toScaleOffset(hour: number) {
    let normalized = hour;
    if (normalized < 14) normalized += 24; // e.g. 06:30 -> 30.5
    const pct = ((normalized - scaleStart) / scaleTotalHours) * 100;
    return Math.max(0, Math.min(100, pct));
  }

  const targetLeft = toScaleOffset(targetBedHours);
  const targetRight = toScaleOffset(targetWakeHours);
  const targetWidth = Math.max(5, targetRight - targetLeft);

  return (
    <div className="rounded-2xl border border-zinc-800/80 bg-[#0C0C0E] p-5 shadow-xl space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-violet-400" />
            <h3 className="font-semibold text-white text-base">Sleep Window Consistency</h3>
          </div>
          <p className="text-xs text-zinc-400 mt-0.5">
            Actual sleep onset & wake time vs. your scheduled target window
          </p>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 text-xs font-mono">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-2 rounded bg-violet-500" />
            <span className="text-zinc-400">Actual Sleep</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-2 rounded border border-dashed border-zinc-600 bg-zinc-800/40" />
            <span className="text-zinc-500">Target (22:30 - 06:30)</span>
          </div>
        </div>
      </div>

      {/* Target guideline background indicator */}
      <div className="space-y-2.5 pt-2">
        {data.map((item) => {
          const sleepLeft = toScaleOffset(item.startHours);
          const sleepRight = toScaleOffset(item.endHours);
          const sleepWidth = Math.max(4, sleepRight - sleepLeft);

          return (
            <div
              key={item.date}
              className="group relative flex items-center gap-3 text-xs"
              onMouseEnter={() => setActiveTooltip(item)}
              onMouseLeave={() => setActiveTooltip(null)}
            >
              {/* Day Label */}
              <div className="w-12 text-zinc-400 font-mono text-[11px] shrink-0">
                <span className="text-zinc-200 font-semibold">{item.dayName}</span>{" "}
                <span className="text-zinc-600 text-[10px]">{item.date.slice(5)}</span>
              </div>

              {/* Bar track (20:00 to 12:00) */}
              <div className="flex-1 h-7 bg-zinc-950/80 rounded-lg relative overflow-hidden border border-zinc-900">
                {/* Target Scheduled Band */}
                <div
                  className="absolute top-0 bottom-0 border-x border-dashed border-zinc-700/60 bg-zinc-900/40"
                  style={{ left: `${targetLeft}%`, width: `${targetWidth}%` }}
                />

                {/* Actual Sleep Duration Bar */}
                <div
                  className="absolute top-1 bottom-1 rounded-md bg-gradient-to-r from-violet-600 to-indigo-500 hover:from-violet-500 hover:to-indigo-400 transition-all shadow-md flex items-center justify-between px-2 cursor-pointer"
                  style={{ left: `${sleepLeft}%`, width: `${sleepWidth}%` }}
                >
                  <span className="text-[10px] font-mono text-white/90 font-medium truncate">
                    {item.durationHours}h
                  </span>
                  <span className="text-[9px] font-mono text-violet-200 bg-violet-950/80 px-1 rounded hidden sm:inline">
                    {item.sleepScore} pts
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Time ticks scale at bottom */}
      <div className="flex justify-between items-center text-[10px] font-mono text-zinc-500 pt-2 border-t border-zinc-900">
        <span>20:00 (8 PM)</span>
        <span>23:00</span>
        <span>02:00</span>
        <span>05:00</span>
        <span>08:00</span>
        <span>11:00</span>
      </div>

      {/* Active Hover Tooltip */}
      {activeTooltip && (
        <div className="p-3 rounded-xl bg-zinc-900/90 border border-zinc-700 text-xs text-zinc-300 flex items-center justify-between backdrop-blur-md">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-white font-mono">{activeTooltip.date}</span>
            <span className="text-violet-400 font-mono">
              Score: {activeTooltip.sleepScore}/100
            </span>
            <span className="text-zinc-400">Efficiency: {activeTooltip.efficiency}%</span>
          </div>
          <div className="text-[11px] font-mono text-zinc-400 flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            Source: {activeTooltip.source}
          </div>
        </div>
      )}
    </div>
  );
}
