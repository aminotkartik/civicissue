/**
 * Deterministic fallback AI logic (spec §63).
 *
 * These functions power every "AI" feature when no provider is configured or
 * when the provider fails. They are keyword/heuristic based — transparent,
 * offline and fast.
 */
import type { IssueClassification, ExtractedReport } from "@/lib/ai/provider";

interface KeywordRule {
  slug: string;
  keywords: RegExp;
}

const CATEGORY_RULES: KeywordRule[] = [
  {
    slug: "road-damage",
    keywords: /\b(pothole|potholes|road|crater|asphalt|tar|speed breaker|road damage|gadda|gaddhe|crack)\b/i,
  },
  {
    slug: "streetlight",
    keywords: /\b(street ?light|lamp ?post|lighting|bulb|dark|unlit|illumination)\b/i,
  },
  {
    slug: "garbage-waste",
    keywords: /\b(garbage|waste|trash|litter|dump|dumping|smell|stink|debris|cleaning)\b/i,
  },
  {
    slug: "water-supply",
    keywords: /\b(water|leakage|leaking|pipeline|tap|supply|no water|contaminated|muddy water)\b/i,
  },
  {
    slug: "drainage",
    keywords: /\b(drain|drainage|sewer|sewage|manhole|gutter|overflow|waterlog|blocked)\b/i,
  },
  {
    slug: "traffic-signal",
    keywords: /\b(traffic|signal|zebra crossing|divider|wrong side|congestion|jam)\b/i,
  },
  {
    slug: "footpath",
    keywords: /\b(footpath|sidewalk|pavement|walking path|broken tiles)\b/i,
  },
  {
    slug: "public-infrastructure",
    keywords: /\b(bridge|building|wall|fence|railing|structure|construction|encroach)\b/i,
  },
  {
    slug: "tree-environment",
    keywords: /\b(tree|branch|fallen|trimming|plants|garden|green|pollution|air quality)\b/i,
  },
  {
    slug: "public-safety",
    keywords: /\b(safety|unsafe|crime|theft|harassment|accident|dangerous|hazard|open manhole)\b/i,
  },
  {
    slug: "public-toilet",
    keywords: /\b(toilet|restroom|washroom|urinal|sanitation facility)\b/i,
  },
  {
    slug: "noise",
    keywords: /\b(noise|loud|sound|honking|loudspeaker|music|barking)\b/i,
  },
  {
    slug: "animal-related",
    keywords: /\b(stray|dog|dogs|cattle|cow|monkey|animal|cattle menace)\b/i,
  },
  {
    slug: "public-spaces",
    keywords: /\b(park|playground|bench|swing|public place|open space)\b/i,
  },
];

export function fallbackClassify(
  title: string,
  description: string,
  allowed: { slug: string; name: string }[]
): IssueClassification {
  const text = `${title}. ${description}`;
  const scores = new Map<string, number>();
  for (const rule of CATEGORY_RULES) {
    const matches = text.match(new RegExp(rule.keywords.source, "gi"));
    if (matches) scores.set(rule.slug, (scores.get(rule.slug) ?? 0) + matches.length);
  }
  const allowedSlugs = new Set(allowed.map((a) => a.slug));
  const best = [...scores.entries()]
    .filter(([slug]) => allowedSlugs.has(slug))
    .sort((a, b) => b[1] - a[1])[0];
  if (best) {
    const total = [...scores.values()].reduce((s, v) => s + v, 0) || 1;
    return {
      category: best[0],
      confidence: Math.min(0.92, 0.5 + (best[1] / total) * 0.5),
      severity: fallbackSeverity(text),
      reasoning: "Keyword analysis matched this category in your description.",
      provider: "local-heuristic",
      isFallback: true,
    };
  }
  return {
    category: "other",
    confidence: 0.25,
    severity: fallbackSeverity(text),
    reasoning: "Could not confidently match a category — please pick one.",
    provider: "local-heuristic",
    isFallback: true,
  };
}

const SEVERITY_RULES: [RegExp, "CRITICAL" | "HIGH" | "MEDIUM"][] = [
  [/\b(accident|injur|electrocut|collapse|live wire|child|dangerous|urgent|emergency)\b/i, "CRITICAL"],
  [/\b(huge|large|deep|blocked|overflow|not working|broken|damaged|hazard)\b/i, "HIGH"],
  [/\b(minor|small|slight|inconvenience)\b/i, "MEDIUM"],
];

export function fallbackSeverity(
  text: string
): "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" {
  for (const [re, sev] of SEVERITY_RULES) {
    if (re.test(text)) return sev;
  }
  return "MEDIUM";
}

export function fallbackExtract(
  text: string,
  allowed: { slug: string; name: string }[]
): ExtractedReport {
  const classification = fallbackClassify(text.slice(0, 200), text, allowed);
  const locationMatch = text.match(
    /\b(near|outside|opposite|behind|next to|at)\s+([A-Z][\w'&.\- ]{2,40})/
  );
  const durationMatch = text.match(
    /\b(?:for|since|past|last)\s+(?:the\s+)?(?:last\s+)?(\d+\s+(?:day|days|week|weeks|month|months)|[\w\s-]+)\b/i
  );
  const riskMatch = text.match(
    /[^.]*\b(accident|dangerous|hazard|unsafe|injur\w*|risk|difficult|problem)\b[^.]*/i
  );
  return {
    problem: text.split(/[.\n]/)[0]?.trim().slice(0, 140) || null,
    locationHint: locationMatch?.[2]?.trim() ?? null,
    risk: riskMatch?.[0]?.trim().slice(0, 140) ?? null,
    timeContext: durationMatch?.[1]?.trim() ?? null,
    categorySlug: classification.category,
    severity: classification.severity,
    provider: "local-heuristic",
    isFallback: true,
  };
}

/** Deterministic text similarity: token Jaccard blended with bigram Dice. */
export function textSimilarity(a: string, b: string): number {
  const tokenize = (s: string) =>
    new Set(
      s
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .filter((w) => w.length > 2 && !STOPWORDS.has(w))
    );
  const ta = tokenize(a);
  const tb = tokenize(b);
  if (ta.size === 0 || tb.size === 0) return 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter++;
  const jaccard = inter / (ta.size + tb.size - inter);

  const bigrams = (s: string) => {
    const norm = s.toLowerCase().replace(/[^a-z0-9]/g, "");
    const set = new Set<string>();
    for (let i = 0; i < norm.length - 1; i++) set.add(norm.slice(i, i + 2));
    return set;
  };
  const ba = bigrams(a);
  const bb = bigrams(b);
  let binter = 0;
  for (const g of ba) if (bb.has(g)) binter++;
  const dice = ba.size + bb.size === 0 ? 0 : (2 * binter) / (ba.size + bb.size);

  return Math.min(1, jaccard * 0.6 + dice * 0.4);
}

const STOPWORDS = new Set([
  "the", "and", "for", "with", "this", "that", "from", "there", "have", "has",
  "been", "were", "was", "are", "its", "very", "much", "near", "outside",
]);
