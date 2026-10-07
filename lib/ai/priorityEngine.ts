/**
 * AI Feature 3 — Priority recommendation (spec §50).
 *
 * The deterministic engine (lib/priority/engine.ts) computes the actual
 * priority score and explanation. When an LLM is configured we additionally
 * ask it for a natural-language recommendation, but it can NEVER override
 * the deterministic result — it is displayed as advice only.
 */
import { computePriority, type PriorityInput, type PriorityResult } from "@/lib/priority/engine";
import { getChatProvider, logAiFailure, parseJsonLoose } from "@/lib/ai/provider";

export interface AiPriorityAdvice {
  recommended: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  reason: string;
  provider: string;
}

export function computeDeterministicPriority(input: PriorityInput): PriorityResult {
  return computePriority(input);
}

export async function getAiPriorityAdvice(
  input: PriorityInput
): Promise<AiPriorityAdvice | null> {
  const provider = getChatProvider();
  if (!provider) return null;
  try {
    const raw = await provider.chat(
      [
        {
          role: "system",
          content:
            'You recommend a civic complaint priority. Respond ONLY with JSON: {"recommended":"LOW|MEDIUM|HIGH|CRITICAL","reason":"one clear sentence"}',
        },
        {
          role: "user",
          content: `Category: ${input.categorySlug}\nSeverity: ${input.severity}\nSupporters: ${input.upvotes ?? 0}\nTitle: ${input.title}\nDescription: ${input.description}`,
        },
      ],
      { json: true }
    );
    const parsed = parseJsonLoose<{ recommended?: string; reason?: string }>(raw);
    if (!parsed?.recommended) return null;
    const allowed = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
    if (!allowed.includes(parsed.recommended as (typeof allowed)[number])) return null;
    return {
      recommended: parsed.recommended as AiPriorityAdvice["recommended"],
      reason: parsed.reason ?? "AI recommendation.",
      provider: provider.name,
    };
  } catch (err) {
    logAiFailure("priorityAdvice", err);
    return null;
  }
}
