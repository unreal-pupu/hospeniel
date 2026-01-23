import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase";

export async function GET(req: Request) {
  try {
    const supabase = getSupabaseAdminClient();
    const { searchParams } = new URL(req.url);
    const requestId = searchParams.get("request_id");
    const userId = searchParams.get("user_id");

    if (!requestId) {
      return NextResponse.json(
        { error: "request_id is required" },
        { status: 400 }
      );
    }

    if (!userId) {
      return NextResponse.json(
        { error: "user_id is required" },
        { status: 400 }
      );
    }

    // Verify user has access to this service request
    const { data: serviceRequest, error: requestError } = await supabase
      .from("service_requests")
      .select("id, user_id, vendor_id")
      .eq("id", requestId)
      .single();

    if (requestError || !serviceRequest) {
      return NextResponse.json(
        { error: "Service request not found", details: requestError?.message },
        { status: 404 }
      );
    }

    // Check if user is the customer or vendor for this request
    if (serviceRequest.user_id !== userId && serviceRequest.vendor_id !== userId) {
      return NextResponse.json(
        { error: "Unauthorized access to this service request" },
        { status: 403 }
      );
    }

    // Fetch replies for this service request
    const { data: replies, error: repliesError } = await supabase
      .from("service_request_replies")
      .select("*")
      .eq("service_request_id", requestId)
      .order("created_at", { ascending: true });

    if (repliesError) {
      console.error("Error fetching replies:", repliesError);
      return NextResponse.json(
        { error: "Failed to fetch replies", details: repliesError.message },
        { status: 500 }
      );
    }

    // Fetch sender profiles
    const senderIds = [...new Set((replies || []).map(r => r.sender_id).filter(Boolean))];
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, name, email")
      .in("id", senderIds);

    const profilesMap = new Map(profiles?.map(p => [p.id, p]) || []);

    // Combine replies with profiles
    const repliesWithProfiles = (replies || []).map(reply => ({
      ...reply,
      sender: profilesMap.get(reply.sender_id) || null
    }));

    return NextResponse.json({ replies: repliesWithProfiles });
  } catch (error) {
    console.error("Error in service request replies API:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(
      { error: "Internal server error", details: errorMessage },
      { status: 500 }
    );
  }
}
