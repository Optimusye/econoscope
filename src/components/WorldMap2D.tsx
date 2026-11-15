import { useMemo } from "react";
import { CHOKEPOINTS, HOTSPOTS, REGIONS, SHOCK_HOTSPOT_MAP } from "../data/econoscopeData";
import { isLandCoordinate } from "../utils/worldGeo";
import type { EconomicAlert, HeatmapMode, RegionKey, RiskHotspot, Severity, ThemeMode } from "../types/econoscope";

interface WorldMap2DProps {
  theme: ThemeMode;
  region: RegionKey;
  heatmapMode: HeatmapMode;
  showRiskNodes: boolean;
  showChokepoints: boolean;
  showHeatmap: boolean;
  shockLevel: number;
  alerts: EconomicAlert[];
  extraHotspots?: RiskHotspot[];
  onSelectHotspot: (alertId: string) => void;
}

const MW = 1000;
const MH = 470;
const px = (lon: number) => ((lon + 180) / 360) * MW;
const py = (lat: number) => ((78 - lat) / 136) * MH;

function computeHotspotWeight(h: RiskHotspot, mode: HeatmapMode): number {
  if (mode === "geopolitical") return h.geopoliticalWeight;
  if (mode === "inflation") return h.economicWeight;
  if (mode === "food") return Math.min(1, h.foodInflationPct / 34);
  if (mode === "maritime") return Math.min(1, (h.portDelayDays / 7) * 0.75 + (h.category === "Chokepoint" ? 0.3 : 0));
  return h.geopoliticalWeight * 0.48 + h.economicWeight * 0.52;
}

export function WorldMap2D({
  theme,
  region,
  heatmapMode,
  showRiskNodes,
  showChokepoints,
  showHeatmap,
  shockLevel,
  alerts,
  extraHotspots = [],
  onSelectHotspot,
}: WorldMap2DProps) {
  const isDark = theme === "dark";
  const allHotspots = useMemo(() => [...extraHotspots, ...HOTSPOTS], [extraHotspots]);
  const box = REGIONS[region].box;
  const viewBox = useMemo(
    () => [px(box[0]), py(box[3]), px(box[2]) - px(box[0]), py(box[1]) - py(box[3])],
    [box]
  );

  const scaleFactor = viewBox[2] / MW;
  const unit = Math.max(0.36, Math.sqrt(scaleFactor));

  const landDots = useMemo(() => {
    const step = Math.max(0.55, Math.min(1.8, 1.8 * Math.sqrt(scaleFactor)));
    let d = "";
    for (let lat = box[3] + step; lat >= box[1] - step; lat -= step) {
      for (let lon = box[0] - step; lon <= box[2] + step; lon += step) {
        if (isLandCoordinate(lon, lat)) {
          d += `M${px(lon).toFixed(1)} ${py(lat).toFixed(1)}h0`;
        }
      }
    }
    return { d, sw: Number((1.28 * step).toFixed(2)) };
  }, [box, scaleFactor]);

  const resolveSev = (hotspotId: string, alertId: string): Severity => {
    const shocked = Object.entries(SHOCK_HOTSPOT_MAP).some(
      ([sid, hid]) => hid === hotspotId && Number(sid.slice(1)) <= shockLevel
    );
    if (shocked) return "CRITICAL";
    return alerts.find((a) => a.id === alertId)?.severity ?? "WATCH";
  };

  const watchNodeColor = isDark ? "#e4e4e7" : "#18181b";
  const nodeStroke = isDark ? "#09090b" : "#f4f4f5";
  const textFill = isDark ? "#fafafa" : "#09090b";
  const textHalo = isDark ? "#09090b" : "#f4f4f5";
  const gridStroke = isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(24, 24, 27, 0.09)";
  const landColor = isDark ? "#52525b" : "#71717a";

  return (
    <div className="relative w-full h-[410px] sm:h-[460px] overflow-hidden rounded-b-xl bg-[radial-gradient(circle_at_50%_40%,#ececef,#d4d4d8)] dark:bg-[radial-gradient(circle_at_50%_40%,#18181c,#09090b)]">
      <svg
        viewBox={viewBox.join(" ")}
        preserveAspectRatio="xMidYMid slice"
        className="w-full h-full"
        role="img"
        aria-label="2D dotted world risk map with geopolitical and economic heatmaps"
      >
        <defs>
          <radialGradient id="heatCrit">
            <stop offset="0%" stopColor="#ef4444" stopOpacity="0.52" />
            <stop offset="50%" stopColor="#f59e0b" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#a1a1aa" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="heatElev">
            <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.46" />
            <stop offset="60%" stopColor="#a1a1aa" stopOpacity="0.14" />
            <stop offset="100%" stopColor="#a1a1aa" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="heatWatch">
            <stop offset="0%" stopColor={isDark ? "#e4e4e7" : "#52525b"} stopOpacity="0.34" />
            <stop offset="100%" stopColor={isDark ? "#71717a" : "#71717a"} stopOpacity="0" />
          </radialGradient>
        </defs>

        {[-60, -30, 0, 30, 60, 90, 120, 150].map((lon) => (
          <line
            key={lon}
            x1={px(lon)}
            x2={px(lon)}
            y1={0}
            y2={MH}
            stroke={gridStroke}
            strokeWidth={0.8 * unit}
          />
        ))}
        {[-30, 0, 30, 60].map((lat) => (
          <line
            key={lat}
            y1={py(lat)}
            y2={py(lat)}
            x1={0}
            x2={MW}
            stroke={gridStroke}
            strokeWidth={0.8 * unit}
          />
        ))}

        <path d={landDots.d} stroke={landColor} strokeWidth={landDots.sw} strokeLinecap="round" fill="none" />

        {showHeatmap &&
          allHotspots.map((h) => {
            const weight = computeHotspotWeight(h, heatmapMode);
            const boosted = Math.min(1, weight * (1 + shockLevel * 0.1));
            const gradId = boosted >= 0.84 ? "heatCrit" : boosted >= 0.65 ? "heatElev" : "heatWatch";
            const active = region === "global" || h.regions.includes(region);
            return (
              <circle
                key={`hm-${h.id}`}
                cx={px(h.lon)}
                cy={py(h.lat)}
                r={(28 + boosted * 34) * unit}
                fill={`url(#${gradId})`}
                opacity={active ? 0.82 : 0.18}
              />
            );
          })}

        {showChokepoints &&
          CHOKEPOINTS.map((c) => {
            const x = px(c.lon);
            const y = py(c.lat);
            const s = 5.2 * unit;
            const disrupted = shockLevel >= 1 && (c.name.includes("Suez") || c.name.includes("Black"));
            const st = disrupted ? "DISRUPTED" : c.status;
            const col = st === "DISRUPTED" ? "#ef4444" : st === "CONGESTED" ? "#f59e0b" : "#10b981";
            const active = region === "global" || c.regions.includes(region);
            return (
              <g key={c.name} opacity={active ? 1 : 0.2}>
                <path
                  d={`M${x} ${y - s}L${x + s} ${y}L${x} ${y + s}L${x - s} ${y}Z`}
                  fill={nodeStroke}
                  stroke={col}
                  strokeWidth={1.7 * unit}
                />
                <title>{`${c.name}: ${st}`}</title>
              </g>
            );
          })}

        {showRiskNodes &&
          allHotspots.map((h, idx) => {
            const sev = resolveSev(h.id, h.alertId);
            const col = sev === "CRITICAL" ? "#ef4444" : sev === "ELEVATED" ? "#f59e0b" : watchNodeColor;
            const x = px(h.lon);
            const y = py(h.lat);
            const r = (sev === "CRITICAL" ? 6.2 : 4.4) * unit;
            const active = region === "global" || h.regions.includes(region);
            const shockMatch = Object.entries(SHOCK_HOTSPOT_MAP).find(
              ([sid, hid]) => hid === h.id && Number(sid.slice(1)) <= shockLevel
            );
            const targetAlertId = shockMatch ? shockMatch[0] : h.alertId;
            const showLabel =
              region !== "global" ||
              (sev === "CRITICAL" && idx < 16) ||
              idx < 10 ||
              extraHotspots.some((e) => e.id === h.id);
            return (
              <g
                key={h.id}
                opacity={active ? 1 : 0.2}
                className="cursor-pointer"
                tabIndex={0}
                role="button"
                aria-label={`${h.name}, ${sev}`}
                onClick={() => onSelectHotspot(targetAlertId)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelectHotspot(targetAlertId);
                  }
                }}
              >
                <title>{`${h.name} (${h.country}) · ${h.summary}`}</title>
                <circle cx={x} cy={y} r={r * 1.65} fill={col} fillOpacity={0.16} />
                <circle cx={x} cy={y} r={r} fill={col} stroke={nodeStroke} strokeWidth={1.4 * unit} />
                {showLabel && (
                  <text
                    x={x + r + 3.5 * unit}
                    y={y + 3 * unit}
                    fontSize={10 * unit}
                    fill={textFill}
                    stroke={textHalo}
                    strokeWidth={2.8 * unit}
                    paintOrder="stroke"
                    fontWeight={600}
                  >
                    {h.name}
                  </text>
                )}
              </g>
            );
          })}
      </svg>
    </div>
  );
}
