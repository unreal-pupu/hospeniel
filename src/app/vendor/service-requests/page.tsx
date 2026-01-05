"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  status: "New" | "Viewed" | "Responded";
  created_at: string;
  updated_at: string;
  profiles?: {
    name: string;
    email: string;
  };
}

export default function ServiceRequestsPage() {
  const router = useRouter();
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [subscriptionPlan, setSubscriptionPlan] = useState<string>("free_trial");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);

  useEffect(() => {
    const checkPremiumAndLoad = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          router.replace("/loginpage");
          return;
        }

        // Check vendor subscription plan from profiles table (primary source)
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("subscription_plan, is_premium")
          .eq("id", user.id)
          .single();

        if (profileError) {
          console.error("Error checking subscription plan:", profileError);
          setLoading(false);
          return;
        }

        const plan = profile?.subscription_plan || "free_trial";
        setSubscriptionPlan(plan);

        // Only professional plan vendors can access service requests
        if (plan === "professional" && profile?.is_premium) {
          console.log("✅ Vendor is on professional plan, fetching service requests...");
          await fetchServiceRequests();
        } else {
          console.log("⚠️ Vendor is not on professional plan:", { plan, is_premium: profile?.is_premium });
          setRequests([]);
        }
      } catch (error) {
        console.error("Error checking premium status:", error);
      } finally {
        setLoading(false);
      }
    };

    checkPremiumAndLoad();

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

    return () => {
      cleanup.then((fn) => fn && fn());
    };
  }, [router]);

  const fetchServiceRequests = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.warn("⚠️ No user found, cannot fetch service requests");
        return;
      }

      console.log("🔵 Fetching service requests for vendor:", user.id);

      // First, try with the foreign key relationship
      const { data, error } = await supabase
        .from("service_requests")
        .select(`
          *,
          profiles!service_requests_user_id_fkey (
            name,
            email
          )
        `)
        .eq("vendor_id", user.id)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("❌ Error fetching service requests (with FK):", error);
        console.error("❌ Error details:", {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint
        });

        // Fallback: Try without the FK relationship name
        console.log("🔄 Trying fallback query without FK name...");
        const { data: fallbackData, error: fallbackError } = await supabase
          .from("service_requests")
          .select(`
            *,
            profiles:user_id (
              name,
              email
            )
          `)
          .eq("vendor_id", user.id)
          .order("created_at", { ascending: false });

        if (fallbackError) {
          console.error("❌ Fallback query also failed:", fallbackError);
          // Last resort: Fetch without join and manually get profiles
          console.log("🔄 Trying query without profile join...");
          const { data: requestsOnly, error: requestsError } = await supabase
            .from("service_requests")
            .select("*")
            .eq("vendor_id", user.id)
            .order("created_at", { ascending: false });

          if (requestsError) {
            console.error("❌ Even basic query failed:", requestsError);
            setRequests([]);
            return;
          }

          // Manually fetch profiles for each request
          if (requestsOnly && requestsOnly.length > 0) {
            const userIds = [...new Set(requestsOnly.map(r => r.user_id).filter(Boolean))];
            const { data: profilesData } = await supabase
              .from("profiles")
              .select("id, name, email")
              .in("id", userIds);

            const profilesMap = new Map(profilesData?.map(p => [p.id, p]) || []);

            const requestsWithProfiles = requestsOnly.map(req => ({
              ...req,
              profiles: profilesMap.get(req.user_id) || null
            }));

            console.log("✅ Fetched service requests (manual join):", requestsWithProfiles.length);
            setRequests(requestsWithProfiles);
            return;
          }

          setRequests(requestsOnly || []);
          return;
        }

        console.log("✅ Fetched service requests (fallback):", fallbackData?.length || 0);
        setRequests(fallbackData || []);
        return;
      }

      console.log("✅ Fetched service requests:", data?.length || 0);
      console.log("✅ Service requests data:", data);
      setRequests(data || []);
    } catch (error) {
      console.error("❌ Exception in fetchServiceRequests:", error);
      setRequests([]);
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

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <Loader2 className="animate-spin text-indigo-600 h-8 w-8 mb-4" />
        <p className="text-gray-600">Loading service requests...</p>
      </div>
    );
  }

  if (subscriptionPlan !== "professional") {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <Card className="rounded-xl shadow-lg border-2 border-indigo-200">
          <CardContent className="p-12 text-center">
            <AlertCircle className="h-16 w-16 text-indigo-600 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Professional Plan Required
            </h2>
            <p className="text-gray-600 mb-6">
              Service Requests are available only for Professional Plan vendors.
            </p>
            <p className="text-gray-500 text-sm mb-6">
              Upgrade to Professional Plan to receive and manage service requests from customers who want to hire you for events, catering, and other services.
            </p>
            <Button
              onClick={() => router.push("/vendor/settings")}
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
                  </div>

                  {/* Right: Actions */}
                  <div className="lg:w-48 flex flex-col gap-2">
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
                    {request.status !== "Responded" && (
                      <Button
                        onClick={() => updateStatus(request.id, "Responded")}
                        disabled={updatingStatus === request.id}
                        className="w-full bg-green-600 hover:bg-green-700 text-white"
                      >
                        {updatingStatus === request.id ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                          <CheckCircle className="h-4 w-4 mr-2" />
                        )}
                        Mark as Responded
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

