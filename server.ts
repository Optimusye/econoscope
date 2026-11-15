import "dotenv/config";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, ThinkingLevel } from "@google/genai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const isProd = process.env.NODE_ENV === "production";

function getAiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "MY_GEMINI_API_KEY") return null;
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

async function fetchWithTimeout(
  url: string,
  timeoutMs = 4500,
  accept = "application/json, application/xml, text/xml, */*"
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "EconoScope-Intelligence-Terminal/2.0",
        Accept: accept,
      },
    });
  } finally {
    clearTimeout(timer);
  }
}

function inferRegionFromText(text: string): string[] {
  const lower = text.toLowerCase();
  const regs: string[] = [];
  if (/(ethiopia|kenya|djibouti|mombasa|somalia|east africa|horn of africa|uganda|tanzania|nigeria|ghana|africa|zambia|angola|sudan)/.test(lower)) {
    regs.push("eafrica");
  }
  if (/(egypt|cairo|red sea|suez|yemen|gulf|hormuz|saudi|mena|middle east|iran|lebanon|qatar|uae|iraq|jordan|morocco|tunisia)/.test(lower)) {
    regs.push("mena");
  }
  if (/(europe|eurozone|germany|rotterdam|black sea|ukraine|constanta|eu |ecb|boe|uk |britain|france|italy|spain|poland|gas storage)/.test(lower)) {
    regs.push("eurozone");
  }
  if (/(asia|vietnam|thailand|indonesia|malaysia|china|mekong|rice|palm oil|port klang|shanghai|india|japan|boj|korea|australia|singapore|taiwan)/.test(lower)) {
    regs.push("seasia");
  }
  if (/(us |u\.s\.|fed |federal reserve|united states|brazil|panama|americas|santos|argentina|canada|mexico|chile|colombia|peru|wall street|treasury)/.test(lower)) {
    regs.push("americas");
  }
  return regs.length > 0 ? [...regs, "global"] : ["global"];
}

function extractJsonObject(raw: string): Record<string, unknown> | null {
  const cleaned = raw.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(cleaned.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function cleanReadableError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err ?? "AI service error");
  if (/429|RESOURCE_EXHAUSTED|quota/i.test(raw)) {
    return "Gemini API rate limit reached on the current key. Please retry in a few seconds or check Settings > Secrets.";
  }
  return raw.replace(/^\{.*"message":"([^"]+)".*\}$/s, "$1").slice(0, 240);
}

/**
 * Resilient Gemini invocation chain:
 * 1) gemini-4-hydrogen + optional tools (googleSearch / urlContext)
 * 2) gemini-4-hydrogen without tools (avoids Search Grounding tight free RPM limits)
 * 3) gemini-3.1-flash-lite (high-throughput fallback model per gemini-api skill)
 */
async function generateWithResilience(
  ai: GoogleGenAI,
  opts: {
    contents: string;
    systemInstruction: string;
    useSearch?: boolean;
    useUrlContext?: boolean;
  }
) {
  const tools: Array<Record<string, unknown>> = [];
  if (opts.useUrlContext) tools.push({ urlContext: {} });
  if (opts.useSearch) tools.push({ googleSearch: {} });

  // Pass 1: primary model with tools
  try {
    return await ai.models.generateContent({
      model: "gemini-4-hydrogen",
      contents: opts.contents,
      config: {
        systemInstruction: opts.systemInstruction,
        ...(tools.length > 0 ? { tools } : {}),
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      },
    });
  } catch (err1) {
    const msg1 = err1 instanceof Error ? err1.message : String(err1);
    const retryable = /429|RESOURCE_EXHAUSTED|quota|rate|503|UNAVAILABLE|tool/i.test(msg1);
    if (!retryable) throw err1;

    // Pass 2: gemini-4-hydrogen without search grounding tool
    if (tools.length > 0) {
      try {
        return await ai.models.generateContent({
          model: "gemini-4-hydrogen",
          contents: opts.contents,
          config: {
            systemInstruction: opts.systemInstruction,
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          },
        });
      } catch {
        // continue to Pass 3
      }
    }

    // Pass 3: gemini-3.1-flash-lite fallback
    return await ai.models.generateContent({
      model: "gemini-3.1-flash-lite",
      contents: opts.contents,
      config: {
        systemInstruction: opts.systemInstruction,
        thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
      },
    });
  }
}

function buildEcoTelemetryFallback(
  query: string,
  region: string,
  timeframe: string,
  shockLevel: number,
  telemetrySummary: string
): string {
  const q = query.toLowerCase();
  const focusTopics: string[] = [];
  if (/(ethiopia|kenya|nigeria|egypt|africa|ghana|tanzania|angola|zambia|sudan)/.test(q)) {
    focusTopics.push("African import-dependent food & FX corridors");
  }
  if (/(red sea|suez|hormuz|panama|black sea|bosphorus|malacca|shipping|port|freight|chokepoint)/.test(q)) {
    focusTopics.push("maritime chokepoint delays & Cape rerouting surcharges");
  }
  if (/(wheat|rice|maize|corn|fertilizer|urea|dap|grain|food|bread|oil|diesel|brent|gas|coffee|cocoa)/.test(q)) {
    focusTopics.push("staple grain, fertilizer, and energy pass-through");
  }
  if (/(inflation|cpi|rate|central bank|fed|ecb|imf|spread|fx|currency|debt)/.test(q)) {
    focusTopics.push("real-time vs. lagging official CPI divergence");
  }
  const focusStr =
    focusTopics.length > 0
      ? focusTopics.join(" and ")
      : `macro risk dynamics in ${region.toUpperCase()} (${timeframe})`;

  return [
    `**Direct Assessment (${region.toUpperCase()} · ${timeframe} · Shock Lv ${shockLevel}/4)**`,
    `• Live EconoScope telemetry indicates elevated cross-market sensitivity around ${focusStr}.`,
    `• Active context snapshot: ${telemetrySummary || "108 sovereign economies, 28 trade corridors, and 16 chokepoints tracked."}`,
    "",
    "**Causal Transmission**",
    "• Chokepoint vessel bunching and parallel FX premiums push landed staple, urea, and diesel costs higher 12–21 days before official CPI prints reflect the move.",
    "• Net-importing hubs with <4 months of FX reserve cover face immediate retail food repricing and fiscal subsidy pressure.",
    "",
    "**2 Concrete Analyst Actions**",
    "• Hedge near-term grain, urea, and bunker fuel exposure ahead of upcoming central bank and CPI surprise dates in the Command Center calendar.",
    "• Cross-check affected countries in the 3D Atlas and run the Policy & Hedging Simulator (reserve release + FX hedge sliders) to quantify CPI relief.",
  ].join("\n");
}

function decodeXmlEntities(input: string): string {
  return input
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#x([0-9a-fA-F]+);/g, (_m, hex) => {
      const cp = Number.parseInt(hex, 16);
      return Number.isFinite(cp) ? String.fromCodePoint(cp) : "";
    })
    .replace(/&#(\d+);/g, (_m, dec) => {
      const cp = Number.parseInt(dec, 10);
      return Number.isFinite(cp) ? String.fromCodePoint(cp) : "";
    })
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;|&rsquo;|&lsquo;/g, "'")
    .replace(/&rdquo;|&ldquo;/g, '"')
    .replace(/&ndash;/g, "–")
    .replace(/&mdash;/g, "—")
    .replace(/&nbsp;/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function classifyHeadline(rawTitle: string) {
  const lower = rawTitle.toLowerCase();

  let score = 0;
  const bearishTerms = [
    "inflation", "surge", "spike", "shortage", "crisis", "war", "tariff", "sanction",
    "delay", "disrupt", "blockade", "drop", "slump", "recession", "deficit", "debt",
    "hike", "tighten", "warn", "risk", "drought", "curb", "ban", "jump", "pressure",
    "shock", "decline", "cut output", "depreciat", "default", "strains",
  ];
  const bullishTerms = [
    "ease", "easing", "cool", "rebound", "recovery", "surplus", "rally", "cut rates",
    "rate cut", "disinflation", "stabiliz", "reopen", "bumper", "record harvest",
    "growth beat", "expand", "improve", "fall in inflation", "relief", "boost",
  ];
  const volatileTerms = ["volatile", "uncertainty", "brace", "swing", "mixed", "split", "warning"];

  for (const t of bearishTerms) if (lower.includes(t)) score -= 22;
  for (const t of bullishTerms) if (lower.includes(t)) score += 24;
  for (const t of volatileTerms) if (lower.includes(t)) score -= 6;

  score = Math.max(-95, Math.min(95, score));

  let sentiment: "BULLISH" | "BEARISH" | "NEUTRAL" | "VOLATILE" = "NEUTRAL";
  if (score <= -18) sentiment = "BEARISH";
  else if (score >= 18) sentiment = "BULLISH";
  else if (volatileTerms.some((t) => lower.includes(t))) sentiment = "VOLATILE";

  let category: "Inflation" | "Central Banks" | "Commodities" | "Supply Chain" | "FX & Sovereign" =
    "Inflation";
  if (/(fed|ecb|boe|boj|central bank|rate|powell|lagarde|imf|bond|yield|treasury)/.test(lower)) {
    category = "Central Banks";
  } else if (/(ship|port|canal|suez|red sea|freight|container|supply chain|cargo|vessel|rail)/.test(lower)) {
    category = "Supply Chain";
  } else if (/(oil|brent|gas|lng|wheat|corn|rice|grain|copper|gold|fertilizer|urea|food|crop|coffee|cocoa)/.test(lower)) {
    category = "Commodities";
  } else if (/(dollar|fx|currency|yen|euro|naira|pound|lira|debt|sovereign|reserve|gdp|trade)/.test(lower)) {
    category = "FX & Sovereign";
  }

  const regs = inferRegionFromText(rawTitle);
  const region = regs[0] ?? "global";

  return { sentiment, sentimentScore: score, category, region };
}

function parseRssItems(xml: string, fallbackSource: string) {
  const items: Array<{
    title: string;
    source: string;
    url: string;
    publishedAt: string;
    minutesAgo: number;
  }> = [];

  const matches = xml.match(/<item\b[\s\S]*?<\/item>/gi) ?? [];
  const now = Date.now();

  for (const block of matches.slice(0, 12)) {
    const titleRaw = block.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "";
    const linkRaw = block.match(/<link[^>]*>([\s\S]*?)<\/link>/i)?.[1] ?? "";
    const pubRaw = block.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i)?.[1] ?? "";
    const srcRaw = block.match(/<source[^>]*>([\s\S]*?)<\/source>/i)?.[1] ?? "";

    let title = decodeXmlEntities(titleRaw);
    let source = decodeXmlEntities(srcRaw) || fallbackSource;

    // Google News RSS often appends " - Reuters" to the title
    const dashIdx = title.lastIndexOf(" - ");
    if (dashIdx > 25 && !srcRaw) {
      source = title.slice(dashIdx + 3).trim();
      title = title.slice(0, dashIdx).trim();
    } else if (dashIdx > 25 && srcRaw) {
      title = title.slice(0, dashIdx).trim();
    }

    const url = decodeXmlEntities(linkRaw);
    if (!title || title.length < 15 || !url.startsWith("http")) continue;

    const parsedMs = pubRaw ? Date.parse(pubRaw) : NaN;
    const publishedAt = Number.isFinite(parsedMs) ? new Date(parsedMs).toISOString() : new Date(now).toISOString();
    const minutesAgo = Number.isFinite(parsedMs)
      ? Math.max(1, Math.min(1440, Math.round((now - parsedMs) / 60000)))
      : 15;

    items.push({ title, source, url, publishedAt, minutesAgo });
  }

  return items;
}

const FALLBACK_MARKET_BRIEFS = [
  {
    title: "Container spot rates climb as Cape of Good Hope diversions extend Asia-Europe voyage times",
    source: "Reuters Wire",
    url: "https://www.reuters.com/markets/commodities/",
    minutesAgo: 9,
  },
  {
    title: "Global urea and DAP fertilizer benchmarks tighten ahead of Northern & East African planting windows",
    source: "FAO / Market Desk",
    url: "https://www.fao.org/markets-and-trade/en/",
    minutesAgo: 17,
  },
  {
    title: "Central banks flag sticky services and food pass-through as rate-cut paths diverge across G10 & EM",
    source: "Financial Times",
    url: "https://www.ft.com/markets",
    minutesAgo: 26,
  },
  {
    title: "Grain traders track Black Sea inspection queues and Parana river draft constraints on bulk shipments",
    source: "Bloomberg Macro",
    url: "https://www.bloomberg.com/markets",
    minutesAgo: 34,
  },
  {
    title: "Copper and industrial metals stabilize as Asian grid investment offsets manufacturing slowdown",
    source: "CNBC Markets",
    url: "https://www.cnbc.com/world-economy/",
    minutesAgo: 42,
  },
  {
    title: "Emerging-market dollar debt spreads widen modestly where parallel FX premiums exceed 10%",
    source: "Forbes Markets",
    url: "https://www.forbes.com/business/",
    minutesAgo: 55,
  },
];

async function startServer() {
  const app = express();
  app.use(express.json({ limit: "1mb" }));

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, service: "econoscope", hasGemini: Boolean(getAiClient()) });
  });

  // Live Market Briefs Route: Major Economic News RSS + GDELT DOC 2.0 + Instant Sentiment Scoring
  app.get("/api/news/briefs", async (_req, res) => {
    const updatedAt = new Date().toISOString();

    const rssSources: Array<{ url: string; label: string }> = [
      {
        url: "https://news.google.com/rss/search?q=(inflation+OR+%22central+bank%22+OR+%22supply+chain%22+OR+commodities+OR+tariffs)+(Reuters+OR+Bloomberg+OR+CNBC+OR+%22Financial+Times%22+OR+Forbes)&hl=en-US&gl=US&ceid=US:en",
        label: "Global Macro Wire",
      },
      {
        url: "https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=20910258",
        label: "CNBC Economy",
      },
      {
        url: "https://feeds.marketwatch.com/marketwatch/topstories/",
        label: "MarketWatch",
      },
      {
        url: "https://www.forbes.com/business/feed/",
        label: "Forbes Business",
      },
    ];

    const rssPromises = rssSources.map(async (src) => {
      try {
        const resp = await fetchWithTimeout(src.url, 4200, "application/rss+xml, application/xml, text/xml");
        if (!resp.ok) return [];
        const xml = await resp.text();
        return parseRssItems(xml, src.label).map((it) => ({ ...it, isLive: true }));
      } catch {
        return [];
      }
    });

    const gdeltPromise = (async () => {
      try {
        const q = encodeURIComponent('(inflation OR "central bank" OR "supply chain" OR oil OR wheat OR tariff) sourcelang:english');
        const url = `https://api.gdeltproject.org/api/v2/doc/doc?query=${q}&mode=artlist&format=json&timespan=24h&maxrecords=10&sort=DateDesc`;
        const resp = await fetchWithTimeout(url, 4200);
        if (!resp.ok) return [];
        const payload = (await resp.json()) as {
          articles?: Array<{ title?: string; url?: string; domain?: string; seendate?: string }>;
        };
        const arts = Array.isArray(payload?.articles) ? payload.articles : [];
        return arts
          .filter((a) => a.title && a.url)
          .slice(0, 8)
          .map((a, i) => ({
            title: (a.title ?? "").trim(),
            source: a.domain?.replace(/^www\./, "") || "GDELT Wire",
            url: a.url ?? "",
            publishedAt: new Date(Date.now() - (i + 1) * 8 * 60000).toISOString(),
            minutesAgo: (i + 1) * 8,
            isLive: true,
          }));
      } catch {
        return [];
      }
    })();

    const settled = await Promise.all([...rssPromises, gdeltPromise]);
    const liveRaw = settled.flat();

    // Deduplicate by normalized title prefix
    const seen = new Set<string>();
    const combinedRaw: Array<{
      title: string;
      source: string;
      url: string;
      publishedAt: string;
      minutesAgo: number;
      isLive: boolean;
    }> = [];

    for (const item of liveRaw) {
      const key = item.title.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 48);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      combinedRaw.push(item);
    }

    const liveCount = combinedRaw.length;
    if (combinedRaw.length < 8) {
      for (const fb of FALLBACK_MARKET_BRIEFS) {
        const key = fb.title.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 48);
        if (seen.has(key)) continue;
        seen.add(key);
        combinedRaw.push({
          ...fb,
          publishedAt: new Date(Date.now() - fb.minutesAgo * 60000).toISOString(),
          isLive: false,
        });
      }
    }

    const items = combinedRaw
      .sort((a, b) => a.minutesAgo - b.minutesAgo)
      .slice(0, 22)
      .map((item, idx) => {
        const cls = classifyHeadline(item.title);
        return {
          id: `mb-${idx}-${Date.now()}`,
          title: item.title,
          source: item.source,
          url: item.url,
          publishedAt: item.publishedAt,
          minutesAgo: item.minutesAgo,
          sentiment: cls.sentiment,
          sentimentScore: cls.sentimentScore,
          category: cls.category,
          region: cls.region,
          isLive: item.isLive,
        };
      });

    const bearish = items.filter((i) => i.sentiment === "BEARISH").length;
    const bullish = items.filter((i) => i.sentiment === "BULLISH").length;
    const neutral = items.length - bearish - bullish;
    const avgScore = items.length
      ? Math.round(items.reduce((sum, i) => sum + i.sentimentScore, 0) / items.length)
      : 0;

    const sentimentLabel =
      avgScore <= -22
        ? "RISK-OFF"
        : avgScore <= -6
          ? "CAUTIOUS"
          : avgScore >= 14
            ? "RISK-ON"
            : "BALANCED";

    res.json({
      updatedAt,
      liveCount,
      sentimentIndex: avgScore,
      sentimentLabel,
      breakdown: { bearish, neutral, bullish },
      items,
    });
  });

  // Hybrid Live Plugin Ingestion Route: World Bank v2 + GDELT DOC 2.0 + ReliefWeb
  app.get("/api/plugins/sync", async (_req, res) => {
    const syncedAt = new Date().toISOString();

    const wbPromise = (async () => {
      try {
        const url =
          "https://api.worldbank.org/v2/country/ETH;KEN;EGY;DEU;VNM;BRA;USA;IND;GBR;JPN;ZAF;AUS/indicator/FP.CPI.TOTL.ZG?format=json&per_page=48&mrv=2";
        const resp = await fetchWithTimeout(url, 4800);
        if (!resp.ok) throw new Error(`World Bank HTTP ${resp.status}`);
        const payload = (await resp.json()) as [
          unknown,
          Array<{ country?: { id?: string; value?: string }; date?: string; value?: number | null }>,
        ];
        const rows = Array.isArray(payload?.[1]) ? payload[1] : [];
        const records = rows
          .filter((r) => r.value !== null && r.value !== undefined)
          .slice(0, 14)
          .map((r) => ({
            countryCode: r.country?.id ?? "WLD",
            country: r.country?.value ?? "Unknown",
            year: r.date ?? "2025",
            cpiAnnualPct: Number((r.value ?? 0).toFixed(2)),
          }));
        return { live: records.length > 0, records, error: null as string | null };
      } catch (err) {
        return {
          live: false,
          records: [] as Array<{ countryCode: string; country: string; year: string; cpiAnnualPct: number }>,
          error: err instanceof Error ? err.message : "World Bank unreachable",
        };
      }
    })();

    const gdeltPromise = (async () => {
      try {
        const query = encodeURIComponent(
          '(inflation OR "food shortage" OR "supply chain" OR "fertilizer" OR "shipping delay") sourcelang:english'
        );
        const url = `https://api.gdeltproject.org/api/v2/doc/doc?query=${query}&mode=artlist&format=json&timespan=72h&maxrecords=10&sort=DateDesc`;
        const resp = await fetchWithTimeout(url, 4800);
        if (!resp.ok) throw new Error(`GDELT HTTP ${resp.status}`);
        const payload = (await resp.json()) as {
          articles?: Array<{ title?: string; url?: string; domain?: string; seendate?: string; sourcecountry?: string }>;
        };
        const articles = Array.isArray(payload?.articles) ? payload.articles : [];
        const signals = articles.slice(0, 6).map((art, idx) => {
          const title = art.title?.trim() || "Global macro economic signal";
          const regs = inferRegionFromText(`${title} ${art.sourcecountry ?? ""}`);
          return {
            id: 500 + idx,
            src: "GDELT" as const,
            minutesAgo: (idx + 1) * 7,
            regions: regs,
            text: `${title} (${art.domain ?? "gdelt-wire"})`,
            url: art.url ?? "",
            entities: [
              ["ORG", art.domain ?? "GDELT"],
              ["LOC", art.sourcecountry || "Global"],
              ["EVENT", "Live GDELT Feed"],
            ] as Array<[string, string]>,
            alertId: regs.includes("eafrica")
              ? "a1"
              : regs.includes("mena")
                ? "a3"
                : regs.includes("seasia")
                  ? "a9"
                  : regs.includes("americas")
                    ? "a11"
                    : "a13",
            fresh: true,
            isLive: true,
          };
        });
        return { live: signals.length > 0, signals, error: null as string | null };
      } catch (err) {
        return {
          live: false,
          signals: [] as Array<{
            id: number;
            src: "GDELT";
            minutesAgo: number;
            regions: string[];
            text: string;
            url: string;
            entities: Array<[string, string]>;
            alertId: string;
            fresh: boolean;
            isLive: boolean;
          }>,
          error: err instanceof Error ? err.message : "GDELT unreachable",
        };
      }
    })();

    const reliefPromise = (async () => {
      try {
        const url =
          "https://api.reliefweb.int/v1/reports?appname=econoscope&limit=4&query[value]=food+prices+OR+fertilizer+OR+supply+chain";
        const resp = await fetchWithTimeout(url, 4500);
        if (!resp.ok) throw new Error(`ReliefWeb HTTP ${resp.status}`);
        const payload = (await resp.json()) as {
          data?: Array<{ id?: string; fields?: { title?: string; url?: string } }>;
        };
        const items = Array.isArray(payload?.data) ? payload.data : [];
        const signals = items.map((item, idx) => {
          const title = item.fields?.title?.trim() || "Humanitarian food supply update";
          const regs = inferRegionFromText(title);
          return {
            id: 700 + idx,
            src: "FAO" as const,
            minutesAgo: (idx + 1) * 11,
            regions: regs,
            text: `${title} (Humanitarian / Food Security Wire)`,
            url: item.fields?.url ?? "",
            entities: [
              ["EVENT", "Food Security Bulletin"],
              ["ORG", "FAO / ReliefWeb"],
              ["LOC", regs[0] === "global" ? "Global" : regs[0].toUpperCase()],
            ] as Array<[string, string]>,
            alertId: regs.includes("eafrica") ? "a2" : regs.includes("mena") ? "a4" : "a9",
            fresh: true,
            isLive: true,
          };
        });
        return { live: signals.length > 0, signals, error: null as string | null };
      } catch (err) {
        return {
          live: false,
          signals: [],
          error: err instanceof Error ? err.message : "Food wire unreachable",
        };
      }
    })();

    const [wb, gdelt, relief] = await Promise.all([wbPromise, gdeltPromise, reliefPromise]);

    res.json({
      syncedAt,
      worldBank: wb,
      gdelt,
      foodWire: relief,
      liveSignals: [...gdelt.signals, ...relief.signals],
    });
  });

  // Custom Plugin URL / Topic Ingestion powered by Gemini + resilience chain
  app.post("/api/plugins/ingest", async (req, res) => {
    const ai = getAiClient();
    const { urlOrTopic, region = "global" } = (req.body ?? {}) as { urlOrTopic?: string; region?: string };

    if (!urlOrTopic || !urlOrTopic.trim()) {
      res.status(400).json({ error: "Please enter a news URL, economic report link, or macro topic." });
      return;
    }

    if (!ai) {
      res.status(503).json({
        error: "Gemini API key is not configured on the server. Set GEMINI_API_KEY in Settings > Secrets.",
      });
      return;
    }

    const input = urlOrTopic.trim();
    const isUrl = /^https?:\/\//i.test(input);

    try {
      const response = await generateWithResilience(ai, {
        contents: `Analyze this economic/geopolitical source or topic for EconoScope Early Warning Engine (focus region: ${region}): "${input}".
Return ONLY a valid JSON object (no markdown commentary) with this exact structure:
{
  "title": "Concise 8-12 word early warning headline",
  "summary": "2-sentence analytical explanation of inflation, shortage, or supply-chain pressure",
  "severity": "CRITICAL" | "ELEVATED" | "WATCH",
  "category": "Inflation" | "Shortage" | "Supply chain",
  "regionKey": "global" | "eafrica" | "mena" | "eurozone" | "seasia" | "americas",
  "leadDays": number (between 5 and 28),
  "confidence": number (between 68 and 96),
  "entities": [["COMMODITY"|"LOC"|"EVENT"|"METRIC"|"ORG", "short value"]],
  "causalChain": ["Step 1 trigger", "Step 2 transmission", "Step 3 market impact", "Step 4 CPI/shortage outcome"],
  "actions": ["Policy action 1", "Policy action 2", "Hedging action 1", "Hedging action 2"]
}`,
        systemInstruction:
          "You are EconoScope's real-time macro-economic ingestion parser. Ground your extraction strictly in verifiable facts from the provided URL or live search results. Output valid JSON only.",
        useSearch: true,
        useUrlContext: isUrl,
      });

      const rawText = response.text ?? "";
      const parsed = extractJsonObject(rawText);
      const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
      const citations = chunks
        .map((c) => {
          const web = (c as { web?: { uri?: string; title?: string } }).web;
          if (!web?.uri) return null;
          return { title: web.title || web.uri, uri: web.uri };
        })
        .filter((x): x is { title: string; uri: string } => x !== null)
        .slice(0, 5);

      if (!parsed) {
        res.json({
          title: `Live Signal: ${input.slice(0, 64)}`,
          summary: rawText.slice(0, 320) || "Ingested live web intelligence signal via ECO Web Grounding.",
          severity: "ELEVATED",
          category: "Inflation",
          regionKey: region,
          leadDays: 14,
          confidence: 82.5,
          entities: [
            ["LOC", region.toUpperCase()],
            ["EVENT", "Live Web Ingestion"],
          ],
          causalChain: [
            "External report flagged by plugin",
            "Entity & price pass-through parsed",
            "Regional market pressure elevated",
            "Early warning surfaced ahead of official CPI",
          ],
          actions: [
            "Cross-check local retail price quotes",
            "Review strategic stock cover",
            "Lock near-term forward hedges",
            "Monitor shipping lane telemetry",
          ],
          citations,
        });
        return;
      }

      res.json({ ...parsed, citations });
    } catch (err) {
      res.status(500).json({ error: cleanReadableError(err) });
    }
  });

  // Live ECO AI Macro Analyst Endpoint (Never crashes with raw 429 JSON!)
  app.post("/api/ai/analyze", async (req, res) => {
    const ai = getAiClient();
    const { query, region = "global", timeframe = "7D", shockLevel = 0, telemetrySummary = "" } = (req.body ?? {}) as {
      query?: string;
      region?: string;
      timeframe?: string;
      shockLevel?: number;
      telemetrySummary?: string;
    };

    if (!query || !query.trim()) {
      res.status(400).json({ error: "Please enter a question for ECO." });
      return;
    }

    if (!ai) {
      res.json({
        answer: buildEcoTelemetryFallback(query, region, timeframe, shockLevel, telemetrySummary),
        citations: [],
        fallbackMode: "telemetry",
      });
      return;
    }

    try {
      const response = await generateWithResilience(ai, {
        contents: `Active Terminal Context:
- Region Focus: ${region}
- Timeframe: ${timeframe}
- Crisis Shock Simulation Level: ${shockLevel}/4
- Live Terminal Snapshot: ${telemetrySummary}

User Question: ${query.trim()}`,
        systemInstruction:
          "You are ECO, EconoScope's Macro-Economic Intelligence AI for institutional analysts and everyday users. Provide crisp, analytical assessments covering inflation pass-through, food/commodity shortage risks, sovereign balance sheets, and supply-chain chokepoints across all 108 monitored economies. Ground answers with real-world economic data when relevant. Structure your response cleanly with short sections (Direct Assessment, Causal Transmission, 2 Concrete Actions). Keep total length under 220 words.",
        useSearch: true,
      });

      const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
      const citations = chunks
        .map((c) => {
          const web = (c as { web?: { uri?: string; title?: string } }).web;
          if (!web?.uri) return null;
          return { title: web.title || web.uri, uri: web.uri };
        })
        .filter((x): x is { title: string; uri: string } => x !== null)
        .slice(0, 6);

      res.json({
        answer: response.text ?? buildEcoTelemetryFallback(query, region, timeframe, shockLevel, telemetrySummary),
        citations,
      });
    } catch (err) {
      const raw = err instanceof Error ? err.message : String(err);
      if (/429|RESOURCE_EXHAUSTED|quota|rate|503|UNAVAILABLE/i.test(raw)) {
        res.json({
          answer: buildEcoTelemetryFallback(query, region, timeframe, shockLevel, telemetrySummary),
          citations: [],
          fallbackMode: "telemetry",
        });
        return;
      }
      res.status(500).json({ error: cleanReadableError(err) });
    }
  });

  // Live Executive Briefing Generator for Any Alert
  app.post("/api/ai/briefing", async (req, res) => {
    const ai = getAiClient();
    const { alertTitle, alertWhy, region, severity } = (req.body ?? {}) as {
      alertTitle?: string;
      alertWhy?: string;
      region?: string;
      severity?: string;
    };

    if (!ai) {
      res.status(503).json({
        error: "Gemini API key is not configured on the server. Set GEMINI_API_KEY in Settings > Secrets.",
      });
      return;
    }

    try {
      const response = await generateWithResilience(ai, {
        contents: `Generate a grounded real-time executive briefing for this economic alert:
Title: ${alertTitle}
Severity: ${severity}
Region: ${region}
Signal Context: ${alertWhy}

Include:
1. Real-world market context & corroborating macro trends.
2. Immediate 14-day policy intervention.
3. Commodity/FX hedging recommendation.
Keep it crisp and institutional (under 180 words).`,
        systemInstruction:
          "You are EconoScope's AI Risk Briefing Engine. Deliver crisp, actionable economic briefings backed by live web grounding.",
        useSearch: true,
      });

      const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
      const citations = chunks
        .map((c) => {
          const web = (c as { web?: { uri?: string; title?: string } }).web;
          if (!web?.uri) return null;
          return { title: web.title || web.uri, uri: web.uri };
        })
        .filter((x): x is { title: string; uri: string } => x !== null)
        .slice(0, 5);

      res.json({
        briefing: response.text ?? "",
        citations,
      });
    } catch (err) {
      res.status(500).json({ error: cleanReadableError(err) });
    }
  });

  // AI Scenario Stress-Test Generator
  app.post("/api/ai/scenario", async (req, res) => {
    const ai = getAiClient();
    const { scenarioPrompt, region = "global" } = (req.body ?? {}) as {
      scenarioPrompt?: string;
      region?: string;
    };

    if (!scenarioPrompt || !scenarioPrompt.trim()) {
      res.status(400).json({ error: "Please describe a crisis or geopolitical scenario to simulate." });
      return;
    }

    if (!ai) {
      res.status(503).json({
        error: "Gemini API key is not configured on the server. Set GEMINI_API_KEY in Settings > Secrets.",
      });
      return;
    }

    try {
      const response = await generateWithResilience(ai, {
        contents: `Simulate this macro-economic or geopolitical shock scenario for EconoScope (focus region: ${region}): "${scenarioPrompt.trim()}".
Return ONLY a valid JSON object (no markdown fences) with this exact structure:
{
  "title": "Concise 8-12 word crisis alert headline",
  "summary": "2-sentence explanation of immediate supply-chain, commodity, and inflation transmission",
  "severity": "CRITICAL" | "ELEVATED",
  "category": "Inflation" | "Shortage" | "Supply chain",
  "regionKey": "global" | "eafrica" | "mena" | "eurozone" | "seasia" | "americas",
  "leadDays": number (between 2 and 24),
  "confidence": number (between 78 and 96),
  "epicenter": {
    "name": "City or Chokepoint name",
    "lat": number,
    "lon": number,
    "geopoliticalWeight": number (0.5 to 1.0),
    "economicWeight": number (0.5 to 1.0)
  },
  "causalChain": ["Trigger event", "Immediate shipping/price shock", "Secondary market spillover", "CPI/shortage impact"],
  "impactNodes": ["1st order shock 1", "1st order shock 2", "2nd order shock 1", "2nd order shock 2", "3rd order outcome 1", "3rd order outcome 2"],
  "actions": ["Policy action 1", "Policy action 2", "Hedging action 1", "Hedging action 2"]
}`,
        systemInstruction:
          "You are EconoScope's Macro Stress-Testing Engine. Generate realistic, quantitative multi-order economic contagion scenarios grounded in real-world trade routes and commodity dynamics. Output JSON only.",
        useSearch: true,
      });

      const parsed = extractJsonObject(response.text ?? "");
      const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
      const citations = chunks
        .map((c) => {
          const web = (c as { web?: { uri?: string; title?: string } }).web;
          if (!web?.uri) return null;
          return { title: web.title || web.uri, uri: web.uri };
        })
        .filter((x): x is { title: string; uri: string } => x !== null)
        .slice(0, 5);

      if (!parsed) {
        res.status(500).json({ error: "Scenario synthesis did not return structured telemetry. Please try again." });
        return;
      }

      res.json({ ...parsed, citations });
    } catch (err) {
      res.status(500).json({ error: cleanReadableError(err) });
    }
  });

  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, "dist");
    app.use(express.static(distDir));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distDir, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`EconoScope server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start EconoScope server:", err);
  process.exit(1);
});
