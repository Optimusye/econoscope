import { motion } from "motion/react";
import { Check, Crown, ShieldCheck, Sparkles, X, Zap } from "lucide-react";
import type { PlanTier, TabView } from "../types/econoscope";

interface PricingViewProps {
  planTier: PlanTier;
  onSelectPlan: (tier: PlanTier) => void;
  onNavigateView: (view: TabView) => void;
}

const FREE_FEATURES = [
  "Command Center global dashboard, Market Briefs & 2D risk heatmap",
  "Full 108-country Sovereign Economic Matrix across 6 continents",
  "Interactive 3D Risk Atlas with 108+ geo-located hotspots",
  "8 ECO AI intelligence chats per day before upgrade prompt",
  "Public API sync (World Bank v2, GDELT 2.0, FAO, live RSS wires)",
  "Real-Time Basket vs Official CPI divergence charts",
];

const PRO_FEATURES = [
  "Unlimited ECO AI web-grounded macro research & policy memos",
  "AI Crisis Scenario Stress-Test Generator + custom 3D epicenters",
  "Unlimited Custom Forbes / URL & Report Plugin Ingestion",
  "Full Policy & Hedging Simulator + Instant CSV & Brief Exports",
  "Priority sub-minute maritime chokepoint & rerouting calculator",
  "Upcoming Central Bank & CPI Surprise Calendar Alerts (16 prints)",
];

const COMPARISON_ROWS: Array<{
  capability: string;
  free: string;
  pro: string;
}> = [
  { capability: "108-Country & 6-Continent Coverage", free: "Included", pro: "Included + Priority Updates" },
  { capability: "Interactive 3D World Risk Atlas", free: "Included", pro: "Included + Custom Scenario Pins" },
  { capability: "ECO AI Assistant Chats", free: "8 chats / day", pro: "Unlimited + Live Citations" },
  { capability: "Custom URL / Forbes Plugin Ingestion", free: "Preset samples", pro: "Unlimited URL & Topic Extraction" },
  { capability: "Crisis Shock Cascade Simulation", free: "4-Stage Preset", pro: "Preset + Custom AI Stress-Tests" },
  { capability: "Live Market Briefs & Public API Sync", free: "Standard cadence", pro: "Real-Time On-Demand Sync" },
  { capability: "Wholesale FAO Local Market Quotes (24 Hubs)", free: "Top 10 hubs", pro: "All 24 Global Hubs" },
  { capability: "Executive Briefing Export & Team Alerts", free: "CSV Export", pro: "Unlimited Briefs & Alerts" },
];

export function PricingView({ planTier, onSelectPlan, onNavigateView }: PricingViewProps) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="liquid-glass rounded-2xl p-6 sm:p-8 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4"
      >
        <div className="space-y-2 max-w-2xl">
          <div className="inline-flex items-center gap-1.5 font-mono text-[11px] font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Institutional Macro Intelligence, Accessible Pricing</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-zinc-950 dark:text-white tracking-tight">
            Simple, Transparent Plans for Analysts &amp; Decision-Makers
          </h1>
          <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed">
            Legacy platforms like Bloomberg, Dataminr, and AlphaSense cost $15,000–$30,000 per seat annually.
            EconoScope delivers real-time early warnings, 3D spatial heatmaps, and ECO AI intelligence starting at $0.
          </p>
        </div>

        <div className="liquid-glass-subtle rounded-xl px-4 py-3 text-xs space-y-1 shrink-0">
          <div className="text-zinc-500 dark:text-zinc-400">Current Active Workspace Plan</div>
          <div className="flex items-center gap-2 font-mono text-sm font-bold text-zinc-950 dark:text-white">
            {planTier === "pro" ? <Crown className="w-4 h-4" /> : <ShieldCheck className="w-4 h-4" />}
            <span>{planTier === "pro" ? "Pro Tier ($10/mo)" : "Free Tier ($0/mo)"}</span>
          </div>
        </div>
      </motion.section>

      {/* Two Plan Cards: Free vs Pro ($10/mo) */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-stretch">
        {/* Free Tier */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28, delay: 0.05 }}
          className={`liquid-glass rounded-2xl p-6 sm:p-7 flex flex-col justify-between gap-6 ${
            planTier === "free" ? "ring-2 ring-zinc-900 dark:ring-white" : ""
          }`}
        >
          <div className="space-y-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-zinc-950 dark:text-white">Free Tier</h2>
                <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1">
                  Essential global monitoring for researchers, students, and journalists
                </p>
              </div>
              {planTier === "free" && (
                <span className="rounded-md border border-zinc-900/20 dark:border-white/25 px-2.5 py-1 font-mono text-[10px] font-bold text-zinc-900 dark:text-white">
                  ACTIVE PLAN
                </span>
              )}
            </div>

            <div className="flex items-baseline gap-1.5 border-b border-zinc-900/10 dark:border-white/10 pb-5">
              <span className="font-mono text-4xl font-bold text-zinc-950 dark:text-white tabular-nums">$0</span>
              <span className="text-xs text-zinc-500 dark:text-zinc-400">/ month forever</span>
            </div>

            <ul className="space-y-2.5">
              {FREE_FEATURES.map((feat) => (
                <li key={feat} className="flex items-start gap-2.5 text-xs text-zinc-800 dark:text-zinc-200">
                  <Check className="w-4 h-4 text-zinc-900 dark:text-white shrink-0 mt-0.5" />
                  <span>{feat}</span>
                </li>
              ))}
            </ul>
          </div>

          <button
            type="button"
            onClick={() => onSelectPlan("free")}
            className={`w-full rounded-xl px-4 py-3 text-xs font-semibold transition-all cursor-pointer ${
              planTier === "free"
                ? "border border-zinc-900/25 dark:border-white/25 bg-zinc-200/70 dark:bg-zinc-800/80 text-zinc-950 dark:text-white"
                : "border border-zinc-900/20 dark:border-white/20 hover:bg-zinc-900/5 dark:hover:bg-white/10 text-zinc-900 dark:text-white"
            }`}
          >
            {planTier === "free" ? "Current Plan: Free ($0/mo)" : "Switch to Free Tier"}
          </button>
        </motion.div>

        {/* Pro Tier ($10/mo) */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28, delay: 0.1 }}
          className={`liquid-glass-elevated rounded-2xl p-6 sm:p-7 flex flex-col justify-between gap-6 relative overflow-hidden ${
            planTier === "pro" ? "ring-2 ring-zinc-950 dark:ring-white" : ""
          }`}
        >
          <div className="space-y-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="inline-flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-300 mb-1">
                  <Crown className="w-3.5 h-3.5" />
                  <span>Recommended · Full Terminal Access</span>
                </div>
                <h2 className="text-lg font-bold text-zinc-950 dark:text-white">Pro Tier</h2>
                <p className="text-xs text-zinc-600 dark:text-zinc-300 mt-1">
                  Unlimited ECO AI, custom crisis stress-testing, and live URL ingestion
                </p>
              </div>
              {planTier === "pro" && (
                <span className="rounded-md bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 px-2.5 py-1 font-mono text-[10px] font-bold">
                  ACTIVE PLAN
                </span>
              )}
            </div>

            <div className="flex items-baseline gap-1.5 border-b border-zinc-900/10 dark:border-white/15 pb-5">
              <span className="font-mono text-4xl font-bold text-zinc-950 dark:text-white tabular-nums">$10</span>
              <span className="text-xs text-zinc-600 dark:text-zinc-300">/ month · cancel anytime</span>
            </div>

            <ul className="space-y-2.5">
              {PRO_FEATURES.map((feat) => (
                <li key={feat} className="flex items-start gap-2.5 text-xs text-zinc-900 dark:text-zinc-100 font-medium">
                  <Zap className="w-4 h-4 text-zinc-950 dark:text-white shrink-0 mt-0.5" />
                  <span>{feat}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex flex-col sm:flex-row gap-2.5">
            <button
              type="button"
              onClick={() => onSelectPlan("pro")}
              className="flex-1 rounded-xl bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 px-4 py-3 text-xs font-bold hover:opacity-90 transition-opacity cursor-pointer shadow-lg"
            >
              {planTier === "pro" ? "Pro Tier Active ($10/mo)" : "Activate Pro Tier — $10/mo"}
            </button>
            <button
              type="button"
              onClick={() => onNavigateView("eco")}
              className="rounded-xl border border-zinc-900/20 dark:border-white/25 px-4 py-3 text-xs font-semibold text-zinc-900 dark:text-white hover:bg-zinc-900/5 dark:hover:bg-white/10 transition-colors cursor-pointer whitespace-nowrap"
            >
              Try ECO AI
            </button>
          </div>
        </motion.div>
      </section>

      {/* Detailed Feature Comparison Matrix */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.14 }}
        className="liquid-glass rounded-2xl overflow-hidden"
      >
        <div className="border-b border-zinc-900/10 dark:border-white/10 px-5 py-3.5 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-950 dark:text-white">
            Free vs Pro ($10/mo) Feature Matrix
          </h2>
          <span className="font-mono text-[11px] text-zinc-500 dark:text-zinc-400">
            Interactive plan switch updates ECO AI quota live
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-zinc-900/10 dark:border-white/10 text-zinc-500 dark:text-zinc-400">
                <th className="py-3 px-5 text-left font-medium">Intelligence Capability</th>
                <th className="py-3 px-5 text-center font-medium">Free ($0/mo)</th>
                <th className="py-3 px-5 text-center font-medium">Pro ($10/mo)</th>
              </tr>
            </thead>
            <tbody>
              {COMPARISON_ROWS.map((row) => (
                <tr
                  key={row.capability}
                  className="border-b border-zinc-900/5 dark:border-white/5 last:border-0 hover:bg-zinc-900/[0.03] dark:hover:bg-white/[0.03]"
                >
                  <td className="py-3 px-5 font-medium text-zinc-900 dark:text-zinc-100">{row.capability}</td>
                  <td className="py-3 px-5 text-center font-mono text-zinc-600 dark:text-zinc-400">
                    {row.free === "—" ? (
                      <X className="w-3.5 h-3.5 mx-auto text-zinc-400 dark:text-zinc-600" />
                    ) : (
                      row.free
                    )}
                  </td>
                  <td className="py-3 px-5 text-center font-mono font-semibold text-zinc-950 dark:text-white">
                    {row.pro}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.section>
    </div>
  );
}
