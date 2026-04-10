import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase";
import { ensureAdminRequest } from "@/lib/admin/ensureAdminRequest";
import { getLagosDayBounds } from "@/lib/admin/lagosDayBounds";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const auth = await ensureAdminRequest(req);
    if (!auth.ok) return auth.response;

    const supabaseAdmin = getSupabaseAdminClient();
    const bounds = getLagosDayBounds();

    const { data: riders, error: rErr } = await supabaseAdmin
      .from("profiles")
      .select("id, name, email, phone_number, rider_approval_status, is_available, created_at")
      .eq("role", "rider")
      .order("name", { ascending: true });

    if (rErr) {
      console.error("[operations/riders] profiles:", rErr);
      return NextResponse.json({ error: "Failed to load riders." }, { status: 500 });
    }

    const riderList = riders || [];
    if (riderList.length === 0) {
      return NextResponse.json({
        riders: [],
        meta: { reportDate: bounds.reportDate, timezone: "Africa/Lagos" },
      });
    }

    const riderIds = riderList.map((r) => r.id as string);

    const { data: assignedToday, error: aErr } = await supabaseAdmin
      .from("delivery_tasks")
      .select("id, rider_id")
      .in("rider_id", riderIds)
      .gte("assigned_at", bounds.startUtc)
      .lte("assigned_at", bounds.endUtc);

    if (aErr) {
      console.error("[operations/riders] assigned today:", aErr);
    }

    const { data: createdTodayWithRider, error: cErr } = await supabaseAdmin
      .from("delivery_tasks")
      .select("id, rider_id")
      .in("rider_id", riderIds)
      .is("assigned_at", null)
      .gte("created_at", bounds.startUtc)
      .lte("created_at", bounds.endUtc);

    if (cErr) {
      console.error("[operations/riders] created today:", cErr);
    }

    const perRiderTaskIds = new Map<string, Set<string>>();
    function noteTask(riderId: string, taskId: string) {
      if (!perRiderTaskIds.has(riderId)) perRiderTaskIds.set(riderId, new Set());
      perRiderTaskIds.get(riderId)!.add(taskId);
    }

    for (const t of assignedToday || []) noteTask(t.rider_id as string, t.id as string);
    for (const t of createdTodayWithRider || []) noteTask(t.rider_id as string, t.id as string);

    const countsToday = new Map<string, number>();
    for (const [rid, set] of perRiderTaskIds) countsToday.set(rid, set.size);

    const { data: activeTasks, error: tErr } = await supabaseAdmin
      .from("delivery_tasks")
      .select("rider_id, status, order_id, assigned_at")
      .in("rider_id", riderIds)
      .in("status", ["Assigned", "PickedUp"]);

    if (tErr) {
      console.error("[operations/riders] active tasks:", tErr);
    }

    const activeByRider = new Map<string, { status: string; order_id: string; count: number }>();
    for (const t of activeTasks || []) {
      const rid = t.rider_id as string;
      const cur = activeByRider.get(rid);
      const cnt = (cur?.count || 0) + 1;
      activeByRider.set(rid, {
        status:
          cnt > 1
            ? "Multiple deliveries"
            : (t.status as string) === "PickedUp"
              ? "Picked up (en route)"
              : "Assigned",
        order_id: cur?.order_id || (t.order_id as string),
        count: cnt,
      });
    }

    const payload = riderList.map((r) => {
      const id = r.id as string;
      const active = activeByRider.get(id);
      const approval = (r.rider_approval_status as string | null)?.toLowerCase() || "";
      const isActiveRider = approval === "approved" && (r.is_available === true || active !== undefined);

      return {
        id,
        name: (r.name as string) || null,
        email: (r.email as string) || null,
        phone_number: (r.phone_number as string) || null,
        rider_approval_status: r.rider_approval_status as string | null,
        is_available: r.is_available as boolean | null,
        assignments_today: countsToday.get(id) || 0,
        current_delivery: active
          ? {
              label: active.status,
              active_task_count: active.count,
              sample_order_id: active.order_id,
            }
          : null,
        operational_status: active
          ? "busy"
          : isActiveRider
            ? "available"
            : "inactive",
      };
    });

    return NextResponse.json({
      riders: payload,
      meta: {
        reportDate: bounds.reportDate,
        timezone: "Africa/Lagos",
      },
    });
  } catch (e) {
    console.error("[operations/riders]", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
