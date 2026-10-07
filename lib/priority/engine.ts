/**
 * Smart Priority Engine (spec §19) — fully deterministic and explainable.
 *
 * Priority = weighted sum of:
 *   - reported severity
 *   - community support (upvotes + confirmations)
 *   - location importance (main road / hospital / school nearby hints, zone)
 *   - safety impact keywords
 *   - reported duration
 *   - infrastructure criticality of the category
 *
 * Score bands: 0–25 LOW · 26–50 MEDIUM · 51–75 HIGH · 76+ CRITICAL
 *
 * Weights are configurable at runtime via the `priority_weights` app setting
 * (Admin → Settings) — defaults live here so the engine works with no config.
 */
import type { Priority, Severity } from "@/lib/types";

export interface PriorityWeights {
  severity: number; // max contribution
  community: number;
  location: number;
  safety: number;
  duration: number;
  category: number;
}

export const DEFAULT_WEIGHTS: PriorityWeights = {
  severity: 40,
  community: 15,
  location: 15,
  safety: 15,
  duration: 5,
  category: 10,
};

export interface PriorityInput {
  severity: Severity;
  categorySlug: string;
  title: string;
  description: string;
  upvotes?: number;
  confirmations?: number;
  /** days since the problem reportedly exists (from description or created) */
  reportedDays?: number;
  locality?: string | null;
  weights?: PriorityWeights;
}

export interface PriorityResult {
  score: number; // 0..100
  priority: Priority;
  explanation: string;
  factors: { label: string; points: number; detail: string }[];
}

const SEVERITY_FACTOR: Record<Severity, number> = {
  LOW: 0.15,
  MEDIUM: 0.45,
  HIGH: 0.75,
  CRITICAL: 1,
};

/** Categories whose failure is inherently high-impact infrastructure. */
const CATEGORY_CRITICALITY: Record<string, number> = {
  "public-safety": 1,
  "traffic-signal": 0.9,
  "road-damage": 0.8,
  drainage: 0.7,
  "water-supply": 0.7,
  streetlight: 0.55,
  footpath: 0.5,
  "public-infrastructure": 0.6,
  "garbage-waste": 0.45,
  "tree-environment": 0.4,
  "public-toilet": 0.4,
  "animal-related": 0.45,
  noise: 0.25,
  "public-spaces": 0.3,
  other: 0.3,
};

const SAFETY_KEYWORDS: [RegExp, string][] = [
  [/\b(accident|collision|crash|injur\w*|hurt|hazard)\b/i, "accident or injury risk mentioned"],
  [/\b(child|children|kid|school|student|elderly|senior|disabled)\b/i, "affects vulnerable road users"],
  [/\b(electroc|shock|spark|live wire|exposed wire|current)\b/i, "electrical danger mentioned"],
  [/\b(sewage|contaminat|unsanitary|disease|mosquito|health)\b/i, "public health risk mentioned"],
  [/\b(collapse|caving|sinkhole|falling|unstable)\b/i, "structural collapse risk mentioned"],
  [/\b(flood|waterlog|submerg\w*|overflow)\b/i, "flooding risk mentioned"],
  [/\b(snake|stray|dog bite|attack|monkey)\b/i, "animal-related safety risk"],
  [/\b(dark|night|no light|unlit)\b/i, "night-time visibility danger"],
];

const LOCATION_KEYWORDS: [RegExp, string][] = [
  [/\b(main road|highway|junction|chowk|intersection|busy)\b/i, "on a major or busy road"],
  [/\b(hospital|clinic|medical)\b/i, "near a hospital"],
  [/\b(school|college|university|campus)\b/i, "near an educational institution"],
  [/\b(bus stop|station|metro|railway|airport)\b/i, "near public transit"],
  [/\b(market|mall|bazaar|commercial)\b/i, "in a commercial area"],
  [/\b(park|playground|garden)\b/i, "in a public recreation space"],
];

const DURATION_PATTERNS: [RegExp, number | ((m: RegExpMatchArray) => number)][] = [
  [/(\d+)\s*(month|months)/i, (m) => Math.min(parseInt(m[1]!, 10) * 30, 365)],
  [/(\d+)\s*(week|weeks)/i, (m) => parseInt(m[1]!, 10) * 7],
  [/(\d+)\s*(day|days)/i, (m) => parseInt(m[1]!, 10)],
  [/(many|several|few)\s+(month|months)/i, () => 90],
  [/(many|several|few)\s+(week|weeks)/i, () => 21],
  [/(long time|ages|forever|months together)/i, () => 60],
];

export function estimateReportedDays(text: string): number | undefined {
  for (const [re, days] of DURATION_PATTERNS) {
    const m = text.match(re);
    if (m) return typeof days === "function" ? days(m) : days;
  }
  return undefined;
}

export function scoreToPriority(score: number): Priority {
  if (score >= 76) return "CRITICAL";
  if (score >= 51) return "HIGH";
  if (score >= 26) return "MEDIUM";
  return "LOW";
}

export function computePriority(input: PriorityInput): PriorityResult {
  const w = { ...DEFAULT_WEIGHTS, ...(input.weights ?? {}) };
  const text = `${input.title}\n${input.description}`;
  const factors: PriorityResult["factors"] = [];

  // 1. Severity reported by citizen.
  const severityPoints = Math.round(w.severity * SEVERITY_FACTOR[input.severity]);
  factors.push({
    label: "Severity",
    points: severityPoints,
    detail: `Reporter marked severity as ${input.severity.toLowerCase()}`,
  });

  // 2. Community support (upvotes + on-ground confirmations, saturating).
  const support = (input.upvotes ?? 0) + (input.confirmations ?? 0) * 1.5;
  const communityPoints = Math.round(
    w.community * Math.min(1, support / 25)
  );
  if (communityPoints > 0) {
    factors.push({
      label: "Community support",
      points: communityPoints,
      detail: `${input.upvotes ?? 0} supporters and ${input.confirmations ?? 0} confirmations`,
    });
  }

  // 3. Location importance.
  const locHits = LOCATION_KEYWORDS.filter(([re]) => re.test(text));
  const locationPoints = Math.round(
    w.location * Math.min(1, locHits.length * 0.5)
  );
  if (locationPoints > 0) {
    factors.push({
      label: "Location importance",
      points: locationPoints,
      detail: locHits.map(([, why]) => why).join("; "),
    });
  }

  // 4. Safety impact keywords.
  const safetyHits = SAFETY_KEYWORDS.filter(([re]) => re.test(text));
  const safetyPoints = Math.round(
    w.safety * Math.min(1, safetyHits.length * 0.4)
  );
  if (safetyPoints > 0) {
    factors.push({
      label: "Safety impact",
      points: safetyPoints,
      detail: safetyHits.map(([, why]) => why).join("; "),
    });
  }

  // 5. Duration the problem has persisted.
  const days = input.reportedDays ?? estimateReportedDays(text);
  const durationPoints = days
    ? Math.round(w.duration * Math.min(1, days / 30))
    : 0;
  if (durationPoints > 0) {
    factors.push({
      label: "Duration",
      points: durationPoints,
      detail: `Problem reported for ~${days} days`,
    });
  }

  // 6. Category infrastructure criticality.
  const categoryPoints = Math.round(
    w.category * (CATEGORY_CRITICALITY[input.categorySlug] ?? 0.3)
  );
  factors.push({
    label: "Infrastructure type",
    points: categoryPoints,
    detail: `Category "${input.categorySlug}" carries a ${Math.round((CATEGORY_CRITICALITY[input.categorySlug] ?? 0.3) * 100)}% criticality weight`,
  });

  const score = Math.min(100, factors.reduce((sum, f) => sum + f.points, 0));
  const priority = scoreToPriority(score);

  const topFactors = [...factors]
    .filter((f) => f.points > 0)
    .sort((a, b) => b.points - a.points)
    .slice(0, 3);
  const explanation = topFactors.length
    ? topFactors.map((f) => f.detail).join(" + ")
    : "Baseline priority from reported severity and category.";

  return { score, priority, explanation, factors };
}

export function formatExplanation(result: PriorityResult): string {
  return result.explanation;
}
