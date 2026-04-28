import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase";
import { ensureAdminRequest } from "@/lib/admin/ensureAdminRequest";
import { PAYSTACK_VENDOR_SUBACCOUNT_PERCENTAGE_CHARGE } from "@/lib/platformPricing";
import { logPaystackAuthorizationDebug } from "@/lib/server/paystackRequestDebug";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const PAYSTACK_BASE = "https://api.paystack.co/subaccount";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface SyncBody {
  dry_run?: boolean;
  /** Pause between vendors (ms) to respect rate limits */
  delay_ms?: number;
  /** Retries per vendor after a failed Paystack call */
  max_retries?: number;
}

async function putPaystackPercentageCharge(
  secretKey: string,
  subaccountCode: string,
  percentageCharge: number
): Promise<{ ok: boolean; status: number; message: string; raw?: unknown }> {
  logPaystackAuthorizationDebug("admin/sync-subaccount-commission:put", secretKey);
  const url = `${PAYSTACK_BASE}/${encodeURIComponent(subaccountCode)}`;
  const res = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ percentage_charge: percentageCharge }),
  });

  const raw = (await res.json().catch(() => ({}))) as { status?: boolean; message?: string };
  const message =
    typeof raw.message === "string" ? raw.message : res.ok ? "ok" : `HTTP ${res.status}`;

  const ok = Boolean(res.ok && raw.status === true);
  return { ok, status: res.status, message, raw };
}

async function getPaystackSubaccount(secretKey: string, subaccountCode: string): Promise<{
  ok: boolean;
  percentage_charge?: number;
  message: string;
  raw?: unknown;
}> {
  logPaystackAuthorizationDebug("admin/sync-subaccount-commission:get", secretKey);
  const url = `${PAYSTACK_BASE}/${encodeURIComponent(subaccountCode)}`;
  const res = await fetch(url, {
    method: "GET",
    headers: { Authorization: `Bearer ${secretKey}` },
  });
  const raw = (await res.json().catch(() => ({}))) as {
    status?: boolean;
    message?: string;
    data?: { percentage_charge?: number };
  };
  const data = raw.data;
  const ok = Boolean(res.ok && raw.status === true);
  const message = typeof raw.message === "string" ? raw.message : res.ok ? "ok" : `HTTP ${res.status}`;
  return {
    ok,
    percentage_charge: typeof data?.percentage_charge === "number" ? data.percentage_charge : undefined,
    message,
    raw,
  };
}

/**
 * One-time / occasional admin job: set Paystack `percentage_charge` to the platform default (5%)
 * for every vendor profile that has a `subaccount_code`. Does not recreate subaccounts.
 *
 * POST /api/admin/sync-subaccount-commission
 * Body (optional JSON): { "dry_run": false, "delay_ms": 350, "max_retries": 3 }
 */
export async function POST(req: Request) {
  const auth = await ensureAdminRequest(req);
  if (!auth.ok) return auth.response;

  const secretKey = logPaystackAuthorizationDebug(
    "admin/sync-subaccount-commission:entry",
    process.env.PAYSTACK_SECRET_KEY
  );
  if (!secretKey || (!secretKey.startsWith("sk_test_") && !secretKey.startsWith("sk_live_"))) {
    return NextResponse.json(
      { error: "PAYSTACK_SECRET_KEY is not configured or invalid." },
      { status: 500 }
    );
  }

  let body: SyncBody = {};
  try {
    const text = await req.text();
    if (text?.trim()) body = JSON.parse(text) as SyncBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const dryRun = Boolean(body.dry_run);
  const delayMs = Math.min(Math.max(Number(body.delay_ms) || 350, 50), 5000);
  const maxRetries = Math.min(Math.max(Number(body.max_retries) || 3, 1), 8);
  const targetPct = PAYSTACK_VENDOR_SUBACCOUNT_PERCENTAGE_CHARGE;

  const supabaseAdmin = getSupabaseAdminClient();
  const { data: vendors, error: vErr } = await supabaseAdmin
    .from("profiles")
    .select("id, name, email, subaccount_code")
    .eq("role", "vendor")
    .not("subaccount_code", "is", null);

  if (vErr) {
    console.error("[sync-subaccount-commission] profiles:", vErr);
    return NextResponse.json({ error: "Failed to load vendor profiles." }, { status: 500 });
  }

  const rows = (vendors || [])
    .map((r) => {
      const row = r as { id: string; name?: string | null; email?: string | null; subaccount_code?: string | null };
      return {
        id: String(row.id),
        name: row.name ?? null,
        email: row.email ?? null,
        subaccount_code: String(row.subaccount_code ?? "").trim(),
      };
    })
    .filter((r) => r.subaccount_code.length > 0);

  const summary = {
    target_percentage_charge: targetPct,
    dry_run: dryRun,
    delay_ms: delayMs,
    max_retries: maxRetries,
    total_candidates: rows.length,
    updated: [] as { profile_id: string; subaccount_code: string; paystack_message: string }[],
    dry_run_preview: [] as { profile_id: string; subaccount_code: string }[],
    failed: [] as {
      profile_id: string;
      subaccount_code: string;
      attempts: number;
      last_message: string;
      last_status?: number;
    }[],
    verified_mismatch: [] as { profile_id: string; subaccount_code: string; percentage_charge: number }[],
  };

  for (const row of rows) {
    const code = row.subaccount_code;

    if (dryRun) {
      summary.dry_run_preview.push({
        profile_id: row.id,
        subaccount_code: code,
      });
      await sleep(delayMs);
      continue;
    }

    let last: { ok: boolean; status: number; message: string } = {
      ok: false,
      status: 0,
      message: "not attempted",
    };

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      last = await putPaystackPercentageCharge(secretKey, code, targetPct);
      if (last.ok) break;
      const backoff = Math.min(8000, 500 * 2 ** (attempt - 1));
      console.warn(
        `[sync-subaccount-commission] PUT failed attempt ${attempt}/${maxRetries} for ${code}:`,
        last.message,
        "status",
        last.status
      );
      if (attempt < maxRetries) await sleep(backoff);
    }

    if (last.ok) {
      await sleep(400);
      const verify = await getPaystackSubaccount(secretKey, code);
      if (verify.ok && typeof verify.percentage_charge === "number") {
        const diff = Math.abs(verify.percentage_charge - targetPct);
        if (diff > 0.001) {
          summary.verified_mismatch.push({
            profile_id: row.id,
            subaccount_code: code,
            percentage_charge: verify.percentage_charge,
          });
        }
      }
      summary.updated.push({
        profile_id: row.id,
        subaccount_code: code,
        paystack_message: last.message,
      });
    } else {
      summary.failed.push({
        profile_id: row.id,
        subaccount_code: code,
        attempts: maxRetries,
        last_message: last.message,
        last_status: last.status,
      });
    }

    await sleep(delayMs);
  }

  console.log("[sync-subaccount-commission] complete", {
    updated: summary.updated.length,
    dry_run_preview: summary.dry_run_preview.length,
    failed: summary.failed.length,
    verified_mismatch: summary.verified_mismatch.length,
    dry_run: dryRun,
  });

  const success = dryRun ? true : summary.failed.length === 0 && summary.verified_mismatch.length === 0;

  return NextResponse.json({
    success,
    summary,
    hint: dryRun
      ? "Re-run with { \"dry_run\": false } to apply Paystack updates."
      : "If any row failed, fix Paystack errors and re-run; already-correct subaccounts are safe to PUT again.",
  });
}
