import { NextResponse } from "next/server";
import { getDeliveryFeeByState, getDeliveryZoneByState } from "@/lib/deliveryFees";
import { parseJsonBody } from "@/lib/validation/http";
import { deliveryCalculateSchema } from "@/lib/validation/schemas";

/**
 * Calculate delivery charge based on state selection
 *
 * State-based helper uses `getDeliveryFeeByState` / `DELIVERY_ZONES` in `deliveryFees.ts`
 * (Bayelsa default aligns with landmark tier: base + ₦200 surcharge).
 */

export async function POST(req: Request) {
  try {
    const parsed = await parseJsonBody(req, deliveryCalculateSchema, "POST /api/delivery/calculate");
    if (!parsed.ok) return parsed.response;

    const { delivery_state, item_count: itemCountInput } = parsed.data;
    const item_count = itemCountInput ?? 1;

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
