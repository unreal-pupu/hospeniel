"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function CheckoutPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px]">
      <p className="text-gray-600 mb-4">Continue to payment when ready.</p>
      <Button asChild>
        <Link href="/payment">Go to payment</Link>
      </Button>
    </div>
  );
}
