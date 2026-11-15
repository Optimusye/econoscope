import { useMemo, useState } from "react";
import { motion } from "motion/react";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  BellRing,
  CalendarClock,
  Clock3,
  Download,
  Globe2,
  Grid3X3,
  Landmark,
  Layers,
  Map as MapIcon,
  Network,
  PackageX,
  Search,
  ShieldAlert,
  Sliders,
  Sparkles,
  Timer,
  TrendingUp,
} from "lucide-react";
import {
  COMMODITIES,
  COUNTRY_RISK_MATRIX,
  CROSS_ASSET_CORRELATIONS,
  HOTSPOTS,
  MACRO_CALENDAR,
  REGIONS,
  generateOfficialStepSeries,
  generateSeries,
  getLabelsForTimeframe,
} from "../data/econoscopeData";
import type {
  Continent,
  EconomicAlert,
  HeatmapMode,
  RegionKey,
  RiskHotspot,
  Severity,
  ThemeMode,
  TimeframeKey,
} from "../types/econoscope";
import { WorldMap2D } from "./WorldMap2D";
import { InflationLineChart } from "./Charts";
import { MarketBriefs } from "./MarketBriefs";

interface CommandCenterViewProps {
  theme: ThemeMode;
  region: RegionKey;
  timeframe: TimeframeKey;
  shockLevel: number;
  alerts: EconomicAlert[];
  extraHotspots: RiskHotspot[];
  heatmapMode: HeatmapMode;
  showRiskNodes: boolean;
  showChokepoints: boolean;
  showHeatmap: boolean;
  impactAlertId: string | null;
  onChangeHeatmapMode: (mode: HeatmapMode) => void;
  onToggleLayer: (layer: "risk" | "choke" | "heat" | "arcs") => void;
  onSelectAlert: (alertId: string) => void;
  onChangeImpactAlert: (alertId: string) => void;
  onOpen3DAtlas: (hotspotId?: string) => void;
  onAskEco: (prompt: string) => void;
}

const CONTINENT_TABS: Array<"All" | Continent> = [
  "All",
  "Africa",
  "Europe",
  "Asia",
  "North America",
  "South America",
  "Oceania",
];

function severityLabelClass(sev: Severity): string {
  if (sev === "CRITICAL") return "text-red-600 dark:text-red-400";
  if (sev === "ELEVATED") return "text-amber-600 dark:text-amber-300";
  return "text-zinc-900 dark:text-zinc-200";
}

function SeverityIcon({ sev }: { sev: Severity }) {
  if (sev === "CRITICAL") return <ShieldAlert className="w-3.5 h-3.5 text-red-500 shrink-0" />;
  if (sev === "ELEVATED") return <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />;
  return <Activity className="w-3.5 h-3.5 text-zinc-700 dark:text-zinc-300 shrink-0" />;
}

export function CommandCenterView({
  theme,
  region,
  timeframe,
  shockLevel,
  alerts,
  extraHotspots,
  heatmapMode,
  showRiskNodes,
  showChokepoints,
  showHeatmap,
  impactAlertId,
  onChangeHeatmapMode,
  onToggleLayer,
  onSelectAlert,
  onChangeImpactAlert,
  onOpen3DAtlas,
  onAskEco,
}: CommandCenterViewProps) {
  const [reserveReleasePct, setReserveReleasePct] = useState(25);
  const [fxHedgeRatioPct, setFxHedgeRatioPct] = useState(40);
  const [tariffBufferPct, setTariffBufferPct] = useState(20);
  const [continentFilter, setContinentFilter] = useState<"All" | Continent>("All");
  const [countrySearch, setCountrySearch] = useState("");
  const [regionLock, setRegionLock] = useState(false);
  const [sortBy, setSortBy] = useState<"rtCpi" | "gap" | "unrest" | "fxSpread" | "debt">("rtCpi");

  const regCfg = REGIONS[region];
  const rawRealTimeIdx = regCfg.realTimeInflation + shockLevel * 0.8;
  const officialCpi = regCfg.officialCpi;
  const rawGap = rawRealTimeIdx - officialCpi;
  const rawShortageProb = Math.min(97, regCfg.shortageProbability + shockLevel * 4);

  const simulatedCpiRelief = Number(
    (
      (reserveReleasePct / 100) * 1.9 +
      (fxHedgeRatioPct / 100) * 1.4 +
      (tariffBufferPct / 100) * 1.1
    ).toFixed(1)
  );
  const simulatedDaysGained = Math.round(
    (reserveReleasePct / 100) * 18 + (fxHedgeRatioPct / 100) * 6 + (tariffBufferPct / 100) * 9
  );
  const simulatedUnrestDrop = Math.min(
    42,
    Math.round(reserveReleasePct * 0.18 + fxHedgeRatioPct * 0.12 + tariffBufferPct * 0.14)
  );
  const mitigatedRealTimeIdx = Math.max(officialCpi * 0.9, rawRealTimeIdx - simulatedCpiRelief);

  const regionalAlerts = useMemo(
    () =>
      alerts
        .filter((a) => a.regions.includes(region))
        .sort((a, b) => {
          const rank = { CRITICAL: 0, ELEVATED: 1, WATCH: 2 };
          return rank[a.severity] - rank[b.severity] || b.confidence - a.confidence;
        }),
    [alerts, region]
  );

  const avgLead = regionalAlerts.length
    ? regionalAlerts.reduce((sum, a) => sum + a.leadDays, 0) / regionalAlerts.length
    : 0;

  const criticalCount = regionalAlerts.filter((a) => a.severity === "CRITICAL").length;
  const elevatedCount = regionalAlerts.filter((a) => a.severity === "ELEVATED").length;
  const watchCount = regionalAlerts.filter((a) => a.severity === "WATCH").length;

  const labels = useMemo(() => getLabelsForTimeframe(timeframe), [timeframe]);
  const realTimeSeries = useMemo(
    () =>
      generateSeries(
        `rt-${region}`,
        timeframe,
        officialCpi * 0.85,
        rawRealTimeIdx - shockLevel * 0.8,
        rawRealTimeIdx * 0.045,
        shockLevel ? shockLevel * rawRealTimeIdx * 0.07 : 0
      ),
    [officialCpi, rawRealTimeIdx, region, shockLevel, timeframe]
  );
  const officialSeries = useMemo(
    () => generateOfficialStepSeries(timeframe, officialCpi * 0.85, officialCpi),
    [officialCpi, timeframe]
  );

  const activeImpactAlert =
    regionalAlerts.find((a) => a.id === impactAlertId) ?? regionalAlerts[0] ?? alerts[0];

  const trackedCommoditiesCount = COMMODITIES.filter(
    (c) => region === "global" || c.regions.includes(region)
  ).length;

  const continentCounts = useMemo(() => {
    const map: Record<string, number> = { All: COUNTRY_RISK_MATRIX.length };
    for (const c of COUNTRY_RISK_MATRIX) {
      map[c.continent] = (map[c.continent] ?? 0) + 1;
    }
    return map;
  }, []);

  const visibleCountries = useMemo(() => {
    const q = countrySearch.trim().toLowerCase();
    const filtered = COUNTRY_RISK_MATRIX.filter((c) => {
      const regOk = !regionLock || region === "global" || c.region === region;
      const contOk = continentFilter === "All" || c.continent === continentFilter;
      const qOk =
        !q ||
        c.name.toLowerCase().includes(q) ||
        c.code.toLowerCase().includes(q) ||
        c.primaryDriver.toLowerCase().includes(q);
      return regOk && contOk && qOk;
    });

    return [...filtered].sort((a, b) => {
      if (sortBy === "gap") {
        return b.realTimeCpi - b.officialCpi - (a.realTimeCpi - a.officialCpi);
      }
      if (sortBy === "unrest") return b.unrestRisk - a.unrestRisk;
      if (sortBy === "fxSpread") return b.fxSpreadPct - a.fxSpreadPct;
      if (sortBy === "debt") return b.debtToGdpPct - a.debtToGdpPct;
      return b.realTimeCpi - a.realTimeCpi;
    });
  }, [continentFilter, countrySearch, region, regionLock, sortBy]);

  const handleExportCsv = () => {
    const headers = [
      "Code",
      "Country",
      "Continent",
      "RealTimeCPI_Pct",
      "OfficialCPI_Pct",
      "Gap_Pts",
      "FXSpread_Pct",
      "PolicyRate_Pct",
      "Reserves_Months",
      "DebtToGDP_Pct",
      "CurrentAccount_Pct",
      "UnrestRisk",
      "PrimaryDriver",
    ];
    const rows = visibleCountries.map((c) => [
      c.code,
      `"${c.name}"`,
      c.continent,
      (c.realTimeCpi + shockLevel * 0.7).toFixed(1),
      c.officialCpi.toFixed(1),
      (c.realTimeCpi + shockLevel * 0.7 - c.officialCpi).toFixed(1),
      c.fxSpreadPct.toFixed(1),
      c.policyRatePct.toFixed(2),
      c.reserveMonths.toFixed(1),
      c.debtToGdpPct.toFixed(1),
      c.currentAccountPct.toFixed(1),
      String(Math.min(98, c.unrestRisk + shockLevel * 3)),
      `"${c.primaryDriver}"`,
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `econoscope-sovereign-matrix-${visibleCountries.length}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {/* 5-Column KPI Strip */}
      <section className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3.5" aria-label="Key economic indicators">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22 }}
          className="liquid-glass rounded-xl p-4"
        >
          <div className="flex items-center gap-2 text-xs font-medium text-zinc-600 dark:text-zinc-300">
            <Activity className="w-3.5 h-3.5 text-zinc-900 dark:text-white" />
            <span>Real-Time Index</span>
          </div>
          <div className="mt-2 font-mono text-2xl sm:text-3xl font-bold text-zinc-950 dark:text-white tabular-nums">
            {rawRealTimeIdx.toFixed(1)}%
          </div>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">EconoScope basket YoY</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22, delay: 0.03 }}
          className="liquid-glass rounded-xl p-4"
        >
          <div className="flex items-center gap-2 text-xs font-medium text-zinc-600 dark:text-zinc-300">
            <Landmark className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>Official CPI (Lagging)</span>
          </div>
          <div className="mt-2 font-mono text-2xl sm:text-3xl font-bold text-emerald-600 dark:text-emerald-300 tabular-nums">
            {officialCpi.toFixed(1)}%
          </div>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Gap{" "}
            <span
              className={`font-mono font-semibold ${
                rawGap > 3 ? "text-red-600 dark:text-red-300" : "text-emerald-600 dark:text-emerald-300"
              }`}
            >
              +{rawGap.toFixed(1)} pts
            </span>{" "}
            vs real time
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22, delay: 0.06 }}
          className="liquid-glass rounded-xl p-4"
        >
          <div className="flex items-center gap-2 text-xs font-medium text-zinc-600 dark:text-zinc-300">
            <Timer className="w-3.5 h-3.5 text-zinc-900 dark:text-zinc-100" />
            <span>Detection Lead</span>
          </div>
          <div className="mt-2 font-mono text-2xl sm:text-3xl font-bold text-zinc-950 dark:text-white tabular-nums">
            {avgLead.toFixed(1)}{" "}
            <span className="text-sm font-normal text-zinc-500 dark:text-zinc-400">days</span>
          </div>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Ahead of official print</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22, delay: 0.09 }}
          className="liquid-glass rounded-xl p-4"
        >
          <div className="flex items-center gap-2 text-xs font-medium text-zinc-600 dark:text-zinc-300">
            <PackageX className="w-3.5 h-3.5 text-amber-500" />
            <span>Shortage Probability</span>
          </div>
          <div
            className={`mt-2 font-mono text-2xl sm:text-3xl font-bold tabular-nums ${
              rawShortageProb >= 65 ? "text-red-600 dark:text-red-300" : "text-amber-600 dark:text-amber-300"
            }`}
          >
            {rawShortageProb}%
          </div>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            {trackedCommoditiesCount} commodities · {COUNTRY_RISK_MATRIX.length} nations
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22, delay: 0.12 }}
          className="liquid-glass rounded-xl p-4 col-span-2 md:col-span-1"
        >
          <div className="flex items-center gap-2 text-xs font-medium text-zinc-600 dark:text-zinc-300">
            <ShieldAlert className="w-3.5 h-3.5 text-red-500" />
            <span>Active Alerts</span>
          </div>
          <div className="mt-2 font-mono text-2xl sm:text-3xl font-bold text-zinc-950 dark:text-white tabular-nums">
            {regionalAlerts.length}
          </div>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400 font-mono tabular-nums">
            <span className="text-red-600 dark:text-red-300">{criticalCount} crit</span> ·{" "}
            <span className="text-amber-600 dark:text-amber-300">{elevatedCount} elev</span> ·{" "}
            <span className="text-zinc-700 dark:text-zinc-300">{watchCount} watch</span>
          </p>
        </motion.div>
      </section>

      {/* Live Rolling Market Briefs & Instant Sentiment */}
      <MarketBriefs region={region} onAskEco={onAskEco} />

      {/* Main Split: 2D Spatial Risk Overview + Early Warning Feed */}
      <section className="grid grid-cols-1 xl:grid-cols-[1.62fr_1fr] gap-4 items-stretch">
        <div className="liquid-glass rounded-xl flex flex-col overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-zinc-900/10 dark:border-white/10 px-4 py-3">
            <div className="flex items-center gap-2">
              <MapIcon className="w-4 h-4 text-zinc-900 dark:text-zinc-100" />
              <h2 className="text-sm font-semibold text-zinc-950 dark:text-white">
                {region === "global"
                  ? "Global 2D Risk & Chokepoint Overview"
                  : `${regCfg.name} Risk Overview`}
              </h2>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center rounded-lg border border-zinc-900/15 dark:border-white/15 bg-white/60 dark:bg-zinc-950/60 p-0.5 text-[11px]">
                {(
                  [
                    ["combined", "Combined"],
                    ["geopolitical", "Geopolitical"],
                    ["inflation", "Inflation"],
                    ["food", "Food"],
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

              <button
                type="button"
                onClick={() => onToggleLayer("heat")}
                className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-medium border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  showHeatmap
                    ? "bg-zinc-900 text-white border-zinc-900 dark:bg-white/20 dark:border-white/40 dark:text-white"
                    : "border-zinc-900/15 dark:border-white/15 text-zinc-500 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white"
                }`}
              >
                <Layers className="w-3 h-3" />
                <span>Heatmap</span>
              </button>

              <button
                type="button"
                onClick={() => onToggleLayer("choke")}
                className={`rounded-lg px-2.5 py-1 text-[11px] font-medium border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  showChokepoints
                    ? "bg-zinc-900 text-white border-zinc-900 dark:bg-white/20 dark:border-white/40 dark:text-white"
                    : "border-zinc-900/15 dark:border-white/15 text-zinc-500 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white"
                }`}
              >
                Chokepoints
              </button>

              <button
                type="button"
                onClick={() => onOpen3DAtlas()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 px-3 py-1 text-[11px] font-semibold hover:opacity-90 transition-opacity whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Globe2 className="w-3.5 h-3.5" />
                <span>Open 3D Risk Atlas</span>
              </button>
            </div>
          </div>

          <div className="flex-1">
            <WorldMap2D
              theme={theme}
              region={region}
              heatmapMode={heatmapMode}
              showRiskNodes={showRiskNodes}
              showChokepoints={showChokepoints}
              showHeatmap={showHeatmap}
              shockLevel={shockLevel}
              alerts={alerts}
              extraHotspots={extraHotspots}
              onSelectHotspot={onSelectAlert}
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
                <span className="w-2.5 h-2.5 rounded-full bg-zinc-900 dark:bg-zinc-200" />
                <span>Watch corridor</span>
              </span>
            </div>
            <span className="text-zinc-500 dark:text-zinc-400 font-mono text-[11px] tabular-nums">
              {HOTSPOTS.length + extraHotspots.length} monitored nodes · Click any node for causal explanation
            </span>
          </div>
        </div>

        {/* Early Warning Feed */}
        <div className="liquid-glass rounded-xl flex flex-col overflow-hidden">
          <div className="flex items-center justify-between border-b border-zinc-900/10 dark:border-white/10 px-4 py-3">
            <div className="flex items-center gap-2">
              <BellRing className="w-4 h-4 text-zinc-900 dark:text-zinc-100" />
              <h2 className="text-sm font-semibold text-zinc-950 dark:text-white">Early Warning Feed</h2>
            </div>
            <span className="font-mono text-xs text-zinc-500 dark:text-zinc-400 tabular-nums">
              {regionalAlerts.length} signals
            </span>
          </div>

          <div className="flex-1 max-h-[505px] overflow-y-auto p-3 space-y-2.5">
            {regionalAlerts.length === 0 ? (
              <p className="p-4 text-sm text-zinc-500 dark:text-zinc-400">No active alerts in this region.</p>
            ) : (
              regionalAlerts.map((al) => {
                const [offCnt, newsCnt, socCnt] = al.sourceCounts;
                const wOff = offCnt * 9;
                const wNews = newsCnt * 3.2;
                const wSoc = Math.log10(socCnt + 1) * 7;
                const wTot = wOff + wNews + wSoc;
                return (
                  <button
                    key={al.id}
                    type="button"
                    onClick={() => onSelectAlert(al.id)}
                    className="w-full text-left rounded-xl border border-zinc-900/10 dark:border-white/10 bg-white/60 dark:bg-zinc-950/45 p-3.5 hover:bg-white dark:hover:bg-zinc-900/75 hover:border-zinc-900/25 dark:hover:border-white/25 transition-all cursor-pointer space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="inline-flex items-center gap-1.5 font-mono font-bold">
                        <SeverityIcon sev={al.severity} />
                        <span className={severityLabelClass(al.severity)}>{al.severity}</span>
                        <span className="text-zinc-400">·</span>
                        <span className="font-sans font-medium text-zinc-600 dark:text-zinc-300">{al.category}</span>
                      </span>
                      {al.isShock && (
                        <span className="font-mono text-[10px] font-bold text-red-600 dark:text-red-300">CASCADE</span>
                      )}
                      {al.isLive && (
                        <span className="font-mono text-[10px] font-bold text-emerald-600 dark:text-emerald-300">
                          LIVE INGEST
                        </span>
                      )}
                    </div>

                    <h3 className="text-sm font-semibold text-zinc-950 dark:text-white leading-snug">{al.title}</h3>

                    <div className="flex items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-300">
                      <Clock3 className="w-3.5 h-3.5 shrink-0" />
                      <span>
                        Detected <strong className="font-mono text-zinc-950 dark:text-white">{al.leadDays} days</strong> ahead of official CPI print
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-xs">
                      <span className="font-mono font-semibold text-zinc-800 dark:text-zinc-200 tabular-nums shrink-0">
                        {al.confidence.toFixed(1)}% confidence
                      </span>
                      <div className="flex flex-1 h-1.5 rounded-full overflow-hidden bg-zinc-200 dark:bg-zinc-800 gap-0.5">
                        <div className="bg-emerald-500 dark:bg-emerald-400" style={{ width: `${(wOff / wTot) * 100}%` }} />
                        <div className="bg-zinc-900 dark:bg-zinc-100" style={{ width: `${(wNews / wTot) * 100}%` }} />
                        <div className="bg-zinc-500 dark:bg-zinc-400" style={{ width: `${(wSoc / wTot) * 100}%` }} />
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-0.5 text-[11px] text-zinc-500 dark:text-zinc-400">
                      <span className="font-mono truncate">
                        {offCnt} datasets · {newsCnt} wires · {socCnt.toLocaleString()} social
                      </span>
                      <span className="inline-flex items-center gap-1 text-zinc-900 dark:text-zinc-100 font-semibold shrink-0">
                        <Sparkles className="w-3 h-3" />
                        <span>Explain</span>
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      </section>

      {/* Policy Simulator + Cross-Asset Contagion Matrix */}
      <section className="grid grid-cols-1 lg:grid-cols-[1.15fr_1fr] gap-4 items-stretch">
        {/* Interactive Policy & Hedging Simulator */}
        <div className="liquid-glass rounded-xl p-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-900/10 dark:border-white/10 pb-3">
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-zinc-900 dark:text-zinc-100" />
              <div>
                <h2 className="text-sm font-semibold text-zinc-950 dark:text-white">
                  Policy &amp; Hedging Mitigation Simulator
                </h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Simulate sovereign reserve releases, FX hedging, and port prioritization in {regCfg.name}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 text-[11px]">
              <button
                type="button"
                onClick={() => {
                  setReserveReleasePct(15);
                  setFxHedgeRatioPct(25);
                  setTariffBufferPct(10);
                }}
                className="rounded-md border border-zinc-900/15 dark:border-white/15 bg-white/60 dark:bg-zinc-900/60 px-2.5 py-1 text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white cursor-pointer"
              >
                Minimal
              </button>
              <button
                type="button"
                onClick={() => {
                  setReserveReleasePct(55);
                  setFxHedgeRatioPct(70);
                  setTariffBufferPct(45);
                }}
                className="rounded-md border border-zinc-900/25 dark:border-white/25 bg-zinc-900/10 dark:bg-white/15 px-2.5 py-1 text-zinc-950 dark:text-white font-medium hover:opacity-85 cursor-pointer"
              >
                IMF Stabilization
              </button>
              <button
                type="button"
                onClick={() => {
                  setReserveReleasePct(85);
                  setFxHedgeRatioPct(90);
                  setTariffBufferPct(80);
                }}
                className="rounded-md border border-emerald-500/40 bg-emerald-500/15 px-2.5 py-1 text-emerald-700 dark:text-emerald-200 hover:bg-emerald-500/25 cursor-pointer"
              >
                Emergency Shield
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
            <label className="rounded-xl border border-zinc-900/10 dark:border-white/10 bg-white/55 dark:bg-zinc-950/50 p-3 space-y-2 block">
              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-700 dark:text-zinc-300 font-medium">Grain &amp; Urea Reserve Release</span>
                <span className="font-mono font-bold text-zinc-950 dark:text-white tabular-nums">
                  {reserveReleasePct}%
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={reserveReleasePct}
                onChange={(e) => setReserveReleasePct(Number(e.target.value))}
                className="w-full accent-zinc-900 dark:accent-white cursor-pointer"
              />
            </label>

            <label className="rounded-xl border border-zinc-900/10 dark:border-white/10 bg-white/55 dark:bg-zinc-950/50 p-3 space-y-2 block">
              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-700 dark:text-zinc-300 font-medium">FX Import Hedge Ratio</span>
                <span className="font-mono font-bold text-zinc-950 dark:text-white tabular-nums">
                  {fxHedgeRatioPct}%
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={fxHedgeRatioPct}
                onChange={(e) => setFxHedgeRatioPct(Number(e.target.value))}
                className="w-full accent-zinc-900 dark:accent-white cursor-pointer"
              />
            </label>

            <label className="rounded-xl border border-zinc-900/10 dark:border-white/10 bg-white/55 dark:bg-zinc-950/50 p-3 space-y-2 block">
              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-700 dark:text-zinc-300 font-medium">Port Fast-Track &amp; Tariff Cut</span>
                <span className="font-mono font-bold text-zinc-950 dark:text-white tabular-nums">
                  {tariffBufferPct}%
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={tariffBufferPct}
                onChange={(e) => setTariffBufferPct(Number(e.target.value))}
                className="w-full accent-zinc-900 dark:accent-white cursor-pointer"
              />
            </label>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3">
              <div className="text-[11px] text-emerald-700 dark:text-emerald-200">Mitigated Real-Time CPI</div>
              <div className="mt-1 font-mono text-xl font-bold text-zinc-950 dark:text-white tabular-nums">
                {mitigatedRealTimeIdx.toFixed(1)}%
              </div>
              <div className="text-[11px] font-mono text-emerald-700 dark:text-emerald-300 tabular-nums">
                -{simulatedCpiRelief.toFixed(1)} pts relief
              </div>
            </div>

            <div className="rounded-xl border border-zinc-900/10 dark:border-white/15 bg-white/55 dark:bg-zinc-950/50 p-3">
              <div className="text-[11px] text-zinc-600 dark:text-zinc-300">Supply Cover Gained</div>
              <div className="mt-1 font-mono text-xl font-bold text-zinc-950 dark:text-white tabular-nums">
                +{simulatedDaysGained} days
              </div>
              <div className="text-[11px] text-zinc-500 dark:text-zinc-400">Buffer ahead of harvest</div>
            </div>

            <div className="rounded-xl border border-zinc-900/10 dark:border-white/15 bg-white/55 dark:bg-zinc-950/50 p-3">
              <div className="text-[11px] text-zinc-600 dark:text-zinc-300">Unrest Risk Reduction</div>
              <div className="mt-1 font-mono text-xl font-bold text-amber-600 dark:text-amber-300 tabular-nums">
                -{simulatedUnrestDrop}%
              </div>
              <div className="text-[11px] text-zinc-500 dark:text-zinc-400">Staple affordability shield</div>
            </div>

            <div className="rounded-xl border border-zinc-900/10 dark:border-white/15 bg-white/55 dark:bg-zinc-950/50 p-3">
              <div className="text-[11px] text-zinc-600 dark:text-zinc-300">Unmitigated Baseline</div>
              <div className="mt-1 font-mono text-xl font-bold text-red-600 dark:text-red-300 tabular-nums">
                {rawRealTimeIdx.toFixed(1)}%
              </div>
              <div className="text-[11px] text-zinc-500 dark:text-zinc-400">Current shock trajectory</div>
            </div>
          </div>
        </div>

        {/* Cross-Asset Contagion Correlation Matrix */}
        <div className="liquid-glass rounded-xl overflow-hidden flex flex-col">
          <div className="flex items-center justify-between border-b border-zinc-900/10 dark:border-white/10 px-4 py-3">
            <div className="flex items-center gap-2">
              <Grid3X3 className="w-4 h-4 text-zinc-900 dark:text-zinc-100" />
              <h2 className="text-sm font-semibold text-zinc-950 dark:text-white">Cross-Asset Contagion Matrix</h2>
            </div>
            <span className="text-xs text-zinc-500 dark:text-zinc-400">90D correlation</span>
          </div>

          <div className="p-4 flex-1 overflow-x-auto">
            <table className="w-full text-[11px] font-mono tabular-nums">
              <thead>
                <tr className="text-zinc-500 dark:text-zinc-400">
                  <th className="py-1.5 pr-2 text-left font-sans font-medium">Factor</th>
                  {CROSS_ASSET_CORRELATIONS.assets.map((col) => (
                    <th key={col} className="py-1.5 px-1 text-center font-sans font-medium whitespace-nowrap">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {CROSS_ASSET_CORRELATIONS.assets.map((rowLabel, rIdx) => (
                  <tr key={rowLabel}>
                    <td className="py-1.5 pr-2 font-sans font-semibold text-zinc-900 dark:text-zinc-200 whitespace-nowrap">
                      {rowLabel}
                    </td>
                    {CROSS_ASSET_CORRELATIONS.matrix[rIdx].map((val, cIdx) => {
                      const isSelf = rIdx === cIdx;
                      const bg = isSelf
                        ? "bg-zinc-900 text-white dark:bg-white/25 dark:text-white"
                        : val >= 0.78
                          ? "bg-red-500/20 text-red-700 dark:bg-red-500/30 dark:text-red-100"
                          : val >= 0.65
                            ? "bg-amber-500/20 text-amber-800 dark:bg-amber-500/25 dark:text-amber-100"
                            : "bg-zinc-200/75 text-zinc-700 dark:bg-zinc-900/80 dark:text-zinc-300";
                      return (
                        <td key={`${rowLabel}-${cIdx}`} className="p-0.5">
                          <div className={`rounded px-1.5 py-1.5 text-center font-semibold ${bg}`}>
                            {val.toFixed(2)}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Sovereign Vulnerability Matrix: 108 Countries across All 6 Continents */}
      <section className="liquid-glass rounded-xl overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-zinc-900/10 dark:border-white/10 px-4 py-3.5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Globe2 className="w-4 h-4 text-zinc-900 dark:text-zinc-100" />
              <div>
                <h2 className="text-sm font-semibold text-zinc-950 dark:text-white">
                  Sovereign Economic Vulnerability Matrix ({visibleCountries.length} of {COUNTRY_RISK_MATRIX.length} Countries)
                </h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  100+ monitored economies across 6 continents · CPI divergence, FX spreads, Debt/GDP, current account &amp; reserves
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={countrySearch}
                  onChange={(e) => setCountrySearch(e.target.value)}
                  placeholder={`Filter ${COUNTRY_RISK_MATRIX.length} countries...`}
                  className="w-40 sm:w-48 rounded-lg border border-zinc-900/15 dark:border-white/15 bg-white/75 dark:bg-zinc-950/70 pl-8 pr-3 py-1.5 text-xs text-zinc-950 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:border-zinc-900 dark:focus:border-white"
                />
              </div>

              <select
                aria-label="Sort sovereign risk matrix"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                className="rounded-lg border border-zinc-900/15 dark:border-white/15 bg-white/75 dark:bg-zinc-950/70 px-2.5 py-1.5 text-[11px] font-medium text-zinc-800 dark:text-zinc-200 focus:outline-none focus:border-zinc-900 dark:focus:border-white"
              >
                <option value="rtCpi">Sort: Real-Time CPI</option>
                <option value="gap">Sort: CPI Surprise Gap</option>
                <option value="unrest">Sort: Unrest Risk</option>
                <option value="fxSpread">Sort: FX Spread</option>
                <option value="debt">Sort: Debt / GDP</option>
              </select>

              <button
                type="button"
                onClick={() => setRegionLock((v) => !v)}
                className={`rounded-lg px-2.5 py-1.5 text-[11px] font-medium border transition-colors cursor-pointer whitespace-nowrap ${
                  regionLock
                    ? "bg-zinc-900 text-white border-zinc-900 dark:bg-white dark:text-zinc-950 dark:border-white"
                    : "border-zinc-900/15 dark:border-white/15 text-zinc-600 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white"
                }`}
              >
                {regionLock ? `Locked: ${regCfg.name}` : "All Regions"}
              </button>

              <button
                type="button"
                onClick={handleExportCsv}
                className="inline-flex items-center gap-1 rounded-lg border border-zinc-900/15 dark:border-white/15 bg-white/70 dark:bg-zinc-900/70 px-2.5 py-1.5 text-[11px] font-medium text-zinc-800 dark:text-zinc-200 hover:text-zinc-950 dark:hover:text-white cursor-pointer whitespace-nowrap"
              >
                <Download className="w-3 h-3" />
                <span>CSV</span>
              </button>
            </div>
          </div>

          {/* Continent Filter Tabs */}
          <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filter countries by continent">
            {CONTINENT_TABS.map((cont) => {
              const active = continentFilter === cont;
              return (
                <button
                  key={cont}
                  type="button"
                  onClick={() => setContinentFilter(cont)}
                  className={`rounded-lg px-2.5 py-1 text-[11px] font-medium transition-colors cursor-pointer whitespace-nowrap ${
                    active
                      ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-950"
                      : "liquid-glass-subtle text-zinc-600 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white"
                  }`}
                >
                  {cont} ({continentCounts[cont] ?? 0})
                </button>
              );
            })}
          </div>
        </div>

        <div className="overflow-x-auto max-h-[450px] overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 z-10 bg-zinc-200/95 dark:bg-zinc-900/95 backdrop-blur-md">
              <tr className="border-b border-zinc-900/10 dark:border-white/10 text-zinc-600 dark:text-zinc-400">
                <th className="py-2.5 px-4 text-left font-medium">Country</th>
                <th className="py-2.5 px-3 text-left font-medium">Continent</th>
                <th className="py-2.5 px-3 text-right font-medium">Real-Time CPI</th>
                <th className="py-2.5 px-3 text-right font-medium">Official CPI</th>
                <th className="py-2.5 px-3 text-right font-medium">FX Spread</th>
                <th className="py-2.5 px-3 text-right font-medium">Rate / Reserves</th>
                <th className="py-2.5 px-3 text-right font-medium">Debt/GDP · CA</th>
                <th className="py-2.5 px-3 text-right font-medium">Unrest</th>
                <th className="py-2.5 px-4 text-left font-medium">Primary Early-Warning Driver</th>
                <th className="py-2.5 px-4 text-right font-medium">3D Spatial</th>
              </tr>
            </thead>
            <tbody>
              {visibleCountries.map((c) => {
                const rt = c.realTimeCpi + shockLevel * 0.7;
                const unrest = Math.min(98, c.unrestRisk + shockLevel * 3);
                return (
                  <tr
                    key={c.code}
                    className="border-b border-zinc-900/5 dark:border-white/5 last:border-0 hover:bg-zinc-900/[0.03] dark:hover:bg-white/[0.04]"
                  >
                    <td className="py-2.5 px-4 font-semibold text-zinc-950 dark:text-white whitespace-nowrap">
                      <span className="font-mono text-[11px] text-zinc-500 dark:text-zinc-400 mr-2">{c.code}</span>
                      {c.name}
                    </td>
                    <td className="py-2.5 px-3 text-zinc-600 dark:text-zinc-400 whitespace-nowrap">{c.continent}</td>
                    <td className="py-2.5 px-3 text-right font-mono font-semibold text-zinc-950 dark:text-white tabular-nums">
                      {rt.toFixed(1)}%
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-emerald-600 dark:text-emerald-300 tabular-nums">
                      {c.officialCpi.toFixed(1)}%
                    </td>
                    <td
                      className={`py-2.5 px-3 text-right font-mono font-semibold tabular-nums ${
                        c.fxSpreadPct >= 10
                          ? "text-red-600 dark:text-red-300"
                          : "text-zinc-600 dark:text-zinc-300"
                      }`}
                    >
                      {c.fxSpreadPct.toFixed(1)}%
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-zinc-700 dark:text-zinc-300 tabular-nums whitespace-nowrap">
                      {c.policyRatePct.toFixed(1)}% · {c.reserveMonths.toFixed(1)}m
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-zinc-700 dark:text-zinc-300 tabular-nums whitespace-nowrap">
                      <span>{c.debtToGdpPct.toFixed(0)}%</span>
                      <span className="text-zinc-400 mx-1">·</span>
                      <span
                        className={
                          c.currentAccountPct < -4
                            ? "text-red-600 dark:text-red-300"
                            : c.currentAccountPct > 2
                              ? "text-emerald-600 dark:text-emerald-300"
                              : ""
                        }
                      >
                        {c.currentAccountPct > 0 ? `+${c.currentAccountPct.toFixed(1)}` : c.currentAccountPct.toFixed(1)}%
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold tabular-nums">
                      <span
                        className={
                          unrest >= 75
                            ? "text-red-600 dark:text-red-300"
                            : unrest >= 55
                              ? "text-amber-600 dark:text-amber-300"
                              : "text-zinc-700 dark:text-zinc-300"
                        }
                      >
                        {unrest}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-zinc-700 dark:text-zinc-300">{c.primaryDriver}</td>
                    <td className="py-2.5 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => onOpen3DAtlas(c.hotspotId)}
                        className="inline-flex items-center gap-1 rounded-md border border-zinc-900/20 dark:border-white/20 bg-white/70 dark:bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-zinc-900 dark:text-white hover:bg-zinc-900 hover:text-white dark:hover:bg-white dark:hover:text-zinc-950 transition-colors cursor-pointer whitespace-nowrap"
                      >
                        <span>3D Atlas</span>
                        <ArrowUpRight className="w-3 h-3" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Bottom Split: Inflation Chart, Impact Assessment & Upcoming Macro Calendar */}
      <section className="grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] gap-4 items-start">
        <div className="space-y-4">
          <div className="liquid-glass rounded-xl overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-900/10 dark:border-white/10 px-4 py-3">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-zinc-900 dark:text-zinc-100" />
                <h2 className="text-sm font-semibold text-zinc-950 dark:text-white">
                  Real-Time Inflation vs Official CPI
                </h2>
              </div>
              <span
                className={`font-mono text-xs font-semibold ${
                  rawGap > 5 ? "text-red-600 dark:text-red-300" : "text-amber-600 dark:text-amber-300"
                }`}
              >
                Gap +{rawGap.toFixed(1)} pts
              </span>
            </div>
            <InflationLineChart
              theme={theme}
              labels={labels}
              realTimeSeries={realTimeSeries}
              officialSeries={officialSeries}
              realTimeLabel="EconoScope Real-Time Index"
            />
          </div>

          {/* Upcoming CPI & Central Bank Surprise Calendar */}
          <div className="liquid-glass rounded-xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-zinc-900/10 dark:border-white/10 px-4 py-3">
              <div className="flex items-center gap-2">
                <CalendarClock className="w-4 h-4 text-zinc-900 dark:text-zinc-100" />
                <h2 className="text-sm font-semibold text-zinc-950 dark:text-white">
                  Upcoming Macro Releases &amp; CPI Surprise Radar
                </h2>
              </div>
              <span className="text-xs text-zinc-500 dark:text-zinc-400">Next 14 days</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-zinc-900/10 dark:border-white/10 text-zinc-500 dark:text-zinc-400">
                    <th className="py-2 px-4 text-left font-medium">Window</th>
                    <th className="py-2 px-3 text-left font-medium">Country</th>
                    <th className="py-2 px-3 text-left font-medium">Release</th>
                    <th className="py-2 px-3 text-right font-medium">Consensus</th>
                    <th className="py-2 px-3 text-right font-medium">EconoScope</th>
                    <th className="py-2 px-4 text-right font-medium">Surprise</th>
                  </tr>
                </thead>
                <tbody>
                  {MACRO_CALENDAR.map((ev) => (
                    <tr
                      key={ev.id}
                      className="border-b border-zinc-900/5 dark:border-white/5 last:border-0"
                    >
                      <td className="py-2 px-4 font-mono text-zinc-600 dark:text-zinc-400 whitespace-nowrap">
                        {ev.dateLabel}
                      </td>
                      <td className="py-2 px-3 font-semibold text-zinc-950 dark:text-white whitespace-nowrap">
                        {ev.country}
                      </td>
                      <td className="py-2 px-3 text-zinc-700 dark:text-zinc-300">{ev.event}</td>
                      <td className="py-2 px-3 text-right font-mono text-zinc-600 dark:text-zinc-400 tabular-nums">
                        {ev.consensus}
                      </td>
                      <td className="py-2 px-3 text-right font-mono font-semibold text-zinc-950 dark:text-white tabular-nums">
                        {ev.econoscopeForecast}
                      </td>
                      <td className="py-2 px-4 text-right font-mono font-bold text-[10px]">
                        <span
                          className={
                            ev.surpriseRisk === "HIGH"
                              ? "text-red-600 dark:text-red-300"
                              : ev.surpriseRisk === "MEDIUM"
                                ? "text-amber-600 dark:text-amber-300"
                                : "text-emerald-600 dark:text-emerald-300"
                          }
                        >
                          {ev.surpriseRisk}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="liquid-glass rounded-xl overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-900/10 dark:border-white/10 px-4 py-3">
            <div className="flex items-center gap-2">
              <Network className="w-4 h-4 text-zinc-900 dark:text-zinc-100" />
              <h2 className="text-sm font-semibold text-zinc-950 dark:text-white">Impact Assessment Matrix</h2>
            </div>
            <select
              aria-label="Select alert for impact assessment"
              value={activeImpactAlert?.id ?? ""}
              onChange={(e) => onChangeImpactAlert(e.target.value)}
              className="max-w-[230px] rounded-lg border border-zinc-900/15 dark:border-white/15 bg-white/80 dark:bg-zinc-900/80 px-2.5 py-1 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-zinc-900 dark:focus:border-white"
            >
              {regionalAlerts.slice(0, 10).map((a) => (
                <option key={a.id} value={a.id}>
                  {a.title.slice(0, 48)}
                </option>
              ))}
            </select>
          </div>

          {activeImpactAlert ? (
            <div className="p-4 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {["1st Order · Now", "2nd Order · +3–6 wks", "3rd Order · +6–12 wks"].map((heading, orderIdx) => (
                  <div
                    key={heading}
                    className="rounded-lg border border-zinc-900/10 dark:border-white/10 bg-white/55 dark:bg-zinc-950/45 p-2.5 space-y-2"
                  >
                    <div className="text-[11px] font-semibold text-zinc-900 dark:text-zinc-100">{heading}</div>
                    {activeImpactAlert.impactMatrix[orderIdx].map((node) => (
                      <div
                        key={node.label}
                        className="rounded-md bg-zinc-200/70 dark:bg-zinc-900/75 p-2 text-xs text-zinc-900 dark:text-zinc-100"
                      >
                        <div className="leading-snug">{node.label}</div>
                        <div className="mt-1.5 h-1 rounded-full bg-zinc-300 dark:bg-zinc-800 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-zinc-700 to-red-500 dark:from-zinc-200 dark:to-red-400"
                            style={{ width: `${node.likelihood}%` }}
                          />
                        </div>
                        <div className="mt-1 font-mono text-[10px] text-zinc-500 dark:text-zinc-400 tabular-nums">
                          {node.likelihood}% likelihood
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => onSelectAlert(activeImpactAlert.id)}
                className="inline-flex items-center gap-2 rounded-lg bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 px-3.5 py-2 text-xs font-semibold hover:opacity-90 transition-opacity cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Open Full AI Explanation &amp; Actions</span>
              </button>
            </div>
          ) : (
            <p className="p-4 text-sm text-zinc-500 dark:text-zinc-400">No alert selected.</p>
          )}
        </div>
      </section>
    </div>
  );
}
