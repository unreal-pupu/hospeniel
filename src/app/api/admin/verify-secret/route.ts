import { NextResponse } from "next/server";

// Verify admin secret key (server-side)
export async function POST(req: Request) {
  try {
    const { secretKey } = await req.json();
    const adminSecretKey = process.env.ADMIN_SECRET_KEY; // Server-side only

    // If no secret key is configured, skip verification
    if (!adminSecretKey) {
      return NextResponse.json({ 
        valid: true, 
        requiresKey: false,
        message: "Secret key not configured" 
      });
    }

    // If empty key provided, return that key is required
    if (!secretKey || secretKey === "") {
      return NextResponse.json({ 
        valid: false, 
        requiresKey: true,
        message: "Secret key is required" 
      });
    }

    // Verify the provided key
    if (secretKey === adminSecretKey) {
      return NextResponse.json({ 
        valid: true, 
        requiresKey: true 
      });
    }

    return NextResponse.json(
      { 
        valid: false, 
        requiresKey: true,
        error: "Invalid secret key" 
      },
      { status: 403 }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Verification failed";
    return NextResponse.json(
      { 
        valid: false, 
        requiresKey: false,
        error: errorMessage
      },
      { status: 500 }
    );
  }
}

