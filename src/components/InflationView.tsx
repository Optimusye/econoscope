import { useMemo, useState } from "react";
import {
  Flame,
  Info,
  Scale,
  Ship,
  ShoppingBasket,
  Sliders,
  Sprout,
  Store,
  TrendingUp,
  Wheat,
} from "lucide-react";
import {
  BASKETS,
  LOCAL_MARKET_QUOTES,
  REGIONS,
  generateOfficialStepSeries,
  generateSeries,
  getLabelsForTimeframe,
} from "../data/econoscopeData";
import type { BasketItem, RegionKey, ThemeMode, TimeframeKey } from "../types/econoscope";
import { InflationLineChart } from "./Charts";

interface InflationViewProps {
  theme: ThemeMode;
  region: RegionKey;
  timeframe: TimeframeKey;
  shockLevel: number;
}

function BasketIcon({ id }: { id: BasketItem["id"] }) {
  if (id === "energy") return <Flame className="w-4 h-4 text-amber-500" />;
  if (id === "grains") return <Wheat className="w-4 h-4 text-zinc-900 dark:text-zinc-100" />;
  if (id === "fert") return <Sprout className="w-4 h-4 text-emerald-500" />;
  if (id === "freight") return <Ship className="w-4 h-4 text-zinc-700 dark:text-zinc-300" />;
  return <ShoppingBasket className="w-4 h-4 text-zinc-800 dark:text-zinc-200" />;
}

export function InflationView({ theme, region, timeframe, shockLevel }: InflationViewProps) {
  const [selectedId, setSelectedId] = useState<BasketItem["id"]>("energy");
  const [weights, setWeights] = useState<Record<BasketItem["id"], number>>({
    energy: 24,
    grains: 21,
    fert: 12,
    freight: 17,
    staples: 26,
  });

  const regFactor = Math.max(0.5, Math.min(3.6, REGIONS[region].realTimeInflation / 6.8));

  const scaledBaskets = useMemo(
    () =>
      BASKETS.map((b) => ({
        ...b,
        scaledRt: b.realTime * Math.pow(regFactor, 0.8) + shockLevel * 0.6,
        scaledOff: b.official * Math.pow(regFactor, 0.45),
      })),
    [regFactor, shockLevel]
  );

  const customComposite = useMemo(() => {
    const totalW = Object.values(weights).reduce((s, v) => s + v, 0) || 1;
    let rtSum = 0;
    let offSum = 0;
    for (const b of scaledBaskets) {
      const share = (weights[b.id] ?? b.weight) / totalW;
      rtSum += b.scaledRt * share;
      offSum += b.scaledOff * share;
    }
    return {
      rt: rtSum,
      off: offSum,
      gap: rtSum - offSum,
      totalW,
    };
  }, [scaledBaskets, weights]);

  const maxRt = Math.max(...scaledBaskets.map((b) => b.scaledRt));
  const selectedBasket = scaledBaskets.find((b) => b.id === selectedId) ?? scaledBaskets[0];

  const labels = useMemo(() => getLabelsForTimeframe(timeframe), [timeframe]);
  const rtSeries = useMemo(
    () =>
      generateSeries(
        `b-${selectedBasket.id}-${region}`,
        timeframe,
        selectedBasket.scaledOff * 0.8,
        selectedBasket.scaledRt - shockLevel * 0.6,
        selectedBasket.scaledRt * 0.05,
        shockLevel ? shockLevel * selectedBasket.scaledRt * 0.06 : 0
      ),
    [region, selectedBasket.id, selectedBasket.scaledOff, selectedBasket.scaledRt, shockLevel, timeframe]
  );
  const offSeries = useMemo(
    () => generateOfficialStepSeries(timeframe, selectedBasket.scaledOff * 0.8, selectedBasket.scaledOff),
    [selectedBasket.scaledOff, timeframe]
  );

  const localMarkets = useMemo(
    () => LOCAL_MARKET_QUOTES.filter((q) => region === "global" || q.region === region),
    [region]
  );

  return (
    <div className="space-y-4">
      {/* 5 Basket Cards */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        {scaledBaskets.map((b) => {
          const active = b.id === selectedBasket.id;
          return (
            <button
              key={b.id}
              type="button"
              onClick={() => setSelectedId(b.id)}
              aria-pressed={active}
              className={`text-left rounded-xl p-4 transition-all cursor-pointer space-y-2.5 ${
                active
                  ? "liquid-glass-elevated ring-2 ring-zinc-900 dark:ring-white"
                  : "liquid-glass hover:border-zinc-900/25 dark:hover:border-white/25"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-2 text-sm font-semibold text-zinc-950 dark:text-white">
                  <BasketIcon id={b.id} />
                  <span>{b.name}</span>
                </span>
                <span className="font-mono text-[11px] text-zinc-500 dark:text-zinc-400 tabular-nums">
                  w {b.weight}%
                </span>
              </div>

              <div className="flex items-baseline gap-3">
                <span className="font-mono text-2xl font-bold text-zinc-950 dark:text-white tabular-nums">
                  {b.scaledRt.toFixed(1)}%
                </span>
                <span className="font-mono text-xs font-semibold text-emerald-600 dark:text-emerald-300 tabular-nums">
                  +{(b.scaledRt - b.scaledOff).toFixed(1)} pts
                </span>
              </div>

              <div className="space-y-1.5">
                <div className="h-1.5 rounded-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-zinc-900 dark:bg-white"
                    style={{ width: `${(b.scaledRt / maxRt) * 100}%` }}
                  />
                </div>
                <div className="h-1.5 rounded-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-emerald-500 dark:bg-emerald-400"
                    style={{ width: `${(b.scaledOff / maxRt) * 100}%` }}
                  />
                </div>
              </div>

              <div className="text-xs text-zinc-500 dark:text-zinc-400 font-mono tabular-nums">
                Official {b.scaledOff.toFixed(1)}% (lagging)
              </div>
            </button>
          );
        })}
      </section>

      {/* Chart + Components Split */}
      <section className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-4 items-start">
        <div className="liquid-glass rounded-xl overflow-hidden">
          <div className="flex items-center justify-between border-b border-zinc-900/10 dark:border-white/10 px-4 py-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-zinc-900 dark:text-zinc-100" />
              <h2 className="text-sm font-semibold text-zinc-950 dark:text-white">
                {selectedBasket.name} Basket: Real-Time vs Official CPI
              </h2>
            </div>
            <span className="font-mono text-xs text-zinc-600 dark:text-zinc-300">Window {timeframe}</span>
          </div>
          <InflationLineChart
            theme={theme}
            labels={labels}
            realTimeSeries={rtSeries}
            officialSeries={offSeries}
            realTimeLabel={`${selectedBasket.name} real-time index`}
          />
        </div>

        <div className="liquid-glass rounded-xl overflow-hidden">
          <div className="flex items-center justify-between border-b border-zinc-900/10 dark:border-white/10 px-4 py-3">
            <h2 className="text-sm font-semibold text-zinc-950 dark:text-white">
              {selectedBasket.name} Underlying Components
            </h2>
            <span className="text-xs text-zinc-500 dark:text-zinc-400">Spot telemetry</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-zinc-900/10 dark:border-white/10 text-zinc-500 dark:text-zinc-400">
                  <th className="py-2.5 px-4 text-left font-medium">Component</th>
                  <th className="py-2.5 px-4 text-right font-medium">Level</th>
                  <th className="py-2.5 px-4 text-right font-medium">30D Change</th>
                </tr>
              </thead>
              <tbody>
                {selectedBasket.components.map(([name, level, chg]) => {
                  const adj = chg * Math.sqrt(Math.min(1.6, REGIONS[region].realTimeInflation / 6.8));
                  return (
                    <tr
                      key={name}
                      className="border-b border-zinc-900/5 dark:border-white/5 last:border-0 hover:bg-zinc-900/[0.03] dark:hover:bg-white/[0.04]"
                    >
                      <td className="py-3 px-4 text-zinc-950 dark:text-zinc-100 font-medium">{name}</td>
                      <td className="py-3 px-4 text-right font-mono text-zinc-700 dark:text-zinc-200 tabular-nums">
                        {level}
                      </td>
                      <td
                        className={`py-3 px-4 text-right font-mono font-semibold tabular-nums ${
                          chg > 5 ? "text-red-600 dark:text-red-300" : "text-emerald-600 dark:text-emerald-300"
                        }`}
                      >
                        +{adj.toFixed(1)}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex items-start gap-2.5 border-t border-zinc-900/10 dark:border-white/10 px-4 py-3 text-xs text-zinc-600 dark:text-zinc-300">
            <Info className="w-4 h-4 text-zinc-800 dark:text-zinc-200 shrink-0 mt-0.5" />
            <span>
              High-frequency market quotes update weekly, while official CPI baskets refresh monthly with a 4–6 week
              publication lag—causing {selectedBasket.name.toLowerCase()} inflation to surface here weeks earlier.
            </span>
          </div>
        </div>
      </section>

      {/* Custom Basket Weight Simulator + Sub-National Physical Market Quotes */}
      <section className="grid grid-cols-1 lg:grid-cols-[1fr_1.15fr] gap-4 items-stretch">
        <div className="liquid-glass rounded-xl p-4 space-y-3.5">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-900/10 dark:border-white/10 pb-3">
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-zinc-900 dark:text-zinc-100" />
              <div>
                <h2 className="text-sm font-semibold text-zinc-950 dark:text-white">
                  Custom Basket Exposure Calculator
                </h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Tune weights for your household or corporate procurement mix
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setWeights({ energy: 15, grains: 38, fert: 22, freight: 10, staples: 15 })}
              className="rounded-md border border-zinc-900/20 dark:border-white/20 bg-white/70 dark:bg-white/10 px-2.5 py-1 text-[11px] font-medium text-zinc-900 dark:text-white hover:opacity-85 cursor-pointer"
            >
              Agri-Heavy Mix
            </button>
          </div>

          <div className="space-y-2.5">
            {scaledBaskets.map((b) => {
              const share = Math.round(((weights[b.id] ?? 0) / customComposite.totalW) * 100);
              return (
                <div key={b.id} className="flex items-center gap-3 text-xs">
                  <span className="w-32 font-medium text-zinc-800 dark:text-zinc-200 truncate">{b.name}</span>
                  <input
                    type="range"
                    min={0}
                    max={60}
                    value={weights[b.id]}
                    onChange={(e) =>
                      setWeights((prev) => ({ ...prev, [b.id]: Number(e.target.value) }))
                    }
                    className="flex-1 accent-zinc-900 dark:accent-white cursor-pointer"
                  />
                  <span className="w-12 text-right font-mono text-zinc-900 dark:text-zinc-100 tabular-nums">
                    {share}%
                  </span>
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-3 gap-2.5 pt-2">
            <div className="rounded-lg border border-zinc-900/10 dark:border-white/15 bg-white/60 dark:bg-zinc-950/55 p-3">
              <div className="text-[11px] text-zinc-500 dark:text-zinc-400">Custom Real-Time</div>
              <div className="mt-1 font-mono text-lg font-bold text-zinc-950 dark:text-white tabular-nums">
                {customComposite.rt.toFixed(1)}%
              </div>
            </div>
            <div className="rounded-lg border border-zinc-900/10 dark:border-white/15 bg-white/60 dark:bg-zinc-950/55 p-3">
              <div className="text-[11px] text-zinc-500 dark:text-zinc-400">Official Print</div>
              <div className="mt-1 font-mono text-lg font-bold text-emerald-600 dark:text-emerald-300 tabular-nums">
                {customComposite.off.toFixed(1)}%
              </div>
            </div>
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3">
              <div className="text-[11px] text-red-700 dark:text-red-200">Personal Blind Spot</div>
              <div className="mt-1 font-mono text-lg font-bold text-red-600 dark:text-red-300 tabular-nums">
                +{customComposite.gap.toFixed(1)} pts
              </div>
            </div>
          </div>
        </div>

        {/* Sub-National Physical Market Quotes */}
        <div className="liquid-glass rounded-xl overflow-hidden">
          <div className="flex items-center justify-between border-b border-zinc-900/10 dark:border-white/10 px-4 py-3">
            <div className="flex items-center gap-2">
              <Store className="w-4 h-4 text-zinc-900 dark:text-zinc-100" />
              <h2 className="text-sm font-semibold text-zinc-950 dark:text-white">
                Sub-National Wholesale Market Monitor ({localMarkets.length} hubs)
              </h2>
            </div>
            <span className="text-xs text-zinc-500 dark:text-zinc-400">FAO FPMA ground prices</span>
          </div>
          <div className="overflow-x-auto max-h-[320px] overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-zinc-200/95 dark:bg-zinc-900/95">
                <tr className="border-b border-zinc-900/10 dark:border-white/10 text-zinc-600 dark:text-zinc-400">
                  <th className="py-2.5 px-4 text-left font-medium">Wholesale Market</th>
                  <th className="py-2.5 px-4 text-left font-medium">City</th>
                  <th className="py-2.5 px-4 text-left font-medium">Monitored Staple</th>
                  <th className="py-2.5 px-4 text-right font-medium">Spot Quote</th>
                  <th className="py-2.5 px-4 text-right font-medium">14D Move</th>
                </tr>
              </thead>
              <tbody>
                {localMarkets.map((q) => {
                  const adjMove = q.change14dPct + shockLevel * 1.4;
                  return (
                    <tr
                      key={q.market}
                      className="border-b border-zinc-900/5 dark:border-white/5 last:border-0 hover:bg-zinc-900/[0.03] dark:hover:bg-white/[0.04]"
                    >
                      <td className="py-2.5 px-4 font-semibold text-zinc-950 dark:text-white whitespace-nowrap">
                        {q.market}
                      </td>
                      <td className="py-2.5 px-4 text-zinc-600 dark:text-zinc-300 whitespace-nowrap">
                        {q.city}, {q.country}
                      </td>
                      <td className="py-2.5 px-4 text-zinc-700 dark:text-zinc-300">{q.staple}</td>
                      <td className="py-2.5 px-4 text-right font-mono text-zinc-900 dark:text-zinc-100 tabular-nums whitespace-nowrap">
                        {q.localPrice}
                      </td>
                      <td
                        className={`py-2.5 px-4 text-right font-mono font-semibold tabular-nums ${
                          adjMove >= 15 ? "text-red-600 dark:text-red-300" : "text-amber-600 dark:text-amber-300"
                        }`}
                      >
                        +{adjMove.toFixed(1)}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* All Baskets Comparison Matrix */}
      <section className="liquid-glass rounded-xl overflow-hidden">
        <div className="flex items-center gap-2 border-b border-zinc-900/10 dark:border-white/10 px-4 py-3">
          <Scale className="w-4 h-4 text-zinc-900 dark:text-zinc-100" />
          <h2 className="text-sm font-semibold text-zinc-950 dark:text-white">
            Real-Time Index vs Official CPI Lead Matrix
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-zinc-900/10 dark:border-white/10 text-zinc-500 dark:text-zinc-400">
                <th className="py-2.5 px-4 text-left font-medium">Basket</th>
                <th className="py-2.5 px-4 text-right font-medium">Real-Time Index</th>
                <th className="py-2.5 px-4 text-right font-medium">Official Print</th>
                <th className="py-2.5 px-4 text-right font-medium">Divergence Gap</th>
                <th className="py-2.5 px-4 text-right font-medium">Detection Lead</th>
              </tr>
            </thead>
            <tbody>
              {scaledBaskets.map((b) => {
                const gap = b.scaledRt - b.scaledOff;
                const leadDays = Math.round(8 + gap * 1.1);
                return (
                  <tr
                    key={b.id}
                    className="border-b border-zinc-900/5 dark:border-white/5 last:border-0 hover:bg-zinc-900/[0.03] dark:hover:bg-white/[0.04]"
                  >
                    <td className="py-3 px-4 font-semibold text-zinc-950 dark:text-white">{b.name}</td>
                    <td className="py-3 px-4 text-right font-mono text-zinc-950 dark:text-white tabular-nums">
                      {b.scaledRt.toFixed(1)}%
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-emerald-600 dark:text-emerald-300 tabular-nums">
                      {b.scaledOff.toFixed(1)}%
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-semibold text-red-600 dark:text-red-300 tabular-nums">
                      +{gap.toFixed(1)} pts
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-zinc-600 dark:text-zinc-300 tabular-nums">
                      {leadDays} days ahead
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
