"use client";

import { useState } from "react";
import { simulateProcessS, NapSimulationResult } from "@/lib/science/circadian-copilot";
import { Zap, Moon, AlertTriangle, CheckCircle2, Clock, ShieldCheck, ArrowRight } from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ReferenceArea,
  ReferenceLine,
} from "recharts";
import Link from "next/link";

export default function NapSimulatorPage() {
  const [napType, setNapType] = useState<"power_nap_20m" | "full_cycle_90m" | "nsdr_20m">("power_nap_20m");
  const [napStartHour, setNapStartHour] = useState<number>(13.5); // 13:30 (1:30 PM)
  const [wakeHour, setWakeHour] = useState<number>(6.5); // 06:30 AM
  const [bedHour, setBedHour] = useState<number>(22.5); // 10:30 PM

  const simulation: NapSimulationResult = simulateProcessS(wakeHour, bedHour, {
    type: napType,
    napStartHour,
  });

  const formatFractionalHour = (f: number) => {
    const h = Math.floor(f);
    const m = Math.round((f % 1) * 60);
    return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-white">
              Borbély Process S Nap & NSDR Simulator
            </h1>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-violet-950 text-violet-300 border border-violet-800">
              Biomathematical Model
            </span>
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            Simulate homeostatic sleep pressure S(t) clearance to find your safe restorative nap window without bedtime interference.
          </p>
        </div>

        <Link
          href="/"
          className="text-xs text-zinc-400 hover:text-white flex items-center gap-1 bg-zinc-900 px-3 py-1.5 rounded-lg border border-zinc-800 shrink-0"
        >
          <span>Back to Dashboard</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* Control Panel */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Toggle Protocol */}
        <div className="p-4 rounded-2xl bg-[#0C0C0E] border border-zinc-800 space-y-3">
          <label className="text-xs font-mono text-zinc-400 uppercase tracking-wider block">
            Select Protocol
          </label>
          <div className="space-y-2">
            {[
              {
                id: "power_nap_20m" as const,
                title: "20-Min Power Nap",
                desc: "Clears light adenosine, avoids sleep inertia (SWS).",
              },
              {
                id: "full_cycle_90m" as const,
                title: "90-Min Full Cycle",
                desc: "Full NREM + REM cycle for severe sleep debt.",
              },
              {
                id: "nsdr_20m" as const,
                title: "20-Min NSDR / Yoga Nidra",
                desc: "Lowers cognitive stress, preserves 95% S(t).",
              },
            ].map((proto) => (
              <button
                key={proto.id}
                onClick={() => setNapType(proto.id)}
                className={`w-full text-left p-3 rounded-xl border text-xs transition-all ${
                  napType === proto.id
                    ? "bg-violet-950/60 border-violet-500 text-white shadow-lg shadow-violet-950/30"
                    : "bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200"
                }`}
              >
                <div className="font-semibold">{proto.title}</div>
                <div className="text-[11px] text-zinc-500 mt-0.5">{proto.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Nap Start Time Slider */}
        <div className="p-4 rounded-2xl bg-[#0C0C0E] border border-zinc-800 space-y-3 flex flex-col justify-between">
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-xs font-mono text-zinc-400 uppercase tracking-wider">
                Nap Start Time
              </label>
              <strong className="text-base font-mono text-violet-400 font-bold">
                {formatFractionalHour(napStartHour)}
              </strong>
            </div>
            <p className="text-[11px] text-zinc-500">
              Drag to test different nap times across the afternoon.
            </p>
          </div>

          <div className="space-y-2 py-2">
            <input
              type="range"
              min="11.0"
              max="19.0"
              step="0.25"
              value={napStartHour}
              onChange={(e) => setNapStartHour(parseFloat(e.target.value))}
              className="w-full accent-violet-500 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] font-mono text-zinc-500">
              <span>11:00 AM</span>
              <span>1:30 PM</span>
              <span>4:00 PM</span>
              <span>7:00 PM</span>
            </div>
          </div>

          <div className="p-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs">
            <span className="text-zinc-500 font-mono text-[10px] block">Safe Window Cutoff:</span>
            <strong className="text-emerald-400 font-mono text-xs">
              Must finish before {simulation.recommendedLatestEnd}
            </strong>
          </div>
        </div>

        {/* Real-time Verdict Status */}
        <div className="p-4 rounded-2xl bg-[#0C0C0E] border border-zinc-800 space-y-3 flex flex-col justify-between">
          <div>
            <label className="text-xs font-mono text-zinc-400 uppercase tracking-wider block">
              Simulation Verdict
            </label>
            <div className="flex items-center gap-2 mt-2">
              {simulation.isSafe ? (
                <div className="flex items-center gap-2 text-emerald-400">
                  <CheckCircle2 className="w-5 h-5 shrink-0" />
                  <span className="text-sm font-bold">Safe Restorative Window</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-rose-400">
                  <AlertTriangle className="w-5 h-5 shrink-0" />
                  <span className="text-sm font-bold">Bedtime Interference</span>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-center text-xs">
            <div className="p-2 rounded-xl bg-zinc-950 border border-zinc-800">
              <span className="text-[10px] text-zinc-500 font-mono block">Adenosine Cleared</span>
              <strong className="text-sm font-mono text-zinc-200">
                ~{simulation.adenosineClearedPct}%
              </strong>
            </div>

            <div className="p-2 rounded-xl bg-zinc-950 border border-zinc-800">
              <span className="text-[10px] text-zinc-500 font-mono block">Alertness Boost</span>
              <strong className="text-sm font-mono text-violet-400">
                +{simulation.energyBoostScore}%
              </strong>
            </div>
          </div>

          {simulation.bedtimeInterferenceWarning ? (
            <p className="text-[11px] text-rose-300 bg-rose-950/40 border border-rose-900/50 p-2.5 rounded-xl leading-snug font-mono">
              {simulation.bedtimeInterferenceWarning}
            </p>
          ) : (
            <p className="text-[11px] text-emerald-300 bg-emerald-950/40 border border-emerald-900/50 p-2.5 rounded-xl leading-snug font-mono">
              ✓ Nap preserves nighttime sleep pressure threshold ($S \ge 0.55$) for effortless sleep onset.
            </p>
          )}
        </div>
      </div>

      {/* Interactive Borbély Process S Curve Chart */}
      <div className="p-5 rounded-2xl bg-[#0C0C0E] border border-zinc-800 space-y-4 shadow-xl">
        <div className="flex items-center justify-between border-b border-zinc-900 pb-3">
          <div>
            <h3 className="text-base font-semibold text-white">Process S (Sleep Pressure) Curve</h3>
            <p className="text-xs text-zinc-400 mt-0.5">
              Green line shows normal wake build-up; violet line shows post-nap trajectory.
            </p>
          </div>
          <span className="text-xs font-mono text-zinc-500">
            Wake: {formatFractionalHour(wakeHour)} • Bed: {formatFractionalHour(bedHour)}
          </span>
        </div>

        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={simulation.curve} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
              <XAxis
                dataKey="timeString"
                stroke="#52525B"
                fontSize={10}
                tickLine={false}
                interval={3}
              />
              <YAxis
                stroke="#52525B"
                fontSize={10}
                tickLine={false}
                domain={[0, 1.0]}
                ticks={[0, 0.25, 0.5, 0.75, 1.0]}
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
              <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "10px" }} />
              <ReferenceLine
                y={0.55}
                stroke="#E11D48"
                strokeDasharray="3 3"
                label={{ value: "Sleep Onset Threshold", fill: "#E11D48", fontSize: 10 }}
              />
              <Line
                type="monotone"
                dataKey="processS"
                stroke="#10B981"
                strokeWidth={2}
                dot={false}
                name="Normal S(t) Pressure"
              />
              <Line
                type="monotone"
                dataKey="napEffectS"
                stroke="#8B5CF6"
                strokeWidth={2.5}
                dot={false}
                name="Simulated S(t) With Nap"
              />
              <Line
                type="monotone"
                dataKey="processC"
                stroke="#F59E0B"
                strokeWidth={1.5}
                strokeDasharray="2 2"
                dot={false}
                name="Process C (Circadian Alertness)"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
