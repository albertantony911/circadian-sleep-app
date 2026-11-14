"use client";

import { useState } from "react";
import { format } from "date-fns";

export interface StageItem {
  id: string;
  stage: "awake" | "light" | "deep" | "rem";
  startTime: string | Date;
  endTime: string | Date;
  durationSeconds: number;
}

interface HypnogramProps {
  stages: StageItem[];
  startTime?: string | Date;
  endTime?: string | Date;
  totalDurationMinutes?: number;
  sleepEfficiency?: number;
  sleepScore?: number;
}

const STAGE_CONFIG = {
  awake: {
    label: "Awake",
    yLevel: 0,
    color: "#F59E0B",
    bgClass: "bg-amber-500",
    textClass: "text-amber-400",
    borderClass: "border-amber-500/30",
  },
  rem: {
    label: "REM",
    yLevel: 1,
    color: "#A78BFA",
    bgClass: "bg-violet-400",
    textClass: "text-violet-300",
    borderClass: "border-violet-500/30",
  },
  light: {
    label: "Light",
    yLevel: 2,
    color: "#38BDF8",
    bgClass: "bg-sky-400",
    textClass: "text-sky-300",
    borderClass: "border-sky-500/30",
  },
  deep: {
    label: "Deep",
    yLevel: 3,
    color: "#6366F1",
    bgClass: "bg-indigo-500",
    textClass: "text-indigo-400",
    borderClass: "border-indigo-500/30",
  },
};

export function Hypnogram({
  stages = [],
  startTime,
  endTime,
  totalDurationMinutes = 480,
  sleepEfficiency = 88,
  sleepScore = 86,
}: HypnogramProps) {
  const [hoveredStage, setHoveredStage] = useState<{
    stage: string;
    start: string;
    end: string;
    durationMins: number;
    pct: number;
    x: number;
  } | null>(null);

  if (!stages || stages.length === 0) {
    return (
      <div className="h-64 rounded-xl border border-zinc-800 bg-[#0C0C0E] flex flex-col items-center justify-center text-zinc-500">
        <p className="text-sm">No stage intervals available for this night</p>
        <p className="text-xs text-zinc-600 mt-1">Sync your wearable to view micro-stage hypnograms</p>
      </div>
    );
  }

  // Calculate session timeline bounds
  const firstStageStart = new Date(stages[0].startTime).getTime();
  const lastStageEnd = new Date(stages[stages.length - 1].endTime).getTime();
  const totalSessionMs = Math.max(1, lastStageEnd - firstStageStart);

  // Compute stage aggregates
  const stageDurations: Record<string, number> = { awake: 0, rem: 0, light: 0, deep: 0 };
  stages.forEach((s) => {
    stageDurations[s.stage] = (stageDurations[s.stage] || 0) + s.durationSeconds;
  });

  const totalStageSec = Object.values(stageDurations).reduce((a, b) => a + b, 0);

  // SVG dimensions
  const svgWidth = 800;
  const svgHeight = 160;
  const rowHeight = svgHeight / 4;

  return (
    <div className="rounded-2xl border border-zinc-800/80 bg-[#0C0C0E] p-5 shadow-xl space-y-5">
      {/* Header Info */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-900 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-white text-base">Last Night Hypnogram</h3>
            <span className="px-2 py-0.5 rounded-full text-xs font-mono font-medium bg-indigo-950/70 text-indigo-300 border border-indigo-800/50">
              Score: {sleepScore}
            </span>
          </div>
          <p className="text-xs text-zinc-400 mt-0.5 font-mono">
            {startTime ? format(new Date(startTime), "EEE, MMM d • HH:mm") : "Last Night"} →{" "}
            {endTime ? format(new Date(endTime), "HH:mm") : ""} (
            {Math.floor(totalDurationMinutes / 60)}h {totalDurationMinutes % 60}m)
          </p>
        </div>

        <div className="flex items-center gap-3 text-xs">
          <div className="text-right">
            <span className="text-zinc-500 text-[11px] block">Efficiency</span>
            <span className="font-semibold text-zinc-200">{sleepEfficiency}%</span>
          </div>
        </div>
      </div>

      {/* Interactive SVG Hypnogram */}
      <div className="relative">
        {/* Stage Labels on Y-Axis */}
        <div className="absolute left-0 top-0 bottom-6 w-16 flex flex-col justify-between py-1 text-[11px] font-mono text-zinc-500 select-none pointer-events-none">
          <span className="text-amber-400/90 font-medium">Awake</span>
          <span className="text-violet-400/90 font-medium">REM</span>
          <span className="text-sky-400/90 font-medium">Light</span>
          <span className="text-indigo-400/90 font-medium">Deep</span>
        </div>

        {/* Chart Viewbox */}
        <div className="pl-16 relative">
          <svg
            viewBox={`0 0 ${svgWidth} ${svgHeight}`}
            className="w-full h-44 overflow-visible cursor-crosshair"
            preserveAspectRatio="none"
          >
            {/* Horizontal Grid lines */}
            {[0, 1, 2, 3].map((lvl) => (
              <line
                key={lvl}
                x1={0}
                y1={lvl * rowHeight + rowHeight / 2}
                x2={svgWidth}
                y2={lvl * rowHeight + rowHeight / 2}
                stroke="#18181B"
                strokeWidth={1}
                strokeDasharray="4 4"
              />
            ))}

            {/* Step line connecting stages */}
            {stages.map((stg, i) => {
              if (i === 0) return null;
              const prev = stages[i - 1];
              const prevConfig = STAGE_CONFIG[prev.stage];
              const currConfig = STAGE_CONFIG[stg.stage];

              const x =
                ((new Date(stg.startTime).getTime() - firstStageStart) / totalSessionMs) *
                svgWidth;
              const y1 = prevConfig.yLevel * rowHeight + rowHeight / 2;
              const y2 = currConfig.yLevel * rowHeight + rowHeight / 2;

              return (
                <line
                  key={`line_${stg.id}`}
                  x1={x}
                  y1={y1}
                  x2={x}
                  y2={y2}
                  stroke="#3F3F46"
                  strokeWidth={1.5}
                />
              );
            })}

            {/* Stage Bar Rectangles */}
            {stages.map((stg) => {
              const startMs = new Date(stg.startTime).getTime();
              const endMs = new Date(stg.endTime).getTime();
              const x = ((startMs - firstStageStart) / totalSessionMs) * svgWidth;
              const width = Math.max(2, ((endMs - startMs) / totalSessionMs) * svgWidth);
              const config = STAGE_CONFIG[stg.stage];
              const y = config.yLevel * rowHeight + rowHeight / 2 - 8;

              return (
                <rect
                  key={stg.id}
                  x={x}
                  y={y}
                  width={width}
                  height={16}
                  rx={3}
                  fill={config.color}
                  opacity={0.85}
                  className="hover:opacity-100 transition-opacity"
                  onMouseEnter={() => {
                    const durationMins = Math.round(stg.durationSeconds / 60);
                    const pct = Math.round((stg.durationSeconds / totalStageSec) * 100);
                    setHoveredStage({
                      stage: config.label,
                      start: format(new Date(stg.startTime), "HH:mm"),
                      end: format(new Date(stg.endTime), "HH:mm"),
                      durationMins,
                      pct,
                      x,
                    });
                  }}
                  onMouseLeave={() => setHoveredStage(null)}
                />
              );
            })}
          </svg>

          {/* Time axis below chart */}
          <div className="flex justify-between items-center text-[10px] font-mono text-zinc-500 pt-2 border-t border-zinc-900">
            <span>{format(new Date(firstStageStart), "HH:mm")}</span>
            <span>
              {format(
                new Date(firstStageStart + totalSessionMs / 2),
                "HH:mm"
              )}
            </span>
            <span>{format(new Date(lastStageEnd), "HH:mm")}</span>
          </div>

          {/* Interactive Tooltip Card */}
          {hoveredStage && (
            <div
              className="absolute -top-12 z-20 pointer-events-none transform -translate-x-1/2 bg-zinc-900/95 border border-zinc-700/80 px-3 py-1.5 rounded-lg shadow-xl backdrop-blur-md whitespace-nowrap text-xs text-zinc-200"
              style={{ left: `${Math.min(90, Math.max(10, (hoveredStage.x / svgWidth) * 100))}%` }}
            >
              <div className="flex items-center gap-2">
                <span className="font-semibold text-white">{hoveredStage.stage}</span>
                <span className="text-zinc-400 font-mono">
                  {hoveredStage.start} - {hoveredStage.end}
                </span>
                <span className="text-violet-400 font-mono font-medium">
                  {hoveredStage.durationMins}m ({hoveredStage.pct}%)
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Stage Breakdown Metric Pills */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2">
        {(["deep", "rem", "light", "awake"] as const).map((key) => {
          const config = STAGE_CONFIG[key];
          const sec = stageDurations[key] || 0;
          const mins = Math.round(sec / 60);
          const pct = totalStageSec > 0 ? Math.round((sec / totalStageSec) * 100) : 0;

          return (
            <div
              key={key}
              className={`p-2.5 rounded-xl bg-zinc-950/60 border ${config.borderClass} flex flex-col justify-between`}
            >
              <div className="flex items-center justify-between">
                <span className={`text-xs font-medium ${config.textClass}`}>{config.label}</span>
                <span className="text-xs font-mono font-semibold text-zinc-200">{pct}%</span>
              </div>
              <div className="mt-1 flex items-baseline justify-between">
                <span className="text-sm font-semibold text-white font-mono">{mins}m</span>
                <span className="text-[10px] text-zinc-500">
                  {key === "deep" ? "Target >15%" : key === "rem" ? "Target >20%" : ""}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
