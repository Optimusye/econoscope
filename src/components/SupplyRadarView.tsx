import { useEffect, useState } from "react";
import { Anchor, Container, Navigation, PackageX, Table2 } from "lucide-react";
import { CHOKEPOINTS, COMMODITIES, PORTS, REGIONS } from "../data/econoscopeData";
import type { RegionKey, ThemeMode } from "../types/econoscope";
import { HorizontalBarChart, RadialGauge } from "./Charts";

interface SupplyRadarViewProps {
  theme: ThemeMode;
  region: RegionKey;
  shockLevel: number;
}

const REROUTE_CORRIDORS = [
  {
    id: "suez-cape",
    name: "Red Sea / Suez -> Cape of Good Hope Diversion",
    extraDays: 11.5,
    bunkerPerTon: 28,
    warRiskPct: 1.8,
    retailPassPct: 6.4,
  },
  {
    id: "panama-horn",
    name: "Panama Canal Draft Queue -> Cape Horn / US Rail",
    extraDays: 9.0,
    bunkerPerTon: 24,
    warRiskPct: 0.6,
    retailPassPct: 4.9,
  },
  {
    id: "blacksea-danube",
    name: "Odessa Corridor -> Constanta Danube-Rail Barge",
    extraDays: 6.5,
    bunkerPerTon: 34,
    warRiskPct: 2.4,
    retailPassPct: 7.8,
  },
];

function formatCountdown(targetMs: number, nowMs: number): string {
  const diff = Math.max(0, targetMs - nowMs);
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  return `${d}d ${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function SupplyRadarView({ theme, region, shockLevel }: SupplyRadarViewProps) {
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [mountBaseMs] = useState(() => Date.now());
  const [corridorId, setCorridorId] = useState(REROUTE_CORRIDORS[0].id);
  const [cargoTons, setCargoTons] = useState(45000);

  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const regScale = Math.max(0.6, Math.min(1.6, REGIONS[region].shortageProbability / 41));
  const shockScale = 1 + shockLevel * 0.07;

  const chokepoints = CHOKEPOINTS.filter((c) => region === "global" || c.regions.includes(region));
  const commodities = COMMODITIES.filter((c) => region === "global" || c.regions.includes(region));
  const ports = PORTS.filter((p) => region === "global" || p.regions.includes(region));

  const activeCorridor = REROUTE_CORRIDORS.find((r) => r.id === corridorId) ?? REROUTE_CORRIDORS[0];
  const addedDays = Number((activeCorridor.extraDays * shockScale).toFixed(1));
  const costPerTon = Number(
    ((activeCorridor.bunkerPerTon + activeCorridor.warRiskPct * 6.5) * shockScale).toFixed(2)
  );
  const totalVoyageSurcharge = Math.round(costPerTon * cargoTons);
  const retailFoodBump = Number((activeCorridor.retailPassPct * shockScale).toFixed(1));

  return (
    <div className="space-y-4">
      {/* Maritime Chokepoint Cards */}
      <section className="space-y-2.5">
        <div className="flex items-center justify-between text-xs font-semibold text-zinc-900 dark:text-zinc-200 px-1">
          <div className="flex items-center gap-2">
            <Anchor className="w-4 h-4" />
            <span>Maritime Chokepoint Monitor ({chokepoints.length} corridors)</span>
          </div>
          <span className="font-mono text-[11px] text-zinc-500 dark:text-zinc-400">Live AIS &amp; war-risk feed</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3.5">
          {chokepoints.map((cp) => {
            const risk = Math.min(98, Math.round(cp.riskScore * shockScale));
            const status =
              shockLevel >= 1 && (cp.name.includes("Suez") || cp.name.includes("Black"))
                ? "DISRUPTED"
                : cp.status;
            const statusColor =
              status === "DISRUPTED"
                ? "text-red-600 dark:text-red-300"
                : status === "CONGESTED"
                  ? "text-amber-600 dark:text-amber-300"
                  : "text-emerald-600 dark:text-emerald-300";

            return (
              <div key={cp.name} className="liquid-glass rounded-xl p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-sm font-semibold text-zinc-950 dark:text-white">{cp.name}</h3>
                  <span className={`font-mono text-[11px] font-bold ${statusColor}`}>{status}</span>
                </div>
                <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed">{cp.note}</p>
                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-lg bg-white/60 dark:bg-zinc-950/55 border border-zinc-900/10 dark:border-white/10 p-2">
                    <div className="text-[10px] text-zinc-500 dark:text-zinc-400">Delay</div>
                    <div className="font-mono text-sm font-semibold text-zinc-950 dark:text-white tabular-nums">
                      {(cp.delayDays * shockScale).toFixed(1)}d
                    </div>
                  </div>
                  <div className="rounded-lg bg-white/60 dark:bg-zinc-950/55 border border-zinc-900/10 dark:border-white/10 p-2">
                    <div className="text-[10px] text-zinc-500 dark:text-zinc-400">Flow</div>
                    <div className="font-mono text-sm font-semibold text-zinc-950 dark:text-white tabular-nums">
                      {Math.round(cp.flowPct / shockScale)}%
                    </div>
                  </div>
                  <div className="rounded-lg bg-white/60 dark:bg-zinc-950/55 border border-zinc-900/10 dark:border-white/10 p-2">
                    <div className="text-[10px] text-zinc-500 dark:text-zinc-400">Queue</div>
                    <div className="font-mono text-sm font-semibold text-zinc-950 dark:text-white tabular-nums">
                      {Math.round(cp.vesselsWaiting * shockScale)}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <span className="font-mono text-zinc-700 dark:text-zinc-300 tabular-nums shrink-0">Risk {risk}</span>
                  <div className="flex-1 h-1.5 rounded-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        risk >= 75 ? "bg-red-500" : risk >= 55 ? "bg-amber-400" : "bg-emerald-400"
                      }`}
                      style={{ width: `${risk}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Maritime Rerouting Cost & Transit Simulator */}
      <section className="liquid-glass rounded-xl p-4 space-y-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-900/10 dark:border-white/10 pb-3">
          <div className="flex items-center gap-2">
            <Navigation className="w-4 h-4 text-zinc-900 dark:text-zinc-100" />
            <div>
              <h2 className="text-sm font-semibold text-zinc-950 dark:text-white">
                Maritime Rerouting Cost &amp; Transit Calculator
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Quantify extra voyage days, war-risk bunker surcharges, and downstream retail food pass-through
              </p>
            </div>
          </div>
          <span className="font-mono text-xs text-zinc-700 dark:text-zinc-300 tabular-nums">
            Cargo {cargoTons.toLocaleString()} MT
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-4 items-center">
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {REROUTE_CORRIDORS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCorridorId(c.id)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium border transition-colors cursor-pointer ${
                    corridorId === c.id
                      ? "bg-zinc-950 text-white border-zinc-950 dark:bg-white dark:text-zinc-950 dark:border-white"
                      : "border-zinc-900/15 dark:border-white/15 bg-white/55 dark:bg-zinc-950/50 text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white"
                  }`}
                >
                  {c.name}
                </button>
              ))}
            </div>

            <label className="block space-y-1.5 text-xs">
              <div className="flex items-center justify-between text-zinc-700 dark:text-zinc-300">
                <span>Grain / Fertilizer Shipment Tonnage (Panamax / Supramax)</span>
                <span className="font-mono font-semibold text-zinc-950 dark:text-white tabular-nums">
                  {cargoTons.toLocaleString()} MT
                </span>
              </div>
              <input
                type="range"
                min={10000}
                max={120000}
                step={5000}
                value={cargoTons}
                onChange={(e) => setCargoTons(Number(e.target.value))}
                className="w-full accent-zinc-900 dark:accent-white cursor-pointer"
              />
            </label>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="rounded-xl border border-zinc-900/10 dark:border-white/15 bg-white/60 dark:bg-zinc-950/55 p-3">
              <div className="text-[11px] text-zinc-500 dark:text-zinc-400">Transit Penalty</div>
              <div className="mt-1 font-mono text-lg font-bold text-amber-600 dark:text-amber-300 tabular-nums">
                +{addedDays}d
              </div>
            </div>
            <div className="rounded-xl border border-zinc-900/10 dark:border-white/15 bg-white/60 dark:bg-zinc-950/55 p-3">
              <div className="text-[11px] text-zinc-500 dark:text-zinc-400">Landed Cost</div>
              <div className="mt-1 font-mono text-lg font-bold text-zinc-950 dark:text-white tabular-nums">
                +${costPerTon}/t
              </div>
            </div>
            <div className="rounded-xl border border-zinc-900/10 dark:border-white/15 bg-white/60 dark:bg-zinc-950/55 p-3">
              <div className="text-[11px] text-zinc-500 dark:text-zinc-400">Voyage Impact</div>
              <div className="mt-1 font-mono text-lg font-bold text-zinc-950 dark:text-white tabular-nums">
                ${(totalVoyageSurcharge / 1000).toFixed(0)}k
              </div>
            </div>
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3">
              <div className="text-[11px] text-red-700 dark:text-red-200">Retail Flour Lift</div>
              <div className="mt-1 font-mono text-lg font-bold text-red-600 dark:text-red-300 tabular-nums">
                +{retailFoodBump}%
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Commodity Shortage Radar + Port Congestion Chart */}
      <section className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-4 items-start">
        <div className="liquid-glass rounded-xl overflow-hidden">
          <div className="flex items-center gap-2 border-b border-zinc-900/10 dark:border-white/10 px-4 py-3">
            <PackageX className="w-4 h-4 text-zinc-900 dark:text-zinc-100" />
            <h2 className="text-sm font-semibold text-zinc-950 dark:text-white">
              Commodity Shortage Radar ({commodities.length} tracked)
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-zinc-900/10 dark:border-white/10 text-zinc-500 dark:text-zinc-400">
                  <th className="py-2.5 px-4 text-left font-medium">Commodity</th>
                  <th className="py-2.5 px-4 text-left font-medium">Stock-to-Use</th>
                  <th className="py-2.5 px-4 text-left font-medium">Days of Cover</th>
                  <th className="py-2.5 px-4 text-right font-medium">Shortage Prob</th>
                </tr>
              </thead>
              <tbody>
                {commodities.map((c) => {
                  const prob = Math.min(97, Math.max(5, c.probability * regScale * (1 + shockLevel * 0.04)));
                  const su = c.stockToUse * (1 - shockLevel * 0.03);
                  const endMs = mountBaseMs + c.daysCover * (1 - shockLevel * 0.05) * 86400000;
                  return (
                    <tr
                      key={c.name}
                      className="border-b border-zinc-900/5 dark:border-white/5 last:border-0 hover:bg-zinc-900/[0.03] dark:hover:bg-white/[0.04]"
                    >
                      <td className="py-3 px-4 font-semibold text-zinc-950 dark:text-white">{c.name}</td>
                      <td className="py-3 px-4 font-mono text-zinc-700 dark:text-zinc-200 tabular-nums">
                        <div>{su.toFixed(1)}%</div>
                        <div className="mt-1.5 w-24 h-1.5 rounded-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              su < 20 ? "bg-red-500" : su < 26 ? "bg-amber-400" : "bg-emerald-400"
                            }`}
                            style={{ width: `${Math.min(100, Math.max(5, su * 2.2))}%` }}
                          />
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono text-amber-600 dark:text-amber-300 tabular-nums">
                        {formatCountdown(endMs, nowMs)}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex justify-end">
                          <RadialGauge value={prob} size={52} theme={theme} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="liquid-glass rounded-xl overflow-hidden">
          <div className="flex items-center gap-2 border-b border-zinc-900/10 dark:border-white/10 px-4 py-3">
            <Container className="w-4 h-4 text-zinc-900 dark:text-zinc-100" />
            <h2 className="text-sm font-semibold text-zinc-950 dark:text-white">
              Port Congestion: Avg Wait (Days)
            </h2>
          </div>
          <HorizontalBarChart
            items={ports.map((p) => ({
              name: p.name,
              value: Number((p.avgWaitDays * shockScale).toFixed(1)),
            }))}
          />
        </div>
      </section>

      {/* Port Congestion Metrics Table */}
      <section className="liquid-glass rounded-xl overflow-hidden">
        <div className="flex items-center gap-2 border-b border-zinc-900/10 dark:border-white/10 px-4 py-3">
          <Table2 className="w-4 h-4 text-zinc-900 dark:text-zinc-100" />
          <h2 className="text-sm font-semibold text-zinc-950 dark:text-white">
            Port Congestion Telemetry ({ports.length} global hubs)
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-zinc-900/10 dark:border-white/10 text-zinc-500 dark:text-zinc-400">
                <th className="py-2.5 px-4 text-left font-medium">Port</th>
                <th className="py-2.5 px-4 text-left font-medium">Country</th>
                <th className="py-2.5 px-4 text-right font-medium">Avg Wait</th>
                <th className="py-2.5 px-4 text-right font-medium">Vessels in Queue</th>
                <th className="py-2.5 px-4 text-right font-medium">vs 30D Average</th>
              </tr>
            </thead>
            <tbody>
              {ports.map((p) => (
                <tr
                  key={p.name}
                  className="border-b border-zinc-900/5 dark:border-white/5 last:border-0 hover:bg-zinc-900/[0.03] dark:hover:bg-white/[0.04]"
                >
                  <td className="py-3 px-4 font-semibold text-zinc-950 dark:text-white">{p.name}</td>
                  <td className="py-3 px-4 text-zinc-600 dark:text-zinc-400">{p.country ?? "Global"}</td>
                  <td className="py-3 px-4 text-right font-mono text-zinc-800 dark:text-zinc-200 tabular-nums">
                    {(p.avgWaitDays * shockScale).toFixed(1)}d
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-zinc-800 dark:text-zinc-200 tabular-nums">
                    {Math.round(p.vesselsQueue * shockScale)}
                  </td>
                  <td
                    className={`py-3 px-4 text-right font-mono font-semibold tabular-nums ${
                      p.vs30DayPct > 25 ? "text-red-600 dark:text-red-300" : "text-emerald-600 dark:text-emerald-300"
                    }`}
                  >
                    +{Math.round(p.vs30DayPct * shockScale)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
