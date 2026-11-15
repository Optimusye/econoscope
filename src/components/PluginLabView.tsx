import { useState } from "react";
import {
  BrainCircuit,
  ExternalLink,
  GitBranch,
  Globe2,
  Inbox,
  Link2,
  Plug,
  RadioTower,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Tags,
  Zap,
} from "lucide-react";
import { REGIONS } from "../data/econoscopeData";
import type {
  EconomicAlert,
  PluginConnector,
  RegionKey,
  SignalItem,
  SignalSource,
  WorldBankRecord,
} from "../types/econoscope";

interface PluginLabViewProps {
  region: RegionKey;
  signals: SignalItem[];
  alerts: EconomicAlert[];
  plugins: PluginConnector[];
  worldBankRecords: WorldBankRecord[];
  lastSyncedAt: string | null;
  isSyncing: boolean;
  onSyncPlugins: () => void;
  onTogglePlugin: (pluginId: string) => void;
  onIngestCustomSource: (urlOrTopic: string) => Promise<void>;
  onGenerateScenario: (scenarioPrompt: string) => Promise<void>;
  onOpenAlert: (alertId: string) => void;
}

const SOURCE_FILTERS: Array<"All" | SignalSource> = [
  "All",
  "Forbes",
  "World Bank",
  "FAO",
  "X/Social Velocity",
  "GDELT",
  "Spot Markets",
  "ECO Web",
];

function sourceLabelClass(src: SignalSource): string {
  if (src === "FAO") return "text-emerald-700 dark:text-emerald-300";
  if (src === "GDELT") return "text-amber-700 dark:text-amber-300";
  return "text-zinc-950 dark:text-white";
}

export function PluginLabView({
  region,
  signals,
  alerts,
  plugins,
  worldBankRecords,
  lastSyncedAt,
  isSyncing,
  onSyncPlugins,
  onTogglePlugin,
  onIngestCustomSource,
  onGenerateScenario,
  onOpenAlert,
}: PluginLabViewProps) {
  const [sourceFilter, setSourceFilter] = useState<"All" | SignalSource>("All");
  const [selectedSignalId, setSelectedSignalId] = useState<number>(signals[0]?.id ?? 1);
  const [customInput, setCustomInput] = useState("");
  const [isIngesting, setIsIngesting] = useState(false);
  const [ingestError, setIngestError] = useState<string | null>(null);

  const [scenarioInput, setScenarioInput] = useState("");
  const [isGeneratingScenario, setIsGeneratingScenario] = useState(false);
  const [scenarioError, setScenarioError] = useState<string | null>(null);

  const filteredSignals = signals
    .filter(
      (s) =>
        (region === "global" || s.regions.includes(region)) &&
        (sourceFilter === "All" || s.src === sourceFilter)
    )
    .sort((a, b) => a.minutesAgo - b.minutesAgo);

  const activeSignal = filteredSignals.find((s) => s.id === selectedSignalId) ?? filteredSignals[0];
  const linkedAlert = activeSignal
    ? alerts.find((a) => a.id === activeSignal.alertId) ?? alerts[0]
    : undefined;

  const handleIngestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customInput.trim() || isIngesting) return;
    setIngestError(null);
    setIsIngesting(true);
    try {
      await onIngestCustomSource(customInput.trim());
      setCustomInput("");
    } catch (err) {
      setIngestError(err instanceof Error ? err.message : "Failed to ingest source.");
    } finally {
      setIsIngesting(false);
    }
  };

  const handleScenarioSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scenarioInput.trim() || isGeneratingScenario) return;
    setScenarioError(null);
    setIsGeneratingScenario(true);
    try {
      await onGenerateScenario(scenarioInput.trim());
      setScenarioInput("");
    } catch (err) {
      setScenarioError(err instanceof Error ? err.message : "Failed to synthesize crisis scenario.");
    } finally {
      setIsGeneratingScenario(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Live Data Plugin Connectors Hub */}
      <section className="liquid-glass rounded-xl overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-900/10 dark:border-white/10 px-4 py-3">
          <div className="flex items-center gap-2">
            <Plug className="w-4 h-4 text-zinc-900 dark:text-zinc-100" />
            <div>
              <h2 className="text-sm font-semibold text-zinc-950 dark:text-white">Live Data Plugin Connectors</h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Modular ingestion connectors unifying World Bank, GDELT, FAO, Forbes, Spot Markets, and Social Velocity
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {lastSyncedAt && (
              <span className="font-mono text-[11px] text-zinc-500 dark:text-zinc-400">
                Last sync {new Date(lastSyncedAt).toLocaleTimeString()}
              </span>
            )}
            <button
              type="button"
              onClick={onSyncPlugins}
              disabled={isSyncing}
              className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 hover:opacity-90 disabled:opacity-50 px-3.5 py-2 text-xs font-semibold transition-opacity whitespace-nowrap shrink-0 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin" : ""}`} />
              <span>{isSyncing ? "Syncing APIs..." : "Sync Live Public APIs"}</span>
            </button>
          </div>
        </div>

        <div className="p-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {plugins.map((pl) => (
            <div
              key={pl.id}
              className={`rounded-xl border p-3.5 transition-colors space-y-2 ${
                pl.enabled
                  ? "border-zinc-900/15 dark:border-white/15 bg-white/60 dark:bg-zinc-950/50"
                  : "border-zinc-900/5 dark:border-white/5 bg-zinc-200/40 dark:bg-zinc-950/25 opacity-60"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-zinc-950 dark:text-white">{pl.name}</h3>
                  <div className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                    <span>{pl.category}</span>
                    <span aria-hidden="true"> · </span>
                    <span className="text-zinc-800 dark:text-zinc-200 font-medium">Model: {pl.inspiredBy}</span>
                  </div>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={pl.enabled}
                  onClick={() => onTogglePlugin(pl.id)}
                  className={`rounded-md px-2.5 py-1 font-mono text-[10px] font-semibold border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                    pl.enabled
                      ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-700 dark:text-emerald-300"
                      : "bg-zinc-200 dark:bg-zinc-900 border-zinc-300 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400"
                  }`}
                >
                  {pl.enabled ? "ACTIVE" : "PAUSED"}
                </button>
              </div>

              <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed">{pl.description}</p>

              <div className="flex items-center justify-between gap-2 pt-1 text-[11px] font-mono text-zinc-500 dark:text-zinc-400">
                <span className="truncate">{pl.endpointLabel}</span>
                <span className="text-zinc-900 dark:text-white font-semibold shrink-0 tabular-nums">
                  {pl.signalsCount.toLocaleString()}
                </span>
              </div>
            </div>
          ))}
        </div>

        {worldBankRecords.length > 0 && (
          <div className="border-t border-zinc-900/10 dark:border-white/10 px-4 py-3 bg-white/40 dark:bg-zinc-950/35">
            <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
              Live World Bank v2 Official CPI Prints (FP.CPI.TOTL.ZG)
            </div>
            <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-xs">
              {worldBankRecords.slice(0, 7).map((wb, idx) => (
                <div
                  key={`${wb.countryCode}-${wb.year}-${idx}`}
                  className="font-mono text-zinc-800 dark:text-zinc-200 tabular-nums"
                >
                  <span className="text-zinc-500 dark:text-zinc-400">
                    {wb.country} ({wb.year}):
                  </span>{" "}
                  <span className="text-zinc-950 dark:text-white font-semibold">{wb.cpiAnnualPct}%</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Dual AI Lab Engines */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Custom URL / Topic Live Plugin Ingestor */}
        <div className="liquid-glass rounded-xl p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Link2 className="w-4 h-4 text-zinc-900 dark:text-zinc-100" />
              <h2 className="text-sm font-semibold text-zinc-950 dark:text-white">
                Custom Source &amp; URL Plugin Ingestor
              </h2>
            </div>
            <span className="text-xs text-zinc-500 dark:text-zinc-400">ECO Web &amp; URL Grounding</span>
          </div>

          <form onSubmit={handleIngestSubmit} className="flex flex-col sm:flex-row gap-2.5">
            <input
              type="text"
              value={customInput}
              onChange={(e) => setCustomInput(e.target.value)}
              placeholder="Paste Forbes/news URL or macro topic..."
              className="flex-1 rounded-lg border border-zinc-900/15 dark:border-white/15 bg-white/80 dark:bg-zinc-950/70 px-3.5 py-2 text-xs text-zinc-950 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:border-zinc-900 dark:focus:border-white"
            />
            <button
              type="submit"
              disabled={isIngesting || !customInput.trim()}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 px-4 py-2 text-xs font-semibold hover:opacity-90 disabled:opacity-45 transition-opacity whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{isIngesting ? "Extracting..." : "Ingest & Synthesize"}</span>
            </button>
          </form>

          <div className="flex flex-wrap items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
            <span>Samples:</span>
            {[
              "Red Sea freight insurance surge wheat",
              "East Africa urea supply shortage",
              "Southeast Asia rice export curbs",
            ].map((sample) => (
              <button
                key={sample}
                type="button"
                onClick={() => setCustomInput(sample)}
                className="rounded-md border border-zinc-900/15 dark:border-white/15 bg-white/60 dark:bg-zinc-950/50 px-2 py-1 text-[11px] text-zinc-800 dark:text-zinc-200 hover:border-zinc-900/35 dark:hover:border-white/35 transition-colors cursor-pointer"
              >
                {sample}
              </button>
            ))}
          </div>

          {ingestError && (
            <div className="rounded-lg border border-red-500/35 bg-red-500/10 px-3 py-2 text-xs text-red-700 dark:text-red-200">
              {ingestError}
            </div>
          )}
        </div>

        {/* AI Crisis Scenario Stress-Test Generator */}
        <div className="liquid-glass rounded-xl p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-500" />
              <h2 className="text-sm font-semibold text-zinc-950 dark:text-white">
                ECO Crisis Scenario Stress-Test Generator
              </h2>
            </div>
            <span className="inline-flex items-center gap-1 text-xs text-zinc-700 dark:text-zinc-300">
              <Globe2 className="w-3.5 h-3.5" />
              <span>Pins live 3D epicenter</span>
            </span>
          </div>

          <form onSubmit={handleScenarioSubmit} className="flex flex-col sm:flex-row gap-2.5">
            <input
              type="text"
              value={scenarioInput}
              onChange={(e) => setScenarioInput(e.target.value)}
              placeholder="Describe any hypothetical shock (e.g., Malacca blockade + El Nino rice failure)..."
              className="flex-1 rounded-lg border border-amber-500/35 bg-white/80 dark:bg-zinc-950/70 px-3.5 py-2 text-xs text-zinc-950 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:border-amber-500"
            />
            <button
              type="submit"
              disabled={isGeneratingScenario || !scenarioInput.trim()}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-amber-500/45 bg-amber-500/20 hover:bg-amber-500/30 disabled:opacity-50 px-4 py-2 text-xs font-semibold text-amber-900 dark:text-amber-100 transition-all whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Zap className="w-3.5 h-3.5 text-amber-600 dark:text-amber-300" />
              <span>{isGeneratingScenario ? "Simulating..." : "Simulate & Map 3D"}</span>
            </button>
          </form>

          <div className="flex flex-wrap items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
            <span>Stress presets:</span>
            {[
              "Malacca Strait congestion slows ASEAN rice exports",
              "Mississippi low-water barge halt lifts US Gulf corn basis",
              "European LNG terminal outage ahead of winter cold snap",
            ].map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setScenarioInput(preset)}
                className="rounded-md border border-amber-500/25 bg-white/60 dark:bg-zinc-950/50 px-2 py-1 text-[11px] text-amber-800 dark:text-amber-200 hover:border-amber-500/50 transition-colors cursor-pointer"
              >
                {preset.slice(0, 38)}...
              </button>
            ))}
          </div>

          {scenarioError && (
            <div className="rounded-lg border border-red-500/35 bg-red-500/10 px-3 py-2 text-xs text-red-700 dark:text-red-200">
              {scenarioError}
            </div>
          )}
        </div>
      </section>

      {/* Source Filter Bar */}
      <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filter signal sources">
        {SOURCE_FILTERS.map((src) => {
          const active = sourceFilter === src;
          return (
            <button
              key={src}
              type="button"
              onClick={() => setSourceFilter(src)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                active
                  ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-950"
                  : "liquid-glass-subtle text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white"
              }`}
            >
              {src}
            </button>
          );
        })}
      </div>

      {/* Signal Feed + 4-Stage AI Reasoning Pipeline */}
      <section className="grid grid-cols-1 lg:grid-cols-[1.15fr_1fr] gap-4 items-start">
        <div className="liquid-glass rounded-xl overflow-hidden">
          <div className="flex items-center justify-between border-b border-zinc-900/10 dark:border-white/10 px-4 py-3">
            <div className="flex items-center gap-2">
              <RadioTower className="w-4 h-4 text-zinc-900 dark:text-zinc-100" />
              <h2 className="text-sm font-semibold text-zinc-950 dark:text-white">Multi-Source Signal Stream</h2>
            </div>
            <span className="font-mono text-xs text-zinc-500 dark:text-zinc-400 tabular-nums">
              {filteredSignals.length} items
            </span>
          </div>

          <div className="max-h-[540px] overflow-y-auto divide-y divide-zinc-900/10 dark:divide-white/10">
            {filteredSignals.length === 0 ? (
              <p className="p-4 text-xs text-zinc-500 dark:text-zinc-400">
                No signals match the active region and source filters.
              </p>
            ) : (
              filteredSignals.map((sig) => {
                const selected = activeSignal?.id === sig.id;
                return (
                  <button
                    key={sig.id}
                    type="button"
                    onClick={() => setSelectedSignalId(sig.id)}
                    className={`w-full text-left p-3.5 transition-colors cursor-pointer flex gap-3 ${
                      selected
                        ? "bg-zinc-900/10 dark:bg-white/15"
                        : "hover:bg-zinc-900/[0.04] dark:hover:bg-white/[0.05]"
                    }`}
                  >
                    <span className="font-mono text-[11px] text-zinc-500 dark:text-zinc-400 tabular-nums shrink-0 pt-0.5">
                      {sig.minutesAgo < 60 ? `${sig.minutesAgo}m` : `${Math.round(sig.minutesAgo / 60)}h`}
                    </span>
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className={`font-semibold ${sourceLabelClass(sig.src)}`}>{sig.src}</span>
                        <span className="text-zinc-400">·</span>
                        <span className="text-zinc-500 dark:text-zinc-400">
                          {sig.regions
                            .filter((r) => r !== "global")
                            .map((r) => REGIONS[r]?.name ?? r)
                            .join(", ") || "Global"}
                        </span>
                        {sig.isLive && (
                          <>
                            <span className="text-zinc-400">·</span>
                            <span className="font-mono text-[10px] font-bold text-emerald-600 dark:text-emerald-300">
                              LIVE
                            </span>
                          </>
                        )}
                      </div>
                      <p className="text-xs text-zinc-800 dark:text-zinc-100 leading-relaxed">{sig.text}</p>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* 4-Stage AI Reasoning Pipeline */}
        <div className="liquid-glass rounded-xl overflow-hidden">
          <div className="flex items-center gap-2 border-b border-zinc-900/10 dark:border-white/10 px-4 py-3">
            <BrainCircuit className="w-4 h-4 text-zinc-900 dark:text-zinc-100" />
            <h2 className="text-sm font-semibold text-zinc-950 dark:text-white">AI Reasoning Pipeline</h2>
          </div>

          {activeSignal && linkedAlert ? (
            <div className="p-4 space-y-3">
              <div className="rounded-xl border border-zinc-900/10 dark:border-white/10 bg-white/55 dark:bg-zinc-950/45 p-3 space-y-1.5">
                <div className="flex items-center justify-between text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                  <span className="inline-flex items-center gap-1.5">
                    <Inbox className="w-3.5 h-3.5" />
                    <span>1. Raw Ingested Signal</span>
                  </span>
                  {activeSignal.url && (
                    <a
                      href={activeSignal.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] text-zinc-800 dark:text-zinc-200 hover:underline"
                    >
                      <span>Source</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
                <p className="text-xs text-zinc-800 dark:text-zinc-100 leading-relaxed">{activeSignal.text}</p>
                <div className="font-mono text-[11px] text-zinc-500 dark:text-zinc-400">
                  {activeSignal.src} · {activeSignal.minutesAgo}m ago
                </div>
              </div>

              <div className="rounded-xl border border-zinc-900/10 dark:border-white/10 bg-white/55 dark:bg-zinc-950/45 p-3 space-y-2">
                <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                  <Tags className="w-3.5 h-3.5" />
                  <span>2. Entity &amp; Telemetry Extraction</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {activeSignal.entities.map(([k, v], i) => (
                    <span
                      key={`${k}-${i}`}
                      className="inline-flex items-center gap-1.5 rounded-md border border-zinc-900/15 dark:border-white/15 bg-zinc-200/60 dark:bg-zinc-900/75 px-2.5 py-1 text-xs text-zinc-900 dark:text-zinc-100"
                    >
                      <span className="font-mono text-[10px] text-zinc-500 dark:text-zinc-400">{k}</span>
                      <span>{v}</span>
                    </span>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-zinc-900/10 dark:border-white/10 bg-white/55 dark:bg-zinc-950/45 p-3 space-y-2">
                <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                  <GitBranch className="w-3.5 h-3.5" />
                  <span>3. Causal Transmission Chain</span>
                </div>
                <div className="space-y-2">
                  {linkedAlert.causalChain.map((step, i) => (
                    <div key={step} className="flex items-start gap-2.5 text-xs text-zinc-800 dark:text-zinc-200">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-zinc-900/25 dark:border-white/25 bg-zinc-900/10 dark:bg-white/10 font-mono text-[10px] font-bold text-zinc-950 dark:text-white">
                        {i + 1}
                      </span>
                      <span className="pt-0.5">{step}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-zinc-900/10 dark:border-white/10 bg-white/55 dark:bg-zinc-950/45 p-3 space-y-2.5">
                <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>4. Cross-Source Triangulation</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-mono font-semibold text-zinc-950 dark:text-white tabular-nums">
                    {linkedAlert.confidence.toFixed(1)}% Confidence
                  </span>
                  <span className="font-mono text-zinc-500 dark:text-zinc-400 tabular-nums">
                    {linkedAlert.sourceCounts[0]} Official · {linkedAlert.sourceCounts[1]} News ·{" "}
                    {linkedAlert.sourceCounts[2].toLocaleString()} Social
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => onOpenAlert(linkedAlert.id)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 px-3 py-1.5 text-xs font-semibold hover:opacity-90 transition-opacity cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Open Full AI Explanation</span>
                </button>
              </div>
            </div>
          ) : (
            <p className="p-4 text-xs text-zinc-500 dark:text-zinc-400">
              Select a signal from the feed to inspect the reasoning pipeline.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
