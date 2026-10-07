/**
 * AI Feature 4 — Duplicate detection (spec §20).
 *
 * Pipeline (deterministic core + optional LLM refinement):
 *  1. Candidate recall: same category, open status, within ~1.5 km, last 90 days.
 *  2. Deterministic similarity: text similarity × proximity × recency.
 *  3. Optional LLM adjudication for the top candidates when configured.
 *
 * The system never forces a merge — citizens choose to support or create new.
 */
import { and, eq, gte, inArray, lte, ne } from "drizzle-orm";
import { issues, categories } from "@/drizzle/sqlite/schema";
import { getDb } from "@/lib/db";
import { boundingBox, haversineKm } from "@/lib/maps/geo";
import { textSimilarity } from "@/lib/ai/fallback";
import {
  getChatProvider,
  logAiFailure,
  parseJsonLoose,
  type DuplicateCandidate,
  type DuplicateResult,
} from "@/lib/ai/provider";
import { OPEN_STATUSES } from "@/lib/types";

export interface DuplicateSearchInput {
  title: string;
  description: string;
  categorySlug: string;
  latitude: number;
  longitude: number;
  excludeIssueId?: string;
  radiusKm?: number;
}

export async function findDuplicateCandidates(
  input: DuplicateSearchInput
): Promise<DuplicateResult> {
  const db = await getDb();
  const radiusKm = input.radiusKm ?? 1.5;
  const box = boundingBox(input.latitude, input.longitude, radiusKm);
  const since = new Date(Date.now() - 90 * 24 * 3600 * 1000);

  const catRows = await db
    .select({ id: categories.id })
    .from(categories)
    .where(eq(categories.slug, input.categorySlug))
    .limit(1);
  const categoryId = catRows[0]?.id;

  const conditions = [
    inArray(issues.status, [...OPEN_STATUSES, "RESOLVED"]),
    gte(issues.latitude, box.minLat),
    lte(issues.latitude, box.maxLat),
    gte(issues.longitude, box.minLng),
    lte(issues.longitude, box.maxLng),
    gte(issues.createdAt, since),
    eq(issues.isPublic, true),
    eq(issues.isHidden, false),
  ];
  if (categoryId) conditions.push(eq(issues.categoryId, categoryId));
  if (input.excludeIssueId) conditions.push(ne(issues.id, input.excludeIssueId));

  const rows = await db
    .select({
      id: issues.id,
      publicId: issues.publicId,
      title: issues.title,
      description: issues.description,
      latitude: issues.latitude,
      longitude: issues.longitude,
      createdAt: issues.createdAt,
      upvotesCount: issues.upvotesCount,
      status: issues.status,
      categoryName: categories.name,
    })
    .from(issues)
    .innerJoin(categories, eq(issues.categoryId, categories.id))
    .where(and(...conditions))
    .limit(50);

  // Deterministic scoring.
  const scored = rows
    .map((r) => {
      const distanceMeters =
        haversineKm(input.latitude, input.longitude, r.latitude, r.longitude) * 1000;
      const textSim = textSimilarity(
        `${input.title} ${input.description}`,
        `${r.title} ${r.description}`
      );
      const proximity = Math.max(0, 1 - distanceMeters / (radiusKm * 1000));
      const ageDays = (Date.now() - r.createdAt.getTime()) / 86_400_000;
      const recency = Math.max(0.3, 1 - ageDays / 90);
      const similarity = Math.min(
        0.99,
        textSim * 0.6 + proximity * 0.3 + recency * 0.1
      );
      const candidate: DuplicateCandidate = {
        publicId: r.publicId,
        title: r.title,
        description: r.description,
        categoryName: r.categoryName,
        distanceMeters: Math.round(distanceMeters),
        createdAt: r.createdAt,
        upvotes: r.upvotesCount,
        status: r.status,
      };
      return {
        ...candidate,
        similarity: round2(similarity),
        likelyDuplicate: similarity >= 0.62,
        reasoning: undefined as string | undefined,
      };
    })
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 5);

  if (scored.length === 0) {
    return { candidates: [], provider: "local-heuristic", isFallback: true };
  }

  // Optional LLM refinement of the top candidates.
  const provider = getChatProvider();
  if (provider) {
    try {
      const raw = await provider.chat(
        [
          {
            role: "system",
            content:
              'You judge whether a new civic complaint duplicates existing nearby complaints. Respond ONLY with JSON: {"results":[{"publicId":string,"likelyDuplicate":boolean,"reasoning":"short sentence"}]}',
          },
          {
            role: "user",
            content: `New complaint:\nTitle: ${input.title}\nDescription: ${input.description}\n\nCandidates:\n${JSON.stringify(
              scored.map((s) => ({
                publicId: s.publicId,
                title: s.title,
                description: s.description.slice(0, 300),
                distanceMeters: s.distanceMeters,
              })),
              null,
              1
            )}`,
          },
        ],
        { json: true }
      );
      const parsed = parseJsonLoose<{
        results?: { publicId: string; likelyDuplicate: boolean; reasoning?: string }[];
      }>(raw);
      if (parsed?.results) {
        for (const r of parsed.results) {
          const target = scored.find((s) => s.publicId === r.publicId);
          if (target) {
            target.likelyDuplicate = r.likelyDuplicate && target.similarity >= 0.4;
            target.reasoning = r.reasoning;
          }
        }
        return { candidates: scored, provider: provider.name, isFallback: false };
      }
    } catch (err) {
      logAiFailure("detectDuplicates", err);
    }
  }

  return { candidates: scored, provider: "local-heuristic", isFallback: true };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
