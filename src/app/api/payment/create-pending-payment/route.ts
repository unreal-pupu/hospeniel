import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase";
import { isValidGuestId } from "@/lib/guestCheckoutValidation";

interface Body {
  guest_id?: string;
  subtotal?: number;
  tax_amount?: number;
  commission_amount?: number;
  total_amount?: number;
}

export async function POST(req: Request) {
  try {
    const supabaseAdmin = getSupabaseAdminClient();
    const body = (await req.json()) as Body;
    const guestId = typeof body.guest_id === "string" ? body.guest_id.trim() : "";
    const subtotal = Number(body.subtotal);
    const taxAmount = Number(body.tax_amount);
    const commissionAmount = Number(body.commission_amount);
    const totalAmount = Number(body.total_amount);

    if (!isValidGuestId(guestId)) {
      return NextResponse.json({ error: "Invalid or missing guest_id" }, { status: 400 });
    }

    if (
      !Number.isFinite(subtotal) ||
      !Number.isFinite(taxAmount) ||
      !Number.isFinite(commissionAmount) ||
      !Number.isFinite(totalAmount) ||
      totalAmount <= 0
    ) {
      return NextResponse.json({ error: "Invalid payment amounts" }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from("payments")
      .insert([
        {
          user_id: null,
          guest_id: guestId,
          subtotal,
          tax_amount: taxAmount,
          commission_amount: commissionAmount,
          total_amount: totalAmount,
          status: "pending",
          payment_type: "order",
        },
      ])
      .select("id")
      .single();

    if (error || !data?.id) {
      console.error("create-pending-payment insert failed:", error);
      return NextResponse.json(
        { error: error?.message || "Failed to create payment record" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, id: data.id });
  } catch (e) {
    console.error("create-pending-payment:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
