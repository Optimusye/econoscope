import { useState } from "react";
import { ArrowRight, Bot, CheckCircle2, Crown, Globe2, Layers, Plug, Sparkles, X, Zap } from "lucide-react";
import { BENCHMARK_PLATFORMS } from "../data/econoscopeData";
import type { RegionKey, TabView } from "../types/econoscope";

interface JudgeTourModalProps {
  open: boolean;
  onClose: () => void;
  onNavigateStep: (view: TabView, region?: RegionKey, triggerShock?: boolean, openAlertId?: string) => void;
}

interface TourStep {
  title: string;
  subtitle: string;
  description: string;
  ctaLabel: string;
  view: TabView;
  region?: RegionKey;
  triggerShock?: boolean;
  openAlertId?: string;
}

const TOUR_STEPS: TourStep[] = [
  {
    title: "01. Market Briefs, 108-Country Matrix & Simulator",
    subtitle: "Command Center · All 6 Continents",
    description:
      "Stream live rolling Market Briefs with instant sentiment, inspect 108 countries across all 6 continents (with Debt/GDP & Current Account), tune mitigation sliders, and jump onto the 3D globe.",
    ctaLabel: "Inspect Command Center",
    view: "command",
    region: "eafrica",
  },
  {
    title: "02. Monochrome 3D World Atlas & Heatmap",
    subtitle: "108+ Locations · 28 Trade Arcs · 16 Chokepoints",
    description:
      "Explore our uncluttered Three.js 3D globe in Dark or Light mode with continent filters, 3D risk pillars, maritime corridors, and an interactive Location Risk Inspector.",
    ctaLabel: "Launch 3D Risk Atlas",
    view: "atlas",
    region: "global",
  },
  {
    title: "03. Ask ECO — Macro Intelligence Copilot",
    subtitle: "Dedicated ECO AI Sub-Tab · Web-Grounded",
    description:
      "Ask ECO any question about sovereign inflation divergence, grain shortages, or chokepoint rerouting and receive structured institutional answers with live web citations.",
    ctaLabel: "Open ECO AI Workspace",
    view: "eco",
  },
  {
    title: "04. Live Public API Plugins & AI Stress Lab",
    subtitle: "World Bank v2 · GDELT 2.0 · FAO · Custom Scenarios",
    description:
      "Sync live public datasets, ingest any Forbes/news URL, or generate a custom crisis scenario that pins a new 3D epicenter straight onto the World Atlas.",
    ctaLabel: "Open Plugins & AI Lab",
    view: "plugins",
  },
  {
    title: "05. Free ($0) vs Pro ($10/mo) Pricing Tiers",
    subtitle: "Democratizing $24k/yr Macro Intelligence",
    description:
      "Switch between Free ($0/mo) and Pro ($10/mo) plans live to inspect feature gating, ECO AI query quotas, and full institutional cost comparison.",
    ctaLabel: "Inspect Pricing Tiers",
    view: "pricing",
  },
  {
    title: "06. Live Crisis Shock Cascade Simulation",
    subtitle: "Stress-Test Multi-Order Contagion",
    description:
      "Inject a 4-stage Suez suspension + Brent +14% + Wheat limit-up shock cascade to watch global threat levels, 3D heatmaps, and commodity risk gauges reprice in real time.",
    ctaLabel: "Launch Shock Cascade",
    view: "atlas",
    region: "global",
    triggerShock: true,
  },
];

export function JudgeTourModal({ open, onClose, onNavigateStep }: JudgeTourModalProps) {
  const [activeTab, setActiveTab] = useState<"tour" | "benchmarks">("tour");

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="EconoScope Judge Demo Mode and Platform Benchmarks"
        className="liquid-glass-elevated relative z-10 w-full max-w-4xl max-h-[88vh] overflow-y-auto rounded-2xl p-6 space-y-5"
      >
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-zinc-900/10 dark:border-white/10 pb-4">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-600 dark:text-zinc-300 mb-1">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Hackathon Showcase</span>
            </div>
            <h2 className="text-xl font-bold text-zinc-950 dark:text-white">
              Judge Demo Mode &amp; Intelligence Architecture
            </h2>
            <p className="text-xs text-zinc-600 dark:text-zinc-300 mt-1">
              Guided interactive walkthrough and architectural comparison against existing macro-intelligence platforms.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-1 rounded-lg border border-zinc-900/15 dark:border-white/15 bg-white/75 dark:bg-zinc-900/80 px-3 py-1.5 text-xs text-zinc-800 dark:text-zinc-200 hover:text-zinc-950 dark:hover:text-white cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
            <span>Close</span>
          </button>
        </div>

        {/* Mode Switch */}
        <div className="inline-flex items-center rounded-lg border border-zinc-900/15 dark:border-white/15 bg-white/60 dark:bg-zinc-950/60 p-1">
          <button
            type="button"
            onClick={() => setActiveTab("tour")}
            className={`inline-flex items-center gap-1.5 rounded-md px-3.5 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
              activeTab === "tour"
                ? "bg-zinc-950 text-white dark:bg-white dark:text-zinc-950"
                : "text-zinc-600 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white"
            }`}
          >
            <Globe2 className="w-3.5 h-3.5" />
            <span>6-Step Guided Tour</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("benchmarks")}
            className={`inline-flex items-center gap-1.5 rounded-md px-3.5 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
              activeTab === "benchmarks"
                ? "bg-zinc-950 text-white dark:bg-white dark:text-zinc-950"
                : "text-zinc-600 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white"
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Learned From Industry Platforms</span>
          </button>
        </div>

        {activeTab === "tour" ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {TOUR_STEPS.map((step) => (
              <div
                key={step.title}
                className="rounded-xl border border-zinc-900/10 dark:border-white/10 bg-white/65 dark:bg-zinc-900/60 p-4 flex flex-col justify-between gap-3"
              >
                <div className="space-y-1.5">
                  <div className="text-[11px] font-mono text-zinc-500 dark:text-zinc-400">{step.subtitle}</div>
                  <h3 className="text-sm font-bold text-zinc-950 dark:text-white">{step.title}</h3>
                  <p className="text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed">{step.description}</p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    onNavigateStep(step.view, step.region, step.triggerShock, step.openAlertId);
                    onClose();
                  }}
                  className="inline-flex items-center justify-between gap-2 rounded-lg bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 px-3 py-2 text-xs font-semibold hover:opacity-90 transition-opacity cursor-pointer"
                >
                  <span className="inline-flex items-center gap-1.5">
                    {step.triggerShock ? (
                      <Zap className="w-3.5 h-3.5 text-red-400" />
                    ) : step.view === "plugins" ? (
                      <Plug className="w-3.5 h-3.5" />
                    ) : step.view === "eco" ? (
                      <Bot className="w-3.5 h-3.5" />
                    ) : step.view === "pricing" ? (
                      <Crown className="w-3.5 h-3.5" />
                    ) : (
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    )}
                    <span>{step.ctaLabel}</span>
                  </span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-zinc-900/10 dark:border-white/10 bg-white/65 dark:bg-zinc-900/60 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-zinc-900/10 dark:border-white/10 text-zinc-500 dark:text-zinc-400">
                    <th className="py-3 px-4 text-left font-semibold">Reference Platform</th>
                    <th className="py-3 px-4 text-left font-semibold">Core Strength</th>
                    <th className="py-3 px-4 text-left font-semibold">Gap EconoScope Solves</th>
                    <th className="py-3 px-4 text-left font-semibold">EconoScope Integration</th>
                  </tr>
                </thead>
                <tbody>
                  {BENCHMARK_PLATFORMS.map((row) => (
                    <tr key={row.platform} className="border-b border-zinc-900/5 dark:border-white/5 last:border-0">
                      <td className="py-3 px-4 font-semibold text-zinc-950 dark:text-white whitespace-nowrap">
                        {row.platform}
                      </td>
                      <td className="py-3 px-4 text-zinc-700 dark:text-zinc-200">{row.strength}</td>
                      <td className="py-3 px-4 text-zinc-500 dark:text-zinc-400">{row.blindSpot}</td>
                      <td className="py-3 px-4 text-emerald-700 dark:text-emerald-300">{row.econoscopeSynthesis}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
