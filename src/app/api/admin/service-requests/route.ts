import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
  db: { schema: "public" },
});

interface ServiceRequestRecord {
  id: string;
  user_id: string;
  vendor_id: string;
  message: string;
  contact_info: string | null;
  status: string;
  final_price: number | null;
  price_confirmed: boolean | null;
  payment_status: string | null;
  amount_paid: number | null;
  payment_reference: string | null;
  payment_method: string | null;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
}

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !authData?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("is_admin, role")
      .eq("id", authData.user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: "User profile not found" }, { status: 404 });
    }

    const isAdmin = profile.is_admin === true || profile.role?.toLowerCase().trim() === "admin";
    if (!isAdmin) {
      return NextResponse.json({ error: "Forbidden. Admin access required." }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const statusFilter = searchParams.get("status");

    let requestsQuery = supabaseAdmin
      .from("service_requests")
      .select(
        "id, user_id, vendor_id, message, contact_info, status, final_price, price_confirmed, payment_status, amount_paid, payment_reference, payment_method, paid_at, created_at, updated_at"
      )
      .order("created_at", { ascending: false });

    if (statusFilter && statusFilter !== "all") {
      requestsQuery = requestsQuery.eq("status", statusFilter);
    }

    const { data: requests, error: requestsError } = await requestsQuery;

    if (requestsError) {
      console.error("Error fetching service requests:", requestsError);
      return NextResponse.json({ error: "Failed to fetch service requests" }, { status: 500 });
    }

    if (!requests || requests.length === 0) {
      return NextResponse.json({ requests: [] });
    }

    const userIds = [...new Set(requests.map((r: ServiceRequestRecord) => r.user_id).filter(Boolean))];
    const vendorIds = [...new Set(requests.map((r: ServiceRequestRecord) => r.vendor_id).filter(Boolean))];

    const { data: userProfiles } = await supabaseAdmin
      .from("profiles")
      .select("id, name, email")
      .in("id", userIds);

    const { data: vendorProfiles } = await supabaseAdmin
      .from("profiles")
      .select("id, name, category")
      .in("id", vendorIds);

    const userProfileMap = new Map(userProfiles?.map((p) => [p.id, p]) || []);
    const vendorProfileMap = new Map(vendorProfiles?.map((p) => [p.id, p]) || []);

    const enrichedRequests = requests.map((request: ServiceRequestRecord) => ({
      ...request,
      user_profile: userProfileMap.get(request.user_id) || null,
      vendor_profile: vendorProfileMap.get(request.vendor_id) || null,
    }));

    return NextResponse.json({ requests: enrichedRequests });
  } catch (error) {
    console.error("Error in GET /api/admin/service-requests:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
