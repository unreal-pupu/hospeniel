import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase";

export async function POST(req: Request) {
  try {
    const supabaseAdmin = getSupabaseAdminClient();
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
    console.log("🔄 Updating order status in database...");
    const { data: updateData, error: updateError } = await supabaseAdmin
      .from("orders")
      .update({ 
        status: newStatus,
      })
      .eq("id", orderId)
      .select();

    if (updateError) {
      console.error("❌ Error updating order:", updateError);
      console.error("Update error details:", {
        code: updateError.code,
        message: updateError.message,
        details: updateError.details,
        hint: updateError.hint,
      });
      return NextResponse.json(
        { success: false, error: updateError.message },
        { status: 500 }
      );
    }

    if (!updateData || updateData.length === 0) {
      console.error("❌ Order update returned no rows");
      return NextResponse.json(
        { success: false, error: "Order not found or update failed" },
        { status: 404 }
      );
    }

    console.log("✅ Order status updated successfully:", {
      orderId,
      oldStatus: order.status,
      newStatus,
      updatedRows: updateData.length,
    });

    // Create notification for the user
    // Database trigger will also create notification, but we create enhanced one here
    let notificationType = "order_update";
    let notificationTitle = "Order Update";
    let notificationMessage = "";
    
    if (newStatus === "Accepted") {
      notificationType = "order_accepted";
      notificationTitle = "Your order has been accepted";
      notificationMessage = `Your order #${orderId.substring(0, 8)} for ${menuItemTitle} is being prepared`;
    } else if (newStatus === "Rejected") {
      notificationType = "order_rejected";
      notificationTitle = "Order declined";
      notificationMessage = `Your order #${orderId.substring(0, 8)} for ${menuItemTitle} has been declined by the vendor`;
    } else if (newStatus === "Completed") {
      notificationType = "order_completed";
      notificationTitle = "Order completed";
      notificationMessage = `Your order #${orderId.substring(0, 8)} for ${menuItemTitle} has been completed!`;
    } else if (newStatus === "Cancelled") {
      notificationType = "order_cancelled";
      notificationTitle = "Order cancelled";
      notificationMessage = `Your order #${orderId.substring(0, 8)} for ${menuItemTitle} has been cancelled`;
    } else {
      notificationMessage = `Your order #${orderId.substring(0, 8)} for ${menuItemTitle} status has been updated to ${newStatus}`;
    }

    try {
      const { error: notificationError } = await supabaseAdmin
        .from("notifications")
        .insert({
          user_id: order.user_id,
          type: notificationType,
          title: notificationTitle,
          message: notificationMessage,
          read: false,
          metadata: {
            type: "order",
            order_id: orderId,
            order_status: newStatus,
            menu_item_title: menuItemTitle,
          },
        });

      if (notificationError) {
        console.error("Error creating notification:", notificationError);
        console.error("Notification error details:", {
          code: notificationError.code,
          message: notificationError.message,
          details: notificationError.details,
          hint: notificationError.hint,
        });
        // Don't fail the request if notification fails - trigger should handle it
      } else {
        console.log(`✅ Notification created for customer ${order.user_id} about order ${orderId}`);
      }
    } catch (notificationException) {
      console.error("Exception creating notification:", notificationException);
      // Don't fail the request - order update succeeded
    }

    // Also notify admin if order is rejected or cancelled (non-blocking)
    if (newStatus === "Rejected" || newStatus === "Cancelled") {
      try {
        const { data: adminUsers, error: adminFetchError } = await supabaseAdmin
          .from("profiles")
          .select("id")
          .eq("role", "admin");

        if (adminFetchError) {
          console.error("Error fetching admin users:", adminFetchError);
          // Don't fail the request - continue
        } else if (adminUsers && adminUsers.length > 0) {
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

          const { error: adminNotificationError } = await supabaseAdmin
            .from("notifications")
            .insert(adminNotifications);

          if (adminNotificationError) {
            console.error("Error creating admin notifications:", adminNotificationError);
            // Don't fail the request - main notification was created
          } else {
            console.log(`✅ Admin notifications created for ${adminUsers.length} admin(s)`);
          }
        }
      } catch (adminError) {
        console.error("Error in admin notification process:", adminError);
        // Don't fail the request - continue to return success
      }
    }

    console.log("✅ Order update API completed successfully");
    return NextResponse.json({
      success: true,
      message: `Order status updated to ${newStatus}`,
      order: {
        id: orderId,
        status: newStatus,
      },
    });
  } catch (error) {
    console.error("Error in update order status API:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to update order status";
    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
        message: errorMessage,
      },
      { status: 500 }
    );
  }
}

