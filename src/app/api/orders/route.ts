import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { checkRateLimit, RateLimitConfigs } from "@/lib/rateLimiter";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Create admin client (service key = full DB access)
const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

export async function POST(req: Request) {
  // Rate limiting: 10 checkout/payment requests per minute per IP
  const rateLimitResult = checkRateLimit(
    "/api/orders",
    req,
    RateLimitConfigs.CHECKOUT
  );

  if (!rateLimitResult.success) {
    return NextResponse.json(
      {
        success: false,
        error: "Too many requests. Please try again later.",
        retryAfter: rateLimitResult.retryAfter,
        message: `Rate limit exceeded. Please wait ${rateLimitResult.retryAfter} seconds before trying again.`,
      },
      {
        status: 429,
        headers: {
          "Retry-After": rateLimitResult.retryAfter?.toString() || "60",
          "X-RateLimit-Limit": RateLimitConfigs.CHECKOUT.maxRequests.toString(),
          "X-RateLimit-Remaining": rateLimitResult.remaining.toString(),
          "X-RateLimit-Reset": new Date(rateLimitResult.resetTime).toISOString(),
        },
      }
    );
  }

  try {
    const body = await req.json();
    const { name, email, phone, address, paymentMethod, cartItems, createdAt } = body;

    // Validate input
    if (!name || !email || !phone || !address || !paymentMethod || !cartItems || cartItems.length === 0) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Get authenticated user if available
    const authHeader = req.headers.get("authorization");
    let userId: string | null = null;

    if (authHeader) {
      try {
        const token = authHeader.replace("Bearer ", "");
        const { data: { user } } = await supabaseAdmin.auth.getUser(token);
        if (user) {
          userId = user.id;
        }
      } catch (error) {
        // User not authenticated, continue as guest
        console.log("Guest order placement");
      }
    }

    // Calculate total
    const total = cartItems.reduce(
      (sum: number, item: any) => sum + (item.price * item.quantity),
      0
    );

    // Group items by vendor
    const ordersByVendor = new Map<string, any[]>();
    
    for (const item of cartItems) {
      const vendorId = item.vendor_id || item.vendors?.id;
      if (!vendorId) continue;

      if (!ordersByVendor.has(vendorId)) {
        ordersByVendor.set(vendorId, []);
      }
      ordersByVendor.get(vendorId)!.push({
        menu_item_id: item.id,
        quantity: item.quantity,
        price: item.price,
      });
    }

    // Create orders for each vendor
    const orderPromises = Array.from(ordersByVendor.entries()).map(
      async ([vendorId, items]) => {
        const orderTotal = items.reduce(
          (sum, item) => sum + item.price * item.quantity,
          0
        );

        const orderData = {
          user_id: userId,
          vendor_id: vendorId,
          customer_name: name,
          customer_email: email,
          customer_phone: phone,
          customer_address: address,
          payment_method: paymentMethod,
          status: "pending",
          total: orderTotal,
          items: items,
          created_at: createdAt || new Date().toISOString(),
        };

        const { data, error } = await supabaseAdmin
          .from("orders")
          .insert(orderData)
          .select()
          .single();

        if (error) {
          console.error("Error creating order:", error);
          throw error;
        }

        return data;
      }
    );

    const orders = await Promise.all(orderPromises);

    console.log("✅ Orders created successfully:", orders.length);

    return NextResponse.json(
      { success: true, orders },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("🔥 Orders route crashed:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to place order" },
      { status: 500 }
    );
  }
}




