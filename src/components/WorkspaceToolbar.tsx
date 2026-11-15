import { REGIONS, TIMEFRAMES } from "../data/econoscopeData";
import type {
  EconomicAlert,
  RegionKey,
  ThemeMode,
  TickerQuote,
  TimeframeKey,
} from "../types/econoscope";
import { Bot, Globe, MapPin, Moon, RotateCcw, Sun, Zap } from "lucide-react";

interface WorkspaceToolbarProps {
  theme: ThemeMode;
  region: RegionKey;
  timeframe: TimeframeKey;
  shockLevel: number;
  alerts: EconomicAlert[];
  tickers: TickerQuote[];
  signalRate: number;
  utcClock: string;
  onToggleTheme: () => void;
  onSelectRegion: (r: RegionKey) => void;
  onSelectTimeframe: (tf: TimeframeKey) => void;
  onToggleShock: () => void;
  onOpenEco: () => void;
}

export function WorkspaceToolbar({
  theme,
  region,
  timeframe,
  shockLevel,
  alerts,
  tickers,
  signalRate,
  utcClock,
  onToggleTheme,
  onSelectRegion,
  onSelectTimeframe,
  onToggleShock,
  onOpenEco,
}: WorkspaceToolbarProps) {
  return (
    <div className="space-y-3">
      {/* Live Market Commodity Strip */}
      <div className="ticker-wrap overflow-hidden border-b border-zinc-900/10 dark:border-white/10 bg-zinc-200/70 dark:bg-zinc-950/75 py-1.5">
        <div className="ticker-track whitespace-nowrap">
          {[...tickers, ...tickers].map((t, idx) => (
            <span
              key={`${t.name}-${idx}`}
              className="inline-flex items-center gap-2 border-r border-zinc-900/10 dark:border-white/10 px-4 text-[11px]"
            >
              <span className="font-semibold text-zinc-500 dark:text-zinc-400">{t.name}</span>
              <span className="font-mono text-zinc-900 dark:text-zinc-100 tabular-nums">
                {t.value.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </span>
              <span
                className={`font-mono tabular-nums ${
                  t.deltaPct >= 0
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-red-600 dark:text-red-400"
                }`}
              >
                {t.deltaPct >= 0 ? "▲" : "▼"} {Math.abs(t.deltaPct).toFixed(2)}%
              </span>
            </span>
          ))}
        </div>
      </div>

      {/* Control Strip */}
      <div className="mx-auto flex max-w-[1480px] flex-wrap items-center justify-between gap-3 px-4 sm:px-6">
        {/* Region Filter Buttons */}
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Location analysis">
          {(Object.keys(REGIONS) as RegionKey[]).map((key) => {
            const r = REGIONS[key];
            const active = region === key;
            const count = alerts.filter((a) => a.regions.includes(key)).length;
            return (
              <button
                key={key}
                type="button"
                onClick={() => onSelectRegion(key)}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                  active
                    ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 shadow-sm"
                    : "liquid-glass-subtle text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white"
                }`}
              >
                {key === "global" ? <Globe className="w-3.5 h-3.5" /> : <MapPin className="w-3.5 h-3.5" />}
                <span>{r.name}</span>
                <span
                  className={`font-mono text-[10px] tabular-nums ${
                    active ? "opacity-80" : "text-zinc-500 dark:text-zinc-400"
                  }`}
                >
                  · {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Right Controls: Theme Toggle, Timeframe, Ask ECO, Shock Simulation */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="hidden xl:flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400 font-mono tabular-nums mr-1">
            <span>{signalRate.toLocaleString()} signals/min</span>
            <span aria-hidden="true">·</span>
            <span>{utcClock}</span>
          </div>

          <button
            type="button"
            onClick={onToggleTheme}
            aria-label={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
            className="liquid-glass-subtle inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-zinc-800 dark:text-zinc-200 hover:text-zinc-950 dark:hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {theme === "dark" ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
            <span>{theme === "dark" ? "Light" : "Dark"}</span>
          </button>

          <div
            className="inline-flex items-center rounded-lg border border-zinc-900/15 dark:border-white/15 bg-white/60 dark:bg-zinc-950/60 p-0.5"
            role="group"
            aria-label="Timeframe"
          >
            {(Object.keys(TIMEFRAMES) as TimeframeKey[]).map((tf) => {
              const active = timeframe === tf;
              return (
                <button
                  key={tf}
                  type="button"
                  onClick={() => onSelectTimeframe(tf)}
                  className={`rounded-md px-2.5 py-1 font-mono text-[11px] font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    active
                      ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-950"
                      : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white"
                  }`}
                >
                  {tf}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={onOpenEco}
            className="liquid-glass-subtle inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold text-zinc-900 dark:text-zinc-100 hover:border-zinc-900/35 dark:hover:border-white/35 transition-all whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Bot className="w-3.5 h-3.5" />
            <span>Ask ECO</span>
          </button>

          <button
            type="button"
            onClick={onToggleShock}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all whitespace-nowrap shrink-0 cursor-pointer ${
              shockLevel > 0
                ? "bg-red-600 text-white border border-red-500 shadow-[0_0_20px_-4px_rgba(239,68,68,0.55)] hover:bg-red-500"
                : "border border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-200 hover:bg-red-500/20"
            }`}
          >
            {shockLevel >= 4 ? (
              <>
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset Shock</span>
              </>
            ) : (
              <>
                <Zap className="w-3.5 h-3.5" />
                <span>{shockLevel > 0 ? `Cascade ${shockLevel}/4...` : "Simulate Crisis Shock"}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
