"use client";

/**
 * Small hand-made charts for the admin Overview (plain SVG, no library):
 *   Sparkline  -> a tiny line in a KPI tile (decoration for the number, no hover)
 *   DailyBars  -> sign-ups per day, with a tooltip on hover or keyboard focus
 *   SplitBar   -> candidates vs recruiters, one bar split in two, with a legend
 *
 * Colors: one series = the brand purple. Two series = purple + teal, a pair
 * checked for color-blind readers (also labeled with words, never color alone).
 */

import { useEffect, useId, useRef, useState } from "react";

import styles from "../overview.module.css";
import type { Day } from "../insights";

export const SERIES_COLORS = ["#7c3aed", "#0e9f8e"] as const;

/* ---------------- Sparkline ---------------- */

export function Sparkline({ values, width = 120, height = 36 }: { values: number[]; width?: number; height?: number }) {
  const gradientId = useId();
  if (values.length < 2) return null;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const span = max - min || 1;
  const pad = 3;
  const points = values.map((value, index) => {
    const x = (index / (values.length - 1)) * width;
    const y = height - pad - ((value - min) / span) * (height - pad * 2);
    return [x, y] as const;
  });
  const line = points.map(([x, y], index) => `${index === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${line} L${width},${height} L0,${height} Z`;
  const [lastX, lastY] = points[points.length - 1];

  return (
    <svg className={styles.sparkline} viewBox={`0 0 ${width} ${height}`} width={width} height={height} aria-hidden="true">
      <defs>
        <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor={SERIES_COLORS[0]} stopOpacity="0.18" />
          <stop offset="1" stopColor={SERIES_COLORS[0]} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gradientId})`} />
      <path d={line} fill="none" stroke={SERIES_COLORS[0]} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={lastX} cy={lastY} r="3" fill={SERIES_COLORS[0]} stroke="var(--card-color)" strokeWidth="2" />
    </svg>
  );
}

/* ---------------- Sign-ups per day ---------------- */

export function DailyBars({ days, noun }: { days: Day[]; noun: [string, string] }) {
  const [hovered, setHovered] = useState<number | null>(null);
  // Draw at the box's real width, so text stays 12px on a phone too (no shrinking).
  const boxRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);
  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(240, Math.round(entry.contentRect.width))));
    observer.observe(box);
    return () => observer.disconnect();
  }, []);

  const height = 200;
  const top = 12;
  const bottom = 26; // room for day labels
  const left = 28; // room for the numbers on the guide lines
  const plot = height - top - bottom;
  const max = Math.max(1, ...days.map((day) => day.count));
  // The top guide line: the tallest bar rounded up to an EVEN number,
  // so the middle line is a whole number too (3 -> 4, middle 2; never "1.5").
  const ceiling = Math.max(2, Math.ceil(max / 2) * 2);
  const slot = (width - left) / days.length;
  const barWidth = Math.min(28, slot - 8);
  const say = (count: number) => `${count} ${count === 1 ? noun[0] : noun[1]}`;
  // Label the first, middle and last day only: enough to read the dates without clutter.
  const labelled = new Set([0, Math.floor(days.length / 2), days.length - 1]);
  const active = hovered === null ? null : days[hovered];

  return (
    <div className={styles.chartBox} ref={boxRef}>
      <svg
        className={styles.chart}
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`${say(days.reduce((sum, day) => sum + day.count, 0))} in the last ${days.length} days`}
        onMouseLeave={() => setHovered(null)}
      >
        {/* Recessive guide lines: the top value and the middle. */}
        {[1, 0.5].map((share) => {
          const y = top + plot * (1 - share);
          return (
            <g key={share}>
              <line x1={left} x2={width} y1={y} y2={y} className={styles.gridLine} />
              <text x={left - 8} y={y + 4} textAnchor="end" className={styles.axisText}>
                {ceiling * share}
              </text>
            </g>
          );
        })}
        <line x1={left} x2={width} y1={top + plot} y2={top + plot} className={styles.baseLine} />

        {days.map((day, index) => {
          const x = left + index * slot + (slot - barWidth) / 2;
          const barHeight = day.count === 0 ? 0 : Math.max(4, (day.count / ceiling) * plot);
          const y = top + plot - barHeight;
          const radius = Math.min(4, barHeight / 2);
          return (
            <g
              key={day.start}
              tabIndex={0}
              role="img"
              aria-label={`${day.label}: ${say(day.count)}`}
              className={styles.barGroup}
              onMouseEnter={() => setHovered(index)}
              onFocus={() => setHovered(index)}
              onBlur={() => setHovered(null)}
            >
              {/* A full-height hit area: easier to hover than a short bar. */}
              <rect x={left + index * slot} y={top} width={slot} height={plot} fill="transparent" />
              {barHeight > 0 && (
                <path
                  d={`M${x},${top + plot} V${y + radius} Q${x},${y} ${x + radius},${y} H${x + barWidth - radius} Q${x + barWidth},${y} ${x + barWidth},${y + radius} V${top + plot} Z`}
                  fill={SERIES_COLORS[0]}
                  opacity={hovered === null || hovered === index ? 1 : 0.45}
                />
              )}
              {labelled.has(index) && (
                <text
                  x={left + index * slot + slot / 2}
                  y={height - 6}
                  textAnchor={index === 0 ? "start" : index === days.length - 1 ? "end" : "middle"}
                  className={styles.axisText}
                >
                  {day.label}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {active && hovered !== null && (
        <div
          className={styles.tooltip}
          style={{ left: left + (hovered + 0.5) * slot }}
          role="status"
        >
          <strong>{say(active.count)}</strong>
          <span>{active.label}</span>
        </div>
      )}
    </div>
  );
}

/* ---------------- Candidates vs recruiters ---------------- */

export function SplitBar({ parts }: { parts: { label: string; value: number }[] }) {
  const total = parts.reduce((sum, part) => sum + part.value, 0);
  const percent = (value: number) => (total === 0 ? 0 : Math.round((value / total) * 100));

  return (
    <div className={styles.split}>
      <div className={styles.splitBar} role="img" aria-label={parts.map((part) => `${part.label}: ${part.value}`).join(", ")}>
        {total === 0 ? (
          <span className={styles.splitEmpty} />
        ) : (
          parts.map((part, index) =>
            part.value > 0 ? (
              <span
                key={part.label}
                style={{ flexGrow: part.value, background: SERIES_COLORS[index] }}
                title={`${part.label}: ${part.value} (${percent(part.value)}%)`}
              />
            ) : null
          )
        )}
      </div>
      <ul className={styles.legend}>
        {parts.map((part, index) => (
          <li key={part.label}>
            <span className={styles.swatch} style={{ background: SERIES_COLORS[index] }} aria-hidden="true" />
            <span className={styles.legendLabel}>{part.label}</span>
            <strong>{part.value}</strong>
            <span className={styles.legendShare}>{percent(part.value)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
