"use client";

import { DynamicSleepTarget, ThreeDayRecoveryPlan } from "@/lib/science/strain-sleep-debt";
import { Moon, Dumbbell, Clock, Flame, BedDouble, ChevronRight } from "lucide-react";
import Link from "next/link";

interface DynamicSleepTargetCardProps {
  target: DynamicSleepTarget;
  recoveryPlan: ThreeDayRecoveryPlan;
}

function formatMinutesToHours(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export function DynamicSleepTargetCard({ target, recoveryPlan }: DynamicSleepTargetCardProps) {
  const baseHours = Math.floor(target.baseMinutes / 60);
  const baseMins = target.baseMinutes % 60;

  const totalHours = Math.floor(target.totalTargetMinutes / 60);
  const totalMins = target.totalTargetMinutes % 60;

  return (
    <div className="rounded-2xl border border-zinc-800/80 bg-[#0C0C0E] p-5 shadow-xl space-y-4">
      <div className="flex items-center justify-between border-b border-zinc-900 pb-3">
        <div className="flex items-center gap-2">
          <BedDouble className="w-4 h-4 text-indigo-400" />
          <h3 className="font-semibold text-white text-base">Tonight's Sleep Target</h3>
        </div>
        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-950/70 text-indigo-300 border border-indigo-800/40">
          Load-Adjusted
        </span>
      </div>

      {/* Recommended Bedtime Hero Banner */}
      <div className="p-4 rounded-xl bg-zinc-950/80 border border-zinc-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs text-zinc-400 block font-mono">Recommended Bedtime</span>
          <div className="flex items-baseline gap-2 mt-0.5">
            <span className="text-3xl font-extrabold text-white tracking-tight">
              {target.recommendedBedtime}
            </span>
            <span className="text-xs text-zinc-400 font-mono">
              for {totalHours}h {totalMins > 0 ? `${totalMins}m` : ""} opportunity
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-xs font-mono text-zinc-300 flex items-center gap-1.5">
            <Dumbbell className="w-3.5 h-3.5 text-amber-400" />
            <span>Strain {target.trainingStrainScore}/21</span>
          </div>

          <div className="px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-xs font-mono text-zinc-300 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-rose-400" />
            <span>Debt: {formatMinutesToHours(recoveryPlan.decayedDebtMinutes)}</span>
          </div>
        </div>
      </div>

      {/* Target Breakdown Formula */}
      <div className="space-y-1.5 text-xs">
        <span className="text-zinc-400 font-medium font-mono text-[11px] uppercase tracking-wider">
          Target Breakdown Formula
        </span>
        <div className="grid grid-cols-3 gap-2">
          <div className="p-2.5 rounded-lg bg-zinc-950 border border-zinc-900 text-center">
            <span className="text-[10px] text-zinc-500 font-mono block">Baseline Target</span>
            <strong className="text-sm text-zinc-200 font-mono">
              {baseHours}h {baseMins > 0 ? `${baseMins}m` : "00m"}
            </strong>
          </div>

          <div className="p-2.5 rounded-lg bg-zinc-950 border border-zinc-900 text-center">
            <span className="text-[10px] text-zinc-500 font-mono block">Strain Demand</span>
            <strong className="text-sm text-amber-400 font-mono">
              +{target.trainingStrainMinutes}m
            </strong>
          </div>

          <div className="p-2.5 rounded-lg bg-zinc-950 border border-zinc-900 text-center">
            <span className="text-[10px] text-zinc-500 font-mono block">Late Workout</span>
            <strong className="text-sm text-rose-400 font-mono">
              +{target.lateWorkoutPenaltyMinutes}m
            </strong>
          </div>
        </div>
      </div>

      {/* 3-Day Recovery Action Pill */}
      <div className="p-3 rounded-xl bg-indigo-950/30 border border-indigo-900/40 text-xs space-y-1">
        <div className="flex items-center justify-between text-indigo-300 font-medium">
          <div className="flex items-center gap-1.5">
            <Flame className="w-3.5 h-3.5 text-amber-400" />
            <span>3-Day Recovery Guidance</span>
          </div>
          <Link
            href="/tools/nap-simulator"
            className="text-[10px] font-mono text-violet-400 hover:text-violet-300 flex items-center gap-0.5"
          >
            Nap Simulator <ChevronRight className="w-3 h-3" />
          </Link>
        </div>
        <p className="text-zinc-300 text-[11px] leading-relaxed">
          {recoveryPlan.actionAdvice}
        </p>
      </div>
    </div>
  );
}
