"use client";

import { useState } from "react";
import { BiologicalStateVerdict } from "@/lib/science/biological-state";
import { ShieldCheck, CheckCircle2, Circle, Clock, Zap, ArrowRight, Smile, Frown, Meh } from "lucide-react";

interface BiologicalStateHeroProps {
  verdict: BiologicalStateVerdict;
  currentMorningScore?: number | null;
  onMorningScoreChange?: (score: number) => void;
}

export function BiologicalStateHero({
  verdict,
  currentMorningScore,
  onMorningScoreChange,
}: BiologicalStateHeroProps) {
  const [completedItems, setCompletedItems] = useState<Record<string, boolean>>({});
  const [morningScore, setMorningScore] = useState<number | null>(currentMorningScore ?? null);
  const [submittingScore, setSubmittingScore] = useState(false);

  const toggleCheck = (id: string) => {
    setCompletedItems((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleScoreSelect = async (score: number) => {
    setMorningScore(score);
    if (onMorningScoreChange) onMorningScoreChange(score);
    try {
      setSubmittingScore(true);
      await fetch("/api/user/morning-score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ score }),
      });
    } catch (err) {
      console.error("Failed to save morning score:", err);
    } finally {
      setSubmittingScore(false);
    }
  };

  return (
    <div
      className={`rounded-2xl border ${verdict.accentBorder} bg-gradient-to-b from-[#111116] to-[#0A0A0D] p-5 sm:p-6 shadow-2xl relative overflow-hidden space-y-5`}
    >
      {/* Background Ambient Glow */}
      <div className="absolute top-0 right-0 w-72 h-72 bg-violet-600/5 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />

      {/* Top Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 relative z-10">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span
              className={`px-3 py-1 rounded-full text-xs font-mono font-semibold tracking-wide border uppercase ${verdict.badgeColor}`}
            >
              {verdict.badgeLabel}
            </span>
            <span className="text-xs text-zinc-400 font-mono">
              Readiness: <strong className="text-white">{verdict.readinessScore}/100</strong>
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white pt-1">
            {verdict.title}
          </h2>
        </div>

        {/* 3-Second Morning Calibration Slider */}
        <div className="bg-zinc-950/80 border border-zinc-800/80 rounded-xl p-2.5 flex items-center gap-3 shrink-0">
          <span className="text-[11px] font-medium text-zinc-400">Morning Feel:</span>
          <div className="flex items-center gap-1">
            {[
              { score: 1, label: "Groggy", icon: Frown },
              { score: 2, label: "Sluggish", icon: Frown },
              { score: 3, label: "Neutral", icon: Meh },
              { score: 4, label: "Awake", icon: Smile },
              { score: 5, label: "Sharp", icon: Zap },
            ].map(({ score, label, icon: Icon }) => (
              <button
                key={score}
                onClick={() => handleScoreSelect(score)}
                title={`${score} - ${label}`}
                className={`w-7 h-7 rounded-lg text-xs font-semibold flex items-center justify-center transition-all ${
                  morningScore === score
                    ? "bg-violet-600 text-white shadow-lg shadow-violet-600/30 scale-105"
                    : "bg-zinc-900/80 text-zinc-400 hover:text-white hover:bg-zinc-800"
                }`}
              >
                {score}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 2-Sentence Clinical Synthesis */}
      <p className="text-sm text-zinc-300 leading-relaxed max-w-3xl relative z-10">
        {verdict.summary}
      </p>

      {/* 3-Step Actionable Recovery Checklist */}
      <div className="space-y-2 pt-2 border-t border-zinc-800/60 relative z-10">
        <div className="flex items-center justify-between">
          <span className="text-xs font-mono font-medium text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            Today's Prescriptive Recovery Checklist
          </span>
          <span className="text-[11px] text-zinc-500 font-mono">
            {Object.values(completedItems).filter(Boolean).length}/{verdict.recoveryChecklist.length} Done
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
          {verdict.recoveryChecklist.map((item) => {
            const isDone = completedItems[item.id] || false;
            return (
              <div
                key={item.id}
                onClick={() => toggleCheck(item.id)}
                className={`p-3 rounded-xl border transition-all cursor-pointer flex flex-col justify-between gap-2 select-none ${
                  isDone
                    ? "bg-emerald-950/20 border-emerald-800/40 opacity-70"
                    : "bg-zinc-950/70 border-zinc-800/80 hover:border-zinc-700/80"
                }`}
              >
                <div className="flex items-start gap-2.5">
                  <button className="mt-0.5 shrink-0 text-zinc-400">
                    {isDone ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <Circle className="w-4 h-4 text-zinc-500 hover:text-zinc-300" />
                    )}
                  </button>
                  <p
                    className={`text-xs leading-snug ${
                      isDone ? "line-through text-zinc-500" : "text-zinc-200"
                    }`}
                  >
                    {item.action}
                  </p>
                </div>

                {item.targetTime && (
                  <div className="flex items-center gap-1 text-[11px] font-mono text-amber-300/80 pl-6.5">
                    <Clock className="w-3 h-3" />
                    <span>Target: {item.targetTime}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
