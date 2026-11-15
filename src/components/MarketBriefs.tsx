import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  Activity,
  Bot,
  ExternalLink,
  Newspaper,
  Pause,
  Play,
  RefreshCw,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import type {
  MarketBriefCategory,
  MarketBriefItem,
  MarketBriefSentiment,
  MarketBriefsResponse,
  RegionKey,
} from "../types/econoscope";

interface MarketBriefsProps {
  region: RegionKey;
  onAskEco: (prompt: string) => void;
}

const CATEGORIES: Array<"All" | MarketBriefCategory> = [
  "All",
  "Inflation",
  "Central Banks",
  "Commodities",
  "Supply Chain",
  "FX & Sovereign",
];

function sentimentBadgeClass(sentiment: MarketBriefSentiment): string {
  if (sentiment === "BEARISH") {
    return "border-red-500/35 bg-red-500/12 text-red-700 dark:text-red-300";
  }
  if (sentiment === "BULLISH") {
    return "border-emerald-500/35 bg-emerald-500/12 text-emerald-700 dark:text-emerald-300";
  }
  if (sentiment === "VOLATILE") {
    return "border-amber-500/35 bg-amber-500/12 text-amber-700 dark:text-amber-300";
  }
  return "border-zinc-900/15 dark:border-white/15 bg-zinc-200/70 dark:bg-zinc-800/80 text-zinc-700 dark:text-zinc-300";
}

function sentimentDotClass(sentiment: MarketBriefSentiment): string {
  if (sentiment === "BEARISH") return "bg-red-500";
  if (sentiment === "BULLISH") return "bg-emerald-500";
  if (sentiment === "VOLATILE") return "bg-amber-400";
  return "bg-zinc-400";
}

function regimeBadgeClass(label: MarketBriefsResponse["sentimentLabel"]): string {
  if (label === "RISK-OFF") return "text-red-600 dark:text-red-300 border-red-500/35 bg-red-500/10";
  if (label === "CAUTIOUS") return "text-amber-700 dark:text-amber-300 border-amber-500/35 bg-amber-500/10";
  if (label === "RISK-ON") return "text-emerald-700 dark:text-emerald-300 border-emerald-500/35 bg-emerald-500/10";
  return "text-zinc-800 dark:text-zinc-200 border-zinc-900/20 dark:border-white/20 bg-zinc-200/70 dark:bg-zinc-800/70";
}

function formatAge(minutes: number): string {
  if (minutes < 60) return `${minutes}m ago`;
  const hrs = Math.floor(minutes / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function MarketBriefs({ region, onAskEco }: MarketBriefsProps) {
  const [data, setData] = useState<MarketBriefsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [rolling, setRolling] = useState(true);
  const [spotlightIdx, setSpotlightIdx] = useState(0);
  const [sentimentFilter, setSentimentFilter] = useState<"ALL" | MarketBriefSentiment>("ALL");
  const [categoryFilter, setCategoryFilter] = useState<"All" | MarketBriefCategory>("All");

  const fetchBriefs = useCallback(async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      const resp = await fetch("/api/news/briefs");
      if (!resp.ok) throw new Error("Unable to fetch briefs");
      const json = (await resp.json()) as MarketBriefsResponse;
      setData(json);
    } catch {
      // keep existing items if transient network failure occurs
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void fetchBriefs(false);
    const poll = window.setInterval(() => {
      void fetchBriefs(false);
    }, 90000);
    return () => window.clearInterval(poll);
  }, [fetchBriefs]);

  const filteredItems = useMemo(() => {
    const items = data?.items ?? [];
    return items.filter((item) => {
      const sentOk = sentimentFilter === "ALL" || item.sentiment === sentimentFilter;
      const catOk = categoryFilter === "All" || item.category === categoryFilter;
      const regOk = region === "global" || item.region === "global" || item.region === region;
      return sentOk && catOk && regOk;
    });
  }, [categoryFilter, data?.items, region, sentimentFilter]);

  // Fallback to all items if regional filter leaves < 3 items
  const displayItems = useMemo(() => {
    if (filteredItems.length > 0) return filteredItems;
    const items = data?.items ?? [];
    return items.filter((item) => {
      const sentOk = sentimentFilter === "ALL" || item.sentiment === sentimentFilter;
      const catOk = categoryFilter === "All" || item.category === categoryFilter;
      return sentOk && catOk;
    });
  }, [categoryFilter, data?.items, filteredItems, sentimentFilter]);

  useEffect(() => {
    if (!rolling || displayItems.length <= 1) return;
    const timer = window.setInterval(() => {
      setSpotlightIdx((idx) => (idx + 1) % displayItems.length);
    }, 4500);
    return () => window.clearInterval(timer);
  }, [displayItems.length, rolling]);

  const safeSpotlight: MarketBriefItem | null =
    displayItems.length > 0 ? displayItems[spotlightIdx % displayItems.length] : null;

  const totalBreakdown =
    (data?.breakdown.bearish ?? 0) + (data?.breakdown.neutral ?? 0) + (data?.breakdown.bullish ?? 0) || 1;
  const bearishPct = Math.round(((data?.breakdown.bearish ?? 0) / totalBreakdown) * 100);
  const neutralPct = Math.round(((data?.breakdown.neutral ?? 0) / totalBreakdown) * 100);
  const bullishPct = Math.max(0, 100 - bearishPct - neutralPct);

  return (
    <section
      className="liquid-glass rounded-xl overflow-hidden"
      aria-label="Market Briefs live news and sentiment feed"
    >
      {/* Header + Instant Market Sentiment Telemetry */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-zinc-900/10 dark:border-white/10 px-4 py-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 shrink-0">
            <Newspaper className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-zinc-950 dark:text-white">
                Market Briefs — Live Economic Wire
              </h2>
              <span className="inline-flex items-center gap-1 rounded-md border border-emerald-500/35 bg-emerald-500/12 px-1.5 py-0.5 font-mono text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>{data && data.liveCount > 0 ? `${data.liveCount} LIVE` : "WIRE"}</span>
              </span>
            </div>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
              Rolling headlines from Reuters, Bloomberg, CNBC, Forbes, MarketWatch &amp; GDELT Macro Desk
            </p>
          </div>
        </div>

        {/* Instant Sentiment Meter + Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          {data && (
            <div className="flex items-center gap-2.5 rounded-xl border border-zinc-900/10 dark:border-white/10 bg-white/60 dark:bg-zinc-950/60 px-3 py-1.5">
              <div className="text-[10px] uppercase tracking-wider text-zinc-500 dark:text-zinc-400 font-semibold">
                Sentiment
              </div>
              <span
                className={`rounded-md border px-2 py-0.5 font-mono text-[10px] font-bold ${regimeBadgeClass(
                  data.sentimentLabel
                )}`}
              >
                {data.sentimentLabel} ({data.sentimentIndex > 0 ? `+${data.sentimentIndex}` : data.sentimentIndex})
              </span>
              <div
                className="hidden sm:flex w-24 h-1.5 rounded-full overflow-hidden bg-zinc-200 dark:bg-zinc-800"
                title={`Bearish ${bearishPct}% · Neutral ${neutralPct}% · Bullish ${bullishPct}%`}
              >
                <div className="bg-red-500" style={{ width: `${bearishPct}%` }} />
                <div className="bg-zinc-400 dark:bg-zinc-500" style={{ width: `${neutralPct}%` }} />
                <div className="bg-emerald-500" style={{ width: `${bullishPct}%` }} />
              </div>
              <span className="hidden md:inline font-mono text-[10px] text-zinc-500 dark:text-zinc-400 tabular-nums">
                {data.breakdown.bearish}B / {data.breakdown.neutral}N / {data.breakdown.bullish}P
              </span>
            </div>
          )}

          <button
            type="button"
            onClick={() => setRolling((v) => !v)}
            className="inline-flex items-center gap-1 rounded-lg border border-zinc-900/15 dark:border-white/15 bg-white/65 dark:bg-zinc-900/70 px-2.5 py-1.5 text-[11px] font-medium text-zinc-800 dark:text-zinc-200 hover:text-zinc-950 dark:hover:text-white cursor-pointer"
          >
            {rolling ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
            <span>{rolling ? "Pause Roll" : "Resume Roll"}</span>
          </button>

          <button
            type="button"
            onClick={() => void fetchBriefs(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-1 rounded-lg border border-zinc-900/15 dark:border-white/15 bg-white/65 dark:bg-zinc-900/70 px-2.5 py-1.5 text-[11px] font-medium text-zinc-800 dark:text-zinc-200 hover:text-zinc-950 dark:hover:text-white cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3 h-3 ${refreshing ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Rolling Spotlight Headline Bar */}
      <div className="border-b border-zinc-900/10 dark:border-white/10 bg-zinc-900/[0.03] dark:bg-white/[0.03] px-4 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <span className="rounded bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 px-1.5 py-0.5 font-mono text-[10px] font-bold shrink-0">
            ROLLING BRIEF
          </span>
          {loading ? (
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              Streaming live global market briefs...
            </span>
          ) : safeSpotlight ? (
            <AnimatePresence mode="wait">
              <motion.div
                key={safeSpotlight.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.2 }}
                className="flex items-center gap-2 min-w-0"
              >
                <span className={`h-2 w-2 rounded-full shrink-0 ${sentimentDotClass(safeSpotlight.sentiment)}`} />
                <a
                  href={safeSpotlight.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs font-semibold text-zinc-950 dark:text-white hover:underline truncate"
                >
                  {safeSpotlight.title}
                </a>
                <span className="hidden md:inline font-mono text-[10px] text-zinc-500 dark:text-zinc-400 shrink-0">
                  [{safeSpotlight.source} · {formatAge(safeSpotlight.minutesAgo)}]
                </span>
              </motion.div>
            </AnimatePresence>
          ) : (
            <span className="text-xs text-zinc-500 dark:text-zinc-400">No headlines match filter.</span>
          )}
        </div>

        {safeSpotlight && (
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() =>
                onAskEco(
                  `Analyze the market, inflation, and supply-chain implications of this live headline: "${safeSpotlight.title}" (Source: ${safeSpotlight.source}, Sentiment: ${safeSpotlight.sentiment}).`
                )
              }
              className="inline-flex items-center gap-1 rounded-md bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 px-2.5 py-1 text-[10px] font-semibold hover:opacity-90 cursor-pointer"
            >
              <Bot className="w-3 h-3" />
              <span>Analyze with ECO</span>
            </button>
          </div>
        )}
      </div>

      {/* Category & Sentiment Filter Row */}
      <div className="px-4 py-2.5 border-b border-zinc-900/10 dark:border-white/10 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => {
                setCategoryFilter(cat);
                setSpotlightIdx(0);
              }}
              className={`rounded-lg px-2.5 py-1 text-[11px] font-medium transition-colors cursor-pointer whitespace-nowrap ${
                categoryFilter === cat
                  ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-950"
                  : "liquid-glass-subtle text-zinc-600 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1 text-[11px]">
          {(["ALL", "BEARISH", "BULLISH", "NEUTRAL"] as const).map((sent) => (
            <button
              key={sent}
              type="button"
              onClick={() => {
                setSentimentFilter(sent);
                setSpotlightIdx(0);
              }}
              className={`rounded-md px-2 py-1 font-mono text-[10px] font-semibold border transition-colors cursor-pointer ${
                sentimentFilter === sent
                  ? "bg-zinc-900 text-white border-zinc-900 dark:bg-white dark:text-zinc-950 dark:border-white"
                  : "border-zinc-900/15 dark:border-white/15 text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white"
              }`}
            >
              {sent}
            </button>
          ))}
        </div>
      </div>

      {/* Scrollable Multi-Column Analyst Headline Grid */}
      <div className="p-3 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2.5 max-h-[290px] overflow-y-auto">
        {displayItems.map((item, idx) => (
          <div
            key={item.id}
            onMouseEnter={() => setSpotlightIdx(idx)}
            className={`rounded-xl border p-3 flex flex-col justify-between gap-2.5 transition-all ${
              safeSpotlight?.id === item.id
                ? "border-zinc-900/30 dark:border-white/30 bg-white/85 dark:bg-zinc-900/80"
                : "border-zinc-900/10 dark:border-white/10 bg-white/55 dark:bg-zinc-950/45 hover:border-zinc-900/20 dark:hover:border-white/20"
            }`}
          >
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2 text-[10px] font-mono">
                <span className="font-semibold text-zinc-600 dark:text-zinc-300 truncate">
                  {item.source} · {formatAge(item.minutesAgo)}
                </span>
                <span
                  className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-bold border shrink-0 ${sentimentBadgeClass(
                    item.sentiment
                  )}`}
                >
                  {item.sentiment === "BEARISH" ? (
                    <TrendingDown className="w-2.5 h-2.5" />
                  ) : item.sentiment === "BULLISH" ? (
                    <TrendingUp className="w-2.5 h-2.5" />
                  ) : (
                    <Activity className="w-2.5 h-2.5" />
                  )}
                  <span>{item.sentiment}</span>
                </span>
              </div>

              <a
                href={item.url}
                target="_blank"
                rel="noreferrer"
                className="block text-xs font-semibold text-zinc-950 dark:text-white leading-snug hover:underline line-clamp-2"
              >
                {item.title}
              </a>
            </div>

            <div className="flex items-center justify-between gap-2 pt-1 border-t border-zinc-900/5 dark:border-white/5 text-[10px]">
              <span className="font-mono text-zinc-500 dark:text-zinc-400">
                {item.category} {item.isLive ? "· LIVE" : ""}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    onAskEco(
                      `Give an analyst breakdown of this market brief: "${item.title}" (${item.source}, ${item.category}, ${item.sentiment}). Which countries and commodities are most exposed?`
                    )
                  }
                  className="inline-flex items-center gap-1 font-semibold text-zinc-900 dark:text-zinc-100 hover:underline cursor-pointer"
                >
                  <Bot className="w-3 h-3" />
                  <span>Ask ECO</span>
                </button>
                <a
                  href={item.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-0.5 text-zinc-500 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white"
                  title="Open source headline"
                >
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
