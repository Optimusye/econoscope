import { useMemo, useState } from "react";
import {
  Activity,
  Anchor,
  Bot,
  Compass,
  Flame,
  Globe2,
  Layers,
  MapPin,
  Navigation,
  RotateCw,
  Search,
  Sun,
} from "lucide-react";
import { CHOKEPOINTS, HOTSPOTS, REGIONS, SHOCK_HOTSPOT_MAP, TRADE_ARCS } from "../data/econoscopeData";
import type {
  Continent,
  EconomicAlert,
  HeatmapMode,
  RegionKey,
  RiskHotspot,
  Severity,
  ThemeMode,
} from "../types/econoscope";
import { Globe3DHeatmap } from "./Globe3DHeatmap";

interface Atlas3DViewProps {
  theme: ThemeMode;
  region: RegionKey;
  heatmapMode: HeatmapMode;
  showRiskNodes: boolean;
  showChokepoints: boolean;
  showHeatmap: boolean;
  showTradeArcs: boolean;
  shockLevel: number;
  alerts: EconomicAlert[];
  extraHotspots: RiskHotspot[];
  focusedHotspotId: string | null;
  onChangeHeatmapMode: (mode: HeatmapMode) => void;
  onToggleLayer: (layer: "risk" | "choke" | "heat" | "arcs") => void;
  onFocusHotspot: (hotspotId: string) => void;
  onSelectAlert: (alertId: string) => void;
  onAskEcoForLocation: (hotspot: RiskHotspot) => void;
}

type CategoryFilter = "All" | RiskHotspot["category"];
type SortKey = "risk" | "food" | "delay";

const CATEGORY_OPTIONS: CategoryFilter[] = [
  "All",
  "Chokepoint",
  "Food & Ag",
  "Energy & FX",
  "Trade Hub",
  "Geopolitical",
];

const CONTINENT_OPTIONS: Array<"All" | Continent> = [
  "All",
  "Africa",
  "Europe",
  "Asia",
  "North America",
  "South America",
  "Oceania",
];

function resolveHotspotSeverity(
  hotspot: RiskHotspot,
  shockLevel: number,
  alerts: EconomicAlert[]
): Severity {
  const shocked = Object.entries(SHOCK_HOTSPOT_MAP).some(
    ([sid, hid]) => hid === hotspot.id && Number(sid.slice(1)) <= shockLevel
  );
  if (shocked) return "CRITICAL";
  const matched = alerts.find((a) => a.id === hotspot.alertId);
  if (matched) return matched.severity;
  const score = (hotspot.geopoliticalWeight + hotspot.economicWeight) / 2;
  if (score >= 0.8) return "CRITICAL";
  if (score >= 0.62) return "ELEVATED";
  return "WATCH";
}

export function Atlas3DView({
  theme,
  region,
  heatmapMode,
  showRiskNodes,
  showChokepoints,
  showHeatmap,
  showTradeArcs,
  shockLevel,
  alerts,
  extraHotspots,
  focusedHotspotId,
  onChangeHeatmapMode,
  onToggleLayer,
  onFocusHotspot,
  onSelectAlert,
  onAskEcoForLocation,
}: Atlas3DViewProps) {
  const [showPillars, setShowPillars] = useState(true);
  const [showNightLights, setShowNightLights] = useState(true);
  const [autoRotate, setAutoRotate] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("All");
  const [continentFilter, setContinentFilter] = useState<"All" | Continent>("All");
  const [sortBy, setSortBy] = useState<SortKey>("risk");

  const allHotspots = useMemo(() => [...extraHotspots, ...HOTSPOTS], [extraHotspots]);

  const filteredHotspots = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return allHotspots
      .filter((h) => {
        const regOk = region === "global" || h.regions.includes(region);
        const catOk = categoryFilter === "All" || h.category === categoryFilter;
        const contOk = continentFilter === "All" || h.continent === continentFilter;
        const searchOk =
          !q ||
          h.name.toLowerCase().includes(q) ||
          h.country.toLowerCase().includes(q) ||
          (h.continent && h.continent.toLowerCase().includes(q)) ||
          h.summary.toLowerCase().includes(q);
        return regOk && catOk && contOk && searchOk;
      })
      .sort((a, b) => {
        if (sortBy === "food") return b.foodInflationPct - a.foodInflationPct;
        if (sortBy === "delay") return b.portDelayDays - a.portDelayDays;
        const scoreA = a.geopoliticalWeight * 0.5 + a.economicWeight * 0.5;
        const scoreB = b.geopoliticalWeight * 0.5 + b.economicWeight * 0.5;
        return scoreB - scoreA;
      });
  }, [allHotspots, categoryFilter, continentFilter, region, searchQuery, sortBy]);

  const activeHotspot =
    allHotspots.find((h) => h.id === focusedHotspotId) ??
    filteredHotspots[0] ??
    allHotspots[0];

  const activeSeverity = activeHotspot
    ? resolveHotspotSeverity(activeHotspot, shockLevel, alerts)
    : "WATCH";

  const activeAlertId = useMemo(() => {
    if (!activeHotspot) return "a1";
    const shockMatch = Object.entries(SHOCK_HOTSPOT_MAP).find(
      ([sid, hid]) => hid === activeHotspot.id && Number(sid.slice(1)) <= shockLevel
    );
    return shockMatch ? shockMatch[0] : activeHotspot.alertId;
  }, [activeHotspot, shockLevel]);

  return (
    <div className="space-y-4">
      <section className="grid grid-cols-1 xl:grid-cols-[1.72fr_1fr] gap-4 items-stretch">
        {/* Left: Full-Scale 3D Globe Spatial Terminal */}
        <div className="liquid-glass rounded-xl flex flex-col overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-zinc-900/10 dark:border-white/10 px-4 py-3">
            <div className="flex items-center gap-2">
              <Globe2 className="w-4 h-4 text-zinc-900 dark:text-zinc-100" />
              <h2 className="text-sm font-semibold text-zinc-950 dark:text-white">
                {region === "global"
                  ? "Global 3D Geopolitical & Economic Risk Atlas"
                  : `${REGIONS[region].name} 3D Risk Cluster Atlas`}
              </h2>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <div className="inline-flex flex-wrap items-center rounded-lg border border-zinc-900/15 dark:border-white/15 bg-white/60 dark:bg-zinc-950/60 p-0.5 text-[11px]">
                {(
                  [
                    ["combined", "Combined"],
                    ["geopolitical", "Geopolitical"],
                    ["inflation", "Inflation & FX"],
                    ["food", "Food Stress"],
                    ["maritime", "Maritime"],
                  ] as Array<[HeatmapMode, string]>
                ).map(([m, label]) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => onChangeHeatmapMode(m)}
                    className={`rounded-md px-2 py-1 font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      heatmapMode === m
                        ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-950"
                        : "text-zinc-600 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 3D Layer Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-900/10 dark:border-white/10 bg-zinc-200/45 dark:bg-zinc-950/40 px-4 py-2 text-[11px]">
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => onToggleLayer("heat")}
                className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 font-medium border transition-colors cursor-pointer ${
                  showHeatmap
                    ? "bg-zinc-900 text-white border-zinc-900 dark:bg-white/20 dark:border-white/40 dark:text-white"
                    : "border-zinc-900/15 dark:border-white/15 text-zinc-500 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white"
                }`}
              >
                <Flame className="w-3 h-3" />
                <span>Thermal Heatmap</span>
              </button>

              <button
                type="button"
                onClick={() => setShowPillars((v) => !v)}
                className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 font-medium border transition-colors cursor-pointer ${
                  showPillars
                    ? "bg-zinc-900 text-white border-zinc-900 dark:bg-white/20 dark:border-white/40 dark:text-white"
                    : "border-zinc-900/15 dark:border-white/15 text-zinc-500 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white"
                }`}
              >
                <Layers className="w-3 h-3" />
                <span>3D Pillars</span>
              </button>

              <button
                type="button"
                onClick={() => onToggleLayer("arcs")}
                className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 font-medium border transition-colors cursor-pointer ${
                  showTradeArcs
                    ? "bg-zinc-900 text-white border-zinc-900 dark:bg-white/20 dark:border-white/40 dark:text-white"
                    : "border-zinc-900/15 dark:border-white/15 text-zinc-500 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white"
                }`}
              >
                <Navigation className="w-3 h-3" />
                <span>Trade Arcs</span>
              </button>

              <button
                type="button"
                onClick={() => onToggleLayer("choke")}
                className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 font-medium border transition-colors cursor-pointer ${
                  showChokepoints
                    ? "bg-zinc-900 text-white border-zinc-900 dark:bg-white/20 dark:border-white/40 dark:text-white"
                    : "border-zinc-900/15 dark:border-white/15 text-zinc-500 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white"
                }`}
              >
                <Anchor className="w-3 h-3" />
                <span>Chokepoints</span>
              </button>

              <button
                type="button"
                onClick={() => setShowNightLights((v) => !v)}
                className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 font-medium border transition-colors cursor-pointer ${
                  showNightLights
                    ? "bg-zinc-900 text-white border-zinc-900 dark:bg-white/20 dark:border-white/40 dark:text-white"
                    : "border-zinc-900/15 dark:border-white/15 text-zinc-500 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white"
                }`}
              >
                <Sun className="w-3 h-3" />
                <span>City Lights</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => setAutoRotate((v) => !v)}
              className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 font-medium border transition-colors cursor-pointer ${
                autoRotate
                  ? "bg-zinc-900 text-white border-zinc-900 dark:bg-white/20 dark:border-white/40 dark:text-white"
                  : "border-zinc-900/15 dark:border-white/15 text-zinc-500 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white"
              }`}
            >
              <RotateCw className="w-3 h-3" />
              <span>{autoRotate ? "Orbit: On" : "Orbit: Paused"}</span>
            </button>
          </div>

          <div className="flex-1">
            <Globe3DHeatmap
              theme={theme}
              region={region}
              heatmapMode={heatmapMode}
              showRiskNodes={showRiskNodes}
              showChokepoints={showChokepoints}
              showHeatmap={showHeatmap}
              showTradeArcs={showTradeArcs}
              showPillars={showPillars}
              showNightLights={showNightLights}
              autoRotate={autoRotate}
              shockLevel={shockLevel}
              alerts={alerts}
              extraHotspots={extraHotspots}
              focusedHotspotId={activeHotspot?.id ?? null}
              heightClass="h-[540px] lg:h-[620px]"
              onSelectHotspot={(alertId, hotspotId) => {
                if (hotspotId) onFocusHotspot(hotspotId);
                onSelectAlert(alertId);
              }}
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-900/10 dark:border-white/10 px-4 py-2.5 text-xs text-zinc-600 dark:text-zinc-300">
            <div className="flex flex-wrap items-center gap-4">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
                <span>Critical cluster</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                <span>Elevated risk</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-zinc-800 dark:bg-zinc-200" />
                <span>Watch corridor</span>
              </span>
            </div>
            <span className="font-mono text-[11px] text-zinc-700 dark:text-zinc-300 tabular-nums">
              {allHotspots.length} Risk Nodes · {TRADE_ARCS.length} Trade Arcs · {CHOKEPOINTS.length} Chokepoints
            </span>
          </div>
        </div>

        {/* Right: 108+ Location Risk Inspector & Continent Directory */}
        <div className="liquid-glass rounded-xl flex flex-col overflow-hidden">
          <div className="flex items-center justify-between border-b border-zinc-900/10 dark:border-white/10 px-4 py-3">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-zinc-900 dark:text-zinc-100" />
              <h2 className="text-sm font-semibold text-zinc-950 dark:text-white">Location Risk Inspector</h2>
            </div>
            <span className="font-mono text-xs text-zinc-600 dark:text-zinc-300 tabular-nums">
              {filteredHotspots.length} locations
            </span>
          </div>

          {/* Focused Location Deep-Dive */}
          {activeHotspot && (
            <div className="border-b border-zinc-900/10 dark:border-white/10 bg-white/50 dark:bg-zinc-950/55 p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-[11px] font-mono text-zinc-500 dark:text-zinc-400">
                    {activeHotspot.country}
                    {activeHotspot.continent ? ` · ${activeHotspot.continent}` : ""} · {activeHotspot.category}
                  </div>
                  <h3 className="text-base font-bold text-zinc-950 dark:text-white">{activeHotspot.name}</h3>
                </div>
                <span
                  className={`font-mono text-[11px] font-bold ${
                    activeSeverity === "CRITICAL"
                      ? "text-red-600 dark:text-red-300"
                      : activeSeverity === "ELEVATED"
                        ? "text-amber-600 dark:text-amber-300"
                        : "text-zinc-700 dark:text-zinc-300"
                  }`}
                >
                  {activeSeverity}
                </span>
              </div>

              <p className="text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed">{activeHotspot.summary}</p>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="rounded-lg border border-zinc-900/10 dark:border-white/10 bg-white/65 dark:bg-zinc-900/70 p-2">
                  <div className="text-[10px] text-zinc-500 dark:text-zinc-400">Food CPI</div>
                  <div className="font-mono text-sm font-bold text-zinc-950 dark:text-white tabular-nums">
                    +{activeHotspot.foodInflationPct.toFixed(1)}%
                  </div>
                </div>
                <div className="rounded-lg border border-zinc-900/10 dark:border-white/10 bg-white/65 dark:bg-zinc-900/70 p-2">
                  <div className="text-[10px] text-zinc-500 dark:text-zinc-400">FX Spread</div>
                  <div className="font-mono text-sm font-bold text-amber-600 dark:text-amber-300 tabular-nums">
                    {activeHotspot.fxSpreadPct.toFixed(1)}%
                  </div>
                </div>
                <div className="rounded-lg border border-zinc-900/10 dark:border-white/10 bg-white/65 dark:bg-zinc-900/70 p-2">
                  <div className="text-[10px] text-zinc-500 dark:text-zinc-400">Port Delay</div>
                  <div className="font-mono text-sm font-bold text-zinc-950 dark:text-white tabular-nums">
                    {activeHotspot.portDelayDays.toFixed(1)}d
                  </div>
                </div>
                <div className="rounded-lg border border-zinc-900/10 dark:border-white/10 bg-white/65 dark:bg-zinc-900/70 p-2">
                  <div className="text-[10px] text-zinc-500 dark:text-zinc-400">Social Vel</div>
                  <div className="font-mono text-sm font-bold text-red-600 dark:text-red-300 tabular-nums">
                    {activeHotspot.socialSpike}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => onSelectAlert(activeAlertId)}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 px-3 py-2 text-xs font-semibold hover:opacity-90 transition-opacity cursor-pointer whitespace-nowrap"
                >
                  <Activity className="w-3.5 h-3.5" />
                  <span>Inspect Causal Alert</span>
                </button>
                <button
                  type="button"
                  onClick={() => onAskEcoForLocation(activeHotspot)}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg border border-zinc-900/20 dark:border-white/25 bg-white/75 dark:bg-white/10 px-3 py-2 text-xs font-semibold text-zinc-900 dark:text-white hover:bg-white dark:hover:bg-white/20 transition-colors cursor-pointer whitespace-nowrap"
                >
                  <Bot className="w-3.5 h-3.5" />
                  <span>Ask ECO</span>
                </button>
              </div>
            </div>
          )}

          {/* Search, Continent Filter, Category Filter & Sort */}
          <div className="border-b border-zinc-900/10 dark:border-white/10 p-3 space-y-2">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={`Search ${allHotspots.length} global locations...`}
                  className="w-full rounded-lg border border-zinc-900/15 dark:border-white/15 bg-white/75 dark:bg-zinc-950/70 pl-8 pr-3 py-1.5 text-xs text-zinc-950 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:border-zinc-900 dark:focus:border-white"
                />
              </div>
              <select
                aria-label="Sort locations"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortKey)}
                className="rounded-lg border border-zinc-900/15 dark:border-white/15 bg-white/75 dark:bg-zinc-950/70 px-2.5 py-1.5 text-xs text-zinc-800 dark:text-zinc-200 focus:outline-none focus:border-zinc-900 dark:focus:border-white"
              >
                <option value="risk">Sort: Risk</option>
                <option value="food">Sort: Food CPI</option>
                <option value="delay">Sort: Delay</option>
              </select>
            </div>

            <div className="flex flex-wrap gap-1">
              {CONTINENT_OPTIONS.map((cont) => (
                <button
                  key={cont}
                  type="button"
                  onClick={() => setContinentFilter(cont)}
                  className={`rounded-md px-2 py-0.5 text-[10px] font-medium transition-colors cursor-pointer ${
                    continentFilter === cont
                      ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-950"
                      : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white"
                  }`}
                >
                  {cont}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap gap-1">
              {CATEGORY_OPTIONS.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategoryFilter(cat)}
                  className={`rounded-md px-2 py-0.5 text-[11px] font-medium transition-colors cursor-pointer ${
                    categoryFilter === cat
                      ? "border border-zinc-900/30 dark:border-white/35 bg-zinc-900/10 dark:bg-white/15 text-zinc-950 dark:text-white"
                      : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white border border-transparent"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Scrollable Location List */}
          <div className="flex-1 max-h-[340px] overflow-y-auto divide-y divide-zinc-900/10 dark:divide-white/10">
            {filteredHotspots.length === 0 ? (
              <p className="p-4 text-xs text-zinc-500 dark:text-zinc-400">
                No monitored hotspots match this filter.
              </p>
            ) : (
              filteredHotspots.map((hs) => {
                const isSelected = activeHotspot?.id === hs.id;
                const sev = resolveHotspotSeverity(hs, shockLevel, alerts);
                const combinedScore = Math.round((hs.geopoliticalWeight * 0.5 + hs.economicWeight * 0.5) * 100);
                return (
                  <button
                    key={hs.id}
                    type="button"
                    onClick={() => {
                      setAutoRotate(false);
                      onFocusHotspot(hs.id);
                    }}
                    className={`w-full text-left px-4 py-2.5 transition-colors cursor-pointer flex items-center justify-between gap-3 ${
                      isSelected
                        ? "bg-zinc-900/10 dark:bg-white/15"
                        : "hover:bg-zinc-900/[0.04] dark:hover:bg-white/[0.06]"
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 text-xs font-semibold text-zinc-950 dark:text-white">
                        <span
                          className={`w-2 h-2 rounded-full shrink-0 ${
                            sev === "CRITICAL"
                              ? "bg-red-500"
                              : sev === "ELEVATED"
                                ? "bg-amber-400"
                                : "bg-zinc-800 dark:bg-zinc-200"
                          }`}
                        />
                        <span className="truncate">{hs.name}</span>
                        <span className="text-zinc-500 dark:text-zinc-400 font-normal truncate">{hs.country}</span>
                      </div>
                      <div className="mt-0.5 flex items-center gap-2.5 font-mono text-[11px] text-zinc-500 dark:text-zinc-400 tabular-nums">
                        <span>{hs.category}</span>
                        <span>·</span>
                        <span className="text-zinc-800 dark:text-zinc-200">Food +{hs.foodInflationPct.toFixed(1)}%</span>
                        <span>·</span>
                        <span>{hs.portDelayDays.toFixed(1)}d delay</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-mono text-xs font-bold text-zinc-900 dark:text-zinc-100 tabular-nums">
                        {combinedScore}
                      </span>
                      <Compass className="w-3.5 h-3.5 text-zinc-600 dark:text-zinc-300" />
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
