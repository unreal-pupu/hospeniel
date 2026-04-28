import { NextResponse } from "next/server";
import { processPremiumToolPayment } from "@/lib/vendor-feature-entitlements";
import { ensureAuthenticatedRequest } from "@/lib/api/ensureAuthenticatedRequest";
import { logPaystackAuthorizationDebug } from "@/lib/server/paystackRequestDebug";

const paystackSecretKey = process.env.PAYSTACK_SECRET_KEY;

interface PaystackVerifyData {
  status?: boolean;
  data?: {
    status?: string;
    amount?: number;
    reference?: string;
    paid_at?: string;
    metadata?: Record<string, unknown>;
  };
  message?: string;
}

export async function POST(req: Request) {
  try {
    const authCheck = await ensureAuthenticatedRequest(req);
    if (!authCheck.ok) return authCheck.response;

    const trimmedPaystackKey = logPaystackAuthorizationDebug(
      "vendor-tools/activate:verify-request",
      paystackSecretKey
    );
    if (!trimmedPaystackKey) {
      console.error("vendor-tools/activate: PAYSTACK_SECRET_KEY missing");
      return NextResponse.json(
        { success: false, error: "Payment verification is not configured" },
        { status: 500 }
      );
    }

    const body = await req.json();
    const { userId: bodyUserId, paymentReference } = body as {
      userId?: string;
      paymentReference?: string;
    };
    const userId =
      authCheck.context.isAdmin && bodyUserId ? bodyUserId : authCheck.context.userId;

    console.log("[vendor-tools/activate] request", { userId, paymentReference: paymentReference?.slice(0, 30) });

    if (!userId || !paymentReference) {
      return NextResponse.json(
        { success: false, error: "userId and paymentReference are required" },
        { status: 400 }
      );
    }

    const verifyResponse = await fetch(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(paymentReference)}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${trimmedPaystackKey}`,
          "Content-Type": "application/json",
        },
      }
    );

    const verifyJson = (await verifyResponse.json()) as PaystackVerifyData;

    if (
      !verifyResponse.ok ||
      !verifyJson.status ||
      verifyJson.data?.status !== "success"
    ) {
      return NextResponse.json(
        {
          success: false,
          error: verifyJson.message || "Payment verification failed",
        },
        { status: 400 }
      );
    }

    const tx = verifyJson.data;
    const metadata = tx?.metadata ?? {};
    if (String(metadata.vendor_id) !== String(userId)) {
      return NextResponse.json(
        { success: false, error: "Payment does not match this account" },
        { status: 403 }
      );
    }

    const result = await processPremiumToolPayment({
      reference: paymentReference,
      transactionData: { ...tx, metadata: tx?.metadata ?? {} },
    });

    if (!result.ok) {
      const details = "details" in result ? result.details : undefined;
      const pgCode = details && typeof details === "object" && "code" in details ? String((details as { code?: string }).code) : "";
      console.error("[vendor-tools/activate] processing failed", { reference: paymentReference, reason: result.reason, details });
      const dbPermissionHint =
        result.reason === "vendor_purchased_tools_failed" && pgCode === "42501"
          ? "Database permission denied: apply migration 20260320_grant_vendor_premium_tools_service_role.sql (GRANT to service_role)."
          : null;
      return NextResponse.json(
        {
          success: false,
          error:
            result.reason === "entitlement_upsert_failed"
              ? "Failed to record premium tool purchase (entitlement write failed)"
              : dbPermissionHint || `Activation failed: ${result.reason}`,
        },
        { status: 500 }
      );
    }

    console.log("[vendor-tools/activate] success", { reference: paymentReference, alreadyProcessed: result.alreadyProcessed });
    return NextResponse.json({
      success: true,
      alreadyActivated: result.alreadyProcessed || false,
      data: result,
    });
  } catch (err) {
    console.error("[vendor-tools/activate] error", err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}
