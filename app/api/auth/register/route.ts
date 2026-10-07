import { NextRequest } from "next/server";
import { registerUser } from "@/lib/queries/users";
import { registerSchema } from "@/lib/validation";
import { ok, fail, handleError, readJson } from "@/lib/api/respond";
import { setSessionCookie } from "@/lib/auth/session";
import { checkRateLimit, LIMITS, clientKey } from "@/lib/rate-limit";
import { ActionError } from "@/lib/queries/issue-actions";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    checkRateLimit(`register:${clientKey(req)}`, LIMITS.register);
    const body = registerSchema.parse(await readJson(req));
    const id = await registerUser({
      name: body.name,
      email: body.email,
      password: body.password,
      phone: body.phone || null,
      city: body.city,
      locality: body.locality || null,
    });
    await setSessionCookie({
      sub: id,
      email: body.email.toLowerCase(),
      role: "CITIZEN",
      name: body.name,
    });
    return ok({ id, role: "CITIZEN", redirect: "/dashboard" }, { status: 201 });
  } catch (err) {
    if (err instanceof ActionError) return fail(err.status, err.message);
    return handleError(err);
  }
}
