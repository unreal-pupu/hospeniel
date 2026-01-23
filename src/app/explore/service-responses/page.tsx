"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import type { RealtimePostgresChangesPayload, REALTIME_SUBSCRIBE_STATES } from "@supabase/supabase-js";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  MessageSquare,
  User,
  Phone,
  Calendar,
  Loader2,
  ChevronDown,
  ChevronUp,
  ChefHat,
  Store,
  LayoutDashboard,
  ShoppingCart,
  Settings,
  LogOut,
  Menu,
  X,
  ShoppingBag,
  HelpCircle,
  ShieldCheck,
  CheckCircle,
} from "lucide-react";
import Image from "next/image";

interface ServiceRequest {
  id: string;
  user_id: string;
  vendor_id: string;
  message: string;
  contact_info: string | null;
  status: "New" | "Viewed" | "Responded" | "Price_Confirmed" | "Paid" | "Completed" | "Cancelled";
  created_at: string;
  updated_at: string;
  final_price?: number | null;
  price_confirmed?: boolean;
  payment_reference?: string | null;
  payment_method?: string | null;
  paid_at?: string | null;
  completed_at?: string | null;
  vendor?: {
    name: string | null;
    category: string | null;
    is_premium?: boolean | null;
    subscription_plan?: string | null;
  } | null;
}

interface ServiceRequestReply {
  id: string;
  service_request_id: string;
  sender_id: string;
  sender_role: "user" | "vendor" | "system";
  message: string;
  read_at: string | null;
  created_at: string;
  sender?: {
    name: string | null;
    email: string | null;
  } | null;
}

interface SenderProfileRow {
  id: string;
  name: string | null;
  email: string | null;
}

interface VendorProfileRow {
  id: string;
  name: string | null;
  category: string | null;
  is_premium?: boolean | null;
  subscription_plan?: string | null;
}

export default function ServiceResponsesPage() {
  const router = useRouter();
  const pathname = usePathname();
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [replies, setReplies] = useState<Map<string, ServiceRequestReply[]>>(new Map());
  const [loadingReplies, setLoadingReplies] = useState<Set<string>>(new Set());
  const [expandedRequests, setExpandedRequests] = useState<Set<string>>(new Set());
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userProfile, setUserProfile] = useState<{ name: string; avatar_url: string } | null>(null);
  const [replyText, setReplyText] = useState<Map<string, string>>(new Map());
  const [sendingReply, setSendingReply] = useState<string | null>(null);
  const [processingPayment, setProcessingPayment] = useState<string | null>(null);

  const navigationItems = [
    { href: "/explore", label: "Explore", icon: LayoutDashboard },
    { href: "/explore/service-responses", label: "Service Responses", icon: MessageSquare },
    { href: "/orders", label: "Orders", icon: ShoppingBag },
    { href: "/cart", label: "Cart", icon: ShoppingCart },
    { href: "/settings", label: "Settings", icon: Settings },
    { href: "/help-center", label: "Help Center", icon: HelpCircle },
    { href: "/privacy-policy", label: "Privacy Policy", icon: ShieldCheck },
  ];

  // Fetch user profile
  const fetchUserProfile = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("name, avatar_url")
        .eq("id", user.id)
        .single();

      if (profile) {
        setUserProfile({
          name: profile.name || "User",
          avatar_url: profile.avatar_url || "/default-avatar.png",
        });
      }
    } catch (error) {
      console.error("Error fetching user profile:", error);
    }
  }, []);

  // Fetch service requests for the logged-in user
  const fetchServiceRequests = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.warn("⚠️ No user found, cannot fetch service requests");
        return;
      }

      console.log("🔵 Fetching service requests for user:", user.id);

      // Step 1: Fetch service requests (manual join approach) - include all fields
      const { data: requestsOnly, error: requestsError } = await supabase
        .from("service_requests")
        .select("id, user_id, vendor_id, message, contact_info, status, created_at, updated_at, final_price, price_confirmed, payment_reference, payment_method, paid_at, completed_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (requestsError) {
        console.error("❌ Error fetching service requests:", requestsError);
        setRequests([]);
        setLoading(false);
        return;
      }

      if (!requestsOnly || requestsOnly.length === 0) {
        console.log("ℹ️ No service requests found");
        setRequests([]);
        setLoading(false);
        return;
      }

      // Step 2: Fetch vendor profiles
      const requestRows: ServiceRequest[] = requestsOnly ?? [];
      const vendorIds = [
        ...new Set(requestRows.map((r: ServiceRequest) => r.vendor_id).filter(Boolean)),
      ];
      const { data: vendorProfiles, error: vendorError } = await supabase
        .from("profiles")
        .select("id, name, category, is_premium, subscription_plan")
        .in("id", vendorIds);

      if (vendorError) {
        console.warn("⚠️ Error fetching vendor profiles (non-critical):", vendorError);
      }

      // Step 3: Combine data
      // requestsOnly already contains all fields (final_price, price_confirmed, etc.) from the select statement
      const vendorRows: VendorProfileRow[] = vendorProfiles ?? [];
      const vendorMap = new Map(vendorRows.map((p: VendorProfileRow) => [p.id, p]));

      const requestsWithVendors = requestRows.map((req: ServiceRequest) => ({
        ...req,
        vendor: vendorMap.get(req.vendor_id) || null
      }));

      console.log("✅ Fetched service requests (manual join):", requestsWithVendors.length);
      setRequests(requestsWithVendors);
    } catch (error) {
      console.error("❌ Exception in fetchServiceRequests:", error);
      setRequests([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Check authentication
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/loginpage");
        return;
      }
      setIsAuthenticated(true);
      await fetchUserProfile();
      await fetchServiceRequests();
    };
    checkAuth();
  }, [router, fetchUserProfile, fetchServiceRequests]);

  // Fetch replies for a specific request
  const fetchReplies = useCallback(async (requestId: string) => {
    if (loadingReplies.has(requestId)) return;
    
    setLoadingReplies(prev => new Set(prev).add(requestId));
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.warn("⚠️ No user found, cannot fetch replies");
        return;
      }

      console.log("🔵 Fetching replies for service request:", requestId, "user:", user.id);

      // First, verify the user has access to this service request
      const { data: requestCheck, error: requestCheckError } = await supabase
        .from("service_requests")
        .select("id, user_id, vendor_id")
        .eq("id", requestId)
        .single();

      if (requestCheckError) {
        console.error("❌ Error checking service request access:", requestCheckError);
        return;
      }

      if (!requestCheck) {
        console.error("❌ Service request not found:", requestId);
        return;
      }

      if (requestCheck.user_id !== user.id && requestCheck.vendor_id !== user.id) {
        console.error("❌ User does not have access to this service request");
        return;
      }

      console.log("✅ User has access to service request, fetching replies...");

      // Try API route first (bypasses RLS)
      try {
        const apiResponse = await fetch(`/api/service-request-replies?request_id=${requestId}&user_id=${user.id}`, {
          cache: 'no-store',
        });
        
        if (apiResponse.ok) {
          const apiData = await apiResponse.json();
          console.log("🔵 API response:", apiData);
          
          if (apiData.replies) {
            console.log(`✅ Fetched ${apiData.replies.length} replies via API for request ${requestId}`);
            console.log("🔵 Replies data:", (apiData.replies as ServiceRequestReply[]).map((r) => ({
              id: r.id,
              sender_role: r.sender_role,
              message_preview: r.message?.substring(0, 50),
              created_at: r.created_at
            })));
            
            setReplies(prev => {
              const newMap = new Map(prev);
              newMap.set(requestId, apiData.replies);
              return newMap;
            });
            return;
          } else {
            console.warn("⚠️ API returned no replies array");
          }
        } else {
          const errorData = await apiResponse.json().catch(() => ({}));
          console.warn("⚠️ API route failed:", apiResponse.status, errorData);
        }
      } catch (apiError) {
        console.warn("⚠️ API route error (non-critical), falling back to direct query:", apiError);
      }

      // Fallback to direct Supabase query
      const { data: repliesData, error: repliesError } = await supabase
        .from("service_request_replies")
        .select("*")
        .eq("service_request_id", requestId)
        .order("created_at", { ascending: true });

      if (repliesError) {
        console.error("❌ Error fetching replies:", repliesError);
        console.error("❌ Error details:", {
          code: repliesError.code,
          message: repliesError.message,
          details: repliesError.details,
          hint: repliesError.hint,
        });
        return;
      }

      console.log(`✅ Fetched ${repliesData?.length || 0} replies for request ${requestId}`);

      if (!repliesData || repliesData.length === 0) {
        console.log("ℹ️ No replies found for this request");
        setReplies(prev => {
          const newMap = new Map(prev);
          newMap.set(requestId, []);
          return newMap;
        });
        return;
      }

      // Fetch sender profiles
      const replyRows: ServiceRequestReply[] = repliesData ?? [];
      const senderIds = [
        ...new Set(replyRows.map((r: ServiceRequestReply) => r.sender_id).filter(Boolean)),
      ];
      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("id, name, email")
        .in("id", senderIds);

      if (profilesError) {
        console.warn("⚠️ Error fetching profiles (non-critical):", profilesError);
      }

      const senderProfiles: SenderProfileRow[] = profilesData ?? [];
      const profilesMap = new Map(senderProfiles.map((p: SenderProfileRow) => [p.id, p]));

      // Combine replies with profiles
      const repliesWithProfiles = replyRows.map((reply: ServiceRequestReply) => ({
        ...reply,
        sender: profilesMap.get(reply.sender_id) || null
      }));

      console.log("✅ Processed replies with profiles:", repliesWithProfiles.map(r => ({
        id: r.id,
        sender_role: r.sender_role,
        message_preview: r.message.substring(0, 50),
        has_sender: !!r.sender
      })));

      setReplies(prev => {
        const newMap = new Map(prev);
        newMap.set(requestId, repliesWithProfiles);
        return newMap;
      });
    } catch (error) {
      console.error("❌ Exception in fetchReplies:", error);
    } finally {
      setLoadingReplies(prev => {
        const newSet = new Set(prev);
        newSet.delete(requestId);
        return newSet;
      });
    }
  }, [loadingReplies]);

  // Toggle request expansion
  const toggleRequest = (requestId: string) => {
    setExpandedRequests(prev => {
      const newSet = new Set(prev);
      if (newSet.has(requestId)) {
        newSet.delete(requestId);
      } else {
        newSet.add(requestId);
        // Always fetch replies when expanding to ensure we have the latest
        fetchReplies(requestId);
      }
      return newSet;
    });
  };

  // Real-time subscriptions
  useEffect(() => {
    if (!isAuthenticated) return;

    // Subscribe to service requests changes
    const requestsChannel = supabase
      .channel("user-service-requests")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "service_requests",
        },
        (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
          console.log("🔄 Real-time update received for service requests:", payload);
          fetchServiceRequests();
        }
      )
      .subscribe((status: REALTIME_SUBSCRIBE_STATES) => {
        if (status === "SUBSCRIBED") {
          console.log("✅ Successfully subscribed to service_requests real-time updates");
        } else if (status === "CHANNEL_ERROR") {
          console.error("❌ Error subscribing to service_requests real-time updates");
        }
      });

    // Subscribe to replies changes
    const repliesChannel = supabase
      .channel("user-service-request-replies")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "service_request_replies",
        },
        (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
          console.log("🔄 Real-time update received for replies:", payload);
          if (payload.new && 'service_request_id' in payload.new) {
            const requestId = payload.new.service_request_id as string;
            // Refresh replies if this request is expanded
            if (expandedRequests.has(requestId)) {
              fetchReplies(requestId);
            }
          }
        }
      )
      .subscribe((status: REALTIME_SUBSCRIBE_STATES) => {
        if (status === "SUBSCRIBED") {
          console.log("✅ Successfully subscribed to service_request_replies real-time updates");
        } else if (status === "CHANNEL_ERROR") {
          console.error("❌ Error subscribing to service_request_replies real-time updates");
        }
      });

    return () => {
      supabase.removeChannel(requestsChannel);
      supabase.removeChannel(repliesChannel);
    };
  }, [isAuthenticated, fetchServiceRequests, fetchReplies, expandedRequests]);

  const sendReply = useCallback(async (requestId: string) => {
    const message = replyText.get(requestId)?.trim();
    if (!message) {
      alert("Please enter a message.");
      return;
    }

    setSendingReply(requestId);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        alert("You must be logged in to send a reply.");
        return;
      }

      console.log("🔵 Sending reply for request:", requestId);

      // Insert reply message
      const { data: replyData, error: replyError } = await supabase
        .from("service_request_replies")
        .insert([
          {
            service_request_id: requestId,
            sender_id: user.id,
            sender_role: "user",
            message: message,
          },
        ])
        .select()
        .single();

      if (replyError) {
        console.error("❌ Error sending reply:", replyError);
        alert("Failed to send reply. Please try again.");
        return;
      }

      console.log("✅ Reply sent successfully:", replyData);

      // Update request status if needed
      const request = requests.find(r => r.id === requestId);
      if (request && request.status === "Responded") {
        await supabase
          .from("service_requests")
          .update({ status: "Responded", updated_at: new Date().toISOString() })
          .eq("id", requestId);
      }

      // Clear reply text
      setReplyText(prev => {
        const newMap = new Map(prev);
        newMap.delete(requestId);
        return newMap;
      });

      // Refresh replies and requests
      await fetchReplies(requestId);
      await fetchServiceRequests();
    } catch (error) {
      console.error("❌ Exception sending reply:", error);
      alert("An error occurred. Please try again.");
    } finally {
      setSendingReply(null);
    }
  }, [replyText, requests, fetchReplies, fetchServiceRequests]);

  const handlePayment = useCallback(async (requestId: string, amount: number) => {
    const request = requests.find(r => r.id === requestId);
    if (!request) {
      alert("Request not found.");
      return;
    }

    setProcessingPayment(requestId);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        alert("You must be logged in to make a payment.");
        return;
      }

      console.log("🔵 Processing payment for request:", requestId, "Amount:", amount);

      // Get user email
      const { data: profile } = await supabase
        .from("profiles")
        .select("email")
        .eq("id", user.id)
        .single();

      if (!profile?.email) {
        alert("Email not found. Please update your profile.");
        return;
      }

      // Initialize Paystack payment
      const initResponse = await fetch("/api/payment/initialize", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: profile.email,
          amount: amount,
          food_amount: amount,
          delivery_fee: 0,
          vat_amount: 0,
          vendor_id: request.vendor_id,
          metadata: {
            service_request_id: requestId,
            type: "service_request",
          },
        }),
      });

      const initData = await initResponse.json();

      if (!initResponse.ok || !initData.success) {
        console.error("❌ Payment initialization error:", initData);
        alert(initData.error || "Failed to initialize payment. Please try again.");
        return;
      }

      console.log("✅ Payment initialized, redirecting to Paystack...");

      // Store payment reference in service request
      await supabase
        .from("service_requests")
        .update({ 
          payment_reference: initData.reference,
          payment_method: "paystack"
        })
        .eq("id", requestId);

      // Store payment reference for verification
      if (typeof window !== "undefined") {
        sessionStorage.setItem("serviceRequestPaymentReference", initData.reference);
        sessionStorage.setItem("paymentReference", initData.reference);
        sessionStorage.setItem("serviceRequestId", requestId);
      }

      // Redirect to Paystack payment page
      if (initData.authorization_url) {
        window.location.href = initData.authorization_url;
      } else {
        throw new Error("No authorization URL received from Paystack");
      }
    } catch (error) {
      console.error("❌ Error processing payment:", error);
      alert("An error occurred during payment. Please try again.");
    } finally {
      setProcessingPayment(null);
    }
  }, [requests]);

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return "Just now";
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)} days ago`;
    return date.toLocaleDateString();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "New":
        return "bg-blue-100 text-blue-800";
      case "Viewed":
        return "bg-yellow-100 text-yellow-800";
      case "Responded":
        return "bg-green-100 text-green-800";
      case "Price_Confirmed":
        return "bg-purple-100 text-purple-800";
      case "Paid":
        return "bg-green-100 text-green-800";
      case "Completed":
        return "bg-blue-100 text-blue-800";
      case "Cancelled":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getVendorIcon = (category: string | null) => {
    if (category === "chef" || category === "home_cook") {
      return <ChefHat className="h-5 w-5" />;
    }
    return <Store className="h-5 w-5" />;
  };

  const getVendorTypeLabel = (request: ServiceRequest) => {
    if (request.vendor?.category === "chef") return "Chef";
    if (request.vendor?.category === "home_cook") return "Home Cook";
    if (request.vendor?.is_premium) return "Premium Vendor";
    return "Vendor";
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      localStorage.removeItem('hospineil-auth');
      window.location.href = "/loginpage?logout=true";
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-hospineil-base-bg flex items-center justify-center">
        <div className="flex flex-col items-center">
          <Loader2 className="animate-spin text-hospineil-primary h-8 w-8 mb-4" />
          <p className="text-gray-600 font-body">Loading service responses...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-hospineil-base-bg flex">
      {/* Left Sidebar */}
      <aside
        className={`
          fixed lg:static inset-y-0 left-0 z-50
          w-64 bg-hospineil-primary shadow-xl
          transform transition-transform duration-300 ease-in-out
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
        `}
      >
        <div className="flex flex-col h-full">
          {/* Sidebar Header */}
          <div className="p-6 border-b border-hospineil-primary/20">
            <h2 className="text-xl font-bold text-white font-logo">Hospineil</h2>
          </div>

          {/* Navigation Links */}
          <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
            {navigationItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href || (item.href !== "/explore" && pathname?.startsWith(item.href));
              return (
                <button
                  key={item.href}
                  onClick={() => {
                    router.push(item.href);
                    setSidebarOpen(false);
                  }}
                  className={`
                    w-full flex items-center gap-3 px-4 py-3 rounded-lg
                    transition-colors duration-200 font-button
                    ${
                      isActive
                        ? "bg-white/20 text-white font-semibold"
                        : "text-white/90 hover:bg-hospineil-accent hover:text-white"
                    }
                  `}
                >
                  <Icon size={20} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Logout Button */}
          <div className="p-4 border-t border-hospineil-primary/20">
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-white/90 hover:bg-red-500/20 hover:text-white transition-colors duration-200 font-button"
            >
              <LogOut size={20} />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main Content */}
      <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
        {/* Header with mobile menu */}
        <header className="mb-6">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="lg:hidden p-2 rounded-lg text-gray-600 hover:bg-gray-100"
            >
              {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
            {userProfile && (
              <div className="flex items-center gap-4 ml-auto">
                <div className="flex items-center gap-3">
                  <div className="text-right hidden sm:block">
                    <h1 className="text-lg font-semibold text-gray-800 font-header">
                      Hello <span className="inline-block">👋</span>{" "}
                      <span className="text-hospineil-primary">{userProfile.name}</span>
                    </h1>
                  </div>
                  <div className="relative">
                    <Image
                      src={userProfile.avatar_url || "/default-avatar.png"}
                      alt={`${userProfile.name}'s Avatar`}
                      width={48}
                      height={48}
                      className="rounded-full border-2 border-hospineil-primary/20 shadow-md object-cover"
                      priority
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </header>

        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 font-header">Service Request Responses</h1>
            <p className="text-gray-600 mt-1 font-body">
              View responses from vendors, chefs, and home cooks to your service requests
            </p>
          </div>

          {/* Requests List */}
      {requests.length === 0 ? (
        <Card className="rounded-xl shadow-md">
          <CardContent className="py-12 text-center">
            <MessageSquare className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 text-lg font-body">No service requests yet</p>
            <p className="text-gray-400 text-sm mt-2 font-body">
              When you submit service requests, vendor responses will appear here
            </p>
            <Button
              onClick={() => router.push("/explore")}
              className="mt-4 bg-hospineil-primary hover:bg-hospineil-primary/90 text-white"
            >
              Browse Vendors
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {requests.map((request) => {
            const isExpanded = expandedRequests.has(request.id);
            const requestReplies = replies.get(request.id) || [];
            const hasReplies = requestReplies.length > 0;
            const vendorReplies = requestReplies.filter(r => r.sender_role === "vendor");

            return (
              <Card
                key={request.id}
                className={`rounded-xl shadow-md transition-all hover:shadow-lg ${
                  request.status === "Responded" && hasReplies
                    ? "border-l-4 border-l-green-600 bg-green-50/30"
                    : request.status === "New"
                    ? "border-l-4 border-l-blue-600 bg-blue-50/30"
                    : ""
                }`}
              >
                <CardContent className="p-6">
                  {/* Request Header */}
                  <div className="flex flex-col lg:flex-row gap-4 justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        {request.vendor && getVendorIcon(request.vendor.category)}
                        <h3 className="text-lg font-semibold text-gray-900 font-header">
                          {request.vendor?.name || "Unknown Vendor"}
                        </h3>
                        <Badge variant="outline" className={getStatusColor(request.status)}>
                          {request.status}
                        </Badge>
                        <Badge variant="outline" className="bg-indigo-100 text-indigo-800">
                          {getVendorTypeLabel(request)}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-600 ml-8 font-body">
                        <Calendar className="h-4 w-4" />
                        <span>{formatTimeAgo(request.created_at)}</span>
                        {hasReplies && (
                          <>
                            <span className="mx-2">•</span>
                            <MessageSquare className="h-4 w-4" />
                            <span>{vendorReplies.length} {vendorReplies.length === 1 ? "reply" : "replies"}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <Button
                      onClick={() => toggleRequest(request.id)}
                      variant="outline"
                      className="flex items-center gap-2"
                    >
                      {isExpanded ? (
                        <>
                          <ChevronUp className="h-4 w-4" />
                          Hide Details
                        </>
                      ) : (
                        <>
                          <ChevronDown className="h-4 w-4" />
                          View Details
                        </>
                      )}
                    </Button>
                  </div>

                  {/* Expanded Content */}
                  {isExpanded && (
                    <div className="mt-6 space-y-4 border-t border-gray-200 pt-4">
                      {/* Original Message */}
                      <div className="bg-white rounded-lg p-4 border border-gray-200">
                        <div className="flex items-start gap-2 mb-2">
                          <User className="h-5 w-5 text-hospineil-primary mt-0.5 flex-shrink-0" />
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-sm font-semibold text-gray-700 font-header">Your Message</span>
                              <span className="text-xs text-gray-500 font-body">{formatTimeAgo(request.created_at)}</span>
                            </div>
                            <p className="text-gray-700 whitespace-pre-wrap font-body">{request.message}</p>
                            {request.contact_info && (
                              <div className="mt-2 flex items-center gap-2 text-sm text-gray-600 font-body">
                                <Phone className="h-4 w-4" />
                                <span>{request.contact_info}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Full Conversation Thread */}
                      {loadingReplies.has(request.id) ? (
                        <div className="flex items-center justify-center py-4">
                          <Loader2 className="h-5 w-5 animate-spin text-hospineil-primary" />
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <h4 className="text-sm font-semibold text-gray-700 font-header">Conversation</h4>
                            <Button
                              onClick={() => {
                                console.log("🔄 Manually refreshing replies for request:", request.id);
                                fetchReplies(request.id);
                              }}
                              variant="outline"
                              size="sm"
                              className="text-xs"
                            >
                              <Loader2 className="h-3 w-3 mr-1" />
                              Refresh
                            </Button>
                          </div>
                          
                          {/* Debug info (remove in production) */}
                          {process.env.NODE_ENV === 'development' && (
                            <div className="bg-gray-100 p-2 rounded text-xs font-mono">
                              <p>Request ID: {request.id}</p>
                              <p>Replies in state: {requestReplies.length}</p>
                              <p>Loading: {loadingReplies.has(request.id) ? 'Yes' : 'No'}</p>
                              <p>Replies keys: {Array.from(replies.keys()).join(', ')}</p>
                            </div>
                          )}
                          
                          {/* Show empty state if no replies */}
                          {requestReplies.length === 0 ? (
                            <div className="bg-gray-50 rounded-lg p-4 text-center">
                              <MessageSquare className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                              <p className="text-sm text-gray-500 font-body">
                                No replies yet. The vendor will respond soon.
                              </p>
                            </div>
                          ) : (
                            /* All messages in chronological order */
                            requestReplies.map((reply) => (
                              <div
                                key={reply.id}
                                className={`p-3 rounded-lg ${
                                  reply.sender_role === "vendor"
                                    ? "bg-indigo-50 border border-indigo-200 ml-8"
                                    : reply.sender_role === "system"
                                    ? "bg-emerald-50 border border-emerald-200"
                                    : "bg-gray-50 border border-gray-200 mr-8"
                                }`}
                              >
                                <div className="flex items-start justify-between mb-1">
                                  <div className="flex items-center gap-2">
                                    {reply.sender_role === "vendor" ? (
                                      <>
                                        {request.vendor?.category === "chef" || request.vendor?.category === "home_cook" ? (
                                          <ChefHat className="h-4 w-4 text-indigo-600" />
                                        ) : (
                                          <Store className="h-4 w-4 text-indigo-600" />
                                        )}
                                        <span className="text-xs font-medium text-gray-700 font-header">
                                          {request.vendor?.name || "Vendor"}
                                        </span>
                                      </>
                                    ) : reply.sender_role === "system" ? (
                                      <>
                                        <CheckCircle className="h-4 w-4 text-emerald-600" />
                                        <span className="text-xs font-medium text-emerald-700 font-header">System</span>
                                      </>
                                    ) : (
                                      <>
                                        <User className="h-4 w-4 text-gray-600" />
                                        <span className="text-xs font-medium text-gray-700 font-header">You</span>
                                      </>
                                    )}
                                  </div>
                                  <span className="text-xs text-gray-500 font-body">
                                    {formatTimeAgo(reply.created_at)}
                                  </span>
                                </div>
                                <p className="text-sm text-gray-700 whitespace-pre-wrap font-body mt-2">
                                  {reply.message}
                                </p>
                              </div>
                            ))
                          )}

                          {/* Price Confirmation Section */}
                          {/* Price Confirmation Section - Show if price is confirmed and not yet paid */}
                          {request.price_confirmed && request.final_price && request.status !== "Paid" && request.status !== "Completed" && (
                            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mt-4">
                              <div className="flex items-center justify-between mb-2">
                                <div>
                                  <h5 className="text-sm font-semibold text-gray-700 font-header">Price Confirmed</h5>
                                  <p className="text-lg font-bold text-hospineil-primary mt-1">
                                    ₦{request.final_price.toLocaleString('en-NG', { minimumFractionDigits: 2 })}
                                  </p>
                                </div>
                                <Button
                                  onClick={() => handlePayment(request.id, request.final_price!)}
                                  disabled={processingPayment === request.id}
                                  className="bg-green-600 hover:bg-green-700 text-white"
                                >
                                  {processingPayment === request.id ? (
                                    <>
                                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                      Processing...
                                    </>
                                  ) : (
                                    <>
                                      <span className="text-base font-semibold mr-2">₦</span>
                                      Pay Now
                                    </>
                                  )}
                                </Button>
                              </div>
                            </div>
                          )}

                          {/* Payment Status */}
                          {request.status === "Paid" && (
                            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mt-4">
                              <div className="flex items-center gap-2">
                                <CheckCircle className="h-5 w-5 text-green-600" />
                                <span className="text-sm font-semibold text-green-800 font-header">
                                  Payment Completed
                                </span>
                              </div>
                              {request.paid_at && (
                                <p className="text-xs text-green-600 mt-1 font-body">
                                  Paid on {new Date(request.paid_at).toLocaleDateString()}
                                </p>
                              )}
                            </div>
                          )}

                          {/* Completion Status */}
                          {request.status === "Completed" && (
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-4">
                              <div className="flex items-center gap-2">
                                <CheckCircle className="h-5 w-5 text-blue-600" />
                                <span className="text-sm font-semibold text-blue-800 font-header">
                                  Service Completed
                                </span>
                              </div>
                            </div>
                          )}

                          {/* Reply Form - Only show if not completed/cancelled */}
                          {request.status !== "Completed" && request.status !== "Cancelled" && (
                            <div className="mt-4 space-y-2 border-t border-gray-200 pt-4">
                              <textarea
                                value={replyText.get(request.id) || ""}
                                onChange={(e) => {
                                  setReplyText(prev => {
                                    const newMap = new Map(prev);
                                    newMap.set(request.id, e.target.value);
                                    return newMap;
                                  });
                                }}
                                placeholder="Type your reply..."
                                rows={3}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-hospineil-primary focus:border-transparent resize-none font-body"
                              />
                              <Button
                                onClick={() => sendReply(request.id)}
                                disabled={sendingReply === request.id || !replyText.get(request.id)?.trim()}
                                className="w-full bg-hospineil-primary hover:bg-hospineil-primary/90 text-white"
                              >
                                {sendingReply === request.id ? (
                                  <>
                                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                    Sending...
                                  </>
                                ) : (
                                  <>
                                    <MessageSquare className="h-4 w-4 mr-2" />
                                    Send Reply
                                  </>
                                )}
                              </Button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
        </div>
      </main>
    </div>
  );
}
