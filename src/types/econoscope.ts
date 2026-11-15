export type RegionKey = "global" | "eafrica" | "mena" | "eurozone" | "seasia" | "americas";
export type Continent =
  | "Africa"
  | "Europe"
  | "Asia"
  | "North America"
  | "South America"
  | "Oceania";
export type TimeframeKey = "24H" | "7D" | "30D" | "90D";
export type Severity = "CRITICAL" | "ELEVATED" | "WATCH";
export type AlertCategory = "Inflation" | "Shortage" | "Supply chain";
export type TabView = "command" | "atlas" | "inflation" | "supply" | "plugins" | "eco" | "pricing";
export type MapMode = "3d" | "2d";
export type HeatmapMode = "combined" | "geopolitical" | "inflation" | "food" | "maritime";
export type ThemeMode = "dark" | "light";
export type PlanTier = "free" | "pro";

export type SignalSource =
  | "Forbes"
  | "World Bank"
  | "FAO"
  | "X/Social Velocity"
  | "GDELT"
  | "Spot Markets"
  | "ECO Web";

export interface RegionConfig {
  name: string;
  realTimeInflation: number;
  officialCpi: number;
  shortageProbability: number;
  signalRate: number;
  threat: Severity;
  box: [number, number, number, number];
  focusLatLon: [number, number];
}

export interface ImpactNode {
  label: string;
  likelihood: number;
}

export interface HistoricalAnalog {
  year: number;
  title: string;
  result: string;
  similarity: number;
}

export interface EconomicAlert {
  id: string;
  severity: Severity;
  regions: RegionKey[];
  category: AlertCategory;
  title: string;
  leadDays: number;
  confidence: number;
  sourceCounts: [number, number, number]; // [official, news, social]
  why: string;
  causalChain: string[];
  impactMatrix: [ImpactNode[], ImpactNode[], ImpactNode[]];
  analog: HistoricalAnalog;
  citations: Array<[SignalSource, string, string?]>;
  actions: string[];
  isShock?: boolean;
  isLive?: boolean;
}

export interface RiskHotspot {
  id: string;
  name: string;
  country: string;
  continent: Continent;
  category: "Chokepoint" | "Food & Ag" | "Energy & FX" | "Trade Hub" | "Geopolitical";
  lon: number;
  lat: number;
  regions: RegionKey[];
  alertId: string;
  geopoliticalWeight: number; // 0..1
  economicWeight: number; // 0..1
  foodInflationPct: number;
  fxSpreadPct: number;
  portDelayDays: number;
  socialSpike: string;
  summary: string;
}

export interface TradeArc {
  id: string;
  name: string;
  commodity: string;
  from: [number, number]; // [lat, lon]
  to: [number, number];
  status: "NORMAL" | "CONGESTED" | "DISRUPTED";
  regions: RegionKey[];
}

export interface BasketItem {
  id: "energy" | "grains" | "fert" | "freight" | "staples";
  name: string;
  realTime: number;
  official: number;
  weight: number;
  components: Array<[string, string, number]>;
}

export interface Chokepoint {
  name: string;
  lon: number;
  lat: number;
  regions: RegionKey[];
  status: "OPEN" | "CONGESTED" | "DISRUPTED";
  delayDays: number;
  flowPct: number;
  riskScore: number;
  vesselsWaiting: number;
  note: string;
}

export interface CommodityRadar {
  name: string;
  stockToUse: number;
  daysCover: number;
  probability: number;
  regions: RegionKey[];
}

export interface PortMetric {
  name: string;
  country: string;
  avgWaitDays: number;
  vesselsQueue: number;
  vs30DayPct: number;
  regions: RegionKey[];
}

export interface SignalItem {
  id: number;
  src: SignalSource;
  minutesAgo: number;
  regions: RegionKey[];
  text: string;
  url?: string;
  entities: Array<[string, string]>;
  alertId: string;
  fresh?: boolean;
  isLive?: boolean;
}

export interface TickerQuote {
  name: string;
  value: number;
  deltaPct: number;
}

export interface PluginConnector {
  id: string;
  name: string;
  inspiredBy: string;
  category: string;
  endpointLabel: string;
  mode: "LIVE_API" | "ECO_GROUNDED" | "STREAM_SYNTHESIS";
  status: "Connected" | "Syncing" | "Fallback";
  enabled: boolean;
  signalsCount: number;
  lastSynced: string;
  description: string;
}

export interface WorldBankRecord {
  countryCode: string;
  country: string;
  year: string;
  cpiAnnualPct: number;
}

export interface GroundedCitation {
  title: string;
  uri: string;
}

export interface AnalystMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations?: GroundedCitation[];
  timestamp: string;
}

export interface EcoMessage {
  id: string;
  role: "user" | "eco";
  text: string;
  citations?: GroundedCitation[];
  error?: boolean;
}

export interface BenchmarkPlatform {
  platform: string;
  strength: string;
  blindSpot: string;
  econoscopeSynthesis: string;
}

export interface CountryRiskProfile {
  code: string;
  name: string;
  continent: Continent;
  region: RegionKey;
  realTimeCpi: number;
  officialCpi: number;
  fxSpreadPct: number;
  importDependencyPct: number;
  unrestRisk: number;
  policyRatePct: number;
  reserveMonths: number;
  debtToGdpPct: number;
  currentAccountPct: number;
  primaryDriver: string;
  hotspotId: string;
}

export interface LocalMarketQuote {
  market: string;
  city: string;
  country: string;
  region: RegionKey;
  staple: string;
  localPrice: string;
  change14dPct: number;
}

export interface MacroCalendarEvent {
  id: string;
  dateLabel: string;
  country: string;
  continent: Continent;
  event: string;
  consensus: string;
  econoscopeForecast: string;
  surpriseRisk: "HIGH" | "MEDIUM" | "LOW";
}

export type MarketBriefSentiment = "BULLISH" | "BEARISH" | "NEUTRAL" | "VOLATILE";
export type MarketBriefCategory =
  | "Inflation"
  | "Central Banks"
  | "Commodities"
  | "Supply Chain"
  | "FX & Sovereign";

export interface MarketBriefItem {
  id: string;
  title: string;
  source: string;
  url: string;
  publishedAt: string;
  minutesAgo: number;
  sentiment: MarketBriefSentiment;
  sentimentScore: number;
  category: MarketBriefCategory;
  region: RegionKey;
  isLive: boolean;
}

export interface MarketBriefsResponse {
  updatedAt: string;
  liveCount: number;
  sentimentIndex: number;
  sentimentLabel: "RISK-OFF" | "CAUTIOUS" | "BALANCED" | "RISK-ON";
  breakdown: {
    bearish: number;
    neutral: number;
    bullish: number;
  };
  items: MarketBriefItem[];
}
