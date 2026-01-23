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
    const { deliveryTaskId, newStatus, riderId } = body;

    console.log("🚴 Update delivery task status:", { deliveryTaskId, newStatus, riderId });

    if (!deliveryTaskId || !newStatus || !riderId) {
      return NextResponse.json(
        { success: false, error: "Delivery task ID, status, and rider ID are required" },
        { status: 400 }
      );
    }

    // Validate status
    const validStatuses = ["Assigned", "PickedUp", "Delivered"];
    if (!validStatuses.includes(newStatus)) {
      return NextResponse.json(
        { success: false, error: `Invalid status. Must be one of: ${validStatuses.join(", ")}` },
        { status: 400 }
      );
    }

    // Get delivery task
    const { data: deliveryTask, error: taskError } = await supabaseAdmin
      .from("delivery_tasks")
      .select("*")
      .eq("id", deliveryTaskId)
      .single();

    if (taskError || !deliveryTask) {
      return NextResponse.json(
        { success: false, error: "Delivery task not found" },
        { status: 404 }
      );
    }

    // Verify task belongs to this rider
    if (deliveryTask.rider_id !== riderId) {
      return NextResponse.json(
        { success: false, error: "Delivery task does not belong to this rider" },
        { status: 403 }
      );
    }

    // Validate status transitions
    const currentStatus = deliveryTask.status;
    if (newStatus === "PickedUp" && currentStatus !== "Assigned") {
      return NextResponse.json(
        { success: false, error: `Cannot mark as PickedUp. Current status: ${currentStatus}` },
        { status: 400 }
      );
    }

    if (newStatus === "Delivered" && currentStatus !== "PickedUp") {
      return NextResponse.json(
        { success: false, error: `Cannot mark as Delivered. Current status: ${currentStatus}` },
        { status: 400 }
      );
    }

    const paymentReference = deliveryTask.payment_reference as string | null;
    const pickupSequence = deliveryTask.pickup_sequence as number | null;

    if (newStatus === "PickedUp" && paymentReference && pickupSequence) {
      const { data: previousStops, error: previousError } = await supabaseAdmin
        .from("delivery_tasks")
        .select("id, status, pickup_sequence")
        .eq("payment_reference", paymentReference)
        .lt("pickup_sequence", pickupSequence);

      if (previousError) {
        console.error("❌ Error checking previous pickup stops:", previousError);
      } else {
        const pendingStops = (previousStops || []).filter(
          (stop) => stop.status !== "PickedUp" && stop.status !== "Delivered"
        );
        if (pendingStops.length > 0) {
          return NextResponse.json(
            { success: false, error: "Please pick up earlier stops before marking this pickup." },
            { status: 400 }
          );
        }
      }
    }

    // Prepare update data
    const updateData: {
      status: string;
      picked_up_at?: string;
      delivered_at?: string;
    } = {
      status: newStatus,
    };

    if (newStatus === "PickedUp" && !deliveryTask.picked_up_at) {
      updateData.picked_up_at = new Date().toISOString();
    }

    if (newStatus === "Delivered" && !deliveryTask.delivered_at) {
      updateData.delivered_at = new Date().toISOString();
    }

    // Update delivery task
    const { data: updatedTask, error: updateError } = await supabaseAdmin
      .from("delivery_tasks")
      .update(updateData)
      .eq("id", deliveryTaskId)
      .select()
      .single();

    if (updateError) {
      console.error("❌ Error updating delivery task:", updateError);
      return NextResponse.json(
        { success: false, error: updateError.message },
        { status: 500 }
      );
    }

    console.log("✅ Delivery task status updated:", { deliveryTaskId, newStatus });

    if (newStatus === "PickedUp") {
      let totalStops = 1;
      if (paymentReference) {
        const { data: groupTasks } = await supabaseAdmin
          .from("delivery_tasks")
          .select("id")
          .eq("payment_reference", paymentReference);
        totalStops = groupTasks?.length || 1;
      }

      const pickupLabel = pickupSequence ? `Stop ${pickupSequence} of ${totalStops}` : "Pickup confirmed";

      const { error: vendorNotifError } = await supabaseAdmin
        .from("notifications")
        .insert({
          vendor_id: deliveryTask.vendor_id,
          type: "delivery_pickup",
          title: "Order Picked Up",
          message: `Your order has been picked up. ${pickupLabel}.`,
          read: false,
          metadata: {
            type: "delivery_pickup",
            order_id: deliveryTask.order_id,
            payment_reference: paymentReference,
            pickup_sequence: pickupSequence,
            total_stops: totalStops,
          },
        });

      if (vendorNotifError) {
        console.error("❌ Failed to notify vendor about pickup:", vendorNotifError);
      }

      const { error: riderNotifError } = await supabaseAdmin
        .from("notifications")
        .insert({
          vendor_id: riderId,
          type: "delivery_pickup",
          title: "Pickup Confirmed",
          message: `Pickup confirmed for ${pickupLabel}.`,
          read: false,
          metadata: {
            type: "delivery_pickup",
            order_id: deliveryTask.order_id,
            payment_reference: paymentReference,
            pickup_sequence: pickupSequence,
            total_stops: totalStops,
          },
        });

      if (riderNotifError) {
        console.error("❌ Failed to notify rider about pickup:", riderNotifError);
      }
    }

    // If status is Delivered, the trigger will update the order status and send notifications
    return NextResponse.json({
      success: true,
      message: `Delivery task status updated to ${newStatus}`,
      deliveryTask: {
        id: updatedTask.id,
        orderId: updatedTask.order_id,
        status: updatedTask.status,
      },
    });
  } catch (error) {
    console.error("❌ Error in update delivery task status API:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to update delivery task status";
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




