/**
 * Central platform pricing for food orders (Paystack split + UI + payout math).
 * Update values here only; import across payment, vendor UI, and admin estimates.
 */

/** Commission on food subtotal only (delivery / VAT / service fee routing unchanged elsewhere). */
export const PLATFORM_FOOD_COMMISSION_RATE = 0.05;

/** Vendor payout share from food subtotal after platform commission. */
export const VENDOR_FOOD_PAYOUT_RATE = 1 - PLATFORM_FOOD_COMMISSION_RATE;

/** Flat platform service charge (NGN) on checkout when subtotal > 0. */
export const PLATFORM_SERVICE_CHARGE_NGN = 250;

/**
 * Paystack subaccount `percentage_charge`: platform share of split (vendor receives the rest).
 * @see https://paystack.com/docs/payments/split-payments
 */
export const PAYSTACK_VENDOR_SUBACCOUNT_PERCENTAGE_CHARGE = 5;

/** Commission display label for UI copy and summaries. */
export const PLATFORM_COMMISSION_PERCENT_LABEL = `${Math.round(PLATFORM_FOOD_COMMISSION_RATE * 100)}%`;

/** Vendor payout display label for UI copy and summaries. */
export const VENDOR_PAYOUT_PERCENT_LABEL = `${Math.round(VENDOR_FOOD_PAYOUT_RATE * 100)}%`;

/** Round monetary values to 2 decimals and guard against negatives/NaN. */
export function toCurrencyAmount(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function calculatePlatformFoodCommission(orderTotal: number): number {
  return toCurrencyAmount(Math.max(orderTotal, 0) * PLATFORM_FOOD_COMMISSION_RATE);
}

export function calculateVendorFoodPayout(orderTotal: number): number {
  return toCurrencyAmount(Math.max(orderTotal, 0) * VENDOR_FOOD_PAYOUT_RATE);
}
