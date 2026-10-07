"use client";

import { useEffect, useState } from "react";

interface Pin {
  x: number;
  y: number;
  color: string;
  delay: number;
}

const PINS: Pin[] = [
  { x: 88, y: 150, color: "#c04545", delay: 0 },
  { x: 210, y: 96, color: "#d9930d", delay: 0.4 },
  { x: 305, y: 175, color: "#4d8a5b", delay: 0.9 },
  { x: 152, y: 232, color: "#3f6f9f", delay: 1.4 },
  { x: 388, y: 110, color: "#4d8a5b", delay: 1.9 },
  { x: 340, y: 250, color: "#d9930d", delay: 2.4 },
  { x: 60, y: 66, color: "#7a5aa6", delay: 2.9 },
  { x: 430, y: 210, color: "#c04545", delay: 3.3 },
];

export interface HeroMapProps {
  resolvedToday: number;
  latestResolved?: { publicId: string; title: string; locality: string | null } | null;
}

/** Stylized city-map hero visual with live-pulsing issue pins (pure SVG). */
export function HeroMap({ resolvedToday, latestResolved }: HeroMapProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <div className="relative overflow-hidden rounded-2xl border border-line bg-[#f4efe7] shadow-pop">
      <svg viewBox="0 0 500 320" className="h-full w-full" role="img" aria-label="Illustration of a city map with civic issue markers">
        {/* parks & water */}
        <rect x="0" y="0" width="500" height="320" fill="#f1ece1" />
        <path d="M0 260 Q 120 240 220 270 T 500 250 L500 320 L0 320Z" fill="#dfe8dd" />
        <path d="M390 0 Q 420 80 470 120 L500 130 L500 0 Z" fill="#d8e3ee" />
        <circle cx="120" cy="80" r="34" fill="#dfe8dd" />
        {/* road grid */}
        <g stroke="#ffffff" strokeWidth="10" strokeLinecap="round">
          <path d="M-10 120 H 510" />
          <path d="M-10 210 H 510" />
          <path d="M90 -10 V 330" />
          <path d="M250 -10 V 330" />
          <path d="M410 -10 V 330" />
        </g>
        <g stroke="#e7dfd2" strokeWidth="2" strokeDasharray="6 8">
          <path d="M-10 120 H 510" />
          <path d="M-10 210 H 510" />
          <path d="M90 -10 V 330" />
          <path d="M250 -10 V 330" />
          <path d="M410 -10 V 330" />
        </g>
        {/* buildings */}
        <g fill="#e2d9c8">
          <rect x="110" y="140" width="42" height="30" rx="3" />
          <rect x="170" y="132" width="54" height="38" rx="3" />
          <rect x="280" y="140" width="40" height="32" rx="3" />
          <rect x="330" y="130" width="52" height="42" rx="3" />
          <rect x="110" y="230" width="50" height="34" rx="3" />
          <rect x="290" y="232" width="46" height="30" rx="3" />
          <rect x="425" y="140" width="40" height="36" rx="3" />
        </g>
        {/* pins */}
        {PINS.map((p, i) => (
          <g key={i} transform={`translate(${p.x} ${p.y})`}>
            {mounted && (
              <circle r="14" fill={p.color} opacity="0.25">
                <animate attributeName="r" values="8;20;8" dur="2.8s" begin={`${p.delay}s`} repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.35;0;0.35" dur="2.8s" begin={`${p.delay}s`} repeatCount="indefinite" />
              </circle>
            )}
            <path
              d="M0 -20 C -8.5 -20 -15 -13.5 -15 -5.5 C -15 5 0 17 0 17 C 0 17 15 5 15 -5.5 C 15 -13.5 8.5 -20 0 -20 Z"
              fill={p.color}
              stroke="#fff"
              strokeWidth="2"
            />
            <circle cy="-6" r="4.5" fill="#fff" opacity="0.9" />
          </g>
        ))}
      </svg>
      {/* floating status chip */}
      <div className="absolute left-4 top-4 rounded-xl border border-line bg-surface/95 px-3.5 py-2.5 shadow-card backdrop-blur">
        <p className="text-[10px] font-bold uppercase tracking-wider text-ink-muted">Live in your city</p>
        <p className="mt-0.5 flex items-center gap-1.5 text-sm font-semibold text-ink">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-verdant opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-verdant" />
          </span>
          {resolvedToday} issue{resolvedToday === 1 ? "" : "s"} resolved today
        </p>
      </div>
      {latestResolved && (
        <div className="absolute bottom-4 right-4 max-w-[240px] rounded-xl border border-line bg-surface/95 px-3.5 py-2.5 shadow-card backdrop-blur">
          <p className="font-mono text-[10px] tracking-wide text-ink-muted">{latestResolved.publicId}</p>
          <p className="truncate text-xs font-semibold text-verdant">✓ {latestResolved.title}</p>
        </div>
      )}
    </div>
  );
}
