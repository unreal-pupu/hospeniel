import { NextResponse } from "next/server";
import type { ZodError, ZodSchema } from "zod";

export function logValidationFailure(routeLabel: string, detail: unknown): void {
  console.warn(`[validation] ${routeLabel}`, typeof detail === "string" ? detail : JSON.stringify(detail));
}

/** First human-readable message from a Zod error (avoid exposing paths/stack). */
export function zodErrorToUserMessage(error: ZodError): string {
  const issue = error.issues[0];
  if (!issue) return "Please check your information and try again.";
  return issue.message;
}

export type ParseJsonResult<T> =
  | { ok: true; data: T }
  | { ok: false; response: NextResponse };

/**
 * Parse JSON body and validate with Zod. Returns a NextResponse on failure.
 */
export async function parseJsonBody<T>(
  req: Request,
  schema: ZodSchema<T>,
  routeLabel: string
): Promise<ParseJsonResult<T>> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    logValidationFailure(routeLabel, "Invalid or empty JSON body");
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, error: "We couldn’t read your request. Please try again." },
        { status: 400 }
      ),
    };
  }

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    logValidationFailure(routeLabel, parsed.error.flatten());
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, error: zodErrorToUserMessage(parsed.error) },
        { status: 400 }
      ),
    };
  }

  return { ok: true, data: parsed.data };
}
