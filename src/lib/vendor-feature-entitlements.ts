import { getSupabaseAdminClient } from "@/lib/supabase";
import {
  computeToolExpiryDate,
  getExpectedToolPriceKobo,
  type VendorToolBilling,
} from "@/lib/vendor-premium-tools-catalog";

interface PaystackTransactionData {
  reference?: string;
  amount?: number;
  paid_at?: string;
  status?: string;
  metadata?: Record<string, unknown>;
}

const TOOL_TO_FEATURE: Record<string, string> = {
  "Featured Placement": "featured_placement",
  "Priority Location Boost": "priority_location_boost",
  "Sponsored Banners": "sponsored_banners",
  "Brand Promotion": "brand_promotion",
  "Marketing Tools": "marketing_tools",
  "Analytical Marketing": "analytical_marketing",
};

export function resolveFeatureNameFromTool(toolName: string): string | null {
  return TOOL_TO_FEATURE[toolName] ?? null;
}

export async function syncVendorEntitlementsFromPurchasedTools(vendorId: string) {
  const supabaseAdmin = getSupabaseAdminClient();

  const { data: purchasedTools, error } = await supabaseAdmin
    .from("vendor_purchased_tools")
    .select("tool_name, status, expiry_date")
    .eq("vendor_id", vendorId);

  if (error) {
    console.warn("[entitlements] syncVendorEntitlementsFromPurchasedTools: fetch failed", {
      vendorId,
      message: error.message,
      code: error.code,
    });
    return { ok: false as const };
  }

  const now = Date.now();
  for (const t of purchasedTools || []) {
    const featureName = resolveFeatureNameFromTool(t.tool_name);
    if (!featureName) continue;

    const expiresAt = t.expiry_date ? new Date(t.expiry_date) : null;
    const expiresIso = expiresAt ? expiresAt.toISOString() : null;
    const active = expiresAt ? expiresAt.getTime() > now : t.status === "active";

    try {
      const featureId = await ensureFeatureId(featureName);
      await supabaseAdmin.from("vendor_entitlements").upsert(
        {
          vendor_id: vendorId,
          feature_id: featureId,
          status: active ? "active" : "inactive",
          expires_at: expiresIso,
        },
        { onConflict: "vendor_id,feature_id" }
      );
    } catch (syncErr) {
      console.warn("[entitlements] syncVendorEntitlementsFromPurchasedTools: upsert failed", {
        vendorId,
        toolName: t.tool_name,
        featureName,
        message: syncErr instanceof Error ? syncErr.message : String(syncErr),
      });
    }
  }

  return { ok: true as const };
}

export async function hasFeature(vendorId: string, featureName: string): Promise<boolean> {
  const supabaseAdmin = getSupabaseAdminClient();
  const { data: feature } = await supabaseAdmin
    .from("features")
    .select("id")
    .eq("name", featureName)
    .maybeSingle();
  if (!feature?.id) return false;

  const nowIso = new Date().toISOString();
  const { data } = await supabaseAdmin
    .from("vendor_entitlements")
    .select("id")
    .eq("vendor_id", vendorId)
    .eq("feature_id", feature.id)
    .eq("status", "active")
    .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
    .maybeSingle();

  return !!data;
}

async function ensureFeatureId(featureName: string): Promise<string> {
  const supabaseAdmin = getSupabaseAdminClient();
  const { data: existing } = await supabaseAdmin
    .from("features")
    .select("id")
    .eq("name", featureName)
    .maybeSingle();
  if (existing?.id) return existing.id;

  const { data, error } = await supabaseAdmin
    .from("features")
    .insert({ name: featureName, description: featureName.replace(/_/g, " ") })
    .select("id")
    .single();
  if (error || !data?.id) throw new Error(`Unable to create feature: ${featureName}`);
  return data.id;
}

interface ProcessPremiumToolPaymentArgs {
  reference: string;
  transactionData: PaystackTransactionData;
}

function getMetadataString(metadata: Record<string, unknown>, key: string): string | null {
  const v = metadata[key];
  if (typeof v === "string") return v;
  if (v != null && typeof v === "object" && "value" in (v as object))
    return String((v as { value: unknown }).value);
  return null;
}

function getMetadataBilling(metadata: Record<string, unknown>): VendorToolBilling {
  const v = metadata.billing;
  return v === "yearly" ? "yearly" : "monthly";
}

export async function processPremiumToolPayment({
  reference,
  transactionData,
}: ProcessPremiumToolPaymentArgs) {
  const rawMeta = transactionData.metadata ?? {};
  const metadata = typeof rawMeta === "object" && rawMeta !== null ? (rawMeta as Record<string, unknown>) : {};
  const vendorId = getMetadataString(metadata, "vendor_id") ?? (typeof metadata.vendor_id === "string" ? metadata.vendor_id : null);
  const toolName = getMetadataString(metadata, "tool_name") ?? (typeof metadata.tool_name === "string" ? metadata.tool_name : null);
  const billing = getMetadataBilling(metadata);
  const purchaseType = metadata.purchase_type;
  if (purchaseType !== "vendor_premium_tool") {
    console.warn("[entitlements] processPremiumToolPayment: not a vendor tool payment", { reference, purchaseType });
    return { ok: false as const, reason: "not_vendor_tool_payment" };
  }

  if (!vendorId || !toolName) {
    console.warn("[entitlements] processPremiumToolPayment: missing metadata", { reference, vendorId: !!vendorId, toolName: !!toolName, metadataKeys: Object.keys(metadata) });
    return { ok: false as const, reason: "missing_vendor_or_tool_metadata" };
  }

  const expectedAmount = getExpectedToolPriceKobo(toolName, billing);
  const paidAmount = Number(transactionData.amount ?? 0);
  if (expectedAmount === null || paidAmount <= 0) {
    console.warn("[entitlements] processPremiumToolPayment: invalid amount", { reference, expectedAmount, paidAmount });
    return { ok: false as const, reason: "invalid_amount" };
  }
  if (Math.abs(expectedAmount - paidAmount) > 1) {
    console.warn("[entitlements] processPremiumToolPayment: amount mismatch", { reference, expectedAmount, paidAmount });
    return { ok: false as const, reason: "amount_mismatch" };
  }

  const paidAt = transactionData.paid_at ? new Date(transactionData.paid_at) : new Date();
  const expiresAt = computeToolExpiryDate(paidAt, billing);
  const activeStatus = expiresAt.getTime() > Date.now() ? "active" : "inactive";
  const toolStatus = activeStatus === "active" ? "active" : "expired";
  const supabaseAdmin = getSupabaseAdminClient();

  const { data: existingTool } = await supabaseAdmin
    .from("vendor_purchased_tools")
    .select("id, vendor_id")
    .eq("payment_reference", reference)
    .maybeSingle();

  if (existingTool) {
    if (String(existingTool.vendor_id) !== String(vendorId)) {
      console.warn("[entitlements] processPremiumToolPayment: reference already used by another vendor", { reference });
      return { ok: false as const, reason: "reference_mismatch" };
    }
    console.log("[entitlements] processPremiumToolPayment: already recorded (idempotent)", { reference, vendorId, toolName });
    return { ok: true as const, alreadyProcessed: true, vendorId, toolName, expiresAt: expiresAt.toISOString() };
  }

  const toolRow = {
    vendor_id: vendorId,
    tool_name: toolName,
    status: toolStatus,
    purchase_date: paidAt.toISOString(),
    expiry_date: expiresAt.toISOString(),
    payment_reference: reference,
  };

  const { error: toolInsertError } = await supabaseAdmin
    .from("vendor_purchased_tools")
    .upsert(toolRow, { onConflict: "payment_reference" });

  if (toolInsertError) {
    const hint =
      toolInsertError.code === "42501"
        ? "DB missing GRANT for service_role on vendor_purchased_tools — run migration 20260320_grant_vendor_premium_tools_service_role.sql (or grant INSERT/UPDATE to service_role)."
        : undefined;
    console.error("[entitlements] processPremiumToolPayment: vendor_purchased_tools write failed", {
      reference,
      vendorId,
      toolName,
      error: toolInsertError.message,
      code: toolInsertError.code,
      hint,
    });
    return { ok: false as const, reason: "vendor_purchased_tools_failed", details: toolInsertError };
  }

  console.log("[entitlements] processPremiumToolPayment: vendor_purchased_tools written", { reference, vendorId, toolName, status: toolStatus, expiresAt: expiresAt.toISOString() });

  try {
    const paymentPayload = {
      user_id: vendorId,
      vendor_id: vendorId,
      total_amount: paidAmount / 100,
      amount: paidAmount / 100,
      status: "success",
      payment_reference: reference,
      payment_type: "vendor_premium_tool",
      payment_metadata: metadata,
      processed_at: new Date().toISOString(),
    };
    const { data: paymentRow } = await supabaseAdmin
      .from("payments")
      .select("id, status")
      .eq("payment_reference", reference)
      .maybeSingle();

    if (paymentRow?.id) {
      await supabaseAdmin.from("payments").update(paymentPayload).eq("id", paymentRow.id);
    } else {
      await supabaseAdmin.from("payments").insert(paymentPayload);
    }
  } catch (payErr) {
    console.warn("[entitlements] processPremiumToolPayment: payments update non-fatal", { reference, message: payErr instanceof Error ? payErr.message : String(payErr) });
  }

  const featureName = resolveFeatureNameFromTool(toolName);
  if (featureName) {
    try {
      const featureId = await ensureFeatureId(featureName);
      await supabaseAdmin
        .from("vendor_entitlements")
        .upsert(
          {
            vendor_id: vendorId,
            feature_id: featureId,
            status: activeStatus,
            expires_at: expiresAt.toISOString(),
          },
          { onConflict: "vendor_id,feature_id" }
        );
    } catch (entErr) {
      console.warn("[entitlements] processPremiumToolPayment: vendor_entitlements non-fatal", { reference, message: entErr instanceof Error ? entErr.message : String(entErr) });
    }
  }

  return {
    ok: true as const,
    alreadyProcessed: false,
    vendorId,
    toolName,
    featureName: featureName ?? undefined,
    expiresAt: expiresAt.toISOString(),
  };
}
