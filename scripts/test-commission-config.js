const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");

const pricingPath = path.join(__dirname, "..", "src", "lib", "platformPricing.ts");
const source = fs.readFileSync(pricingPath, "utf8");

function extractNumber(name) {
  const regex = new RegExp(`export const ${name} = ([0-9.]+);`);
  const match = source.match(regex);
  assert.ok(match, `Expected ${name} constant to be defined`);
  return Number(match[1]);
}

const commissionRate = extractNumber("PLATFORM_FOOD_COMMISSION_RATE");
const subaccountCharge = extractNumber("PAYSTACK_VENDOR_SUBACCOUNT_PERCENTAGE_CHARGE");

assert.equal(commissionRate, 0.05, "Platform commission rate must be 0.05 (5%)");
assert.equal(subaccountCharge, 5, "Paystack percentage charge must be 5%");

assert.ok(
  source.includes("export function toCurrencyAmount"),
  "Expected toCurrencyAmount helper to exist"
);
assert.ok(
  source.includes("export function calculatePlatformFoodCommission"),
  "Expected calculatePlatformFoodCommission helper to exist"
);
assert.ok(
  source.includes("export function calculateVendorFoodPayout"),
  "Expected calculateVendorFoodPayout helper to exist"
);

console.log("Commission configuration tests passed.");
