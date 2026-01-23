import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { checkRateLimit, RateLimitConfigs } from "@/lib/rateLimiter";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Create admin client for server-side operations
const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

export async function POST(req: Request) {
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
    const body = await req.json();
    const { email, password } = body;

    // Validate input
    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: "Email and password are required" },
        { status: 400 }
      );
    }

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




