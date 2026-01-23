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
    const { deliveryTaskId, riderId } = body;

    console.log("🚴 Accept delivery task request:", { deliveryTaskId, riderId });

    if (!deliveryTaskId || !riderId) {
      return NextResponse.json(
        { success: false, error: "Delivery task ID and rider ID are required" },
        { status: 400 }
      );
    }

    // Verify rider exists and is approved
    const { data: riderProfile, error: riderError } = await supabaseAdmin
      .from("profiles")
      .select("id, role, location")
      .eq("id", riderId)
      .eq("role", "rider")
      .single();

    if (riderError || !riderProfile) {
      return NextResponse.json(
        { success: false, error: "Rider not found or not approved" },
        { status: 403 }
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

    // Verify task is available (status = Pending, no rider assigned)
    if (deliveryTask.status !== "Pending") {
      return NextResponse.json(
        { success: false, error: `Delivery task is not available. Current status: ${deliveryTask.status}` },
        { status: 400 }
      );
    }

    if (deliveryTask.rider_id) {
      return NextResponse.json(
        { success: false, error: "Delivery task is already assigned to another rider" },
        { status: 400 }
      );
    }

    const assignedAt = new Date().toISOString();
    const paymentReference = deliveryTask.payment_reference as string | null;
    const riderLocation = riderProfile?.location || null;

    const updateTaskAssignment = async (taskId: string, sequence: number | null) => {
      const { data, error } = await supabaseAdmin
        .from("delivery_tasks")
        .update({
          rider_id: riderId,
          status: "Assigned",
          assigned_at: assignedAt,
          pickup_sequence: sequence,
        })
        .eq("id", taskId)
        .select()
        .single();

      if (error) {
        throw error;
      }
      return data;
    };

    interface RelatedTaskRow {
      id: string;
      vendor_id: string;
      order_id: string;
      created_at: string;
      rider_id: string | null;
      status: string;
      vendor_location: string | null;
    }

    let updatedTask = null;
    let groupTasks: Array<{ id: string; vendor_id: string; order_id: string; created_at: string }> = [];

    if (paymentReference) {
      const { data: relatedTasks, error: relatedError } = await supabaseAdmin
        .from("delivery_tasks")
        .select("id, vendor_id, order_id, created_at, rider_id, status, vendor_location")
        .eq("payment_reference", paymentReference)
        .order("created_at", { ascending: true });

      if (relatedError) {
        console.error("❌ Error loading related delivery tasks:", relatedError);
      } else if (relatedTasks && relatedTasks.length > 0) {
        const typedTasks = relatedTasks as RelatedTaskRow[];
        groupTasks = typedTasks;
        if (riderLocation) {
          const matchesZone = typedTasks.some(
            (task) => task.vendor_location && task.vendor_location === riderLocation
          );
          if (!matchesZone) {
            return NextResponse.json(
              { success: false, error: "This delivery is assigned to a different zone." },
              { status: 403 }
            );
          }
        }
        let sequence = 1;
        for (const task of typedTasks) {
          if (task.status === "Pending" && !task.rider_id) {
            const assigned = await updateTaskAssignment(task.id, sequence);
            if (task.id === deliveryTaskId) {
              updatedTask = assigned;
            }
            sequence += 1;
          }
        }
      }
    }

    if (!updatedTask) {
      if (riderLocation && deliveryTask.vendor_location && deliveryTask.vendor_location !== riderLocation) {
        return NextResponse.json(
          { success: false, error: "This delivery is assigned to a different zone." },
          { status: 403 }
        );
      }
      updatedTask = await updateTaskAssignment(deliveryTaskId, null);
    }

    console.log("✅ Delivery task accepted by rider:", riderId);

    const totalStops = paymentReference ? groupTasks.length : 1;
    if (paymentReference && groupTasks.length > 0) {
      for (const task of groupTasks) {
        const { error: vendorNotifError } = await supabaseAdmin
          .from("notifications")
          .insert({
            vendor_id: task.vendor_id,
            type: "delivery_assigned",
            title: "Rider Assigned",
            message: "A rider has been assigned and will pick up this order soon.",
            read: false,
            metadata: {
              type: "delivery_assigned",
              order_id: task.order_id,
              payment_reference: paymentReference,
            },
          });

        if (vendorNotifError) {
          console.error("❌ Failed to notify vendor about rider assignment:", vendorNotifError);
        }
      }
    }

    const { error: riderNotifError } = await supabaseAdmin
      .from("notifications")
      .insert({
        vendor_id: riderId,
        type: "delivery_route_assigned",
        title: "Multi-stop Pickup Assigned",
        message: `You have ${totalStops} pickup stop${totalStops === 1 ? "" : "s"} for this order group.`,
        read: false,
        metadata: {
          type: "delivery_route_assigned",
          payment_reference: paymentReference,
          stop_count: totalStops,
        },
      });

    if (riderNotifError) {
      console.error("❌ Failed to notify rider about pickup route:", riderNotifError);
    }

    return NextResponse.json({
      success: true,
      message: "Delivery task accepted successfully",
      deliveryTask: {
        id: updatedTask.id,
        orderId: updatedTask.order_id,
        status: updatedTask.status,
        riderId: updatedTask.rider_id,
      },
    });
  } catch (error) {
    console.error("❌ Error in accept delivery task API:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to accept delivery task";
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




