import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase";
import { checkRateLimit, RateLimitConfigs } from "@/lib/rateLimiter";
import { parseJsonBody } from "@/lib/validation/http";
import { loginCredentialsSchema } from "@/lib/validation/schemas";

export async function POST(req: Request) {
  const supabaseAdmin = getSupabaseAdminClient();
  // Rate limiting: 5 login attempts per minute per IP/user
  const rateLimitResult = checkRateLimit(
    "/api/login",
    req,
    RateLimitConfigs.LOGIN
  );

  if (!rateLimitResult.success) {
    return NextResponse.json(
      {
        success: false,
        error: "Too many login attempts. Please try again later.",
        retryAfter: rateLimitResult.retryAfter,
        message: `Rate limit exceeded. Please wait ${rateLimitResult.retryAfter} seconds before trying again.`,
      },
      {
        status: 429,
        headers: {
          "Retry-After": rateLimitResult.retryAfter?.toString() || "60",
          "X-RateLimit-Limit": RateLimitConfigs.LOGIN.maxRequests.toString(),
          "X-RateLimit-Remaining": rateLimitResult.remaining.toString(),
          "X-RateLimit-Reset": new Date(rateLimitResult.resetTime).toISOString(),
        },
      }
    );
  }

  try {
    const parsed = await parseJsonBody(req, loginCredentialsSchema, "POST /api/login");
    if (!parsed.ok) return parsed.response;

    const { email, password } = parsed.data;

    // Attempt login
    const { data, error } = await supabaseAdmin.auth.signInWithPassword({
      email,
      password,
    });

    if (error || !data.user) {
      console.warn("❌ Login failed:", error?.message);
      return NextResponse.json(
        { success: false, error: error?.message || "Invalid email or password" },
        { status: 401 }
      );
    }

    console.log("✅ Login successful:", data.user.id);

    return NextResponse.json(
      {
        success: true,
        user: {
          id: data.user.id,
          email: data.user.email,
        },
        session: data.session,
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("🔥 Login route crashed:", err);
    const errorMessage = err instanceof Error ? err.message : "Login failed";
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}




