import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Create service role client that bypasses RLS
const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { 
    autoRefreshToken: false, 
    persistSession: false 
  },
  db: {
    schema: 'public'
  }
});

interface PaymentWithDetails {
  id: string;
  user_id: string;
  total_amount: number;
  status: string;
  payment_reference: string | null;
  created_at: string;
  updated_at: string;
  profiles?: {
    id: string;
    name: string;
    email: string;
  };
  orders?: Array<{
    id: string;
    vendor_id: string;
    product_id: string;
    quantity: number;
    total_price: number;
    status: string;
    menu_items?: {
      title: string;
    };
  }>;
}

// GET /api/admin/payments - Get all payments with user information and related orders
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

    // Get query parameters for filtering
    const { searchParams } = new URL(req.url);
    const statusFilter = searchParams.get("status");
    const searchQuery = searchParams.get("search");

    // Fetch all payments
    let paymentsQuery = supabaseAdmin
      .from("payments")
      .select("*")
      .order("created_at", { ascending: false });

    // Apply status filter
    if (statusFilter && statusFilter !== "all") {
      paymentsQuery = paymentsQuery.eq("status", statusFilter);
    }

    const { data: payments, error: paymentsError } = await paymentsQuery;

    if (paymentsError) {
      console.error("Error fetching payments:", paymentsError);
      console.error("Payment error details:", {
        message: paymentsError.message,
        details: paymentsError.details,
        hint: paymentsError.hint,
        code: paymentsError.code
      });
      return NextResponse.json(
        { 
          error: "Failed to fetch payments",
          details: paymentsError.message,
          code: paymentsError.code
        },
        { status: 500 }
      );
    }

    if (!payments || payments.length === 0) {
      return NextResponse.json({ payments: [], summary: {
        totalRevenue: 0,
        totalCommission: 0,
        totalTax: 0,
        successfulPayments: 0,
        pendingPayments: 0,
        failedPayments: 0,
      } });
    }

    // Get unique user IDs
    const userIds = [...new Set(payments.map((p: any) => p.user_id).filter(Boolean))];

    // Fetch user profiles
    const { data: userProfiles } = await supabaseAdmin
      .from("profiles")
      .select("id, name, email")
      .in("id", userIds);

    // Create map for quick lookup
    const userProfileMap = new Map();
    userProfiles?.forEach((profile) => {
      userProfileMap.set(profile.id, profile);
    });

    // Fetch related orders for each payment (if payment_reference exists)
    const paymentReferences = payments
      .map((p: any) => p.payment_reference)
      .filter(Boolean) as string[];

    let ordersByPayment: Map<string, any[]> = new Map();
    if (paymentReferences.length > 0) {
      const { data: orders } = await supabaseAdmin
        .from("orders")
        .select(`
          id,
          vendor_id,
          product_id,
          quantity,
          total_price,
          status,
          payment_reference,
          menu_items (
            title
          )
        `)
        .in("payment_reference", paymentReferences);

      // Group orders by payment_reference
      orders?.forEach((order) => {
        if (order.payment_reference) {
          const existing = ordersByPayment.get(order.payment_reference) || [];
          existing.push(order);
          ordersByPayment.set(order.payment_reference, existing);
        }
      });
    }

    // Fetch vendor information for orders
    const vendorIds = [...new Set(
      Array.from(ordersByPayment.values())
        .flat()
        .map((o: any) => o.vendor_id)
        .filter(Boolean)
    )];

    let vendorMap = new Map();
    if (vendorIds.length > 0) {
      // Fetch vendor profiles
      const { data: vendorProfiles } = await supabaseAdmin
        .from("profiles")
        .select("id, name")
        .in("id", vendorIds)
        .eq("role", "vendor");

      // Fetch vendor business info
      const { data: vendors } = await supabaseAdmin
        .from("vendors")
        .select("profile_id, business_name")
        .in("profile_id", vendorIds);

      vendorProfiles?.forEach((profile) => {
        const vendor = vendors?.find((v) => v.profile_id === profile.id);
        vendorMap.set(profile.id, {
          name: vendor?.business_name || profile.name,
          profile_name: profile.name,
        });
      });
    }

    // Combine payments with user information, orders, and vendor details
    const paymentsWithDetails: PaymentWithDetails[] = payments.map((payment: any) => {
      const userProfile = userProfileMap.get(payment.user_id);
      const relatedOrders = payment.payment_reference
        ? ordersByPayment.get(payment.payment_reference) || []
        : [];

      // Add vendor information to orders
      const ordersWithVendors = relatedOrders.map((order: any) => {
        const vendorInfo = vendorMap.get(order.vendor_id);
        return {
          ...order,
          vendor_name: vendorInfo?.name || "Unknown Vendor",
        };
      });

      return {
        ...payment,
        profiles: userProfile || { id: payment.user_id, name: "Unknown User", email: "N/A" },
        orders: ordersWithVendors,
      };
    });

    // Apply search filter if provided
    let filteredPayments = paymentsWithDetails;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filteredPayments = paymentsWithDetails.filter((payment) => {
        return (
          payment.id.toLowerCase().includes(query) ||
          payment.payment_reference?.toLowerCase().includes(query) ||
          payment.profiles?.name?.toLowerCase().includes(query) ||
          payment.profiles?.email?.toLowerCase().includes(query) ||
          payment.status?.toLowerCase().includes(query)
        );
      });
    }

    // Calculate summary statistics
    const successfulPayments = filteredPayments.filter((p) => p.status === "success");
    const pendingPayments = filteredPayments.filter((p) => p.status === "pending");
    const failedPayments = filteredPayments.filter((p) => p.status === "failed");

    const totalRevenue = successfulPayments.reduce(
      (sum, p) => sum + (Number(p.total_amount) || 0),
      0
    );

    // Calculate commission from related orders (10% commission rate)
    const COMMISSION_RATE = 0.10;
    let totalCommission = 0;
    
    // Calculate commission from orders linked to successful payments
    for (const payment of successfulPayments) {
      if (payment.orders && payment.orders.length > 0) {
        const orderTotal = payment.orders.reduce(
          (sum, order) => sum + (Number(order.total_price) || 0),
          0
        );
        totalCommission += orderTotal * COMMISSION_RATE;
      } else if (payment.total_amount) {
        // Fallback: calculate from payment amount if no orders
        totalCommission += Number(payment.total_amount) * COMMISSION_RATE;
      }
    }
    
    const totalTax = 0;

    return NextResponse.json({
      payments: filteredPayments,
      summary: {
        totalRevenue,
        totalCommission,
        totalTax,
        successfulPayments: successfulPayments.length,
        pendingPayments: pendingPayments.length,
        failedPayments: failedPayments.length,
      },
    });
  } catch (error: unknown) {
    console.error("Error in GET /api/admin/payments:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}



