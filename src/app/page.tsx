"use client";

import { useEffect, useState } from "react";
import { Hypnogram } from "@/components/charts/hypnogram";
import { EnergyBatteryGauge } from "@/components/charts/energy-battery";
import { CircadianCard } from "@/components/charts/circadian-card";
import { ConsistencyChart } from "@/components/charts/consistency-chart";
import { Moon, RefreshCw, Sparkles, Activity, ShieldCheck, ArrowRight } from "lucide-react";
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
  }, []);

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-10 bg-zinc-900 rounded-lg w-64" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="h-64 bg-zinc-900/60 rounded-2xl" />
          <div className="h-64 bg-zinc-900/60 rounded-2xl" />
        </div>
        <div className="h-80 bg-zinc-900/60 rounded-2xl" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-8 rounded-2xl border border-zinc-800 bg-[#0C0C0E] text-center space-y-4">
        <Moon className="w-10 h-10 text-violet-400 mx-auto" />
        <h2 className="text-lg font-semibold text-white">Database Initializing</h2>
        <p className="text-xs text-zinc-400 max-w-md mx-auto">
          No sleep data detected yet or seed is loading. Run the database seed to explore 30 days of multi-stage analytics.
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

  const { latestSession, latestStages, sleepDebt, circadian, consistencyData, recentSessions } = data;

  return (
    <div className="space-y-6">
      {/* Top Banner & Quick Status */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-white">Sleep & Circadian Dashboard</h1>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-emerald-950/80 text-emerald-300 border border-emerald-800/50">
              Live Health Sync
            </span>
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            Grip Alternative • Cloud OAuth Ingestion & Delta Ingest Engine
          </p>
        </div>

        <Link
          href="/settings/sources"
          className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-violet-300 bg-zinc-900/80 hover:bg-zinc-800/80 px-3 py-1.5 rounded-lg border border-zinc-800 transition-colors"
        >
          <span>Sync Health Manager</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* Row 1: Energy Battery & Circadian Alignment */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <EnergyBatteryGauge
          batteryPct={sleepDebt?.energyBatteryPct ?? 85}
          decayedDebtHours={sleepDebt?.decayedDebtHours ?? 0}
          cumulativeDebtHours={sleepDebt?.cumulativeDebtHours ?? 0}
          statusLabel={sleepDebt?.statusLabel ?? "Optimal"}
          status={sleepDebt?.status ?? "optimal"}
          advice={sleepDebt?.advice ?? "Keep your regular rhythm."}
        />

        <CircadianCard circadian={circadian} />
      </div>

      {/* Row 2: Interactive Last Night Hypnogram */}
      <Hypnogram
        stages={latestStages}
        startTime={latestSession?.startTime}
        endTime={latestSession?.endTime}
        totalDurationMinutes={latestSession?.durationMinutes}
        sleepEfficiency={latestSession?.sleepEfficiencyPct}
        sleepScore={latestSession?.sleepScore}
      />

      {/* Row 3: Consistency Timeline Bar & Recent Sessions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2">
          <ConsistencyChart data={consistencyData} />
        </div>

        {/* Recent Nights Summary List */}
        <div className="rounded-2xl border border-zinc-800/80 bg-[#0C0C0E] p-5 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-violet-400" />
                <h3 className="font-semibold text-white text-base">Recent Nights</h3>
              </div>
              <span className="text-[11px] font-mono text-zinc-500">Last 7 Days</span>
            </div>

            <div className="space-y-2.5">
              {recentSessions?.map((s: any) => {
                const dateStr = format(new Date(s.startTime), "EEE, MMM d");
                const hours = Math.floor(s.durationMinutes / 60);
                const mins = s.durationMinutes % 60;

                return (
                  <div
                    key={s.id}
                    className="p-2.5 rounded-xl bg-zinc-950/60 border border-zinc-900 flex items-center justify-between text-xs hover:border-zinc-800 transition-colors"
                  >
                    <div>
                      <span className="font-medium text-zinc-200 block">{dateStr}</span>
                      <span className="text-[10px] font-mono text-zinc-500">
                        {s.sourceApp.replace(/_/g, " ")}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="font-mono font-semibold text-white block">
                        {hours}h {mins}m
                      </span>
                      <span className="text-[10px] font-mono text-violet-400">
                        {s.sleepScore} pts ({s.sleepEfficiencyPct}%)
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="pt-4 border-t border-zinc-900 mt-4 flex items-center justify-between text-[11px] text-zinc-500">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Overlap Deduplicated
            </span>
            <Link href="/settings/sources" className="text-violet-400 hover:underline">
              Import Backups
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
