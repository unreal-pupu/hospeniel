import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { orderId, newStatus, vendorId } = body;

    console.log("📦 Order update request:", { orderId, newStatus, vendorId });

    if (!orderId || !newStatus) {
      console.error("❌ Missing required fields:", { orderId: !!orderId, newStatus: !!newStatus });
      return NextResponse.json(
        { success: false, error: "Order ID and status are required" },
        { status: 400 }
      );
    }

    // Validate status
    const validStatuses = ["Accepted", "Rejected", "Completed", "Cancelled"];
    if (!validStatuses.includes(newStatus)) {
      return NextResponse.json(
        { success: false, error: "Invalid status" },
        { status: 400 }
      );
    }

    // Get order details to create notification
    // First, get the order without joins to verify it exists
    console.log("🔍 Fetching order:", orderId);
    const { data: order, error: orderError } = await supabaseAdmin
      .from("orders")
      .select("*")
      .eq("id", orderId)
      .single();

    if (orderError) {
      console.error("❌ Order fetch error:", {
        code: orderError.code,
        message: orderError.message,
        details: orderError.details,
        hint: orderError.hint,
      });
      return NextResponse.json(
        { 
          success: false, 
          error: "Order not found", 
          details: orderError.message,
          code: orderError.code,
        },
        { status: 404 }
      );
    }

    if (!order) {
      console.error("❌ Order not found (null result)");
      return NextResponse.json(
        { success: false, error: "Order not found" },
        { status: 404 }
      );
    }

    console.log("✅ Order found:", { 
      id: order.id, 
      vendor_id: order.vendor_id, 
      user_id: order.user_id,
      status: order.status 
    });

    // Verify the order belongs to the vendor (if vendorId is provided)
    if (vendorId && order.vendor_id !== vendorId) {
      console.error("Order vendor mismatch:", { orderVendorId: order.vendor_id, providedVendorId: vendorId });
      return NextResponse.json(
        { success: false, error: "Order does not belong to this vendor" },
        { status: 403 }
      );
    }

    // Fetch menu item title separately (more reliable than join)
    let menuItemTitle = "item";
    if (order.product_id) {
      const { data: menuItem } = await supabaseAdmin
        .from("menu_items")
        .select("title")
        .eq("id", order.product_id)
        .single();
      
      if (menuItem) {
        menuItemTitle = menuItem.title;
      }
    }

    // Update order status
    // Note: updated_at is automatically updated by database trigger
    const { error: updateError } = await supabaseAdmin
      .from("orders")
      .update({ 
        status: newStatus,
      })
      .eq("id", orderId);

    if (updateError) {
      console.error("Error updating order:", updateError);
      return NextResponse.json(
        { success: false, error: updateError.message },
        { status: 500 }
      );
    }

    // Create notification for the user
    const notificationMessage = 
      newStatus === "Accepted" 
        ? `Your order for ${menuItemTitle} has been accepted by the vendor!`
        : newStatus === "Rejected"
        ? `Your order for ${menuItemTitle} has been declined by the vendor.`
        : newStatus === "Completed"
        ? `Your order for ${menuItemTitle} has been completed!`
        : `Your order for ${menuItemTitle} has been cancelled.`;

    const { error: notificationError } = await supabaseAdmin
      .from("notifications")
      .insert({
        user_id: order.user_id,
        message: notificationMessage,
        type: "order_update", // Use valid type from database constraint
        read: false,
        metadata: {
          type: "order",
          order_id: orderId,
          order_status: newStatus,
        },
      });

    if (notificationError) {
      console.error("Error creating notification:", notificationError);
      // Don't fail the request if notification fails
    }

    // Also notify admin if order is rejected or cancelled
    if (newStatus === "Rejected" || newStatus === "Cancelled") {
      const { data: adminUsers } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .eq("role", "admin");

      if (adminUsers && adminUsers.length > 0) {
        const adminNotifications = adminUsers.map((admin) => ({
          user_id: admin.id,
          message: `Order #${orderId.substring(0, 8)} has been ${newStatus.toLowerCase()} by vendor.`,
          type: "order_update", // Use valid type from database constraint
          read: false,
          metadata: {
            type: "order",
            order_id: orderId,
            order_status: newStatus,
          },
        }));

        await supabaseAdmin
          .from("notifications")
          .insert(adminNotifications);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Order status updated to ${newStatus}`,
      order: {
        id: orderId,
        status: newStatus,
      },
    });
  } catch (error: any) {
    console.error("Error in update order status API:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
        message: error.message,
      },
      { status: 500 }
    );
  }
}

