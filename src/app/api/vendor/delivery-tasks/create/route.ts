import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("❌ Missing Supabase environment variables");
  throw new Error("Supabase configuration is missing");
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { 
    autoRefreshToken: false, 
    persistSession: false,
  },
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { orderId, vendorId } = body;

    console.log("📦 Create delivery task request:", { orderId, vendorId });

    if (!orderId || !vendorId) {
      return NextResponse.json(
        { success: false, error: "Order ID and vendor ID are required" },
        { status: 400 }
      );
    }

    // Get order details
    const { data: order, error: orderError } = await supabaseAdmin
      .from("orders")
      .select("*")
      .eq("id", orderId)
      .single();

    if (orderError || !order) {
      console.error("❌ Order not found:", orderError);
      return NextResponse.json(
        { success: false, error: "Order not found" },
        { status: 404 }
      );
    }

    // Verify order belongs to vendor
    if (order.vendor_id !== vendorId) {
      console.error("❌ Order vendor mismatch:", {
        orderVendorId: order.vendor_id,
        providedVendorId: vendorId,
      });
      return NextResponse.json(
        { success: false, error: "Order does not belong to this vendor" },
        { status: 403 }
      );
    }

    // Verify vendor exists and is a vendor
    const { data: vendorCheck, error: vendorCheckError } = await supabaseAdmin
      .from("profiles")
      .select("id, role")
      .eq("id", vendorId)
      .single();

    if (vendorCheckError || !vendorCheck) {
      console.error("❌ Vendor not found:", vendorCheckError);
      return NextResponse.json(
        { success: false, error: "Vendor not found" },
        { status: 404 }
      );
    }

    // Optional: Verify vendor role (not strictly necessary but good for security)
    if (vendorCheck.role && vendorCheck.role.toLowerCase() !== "vendor") {
      console.warn("⚠️ User is not a vendor:", vendorCheck.role);
      // Still allow - might be an admin or other role managing orders
    }

    // Check if delivery task already exists for this order
    const { data: existingTask } = await supabaseAdmin
      .from("delivery_tasks")
      .select("id, status")
      .eq("order_id", orderId)
      .maybeSingle();

    if (existingTask) {
      return NextResponse.json(
        { 
          success: false, 
          error: "Delivery task already exists for this order",
          deliveryTaskId: existingTask.id,
          status: existingTask.status
        },
        { status: 400 }
      );
    }

    const normalizeLocation = (value: string | null | undefined) => {
      if (!value) return null;
      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : null;
    };

    // Get vendor location/address from profiles table
    const { data: vendorProfile } = await supabaseAdmin
      .from("profiles")
      .select("address, location")
      .eq("id", vendorId)
      .maybeSingle();

    // Fallback to vendors table if profile location is missing
    const { data: vendorRow } = await supabaseAdmin
      .from("vendors")
      .select("location")
      .eq("profile_id", vendorId)
      .maybeSingle();

    const pickupAddress = vendorProfile?.address || vendorProfile?.location || vendorRow?.location || "Vendor Location";
    const vendorLocation = normalizeLocation(order.delivery_zone)
      || normalizeLocation(order.delivery_state)
      || normalizeLocation(vendorProfile?.location)
      || normalizeLocation(vendorRow?.location)
      || normalizeLocation(order.delivery_city);

    // Prepare delivery address from order
    const deliveryAddress = [
      order.delivery_address_line_1 || order.delivery_address,
      order.delivery_city,
      order.delivery_state,
      order.delivery_postal_code
    ].filter(Boolean).join(", ");

    if (!deliveryAddress) {
      return NextResponse.json(
        { success: false, error: "Order missing delivery address" },
        { status: 400 }
      );
    }

    // Create delivery task using service role (bypasses RLS)
    console.log("🔄 Creating delivery task with service role...");
    console.log("🔄 Service role key present:", !!serviceRoleKey);
    console.log("🔄 Supabase URL:", supabaseUrl);
    console.log("📍 Vendor location:", vendorLocation);
    console.log("📍 Vendor location sources:", {
      order_delivery_zone: order.delivery_zone || null,
      order_delivery_state: order.delivery_state || null,
      order_delivery_city: order.delivery_city || null,
      profile_location: vendorProfile?.location || null,
      vendor_row_location: vendorRow?.location || null,
    });
    
    const { data: deliveryTask, error: createError } = await supabaseAdmin
      .from("delivery_tasks")
      .insert({
        order_id: orderId,
        vendor_id: vendorId,
        vendor_location: vendorLocation, // Store vendor's location for zone-based rider assignment
        pickup_address: pickupAddress,
        delivery_address: deliveryAddress,
        delivery_phone: order.delivery_phone_number || order.delivery_phone,
        payment_reference: order.payment_reference || null,
        status: "Pending",
      })
      .select()
      .single();

    if (createError) {
      console.error("❌ Error creating delivery task:", createError);
      console.error("❌ Error code:", createError.code);
      console.error("❌ Error message:", createError.message);
      console.error("❌ Error details:", createError.details);
      console.error("❌ Error hint:", createError.hint);
      
      // If it's a permission error, provide more context
      if (createError.code === "42501" || createError.message?.includes("permission denied")) {
        console.error("❌ PERMISSION ERROR: Service role may not have proper grants on delivery_tasks table");
        console.error("❌ Please run the migration: 20250117_fix_delivery_tasks_permissions.sql");
        return NextResponse.json(
          { 
            success: false, 
            error: "Permission denied. Please ensure service role has proper permissions on delivery_tasks table.",
            details: createError.message,
            code: createError.code,
          },
          { status: 500 }
        );
      }
      
      return NextResponse.json(
        { 
          success: false, 
          error: createError.message,
          code: createError.code,
          details: createError.details,
        },
        { status: 500 }
      );
    }

    console.log("✅ Delivery task created:", deliveryTask.id);

    return NextResponse.json({
      success: true,
      message: "Delivery task created successfully. Riders will be notified.",
      deliveryTask: {
        id: deliveryTask.id,
        orderId: deliveryTask.order_id,
        status: deliveryTask.status,
      },
    });
  } catch (error) {
    console.error("❌ Error in create delivery task API:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to create delivery task";
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

