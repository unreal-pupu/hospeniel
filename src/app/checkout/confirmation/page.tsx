"use client";

import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function OrderConfirmationPage() {
  return (
    <section className="w-full min-h-screen flex items-center justify-center px-6 py-16 bg-gray-50">
      <Card className="max-w-lg w-full shadow-lg rounded-2xl text-center p-8">
        <CardContent className="space-y-6">
          {/* Success Icon */}
          <div className="flex justify-center">
            <CheckCircle2 className="text-green-600 w-16 h-16" />
          </div>

          {/* Title */}
          <h1 className="text-3xl font-bold text-gray-900">
            Order Placed Successfully 🎉
          </h1>

          {/* Subtitle */}
          <p className="text-gray-600 text-lg">
            Thank you for your order! We’ve sent you an email with the details of your purchase.  
          </p>

          {/* Actions */}
          <div className="flex flex-col gap-4 mt-6">
            <Link href="/orders">
              <Button className="w-full rounded-full bg-indigo-600 text-white hover:bg-indigo-700">
                View My Orders
              </Button>
            </Link>
            <Link href="/vendor-listing">
              <Button variant="outline" className="w-full rounded-full">
                Continue Shopping
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
