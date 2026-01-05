import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

interface MessageUpdate {
  response?: string;
  status?: string;
}

// PATCH /api/support/messages/[id] - Update message (admin reply or status update)
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const messageId = id;
    const body = await req.json();
    const { response, status } = body;

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

    // Check if user is admin
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: "User profile not found" },
        { status: 404 }
      );
    }

    if (!profile.is_admin) {
      return NextResponse.json(
        { error: "Forbidden. Admin access required." },
        { status: 403 }
      );
    }

    // Build update object
    const updateData: MessageUpdate & { responded_at?: string; responded_by?: string } = {};
    if (response !== undefined) {
      updateData.response = response;
      updateData.responded_at = new Date().toISOString();
      updateData.responded_by = user.id;
      updateData.status = "responded";
    }
    if (status !== undefined) {
      updateData.status = status;
    }

    // Update message
    const { data: updatedMessage, error: updateError } = await supabaseAdmin
      .from("support_messages")
      .update(updateData)
      .eq("id", messageId)
      .select()
      .single();

    if (updateError) {
      console.error("Error updating message:", updateError);
      return NextResponse.json(
        { error: "Failed to update message" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: updatedMessage,
      success: true,
    });
  } catch (error: unknown) {
    console.error("Error in PATCH /api/support/messages/[id]:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

interface MessageWithSender {
  id: string;
  sender_id: string;
  sender_role: string;
  message: string;
  status: string;
  response: string | null;
  responded_at: string | null;
  responded_by: string | null;
  created_at: string;
  sender?: {
    id: string;
    name: string;
    email: string;
  };
  responder?: {
    id: string;
    name: string;
  };
}

// GET /api/support/messages/[id] - Get single message
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const messageId = id;

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

    // Check if user is admin
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("is_admin, role")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: "User profile not found" },
        { status: 404 }
      );
    }

    // Fetch message
    const { data: message, error: messageError } = await supabaseAdmin
      .from("support_messages")
      .select("*")
      .eq("id", messageId)
      .single();

    if (messageError) {
      console.error("Error fetching message:", messageError);
      return NextResponse.json(
        { error: "Message not found" },
        { status: 404 }
      );
    }

    const messageWithSender = message as MessageWithSender;

    // If not admin, verify user owns the message
    if (!profile.is_admin && messageWithSender.sender_id !== user.id) {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      );
    }

    // Fetch sender info from profiles
    const { data: sender } = await supabaseAdmin
      .from("profiles")
      .select("id, name, email")
      .eq("id", messageWithSender.sender_id)
      .single();

    messageWithSender.sender = sender || {
      id: messageWithSender.sender_id,
      name: "Unknown User",
      email: null,
    };

    // Get responder info if response exists
    if (messageWithSender.responded_by) {
      const { data: responder } = await supabaseAdmin
        .from("profiles")
        .select("id, name")
        .eq("id", messageWithSender.responded_by)
        .single();
      messageWithSender.responder = responder || undefined;
    }

    // If admin and message is unread, mark as read
    if (profile.is_admin && messageWithSender.status === "pending") {
      await supabaseAdmin
        .from("support_messages")
        .update({ status: "read" })
        .eq("id", messageId);
      messageWithSender.status = "read";
    }

    return NextResponse.json({ message: messageWithSender });
  } catch (error: unknown) {
    console.error("Error in GET /api/support/messages/[id]:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
