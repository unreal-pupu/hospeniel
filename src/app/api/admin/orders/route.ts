import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

interface DeliveryTaskRow {
  order_id: string;
  rider_id: string | null;
  status: string;
}

interface AssignedRider {
  id: string;
  name: string | null;
  email: string | null;
  phone_number: string | null;
}

interface OrderWithDetails {
  id: string;
  vendor_id: string;
  user_id: string | null;
  guest_id?: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
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
  /** Legacy / direct assignment on orders row when present */
  rider_id?: string | null;
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
  /** Delivery task workflow (preferred source for rider assignment) */
  delivery_task?: {
    status: string;
    rider_id: string | null;
  } | null;
  /** Resolved rider profile when assigned */
  assigned_rider?: AssignedRider | null;
  /** UX hint only: early-order statuses typically have no rider yet */
  rider_visibility_hint?: "not_expected_yet" | "active_delivery";
}

function pickDeliveryTaskForOrder(tasks: DeliveryTaskRow[], orderId: string): DeliveryTaskRow | null {
  const forOrder = tasks.filter((t) => t.order_id === orderId);
  if (forOrder.length === 0) return null;
  const withRider = forOrder.find((t) => t.rider_id);
  return withRider ?? forOrder[0];
}

function resolveRiderIdForOrder(
  order: OrderWithDetails,
  task: DeliveryTaskRow | null
): string | null {
  const fromTask = task?.rider_id ?? null;
  if (fromTask) return fromTask;
  const fromOrder = order.rider_id ?? null;
  return fromOrder;
}

/** Order statuses where a rider is not expected yet (UX hint only; data still shown if present). */
function shouldExpectNoRiderYet(orderStatus: string): boolean {
  const s = orderStatus?.trim() ?? "";
  return s === "Pending" || s === "Paid" || s === "Accepted";
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

    const orderIds = orders.map((o: OrderWithDetails) => o.id);

    const { data: deliveryTaskRows, error: tasksError } = await supabaseAdmin
      .from("delivery_tasks")
      .select("order_id, rider_id, status")
      .in("order_id", orderIds);

    if (tasksError) {
      console.error("Error fetching delivery tasks for admin orders:", tasksError);
    }

    const deliveryTasks = (deliveryTaskRows || []) as DeliveryTaskRow[];

    // Get unique user IDs and vendor IDs
    const userIds = [...new Set(orders.map((o: OrderWithDetails) => o.user_id).filter(Boolean))];
    const vendorIds = [...new Set(orders.map((o: OrderWithDetails) => o.vendor_id).filter(Boolean))];

    const riderIds = new Set<string>();
    for (const o of orders as OrderWithDetails[]) {
      const task = pickDeliveryTaskForOrder(deliveryTasks, o.id);
      const rid = resolveRiderIdForOrder(o, task);
      if (rid) riderIds.add(rid);
    }
    const riderIdList = [...riderIds];

    const riderProfileMap = new Map<string, AssignedRider>();
    if (riderIdList.length > 0) {
      const { data: riderProfiles, error: ridersErr } = await supabaseAdmin
        .from("profiles")
        .select("id, name, email, phone_number, role")
        .in("id", riderIdList);

      if (ridersErr) {
        console.error("Error fetching rider profiles for admin orders:", ridersErr);
      } else {
        (riderProfiles || []).forEach((p: { id: string; name: string | null; email: string | null; phone_number: string | null; role: string | null }) => {
          riderProfileMap.set(p.id, {
            id: p.id,
            name: p.name,
            email: p.email,
            phone_number: p.phone_number,
          });
        });
      }
    }

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

    // Combine orders with user, vendor, and rider information
    const ordersWithDetails: OrderWithDetails[] = orders.map((raw: OrderWithDetails) => {
      const order = { ...raw };
      const userProfile = order.user_id ? userProfileMap.get(order.user_id) : null;
      const vendorProfile = vendorProfileMap.get(order.vendor_id);
      const vendorInfo = vendorMap.get(order.vendor_id);

      const profilesForOrder =
        order.user_id
          ? userProfile || { id: order.user_id, name: "Unknown User", email: "N/A" }
          : {
              id: order.guest_id || "guest",
              name: order.customer_name?.trim() || "Guest customer",
              email: "N/A",
            };

      const task = pickDeliveryTaskForOrder(deliveryTasks, order.id);
      const delivery_task =
        task
          ? {
              status: task.status,
              rider_id: task.rider_id,
            }
          : null;

      const resolvedRiderId = resolveRiderIdForOrder(order, task);
      const assigned_rider: AssignedRider | null = resolvedRiderId
        ? riderProfileMap.get(resolvedRiderId) ?? {
            id: resolvedRiderId,
            name: null,
            email: null,
            phone_number: null,
          }
        : null;

      return {
        ...order,
        delivery_task,
        assigned_rider,
        profiles: profilesForOrder,
        vendor_profiles: vendorProfile && vendorInfo
          ? {
              id: vendorProfile.id,
              name: vendorProfile.name,
              business_name: vendorInfo.business_name || vendorProfile.name,
              image_url: vendorInfo.image_url,
              location: vendorInfo.location,
            }
          : { id: order.vendor_id, name: "Unknown Vendor", business_name: "N/A", image_url: null, location: null },
        rider_visibility_hint: shouldExpectNoRiderYet(order.status)
          ? "not_expected_yet"
          : "active_delivery",
      };
    });

    // Apply search filter if provided
    let filteredOrders = ordersWithDetails;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filteredOrders = ordersWithDetails.filter((order) => {
        const rider = order.assigned_rider;
        return (
          order.id.toLowerCase().includes(query) ||
          order.profiles?.name?.toLowerCase().includes(query) ||
          order.profiles?.email?.toLowerCase().includes(query) ||
          order.vendor_profiles?.name?.toLowerCase().includes(query) ||
          order.vendor_profiles?.business_name?.toLowerCase().includes(query) ||
          order.menu_items?.title?.toLowerCase().includes(query) ||
          order.status?.toLowerCase().includes(query) ||
          rider?.id.toLowerCase().includes(query) ||
          rider?.name?.toLowerCase().includes(query) ||
          rider?.email?.toLowerCase().includes(query) ||
          rider?.phone_number?.toLowerCase().includes(query)
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




