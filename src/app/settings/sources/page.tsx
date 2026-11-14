"use client";

import { Suspense, useEffect, useState } from "react";
import {
  Radio,
  Key,
  Copy,
  Check,
  RefreshCw,
  Upload,
  AlertTriangle,
  Clock,
  ShieldCheck,
  Code2,
  FileText,
  Layers,
  ChevronDown,
  ChevronUp,
  X,
  ExternalLink,
} from "lucide-react";
import { parseSleepAsAndroidCSV, parseHealthConnectJSON } from "@/lib/importers/file-importers";
import { format } from "date-fns";
import { useSearchParams } from "next/navigation";

function SourcesHealthContent() {
  const searchParams = useSearchParams();
  const connectedParam = searchParams.get("connected");
  const errorParam = searchParams.get("error");

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedJson, setCopiedJson] = useState(false);
  const [copiedKotlin, setCopiedKotlin] = useState(false);
  const [copiedRedirectUri, setCopiedRedirectUri] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [rateLimitTimer, setRateLimitTimer] = useState<number | null>(null);

  // Google Health Sync state
  const [syncingGoogle, setSyncingGoogle] = useState(false);
  const [googleSyncMsg, setGoogleSyncMsg] = useState<string | null>(null);
  const [showGoogleModal, setShowGoogleModal] = useState(false);

  // File import state
  const [importing, setImporting] = useState(false);
  const [importStatus, setImportStatus] = useState<string | null>(null);

  // Audit log drawer expansion
  const [showAllLogs, setShowAllLogs] = useState(false);

  const fetchHealthData = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/sources/health");
      const json = await res.json();
      setData(json);

      // Check if fitbit connection is rate limited
      const fitbit = json.connections?.find((c: any) => c.provider === "fitbit");
      if (fitbit && fitbit.syncStatus === "rate_limited" && fitbit.rateLimitResetAt) {
        const remaining = Math.max(0, Math.ceil((new Date(fitbit.rateLimitResetAt).getTime() - Date.now()) / 1000));
        setRateLimitTimer(remaining);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealthData();
  }, []);

  // Tick down rate limit timer
  useEffect(() => {
    if (rateLimitTimer === null || rateLimitTimer <= 0) return;
    const interval = setInterval(() => {
      setRateLimitTimer((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(interval);
          fetchHealthData();
          return null;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [rateLimitTimer]);

  const handleCopy = (text: string, type: "key" | "url" | "json" | "kotlin") => {
    navigator.clipboard.writeText(text);
    if (type === "key") setCopiedKey(true);
    if (type === "url") setCopiedUrl(true);
    if (type === "json") setCopiedJson(true);
    if (type === "kotlin") setCopiedKotlin(true);
    setTimeout(() => {
      setCopiedKey(false);
      setCopiedUrl(false);
      setCopiedJson(false);
      setCopiedKotlin(false);
    }, 2000);
  };

  const handleRegenerateKey = async () => {
    if (!confirm("Regenerating this API key will invalidate previous Android Companion connections. Continue?")) return;
    const res = await fetch("/api/sources/health", { method: "POST" });
    const json = await res.json();
    if (json.ingestApiKey) {
      setData((prev: any) => ({ ...prev, ingestApiKey: json.ingestApiKey }));
    }
  };

  const handleSimulateRateLimit = async () => {
    setSimulating(true);
    try {
      const res = await fetch("/api/sync/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: "fitbit", simulateRateLimit: true }),
      });
      const json = await res.json();
      if (json.remainingSeconds) {
        setRateLimitTimer(json.remainingSeconds);
      }
      fetchHealthData();
    } finally {
      setSimulating(false);
    }
  };

  const handleSyncGoogle = async () => {
    try {
      setSyncingGoogle(true);
      setGoogleSyncMsg(null);
      const res = await fetch("/api/sync/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: "google_health" }),
      });
      const json = await res.json();
      if (res.ok) {
        setGoogleSyncMsg("Google Health synced successfully!");
        fetchHealthData();
      } else {
        setGoogleSyncMsg(`Sync failed: ${json.error || "Unknown error"}`);
      }
    } catch (err: any) {
      setGoogleSyncMsg(`Sync error: ${err.message}`);
    } finally {
      setSyncingGoogle(false);
      setTimeout(() => setGoogleSyncMsg(null), 4000);
    }
  };

  const handleConnectGoogle = () => {
    window.location.href = "/api/auth/google";
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setImporting(true);
      setImportStatus(`Reading ${file.name}...`);
      const text = await file.text();

      let records: any[] = [];
      let format = "unknown";

      if (file.name.endsWith(".csv")) {
        format = "sleep_as_android_csv";
        records = parseSleepAsAndroidCSV(text);
      } else if (file.name.endsWith(".json")) {
        format = "health_connect_json";
        records = parseHealthConnectJSON(text);
      } else {
        throw new Error("Unsupported format. Please upload .csv or .json files.");
      }

      setImportStatus(`Found ${records.length} records. Uploading to database...`);

      const res = await fetch("/api/ingest/import-file", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ records, format }),
      });

      const resJson = await res.json();
      if (resJson.success) {
        setImportStatus(`Successfully imported ${resJson.upserted} records (${resJson.suppressed} duplicates suppressed).`);
        fetchHealthData();
      } else {
        setImportStatus(`Import error: ${resJson.error}`);
      }
    } catch (err: any) {
      setImportStatus(`Import failed: ${err.message}`);
    } finally {
      setImporting(false);
    }
  };

  const webhookUrl = typeof window !== "undefined"
    ? `${window.location.origin}/api/ingest/health-connect`
    : "https://your-domain.com/api/ingest/health-connect";

  const sampleJsonSnippet = JSON.stringify(
    {
      changesToken: "TOKEN_V1_HEALTH_CONNECT",
      nextChangesToken: "TOKEN_V2_DELTA_UPDATE",
      upsertedRecords: [
        {
          externalId: "hc_record_77189",
          sourceApp: "com.fitbit.FitbitMobile",
          startTime: "2026-11-14T23:15:00Z",
          endTime: "2026-11-15T07:15:00Z",
          durationMinutes: 480,
          sleepEfficiencyPct: 91,
          deepMinutes: 95,
          remMinutes: 110,
          lightMinutes: 245,
          awakeMinutes: 30,
          sleepScore: 89,
        },
      ],
      deletedRecordIds: [],
    },
    null,
    2
  );

  const sampleKotlinSnippet = `// Android WorkManager: Delta-only Health Connect Sync
val healthConnectClient = HealthConnectClient.getOrCreate(context)
val response = healthConnectClient.getChanges(
    GetChangesRequest(changesToken = storedToken)
)

// Push only incremental delta changes to Nadir PWA endpoint
val payload = buildDeltaPayload(response.upsertedRecords, response.deletedChanges)
httpClient.post("${webhookUrl}") {
    header("Authorization", "Bearer \${USER_INGEST_API_KEY}")
    setBody(payload)
}
storeNextChangesToken(response.nextChangesToken)`;

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 bg-zinc-900 rounded w-48" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="h-56 bg-zinc-900/60 rounded-2xl" />
          <div className="h-56 bg-zinc-900/60 rounded-2xl" />
        </div>
      </div>
    );
  }

  const fitbitConn = data?.connections?.find((c: any) => c.provider === "fitbit");
  const googleConn = data?.connections?.find((c: any) => c.provider === "google_health");

  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">Sources & Sync Health</h1>
        <p className="text-xs text-zinc-400 mt-1">
          Two-tier ingestion engine: Direct Cloud OAuth syncing + Thin Android Health Connect Delta Bridge.
        </p>
      </div>

      {/* Grid: Cloud Providers & Health Connect Card */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Card 1: Cloud OAuth Providers */}
        <div className="rounded-2xl border border-zinc-800/80 bg-[#0C0C0E] p-5 shadow-xl space-y-5">
          <div className="flex items-center justify-between border-b border-zinc-900 pb-3">
            <div className="flex items-center gap-2">
              <Radio className="w-4 h-4 text-violet-400" />
              <h2 className="font-semibold text-white text-base">Direct Cloud Sync</h2>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950/70 text-emerald-300 border border-emerald-800/40">
              Zero Rate Limits
            </span>
          </div>

          {/* Fitbit Provider */}
          <div className="p-4 rounded-xl bg-zinc-950/80 border border-zinc-800/80 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-teal-950/80 border border-teal-800/40 flex items-center justify-center font-bold text-teal-300 text-xs">
                  FIT
                </div>
                <div>
                  <span className="text-sm font-medium text-white block">Fitbit Web API</span>
                  <span className="text-[11px] text-zinc-500 font-mono">OAuth 2.0 PKCE • Webhook Subscribed</span>
                </div>
              </div>

              {rateLimitTimer ? (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-950/70 text-rose-300 border border-rose-800/50 text-xs font-mono animate-pulse">
                  <Clock className="w-3.5 h-3.5" />
                  <span>429 Lock: {rateLimitTimer}s</span>
                </div>
              ) : (
                <span className="px-2.5 py-1 rounded-full bg-emerald-950/70 text-emerald-300 border border-emerald-800/40 text-xs font-mono flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  Active (Idle)
                </span>
              )}
            </div>

            <div className="flex items-center justify-between text-xs text-zinc-400 pt-2 border-t border-zinc-900">
              <span>
                Last Synced:{" "}
                <strong className="text-zinc-200 font-mono">
                  {fitbitConn?.lastSyncAt
                    ? format(new Date(fitbitConn.lastSyncAt), "MMM d, HH:mm")
                    : "Never"}
                </strong>
              </span>

              <button
                onClick={handleSimulateRateLimit}
                disabled={simulating || rateLimitTimer !== null}
                className="text-[11px] font-mono text-zinc-500 hover:text-amber-400 transition-colors disabled:opacity-40"
              >
                {rateLimitTimer ? "Circuit breaker active" : "Test HTTP 429 Cooldown"}
              </button>
            </div>
          </div>

          {/* Google Health Provider (Method 2) */}
          <div className="p-4 rounded-xl bg-zinc-950/80 border border-zinc-800/80 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-950/80 border border-blue-800/40 flex items-center justify-center font-bold text-blue-300 text-xs">
                  G
                </div>
                <div>
                  <span className="text-sm font-medium text-white block">Google Health Connect REST</span>
                  <span className="text-[11px] text-zinc-500 font-mono">OAuth 2.0 Cloud Mirror • Auto Morning Cron</span>
                </div>
              </div>

              {googleConn ? (
                <span className="px-2.5 py-1 rounded-full bg-emerald-950/70 text-emerald-300 border border-emerald-800/40 text-xs font-mono flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  Auto-Sync Ready
                </span>
              ) : (
                <span className="px-2.5 py-1 rounded-full bg-zinc-900 text-zinc-400 border border-zinc-800 text-xs font-mono">
                  Not Connected
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-zinc-900">
              <span className="text-xs text-zinc-400">
                Last Synced:{" "}
                <strong className="text-zinc-200 font-mono">
                  {googleConn?.lastSyncAt
                    ? format(new Date(googleConn.lastSyncAt), "MMM d, HH:mm")
                    : "Never"}
                </strong>
              </span>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowGoogleModal(true)}
                  className="px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 text-xs border border-zinc-800 transition-colors"
                >
                  Setup Guide
                </button>
                <button
                  onClick={handleConnectGoogle}
                  className="px-3 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition-colors"
                >
                  Connect Account
                </button>
                <button
                  onClick={handleSyncGoogle}
                  disabled={syncingGoogle}
                  className="px-3 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-200 text-xs border border-zinc-700/80 flex items-center gap-1.5 disabled:opacity-50"
                >
                  <RefreshCw className={`w-3 h-3 ${syncingGoogle ? "animate-spin text-blue-400" : ""}`} />
                  {syncingGoogle ? "Syncing..." : "Sync Now"}
                </button>
              </div>
            </div>

            {googleSyncMsg && (
              <p className="text-[11px] font-mono text-emerald-400 pt-1">
                {googleSyncMsg}
              </p>
            )}
          </div>
        </div>

        {/* Card 2: Android Health Connect Delta Bridge */}
        <div className="rounded-2xl border border-zinc-800/80 bg-[#0C0C0E] p-5 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-900 pb-3">
            <div className="flex items-center gap-2">
              <Key className="w-4 h-4 text-amber-400" />
              <h2 className="font-semibold text-white text-base">Health Connect Delta Bridge</h2>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-950/70 text-amber-300 border border-amber-800/40">
              Delta Only
            </span>
          </div>

          {/* Webhook Endpoint URL */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-300">Companion Ingest Endpoint</label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={webhookUrl}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs font-mono text-zinc-300 focus:outline-none select-all"
              />
              <button
                onClick={() => handleCopy(webhookUrl, "url")}
                className="px-3 py-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 rounded-lg text-xs font-medium flex items-center gap-1.5 shrink-0"
              >
                {copiedUrl ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                Copy
              </button>
            </div>
          </div>

          {/* Bearer Token */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-zinc-300">Personal Ingest Bearer Key</label>
              <button
                onClick={handleRegenerateKey}
                className="text-[11px] text-violet-400 hover:underline"
              >
                Regenerate Key
              </button>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={data?.ingestApiKey || "ak_live_circadian_92b8d0e74f1"}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs font-mono text-amber-300/90 focus:outline-none select-all"
              />
              <button
                onClick={() => handleCopy(data?.ingestApiKey || "", "key")}
                className="px-3 py-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 rounded-lg text-xs font-medium flex items-center gap-1.5 shrink-0"
              >
                {copiedKey ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                Copy
              </button>
            </div>
          </div>

          {/* Copyable JSON & Kotlin Snippet toggles */}
          <div className="pt-2 flex flex-wrap gap-2">
            <button
              onClick={() => handleCopy(sampleJsonSnippet, "json")}
              className="px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-zinc-300 flex items-center gap-1.5 hover:bg-zinc-800 transition-colors"
            >
              <Code2 className="w-3.5 h-3.5 text-violet-400" />
              {copiedJson ? "Copied JSON!" : "Copy Delta JSON Schema"}
            </button>
            <button
              onClick={() => handleCopy(sampleKotlinSnippet, "kotlin")}
              className="px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-zinc-300 flex items-center gap-1.5 hover:bg-zinc-800 transition-colors"
            >
              <FileText className="w-3.5 h-3.5 text-amber-400" />
              {copiedKotlin ? "Copied Kotlin!" : "Copy Android Kotlin Bridge"}
            </button>
          </div>
        </div>
      </div>

      {/* Row 2: Source Priority Rules & Backup Importer */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Source Priority Ranker */}
        <div className="rounded-2xl border border-zinc-800/80 bg-[#0C0C0E] p-5 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-900 pb-3">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-violet-400" />
              <h2 className="font-semibold text-white text-base">Source Priority & Deduplication</h2>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-violet-950/70 text-violet-300 border border-violet-800/40">
              Anti-Double-Count
            </span>
          </div>

          <p className="text-xs text-zinc-400">
            When multiple apps record the same sleep window, higher priority sources supersede phone sensors:
          </p>

          <div className="space-y-2">
            {[
              { rank: 1, name: "Fitbit Wearable (Cloud)", score: "Rank 100", desc: "True stage hypnogram + HRV" },
              { rank: 2, name: "Health Connect Wearables", score: "Rank 80", desc: "Galaxy Watch / Pixel Watch" },
              { rank: 3, name: "Health Connect Companion Bridge", score: "Rank 70", desc: "Delta getChanges()" },
              { rank: 4, name: "Sleep as Android CSV Import", score: "Rank 60", desc: "Sonar / Accelerometer" },
              { rank: 5, name: "Phone Sensor / Accelerometer", score: "Rank 30", desc: "Suppressed if wearable overlaps" },
            ].map((prio) => (
              <div
                key={prio.rank}
                className="p-3 rounded-xl bg-zinc-950/70 border border-zinc-800/70 flex items-center justify-between text-xs"
              >
                <div className="flex items-center gap-3">
                  <span className="w-5 h-5 rounded-full bg-zinc-900 border border-zinc-700 flex items-center justify-center font-mono font-bold text-[10px] text-zinc-300">
                    {prio.rank}
                  </span>
                  <div>
                    <span className="font-medium text-zinc-200 block">{prio.name}</span>
                    <span className="text-[10px] text-zinc-500">{prio.desc}</span>
                  </div>
                </div>
                <span className="text-[10px] font-mono text-violet-400 bg-violet-950/40 px-2 py-0.5 rounded border border-violet-800/30">
                  {prio.score}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Drag-and-Drop Backup Importer */}
        <div className="rounded-2xl border border-zinc-800/80 bg-[#0C0C0E] p-5 shadow-xl space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-zinc-900 pb-3">
              <div className="flex items-center gap-2">
                <Upload className="w-4 h-4 text-emerald-400" />
                <h2 className="font-semibold text-white text-base">Direct Backup Importer</h2>
              </div>
              <span className="text-[10px] font-mono text-zinc-500">Chunked Streaming</span>
            </div>

            <p className="text-xs text-zinc-400 mt-3">
              Migrate years of historical data from <strong>Sleep as Android CSV</strong> or <strong>Google Takeout JSON</strong> directly into Postgres without hitting mobile Health Connect rate limits.
            </p>

            {/* Dropzone */}
            <label className="mt-4 border-2 border-dashed border-zinc-800 hover:border-violet-500/60 rounded-xl p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-colors bg-zinc-950/40 group">
              <input
                type="file"
                accept=".csv,.json"
                onChange={handleFileUpload}
                disabled={importing}
                className="hidden"
              />
              <Upload className="w-8 h-8 text-zinc-600 group-hover:text-violet-400 transition-colors mb-2" />
              <span className="text-xs font-semibold text-zinc-300">
                {importing ? "Processing file..." : "Click or drag backup file here"}
              </span>
              <span className="text-[11px] text-zinc-500 mt-1 font-mono">
                Supports sleep-export.csv or HealthConnect_Sleep.json
              </span>
            </label>
          </div>

          {importStatus && (
            <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-300 font-mono">
              {importStatus}
            </div>
          )}
        </div>
      </div>

      {/* Sync Audit Trail Drawer */}
      <div className="rounded-2xl border border-zinc-800/80 bg-[#0C0C0E] p-5 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-violet-400" />
            <h2 className="font-semibold text-white text-base">Sync Audit Trail & Latency Logs</h2>
          </div>
          <button
            onClick={() => setShowAllLogs(!showAllLogs)}
            className="flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-200"
          >
            <span>{showAllLogs ? "Collapse" : "View All"}</span>
            {showAllLogs ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="border-b border-zinc-900 text-zinc-500">
                <th className="pb-2">Timestamp</th>
                <th className="pb-2">Source</th>
                <th className="pb-2">Status</th>
                <th className="pb-2">Upserted</th>
                <th className="pb-2">Latency</th>
                <th className="pb-2">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-900/80 text-zinc-300">
              {(showAllLogs ? data?.logs : data?.logs?.slice(0, 5))?.map((log: any) => {
                const is200 = log.statusCode === 200;
                return (
                  <tr key={log.id} className="hover:bg-zinc-950/40">
                    <td className="py-2.5 text-zinc-400">
                      {format(new Date(log.createdAt), "MMM d, HH:mm:ss")}
                    </td>
                    <td className="py-2.5 text-white font-medium">{log.source}</td>
                    <td className="py-2.5">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${
                          is200
                            ? "bg-emerald-950/70 text-emerald-300 border-emerald-800/40"
                            : "bg-rose-950/70 text-rose-300 border-rose-800/40"
                        }`}
                      >
                        HTTP {log.statusCode}
                      </span>
                    </td>
                    <td className="py-2.5 text-zinc-300">{log.recordsUpserted}</td>
                    <td className="py-2.5 text-zinc-400">{log.durationMs}ms</td>
                    <td className="py-2.5 text-zinc-500 text-[11px] truncate max-w-xs">
                      {log.errorDetail || "Success (delta sync)"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Notification Toast Banners */}
      {connectedParam === "google_health" && (
        <div className="fixed bottom-6 right-6 z-50 p-4 rounded-xl bg-emerald-950/95 border border-emerald-600/80 text-emerald-200 text-xs shadow-2xl flex items-center gap-3 backdrop-blur-md">
          <Check className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>Google Health connected! Automated morning delta syncing is now active.</span>
        </div>
      )}
      {errorParam && (
        <div className="fixed bottom-6 right-6 z-50 p-4 rounded-xl bg-rose-950/95 border border-rose-600/80 text-rose-200 text-xs shadow-2xl flex items-center gap-3 backdrop-blur-md">
          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>Google Health Sync Notice: {errorParam === "missing_google_client_id" ? "Please set GOOGLE_CLIENT_ID in your Vercel project environment." : errorParam}</span>
        </div>
      )}

      {/* Google Health OAuth Setup Guide Modal */}
      {showGoogleModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#121215] border border-zinc-800 rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded bg-blue-950 text-blue-300 font-bold flex items-center justify-center text-xs">
                  G
                </div>
                <h3 className="font-semibold text-white text-base">Google Health OAuth 2.0 Setup</h3>
              </div>
              <button
                onClick={() => setShowGoogleModal(false)}
                className="text-zinc-500 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-zinc-300 leading-relaxed">
              To allow Nadir to auto-sync sleep data from Google Health Connect directly via cloud REST API:
            </p>

            <ol className="text-xs text-zinc-400 space-y-3 list-decimal list-inside leading-relaxed">
              <li>
                Open the{" "}
                <a
                  href="https://console.cloud.google.com/apis/credentials"
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-400 hover:underline inline-flex items-center gap-1"
                >
                  Google Cloud Console <ExternalLink className="w-3 h-3" />
                </a>{" "}
                and enable the <strong>Fitness API</strong>.
              </li>
              <li>Create an <strong>OAuth 2.0 Client ID</strong> (Application type: <em>Web application</em>).</li>
              <li>
                Under <strong>Authorized redirect URIs</strong>, paste this exact callback URL:
                <div className="mt-1.5 flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={
                      typeof window !== "undefined"
                        ? `${window.location.origin}/api/auth/callback/google`
                        : "https://circadian-sleep-app.vercel.app/api/auth/callback/google"
                    }
                    className="w-full bg-zinc-950 border border-zinc-800 rounded px-2.5 py-1.5 text-[11px] font-mono text-zinc-300"
                  />
                  <button
                    onClick={() => {
                      const url = typeof window !== "undefined"
                        ? `${window.location.origin}/api/auth/callback/google`
                        : "https://circadian-sleep-app.vercel.app/api/auth/callback/google";
                      navigator.clipboard.writeText(url);
                      setCopiedRedirectUri(true);
                      setTimeout(() => setCopiedRedirectUri(false), 2000);
                    }}
                    className="px-2.5 py-1.5 bg-zinc-900 border border-zinc-800 rounded text-[11px] text-zinc-300 font-medium shrink-0"
                  >
                    {copiedRedirectUri ? "Copied" : "Copy"}
                  </button>
                </div>
              </li>
              <li>
                In your{" "}
                <a
                  href="https://vercel.com/albert-antonys-projects/circadian-sleep-app/settings/environment-variables"
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-400 hover:underline inline-flex items-center gap-1"
                >
                  Vercel Environment Variables <ExternalLink className="w-3 h-3" />
                </a>, add:
                <pre className="mt-1 bg-zinc-950 p-2 rounded border border-zinc-900 text-[11px] text-amber-300 font-mono">
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
                </pre>
              </li>
              <li>
                Once saved in Vercel, click <strong>Connect Account</strong> to authorize. Nadir will auto-pull finalized sleep logs every morning via Vercel Cron.
              </li>
            </ol>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setShowGoogleModal(false)}
                className="px-4 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-xs font-medium"
              >
                Close Guide
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function SourcesHealthPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 text-zinc-500 animate-pulse font-mono text-xs">
          Loading Sources & Sync Health Manager...
        </div>
      }
    >
      <SourcesHealthContent />
    </Suspense>
  );
}
