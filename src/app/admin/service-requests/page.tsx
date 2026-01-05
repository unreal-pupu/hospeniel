"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle } from "lucide-react";

interface ServiceRequest {
  id: string;
  user_id: string;
  vendor_id: string;
  message: string;
  contact_info: string;
  status: string;
  created_at: string;
  profiles?: { name: string; email: string };
  vendor_profile?: { name: string };
}

export default function AdminServiceRequestsPage() {
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    fetchRequests();
  }, [statusFilter]);

  const fetchRequests = async () => {
    try {
      let query = supabase
        .from("service_requests")
        .select(`
          *,
          profiles!service_requests_user_id_fkey (name, email),
          vendor:profiles!service_requests_vendor_id_fkey (name)
        `)
        .order("created_at", { ascending: false });

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      const { data, error } = await query;

      if (error) {
        // Fallback if FK relationship doesn't work
        const { data: fallbackData, error: fallbackError } = await supabase
          .from("service_requests")
          .select("*")
          .order("created_at", { ascending: false });

        if (fallbackError) throw fallbackError;
        setRequests(fallbackData || []);
        return;
      }

      setRequests(data || []);
    } catch (error) {
      console.error("Error fetching service requests:", error);
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (requestId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from("service_requests")
        .update({ status: newStatus })
        .eq("id", requestId);

      if (error) throw error;
      fetchRequests();
    } catch (error) {
      console.error("Error updating request:", error);
      alert("Failed to update request status");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="animate-spin text-indigo-600 h-8 w-8" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Service Requests</h1>
        <p className="text-gray-600 mt-2">View and manage all service requests</p>
      </div>

      <Card>
        <CardHeader>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="viewed">Viewed</SelectItem>
              <SelectItem value="responded">Responded</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {requests.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No service requests found
              </div>
            ) : (
              requests.map((request) => (
                <Card key={request.id} className="border-l-4 border-l-indigo-500">
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-lg">
                          Request from {request.profiles?.name || "User"}
                        </CardTitle>
                        <p className="text-sm text-gray-600 mt-1">
                          To: {request.vendor_profile?.name || "Vendor"}
                        </p>
                      </div>
                      <span
                        className={`px-2 py-1 rounded-full text-xs ${
                          request.status === "completed"
                            ? "bg-green-100 text-green-800"
                            : request.status === "responded"
                            ? "bg-blue-100 text-blue-800"
                            : request.status === "viewed"
                            ? "bg-yellow-100 text-yellow-800"
                            : "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {request.status}
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div>
                        <p className="text-sm font-medium text-gray-700">Message:</p>
                        <p className="text-gray-900 mt-1 whitespace-pre-wrap">{request.message}</p>
                      </div>
                      {request.contact_info && (
                        <div>
                          <p className="text-sm font-medium text-gray-700">Contact Info:</p>
                          <p className="text-gray-900 mt-1">{request.contact_info}</p>
                        </div>
                      )}
                      <div className="flex items-center justify-between pt-2 border-t">
                        <span className="text-sm text-gray-600">
                          {new Date(request.created_at).toLocaleString()}
                        </span>
                        <div className="flex gap-2">
                          <Select
                            value={request.status}
                            onValueChange={(value) => updateStatus(request.id, value)}
                          >
                            <SelectTrigger className="w-32 h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="pending">Pending</SelectItem>
                              <SelectItem value="viewed">Viewed</SelectItem>
                              <SelectItem value="responded">Responded</SelectItem>
                              <SelectItem value="completed">Completed</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
          <div className="mt-4 text-sm text-gray-600">
            Showing {requests.length} service requests
          </div>
        </CardContent>
      </Card>
    </div>
  );
}





