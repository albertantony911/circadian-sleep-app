"use client";

import { useEffect, useState } from "react";
import { Sparkles, TrendingUp, TrendingDown, Clock, Heart, Search, ArrowRight, ShieldCheck, Zap } from "lucide-react";
import Link from "next/link";

export default function InsightsPage() {
  const [loading, setLoading] = useState(true);
  const [causalData, setCausalData] = useState<any>(null);
  const [searchTarget, setSearchTarget] = useState("optimal_deep_recovery");
  const [vectorResults, setVectorResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    fetchCausalData();
    searchBestNights("optimal_deep_recovery");
  }, []);

  const fetchCausalData = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/insights/causal");
      const json = await res.json();
      setCausalData(json);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const searchBestNights = async (targetType: string) => {
    try {
      setSearching(true);
      setSearchTarget(targetType);
      const res = await fetch("/api/insights/best-nights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetType }),
      });
      const json = await res.json();
      if (json.matches) {
        setVectorResults(json.matches);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-white">N=1 Causal Intelligence</h1>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-amber-950 text-amber-300 border border-amber-800">
              Longitudinal Stats & Vector Search
            </span>
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            Statistically validated behavioral impacts on your autonomic sleep architecture over rolling 60-day windows.
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

      {/* Section 1: Causal Habit Impact Cards */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white uppercase tracking-wider font-mono flex items-center gap-1.5">
            <Zap className="w-4 h-4 text-amber-400" />
            Empirical Habit Drivers
          </h2>
          <span className="text-[11px] font-mono text-zinc-500">
            {causalData?.totalNightsAnalyzed || 0} Nights Analyzed
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {causalData?.insights?.map((item: any) => {
            const isNegativeHrv = item.hrvDeltaPct < 0;
            const isDelayedNadir = item.timeToNadirDeltaMinutes > 0;

            return (
              <div
                key={item.tag}
                className="p-5 rounded-2xl bg-[#0C0C0E] border border-zinc-800 space-y-3.5 shadow-xl"
              >
                <div className="flex items-center justify-between border-b border-zinc-900 pb-2.5">
                  <span className="text-sm font-bold text-white">{item.label}</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-900 text-zinc-400 border border-zinc-800">
                    {item.sampleCount} nights vs {item.baselineCount}
                  </span>
                </div>

                {/* Metrics Delta Pills */}
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="p-2 rounded-xl bg-zinc-950 border border-zinc-900">
                    <span className="text-[10px] text-zinc-500 font-mono block">RHR Nadir Delay</span>
                    <strong
                      className={`text-xs font-mono font-bold ${
                        isDelayedNadir ? "text-rose-400" : "text-emerald-400"
                      }`}
                    >
                      {item.timeToNadirDeltaMinutes > 0 ? `+${item.timeToNadirDeltaMinutes}m` : `${item.timeToNadirDeltaMinutes}m`}
                    </strong>
                  </div>

                  <div className="p-2 rounded-xl bg-zinc-950 border border-zinc-900">
                    <span className="text-[10px] text-zinc-500 font-mono block">Overnight HRV</span>
                    <strong
                      className={`text-xs font-mono font-bold ${
                        isNegativeHrv ? "text-rose-400" : "text-emerald-400"
                      }`}
                    >
                      {item.hrvDeltaPct > 0 ? `+${item.hrvDeltaPct}%` : `${item.hrvDeltaPct}%`}
                    </strong>
                  </div>

                  <div className="p-2 rounded-xl bg-zinc-950 border border-zinc-900">
                    <span className="text-[10px] text-zinc-500 font-mono block">Deep Sleep Shift</span>
                    <strong
                      className={`text-xs font-mono font-bold ${
                        item.deepSleepDeltaPct >= 0 ? "text-emerald-400" : "text-zinc-400"
                      }`}
                    >
                      {item.deepSleepDeltaPct > 0 ? `+${item.deepSleepDeltaPct}%` : `${item.deepSleepDeltaPct}%`}
                    </strong>
                  </div>
                </div>

                <p className="text-xs text-zinc-300 leading-relaxed">
                  {item.plainEnglishSummary}
                </p>

                <div className="p-2.5 rounded-xl bg-zinc-950/80 border border-zinc-800/80 text-[11px] font-mono text-amber-300/90 leading-snug">
                  <strong>Prescription:</strong> {item.prescriptiveTakeaway}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Section 2: pgvector "Best Nights" Explorer */}
      <div className="p-5 rounded-2xl bg-[#0C0C0E] border border-zinc-800 space-y-4 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-900 pb-3">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-violet-400" />
              <h2 className="text-base font-semibold text-white">
                pgvector Physiological Pattern Search
              </h2>
            </div>
            <p className="text-xs text-zinc-400">
              Cosine similarity search across 768-dimensional night vector embeddings to find optimal historical conditions.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {[
              { id: "optimal_deep_recovery", label: "Peak Deep Sleep" },
              { id: "lowest_rhr_nadir", label: "Lowest RHR Nadir" },
              { id: "high_strain_adaptive", label: "High Strain Absorption" },
            ].map((archetype) => (
              <button
                key={archetype.id}
                onClick={() => searchBestNights(archetype.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  searchTarget === archetype.id
                    ? "bg-violet-600 text-white"
                    : "bg-zinc-900 text-zinc-400 hover:text-white"
                }`}
              >
                {archetype.label}
              </button>
            ))}
          </div>
        </div>

        {/* Results List */}
        <div className="space-y-2.5">
          {searching ? (
            <div className="py-8 text-center text-xs text-zinc-500 font-mono animate-pulse">
              Running cosine vector search across historical nights...
            </div>
          ) : vectorResults.length > 0 ? (
            vectorResults.map((match, idx) => (
              <div
                key={match.sessionId || idx}
                className="p-3.5 rounded-xl bg-zinc-950/80 border border-zinc-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-zinc-700 transition-colors"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-white">{match.date}</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950/70 text-emerald-300 border border-emerald-800/40">
                      Similarity: {Math.round(match.similarity * 100)}%
                    </span>
                  </div>
                  <p className="text-xs text-zinc-300 leading-snug">{match.summaryText}</p>
                </div>

                <div className="shrink-0 font-mono text-[11px] text-zinc-500">
                  Rank #{idx + 1}
                </div>
              </div>
            ))
          ) : (
            <div className="py-8 text-center text-xs text-zinc-500 font-mono">
              No matching vector embeddings found.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
