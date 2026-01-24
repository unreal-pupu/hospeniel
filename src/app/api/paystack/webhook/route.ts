import { NextResponse } from "next/server";
import crypto from "crypto";
import { POST as verifyPayment } from "@/app/api/payment/verify/route";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret) {
    console.error("PAYSTACK_SECRET_KEY is not set for webhook verification");
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  }

  const signature = req.headers.get("x-paystack-signature");
  const rawBody = await req.text();

  if (!signature) {
    console.warn("Missing Paystack signature header");
    return NextResponse.json({ error: "Missing signature" }, { status: 401 });
  }

  const computedSignature = crypto
    .createHmac("sha512", secret.trim())
    .update(rawBody)
    .digest("hex");

  if (computedSignature !== signature) {
    console.error("Invalid Paystack signature");
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: {
    event?: string;
    data?: {
      reference?: string;
      metadata?: {
        service_request_id?: string;
      };
    };
  };
  try {
    payload = JSON.parse(rawBody);
  } catch (parseError) {
    console.error("Invalid Paystack webhook payload:", parseError);
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const event = payload?.event;
  const data = payload?.data;

  if (event !== "charge.success" || !data?.reference) {
    return NextResponse.json({ received: true });
  }

  const reference = data.reference as string;
  const serviceRequestId =
    typeof data?.metadata?.service_request_id === "string"
      ? data.metadata.service_request_id
      : undefined;

  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "https://www.hospeniel.com";
  const verifyRequest = new Request(`${baseUrl}/api/paystack/verify`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      reference,
      service_request_id: serviceRequestId,
    }),
  });

  return verifyPayment(verifyRequest);
}
