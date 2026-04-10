import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase";
import { parseJsonBody } from "@/lib/validation/http";
import { createPendingPaymentSchema } from "@/lib/validation/schemas";

export async function POST(req: Request) {
  try {
    const supabaseAdmin = getSupabaseAdminClient();
    const parsed = await parseJsonBody(req, createPendingPaymentSchema, "POST /api/payment/create-pending-payment");
    if (!parsed.ok) return parsed.response;

    const { guest_id: guestId, subtotal, tax_amount: taxAmount, commission_amount: commissionAmount, total_amount: totalAmount } =
      parsed.data;

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
