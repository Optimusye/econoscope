import { useMemo, useState } from "react";
import type { ThemeMode } from "../types/econoscope";

interface LineChartProps {
  theme?: ThemeMode;
  labels: string[];
  realTimeSeries: number[];
  officialSeries: number[];
  realTimeLabel: string;
}

export function InflationLineChart({
  theme = "dark",
  labels,
  realTimeSeries,
  officialSeries,
  realTimeLabel,
}: LineChartProps) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const isDark = theme === "dark";

  const W = 720;
  const H = 260;
  const pad = { top: 20, right: 20, bottom: 32, left: 46 };
  const plotW = W - pad.left - pad.right;
  const plotH = H - pad.top - pad.bottom;

  const { minY, maxY, yTicks, rtPath, rtAreaPath, offPath, rtPoints, offPoints } = useMemo(() => {
    const all = [...realTimeSeries, ...officialSeries];
    const rawMin = Math.min(...all);
    const rawMax = Math.max(...all);
    const margin = Math.max(0.6, (rawMax - rawMin) * 0.18);
    const minVal = Math.max(0, Math.floor((rawMin - margin) * 2) / 2);
    const maxVal = Math.ceil((rawMax + margin) * 2) / 2;
    const span = Math.max(1, maxVal - minVal);

    const xAt = (i: number) => pad.left + (i / Math.max(1, labels.length - 1)) * plotW;
    const yAt = (v: number) => pad.top + ((maxVal - v) / span) * plotH;

    const rtPts = realTimeSeries.map((v, i) => ({ x: xAt(i), y: yAt(v), v }));
    const offPts = officialSeries.map((v, i) => ({ x: xAt(i), y: yAt(v), v }));

    const rtLine = rtPts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
    const rtArea = `${rtLine} L${rtPts[rtPts.length - 1]?.x.toFixed(1) ?? pad.left} ${(pad.top + plotH).toFixed(1)} L${pad.left} ${(pad.top + plotH).toFixed(1)} Z`;

    let offLine = "";
    offPts.forEach((p, i) => {
      if (i === 0) {
        offLine += `M${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
      } else {
        offLine += ` L${p.x.toFixed(1)} ${offPts[i - 1].y.toFixed(1)} L${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
      }
    });

    const ticks = Array.from({ length: 5 }, (_, i) => {
      const val = minVal + (span * i) / 4;
      return { val, y: yAt(val) };
    });

    return {
      minY: minVal,
      maxY: maxVal,
      yTicks: ticks,
      rtPath: rtLine,
      rtAreaPath: rtArea,
      offPath: offLine,
      rtPoints: rtPts,
      offPoints: offPts,
    };
  }, [labels.length, officialSeries, plotH, plotW, realTimeSeries]);

  const xLabelIndices = useMemo(() => {
    const count = labels.length;
    if (count <= 6) return labels.map((_, i) => i);
    const step = Math.floor((count - 1) / 5);
    return [0, step, step * 2, step * 3, step * 4, count - 1];
  }, [labels]);

  const activeIdx = hoverIdx !== null ? hoverIdx : labels.length - 1;
  const activePt = rtPoints[activeIdx];
  const activeOff = offPoints[activeIdx];

  const primaryStroke = isDark ? "#fafafa" : "#18181b";
  const gridStroke = isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(24, 24, 27, 0.1)";
  const tickColor = isDark ? "#a1a1aa" : "#52525b";
  const dotBgStroke = isDark ? "#09090b" : "#f4f4f5";

  return (
    <div className="w-full">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 pt-3 text-xs">
        <div className="flex items-center gap-5 text-zinc-700 dark:text-zinc-300">
          <span className="inline-flex items-center gap-2">
            <span className="inline-block w-3 h-0.5 bg-zinc-900 dark:bg-white" />
            <span>{realTimeLabel}</span>
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="inline-block w-3 h-0.5 border-t-2 border-dashed border-emerald-500 dark:border-emerald-400" />
            <span>Official CPI (lagging)</span>
          </span>
        </div>
        {activePt && activeOff && (
          <div className="font-mono text-[11px] text-zinc-600 dark:text-zinc-300 tabular-nums">
            <span className="text-zinc-500 dark:text-zinc-400 mr-2">{labels[activeIdx]}</span>
            <span className="text-zinc-950 dark:text-white font-semibold mr-3">{activePt.v.toFixed(2)}%</span>
            <span className="text-emerald-600 dark:text-emerald-300 font-semibold">CPI {activeOff.v.toFixed(2)}%</span>
          </div>
        )}
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-[250px] select-none"
        role="img"
        aria-label="Real-time inflation index versus lagging official CPI chart"
        onMouseLeave={() => setHoverIdx(null)}
      >
        <defs>
          <linearGradient id="monoAreaFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={primaryStroke} stopOpacity="0.22" />
            <stop offset="100%" stopColor={primaryStroke} stopOpacity="0.01" />
          </linearGradient>
        </defs>

        {yTicks.map((t, i) => (
          <g key={i}>
            <line
              x1={pad.left}
              x2={W - pad.right}
              y1={t.y}
              y2={t.y}
              stroke={gridStroke}
              strokeWidth={1}
            />
            <text
              x={pad.left - 8}
              y={t.y + 4}
              textAnchor="end"
              fill={tickColor}
              fontSize="10"
              fontFamily="JetBrains Mono, monospace"
            >
              {t.val.toFixed(1)}%
            </text>
          </g>
        ))}

        {xLabelIndices.map((idx) => {
          const x = pad.left + (idx / Math.max(1, labels.length - 1)) * plotW;
          return (
            <text
              key={idx}
              x={x}
              y={H - 8}
              textAnchor="middle"
              fill={tickColor}
              fontSize="10"
              fontFamily="JetBrains Mono, monospace"
            >
              {labels[idx]}
            </text>
          );
        })}

        <path d={rtAreaPath} fill="url(#monoAreaFill)" />
        <path d={offPath} fill="none" stroke="#10b981" strokeWidth="2" strokeDasharray="5 4" />
        <path d={rtPath} fill="none" stroke={primaryStroke} strokeWidth="2.5" strokeLinejoin="round" />

        {activePt && (
          <g>
            <line
              x1={activePt.x}
              x2={activePt.x}
              y1={pad.top}
              y2={pad.top + plotH}
              stroke={isDark ? "rgba(255,255,255,0.28)" : "rgba(24,24,27,0.28)"}
              strokeDasharray="3 3"
            />
            <circle cx={activePt.x} cy={activePt.y} r="4.5" fill={primaryStroke} stroke={dotBgStroke} strokeWidth="2" />
            {activeOff && (
              <circle cx={activeOff.x} cy={activeOff.y} r="4" fill="#10b981" stroke={dotBgStroke} strokeWidth="2" />
            )}
          </g>
        )}

        {rtPoints.map((pt, idx) => {
          const colW = plotW / Math.max(1, rtPoints.length);
          return (
            <rect
              key={idx}
              x={pt.x - colW / 2}
              y={pad.top}
              width={colW}
              height={plotH}
              fill="transparent"
              onMouseEnter={() => setHoverIdx(idx)}
            />
          );
        })}
      </svg>
      <span className="sr-only">
        Range {minY.toFixed(1)}% to {maxY.toFixed(1)}%
      </span>
    </div>
  );
}

interface PortBarChartProps {
  items: Array<{ name: string; value: number }>;
}

export function HorizontalBarChart({ items }: PortBarChartProps) {
  const maxVal = Math.max(7, ...items.map((i) => i.value));
  return (
    <div className="space-y-3 p-4">
      {items.map((item) => {
        const pct = Math.min(100, (item.value / maxVal) * 100);
        const barColor =
          item.value >= 5
            ? "from-red-500 to-rose-400"
            : item.value >= 3
              ? "from-amber-500 to-amber-300"
              : "from-zinc-700 to-zinc-900 dark:from-zinc-400 dark:to-zinc-100";
        return (
          <div key={item.name} className="grid grid-cols-[120px_1fr_54px] items-center gap-3 text-xs">
            <span className="truncate text-zinc-900 dark:text-zinc-200 font-medium">{item.name}</span>
            <div className="h-2.5 rounded-full bg-zinc-200 dark:bg-zinc-900/90 overflow-hidden border border-zinc-900/10 dark:border-white/10">
              <div
                className={`h-full rounded-full bg-gradient-to-r ${barColor} transition-all duration-300`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="font-mono text-right text-zinc-700 dark:text-zinc-300 tabular-nums">
              {item.value.toFixed(1)}d
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function RadialGauge({
  value,
  size = 56,
  theme = "dark",
}: {
  value: number;
  size?: number;
  theme?: ThemeMode;
}) {
  const isDark = theme === "dark";
  const r = size / 2 - 6;
  const c = 2 * Math.PI * r;
  const strokeColor =
    value >= 70 ? "#ef4444" : value >= 45 ? "#f59e0b" : isDark ? "#e4e4e7" : "#27272a";
  const trackColor = isDark ? "rgba(255, 255, 255, 0.12)" : "rgba(24, 24, 27, 0.12)";
  const textColor = isDark ? "#fafafa" : "#09090b";
  const dash = (c * Math.min(100, Math.max(0, value))) / 100;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${Math.round(value)} percent`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={trackColor} strokeWidth="5.5" />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={strokeColor}
        strokeWidth="5.5"
        strokeLinecap="round"
        strokeDasharray={`${dash} ${c}`}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text
        x="50%"
        y="50%"
        textAnchor="middle"
        dominantBaseline="central"
        fill={textColor}
        fontSize={size / 4.2}
        fontWeight="700"
        fontFamily="JetBrains Mono, monospace"
      >
        {Math.round(value)}%
      </text>
    </svg>
  );
}
