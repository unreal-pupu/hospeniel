import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { checkRateLimit, RateLimitConfigs } from "@/lib/rateLimiter";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// GET /api/support/messages - Get messages (filtered by user role)
export async function GET(req: Request) {
  try {
    // Get authenticated user
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Check user profile and role
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("role, is_admin")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: "User profile not found" },
        { status: 404 }
      );
    }

    // If admin, return all messages with sender info
    if (profile.is_admin) {
      const { data: messages, error } = await supabaseAdmin
        .from("support_messages")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching messages:", error);
        return NextResponse.json(
          { error: "Failed to fetch messages" },
          { status: 500 }
        );
      }

      // Batch fetch sender and responder info to avoid N+1 queries
      // Get unique sender IDs and responder IDs
      const senderIds = [...new Set((messages || []).map((msg: any) => msg.sender_id).filter(Boolean))];
      const responderIds = [...new Set((messages || []).map((msg: any) => msg.responded_by).filter(Boolean))];
      
      // Batch fetch all senders
      const { data: senders, error: sendersError } = senderIds.length > 0
        ? await supabaseAdmin
            .from("profiles")
            .select("id, name, email")
            .in("id", senderIds)
        : { data: [], error: null };

      if (sendersError) {
        console.error("Error fetching senders:", sendersError);
      }

      // Batch fetch all responders
      const { data: responders, error: respondersError } = responderIds.length > 0
        ? await supabaseAdmin
            .from("profiles")
            .select("id, name")
            .in("id", responderIds)
        : { data: [], error: null };

      if (respondersError) {
        console.error("Error fetching responders:", respondersError);
      }

      // Create maps for quick lookup
      const senderMap = new Map((senders || []).map((s: any) => [s.id, s]));
      const responderMap = new Map((responders || []).map((r: any) => [r.id, r]));

      // Attach sender and responder info to each message
      const messagesWithSenderInfo = (messages || []).map((msg: any) => {
        const sender = senderMap.get(msg.sender_id) || {
          id: msg.sender_id,
          name: "Unknown User",
          email: null,
        };

        const responder = msg.responded_by
          ? (responderMap.get(msg.responded_by) || null)
          : null;

        return {
          ...msg,
          sender,
          responder,
        };
      });

      return NextResponse.json({ messages: messagesWithSenderInfo });
    }

    // If user or vendor, return only their messages
    const { data: messages, error } = await supabaseAdmin
      .from("support_messages")
      .select("*")
      .eq("sender_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching messages:", error);
      return NextResponse.json(
        { error: "Failed to fetch messages" },
        { status: 500 }
      );
    }

    return NextResponse.json({ messages });
  } catch (error: unknown) {
    console.error("Error in GET /api/support/messages:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST /api/support/messages - Create new message
export async function POST(req: Request) {
  // Rate limiting
  const rateLimitResult = checkRateLimit(
    "/api/support/messages",
    req,
    RateLimitConfigs.REGISTRATION // Reuse registration config (3 per hour)
  );

  if (!rateLimitResult.success) {
    return NextResponse.json(
      {
        error: "Too many requests. Please try again later.",
        retryAfter: rateLimitResult.retryAfter,
      },
      {
        status: 429,
        headers: {
          "Retry-After": rateLimitResult.retryAfter?.toString() || "3600",
        },
      }
    );
  }

  try {
    const body = await req.json();
    const { message, sender_role } = body;

    // Validate input
    if (!message || !sender_role) {
      return NextResponse.json(
        { error: "Message and sender_role are required" },
        { status: 400 }
      );
    }

    if (!["user", "vendor"].includes(sender_role)) {
      return NextResponse.json(
        { error: "Invalid sender_role. Must be 'user' or 'vendor'" },
        { status: 400 }
      );
    }

    // Get authenticated user
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Verify user role matches sender_role
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: "User profile not found" },
        { status: 404 }
      );
    }

    if (profile.role !== sender_role) {
      return NextResponse.json(
        { error: "Sender role does not match user profile" },
        { status: 403 }
      );
    }

    // Insert message
    const { data: newMessage, error: insertError } = await supabaseAdmin
      .from("support_messages")
      .insert([
        {
          sender_id: user.id,
          sender_role,
          message,
          status: "pending",
        },
      ])
      .select()
      .single();

    if (insertError) {
      console.error("Error inserting message:", insertError);
      return NextResponse.json(
        { error: "Failed to send message" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { message: newMessage, success: true },
      { status: 201 }
    );
  } catch (error: unknown) {
    console.error("Error in POST /api/support/messages:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
