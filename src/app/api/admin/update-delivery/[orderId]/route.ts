import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase";

/**
 * PUT /api/admin/update-delivery/:orderId
 * 
 * Allows admins to update delivery information for an order or user
 * 
 * Body:
 * - delivery_address_line_1 (string): Street address
 * - delivery_city (string): City
 * - delivery_state (string): State
 * - delivery_postal_code (string, optional): Postal code
 * - delivery_phone_number (string, optional): Phone number
 * - user_id (string, optional): If provided, also update user's profile
 */
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const supabaseAdmin = getSupabaseAdminClient();
    const { orderId } = await params;
    const body = await req.json();

    const {
      delivery_address_line_1,
      delivery_city,
      delivery_state,
      delivery_postal_code,
      delivery_phone_number,
      user_id,
    } = body;

    // Validate required fields
    if (!delivery_address_line_1 || !delivery_city || !delivery_state) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing required fields: delivery_address_line_1, delivery_city, delivery_state",
        },
        { status: 400 }
      );
    }

    // Verify order exists and get order details (including vendor_id, total_price, quantity)
    const { data: order, error: orderError } = await supabaseAdmin
      .from("orders")
      .select("id, user_id, vendor_id, total_price, quantity, status")
      .eq("id", orderId)
      .single();

    if (orderError || !order) {
      return NextResponse.json(
        {
          success: false,
          error: "Order not found",
        },
        { status: 404 }
      );
    }

    // Update order delivery information
    const orderUpdateData: {
      delivery_address_line_1: string;
      delivery_city: string;
      delivery_state: string;
      delivery_postal_code?: string;
      delivery_phone_number?: string;
    } = {
      delivery_address_line_1: delivery_address_line_1.trim(),
      delivery_city: delivery_city.trim(),
      delivery_state: delivery_state.trim(),
    };

    if (delivery_postal_code) {
      orderUpdateData.delivery_postal_code = delivery_postal_code.trim();
    }

    if (delivery_phone_number) {
      orderUpdateData.delivery_phone_number = delivery_phone_number.trim();
    }

    const { error: updateOrderError } = await supabaseAdmin
      .from("orders")
      .update(orderUpdateData)
      .eq("id", orderId);

    if (updateOrderError) {
      console.error("Error updating order delivery info:", updateOrderError);
      return NextResponse.json(
        {
          success: false,
          error: updateOrderError.message || "Failed to update order delivery information",
        },
        { status: 500 }
      );
    }

    // If user_id is provided, also update user's profile delivery information
    const targetUserId = user_id || order.user_id;
    if (targetUserId) {
      const profileUpdateData: {
        delivery_address_line_1: string;
        delivery_city: string;
        delivery_state: string;
        delivery_postal_code?: string;
        phone_number?: string;
        address: string;
      } = {
        delivery_address_line_1: delivery_address_line_1.trim(),
        delivery_city: delivery_city.trim(),
        delivery_state: delivery_state.trim(),
        address: delivery_address_line_1.trim(), // Main address field for backward compatibility
      };

      if (delivery_postal_code) {
        profileUpdateData.delivery_postal_code = delivery_postal_code.trim();
      }

      if (delivery_phone_number) {
        profileUpdateData.phone_number = delivery_phone_number.trim();
      }

      const { error: updateProfileError } = await supabaseAdmin
        .from("profiles")
        .update(profileUpdateData)
        .eq("id", targetUserId);

      if (updateProfileError) {
        console.error("Error updating profile delivery info:", updateProfileError);
        // Don't fail the request if profile update fails - order update was successful
        console.warn("⚠️ Order delivery info updated, but profile update failed");
      }
    }

    // Recalculate delivery charge if order is still pending
    let deliveryCharge = 0;
    try {
      // Fetch vendor location for delivery charge calculation
      // Get vendor info from vendors table (using vendor_id from order)
      const { data: vendorInfo } = await supabaseAdmin
        .from("vendors")
        .select("location, profile_id")
        .eq("profile_id", order.vendor_id)
        .maybeSingle();

      // Also get vendor profile for delivery city/state if available
      const { data: vendorProfile } = await supabaseAdmin
        .from("profiles")
        .select("location, delivery_city, delivery_state")
        .eq("id", order.vendor_id)
        .eq("role", "vendor")
        .maybeSingle();

      const vendorLocation = vendorInfo?.location || vendorProfile?.location || "";
      const vendorCity = vendorProfile?.delivery_city || "";
      const vendorState = vendorProfile?.delivery_state || "";

      // Calculate delivery charge
      const calculateResponse = await fetch(
        `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/delivery/calculate`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            delivery_address: delivery_address_line_1,
            delivery_city: delivery_city,
            delivery_state: delivery_state,
            delivery_postal_code: delivery_postal_code,
            vendor_location: vendorLocation,
            vendor_city: vendorCity,
            vendor_state: vendorState,
            order_total: order.total_price || 0,
            item_count: order.quantity || 1,
          }),
        }
      );

      if (calculateResponse.ok) {
        const calculateData = await calculateResponse.json();
        if (calculateData.success) {
          deliveryCharge = calculateData.delivery_charge || 0;

          // Update order with delivery charge
          await supabaseAdmin
            .from("orders")
            .update({ delivery_charge: deliveryCharge })
            .eq("id", orderId);
        }
      }
    } catch (chargeError) {
      console.error("Error calculating delivery charge:", chargeError);
      // Don't fail the request if delivery charge calculation fails
    }

    return NextResponse.json(
      {
        success: true,
        message: "Delivery information updated successfully",
        order_id: orderId,
        delivery_charge: deliveryCharge,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error updating delivery information:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to update delivery information";
    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}

