"use client";

import { AutonomicAnalysis, HammockCurveType } from "@/lib/science/autonomic-recovery";
import { Heart, Activity, AlertCircle, CheckCircle2, TrendingDown } from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceDot,
  ReferenceLine,
} from "recharts";

interface AutonomicHammockCardProps {
  analysis: AutonomicAnalysis;
  hrSeries: Array<{ recordedAt: Date | string; bpm: number }>;
  hrvZScore?: number;
}

export function AutonomicHammockCard({
  analysis,
  hrSeries,
  hrvZScore = 0.2,
}: AutonomicHammockCardProps) {
  // Format series for Recharts
  const chartData = hrSeries.map((s) => {
    const d = new Date(s.recordedAt);
    const timeStr = `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
    return {
      time: timeStr,
      bpm: s.bpm,
      timestamp: d.getTime(),
    };
  });

  const getBadgeStyle = (type: HammockCurveType) => {
    switch (type) {
      case "optimal_hammock":
        return "bg-emerald-950/80 text-emerald-300 border-emerald-800/50";
      case "late_nadir_delayed":
        return "bg-amber-950/80 text-amber-300 border-amber-800/50";
      case "downward_slope":
        return "bg-indigo-950/80 text-indigo-300 border-indigo-800/50";
      case "elevated_flat":
        return "bg-rose-950/80 text-rose-300 border-rose-800/50";
    }
  };

  return (
    <div className="rounded-2xl border border-zinc-800/80 bg-[#0C0C0E] p-5 shadow-xl space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-900 pb-3">
        <div className="flex items-center gap-2">
          <Heart className="w-4 h-4 text-rose-400" />
          <h3 className="font-semibold text-white text-base">Nocturnal HR Curve & RHR Nadir</h3>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={`px-2.5 py-0.5 rounded-full text-xs font-mono font-medium border uppercase ${getBadgeStyle(
              analysis.hammockCurveType
            )}`}
          >
            {analysis.curveTitle}
          </span>
          <span className="text-[11px] font-mono text-zinc-400">
            HRV Z-Score:{" "}
            <strong
              className={
                hrvZScore >= 0.5
                  ? "text-emerald-400"
                  : hrvZScore <= -1.0
                  ? "text-rose-400"
                  : "text-zinc-200"
              }
            >
              {hrvZScore > 0 ? `+${hrvZScore}` : hrvZScore} SD
            </strong>
          </span>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="p-3 rounded-xl bg-zinc-950/80 border border-zinc-800/80">
          <span className="text-[10px] text-zinc-500 font-mono block">RHR Nadir</span>
          <div className="flex items-baseline gap-1 mt-0.5">
            <span className="text-xl font-bold text-white font-mono">
              {analysis.rhrNadirBpm}
            </span>
            <span className="text-[10px] text-zinc-400 font-mono">BPM</span>
          </div>
        </div>

        <div className="p-3 rounded-xl bg-zinc-950/80 border border-zinc-800/80">
          <span className="text-[10px] text-zinc-500 font-mono block">Time-to-Nadir</span>
          <div className="flex items-baseline gap-1 mt-0.5">
            <span className="text-xl font-bold text-white font-mono">
              {analysis.timeToNadirMinutes}
            </span>
            <span className="text-[10px] text-zinc-400 font-mono">min ({analysis.timeToNadirPct}%)</span>
          </div>
        </div>

        <div className="p-3 rounded-xl bg-zinc-950/80 border border-zinc-800/80">
          <span className="text-[10px] text-zinc-500 font-mono block">Nocturnal Dip</span>
          <div className="flex items-baseline gap-1 mt-0.5">
            <span className="text-xl font-bold text-emerald-400 font-mono">
              {analysis.rhrDipPct}%
            </span>
            <span className="text-[10px] text-zinc-400 font-mono">below daytime</span>
          </div>
        </div>

        <div className="p-3 rounded-xl bg-zinc-950/80 border border-zinc-800/80">
          <span className="text-[10px] text-zinc-500 font-mono block">Recovery Verdict</span>
          <div className="flex items-center gap-1.5 mt-1">
            {analysis.isRestorative ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
            )}
            <span className="text-xs font-semibold text-zinc-200 truncate">
              {analysis.isRestorative ? "Restorative" : "Delayed Recovery"}
            </span>
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="h-48 w-full pt-2">
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
              <XAxis
                dataKey="time"
                stroke="#52525B"
                fontSize={10}
                tickLine={false}
                interval={Math.floor(chartData.length / 6)}
              />
              <YAxis
                stroke="#52525B"
                fontSize={10}
                tickLine={false}
                domain={["dataMin - 3", "dataMax + 3"]}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#09090B",
                  borderColor: "#27272A",
                  borderRadius: "8px",
                  fontSize: "11px",
                }}
                labelStyle={{ color: "#A1A1AA" }}
              />
              <Line
                type="monotone"
                dataKey="bpm"
                stroke="#F43F5E"
                strokeWidth={2}
                dot={false}
                name="Heart Rate"
              />
              <ReferenceLine
                y={analysis.rhrNadirBpm}
                stroke="#10B981"
                strokeDasharray="3 3"
                label={{
                  value: `Nadir ${analysis.rhrNadirBpm} bpm`,
                  fill: "#10B981",
                  fontSize: 10,
                  position: "insideBottomLeft",
                }}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full flex items-center justify-center text-xs text-zinc-500 font-mono">
            Intraday heart rate series available with live wearable sync
          </div>
        )}
      </div>

      {/* Prescriptive Tip Box */}
      <div className="p-3 rounded-xl bg-zinc-950/80 border border-zinc-800/80 text-xs space-y-1">
        <p className="text-zinc-300 text-[11px] leading-relaxed">
          <strong>Physiological Interpretation:</strong> {analysis.clinicalInterpretation}
        </p>
        <p className="text-amber-300/90 text-[11px] leading-relaxed font-mono">
          <strong>Prescriptive Action:</strong> {analysis.prescriptiveAction}
        </p>
      </div>
    </div>
  );
}
