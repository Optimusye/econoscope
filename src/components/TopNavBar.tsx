import { motion } from "motion/react";
import type { TabView } from "../types/econoscope";

interface TopNavBarProps {
  activeView: TabView;
  onSelectView: (view: TabView) => void;
  onOpenJudgeTour: () => void;
}

const NAV_LINKS: Array<{ id: TabView; label: string }> = [
  { id: "command", label: "Command" },
  { id: "atlas", label: "3D Atlas" },
  { id: "inflation", label: "Inflation" },
  { id: "supply", label: "Supply" },
  { id: "plugins", label: "Plugins" },
  { id: "eco", label: "ECO" },
  { id: "pricing", label: "Pricing" },
];

export function TopNavBar({ activeView, onSelectView, onOpenJudgeTour }: TopNavBarProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-zinc-900/10 dark:border-white/10 bg-white/75 dark:bg-zinc-950/75 backdrop-blur-2xl">
      <div className="mx-auto flex max-w-[1480px] items-center justify-between gap-6 px-4 sm:px-6 py-3.5">
        {/* Zone 1: Single-line Brand Wordmark */}
        <button
          type="button"
          onClick={() => onSelectView("command")}
          className="font-display text-lg font-bold tracking-tight text-zinc-950 dark:text-white whitespace-nowrap shrink-0 hover:opacity-75 transition-opacity cursor-pointer"
        >
          EconoScope
        </button>

        {/* Zone 2: Concise Single-Line Navigation Links */}
        <nav aria-label="Primary workspace navigation" className="hidden md:flex items-center gap-5 lg:gap-7">
          {NAV_LINKS.map((item) => {
            const active = activeView === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectView(item.id)}
                className={`relative py-1 text-sm font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                  active
                    ? "text-zinc-950 dark:text-white font-semibold"
                    : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
                }`}
              >
                {item.label}
                {active && (
                  <motion.span
                    layoutId="nav-active-underline"
                    transition={{ type: "spring", stiffness: 420, damping: 32 }}
                    className="absolute inset-x-0 -bottom-1 h-0.5 rounded-full bg-zinc-950 dark:bg-white"
                  />
                )}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Primary Action Button */}
        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={onOpenJudgeTour}
            className="rounded-lg bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 px-4 py-2 text-xs font-semibold shadow-sm hover:opacity-90 transition-opacity whitespace-nowrap shrink-0 cursor-pointer"
          >
            Judge Demo Tour
          </button>
        </div>
      </div>

      {/* Mobile horizontal nav row */}
      <nav aria-label="Mobile workspace navigation" className="flex md:hidden items-center gap-2 overflow-x-auto px-4 pb-2.5">
        {NAV_LINKS.map((item) => {
          const active = activeView === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectView(item.id)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
                active
                  ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-950"
                  : "text-zinc-600 dark:text-zinc-300 border border-transparent hover:text-zinc-950 dark:hover:text-white"
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </nav>
    </header>
  );
}
