const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");

function read(relPath) {
  return fs.readFileSync(path.join(__dirname, "..", relPath), "utf8");
}

const pricing = read("src/lib/platformPricing.ts");
assert.ok(pricing.includes("PLATFORM_FOOD_COMMISSION_RATE = 0.05"), "Commission must be 5%");
assert.ok(pricing.includes("VENDOR_FOOD_PAYOUT_RATE = 1 - PLATFORM_FOOD_COMMISSION_RATE"), "Vendor payout rate constant missing");

const payoutTrigger = read("supabase/migrations/20251105_create_payout_trigger.sql");
assert.ok(
  payoutTrigger.includes("sum(coalesce(food_subtotal, 0))"),
  "Vendor payout trigger must use food_subtotal only"
);
assert.ok(
  payoutTrigger.includes("if vendor_payout_amount <= 0 then"),
  "Vendor payout trigger should skip non-food payouts"
);

const initializeRoute = read("src/app/api/payment/initialize/route.ts");
assert.ok(
  initializeRoute.includes("const isSingleVendorSplit = !isMultiVendor;"),
  "Paystack split mode must detect multi-vendor orders"
);
assert.ok(
  initializeRoute.includes("if (isSingleVendorSplit && vendorProfile?.subaccount_code) {"),
  "Paystack split should only run for single-vendor checkouts"
);

const verifyRoute = read("src/app/api/payment/verify/route.ts");
assert.ok(
  verifyRoute.includes("food_subtotal: orderTotalPrice"),
  "Created food orders must persist food_subtotal"
);
assert.ok(
  verifyRoute.includes("food_subtotal: 0"),
  "Non-food service orders must have zero food_subtotal"
);

console.log("Financial separation tests passed.");
