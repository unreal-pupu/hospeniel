import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

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
    interface UserProfileRow {
      id: string;
      name: string | null;
      email: string | null;
    }

    interface VendorProfileRow {
      id: string;
      name: string | null;
      business_name?: string | null;
    }

    const authResult = await ensureAdmin(req);
    if ("error" in authResult) return authResult.error;

    const { data: orders, error: ordersError } = await supabaseAdmin
      .from("orders")
      .select(
        "id, user_id, vendor_id, total_price, status, payment_reference, created_at, updated_at, order_type, service_request_id, menu_items (title)"
      )
      .in("status", ["Completed", "Paid"])
      .order("created_at", { ascending: false })
      .limit(10);

    if (ordersError) {
      console.error("Error fetching completed orders:", ordersError);
      return NextResponse.json({ error: "Failed to fetch orders" }, { status: 500 });
    }

    if (!orders || orders.length === 0) {
      return NextResponse.json({ orders: [] });
    }

    const userIds = [...new Set(orders.map((o) => o.user_id).filter(Boolean))];
    const vendorIds = [...new Set(orders.map((o) => o.vendor_id).filter(Boolean))];

    const { data: userProfiles } = await supabaseAdmin
      .from("profiles")
      .select("id, name, email")
      .in("id", userIds);

    const { data: vendorProfiles } = await supabaseAdmin
      .from("profiles")
      .select("id, name")
      .in("id", vendorIds)
      .eq("role", "vendor");

    const { data: vendors } = await supabaseAdmin
      .from("vendors")
      .select("profile_id, business_name")
      .in("profile_id", vendorIds);

    const userMap = new Map<string, UserProfileRow>(
      (userProfiles as UserProfileRow[] | null)?.map((profile) => [profile.id, profile]) || []
    );
    const vendorMap = new Map<string, VendorProfileRow>(
      (vendorProfiles as VendorProfileRow[] | null)?.map((profile) => [
        profile.id,
        { ...profile, business_name: profile.name },
      ]) || []
    );
    vendors?.forEach((vendor) => {
      if (vendor.profile_id) {
        const profile = vendorMap.get(vendor.profile_id);
        if (profile) {
          vendorMap.set(vendor.profile_id, {
            ...profile,
            business_name: vendor.business_name || profile.name,
          });
        }
      }
    });

    const normalizedOrders = orders.map((order) => ({
      ...order,
      profiles: userMap.get(order.user_id) || { name: "Unknown User", email: "N/A" },
      vendor_profiles: vendorMap.get(order.vendor_id) || { name: "Unknown Vendor", business_name: "N/A" },
      menu_items: Array.isArray(order.menu_items)
        ? order.menu_items.map((item: { title?: unknown }) => ({
            title: typeof item.title === "string" ? item.title : String(item.title || ""),
          }))
        : undefined,
    }));

    return NextResponse.json({ orders: normalizedOrders });
  } catch (error) {
    console.error("Error in GET /api/admin/completed-orders:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
