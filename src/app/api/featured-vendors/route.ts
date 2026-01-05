import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { checkRateLimit, RateLimitConfigs } from "@/lib/rateLimiter";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Create a client with service role key for public access (bypasses RLS)
// This is safe for public data like featured vendors
const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

export async function GET(req: Request) {
  // Rate limiting: 50 requests per minute per IP (search/explore limit)
  const rateLimitResult = checkRateLimit(
    "/api/featured-vendors",
    req,
    RateLimitConfigs.SEARCH
  );

  if (!rateLimitResult.success) {
    return NextResponse.json(
      {
        error: "Too many requests. Please try again later.",
        retryAfter: rateLimitResult.retryAfter,
        message: `Rate limit exceeded. Please wait ${rateLimitResult.retryAfter} seconds before trying again.`,
      },
      {
        status: 429,
        headers: {
          "Retry-After": rateLimitResult.retryAfter?.toString() || "60",
          "X-RateLimit-Limit": RateLimitConfigs.SEARCH.maxRequests.toString(),
          "X-RateLimit-Remaining": rateLimitResult.remaining.toString(),
          "X-RateLimit-Reset": new Date(rateLimitResult.resetTime).toISOString(),
        },
      }
    );
  }
  try {
    // Fetch featured vendors from profiles table
    // Using service role key to bypass RLS for public access
    const { data, error } = await supabase
      .from("profiles")
      .select("id, name, featured_image, featured_description, is_featured")
      .eq("role", "vendor")
      .eq("is_featured", true)
      .order("created_at", { ascending: false })
      .limit(8);

    if (error) {
      console.error("Error fetching featured vendors:", error);
      return NextResponse.json(
        { error: "Failed to fetch featured vendors", details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ vendors: data || [] });
  } catch (error: any) {
    console.error("Error in featured vendors API:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    );
  }
}

