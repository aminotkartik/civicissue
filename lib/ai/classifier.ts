/**
 * AI Feature 1 & 2 — Category classification and description structuring.
 * LLM-backed when configured; deterministic fallback otherwise (spec §63).
 * Output is always validated against the allowed category list.
 */
import {
  getChatProvider,
  logAiFailure,
  parseJsonLoose,
  type IssueClassification,
  type IssueInput,
  type ExtractedReport,
} from "@/lib/ai/provider";
import { fallbackClassify, fallbackExtract, fallbackSeverity } from "@/lib/ai/fallback";

const SYSTEM_PROMPT = `You are CivicIssue's classification assistant. You classify civic complaints into exactly one category and estimate severity. Respond ONLY with JSON: {"category":"<slug>","confidence":<0..1>,"severity":"LOW|MEDIUM|HIGH|CRITICAL","reasoning":"<one short sentence>"}`;

export async function classifyIssue(input: IssueInput): Promise<IssueClassification> {
  const provider = getChatProvider();
  if (!provider) return fallbackClassify(input.title, input.description, input.allowedCategories);

  try {
    const allowedList = input.allowedCategories
      .map((c) => `${c.slug} (${c.name})`)
      .join(", ");
    const raw = await provider.chat(
      [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `Allowed categories: ${allowedList}\n\nTitle: ${input.title}\nDescription: ${input.description}`,
        },
      ],
      { json: true }
    );
    const parsed = parseJsonLoose<{
      category?: string;
      confidence?: number;
      severity?: string;
      reasoning?: string;
    }>(raw);
    const allowedSlugs = new Set(input.allowedCategories.map((c) => c.slug));
    if (!parsed || !parsed.category || !allowedSlugs.has(parsed.category)) {
      // Model hallucinated an invalid category → validate & fall back.
      return fallbackClassify(input.title, input.description, input.allowedCategories);
    }
    const sev = ["LOW", "MEDIUM", "HIGH", "CRITICAL"].includes(parsed.severity ?? "")
      ? (parsed.severity as IssueClassification["severity"])
      : null;
    return {
      category: parsed.category,
      confidence: Math.max(0, Math.min(1, parsed.confidence ?? 0.5)),
      severity: sev,
      reasoning: parsed.reasoning,
      provider: provider.name,
      isFallback: false,
    };
  } catch (err) {
    logAiFailure("classifyIssue", err);
    return fallbackClassify(input.title, input.description, input.allowedCategories);
  }
}

export async function extractFromVoiceOrText(
  text: string,
  allowedCategories: { slug: string; name: string }[]
): Promise<ExtractedReport> {
  const provider = getChatProvider();
  if (!provider) return fallbackExtract(text, allowedCategories);
  try {
    const allowedList = allowedCategories.map((c) => c.slug).join(", ");
    const raw = await provider.chat(
      [
        {
          role: "system",
          content: `Extract structured information from a spoken/typed civic complaint. Respond ONLY with JSON: {"problem":string|null,"location_hint":string|null,"risk":string|null,"time_context":string|null,"category":string|null,"severity":"LOW|MEDIUM|HIGH|CRITICAL"|null}. Category must be one of: ${allowedList}.`,
        },
        { role: "user", content: text },
      ],
      { json: true }
    );
    const parsed = parseJsonLoose<Record<string, string | null>>(raw);
    if (!parsed) return fallbackExtract(text, allowedCategories);
    const allowedSlugs = new Set(allowedCategories.map((c) => c.slug));
    const cat = parsed.category && allowedSlugs.has(parsed.category) ? parsed.category : null;
    const sev = ["LOW", "MEDIUM", "HIGH", "CRITICAL"].includes(parsed.severity ?? "")
      ? (parsed.severity as ExtractedReport["severity"])
      : fallbackSeverity(text);
    return {
      problem: parsed.problem ?? null,
      locationHint: parsed.location_hint ?? null,
      risk: parsed.risk ?? null,
      timeContext: parsed.time_context ?? null,
      categorySlug: cat,
      severity: sev,
      provider: provider.name,
      isFallback: false,
    };
  } catch (err) {
    logAiFailure("extractFromText", err);
    return fallbackExtract(text, allowedCategories);
  }
}

/**
 * AI Feature — image analysis (multimodal, spec §15).
 * Falls back to a neutral "unavailable" result; never blocks submission.
 */
export async function analyzeImage(
  base64: string,
  mimeType: string
) {
  const provider = getChatProvider();
  if (!provider) {
    return {
      detectedIssue: null,
      severityEstimate: null,
      confidence: 0,
      observations: [],
      provider: "local-heuristic",
      isFallback: true,
    };
  }
  try {
    const raw = await provider.chat(
      [
        {
          role: "system",
          content:
            'You analyze photos of civic problems. Respond ONLY with JSON: {"detected_issue":string|null,"severity_estimate":"LOW|MEDIUM|HIGH|CRITICAL"|null,"confidence":0..1,"observations":[string,...]}',
        },
        {
          role: "user",
          content: [
            { type: "text", text: "Describe the civic issue visible in this photo." },
            {
              type: "image_url",
              image_url: { url: `data:${mimeType};base64,${base64}` },
            },
          ],
        },
      ],
      { json: true, model: provider.vision }
    );
    const parsed = parseJsonLoose<{
      detected_issue?: string;
      severity_estimate?: string;
      confidence?: number;
      observations?: string[];
    }>(raw);
    if (!parsed) throw new Error("unparseable vision response");
    return {
      detectedIssue: parsed.detected_issue ?? null,
      severityEstimate: ["LOW", "MEDIUM", "HIGH", "CRITICAL"].includes(
        parsed.severity_estimate ?? ""
      )
        ? (parsed.severity_estimate as "LOW" | "MEDIUM" | "HIGH" | "CRITICAL")
        : null,
      confidence: Math.max(0, Math.min(1, parsed.confidence ?? 0.5)),
      observations: Array.isArray(parsed.observations)
        ? parsed.observations.slice(0, 6).map(String)
        : [],
      provider: provider.name,
      isFallback: false,
    };
  } catch (err) {
    logAiFailure("analyzeImage", err);
    return {
      detectedIssue: null,
      severityEstimate: null,
      confidence: 0,
      observations: [],
      provider: provider.name,
      isFallback: true,
    };
  }
}
