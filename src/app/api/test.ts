import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  try {
    const supabaseAdmin = getSupabaseAdminClient();
    const { name, address, contact, password, role } = await req.json();

    if (!name || !contact || !password || !role) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Create the user with Supabase Auth
    let authResult;
    if (contact.includes("@")) {
      authResult = await supabaseAdmin.auth.admin.createUser({
        email: contact,
        password,
      });
    } else {
      authResult = await supabaseAdmin.auth.admin.createUser({
        phone: contact,
        password,
      });
    }

    if (authResult.user === null) {
      return NextResponse.json(
        { error: "Failed to create user" },
        { status: 500 }
      );
    }

    const userId = authResult.user.id;

    // Insert extra user details into the users table
    const { error: insertError } = await supabaseAdmin
      .from("users")
      .insert([
        {
          id: userId,
          name,
          email: contact.includes("@") ? contact : null,
          phone: contact.includes("@") ? null : contact,
          role,
          address: role === "vendor" ? address : null,
        },
      ]);

    if (insertError) {
      return NextResponse.json(
        { error: insertError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ message: "User registered successfully!" });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "An unexpected error occurred";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
