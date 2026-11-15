import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import {
  Bot,
  Crown,
  ExternalLink,
  Globe2,
  Send,
  ShieldCheck,
  Sparkles,
  Trash2,
  Zap,
} from "lucide-react";
import { REGIONS } from "../data/econoscopeData";
import type {
  EcoMessage,
  PlanTier,
  RegionKey,
  TabView,
  TimeframeKey,
} from "../types/econoscope";

interface EcoAiViewProps {
  region: RegionKey;
  timeframe: TimeframeKey;
  shockLevel: number;
  telemetrySummary: string;
  planTier: PlanTier;
  queriesUsed: number;
  freeQueryLimit: number;
  messages: EcoMessage[];
  seedQuery: string | null;
  onConsumeSeedQuery: () => void;
  onAppendMessage: (msg: EcoMessage) => void;
  onClearMessages: () => void;
  onIncrementQueryCount: () => void;
  onNavigateView: (view: TabView) => void;
}

const PRESET_PROMPTS = [
  "Compare food inflation and FX spread risk across Ethiopia, Egypt, and Nigeria.",
  "Why is the Red Sea & Suez corridor driving grain and urea CPI surprises?",
  "Which 5 countries across all 6 continents face the highest imminent shortage risk?",
  "How does EconoScope detect inflation 18 days ahead of official World Bank CPI prints?",
  "Analyze South American Parana river draft vs Panama Canal slot cut impacts on soy & corn.",
  "What hedging & reserve-release moves should an East African importer execute this week?",
];

export function EcoAiView({
  region,
  timeframe,
  shockLevel,
  telemetrySummary,
  planTier,
  queriesUsed,
  freeQueryLimit,
  messages,
  seedQuery,
  onConsumeSeedQuery,
  onAppendMessage,
  onClearMessages,
  onIncrementQueryCount,
  onNavigateView,
}: EcoAiViewProps) {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const isQuotaReached = planTier === "free" && queriesUsed >= freeQueryLimit;
  const remainingFree = Math.max(0, freeQueryLimit - queriesUsed);

  const sendQuery = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || loading) return;

      if (planTier === "free" && queriesUsed >= freeQueryLimit) {
        onAppendMessage({
          id: `eco-limit-${Date.now()}`,
          role: "eco",
          text: `Free tier daily limit reached (${freeQueryLimit}/${freeQueryLimit} ECO prompts). Switch to EconoScope Pro ($10/mo) on the Pricing tab for unlimited web-grounded ECO analysis.`,
          error: true,
        });
        return;
      }

      onAppendMessage({
        id: `u-${Date.now()}`,
        role: "user",
        text: trimmed,
      });
      setInput("");
      setLoading(true);

      try {
        const resp = await fetch("/api/ai/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: trimmed,
            region,
            timeframe,
            shockLevel,
            telemetrySummary,
          }),
        });

        const data = (await resp.json()) as {
          answer?: string;
          citations?: Array<{ title: string; uri: string }>;
          error?: string;
        };

        if (!resp.ok || data.error) {
          throw new Error(data.error || `Request failed (${resp.status})`);
        }

        onIncrementQueryCount();
        onAppendMessage({
          id: `eco-${Date.now()}`,
          role: "eco",
          text: data.answer ?? "No analysis returned.",
          citations: data.citations ?? [],
        });
      } catch (err) {
        onAppendMessage({
          id: `err-${Date.now()}`,
          role: "eco",
          text: err instanceof Error ? err.message : "Unable to reach ECO intelligence engine.",
          error: true,
        });
      } finally {
        setLoading(false);
      }
    },
    [
      freeQueryLimit,
      loading,
      onAppendMessage,
      onIncrementQueryCount,
      planTier,
      queriesUsed,
      region,
      shockLevel,
      telemetrySummary,
      timeframe,
    ]
  );

  useEffect(() => {
    if (seedQuery) {
      const q = seedQuery;
      onConsumeSeedQuery();
      void sendQuery(q);
    }
  }, [onConsumeSeedQuery, seedQuery, sendQuery]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void sendQuery(input);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-4 items-stretch">
      {/* Left Sidebar: ECO Context & Prompt Library */}
      <motion.aside
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="liquid-glass rounded-2xl p-4 flex flex-col justify-between gap-4"
      >
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-3 border-b border-zinc-900/10 dark:border-white/10 pb-3.5">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 shadow-sm">
                <Bot className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-base font-bold text-zinc-950 dark:text-white tracking-tight">ECO</h1>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                  EconoScope Macro Intelligence AI
                </p>
              </div>
            </div>

            <span
              className={`rounded-md px-2 py-0.5 font-mono text-[10px] font-bold border ${
                planTier === "pro"
                  ? "bg-zinc-900 text-white border-zinc-900 dark:bg-white dark:text-zinc-950 dark:border-white"
                  : "bg-zinc-200/80 text-zinc-800 border-zinc-300 dark:bg-zinc-800 dark:text-zinc-200 dark:border-zinc-700"
              }`}
            >
              {planTier === "pro" ? "PRO" : "FREE"}
            </span>
          </div>

          {/* Active Context Snapshot */}
          <div className="rounded-xl border border-zinc-900/10 dark:border-white/10 bg-white/55 dark:bg-zinc-950/60 p-3 space-y-2 text-xs">
            <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400">
              <span className="inline-flex items-center gap-1.5 font-medium">
                <Globe2 className="w-3.5 h-3.5" />
                <span>Live Telemetry Context</span>
              </span>
              <span className="font-mono text-[11px] text-zinc-900 dark:text-zinc-100 font-semibold">
                {REGIONS[region].name}
              </span>
            </div>
            <div className="flex items-center justify-between font-mono text-[11px] text-zinc-700 dark:text-zinc-300">
              <span>Window {timeframe}</span>
              <span>Shock Lv {shockLevel}/4</span>
              <span>108 Nations</span>
            </div>
          </div>

          {/* Quota / Plan Status — unobstructed for first 5 chats */}
          <div className="rounded-xl border border-zinc-900/10 dark:border-white/10 bg-white/55 dark:bg-zinc-950/60 p-3 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-zinc-700 dark:text-zinc-300">ECO Chat Session</span>
              <span className="font-mono font-bold text-zinc-950 dark:text-white tabular-nums">
                {planTier === "pro" ? "Unlimited" : `${remainingFree}/${freeQueryLimit} free chats`}
              </span>
            </div>
            {planTier === "free" && (
              <>
                <div className="h-1.5 rounded-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-zinc-900 dark:bg-zinc-100 transition-all"
                    style={{ width: `${Math.min(100, (queriesUsed / freeQueryLimit) * 100)}%` }}
                  />
                </div>
                {queriesUsed >= 5 && (
                  <button
                    type="button"
                    onClick={() => onNavigateView("pricing")}
                    className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 px-3 py-1.5 text-[11px] font-semibold hover:opacity-90 transition-opacity cursor-pointer"
                  >
                    <Crown className="w-3.5 h-3.5" />
                    <span>
                      {isQuotaReached
                        ? "Free limit reached — Upgrade to Pro ($10/mo)"
                        : `${remainingFree} chats left — Upgrade to Pro ($10/mo)`}
                    </span>
                  </button>
                )}
              </>
            )}
          </div>

          {/* Preset Questions */}
          <div className="space-y-2">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Instant Intelligence Prompts
            </div>
            <div className="space-y-1.5">
              {PRESET_PROMPTS.map((q) => (
                <button
                  key={q}
                  type="button"
                  disabled={loading}
                  onClick={() => void sendQuery(q)}
                  className="w-full text-left rounded-xl border border-zinc-900/10 dark:border-white/10 bg-white/60 dark:bg-zinc-900/60 px-3 py-2 text-xs text-zinc-800 dark:text-zinc-200 hover:bg-white dark:hover:bg-zinc-800/80 hover:border-zinc-900/25 dark:hover:border-white/25 transition-all cursor-pointer disabled:opacity-50"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="pt-2 border-t border-zinc-900/10 dark:border-white/10 flex items-center justify-between text-[11px] text-zinc-500 dark:text-zinc-400">
          <span className="inline-flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Live Search Grounded</span>
          </span>
          <button
            type="button"
            onClick={onClearMessages}
            className="inline-flex items-center gap-1 text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white cursor-pointer"
          >
            <Trash2 className="w-3 h-3" />
            <span>Clear chat</span>
          </button>
        </div>
      </motion.aside>

      {/* Right Main Workspace: ECO Conversation Terminal */}
      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, delay: 0.05 }}
        className="liquid-glass rounded-2xl flex flex-col overflow-hidden min-h-[580px] max-h-[760px]"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-900/10 dark:border-white/10 px-5 py-3.5">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-zinc-900 dark:text-zinc-100" />
            <h2 className="text-sm font-semibold text-zinc-950 dark:text-white">
              Ask ECO — Global Inflation, Shortages &amp; Supply-Chain Copilot
            </h2>
          </div>
          <span className="font-mono text-[11px] text-zinc-500 dark:text-zinc-400">
            108 Countries · 28 Trade Corridors · Real-Time Web Citations
          </span>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto p-5 space-y-4">
          {messages.map((m) => (
            <motion.div
              key={m.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18 }}
              className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 text-xs leading-relaxed ${
                  m.role === "user"
                    ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 font-medium shadow-md"
                    : m.error
                      ? "border border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-200"
                      : "liquid-glass-subtle text-zinc-900 dark:text-zinc-100"
                }`}
              >
                <div className="flex items-center gap-1.5 mb-1.5 text-[10px] font-mono uppercase tracking-wider opacity-70">
                  {m.role === "eco" ? (
                    <>
                      <Bot className="w-3 h-3" />
                      <span>ECO Intelligence</span>
                    </>
                  ) : (
                    <span>You</span>
                  )}
                </div>

                <div className="whitespace-pre-wrap">{m.text}</div>

                {m.citations && m.citations.length > 0 && (
                  <div className="mt-3 pt-2.5 border-t border-zinc-900/10 dark:border-white/10 space-y-1">
                    <div className="text-[10px] font-mono font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                      Verified Web Sources
                    </div>
                    {m.citations.map((c) => (
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
            </motion.div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="liquid-glass-subtle rounded-2xl px-4 py-3 text-xs text-zinc-600 dark:text-zinc-300 inline-flex items-center gap-2">
                <Zap className="w-3.5 h-3.5 animate-pulse" />
                <span>ECO is analyzing macro feeds and grounding live web data...</span>
              </div>
            </div>
          )}
        </div>

        <form
          onSubmit={handleSubmit}
          className="border-t border-zinc-900/10 dark:border-white/10 p-4 bg-white/40 dark:bg-zinc-950/50 flex flex-col sm:flex-row gap-2.5"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              isQuotaReached
                ? "Free quota used — upgrade to Pro ($10/mo) in Pricing tab for unlimited ECO..."
                : "Ask ECO about any country, commodity, port delay, or inflation trend..."
            }
            disabled={isQuotaReached}
            className="flex-1 rounded-xl border border-zinc-900/15 dark:border-white/15 bg-white/85 dark:bg-zinc-900/80 px-4 py-2.5 text-xs text-zinc-950 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:border-zinc-900 dark:focus:border-white disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={loading || !input.trim() || isQuotaReached}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 hover:opacity-90 disabled:opacity-40 px-5 py-2.5 text-xs font-semibold transition-opacity cursor-pointer whitespace-nowrap shrink-0"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Ask ECO</span>
          </button>
        </form>
      </motion.section>
    </div>
  );
}
