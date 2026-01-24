import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase";
import { checkRateLimit, RateLimitConfigs } from "@/lib/rateLimiter";

export const dynamic = "force-dynamic";

interface SupportMessageRow {
  id: string;
  sender_id: string;
  sender_role?: string | null;
  message?: string | null;
  status?: string | null;
  created_at?: string | null;
  responded_by?: string | null;
}

// GET /api/support/messages - Get messages (filtered by user role)
export async function GET(req: Request) {
  try {
    const supabaseAdmin = getSupabaseAdminClient();
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
      console.error("Profile error:", profileError);
      return NextResponse.json(
        { error: "User profile not found" },
        { status: 404 }
      );
    }

    // Check if user is admin (either is_admin = true OR role = 'admin')
    const isAdmin = profile.is_admin === true || profile.role?.toLowerCase().trim() === "admin";

    console.log("User profile:", { 
      id: user.id, 
      role: profile.role, 
      is_admin: profile.is_admin,
      isAdmin: isAdmin 
    });

    // If admin, return all messages with sender info
    if (isAdmin) {
      console.log("Admin user detected, fetching all messages");
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

      console.log(`Fetched ${messages?.length || 0} messages for admin`);
      
      // Log first few messages for debugging
      if (messages && messages.length > 0) {
        console.log("Sample messages:", (messages as SupportMessageRow[]).slice(0, 3).map((m) => ({
          id: m.id,
          sender_id: m.sender_id,
          sender_role: m.sender_role,
          message_preview: m.message?.substring(0, 50),
          status: m.status,
          created_at: m.created_at
        })));
      } else {
        console.warn("⚠️ No messages found in database for admin");
      }

      // Batch fetch sender and responder info to avoid N+1 queries
      // Get unique sender IDs and responder IDs
      interface Message {
        sender_id?: string;
        responded_by?: string;
        [key: string]: unknown;
      }
      interface Sender {
        id: string;
        name: string;
        email: string;
      }
      interface Responder {
        id: string;
        name: string;
      }
      
      const senderIds = [...new Set((messages || []).map((msg: Message) => msg.sender_id).filter(Boolean) as string[])];
      const responderIds = [...new Set((messages || []).map((msg: Message) => msg.responded_by).filter(Boolean) as string[])];
      
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
      const senderMap = new Map<string, Sender>((senders || []).map((s: Sender) => [s.id, s]));
      const responderMap = new Map<string, Responder>((responders || []).map((r: Responder) => [r.id, r]));

      // Attach sender and responder info to each message
      const messagesWithSenderInfo = (messages || []).map((msg: Message) => {
        // Safely handle undefined sender_id
        const senderId = msg.sender_id;
        const sender = senderId && typeof senderId === "string"
          ? (senderMap.get(senderId) || {
              id: senderId,
              name: "Unknown User",
              email: null,
            })
          : {
              id: senderId || "unknown",
              name: "Unknown User",
              email: null,
            };

        const responder = msg.responded_by && typeof msg.responded_by === "string"
          ? (responderMap.get(msg.responded_by) || null)
          : null;

        return {
          ...msg,
          sender,
          responder,
        };
      });

      console.log(`Returning ${messagesWithSenderInfo.length} messages with sender info to admin`);
      
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
  const supabaseAdmin = getSupabaseAdminClient();
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

    if (!["user", "vendor", "rider"].includes(sender_role)) {
      return NextResponse.json(
        { error: "Invalid sender_role. Must be 'user', 'vendor', or 'rider'" },
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
    console.log("Inserting support message:", {
      sender_id: user.id,
      sender_role,
      message_length: message.length,
    });

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
      console.error("Insert error details:", JSON.stringify(insertError, null, 2));
      return NextResponse.json(
        { error: "Failed to send message", details: insertError.message },
        { status: 500 }
      );
    }

    console.log("Message inserted successfully:", newMessage?.id);

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
