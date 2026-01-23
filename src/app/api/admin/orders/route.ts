import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase";

interface OrderWithDetails {
  id: string;
  vendor_id: string;
  user_id: string;
  product_id: string;
  quantity: number;
  total_price: number;
  status: string;
  payment_reference: string | null;
  created_at: string;
  updated_at: string;
  delivery_address_line_1?: string | null;
  delivery_city?: string | null;
  delivery_state?: string | null;
  delivery_postal_code?: string | null;
  delivery_phone_number?: string | null;
  delivery_charge?: number | null;
  menu_items?: {
    id: string;
    title: string;
    image_url: string | null;
    price: number;
  };
  profiles?: {
    id: string;
    name: string;
    email: string;
  };
  vendor_profiles?: {
    id: string;
    name: string;
    business_name: string;
    image_url: string | null;
    location: string | null;
  };
}

// GET /api/admin/orders - Get all orders with vendor and user information
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

    const isAdmin = profile?.is_admin === true || profile?.role?.toLowerCase().trim() === "admin";
    if (!isAdmin) {
      return NextResponse.json(
        { error: "Forbidden. Admin access required." },
        { status: 403 }
      );
    }

    // Get query parameters for filtering
    const { searchParams } = new URL(req.url);
    const statusFilter = searchParams.get("status");
    const searchQuery = searchParams.get("search");

    // Fetch all orders (including delivery fields)
    let ordersQuery = supabaseAdmin
      .from("orders")
      .select(`
        *,
        menu_items (
          id,
          title,
          image_url,
          price
        )
      `)
      .order("created_at", { ascending: false });

    // Apply status filter
    if (statusFilter && statusFilter !== "all") {
      ordersQuery = ordersQuery.eq("status", statusFilter);
    }

    const { data: orders, error: ordersError } = await ordersQuery;

    if (ordersError) {
      console.error("Error fetching orders:", ordersError);
      console.error("Order error details:", {
        message: ordersError.message,
        details: ordersError.details,
        hint: ordersError.hint,
        code: ordersError.code
      });
      return NextResponse.json(
        { 
          error: "Failed to fetch orders",
          details: ordersError.message,
          code: ordersError.code
        },
        { status: 500 }
      );
    }

    if (!orders || orders.length === 0) {
      return NextResponse.json({ orders: [] });
    }

    // Get unique user IDs and vendor IDs
    const userIds = [...new Set(orders.map((o: OrderWithDetails) => o.user_id).filter(Boolean))];
    const vendorIds = [...new Set(orders.map((o: OrderWithDetails) => o.vendor_id).filter(Boolean))];

    // Fetch user profiles
    const { data: userProfiles } = await supabaseAdmin
      .from("profiles")
      .select("id, name, email")
      .in("id", userIds);

    // Fetch vendor profiles (from profiles table where role = vendor)
    const { data: vendorProfiles } = await supabaseAdmin
      .from("profiles")
      .select("id, name")
      .in("id", vendorIds)
      .eq("role", "vendor");

    // Fetch vendor business info
    const { data: vendors } = await supabaseAdmin
      .from("vendors")
      .select("profile_id, business_name, image_url, location")
      .in("profile_id", vendorIds);

    // Create maps for quick lookup
    const userProfileMap = new Map();
    userProfiles?.forEach((profile) => {
      userProfileMap.set(profile.id, profile);
    });

    const vendorProfileMap = new Map();
    vendorProfiles?.forEach((profile) => {
      vendorProfileMap.set(profile.id, profile);
    });

    const vendorMap = new Map();
    vendors?.forEach((vendor) => {
      if (vendor.profile_id) {
        vendorMap.set(vendor.profile_id, vendor);
      }
    });

    // Combine orders with user and vendor information
    const ordersWithDetails: OrderWithDetails[] = orders.map((order: OrderWithDetails) => {
      const userProfile = userProfileMap.get(order.user_id);
      const vendorProfile = vendorProfileMap.get(order.vendor_id);
      const vendorInfo = vendorMap.get(order.vendor_id);

      return {
        ...order,
        profiles: userProfile || { id: order.user_id, name: "Unknown User", email: "N/A" },
        vendor_profiles: vendorProfile && vendorInfo
          ? {
              id: vendorProfile.id,
              name: vendorProfile.name,
              business_name: vendorInfo.business_name || vendorProfile.name,
              image_url: vendorInfo.image_url,
              location: vendorInfo.location,
            }
          : { id: order.vendor_id, name: "Unknown Vendor", business_name: "N/A", image_url: null, location: null },
      };
    });

    // Apply search filter if provided
    let filteredOrders = ordersWithDetails;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filteredOrders = ordersWithDetails.filter((order) => {
        return (
          order.id.toLowerCase().includes(query) ||
          order.profiles?.name?.toLowerCase().includes(query) ||
          order.profiles?.email?.toLowerCase().includes(query) ||
          order.vendor_profiles?.name?.toLowerCase().includes(query) ||
          order.vendor_profiles?.business_name?.toLowerCase().includes(query) ||
          order.menu_items?.title?.toLowerCase().includes(query) ||
          order.status?.toLowerCase().includes(query)
        );
      });
    }

    return NextResponse.json({ orders: filteredOrders });
  } catch (error: unknown) {
    console.error("Error in GET /api/admin/orders:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}




