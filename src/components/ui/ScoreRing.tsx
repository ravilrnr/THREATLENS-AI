import type { RiskBand } from "@/types";

const BAND_COLORS: Record<RiskBand, string> = {
  low: "#34d399",
  medium: "#fbbf24",
  high: "#fb923c",
  critical: "#fb7185",
};

export function ScoreRing({
  score,
  severity,
  size = 132,
  label = "Risk score",
}: {
  score: number;
  severity: RiskBand;
  size?: number;
  label?: string;
}) {
  const clamped = Math.min(100, Math.max(0, Math.round(score)));
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const dash = (clamped / 100) * circumference;
  const color = BAND_COLORS[severity];

  return (
    <div
      className="relative shrink-0"
      style={{ width: size, height: size }}
      role="img"
      aria-label={`${label}: ${clamped} out of 100, ${severity}`}
    >
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke="rgba(59,130,190,0.22)"
          strokeWidth="8"
        />
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference - dash}`}
          style={{ filter: `drop-shadow(0 0 6px ${color}55)` }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <span className="tabular block text-[1.85rem] font-bold leading-none text-white">
            {clamped}
          </span>
          <span className="mono mt-1 block text-[0.55rem] uppercase tracking-[0.16em] text-slate-500">
            / 100
          </span>
        </div>
      </div>
    </div>
  );
}
