/**
 * Shared API route helpers: JSON responses + consistent error mapping.
 */
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { UnauthorizedError } from "@/lib/auth";
import { ForbiddenError } from "@/lib/permissions/matrix";
import { ApiValidationError } from "@/lib/validation";
import { RateLimitError } from "@/lib/rate-limit";
import { ValidationError } from "@/lib/storage";

export function ok<T>(data: T, init?: ResponseInit): NextResponse {
  return NextResponse.json(data, init);
}

export function fail(status: number, message: string, extra?: Record<string, unknown>): NextResponse {
  return NextResponse.json({ error: message, ...extra }, { status });
}

export class NotFoundError extends Error {
  constructor(message = "This complaint could not be found.") {
    super(message);
    this.name = "NotFoundError";
  }
}

/** Maps known error types to proper HTTP responses; logs the rest. */
export function handleError(err: unknown): NextResponse {
  if (err instanceof UnauthorizedError) {
    return fail(401, err.message);
  }
  if (err instanceof ForbiddenError) {
    return fail(403, err.message);
  }
  if (err instanceof NotFoundError) {
    return fail(404, err.message);
  }
  if (err instanceof ApiValidationError) {
    return fail(422, err.message, {
      issues: err.issues.map((i) => ({
        path: i.path.join("."),
        message: i.message,
      })),
    });
  }
  if (err instanceof ZodError) {
    const first = err.issues[0];
    return fail(422, first?.message ?? "Validation failed.", {
      issues: err.issues.map((i) => ({
        path: i.path.join("."),
        message: i.message,
      })),
    });
  }
  if (err instanceof RateLimitError) {
    return fail(429, err.message, { retryAfterMs: err.retryAfterMs });
  }
  if (err instanceof ValidationError) {
    return fail(400, err.message);
  }
  // Domain action errors (status machine, SLA rules, evidence policy…) carry
  // their own HTTP status and a user-safe message.
  if (
    err instanceof Error &&
    typeof (err as Error & { status?: unknown }).status === "number"
  ) {
    const status = (err as Error & { status: number }).status;
    if (status >= 400 && status < 600) {
      return fail(status, err.message);
    }
  }
  console.error("[civicissue:api] unhandled error:", err);
  return fail(500, "Something went wrong on our side. Please try again.");
}

export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    throw new ApiValidationError([
      { code: "custom", path: [], message: "Request body must be valid JSON." } as never,
    ]);
  }
}
