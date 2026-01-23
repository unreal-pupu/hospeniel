"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  MessageSquare,
  User,
  Mail,
  Phone,
  Calendar,
  CheckCircle,
  Eye,
  Loader2,
  AlertCircle,
  DollarSign,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
  profiles?: {
    name: string;
    email: string;
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
  profiles?: {
    name: string;
    email: string;
  } | null;
}

export default function ServiceRequestsPage() {
  const router = useRouter();
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<string | null>(null);
  const [replies, setReplies] = useState<Map<string, ServiceRequestReply[]>>(new Map());
  const [replyText, setReplyText] = useState<Map<string, string>>(new Map());
  const [sendingReply, setSendingReply] = useState<string | null>(null);
  const [loadingReplies, setLoadingReplies] = useState<Set<string>>(new Set());
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);
  const [priceInput, setPriceInput] = useState<Map<string, string>>(new Map());
  const [confirmingPrice, setConfirmingPrice] = useState<string | null>(null);

  // Define functions before useEffect to avoid hoisting issues
  const fetchServiceRequests = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.warn("⚠️ No user found, cannot fetch service requests");
        return;
      }

      console.log("🔵 Fetching service requests for vendor:", user.id);

      // Use manual join approach (more reliable than FK relationships)
      // Step 1: Fetch service requests - include all payment fields
      const { data: requestsOnly, error: requestsError } = await supabase
        .from("service_requests")
        .select("id, user_id, vendor_id, message, contact_info, status, created_at, updated_at, final_price, price_confirmed, payment_reference, payment_method, paid_at, completed_at")
        .eq("vendor_id", user.id)
        .order("created_at", { ascending: false });

      if (requestsError) {
        console.error("❌ Error fetching service requests:", requestsError);
        setRequests([]);
        return;
      }

      if (!requestsOnly || requestsOnly.length === 0) {
        console.log("ℹ️ No service requests found");
        setRequests([]);
        return;
      }

      // Step 2: Manually fetch profiles for each request
      const userIds = [...new Set(requestsOnly.map(r => r.user_id).filter(Boolean))];
      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("id, name, email")
        .in("id", userIds);

      if (profilesError) {
        console.warn("⚠️ Error fetching profiles (non-critical):", profilesError);
      }

      // Step 3: Combine data
      const profilesMap = new Map(profilesData?.map(p => [p.id, p]) || []);

      const requestsWithProfiles = requestsOnly.map(req => ({
        ...req,
        profiles: profilesMap.get(req.user_id) || null
      }));

      console.log("✅ Fetched service requests (manual join):", requestsWithProfiles.length);
      setRequests(requestsWithProfiles);
    } catch (error) {
      console.error("❌ Exception in fetchServiceRequests:", error);
      setRequests([]);
    }
  }, []);

  const fetchReplies = useCallback(async (requestId: string) => {
    if (loadingReplies.has(requestId)) return;
    
    setLoadingReplies(prev => new Set(prev).add(requestId));
    try {
      // Fetch replies with manual profile join
      const { data: repliesData, error: repliesError } = await supabase
        .from("service_request_replies")
        .select("*")
        .eq("service_request_id", requestId)
        .order("created_at", { ascending: true });

      if (repliesError) {
        console.error("Error fetching replies:", repliesError);
        return;
      }

      if (!repliesData || repliesData.length === 0) {
        setReplies(prev => {
          const newMap = new Map(prev);
          newMap.set(requestId, []);
          return newMap;
        });
        return;
      }

      // Fetch profiles for reply senders
      const senderIds = [...new Set(repliesData.map(r => r.sender_id).filter(Boolean))];
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("id, name, email")
        .in("id", senderIds);

      const profilesMap = new Map(profilesData?.map(p => [p.id, p]) || []);

      // Combine replies with profiles
      const repliesWithProfiles = repliesData.map(reply => ({
        ...reply,
        profiles: profilesMap.get(reply.sender_id) || null
      }));

      setReplies(prev => {
        const newMap = new Map(prev);
        newMap.set(requestId, repliesWithProfiles);
        return newMap;
      });
    } catch (error) {
      console.error("Error fetching replies:", error);
    } finally {
      setLoadingReplies(prev => {
        const newSet = new Set(prev);
        newSet.delete(requestId);
        return newSet;
      });
    }
  }, [loadingReplies]);

  useEffect(() => {
    const checkAccessAndLoad = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          router.replace("/loginpage");
          return;
        }

        // Check vendor subscription plan and category from profiles table
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("subscription_plan, is_premium, category, role")
          .eq("id", user.id)
          .single();

        if (profileError) {
          console.error("Error checking profile:", profileError);
          setLoading(false);
          return;
        }

        const plan = profile?.subscription_plan || "free_trial";
        
        // Check if vendor is chef or home_cook
        const isChefOrHomeCook = profile?.category === 'chef' || profile?.category === 'home_cook';
        
        // Allow access if: Professional plan OR chef/home_cook
        const hasAccess = (plan === "professional" && profile?.is_premium) || isChefOrHomeCook;
        
        if (hasAccess) {
          console.log("✅ Vendor has access to service requests:", { plan, is_premium: profile?.is_premium, category: profile?.category });
          await fetchServiceRequests();
        } else {
          console.log("⚠️ Vendor does not have access:", { plan, is_premium: profile?.is_premium, category: profile?.category });
          setRequests([]);
        }
      } catch (error) {
        console.error("Error checking access:", error);
      } finally {
        setLoading(false);
      }
    };

    checkAccessAndLoad();

    // Check for service_request_id in URL params (from notification click)
    const urlParams = new URLSearchParams(window.location.search);
    const requestId = urlParams.get('request_id');
    if (requestId) {
      // Scroll to the specific request after loading
      setTimeout(() => {
        const element = document.getElementById(`request-${requestId}`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          element.classList.add('ring-2', 'ring-indigo-500', 'ring-offset-2');
          setTimeout(() => {
            element.classList.remove('ring-2', 'ring-indigo-500', 'ring-offset-2');
          }, 3000);
        }
      }, 1000);
    }

    // Subscribe to real-time updates
    const setupRealtime = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      console.log("🔵 Setting up real-time subscription for service requests, vendor_id:", user.id);

      const channel = supabase
        .channel("service-requests")
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "service_requests",
            filter: `vendor_id=eq.${user.id}`,
          },
          (payload) => {
            console.log("🔄 Real-time update received for service requests:", payload);
            fetchServiceRequests();
          }
        )
        .subscribe((status) => {
          if (status === "SUBSCRIBED") {
            console.log("✅ Successfully subscribed to service_requests real-time updates");
          } else if (status === "CHANNEL_ERROR") {
            console.error("❌ Error subscribing to service_requests real-time updates");
          }
        });

      return () => {
        console.log("🔴 Unsubscribing from service_requests real-time updates");
        supabase.removeChannel(channel);
      };
    };

    const cleanup = setupRealtime();
    
    // Subscribe to replies updates
    const setupRepliesRealtime = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const repliesChannel = supabase
        .channel("service-request-replies")
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "service_request_replies",
          },
          (payload) => {
            console.log("🔄 Real-time update received for replies:", payload);
            // Refresh replies for the affected request if it's currently selected
            if (payload.new && 'service_request_id' in payload.new) {
              const requestId = payload.new.service_request_id as string;
              // Check if this request is currently selected
              setSelectedRequest(current => {
                if (current === requestId) {
                  // Fetch replies if this request is open
                  fetchReplies(requestId);
                }
                return current;
              });
            }
          }
        )
        .subscribe((status) => {
          if (status === "SUBSCRIBED") {
            console.log("✅ Successfully subscribed to service_request_replies real-time updates");
          } else if (status === "CHANNEL_ERROR") {
            console.error("❌ Error subscribing to service_request_replies real-time updates");
          }
        });

      return () => {
        console.log("🔴 Unsubscribing from service_request_replies real-time updates");
        supabase.removeChannel(repliesChannel);
      };
    };

    const repliesCleanup = setupRepliesRealtime();

    return () => {
      cleanup.then((fn) => fn && fn());
      repliesCleanup.then((fn) => fn && fn());
    };
  }, [router, fetchServiceRequests, fetchReplies]);

  const sendReply = async (requestId: string) => {
    const message = replyText.get(requestId)?.trim();
    if (!message) {
      alert("Please enter a reply message.");
      return;
    }

    setSendingReply(requestId);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        alert("You must be logged in to send a reply.");
        return;
      }

      // Insert reply
      const { error: replyError } = await supabase
        .from("service_request_replies")
        .insert([
          {
            service_request_id: requestId,
            sender_id: user.id,
            sender_role: "vendor",
            message: message,
          },
        ])
        .select()
        .single();

      if (replyError) {
        console.error("Error sending reply:", replyError);
        alert("Failed to send reply. Please try again.");
        return;
      }

      // Update request status to "Responded" if not already at a later status
      const request = requests.find(r => r.id === requestId);
      if (request && (request.status === "New" || request.status === "Viewed")) {
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
      console.error("Error sending reply:", error);
      alert("An error occurred. Please try again.");
    } finally {
      setSendingReply(null);
    }
  };

  const handleRequestClick = (requestId: string) => {
    if (selectedRequest === requestId) {
      setSelectedRequest(null);
    } else {
      setSelectedRequest(requestId);
      if (!replies.has(requestId)) {
        fetchReplies(requestId);
      }
    }
  };

  const confirmPrice = async (requestId: string) => {
    const priceStr = priceInput.get(requestId)?.trim();
    if (!priceStr) {
      alert("Please enter a price.");
      return;
    }

    const price = parseFloat(priceStr);
    if (isNaN(price) || price <= 0) {
      alert("Please enter a valid price greater than 0.");
      return;
    }

    setConfirmingPrice(requestId);
    try {
      const { error } = await supabase
        .from("service_requests")
        .update({
          final_price: price,
          price_confirmed: true,
          status: "Price_Confirmed",
          updated_at: new Date().toISOString()
        })
        .eq("id", requestId);

      if (error) {
        console.error("Error confirming price:", error);
        alert("Failed to confirm price. Please try again.");
        return;
      }

      // Clear price input
      setPriceInput(prev => {
        const newMap = new Map(prev);
        newMap.delete(requestId);
        return newMap;
      });

      // Refresh requests
      await fetchServiceRequests();
      
      // Optionally send a message about the price
      const priceMessage = `I've confirmed the price: ₦${price.toLocaleString('en-NG', { minimumFractionDigits: 2 })}. Please proceed with payment when ready.`;
      setReplyText(prev => {
        const newMap = new Map(prev);
        newMap.set(requestId, priceMessage);
        return newMap;
      });
      
      // Auto-send the price confirmation message
      await sendReply(requestId);
    } catch (error) {
      console.error("Error confirming price:", error);
      alert("An error occurred. Please try again.");
    } finally {
      setConfirmingPrice(null);
    }
  };

  const markAsCompleted = async (requestId: string) => {
    if (!confirm("Mark this service request as completed?")) {
      return;
    }

    try {
      const { error } = await supabase
        .from("service_requests")
        .update({
          status: "Completed",
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq("id", requestId);

      if (error) {
        console.error("Error marking as completed:", error);
        alert("Failed to update status. Please try again.");
        return;
      }

      await fetchServiceRequests();
    } catch (error) {
      console.error("Error marking as completed:", error);
      alert("An error occurred. Please try again.");
    }
  };

  const updateStatus = async (requestId: string, newStatus: "Viewed" | "Responded") => {
    setUpdatingStatus(requestId);
    try {
      const { error } = await supabase
        .from("service_requests")
        .update({ status: newStatus })
        .eq("id", requestId);

      if (error) {
        console.error("Error updating status:", error);
        alert("Failed to update status. Please try again.");
        return;
      }

      // Refresh requests
      await fetchServiceRequests();
    } catch (error) {
      console.error("Error updating status:", error);
      alert("An error occurred. Please try again.");
    } finally {
      setUpdatingStatus(null);
    }
  };

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
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const filteredRequests = statusFilter === "all" 
    ? requests 
    : requests.filter(r => r.status === statusFilter);

  const newCount = requests.filter(r => r.status === "New").length;

  // Check access in separate useEffect
  useEffect(() => {
    const checkAccess = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      const { data: profile } = await supabase
        .from("profiles")
        .select("subscription_plan, is_premium, category")
        .eq("id", user.id)
        .single();
      
      const isChefOrHomeCook = profile?.category === 'chef' || profile?.category === 'home_cook';
      const hasAccessCheck = (profile?.subscription_plan === "professional" && profile?.is_premium) || isChefOrHomeCook;
      
      setHasAccess(hasAccessCheck);
    };
    
    checkAccess();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <Loader2 className="animate-spin text-indigo-600 h-8 w-8 mb-4" />
        <p className="text-gray-600">Loading service requests...</p>
      </div>
    );
  }

  if (hasAccess === false) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <Card className="rounded-xl shadow-lg border-2 border-indigo-200">
          <CardContent className="p-12 text-center">
            <AlertCircle className="h-16 w-16 text-indigo-600 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Access Required
            </h2>
            <p className="text-gray-600 mb-6">
              Service Requests are available for Professional Plan vendors or Chefs/Home Cooks.
            </p>
            <p className="text-gray-500 text-sm mb-6">
              Upgrade to Professional Plan to receive and manage service requests from customers who want to hire you for events, catering, and other services.
            </p>
            <Button
              onClick={() => router.push("/vendor/subscription")}
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              Upgrade to Professional Plan
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Service Requests</h1>
          <p className="text-gray-600 mt-1">
            Manage service requests from customers
          </p>
        </div>
        <div className="flex items-center gap-4">
          {newCount > 0 && (
            <Badge variant="destructive" className="text-sm px-3 py-1">
              {newCount} New
            </Badge>
          )}
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Requests</SelectItem>
              <SelectItem value="New">New</SelectItem>
              <SelectItem value="Viewed">Viewed</SelectItem>
              <SelectItem value="Responded">Responded</SelectItem>
              <SelectItem value="Price_Confirmed">Price Confirmed</SelectItem>
              <SelectItem value="Paid">Paid</SelectItem>
              <SelectItem value="Completed">Completed</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Requests List */}
      {filteredRequests.length === 0 ? (
        <Card className="rounded-xl shadow-md">
          <CardContent className="py-12 text-center">
            <MessageSquare className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 text-lg">No service requests yet</p>
            <p className="text-gray-400 text-sm mt-2">
              {statusFilter === "all"
                ? "When customers submit service requests, they'll appear here"
                : `No ${statusFilter.toLowerCase()} requests`}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredRequests.map((request) => (
            <Card
              id={`request-${request.id}`}
              key={request.id}
              className={`rounded-xl shadow-md transition-all hover:shadow-lg ${
                request.status === "New" ? "border-l-4 border-l-blue-600 bg-blue-50/30" : ""
              }`}
            >
              <CardContent className="p-6">
                <div className="flex flex-col lg:flex-row gap-6">
                  {/* Left: Request Info */}
                  <div className="flex-1 space-y-4">
                    {/* Header with Status */}
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <User className="h-5 w-5 text-indigo-600" />
                          <h3 className="text-lg font-semibold text-gray-900">
                            {request.profiles?.name || "Unknown User"}
                          </h3>
                          <Badge
                            variant="outline"
                            className={getStatusColor(request.status)}
                          >
                            {request.status}
                          </Badge>
                        </div>
                        {request.profiles?.email && (
                          <div className="flex items-center gap-2 text-sm text-gray-600 ml-8">
                            <Mail className="h-4 w-4" />
                            <span>{request.profiles.email}</span>
                          </div>
                        )}
                        {request.contact_info && (
                          <div className="flex items-center gap-2 text-sm text-gray-600 ml-8 mt-1">
                            <Phone className="h-4 w-4" />
                            <span>{request.contact_info}</span>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <Calendar className="h-4 w-4" />
                        <span>{formatTimeAgo(request.created_at)}</span>
                      </div>
                    </div>

                    {/* Message */}
                    <div className="bg-white rounded-lg p-4 border border-gray-200">
                      <div className="flex items-start gap-2">
                        <MessageSquare className="h-5 w-5 text-indigo-600 mt-0.5 flex-shrink-0" />
                        <p className="text-gray-700 whitespace-pre-wrap">
                          {request.message}
                        </p>
                      </div>
                    </div>

                    {/* Replies Section */}
                    {selectedRequest === request.id && (
                      <div className="mt-4 space-y-4">
                        <div className="border-t border-gray-200 pt-4">
                          <h4 className="text-sm font-semibold text-gray-700 mb-3">Conversation</h4>
                          
                          {/* Existing Replies */}
                          {loadingReplies.has(request.id) ? (
                            <div className="flex items-center justify-center py-4">
                              <Loader2 className="h-5 w-5 animate-spin text-indigo-600" />
                            </div>
                          ) : (
                            <div className="space-y-3 mb-4">
                              {(replies.get(request.id) || []).map((reply) => (
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
                                    <span className="text-xs font-medium text-gray-600">
                                      {reply.sender_role === "vendor"
                                        ? "You"
                                        : reply.sender_role === "system"
                                        ? "System"
                                        : reply.profiles?.name || "Customer"}
                                    </span>
                                    <span className="text-xs text-gray-500">
                                      {formatTimeAgo(reply.created_at)}
                                    </span>
                                  </div>
                                  <p className="text-sm text-gray-700 whitespace-pre-wrap">
                                    {reply.message}
                                  </p>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Price Confirmation Section */}
                          {request.status !== "Paid" && request.status !== "Completed" && !request.price_confirmed && (
                            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 space-y-3">
                              <h5 className="text-sm font-semibold text-gray-700">Set Final Price</h5>
                              <div className="flex gap-2">
                                <div className="flex-1">
                                  <Input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={priceInput.get(request.id) || ""}
                                    onChange={(e) => {
                                      setPriceInput(prev => {
                                        const newMap = new Map(prev);
                                        newMap.set(request.id, e.target.value);
                                        return newMap;
                                      });
                                    }}
                                    placeholder="Enter price (₦)"
                                    className="w-full"
                                  />
                                </div>
                                <Button
                                  onClick={() => confirmPrice(request.id)}
                                  disabled={confirmingPrice === request.id || !priceInput.get(request.id)?.trim()}
                                  className="bg-green-600 hover:bg-green-700 text-white"
                                >
                                  {confirmingPrice === request.id ? (
                                    <>
                                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                      Confirming...
                                    </>
                                  ) : (
                                    <>
                                      <DollarSign className="h-4 w-4 mr-2" />
                                      Confirm Price
                                    </>
                                  )}
                                </Button>
                              </div>
                            </div>
                          )}

                          {/* Price Confirmed Display */}
                          {request.price_confirmed && request.final_price && (
                            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                              <div className="flex items-center justify-between">
                                <div>
                                  <h5 className="text-sm font-semibold text-gray-700">Price Confirmed</h5>
                                  <p className="text-lg font-bold text-green-700 mt-1">
                                    ₦{request.final_price.toLocaleString('en-NG', { minimumFractionDigits: 2 })}
                                  </p>
                                </div>
                                {request.status === "Paid" && (
                                  <Badge className="bg-green-600 text-white">Paid</Badge>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Reply Form */}
                          <div className="space-y-2">
                            <Textarea
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
                              className="w-full"
                            />
                            <Button
                              onClick={() => sendReply(request.id)}
                              disabled={sendingReply === request.id || !replyText.get(request.id)?.trim()}
                              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white"
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

                          {/* Mark as Completed Button */}
                          {request.status === "Paid" && (
                            <Button
                              onClick={() => markAsCompleted(request.id)}
                              className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                            >
                              <CheckCircle className="h-4 w-4 mr-2" />
                              Mark as Completed
                            </Button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Right: Actions */}
                  <div className="lg:w-48 flex flex-col gap-2">
                    <Button
                      onClick={() => handleRequestClick(request.id)}
                      variant={selectedRequest === request.id ? "default" : "outline"}
                      className="w-full"
                    >
                      <MessageSquare className="h-4 w-4 mr-2" />
                      {selectedRequest === request.id ? "Hide Replies" : "View & Reply"}
                    </Button>
                    {request.status === "New" && (
                      <Button
                        onClick={() => updateStatus(request.id, "Viewed")}
                        disabled={updatingStatus === request.id}
                        variant="outline"
                        className="w-full"
                      >
                        {updatingStatus === request.id ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                          <Eye className="h-4 w-4 mr-2" />
                        )}
                        Mark as Viewed
                      </Button>
                    )}
                    {request.status === "Responded" && (
                      <div className="flex items-center gap-2 text-sm text-green-600 font-medium">
                        <CheckCircle className="h-4 w-4" />
                        Responded
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

