/**
 * AI provider abstraction (spec §108).
 *
 * A single interface (`AIProvider`) hides the concrete vendor. Implementations:
 *  - `GroqProvider` / `OpenAIProvider` — chat-completions compatible HTTP APIs
 *  - `NoopProvider` — used when no API key is configured; every AI feature
 *    falls back to deterministic local logic so the app never depends on AI.
 *
 * AI is advisory only: it never makes authorization, status or SLA decisions.
 */

export interface IssueInput {
  title: string;
  description: string;
  allowedCategories: { slug: string; name: string }[];
}

export interface IssueClassification {
  category: string; // slug
  confidence: number; // 0..1
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" | null;
  reasoning?: string;
  provider: string;
  isFallback: boolean;
}

export interface IssueContext {
  publicId: string;
  title: string;
  description: string;
  categoryName: string;
  status: string;
  priority: string;
  locality: string | null;
  timeline: { message: string; createdAt: Date; actorRole?: string | null }[];
  upvotes: number;
}

export interface DuplicateCandidate {
  publicId: string;
  title: string;
  description: string;
  categoryName: string;
  distanceMeters: number;
  createdAt: Date;
  upvotes: number;
  status: string;
}

export interface DuplicateResult {
  candidates: (DuplicateCandidate & {
    similarity: number; // 0..1
    likelyDuplicate: boolean;
    reasoning?: string;
  })[];
  provider: string;
  isFallback: boolean;
}

export interface ImageAnalysis {
  detectedIssue: string | null;
  severityEstimate: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" | null;
  confidence: number;
  observations: string[];
  provider: string;
  isFallback: boolean;
}

export interface ExtractedReport {
  problem: string | null;
  locationHint: string | null;
  risk: string | null;
  timeContext: string | null;
  categorySlug: string | null;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" | null;
  provider: string;
  isFallback: boolean;
}

export interface AIProvider {
  readonly name: string;
  readonly available: boolean;
  classifyIssue(input: IssueInput): Promise<IssueClassification>;
  summarizeIssue(input: IssueContext): Promise<string>;
  detectDuplicates(
    input: IssueInput & { candidates: DuplicateCandidate[] }
  ): Promise<DuplicateResult>;
  analyzeImage(base64: string, mimeType: string): Promise<ImageAnalysis>;
  extractFromText(text: string, allowedCategories: { slug: string; name: string }[]): Promise<ExtractedReport>;
  generateInsights(statsJson: string): Promise<string>;
}

// ---------------------------------------------------------------------------
// Vendor-agnostic chat completions client (Groq / OpenAI compatible)
// ---------------------------------------------------------------------------

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string | { type: string; text?: string; image_url?: { url: string } }[];
}

class ChatProvider {
  constructor(
    readonly name: string,
    private baseUrl: string,
    private apiKey: string,
    private model: string,
    private visionModel: string
  ) {}

  async chat(
    messages: ChatMessage[],
    opts: { json?: boolean; temperature?: number; timeoutMs?: number; model?: string } = {}
  ): Promise<string> {
    const controller = new AbortController();
    const timer = setTimeout(
      () => controller.abort(),
      opts.timeoutMs ?? 12_000
    );
    try {
      const res = await fetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: opts.model ?? this.model,
          messages,
          temperature: opts.temperature ?? 0.2,
          ...(opts.json ? { response_format: { type: "json_object" } } : {}),
        }),
        signal: controller.signal,
      });
      if (!res.ok) {
        throw new Error(`AI provider HTTP ${res.status}`);
      }
      const data = (await res.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      const content = data.choices?.[0]?.message?.content;
      if (!content) throw new Error("AI provider returned empty response");
      return content;
    } finally {
      clearTimeout(timer);
    }
  }

  get vision(): string {
    return this.visionModel;
  }
}

/** Parses the first JSON object found in a model response. */
export function parseJsonLoose<T>(text: string): T | null {
  try {
    return JSON.parse(text) as T;
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]) as T;
      } catch {
        return null;
      }
    }
    return null;
  }
}

export function getChatProvider(): ChatProvider | null {
  const provider = (process.env.AI_PROVIDER ?? "none").toLowerCase();
  const apiKey = process.env.AI_API_KEY;
  const model = process.env.AI_MODEL || "llama-3.3-70b-versatile";
  const visionModel =
    process.env.AI_VISION_MODEL || "meta-llama-4-scout-17b-16e-instruct";
  if (!apiKey || provider === "none") return null;
  if (provider === "groq") {
    return new ChatProvider("groq", "https://api.groq.com/openai/v1", apiKey, model, visionModel);
  }
  if (provider === "openai") {
    return new ChatProvider("openai", "https://api.openai.com/v1", apiKey, model, visionModel);
  }
  // Generic OpenAI-compatible endpoint via AI_BASE_URL
  const base = process.env.AI_BASE_URL;
  if (base) return new ChatProvider(provider, base, apiKey, model, visionModel);
  return null;
}

export function aiAvailable(): boolean {
  return getChatProvider() !== null;
}

/** Server-side structured logging for AI failures (spec §101). */
export function logAiFailure(feature: string, err: unknown): void {
  const message = err instanceof Error ? err.message : String(err);
  // Never log payloads — they may contain citizen descriptions.
  console.warn(`[civicissue:ai] ${feature} failed, using fallback: ${message}`);
}

export type { ChatProvider, ChatMessage };
