import { useState } from "react";
import {
  CheckCircle2,
  ClipboardCopy,
  Clock3,
  ExternalLink,
  GitBranch,
  History,
  ListChecks,
  Network,
  Quote,
  Shield,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import type { EconomicAlert, GroundedCitation, ThemeMode } from "../types/econoscope";
import { RadialGauge } from "./Charts";

interface ExplainabilityDrawerProps {
  theme: ThemeMode;
  alert: EconomicAlert | null;
  onClose: () => void;
  onShowInImpactMatrix: (alertId: string) => void;
  onCopySuccess: (message: string) => void;
}

export function ExplainabilityDrawer({
  theme,
  alert,
  onClose,
  onShowInImpactMatrix,
  onCopySuccess,
}: ExplainabilityDrawerProps) {
  const [liveBriefing, setLiveBriefing] = useState<{
    alertId: string;
    text: string;
    citations: GroundedCitation[];
  } | null>(null);
  const [loadingBriefing, setLoadingBriefing] = useState(false);
  const [briefingError, setBriefingError] = useState<string | null>(null);

  if (!alert) return null;

  const activeBriefing = liveBriefing?.alertId === alert.id ? liveBriefing : null;

  const handleGenerateBriefing = async () => {
    setLoadingBriefing(true);
    setBriefingError(null);
    try {
      const resp = await fetch("/api/ai/briefing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          alertTitle: alert.title,
          alertWhy: alert.why,
          region: alert.regions.join(", "),
          severity: alert.severity,
        }),
      });
      const data = (await resp.json()) as {
        briefing?: string;
        citations?: GroundedCitation[];
        error?: string;
      };
      if (!resp.ok || data.error) {
        throw new Error(data.error || "Failed to generate briefing");
      }
      setLiveBriefing({
        alertId: alert.id,
        text: data.briefing ?? "",
        citations: data.citations ?? [],
      });
    } catch (err) {
      setBriefingError(err instanceof Error ? err.message : "Failed to reach ECO AI service.");
    } finally {
      setLoadingBriefing(false);
    }
  };

  const handleCopy = async () => {
    const text = [
      `${alert.severity} | ${alert.title}`,
      `Lead: ${alert.leadDays} days ahead of official CPI`,
      `Confidence: ${alert.confidence.toFixed(1)}% (${alert.sourceCounts[0]} datasets, ${alert.sourceCounts[1]} news wires, ${alert.sourceCounts[2].toLocaleString()} social signals)`,
      `Why: ${alert.why}`,
      `Policy: ${alert.actions.slice(0, 2).join("; ")}`,
      `Hedging: ${alert.actions.slice(2).join("; ")}`,
    ].join("\n");

    try {
      await navigator.clipboard.writeText(text);
      onCopySuccess("Executive briefing copied to clipboard.");
    } catch {
      onCopySuccess("Unable to access clipboard automatically.");
    }
  };

  const triRows = [
    { label: "Official datasets", count: alert.sourceCounts[0], color: "bg-emerald-500 dark:bg-emerald-400" },
    { label: "News wires", count: alert.sourceCounts[1], color: "bg-zinc-900 dark:bg-zinc-100" },
    { label: "Social signals", count: alert.sourceCounts[2], color: "bg-zinc-500 dark:bg-zinc-400" },
  ];
  const maxLog = Math.log10(Math.max(alert.sourceCounts[2], 10) + 1);

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div
        className="fixed inset-0 bg-black/55 dark:bg-black/75 backdrop-blur-xs transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      <aside
        aria-label="AI Explainability Drawer"
        className="relative z-10 h-full w-full max-w-[580px] overflow-y-auto border-l border-zinc-900/15 dark:border-white/15 bg-zinc-100/95 dark:bg-zinc-950/95 backdrop-blur-2xl shadow-2xl"
      >
        <div className="sticky top-0 z-10 border-b border-zinc-900/10 dark:border-white/10 bg-zinc-100/95 dark:bg-zinc-950/95 backdrop-blur-xl px-5 py-4 space-y-2">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs font-mono font-bold">
              <span
                className={
                  alert.severity === "CRITICAL"
                    ? "text-red-600 dark:text-red-400"
                    : alert.severity === "ELEVATED"
                      ? "text-amber-600 dark:text-amber-300"
                      : "text-zinc-900 dark:text-zinc-200"
                }
              >
                {alert.severity}
              </span>
              <span className="text-zinc-400">·</span>
              <span className="font-sans font-medium text-zinc-700 dark:text-zinc-300">{alert.category}</span>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center gap-1 rounded-lg border border-zinc-900/15 dark:border-white/15 bg-white/75 dark:bg-zinc-900/80 px-2.5 py-1 text-xs font-medium text-zinc-800 dark:text-zinc-200 hover:text-zinc-950 dark:hover:text-white cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              <span>Close</span>
            </button>
          </div>

          <h2 className="text-lg font-bold text-zinc-950 dark:text-white leading-snug">{alert.title}</h2>

          <div className="flex items-center gap-1.5 font-mono text-xs text-zinc-700 dark:text-zinc-300">
            <Clock3 className="w-3.5 h-3.5" />
            <span>Detected {alert.leadDays} days ahead of official CPI print</span>
          </div>
        </div>

        <div className="p-5 space-y-6">
          {/* Why This Alert */}
          <section className="space-y-2">
            <h3 className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-900 dark:text-zinc-100">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Why This Alert</span>
            </h3>
            <p className="text-sm text-zinc-800 dark:text-zinc-200 leading-relaxed">{alert.why}</p>
          </section>

          {/* Live ECO Grounded Briefing */}
          <section className="rounded-xl border border-zinc-900/15 dark:border-white/15 bg-white/65 dark:bg-zinc-900/70 p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-950 dark:text-white">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Live ECO Web-Grounded Assessment</span>
              </span>
              <button
                type="button"
                onClick={handleGenerateBriefing}
                disabled={loadingBriefing}
                className="rounded-lg bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 hover:opacity-90 disabled:opacity-50 px-3 py-1.5 text-xs font-semibold transition-opacity cursor-pointer"
              >
                {loadingBriefing ? "Synthesizing..." : activeBriefing ? "Refresh Assessment" : "Run Live ECO Brief"}
              </button>
            </div>

            {briefingError && <p className="text-xs text-red-600 dark:text-red-300">{briefingError}</p>}

            {activeBriefing ? (
              <div className="space-y-2.5 text-xs text-zinc-800 dark:text-zinc-200 leading-relaxed whitespace-pre-wrap">
                <div>{activeBriefing.text}</div>
                {activeBriefing.citations.length > 0 && (
                  <div className="pt-2 border-t border-zinc-900/10 dark:border-white/10 space-y-1">
                    <div className="text-[11px] font-semibold text-zinc-700 dark:text-zinc-300">Grounded Sources</div>
                    {activeBriefing.citations.map((c) => (
                      <a
                        key={c.uri}
                        href={c.uri}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1.5 text-[11px] text-zinc-800 dark:text-zinc-200 hover:underline truncate"
                      >
                        <ExternalLink className="w-3 h-3 shrink-0" />
                        <span className="truncate">{c.title}</span>
                      </a>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-zinc-600 dark:text-zinc-400">
                Click &ldquo;Run Live ECO Brief&rdquo; to corroborate this signal with real-time web grounding and generate a fresh 14-day policy &amp; hedging memo.
              </p>
            )}
          </section>

          {/* Evidence Confidence */}
          <section className="space-y-3">
            <h3 className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-900 dark:text-zinc-100">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Evidence Confidence</span>
            </h3>
            <div className="flex items-center gap-4">
              <RadialGauge value={alert.confidence} size={76} theme={theme} />
              <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed">
                Confidence increases when independent source classes corroborate price pressure, freight delays, and social velocity simultaneously.
              </p>
            </div>
            <div className="space-y-2">
              {triRows.map((row) => {
                const pct = Math.max(8, Math.min(100, (Math.log10(row.count + 1) / maxLog) * 100));
                return (
                  <div key={row.label} className="grid grid-cols-[120px_1fr_52px] items-center gap-3 text-xs">
                    <span className="text-zinc-700 dark:text-zinc-300">{row.label}</span>
                    <div className="h-1.5 rounded-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden">
                      <div className={`h-full rounded-full ${row.color}`} style={{ width: `${pct}%` }} />
                    </div>
                    <span className="font-mono text-right text-zinc-900 dark:text-zinc-100 tabular-nums">
                      {row.count.toLocaleString()}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Causal Logic */}
          <section className="space-y-2.5">
            <h3 className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-900 dark:text-zinc-100">
              <GitBranch className="w-3.5 h-3.5" />
              <span>Causal Logic</span>
            </h3>
            <div className="space-y-2">
              {alert.causalChain.map((step, idx) => (
                <div key={step} className="flex items-start gap-2.5 text-xs text-zinc-800 dark:text-zinc-200">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-zinc-900/25 dark:border-white/25 bg-zinc-900/10 dark:bg-white/10 font-mono text-[10px] font-bold text-zinc-900 dark:text-white">
                    {idx + 1}
                  </span>
                  <span className="pt-0.5">{step}</span>
                </div>
              ))}
            </div>
          </section>

          {/* Ripple Effects */}
          <section className="space-y-2.5">
            <h3 className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-900 dark:text-zinc-100">
              <Network className="w-3.5 h-3.5" />
              <span>Ripple Effects</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {["1st Order", "2nd Order", "3rd Order"].map((orderLabel, idx) => (
                <div
                  key={orderLabel}
                  className="rounded-lg border border-zinc-900/10 dark:border-white/10 bg-white/60 dark:bg-zinc-900/60 p-2.5 space-y-2"
                >
                  <div className="text-[11px] font-semibold text-zinc-900 dark:text-zinc-100">{orderLabel}</div>
                  {alert.impactMatrix[idx].map((item) => (
                    <div
                      key={item.label}
                      className="rounded bg-zinc-200/65 dark:bg-zinc-800/75 p-2 text-[11px] text-zinc-900 dark:text-zinc-100"
                    >
                      <div>{item.label}</div>
                      <div className="font-mono text-[10px] text-zinc-500 dark:text-zinc-400 mt-1 tabular-nums">
                        {item.likelihood}% likelihood
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </section>

          {/* Source Citations */}
          <section className="space-y-2">
            <h3 className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-900 dark:text-zinc-100">
              <Quote className="w-3.5 h-3.5" />
              <span>Source Citations</span>
            </h3>
            <div className="space-y-1.5">
              {alert.citations.map(([src, desc, uri], idx) => (
                <div
                  key={`${src}-${idx}`}
                  className="flex items-start justify-between gap-2 rounded-lg border border-zinc-900/10 dark:border-white/10 bg-white/60 dark:bg-zinc-900/60 px-3 py-2 text-xs"
                >
                  <div className="space-x-2">
                    <span className="font-mono font-bold text-zinc-950 dark:text-white">{src}</span>
                    <span className="text-zinc-400">·</span>
                    <span className="text-zinc-700 dark:text-zinc-300">{desc}</span>
                  </div>
                  {uri && (
                    <a href={uri} target="_blank" rel="noreferrer" className="text-zinc-800 dark:text-zinc-200 shrink-0">
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* Historical Analog */}
          <section className="space-y-2">
            <h3 className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-900 dark:text-zinc-100">
              <History className="w-3.5 h-3.5" />
              <span>Historical Analog</span>
            </h3>
            <div className="rounded-lg border border-zinc-900/10 dark:border-white/10 bg-white/60 dark:bg-zinc-900/60 p-3 text-xs space-y-1">
              <div className="flex items-center justify-between">
                <strong className="text-zinc-950 dark:text-white">
                  {alert.analog.year}: {alert.analog.title}
                </strong>
                <span className="font-mono text-zinc-700 dark:text-zinc-300 tabular-nums">
                  {alert.analog.similarity}% similar
                </span>
              </div>
              <p className="text-zinc-600 dark:text-zinc-300">{alert.analog.result}</p>
            </div>
          </section>

          {/* Recommended Actions */}
          <section className="space-y-2.5">
            <h3 className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-900 dark:text-zinc-100">
              <ListChecks className="w-3.5 h-3.5" />
              <span>Recommended Actions</span>
            </h3>
            <div className="space-y-2 text-xs">
              <div className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">Policy Intervention</div>
              {alert.actions.slice(0, 2).map((act) => (
                <div key={act} className="flex items-start gap-2 text-zinc-900 dark:text-zinc-100">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                  <span>{act}</span>
                </div>
              ))}
              <div className="pt-1 text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">
                Hedging &amp; Procurement
              </div>
              {alert.actions.slice(2).map((act) => (
                <div key={act} className="flex items-start gap-2 text-zinc-900 dark:text-zinc-100">
                  <Shield className="w-3.5 h-3.5 text-zinc-700 dark:text-zinc-300 shrink-0 mt-0.5" />
                  <span>{act}</span>
                </div>
              ))}
            </div>
          </section>

          {/* Actions Footer */}
          <div className="flex flex-wrap gap-2.5 pt-2 border-t border-zinc-900/10 dark:border-white/10">
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-900/15 dark:border-white/15 bg-white/75 dark:bg-zinc-900/80 px-3.5 py-2 text-xs font-semibold text-zinc-900 dark:text-zinc-100 hover:border-zinc-900/35 dark:hover:border-white/35 transition-colors cursor-pointer"
            >
              <ClipboardCopy className="w-3.5 h-3.5" />
              <span>Copy Briefing</span>
            </button>
            <button
              type="button"
              onClick={() => onShowInImpactMatrix(alert.id)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 px-3.5 py-2 text-xs font-semibold hover:opacity-90 transition-opacity cursor-pointer"
            >
              <Network className="w-3.5 h-3.5" />
              <span>Inspect in Impact Matrix</span>
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
}
