const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");

function read(relPath) {
  return fs.readFileSync(path.join(__dirname, "..", relPath), "utf8");
}

const triggerSql = read("supabase/migrations/20251105_create_payout_trigger.sql");
assert.ok(
  triggerSql.includes("group by vendor_id"),
  "Payout trigger must aggregate orders per vendor"
);
assert.ok(
  triggerSql.includes("on conflict (payment_id, vendor_id)"),
  "Payout trigger must upsert one payout per vendor per payment"
);
assert.ok(
  triggerSql.includes("sum(coalesce(food_subtotal, 0))"),
  "Payout trigger must compute payout from food_subtotal only"
);

const safetyMigration = read("supabase/migrations/20260428_vendor_payouts_multi_vendor_safety.sql");
assert.ok(
  safetyMigration.includes("idx_vendor_payouts_payment_vendor_unique"),
  "Unique index for payment/vendor payouts must exist"
);
assert.ok(
  safetyMigration.includes("status in ('pending', 'processing', 'paid', 'completed', 'failed')"),
  "Payout statuses must support processing lifecycle"
);

const initializeRoute = read("src/app/api/payment/initialize/route.ts");
assert.ok(
  initializeRoute.includes("is_multi_vendor: isMultiVendor"),
  "Payment metadata must include is_multi_vendor flag"
);
assert.ok(
  initializeRoute.includes("if (isSingleVendorSplit && vendorProfile?.subaccount_code)"),
  "Paystack split must remain enabled only for single-vendor checkout"
);

const verifyRoute = read("src/app/api/payment/verify/route.ts");
assert.ok(
  verifyRoute.includes("upsertVendorPayoutsForPayment"),
  "Payment verification must upsert vendor payouts internally"
);
assert.ok(
  verifyRoute.includes("onConflict: \"payment_id,vendor_id\""),
  "Internal payout upsert must prevent duplicates"
);

console.log("Multi-vendor payout tests passed.");
