import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
  db: { schema: "public" },
});

interface OrderRow {
  id: string;
  vendor_id: string;
  user_id: string;
  delivery_charge: number | null;
  status: string;
  created_at: string;
  payment_reference: string | null;
}

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("is_admin, role")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: "User profile not found" }, { status: 404 });
    }

    const isAdmin = profile.is_admin === true || profile.role?.toLowerCase().trim() === "admin";
    if (!isAdmin) {
      return NextResponse.json({ error: "Forbidden. Admin access required." }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const vendorId = searchParams.get("vendor_id");
    const search = searchParams.get("search")?.toLowerCase().trim() || "";

    const { data: paymentRefs } = await supabaseAdmin
      .from("payments")
      .select("payment_reference")
      .eq("status", "success")
      .not("payment_reference", "is", null);

    const referenceList = (paymentRefs || [])
      .map((p) => p.payment_reference)
      .filter(Boolean) as string[];

    if (referenceList.length === 0) {
      return NextResponse.json({ orders: [], total_delivery_fees: 0 });
    }

    let ordersQuery = supabaseAdmin
      .from("orders")
      .select("id, vendor_id, user_id, delivery_charge, status, created_at, payment_reference")
      .in("payment_reference", referenceList);

    if (status && status !== "all") {
      ordersQuery = ordersQuery.eq("status", status);
    }
    if (vendorId) {
      ordersQuery = ordersQuery.eq("vendor_id", vendorId);
    }
    if (from) {
      ordersQuery = ordersQuery.gte("created_at", from);
    }
    if (to) {
      ordersQuery = ordersQuery.lte("created_at", to);
    }

    const { data: orders, error: ordersError } = await ordersQuery;
    if (ordersError) {
      return NextResponse.json(
        { error: "Failed to fetch orders", details: ordersError.message },
        { status: 500 }
      );
    }

    const orderRows = (orders || []) as OrderRow[];
    const userIds = [...new Set(orderRows.map((o) => o.user_id).filter(Boolean))];
    const vendorIds = [...new Set(orderRows.map((o) => o.vendor_id).filter(Boolean))];

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

    const userProfileMap = new Map(userProfiles?.map((p) => [p.id, p]) || []);
    const vendorProfileMap = new Map(vendorProfiles?.map((p) => [p.id, p]) || []);
    const vendorMap = new Map(vendors?.map((v) => [v.profile_id, v]) || []);

    const ordersWithDetails = orderRows.map((order) => {
      const userProfile = userProfileMap.get(order.user_id);
      const vendorProfile = vendorProfileMap.get(order.vendor_id);
      const vendorInfo = vendorMap.get(order.vendor_id);

      return {
        ...order,
        profiles: userProfile || { id: order.user_id, name: "Unknown User", email: "N/A" },
        vendor_profiles: vendorProfile
          ? {
              id: vendorProfile.id,
              name: vendorProfile.name,
              business_name: vendorInfo?.business_name || vendorProfile.name,
            }
          : { id: order.vendor_id, name: "Unknown Vendor", business_name: "N/A" },
      };
    });

    const filteredOrders = search
      ? ordersWithDetails.filter((order) => {
          return (
            order.id.toLowerCase().includes(search) ||
            order.profiles?.name?.toLowerCase().includes(search) ||
            order.profiles?.email?.toLowerCase().includes(search) ||
            order.vendor_profiles?.name?.toLowerCase().includes(search) ||
            order.vendor_profiles?.business_name?.toLowerCase().includes(search) ||
            order.status?.toLowerCase().includes(search)
          );
        })
      : ordersWithDetails;

    const totalDeliveryFees = filteredOrders.reduce(
      (sum, order) => sum + (Number(order.delivery_charge) || 0),
      0
    );

    return NextResponse.json({
      orders: filteredOrders,
      total_delivery_fees: Math.round(totalDeliveryFees * 100) / 100,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(
      { error: "Internal server error", details: errorMessage },
      { status: 500 }
    );
  }
}
