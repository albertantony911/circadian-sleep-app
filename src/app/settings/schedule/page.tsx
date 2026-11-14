"use client";

import { useEffect, useState } from "react";
import { SlidersHorizontal, Moon, Sun, Clock, Check, Sparkles, Brain } from "lucide-react";

interface UserSchedule {
  targetSleepMinutes: number;
  chronotype: "early_bird" | "intermediate" | "night_owl";
  preferredBedTime: string;
  preferredWakeTime: string;
}

const MEQ_QUESTIONS = [
  {
    id: 1,
    question: "What time would you get up if you were entirely free to plan your day?",
    options: [
      { text: "05:00 - 06:30", score: 5, type: "early" },
      { text: "06:30 - 08:00", score: 4, type: "early" },
      { text: "08:00 - 09:30", score: 3, type: "intermediate" },
      { text: "09:30 - 11:00", score: 2, type: "night" },
      { text: "11:00 - 13:00", score: 1, type: "night" },
    ],
  },
  {
    id: 2,
    question: "What time would you go to bed if you were entirely free to plan your evening?",
    options: [
      { text: "20:00 - 21:30", score: 5, type: "early" },
      { text: "21:30 - 23:00", score: 4, type: "early" },
      { text: "23:00 - 00:30", score: 3, type: "intermediate" },
      { text: "00:30 - 02:00", score: 2, type: "night" },
      { text: "02:00 - 04:00", score: 1, type: "night" },
    ],
  },
  {
    id: 3,
    question: "How dependent are you on an alarm clock to wake up on workdays?",
    options: [
      { text: "Not at all dependent (wake up naturally before alarm)", score: 4, type: "early" },
      { text: "Slightly dependent", score: 3, type: "intermediate" },
      { text: "Fairly dependent", score: 2, type: "night" },
      { text: "Very dependent (need multiple alarms)", score: 1, type: "night" },
    ],
  },
  {
    id: 4,
    question: "How alert do you feel during the first 30 minutes after awakening?",
    options: [
      { text: "Very alert and ready to go", score: 4, type: "early" },
      { text: "Fairly alert", score: 3, type: "intermediate" },
      { text: "A little groggy / slow", score: 2, type: "night" },
      { text: "Extremely exhausted / brain fog", score: 1, type: "night" },
    ],
  },
  {
    id: 5,
    question: "At what time of day do you reach your peak mental clarity?",
    options: [
      { text: "Morning (07:00 - 11:00)", score: 4, type: "early" },
      { text: "Midday (11:00 - 15:00)", score: 3, type: "intermediate" },
      { text: "Late afternoon (15:00 - 19:00)", score: 2, type: "intermediate" },
      { text: "Late evening / night (19:00 - 02:00)", score: 1, type: "night" },
    ],
  },
];

export default function SchedulePage() {
  const [schedule, setSchedule] = useState<UserSchedule>({
    targetSleepMinutes: 480,
    chronotype: "intermediate",
    preferredBedTime: "22:30",
    preferredWakeTime: "06:30",
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // MEQ Quiz State
  const [answers, setAnswers] = useState<Record<number, number>>({ 1: 3, 2: 3, 3: 3, 4: 3, 5: 3 });

  useEffect(() => {
    fetch("/api/user/schedule")
      .then((res) => res.json())
      .then((data) => {
        if (data.targetSleepMinutes) {
          setSchedule({
            targetSleepMinutes: data.targetSleepMinutes,
            chronotype: data.chronotype || "intermediate",
            preferredBedTime: data.preferredBedTime || "22:30",
            preferredWakeTime: data.preferredWakeTime || "06:30",
          });
        }
      })
      .catch(console.error);
  }, []);

  const handleAnswerChange = (qId: number, score: number) => {
    const updated = { ...answers, [qId]: score };
    setAnswers(updated);

    // Calculate total score
    const total = Object.values(updated).reduce((a, b) => a + b, 0);
    let calculatedType: "early_bird" | "intermediate" | "night_owl" = "intermediate";
    if (total >= 17) calculatedType = "early_bird";
    else if (total <= 10) calculatedType = "night_owl";

    setSchedule((prev) => ({ ...prev, chronotype: calculatedType }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/user/schedule", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(schedule),
      });
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
      }
    } finally {
      setSaving(false);
    }
  };

  const hours = Math.floor(schedule.targetSleepMinutes / 60);
  const mins = schedule.targetSleepMinutes % 60;

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">Schedule & Chronotype</h1>
        <p className="text-xs text-zinc-400 mt-1">
          Calibrate your circadian sleep windows and baseline recovery targets.
        </p>
      </div>

      {/* Target Bed & Wake Config Card */}
      <div className="rounded-2xl border border-zinc-800/80 bg-[#0C0C0E] p-6 shadow-xl space-y-6">
        <div className="flex items-center justify-between border-b border-zinc-900 pb-3">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-violet-400" />
            <h2 className="font-semibold text-white text-base">Target Sleep Window</h2>
          </div>
          <span className="text-xs font-mono text-zinc-400">
            Target: <strong className="text-white">{hours}h {mins > 0 ? `${mins}m` : ""}</strong> per night
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {/* Bedtime */}
          <div className="p-4 rounded-xl bg-zinc-950/70 border border-zinc-800/70 space-y-2">
            <div className="flex items-center gap-2 text-zinc-300 text-xs font-medium">
              <Moon className="w-4 h-4 text-violet-400" />
              <span>Target Bedtime (Lights Out)</span>
            </div>
            <input
              type="time"
              value={schedule.preferredBedTime}
              onChange={(e) => setSchedule({ ...schedule, preferredBedTime: e.target.value })}
              className="w-full bg-zinc-900 border border-zinc-700/80 rounded-lg px-3 py-2 text-lg font-mono text-white focus:outline-none focus:border-violet-500"
            />
          </div>

          {/* Wake Time */}
          <div className="p-4 rounded-xl bg-zinc-950/70 border border-zinc-800/70 space-y-2">
            <div className="flex items-center gap-2 text-zinc-300 text-xs font-medium">
              <Sun className="w-4 h-4 text-amber-400" />
              <span>Target Wake Time (Alarm)</span>
            </div>
            <input
              type="time"
              value={schedule.preferredWakeTime}
              onChange={(e) => setSchedule({ ...schedule, preferredWakeTime: e.target.value })}
              className="w-full bg-zinc-900 border border-zinc-700/80 rounded-lg px-3 py-2 text-lg font-mono text-white focus:outline-none focus:border-amber-500"
            />
          </div>
        </div>

        {/* Target Sleep Duration Slider */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-zinc-300 font-medium">Target Sleep Duration</span>
            <span className="font-mono font-semibold text-violet-400">
              {hours} hours {mins > 0 ? `${mins} minutes` : ""}
            </span>
          </div>
          <input
            type="range"
            min={360}
            max={600}
            step={15}
            value={schedule.targetSleepMinutes}
            onChange={(e) => setSchedule({ ...schedule, targetSleepMinutes: Number(e.target.value) })}
            className="w-full accent-violet-500 h-2 bg-zinc-800 rounded-lg cursor-pointer"
          />
          <div className="flex justify-between text-[11px] font-mono text-zinc-500">
            <span>6.0 hrs (short)</span>
            <span>8.0 hrs (recommended)</span>
            <span>10.0 hrs (long)</span>
          </div>
        </div>

        {/* Save button */}
        <div className="flex justify-end pt-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold flex items-center gap-2 transition-colors disabled:opacity-50"
          >
            {saved ? <Check className="w-4 h-4 text-emerald-300" /> : <Sparkles className="w-4 h-4" />}
            {saved ? "Preferences Saved" : saving ? "Saving..." : "Save Sleep Preferences"}
          </button>
        </div>
      </div>

      {/* MEQ 5-Question Chronotype Quiz */}
      <div className="rounded-2xl border border-zinc-800/80 bg-[#0C0C0E] p-6 shadow-xl space-y-6">
        <div className="flex items-center justify-between border-b border-zinc-900 pb-3">
          <div className="flex items-center gap-2">
            <Brain className="w-4 h-4 text-violet-400" />
            <h2 className="font-semibold text-white text-base">MEQ Chronotype Assessment</h2>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-400">Classified:</span>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-semibold uppercase bg-violet-950/80 text-violet-300 border border-violet-800/50">
              {schedule.chronotype.replace("_", " ")}
            </span>
          </div>
        </div>

        <p className="text-xs text-zinc-400">
          Based on the Morningness-Eveningness Questionnaire (Horne & Östberg). Answer the 5 questions below to calibrate your circadian alignment recommendations:
        </p>

        <div className="space-y-5">
          {MEQ_QUESTIONS.map((q) => (
            <div key={q.id} className="space-y-2.5 p-3.5 rounded-xl bg-zinc-950/60 border border-zinc-900">
              <span className="text-xs font-medium text-zinc-200 block">
                {q.id}. {q.question}
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {q.options.map((opt) => {
                  const isSelected = answers[q.id] === opt.score;
                  return (
                    <button
                      key={opt.text}
                      type="button"
                      onClick={() => handleAnswerChange(q.id, opt.score)}
                      className={`text-left p-2.5 rounded-lg text-xs transition-all border ${
                        isSelected
                          ? "bg-violet-950/60 text-violet-200 border-violet-600/70 shadow-sm"
                          : "bg-zinc-900/60 text-zinc-400 border-zinc-800/70 hover:border-zinc-700"
                      }`}
                    >
                      {opt.text}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
