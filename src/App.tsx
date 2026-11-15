import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import {
  BASE_ALERTS,
  BASE_SIGNALS,
  INITIAL_PLUGINS,
  INITIAL_TICKERS,
  REGIONS,
  SHOCK_ALERTS,
} from "./data/econoscopeData";
import type {
  EcoMessage,
  EconomicAlert,
  HeatmapMode,
  PlanTier,
  PluginConnector,
  RegionKey,
  RiskHotspot,
  SignalItem,
  TabView,
  ThemeMode,
  TickerQuote,
  TimeframeKey,
  WorldBankRecord,
} from "./types/econoscope";
import { TopNavBar } from "./components/TopNavBar";
import { WorkspaceToolbar } from "./components/WorkspaceToolbar";
import { CommandCenterView } from "./components/CommandCenterView";
import { Atlas3DView } from "./components/Atlas3DView";
import { InflationView } from "./components/InflationView";
import { SupplyRadarView } from "./components/SupplyRadarView";
import { PluginLabView } from "./components/PluginLabView";
import { EcoAiView } from "./components/EcoAiView";
import { PricingView } from "./components/PricingView";
import { ExplainabilityDrawer } from "./components/ExplainabilityDrawer";
import { JudgeTourModal } from "./components/JudgeTourModal";

interface ToastItem {
  id: number;
  message: string;
  tone: "info" | "warn" | "crit";
}

const FREE_ECO_QUERY_LIMIT = 8;

const INITIAL_ECO_MESSAGES: EcoMessage[] = [
  {
    id: "eco-welcome",
    role: "eco",
    text: "Hello, I am ECO — EconoScope's Macro-Economic Intelligence AI. Ask me about live market briefs, inflation divergence, food & fertilizer shortages, maritime chokepoints, or any of the 108 monitored economies across all 6 continents.",
  },
];

export default function App() {
  const [theme, setTheme] = useState<ThemeMode>("dark");
  const [planTier, setPlanTier] = useState<PlanTier>("free");
  const [ecoQueriesUsed, setEcoQueriesUsed] = useState<number>(0);
  const [ecoMessages, setEcoMessages] = useState<EcoMessage[]>(INITIAL_ECO_MESSAGES);
  const [ecoSeedQuery, setEcoSeedQuery] = useState<string | null>(null);

  const [activeView, setActiveView] = useState<TabView>("command");
  const [region, setRegion] = useState<RegionKey>("global");
  const [timeframe, setTimeframe] = useState<TimeframeKey>("7D");
  const [shockLevel, setShockLevel] = useState<number>(0);

  const [heatmapMode, setHeatmapMode] = useState<HeatmapMode>("combined");
  const [showRiskNodes, setShowRiskNodes] = useState(true);
  const [showChokepoints, setShowChokepoints] = useState(true);
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [showTradeArcs, setShowTradeArcs] = useState(true);

  const [focusedHotspotId, setFocusedHotspotId] = useState<string | null>("h1");
  const [extraHotspots, setExtraHotspots] = useState<RiskHotspot[]>([]);

  const [impactAlertId, setImpactAlertId] = useState<string | null>(null);
  const [selectedAlertId, setSelectedAlertId] = useState<string | null>(null);
  const [judgeTourOpen, setJudgeTourOpen] = useState(false);

  const [customAlerts, setCustomAlerts] = useState<EconomicAlert[]>([]);
  const [signals, setSignals] = useState<SignalItem[]>(BASE_SIGNALS);
  const [plugins, setPlugins] = useState<PluginConnector[]>(INITIAL_PLUGINS);
  const [worldBankRecords, setWorldBankRecords] = useState<WorldBankRecord[]>([]);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  const [tickers, setTickers] = useState<TickerQuote[]>(INITIAL_TICKERS);
  const [utcClock, setUtcClock] = useState(() => `${new Date().toISOString().slice(11, 19)} UTC`);
  const [signalRate, setSignalRate] = useState(REGIONS.global.signalRate);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const shockTimerRef = useRef<number | null>(null);

  // Sync Tailwind v4 .dark class on <html>
  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") root.classList.add("dark");
    else root.classList.remove("dark");
  }, [theme]);

  const pushToast = useCallback((message: string, tone: ToastItem["tone"] = "info") => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setToasts((prev) => [...prev.slice(-3), { id, message, tone }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4400);
  }, []);

  const allAlerts = useMemo(
    () => [...customAlerts, ...SHOCK_ALERTS.slice(0, shockLevel).reverse(), ...BASE_ALERTS],
    [customAlerts, shockLevel]
  );

  const selectedAlert = useMemo(
    () => (selectedAlertId ? allAlerts.find((a) => a.id === selectedAlertId) ?? null : null),
    [allAlerts, selectedAlertId]
  );

  // Live ticker & UTC clock cadence
  useEffect(() => {
    const tickerInterval = window.setInterval(() => {
      setTickers((prev) =>
        prev.map((t) => {
          const chg = (Math.random() - 0.49) * 0.004;
          return {
            ...t,
            value: t.value * (1 + chg),
            deltaPct: t.deltaPct + chg * 100,
          };
        })
      );
    }, 1800);

    const clockInterval = window.setInterval(() => {
      setUtcClock(`${new Date().toISOString().slice(11, 19)} UTC`);
      const base = REGIONS[region].signalRate * (1 + shockLevel * 0.07);
      setSignalRate(Math.round(base + (Math.random() - 0.5) * base * 0.02));
    }, 1000);

    return () => {
      window.clearInterval(tickerInterval);
      window.clearInterval(clockInterval);
    };
  }, [region, shockLevel]);

  // Escape closes drawers and modals
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSelectedAlertId(null);
        setJudgeTourOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // Hybrid Live Public API Sync
  const syncLivePlugins = useCallback(
    async (silent = false) => {
      setIsSyncing(true);
      try {
        const resp = await fetch("/api/plugins/sync");
        if (!resp.ok) throw new Error(`Plugin sync failed (${resp.status})`);
        const data = (await resp.json()) as {
          syncedAt: string;
          worldBank?: { live: boolean; records: WorldBankRecord[] };
          gdelt?: { live: boolean; signals: SignalItem[] };
          foodWire?: { live: boolean; signals: SignalItem[] };
          liveSignals?: SignalItem[];
        };

        setLastSyncedAt(data.syncedAt);
        if (data.worldBank?.records?.length) {
          setWorldBankRecords(data.worldBank.records);
        }

        const incoming = data.liveSignals ?? [];
        if (incoming.length > 0) {
          setSignals((prev) => {
            const existingIds = new Set(prev.map((s) => s.id));
            const novel = incoming.filter((s) => !existingIds.has(s.id));
            return [...novel, ...prev].slice(0, 48);
          });
        }

        setPlugins((prev) =>
          prev.map((p) => {
            if (p.id === "worldbank") {
              return {
                ...p,
                status: data.worldBank?.live ? "Connected" : "Fallback",
                lastSynced: data.worldBank?.live ? "Live API synced" : "Cached baseline",
              };
            }
            if (p.id === "gdelt") {
              return {
                ...p,
                status: data.gdelt?.live ? "Connected" : "Fallback",
                signalsCount: p.signalsCount + (data.gdelt?.signals?.length ?? 0),
                lastSynced: data.gdelt?.live ? "Live GDELT stream" : "Cached baseline",
              };
            }
            if (p.id === "fao") {
              return {
                ...p,
                status: data.foodWire?.live ? "Connected" : "Fallback",
                signalsCount: p.signalsCount + (data.foodWire?.signals?.length ?? 0),
                lastSynced: data.foodWire?.live ? "Live wire synced" : "Cached baseline",
              };
            }
            return p;
          })
        );

        if (!silent) {
          pushToast(
            `Synced live plugins (${data.worldBank?.records?.length ?? 0} World Bank CPI prints, ${incoming.length} live signals).`,
            "info"
          );
        }
      } catch {
        if (!silent) {
          pushToast("Upstream APIs throttled; deterministic fallback active.", "warn");
        }
      } finally {
        setIsSyncing(false);
      }
    },
    [pushToast]
  );

  useEffect(() => {
    void syncLivePlugins(true);
  }, [syncLivePlugins]);

  const handleToggleShock = useCallback(() => {
    if (shockTimerRef.current) {
      window.clearTimeout(shockTimerRef.current);
      shockTimerRef.current = null;
    }

    if (shockLevel >= 4) {
      setShockLevel(0);
      pushToast("Crisis simulation reset to baseline.", "info");
      return;
    }

    if (shockLevel === 0) {
      pushToast("Crisis shock injected. Tracking multi-order cascade...", "warn");
      const advance = (next: number) => {
        setShockLevel(next);
        const alert = SHOCK_ALERTS[next - 1];
        if (alert) {
          pushToast(`${alert.severity}: ${alert.title.replace("Shock Cascade: ", "")}`, "crit");
        }
        if (next < 4) {
          shockTimerRef.current = window.setTimeout(() => advance(next + 1), 1500);
        } else {
          shockTimerRef.current = null;
        }
      };
      advance(1);
    }
  }, [pushToast, shockLevel]);

  useEffect(() => {
    return () => {
      if (shockTimerRef.current) window.clearTimeout(shockTimerRef.current);
    };
  }, []);

  // Custom URL / Topic Plugin Ingestion
  const handleIngestCustomSource = async (urlOrTopic: string) => {
    const resp = await fetch("/api/plugins/ingest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ urlOrTopic, region }),
    });
    const data = (await resp.json()) as {
      title?: string;
      summary?: string;
      severity?: EconomicAlert["severity"];
      category?: EconomicAlert["category"];
      regionKey?: RegionKey;
      leadDays?: number;
      confidence?: number;
      entities?: Array<[string, string]>;
      causalChain?: string[];
      actions?: string[];
      citations?: Array<{ title: string; uri: string }>;
      error?: string;
    };

    if (!resp.ok || data.error) {
      throw new Error(data.error || "Failed to ingest source.");
    }

    const newAlertId = `live-${Date.now()}`;
    const targetReg: RegionKey = data.regionKey && REGIONS[data.regionKey] ? data.regionKey : region;
    const conf = typeof data.confidence === "number" ? data.confidence : 84.5;
    const newAlert: EconomicAlert = {
      id: newAlertId,
      severity: data.severity ?? "ELEVATED",
      regions: targetReg === "global" ? ["global"] : ["global", targetReg],
      category: data.category ?? "Inflation",
      title: data.title ?? `Live Signal: ${urlOrTopic.slice(0, 56)}`,
      leadDays: typeof data.leadDays === "number" ? data.leadDays : 14,
      confidence: conf,
      sourceCounts: [1, 4, 850],
      why: data.summary ?? "Live signal synthesized via ECO Search and URL grounding.",
      causalChain:
        data.causalChain && data.causalChain.length > 0
          ? data.causalChain
          : ["External report ingested", "Commodity pass-through detected", "Early warning raised"],
      impactMatrix: [
        [
          { label: "Immediate price repricing", likelihood: Math.round(conf - 4) },
          { label: "Importer margin squeeze", likelihood: Math.round(conf - 10) },
        ],
        [
          { label: "Retail food pass-through", likelihood: Math.round(conf - 18) },
          { label: "Inventory cover tightening", likelihood: Math.round(conf - 24) },
        ],
        [
          { label: "CPI print surprise", likelihood: Math.round(conf - 30) },
          { label: "Policy intervention trigger", likelihood: Math.round(conf - 36) },
        ],
      ],
      analog: {
        year: 2022,
        title: "Supply & inflation pass-through",
        result: "Spot repricing preceded official CPI print by 3–5 weeks",
        similarity: 76,
      },
      citations: (data.citations ?? []).map((c) => ["ECO Web", c.title, c.uri]),
      actions:
        data.actions && data.actions.length >= 4
          ? data.actions
          : [
              "Monitor regional spot quotes daily",
              "Review strategic reserve thresholds",
              "Lock near-term forward supply hedges",
              "Diversify import routing",
            ],
      isLive: true,
    };

    const newSignal: SignalItem = {
      id: Date.now(),
      src: "ECO Web",
      minutesAgo: 0,
      regions: newAlert.regions,
      text: `${newAlert.title} — ${newAlert.why}`,
      url: data.citations?.[0]?.uri,
      entities: data.entities ?? [
        ["LOC", REGIONS[targetReg].name],
        ["EVENT", "Live Ingestion"],
      ],
      alertId: newAlertId,
      fresh: true,
      isLive: true,
    };

    setCustomAlerts((prev) => [newAlert, ...prev]);
    setSignals((prev) => [newSignal, ...prev]);
    pushToast(`Live signal extracted: ${newAlert.title}`, "info");
    setSelectedAlertId(newAlertId);
  };

  // AI Crisis Scenario Generator
  const handleGenerateScenario = async (scenarioPrompt: string) => {
    const resp = await fetch("/api/ai/scenario", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scenarioPrompt, region }),
    });
    const data = (await resp.json()) as {
      title?: string;
      summary?: string;
      severity?: "CRITICAL" | "ELEVATED";
      category?: EconomicAlert["category"];
      regionKey?: RegionKey;
      leadDays?: number;
      confidence?: number;
      epicenter?: {
        name?: string;
        lat?: number;
        lon?: number;
        geopoliticalWeight?: number;
        economicWeight?: number;
      };
      causalChain?: string[];
      impactNodes?: string[];
      actions?: string[];
      citations?: Array<{ title: string; uri: string }>;
      error?: string;
    };

    if (!resp.ok || data.error) {
      throw new Error(data.error || "Failed to generate crisis scenario.");
    }

    const newAlertId = `scen-${Date.now()}`;
    const targetReg: RegionKey = data.regionKey && REGIONS[data.regionKey] ? data.regionKey : region;
    const conf = typeof data.confidence === "number" ? data.confidence : 89.2;
    const nodes =
      data.impactNodes && data.impactNodes.length >= 6
        ? data.impactNodes
        : [
            "Spot commodity repricing",
            "War-risk insurance jump",
            "Freight & basis widening",
            "Importer margin squeeze",
            "Retail staple CPI spike",
            "Reserve drawdown pressure",
          ];

    const newAlert: EconomicAlert = {
      id: newAlertId,
      severity: data.severity ?? "CRITICAL",
      regions: targetReg === "global" ? ["global"] : ["global", targetReg],
      category: data.category ?? "Supply chain",
      title: data.title ?? `Scenario: ${scenarioPrompt.slice(0, 56)}`,
      leadDays: typeof data.leadDays === "number" ? data.leadDays : 10,
      confidence: conf,
      sourceCounts: [2, 8, 2400],
      why: data.summary ?? "Simulated multi-order macro contagion scenario.",
      causalChain:
        data.causalChain && data.causalChain.length > 0
          ? data.causalChain
          : ["Shock trigger", "Logistics squeeze", "Input price surge", "CPI spillover"],
      impactMatrix: [
        [
          { label: nodes[0], likelihood: Math.round(conf - 3) },
          { label: nodes[1], likelihood: Math.round(conf - 7) },
        ],
        [
          { label: nodes[2], likelihood: Math.round(conf - 15) },
          { label: nodes[3], likelihood: Math.round(conf - 21) },
        ],
        [
          { label: nodes[4], likelihood: Math.round(conf - 29) },
          { label: nodes[5], likelihood: Math.round(conf - 35) },
        ],
      ],
      analog: {
        year: 2022,
        title: "Supply-corridor shock cascade",
        result: "Rapid freight and staple repricing across net importers",
        similarity: 82,
      },
      citations: (data.citations ?? []).map((c) => ["ECO Web", c.title, c.uri]),
      actions:
        data.actions && data.actions.length >= 4
          ? data.actions
          : [
              "Activate strategic reserve buffer",
              "Pre-book alternate shipping corridors",
              "Hedge staple and diesel exposure",
              "Issue weekly supply transparency brief",
            ],
      isShock: true,
      isLive: true,
    };

    const hotspotId = `h-scen-${Date.now()}`;
    const scenarioContinent =
      targetReg === "eafrica" || targetReg === "mena"
        ? "Africa"
        : targetReg === "eurozone"
          ? "Europe"
          : targetReg === "americas"
            ? "North America"
            : "Asia";
    const newHotspot: RiskHotspot = {
      id: hotspotId,
      name: data.epicenter?.name || "Scenario Epicenter",
      country: "Simulated Shock",
      continent: scenarioContinent,
      category: "Geopolitical",
      lat: typeof data.epicenter?.lat === "number" ? data.epicenter.lat : 15,
      lon: typeof data.epicenter?.lon === "number" ? data.epicenter.lon : 42,
      regions: targetReg === "global" ? ["global"] : [targetReg],
      alertId: newAlertId,
      geopoliticalWeight:
        typeof data.epicenter?.geopoliticalWeight === "number" ? data.epicenter.geopoliticalWeight : 0.92,
      economicWeight:
        typeof data.epicenter?.economicWeight === "number" ? data.epicenter.economicWeight : 0.9,
      foodInflationPct: 24.5,
      fxSpreadPct: 9.2,
      portDelayDays: 7.4,
      socialSpike: "5.8x",
      summary: newAlert.why,
    };

    setCustomAlerts((prev) => [newAlert, ...prev]);
    setExtraHotspots((prev) => [newHotspot, ...prev]);
    setFocusedHotspotId(hotspotId);
    setActiveView("atlas");
    pushToast(`Scenario mapped in 3D Atlas: ${newHotspot.name}`, "crit");
  };

  const handleToggleLayer = (layer: "risk" | "choke" | "heat" | "arcs") => {
    if (layer === "risk") setShowRiskNodes((v) => !v);
    if (layer === "choke") setShowChokepoints((v) => !v);
    if (layer === "heat") setShowHeatmap((v) => !v);
    if (layer === "arcs") setShowTradeArcs((v) => !v);
  };

  const handleTogglePlugin = (pluginId: string) => {
    setPlugins((prev) => prev.map((p) => (p.id === pluginId ? { ...p, enabled: !p.enabled } : p)));
  };

  const handleOpen3DAtlas = (hotspotId?: string) => {
    if (hotspotId) {
      setFocusedHotspotId(hotspotId);
      setRegion("global");
    }
    setActiveView("atlas");
  };

  const handleJudgeStep = (
    view: TabView,
    targetRegion?: RegionKey,
    triggerShock?: boolean,
    openAlertId?: string
  ) => {
    setActiveView(view);
    if (targetRegion) setRegion(targetRegion);
    if (triggerShock && shockLevel === 0) handleToggleShock();
    if (openAlertId) setSelectedAlertId(openAlertId);
  };

  const handleSelectPlan = (tier: PlanTier) => {
    setPlanTier(tier);
    pushToast(
      tier === "pro"
        ? "Activated EconoScope Pro Tier ($10/mo) — Unlimited ECO AI unlocked."
        : "Switched to EconoScope Free Tier ($0/mo).",
      "info"
    );
  };

  const telemetrySummary = `Real-Time Inflation: ${(REGIONS[region].realTimeInflation + shockLevel * 0.8).toFixed(1)}%, Official CPI: ${REGIONS[region].officialCpi.toFixed(1)}%, Shortage Probability: ${Math.min(97, REGIONS[region].shortageProbability + shockLevel * 4)}%, Active Alerts: ${allAlerts.filter((a) => a.regions.includes(region)).length}`;

  return (
    <MotionConfig reducedMotion="user">
      <div className="min-h-screen flex flex-col text-zinc-950 dark:text-zinc-100">
        <TopNavBar
          activeView={activeView}
          onSelectView={setActiveView}
          onOpenJudgeTour={() => setJudgeTourOpen(true)}
        />

        <WorkspaceToolbar
          theme={theme}
          region={region}
          timeframe={timeframe}
          shockLevel={shockLevel}
          alerts={allAlerts}
          tickers={tickers}
          signalRate={signalRate}
          utcClock={utcClock}
          onToggleTheme={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
          onSelectRegion={setRegion}
          onSelectTimeframe={setTimeframe}
          onToggleShock={handleToggleShock}
          onOpenEco={() => setActiveView("eco")}
        />

        <main className="mx-auto w-full max-w-[1480px] flex-1 px-4 sm:px-6 py-4 pb-12">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeView}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            >
              {activeView === "command" && (
                <CommandCenterView
                  theme={theme}
                  region={region}
                  timeframe={timeframe}
                  shockLevel={shockLevel}
                  alerts={allAlerts}
                  extraHotspots={extraHotspots}
                  heatmapMode={heatmapMode}
                  showRiskNodes={showRiskNodes}
                  showChokepoints={showChokepoints}
                  showHeatmap={showHeatmap}
                  impactAlertId={impactAlertId}
                  onChangeHeatmapMode={setHeatmapMode}
                  onToggleLayer={handleToggleLayer}
                  onSelectAlert={setSelectedAlertId}
                  onChangeImpactAlert={setImpactAlertId}
                  onOpen3DAtlas={handleOpen3DAtlas}
                  onAskEco={(prompt) => {
                    setEcoSeedQuery(prompt);
                    setActiveView("eco");
                  }}
                />
              )}

              {activeView === "atlas" && (
                <Atlas3DView
                  theme={theme}
                  region={region}
                  heatmapMode={heatmapMode}
                  showRiskNodes={showRiskNodes}
                  showChokepoints={showChokepoints}
                  showHeatmap={showHeatmap}
                  showTradeArcs={showTradeArcs}
                  shockLevel={shockLevel}
                  alerts={allAlerts}
                  extraHotspots={extraHotspots}
                  focusedHotspotId={focusedHotspotId}
                  onChangeHeatmapMode={setHeatmapMode}
                  onToggleLayer={handleToggleLayer}
                  onFocusHotspot={setFocusedHotspotId}
                  onSelectAlert={setSelectedAlertId}
                  onAskEcoForLocation={(hs) => {
                    setEcoSeedQuery(
                      `Analyze economic, food inflation (+${hs.foodInflationPct}%), FX spread (${hs.fxSpreadPct}%), and logistics delay (${hs.portDelayDays}d) risks centered on ${hs.name}, ${hs.country}.`
                    );
                    setActiveView("eco");
                  }}
                />
              )}

              {activeView === "inflation" && (
                <InflationView
                  theme={theme}
                  region={region}
                  timeframe={timeframe}
                  shockLevel={shockLevel}
                />
              )}

              {activeView === "supply" && (
                <SupplyRadarView theme={theme} region={region} shockLevel={shockLevel} />
              )}

              {activeView === "plugins" && (
                <PluginLabView
                  region={region}
                  signals={signals}
                  alerts={allAlerts}
                  plugins={plugins}
                  worldBankRecords={worldBankRecords}
                  lastSyncedAt={lastSyncedAt}
                  isSyncing={isSyncing}
                  onSyncPlugins={() => void syncLivePlugins(false)}
                  onTogglePlugin={handleTogglePlugin}
                  onIngestCustomSource={handleIngestCustomSource}
                  onGenerateScenario={handleGenerateScenario}
                  onOpenAlert={setSelectedAlertId}
                />
              )}

              {activeView === "eco" && (
                <EcoAiView
                  region={region}
                  timeframe={timeframe}
                  shockLevel={shockLevel}
                  telemetrySummary={telemetrySummary}
                  planTier={planTier}
                  queriesUsed={ecoQueriesUsed}
                  freeQueryLimit={FREE_ECO_QUERY_LIMIT}
                  messages={ecoMessages}
                  seedQuery={ecoSeedQuery}
                  onConsumeSeedQuery={() => setEcoSeedQuery(null)}
                  onAppendMessage={(msg) => setEcoMessages((prev) => [...prev, msg])}
                  onClearMessages={() => setEcoMessages(INITIAL_ECO_MESSAGES)}
                  onIncrementQueryCount={() => setEcoQueriesUsed((c) => c + 1)}
                  onNavigateView={setActiveView}
                />
              )}

              {activeView === "pricing" && (
                <PricingView
                  planTier={planTier}
                  onSelectPlan={handleSelectPlan}
                  onNavigateView={setActiveView}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </main>

        <ExplainabilityDrawer
          theme={theme}
          alert={selectedAlert}
          onClose={() => setSelectedAlertId(null)}
          onShowInImpactMatrix={(id) => {
            setImpactAlertId(id);
            setActiveView("command");
            const target = allAlerts.find((a) => a.id === id);
            if (target && !target.regions.includes(region)) setRegion("global");
            setSelectedAlertId(null);
          }}
          onCopySuccess={(msg) => pushToast(msg, "info")}
        />

        <JudgeTourModal
          open={judgeTourOpen}
          onClose={() => setJudgeTourOpen(false)}
          onNavigateStep={handleJudgeStep}
        />

        {/* Toast Notifications */}
        <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm" aria-live="polite">
          {toasts.map((t) => (
            <div
              key={t.id}
              className={`liquid-glass-elevated rounded-xl px-4 py-2.5 text-xs font-medium shadow-xl ${
                t.tone === "crit"
                  ? "border-red-500/50 text-red-700 dark:text-red-100"
                  : t.tone === "warn"
                    ? "border-amber-500/50 text-amber-800 dark:text-amber-100"
                    : "border-zinc-900/20 dark:border-white/25 text-zinc-950 dark:text-zinc-100"
              }`}
            >
              {t.message}
            </div>
          ))}
        </div>
      </div>
    </MotionConfig>
  );
}
