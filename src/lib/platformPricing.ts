/**
 * Central platform pricing for food orders (Paystack split + UI + payout math).
 * Update values here only; import across payment, vendor UI, and admin estimates.
 */

/** Commission on food subtotal only (delivery / VAT / service fee routing unchanged elsewhere). */
export const PLATFORM_FOOD_COMMISSION_RATE = 0.02;

/** Flat platform service charge (NGN) on checkout when subtotal > 0. */
export const PLATFORM_SERVICE_CHARGE_NGN = 250;

/**
 * Paystack subaccount `percentage_charge`: platform share of split (vendor receives the rest).
 * @see https://paystack.com/docs/payments/split-payments
 */
export const PAYSTACK_VENDOR_SUBACCOUNT_PERCENTAGE_CHARGE = 2;
