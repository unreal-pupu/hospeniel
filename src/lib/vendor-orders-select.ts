/**
 * Vendor-facing orders list selects. Production DB may lag migrations:
 * `food_subtotal` was added in migration 20260428_add_food_subtotal_to_orders.sql.
 * When the column is missing, PostgREST rejects the entire query — retry without it.
 */

export const VENDOR_ORDERS_LIST_SELECT_WITH_FOOD_SUBTOTAL = `
          id,
          vendor_id,
          user_id,
          product_id,
          quantity,
          total_price,
          food_subtotal,
          status,
          created_at,
          updated_at,
          delivery_address,
          delivery_address_line_1,
          delivery_city,
          delivery_state,
          delivery_zone,
          delivery_postal_code,
          delivery_phone,
          delivery_phone_number,
          delivery_charge,
          special_instructions,
          payment_reference,
          guest_id,
          customer_name,
          customer_phone,
          menu_items (
            id,
            title,
            image_url,
            price
          )
        `;

/** Same as above but omits `food_subtotal` for databases that have not applied 20260428 yet. */
export const VENDOR_ORDERS_LIST_SELECT_LEGACY = `
          id,
          vendor_id,
          user_id,
          product_id,
          quantity,
          total_price,
          status,
          created_at,
          updated_at,
          delivery_address,
          delivery_address_line_1,
          delivery_city,
          delivery_state,
          delivery_zone,
          delivery_postal_code,
          delivery_phone,
          delivery_phone_number,
          delivery_charge,
          special_instructions,
          payment_reference,
          guest_id,
          customer_name,
          customer_phone,
          menu_items (
            id,
            title,
            image_url,
            price
          )
        `;

export const VENDOR_DASHBOARD_ORDERS_SELECT_WITH_FOOD_SUBTOTAL =
  "id, total_price, food_subtotal, status, created_at, payment_reference";

export const VENDOR_DASHBOARD_ORDERS_SELECT_LEGACY =
  "id, total_price, status, created_at, payment_reference";

export function isMissingFoodSubtotalColumnError(err: {
  message?: string;
  code?: string;
  details?: string;
} | null): boolean {
  if (!err?.message) return false;
  const m = err.message.toLowerCase();
  return (
    m.includes("food_subtotal") &&
    (m.includes("does not exist") ||
      m.includes("schema cache") ||
      m.includes("could not find"))
  );
}
