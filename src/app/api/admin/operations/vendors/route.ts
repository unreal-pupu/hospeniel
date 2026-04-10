import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase";
import { ensureAdminRequest } from "@/lib/admin/ensureAdminRequest";

export const dynamic = "force-dynamic";

const INACTIVITY_DAYS_LONG = 14;
const INACTIVITY_DAYS_SHORT = 7;
const MENU_CREATE_WINDOW_HOURS = 24;
const HIGH_MENU_CREATES_THRESHOLD = 15;
const CANCELLATION_WINDOW_DAYS = 30;
const CANCELLATION_RATE_MIN_ORDERS = 5;
const CANCELLATION_RATE_THRESHOLD = 0.4;

function isVendorOpen(isOpen: boolean | null | undefined): boolean {
  return isOpen !== false;
}

export async function GET(req: Request) {
  try {
    const auth = await ensureAdminRequest(req);
    if (!auth.ok) return auth.response;

    const { searchParams } = new URL(req.url);
    const availability = (searchParams.get("availability") || "all").toLowerCase();
    if (!["all", "open", "closed"].includes(availability)) {
      return NextResponse.json({ error: "Invalid availability filter." }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdminClient();

    const { data: vendorRows, error: vErr } = await supabaseAdmin
      .from("vendors")
      .select("profile_id, business_name, is_open, location, phone_number");

    if (vErr) {
      console.error("[operations/vendors] vendors:", vErr);
      return NextResponse.json({ error: "Failed to load vendors." }, { status: 500 });
    }

    const vendorByProfile = new Map<
      string,
      { business_name: string | null; is_open: boolean | null; location: string | null; phone_number: string | null }
    >();
    for (const row of vendorRows || []) {
      const pid = row.profile_id as string;
      vendorByProfile.set(pid, {
        business_name: row.business_name as string | null,
        is_open: row.is_open as boolean | null,
        location: row.location as string | null,
        phone_number: row.phone_number as string | null,
      });
    }

    const { data: profiles, error: pErr } = await supabaseAdmin
      .from("profiles")
      .select("id, name, email, approval_status, created_at, subscription_plan")
      .eq("role", "vendor")
      .order("created_at", { ascending: false });

    if (pErr) {
      console.error("[operations/vendors] profiles:", pErr);
      return NextResponse.json({ error: "Failed to load vendor profiles." }, { status: 500 });
    }

    const profileList = profiles || [];
    const vendorIds = profileList.map((p) => p.id as string);
    if (vendorIds.length === 0) {
      return NextResponse.json({ vendors: [], meta: { availability, count: 0 } });
    }

    const now = Date.now();
    const thirtyAgo = new Date(now - CANCELLATION_WINDOW_DAYS * 86400000).toISOString();
    const sevenAgo = new Date(now - INACTIVITY_DAYS_SHORT * 86400000).toISOString();
    const fourteenAgo = new Date(now - INACTIVITY_DAYS_LONG * 86400000).toISOString();
    const menuSince = new Date(now - MENU_CREATE_WINDOW_HOURS * 3600000).toISOString();

    const { data: orders30d, error: oErr } = await supabaseAdmin
      .from("orders")
      .select("vendor_id, created_at, status")
      .in("vendor_id", vendorIds)
      .gte("created_at", thirtyAgo);

    if (oErr) {
      console.error("[operations/vendors] orders:", oErr);
      return NextResponse.json({ error: "Failed to load order activity." }, { status: 500 });
    }

    const lastOrderAt = new Map<string, string>();
    const orders7d = new Map<string, number>();
    const orders14d = new Map<string, number>();
    const cancelled30d = new Map<string, number>();
    const total30d = new Map<string, number>();

    for (const row of orders30d || []) {
      const vid = row.vendor_id as string;
      const created = row.created_at as string;
      const st = String(row.status || "");

      const prev = lastOrderAt.get(vid);
      if (!prev || created > prev) lastOrderAt.set(vid, created);

      if (created >= sevenAgo) orders7d.set(vid, (orders7d.get(vid) || 0) + 1);
      if (created >= fourteenAgo) orders14d.set(vid, (orders14d.get(vid) || 0) + 1);

      total30d.set(vid, (total30d.get(vid) || 0) + 1);
      if (st.toLowerCase() === "cancelled") {
        cancelled30d.set(vid, (cancelled30d.get(vid) || 0) + 1);
      }
    }

    const { data: menuRecent, error: mErr } = await supabaseAdmin
      .from("menu_items")
      .select("vendor_id")
      .in("vendor_id", vendorIds)
      .gte("created_at", menuSince);

    if (mErr) {
      console.error("[operations/vendors] menu_items:", mErr);
      return NextResponse.json({ error: "Failed to load menu activity." }, { status: 500 });
    }

    const menuCreates24h = new Map<string, number>();
    for (const row of menuRecent || []) {
      const vid = row.vendor_id as string;
      menuCreates24h.set(vid, (menuCreates24h.get(vid) || 0) + 1);
    }

    const { data: menuTitles, error: mtErr } = await supabaseAdmin
      .from("menu_items")
      .select("vendor_id, title")
      .in("vendor_id", vendorIds);

    if (mtErr) {
      console.error("[operations/vendors] menu titles:", mtErr);
      return NextResponse.json({ error: "Failed to load menu listings." }, { status: 500 });
    }

    const titleBuckets = new Map<string, Map<string, number>>();
    for (const row of menuTitles || []) {
      const vid = row.vendor_id as string;
      const key = String(row.title || "")
        .trim()
        .toLowerCase();
      if (!key) continue;
      if (!titleBuckets.has(vid)) titleBuckets.set(vid, new Map());
      const m = titleBuckets.get(vid)!;
      m.set(key, (m.get(key) || 0) + 1);
    }

    const duplicateTitleVendors = new Set<string>();
    for (const [vid, counts] of titleBuckets) {
      for (const c of counts.values()) {
        if (c > 1) {
          duplicateTitleVendors.add(vid);
          break;
        }
      }
    }

    const vendors = profileList
      .map((p) => {
        const id = p.id as string;
        const v = vendorByProfile.get(id);
        const open = isVendorOpen(v?.is_open);

        const lastAt = lastOrderAt.get(id) || null;
        const n7 = orders7d.get(id) || 0;
        const n14 = orders14d.get(id) || 0;
        const tot = total30d.get(id) || 0;
        const canc = cancelled30d.get(id) || 0;
        const cancelRate = tot > 0 ? canc / tot : 0;
        const menuN = menuCreates24h.get(id) || 0;

        const highMenuChurn = menuN >= HIGH_MENU_CREATES_THRESHOLD;
        const highCancellation =
          tot >= CANCELLATION_RATE_MIN_ORDERS && cancelRate >= CANCELLATION_RATE_THRESHOLD;
        const duplicateMenus = duplicateTitleVendors.has(id);
        const noOrdersEver = !lastAt;
        const noRecentOrders = !lastAt || lastAt < fourteenAgo;
        const stale7d = !lastAt || lastAt < sevenAgo;

        const flags: string[] = [];
        if (noRecentOrders) flags.push("no_orders_14d");
        if (stale7d && !noOrdersEver) flags.push("quiet_7d");
        if (highMenuChurn) flags.push("high_menu_creation_24h");
        if (highCancellation) flags.push("high_cancellation_rate_30d");
        if (duplicateMenus) flags.push("duplicate_menu_titles");

        return {
          profile_id: id,
          name: (p.name as string) || null,
          email: (p.email as string) || null,
          business_name: v?.business_name ?? null,
          location: v?.location ?? null,
          phone_number: v?.phone_number ?? null,
          is_open: open,
          raw_is_open: v?.is_open ?? null,
          approval_status: p.approval_status as string | null,
          subscription_plan: p.subscription_plan as string | null,
          last_order_at: lastAt,
          orders_last_7d: n7,
          orders_last_14d: n14,
          orders_total_30d: tot,
          cancelled_orders_30d: canc,
          menu_items_created_24h: menuN,
          flags,
        };
      })
      .filter((row) => {
        if (availability === "open") return row.is_open;
        if (availability === "closed") return !row.is_open;
        return true;
      });

    return NextResponse.json({
      vendors,
      meta: {
        availability,
        count: vendors.length,
        thresholds: {
          inactivity_days_long: INACTIVITY_DAYS_LONG,
          inactivity_days_short: INACTIVITY_DAYS_SHORT,
          high_menu_creates_24h: HIGH_MENU_CREATES_THRESHOLD,
          cancellation_window_days: CANCELLATION_WINDOW_DAYS,
          cancellation_rate_min_orders: CANCELLATION_RATE_MIN_ORDERS,
          cancellation_rate: CANCELLATION_RATE_THRESHOLD,
        },
      },
    });
  } catch (e) {
    console.error("[operations/vendors]", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
