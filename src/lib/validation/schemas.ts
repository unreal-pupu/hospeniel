import { z } from "zod";
import { sanitizePlainText, stripControlChars } from "./sanitize";

export const profileIdQuerySchema = z.string().uuid("Invalid profile identifier.");

const emailField = z
  .string()
  .max(320)
  .transform((s) => stripControlChars(s).trim().toLowerCase())
  .pipe(z.string().email("Enter a valid email address."));

export const loginCredentialsSchema = z
  .object({
    email: emailField,
    password: z.string().min(1, "Password is required.").max(128, "Password is too long."),
  })
  .strict();

/** Registration body — matches fields POSTed from the register page; unknown keys rejected. */
export const registerRequestSchema = z
  .object({
    email: emailField,
    password: z.string().min(1, "Password is required.").max(128, "Password is too long."),
    name: z
      .string()
      .max(200)
      .transform((s) => sanitizePlainText(stripControlChars(s), 200))
      .pipe(z.string().min(1, "Name is required.")),
    role: z.enum(["user", "vendor", "rider"], {
      errorMap: () => ({ message: "Please choose a valid account type." }),
    }),
    address: z
      .string()
      .max(4000)
      .default("")
      .transform((s) => sanitizePlainText(stripControlChars(s), 4000)),
    location: z
      .string()
      .max(200)
      .nullable()
      .optional()
      .transform((s) =>
        s == null || s === "" ? null : sanitizePlainText(stripControlChars(String(s)), 200)
      ),
    category: z
      .string()
      .max(100)
      .nullable()
      .optional()
      .transform((s) =>
        s == null || s === "" ? null : sanitizePlainText(stripControlChars(String(s)), 100)
      ),
    business_name: z
      .string()
      .max(200)
      .nullable()
      .optional()
      .transform((s) =>
        s == null || s === "" ? null : sanitizePlainText(stripControlChars(String(s)), 200)
      ),
    phone_number: z
      .string()
      .max(32)
      .nullable()
      .optional()
      .transform((s) => {
        if (s == null || s === "") return null;
        const cleaned = stripControlChars(String(s)).trim().replace(/[^\d+\s()-]/g, "").slice(0, 32);
        return cleaned.length === 0 ? null : cleaned;
      }),
    bank_code: z
      .string()
      .max(24)
      .nullable()
      .optional()
      .transform((s) => (s == null || s === "" ? null : stripControlChars(String(s)).trim().slice(0, 24))),
    account_number: z
      .string()
      .max(20)
      .nullable()
      .optional()
      .transform((s) =>
        s == null || s === "" ? null : stripControlChars(String(s)).trim().replace(/\D/g, "").slice(0, 20)
      ),
  })
  .strict();

// Unknown keys on line items are stripped (cart payloads vary by client/version).
const cartItemSchema = z.object({
  id: z.string().min(1).max(64),
  product_id: z.string().max(64).optional(),
  vendor_id: z.string().max(64).optional(),
  quantity: z.coerce.number().int("Quantity must be a whole number.").min(1).max(999),
  price: z.coerce.number().finite("Price must be a valid number.").min(0).max(1e10),
  vendors: z.object({ id: z.string().max(64) }).optional(),
  menu_items: z.unknown().optional(),
});

export const legacyOrdersRequestSchema = z
  .object({
    name: z
      .string()
      .max(200)
      .transform((s) => sanitizePlainText(stripControlChars(s), 200))
      .pipe(z.string().min(1, "Name is required.")),
    email: emailField,
    phone: z
      .string()
      .max(32)
      .transform((s) => stripControlChars(s).trim().replace(/[^\d+\s()-]/g, "").slice(0, 32))
      .pipe(z.string().min(5, "Enter a valid phone number.")),
    address: z
      .string()
      .max(4000)
      .transform((s) => sanitizePlainText(stripControlChars(s), 4000))
      .pipe(z.string().min(1, "Address is required.")),
    paymentMethod: z
      .string()
      .max(80)
      .transform((s) => stripControlChars(s).trim())
      .pipe(z.string().min(1, "Payment method is required.")),
    cartItems: z.array(cartItemSchema).min(1, "Your cart is empty."),
    createdAt: z.string().max(64).optional(),
  })
  .strict();

export const paymentInitializeSchema = z
  .object({
    email: emailField,
    amount: z.coerce.number().finite().positive("Amount must be greater than zero.").max(5e8),
    food_amount: z.coerce.number().finite().min(0).max(5e8).optional(),
    delivery_fee: z.coerce.number().finite().min(0).max(5e8).optional(),
    vat_amount: z.coerce.number().finite().min(0).max(5e8).optional(),
    service_charge: z.coerce.number().finite().min(0).max(5e8).optional(),
    vendor_id: z.string().uuid("Invalid vendor."),
    order_id: z.string().max(64).optional(),
    payment_id: z.string().max(64).optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
    pending_orders: z.unknown().optional(),
    delivery_details: z.unknown().optional(),
  })
  .strict();

export const paymentVerifySchema = z
  .object({
    reference: z
      .string()
      .min(1, "Payment reference is required.")
      .max(220)
      .transform((s) => stripControlChars(s).trim()),
    pending_orders: z.unknown().optional(),
    delivery_details: z.unknown().optional(),
    service_request_id: z.union([z.string().max(128), z.null()]).optional(),
  })
  .strict();

export const createPendingPaymentSchema = z
  .object({
    guest_id: z.string().uuid("Invalid guest session. Please refresh and try again."),
    subtotal: z.coerce.number().finite().min(0).max(5e8),
    tax_amount: z.coerce.number().finite().min(0).max(5e8),
    commission_amount: z.coerce.number().finite().min(0).max(5e8),
    total_amount: z.coerce.number().finite().positive("Total must be greater than zero.").max(5e8),
  })
  .strict();

export const deliveryCalculateSchema = z
  .object({
    delivery_address: z.string().max(500).optional(),
    delivery_city: z.string().max(200).optional(),
    delivery_state: z
      .string()
      .min(1, "State is required.")
      .max(120)
      .transform((s) => sanitizePlainText(stripControlChars(s), 120)),
    delivery_postal_code: z.string().max(32).optional(),
    vendor_location: z.string().max(200).optional(),
    vendor_city: z.string().max(200).optional(),
    vendor_state: z.string().max(120).optional(),
    order_total: z.coerce.number().finite().min(0).optional(),
    item_count: z.coerce.number().int().min(1).max(10_000).optional(),
  })
  .strict();

export const vendorRatingSubmitSchema = z
  .object({
    vendor_id: z
      .string()
      .min(1, "Vendor is required.")
      .max(64)
      .transform((s) => stripControlChars(s).trim()),
    rating: z.coerce.number().int().min(1).max(5, "Rating must be between 1 and 5."),
    review: z
      .union([z.string().max(4000), z.null(), z.undefined()])
      .transform((v) => {
        if (v == null || v === undefined) return null;
        const t = sanitizePlainText(stripControlChars(String(v)), 4000);
        return t.length === 0 ? null : t;
      }),
  })
  .strict();

export const subscriptionUpdateSchema = z
  .object({
    userId: z.string().uuid("Invalid account."),
    subscriptionPlan: z.enum(["free_trial", "starter", "professional"], {
      errorMap: () => ({ message: "Please choose a valid plan." }),
    }),
    paymentReference: z.string().max(220).optional(),
  })
  .strict();

/** Vendor menu item (client-side save) — titles/descriptions only; prices bounded. */
export const menuItemFormSchema = z.object({
  title: z
    .string()
    .max(200)
    .transform((s) => sanitizePlainText(stripControlChars(s), 200))
    .pipe(z.string().min(1, "Please enter a product title.")),
  description: z
    .union([z.string(), z.undefined()])
    .optional()
    .transform((s) => sanitizePlainText(stripControlChars(s ?? ""), 5000)),
  price: z
    .union([
      z.string().min(1, "Enter a valid price."),
      z.number().finite().positive(),
    ])
    .transform((v) => (typeof v === "number" ? String(v) : stripControlChars(v).trim()))
    .pipe(
      z
        .string()
        .refine((s) => /^\d+(\.\d{1,2})?$/.test(s), "Enter a valid price.")
        .transform((s) => parseFloat(s))
        .pipe(z.number().positive("Price must be greater than zero.").max(1e8))
    ),
});

/** Vendor settings: email + text fields for pre-save checks (mirrors critical fields). */
export const vendorSettingsCoreSchema = z.object({
  business_name: z
    .string()
    .max(200)
    .transform((s) => sanitizePlainText(stripControlChars(s), 200))
    .pipe(z.string().min(1, "Business name is required.")),
  email: emailField,
  phone_number: z
    .string()
    .max(32)
    .transform((s) => stripControlChars(s).trim().replace(/[^\d+\s()-]/g, "").slice(0, 32)),
  location: z.string().max(200).optional(),
  category: z.string().max(100).optional(),
  description: z
    .string()
    .max(8000)
    .optional()
    .transform((s) => (s ? sanitizePlainText(stripControlChars(s), 8000) : "")),
  address: z
    .string()
    .max(4000)
    .optional()
    .transform((s) => (s ? sanitizePlainText(stripControlChars(s), 4000) : "")),
});

/** Explore / UI search or filter query strings */
export const exploreSearchTokenSchema = z
  .string()
  .max(200)
  .transform((s) => sanitizePlainText(stripControlChars(s), 200));
