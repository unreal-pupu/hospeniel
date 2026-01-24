import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

interface NotificationRecord {
  id: string;
  user_id: string | null;
  vendor_id: string | null;
  message: string;
  type: string;
  read: boolean;
  created_at: string;
}

interface SendNotificationBody {
  message: string;
  type: string;
  target: "all" | "vendors" | "users";
}

async function ensureAdmin(req: Request) {
  const supabaseAdmin = getSupabaseAdminClient();
  const authHeader = req.headers.get("authorization");
  if (!authHeader) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const token = authHeader.replace("Bearer ", "");
  const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);

  if (authError || !authData?.user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("is_admin, role")
    .eq("id", authData.user.id)
    .single();

  if (profileError || !profile) {
    return { error: NextResponse.json({ error: "User profile not found" }, { status: 404 }) };
  }

  const isAdmin = profile.is_admin === true || profile.role?.toLowerCase().trim() === "admin";
  if (!isAdmin) {
    return { error: NextResponse.json({ error: "Forbidden. Admin access required." }, { status: 403 }) };
  }

  return { userId: authData.user.id };
}

export async function GET(req: Request) {
  try {
    const supabaseAdmin = getSupabaseAdminClient();
    const authResult = await ensureAdmin(req);
    if ("error" in authResult) return authResult.error;

    const { data: notifications, error } = await supabaseAdmin
      .from("notifications")
      .select("id, user_id, vendor_id, message, type, read, created_at")
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      console.error("Error fetching notifications:", error);
      return NextResponse.json({ error: "Failed to fetch notifications" }, { status: 500 });
    }

    const userIds = [...new Set((notifications || []).map((n: NotificationRecord) => n.user_id).filter(Boolean))];
    const vendorIds = [...new Set((notifications || []).map((n: NotificationRecord) => n.vendor_id).filter(Boolean))];

    const { data: userProfiles } = await supabaseAdmin
      .from("profiles")
      .select("id, name, email")
      .in("id", userIds);

    const { data: vendorProfiles } = await supabaseAdmin
      .from("profiles")
      .select("id, name, email")
      .in("id", vendorIds);

    const userMap = new Map(userProfiles?.map((p) => [p.id, p]) || []);
    const vendorMap = new Map(vendorProfiles?.map((p) => [p.id, p]) || []);

    const enriched = (notifications || []).map((notification: NotificationRecord) => ({
      ...notification,
      user_profile: notification.user_id ? userMap.get(notification.user_id) || null : null,
      vendor_profile: notification.vendor_id ? vendorMap.get(notification.vendor_id) || null : null,
    }));

    return NextResponse.json({ notifications: enriched });
  } catch (error) {
    console.error("Error in GET /api/admin/notifications:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const supabaseAdmin = getSupabaseAdminClient();
    const authResult = await ensureAdmin(req);
    if ("error" in authResult) return authResult.error;

    const body = (await req.json()) as SendNotificationBody;
    const message = body.message?.trim();
    const type = body.type;
    const target = body.target;

    if (!message) {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }

    if (!["system", "order_update", "payment", "subscription"].includes(type)) {
      return NextResponse.json({ error: "Invalid notification type" }, { status: 400 });
    }

    if (!["all", "vendors", "users"].includes(target)) {
      return NextResponse.json({ error: "Invalid target" }, { status: 400 });
    }

    const recipients: Array<{ user_id?: string; vendor_id?: string }> = [];

    if (target === "all" || target === "vendors") {
      const { data: vendors } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .eq("role", "vendor");

      vendors?.forEach((vendor) => {
        if (vendor.id) recipients.push({ vendor_id: vendor.id });
      });
    }

    if (target === "all" || target === "users") {
      const { data: users } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .eq("role", "user");

      users?.forEach((user) => {
        if (user.id) recipients.push({ user_id: user.id });
      });
    }

    if (recipients.length === 0) {
      return NextResponse.json({ error: "No recipients found" }, { status: 400 });
    }

    const notificationsToInsert = recipients.map((recipient) => ({
      ...recipient,
      message,
      type,
      read: false,
    }));

    const { error: insertError } = await supabaseAdmin
      .from("notifications")
      .insert(notificationsToInsert);

    if (insertError) {
      console.error("Error sending notifications:", insertError);
      return NextResponse.json({ error: "Failed to send notifications" }, { status: 500 });
    }

    return NextResponse.json({ success: true, sent: notificationsToInsert.length });
  } catch (error) {
    console.error("Error in POST /api/admin/notifications:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
