"use client";

import { useEffect, useState } from "react";
import { BiologicalStateHero } from "@/components/dashboard/biological-state-hero";
import { CircadianTimelineBar } from "@/components/dashboard/circadian-timeline-bar";
import { DynamicSleepTargetCard } from "@/components/dashboard/dynamic-sleep-target-card";
import { AutonomicHammockCard } from "@/components/dashboard/autonomic-hammock-card";
import { Hypnogram } from "@/components/charts/hypnogram";
import { EnergyBatteryGauge } from "@/components/charts/energy-battery";
import { CircadianCard } from "@/components/charts/circadian-card";
import { ConsistencyChart } from "@/components/charts/consistency-chart";
import { Moon, RefreshCw, Zap, Sparkles, Activity, ShieldCheck, ArrowRight, BedDouble } from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";

export default function DashboardPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/dashboard");
      if (!res.ok) throw new Error("Failed to load dashboard data");
      const json = await res.json();
      setData(json);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();

    const handleRefresh = () => {
      fetchDashboardData();
    };
    window.addEventListener("nadir:refresh_data", handleRefresh);
    return () => window.removeEventListener("nadir:refresh_data", handleRefresh);
  }, []);

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-44 bg-zinc-900/60 rounded-2xl" />
        <div className="h-28 bg-zinc-900/60 rounded-2xl" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="h-64 bg-zinc-900/60 rounded-2xl" />
          <div className="h-64 bg-zinc-900/60 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-8 rounded-2xl border border-zinc-800 bg-[#0C0C0E] text-center space-y-4">
        <Moon className="w-10 h-10 text-violet-400 mx-auto" />
        <h2 className="text-lg font-semibold text-white">Database Initializing</h2>
        <p className="text-xs text-zinc-400 max-w-md mx-auto">
          No sleep data detected yet. Pull down or tap Sync above to load Health Connect records.
        </p>
        <button
          onClick={fetchDashboardData}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-xs font-medium"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Retry Loading
        </button>
      </div>
    );
  }

  if (!data.latestSession) {
    return (
      <div className="space-y-6">
        <div className="p-8 rounded-2xl border border-zinc-800/80 bg-[#0C0C0E] text-center space-y-4 shadow-2xl">
          <Moon className="w-12 h-12 text-violet-400 mx-auto animate-pulse" />
          <h2 className="text-xl font-bold text-white tracking-tight">Ready for Health Connect Sync</h2>
          <p className="text-sm text-zinc-400 max-w-md mx-auto leading-relaxed">
            All mock and simulated records have been cleared. Tap <strong>Sync</strong> above to ingest your real sleep sessions from Health Connect.
          </p>
          <div className="pt-2">
            <button
              onClick={() => {
                if (typeof window !== "undefined" && (window as any).NadirNative) {
                  (window as any).NadirNative.triggerBackfill();
                } else {
                  fetchDashboardData();
                }
              }}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold shadow-lg shadow-violet-900/30 transition-all active:scale-95"
            >
              <RefreshCw className="w-4 h-4" /> Sync Real Records from Health Connect
            </button>
          </div>
        </div>
        {data.circadianTimeline && <CircadianTimelineBar milestones={data.circadianTimeline} />}
      </div>
    );
  }

  const {
    biologicalState,
    circadianTimeline,
    dynamicSleepTarget,
    recoveryPlan,
    autonomicAnalysis,
    signalNormalization,
    latestSession,
    latestStages,
    latestHrSeries,
    consistencyData,
    recentSessions,
  } = data;

  return (
    <div className="space-y-6">
      {/* 1. Biological State Hero & Recovery Checklist */}
      {biologicalState && (
        <BiologicalStateHero
          verdict={biologicalState}
          currentMorningScore={data.todayBiometrics?.subjectiveMorningScore}
        />
      )}

      {/* 2. Live 24-Hour Circadian Co-Pilot Timeline */}
      {circadianTimeline && <CircadianTimelineBar milestones={circadianTimeline} />}

      {/* 3. Row: Dynamic Sleep Target Breakdown & Energy Battery */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {dynamicSleepTarget && recoveryPlan && (
          <DynamicSleepTargetCard target={dynamicSleepTarget} recoveryPlan={recoveryPlan} />
        )}

        <EnergyBatteryGauge
          batteryPct={Math.max(20, Math.min(100, Math.round(100 - (recoveryPlan?.decayedDebtMinutes || 0) * 0.15)))}
          decayedDebtHours={Number(((recoveryPlan?.decayedDebtMinutes || 0) / 60).toFixed(1))}
          cumulativeDebtHours={Number(((recoveryPlan?.cumulativeDebtMinutes || 0) / 60).toFixed(1))}
          statusLabel={recoveryPlan?.decayedDebtMinutes > 60 ? "Elevated Sleep Debt" : "Optimal Rest"}
          status={recoveryPlan?.decayedDebtMinutes > 60 ? "moderate" : "optimal"}
          advice={
            recoveryPlan?.decayedDebtMinutes > 60
              ? "Autonomic reserves are drawn down. Prioritize restorative non-sleep deep rest (NSDR) or an earlier bedtime to restore energy capacity."
              : "Autonomic reserves fully restored. Your body is primed for regular or high physical output."
          }
        />
      </div>

      {/* 4. Autonomic Recovery & Nocturnal HR Hammock Card */}
      {autonomicAnalysis && (
        <AutonomicHammockCard
          analysis={autonomicAnalysis}
          hrSeries={latestHrSeries || []}
          hrvZScore={signalNormalization?.hrvZ?.zScore}
        />
      )}

      {/* 5. Last Night Hypnogram */}
      <Hypnogram
        stages={latestStages}
        startTime={latestSession?.startTime}
        endTime={latestSession?.endTime}
        totalDurationMinutes={latestSession?.durationMinutes}
        sleepEfficiency={latestSession?.sleepEfficiencyPct}
        sleepScore={latestSession?.sleepScore}
      />

      {/* 6. Consistency Timeline & Recent Nights */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2">
          <ConsistencyChart data={consistencyData} />
        </div>

        {/* Quick Tools & N=1 Causal Card */}
        <div className="rounded-2xl border border-zinc-800/80 bg-[#0C0C0E] p-5 shadow-xl flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-zinc-900 pb-2.5">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <h3 className="font-semibold text-white text-base">Scientific Co-Pilot</h3>
              </div>
              <span className="text-[10px] font-mono text-zinc-500">Quick Access</span>
            </div>

            <div className="space-y-2">
              <Link
                href="/tools/nap-simulator"
                className="p-3 rounded-xl bg-zinc-950/80 border border-zinc-800 hover:border-zinc-700 block transition-colors group"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-white group-hover:text-violet-300">
                    Borbély Nap & NSDR Simulator
                  </span>
                  <ArrowRight className="w-3.5 h-3.5 text-zinc-500 group-hover:text-white" />
                </div>
                <p className="text-[11px] text-zinc-400 mt-0.5">
                  Simulate Process S sleep pressure clearance and find your safe afternoon cutoff.
                </p>
              </Link>

              <Link
                href="/insights"
                className="p-3 rounded-xl bg-zinc-950/80 border border-zinc-800 hover:border-zinc-700 block transition-colors group"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-white group-hover:text-amber-300">
                    N=1 Causal Intelligence & pgvector
                  </span>
                  <ArrowRight className="w-3.5 h-3.5 text-zinc-500 group-hover:text-white" />
                </div>
                <p className="text-[11px] text-zinc-400 mt-0.5">
                  Explore statistical habit drivers (late workouts, light) and vector search best nights.
                </p>
              </Link>
            </div>
          </div>

          <div className="pt-3 border-t border-zinc-900 flex items-center justify-between text-[11px] text-zinc-500 font-mono">
            <span>SRI: {signalNormalization?.sri || 85}/100</span>
            <Link href="/settings/sources" className="text-violet-400 hover:underline">
              Manage Sources
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
