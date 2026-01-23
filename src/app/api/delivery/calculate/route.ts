import { NextResponse } from "next/server";
import { getDeliveryFeeByState, getDeliveryZoneByState } from "@/lib/deliveryFees";

/**
 * Calculate delivery charge based on state selection
 * 
 * Fixed pricing based on delivery zones (states):
 * - Bayelsa (Yenagoa): ₦2,000
 * - Rivers (Port Harcourt): ₦2,000
 * - Abuja (FCT): ₦2,500
 * - Lagos: ₦3,000
 */

interface CalculateDeliveryRequest {
  delivery_address: string;
  delivery_city: string;
  delivery_state: string;
  delivery_postal_code?: string;
  vendor_location?: string;
  vendor_city?: string;
  vendor_state?: string;
  order_total?: number;
  item_count?: number;
}

export async function POST(req: Request) {
  try {
    const body: CalculateDeliveryRequest = await req.json();
    const {
      delivery_state,
      item_count = 1,
    } = body;

    // Validate required fields
    if (!delivery_state) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing required delivery information (state)",
        },
        { status: 400 }
      );
    }

    // Calculate delivery charge based on state selection (state-based pricing)
    const deliveryCharge = getDeliveryFeeByState(delivery_state);
    const deliveryZoneInfo = getDeliveryZoneByState(delivery_state);
    
    if (deliveryCharge === 0 || !deliveryZoneInfo) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid state selected. Please select one of the available delivery zones: Lagos, Abuja (FCT), Rivers, or Bayelsa.`,
        },
        { status: 400 }
      );
    }

    const deliveryZone = deliveryZoneInfo.state;
    const estimatedDeliveryTime = "0–30 minutes";

    return NextResponse.json(
      {
        success: true,
        delivery_charge: deliveryCharge,
        delivery_zone: deliveryZone,
        estimated_delivery_time: estimatedDeliveryTime,
        currency: "NGN",
        breakdown: {
          state: deliveryZone,
          fee: deliveryCharge,
          item_count: item_count,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error calculating delivery charge:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to calculate delivery charge";
    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}





