"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { Loader2 } from "lucide-react";

export default function CheckoutPage() {
  const router = useRouter();

  useEffect(() => {
    // Check authentication
    const checkAuth = async () => {
      const { data: { user }, error } = await supabase.auth.getUser();
      
      if (error || !user) {
        // Store return URL for redirect after login
        if (typeof window !== "undefined") {
          sessionStorage.setItem("returnUrl", "/payment");
        }
        router.push("/loginpage");
        return;
      }
      
      // User is authenticated - redirect to payment page
      router.push("/payment");
    };
    
    checkAuth();
  }, [router]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px]">
      <Loader2 className="animate-spin text-indigo-600 h-8 w-8 mb-4" />
      <p className="text-gray-600">Redirecting to payment...</p>
    </div>
  );
}
