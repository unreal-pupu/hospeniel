"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Search, CheckCircle, XCircle } from "lucide-react";

interface Rider {
  id: string;
  name: string;
  email: string;
  phone_number: string | null;
  address: string;
  rider_approval_status: "pending" | "approved" | "rejected" | null;
  created_at: string;
}

export default function AdminRidersPage() {
  const [riders, setRiders] = useState<Rider[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "approved" | "rejected">("all");
  const [updating, setUpdating] = useState<string | null>(null);

  useEffect(() => {
    fetchRiders();
  }, []);

  const fetchRiders = async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("role", "rider")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setRiders(data || []);
    } catch (error) {
      console.error("Error fetching riders:", error);
      alert("Failed to fetch riders");
    } finally {
      setLoading(false);
    }
  };

  const updateRiderStatus = async (riderId: string, status: "approved" | "rejected") => {
    setUpdating(riderId);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ rider_approval_status: status })
        .eq("id", riderId);

      if (error) throw error;

      // Notify the rider about the status change
      const rider = riders.find((r) => r.id === riderId);
      if (rider) {
        const { error: notificationError } = await supabase
          .from("notifications")
          .insert({
            user_id: riderId,
            message: status === "approved" 
              ? "Your rider account has been approved! You can now access the rider portal."
              : "Your rider account application has been rejected. Please contact support for more information.",
            type: "system",
            read: false,
            metadata: {
              type: "rider_approval",
              status: status,
            },
          });

        if (notificationError) {
          console.error("Error creating notification:", notificationError);
          // Don't fail the update if notification fails
        }
      }

      alert(`Rider ${status === "approved" ? "approved" : "rejected"} successfully!`);
      fetchRiders();
    } catch (error) {
      console.error("Error updating rider status:", error);
      alert("Failed to update rider status");
    } finally {
      setUpdating(null);
    }
  };

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case "approved":
        return (
          <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-semibold">
            Approved
          </span>
        );
      case "rejected":
        return (
          <span className="px-2 py-1 bg-red-100 text-red-800 rounded-full text-xs font-semibold">
            Rejected
          </span>
        );
      case "pending":
        return (
          <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs font-semibold">
            Pending
          </span>
        );
      default:
        return (
          <span className="px-2 py-1 bg-gray-100 text-gray-800 rounded-full text-xs font-semibold">
            Unknown
          </span>
        );
    }
  };

  const filteredRiders = riders.filter((rider) => {
    const matchesSearch =
      rider.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      rider.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      rider.phone_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      rider.address?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus =
      statusFilter === "all" || rider.rider_approval_status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="animate-spin text-indigo-600 h-8 w-8" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Riders Management</h1>
          <p className="text-gray-600 mt-2">View and manage all rider accounts</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Search riders by name, email, phone, or address..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Name</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Email</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Phone</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Address</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Status</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Registered</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRiders.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-gray-500">
                      No riders found
                    </td>
                  </tr>
                ) : (
                  filteredRiders.map((rider) => (
                    <tr key={rider.id} className="border-b hover:bg-gray-50">
                      <td className="py-3 px-4">{rider.name || "N/A"}</td>
                      <td className="py-3 px-4">{rider.email}</td>
                      <td className="py-3 px-4">{rider.phone_number || "N/A"}</td>
                      <td className="py-3 px-4 max-w-xs truncate" title={rider.address}>
                        {rider.address || "N/A"}
                      </td>
                      <td className="py-3 px-4">{getStatusBadge(rider.rider_approval_status)}</td>
                      <td className="py-3 px-4 text-sm text-gray-600">
                        {new Date(rider.created_at).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          {rider.rider_approval_status !== "approved" && (
                            <Button
                              size="sm"
                              onClick={() => updateRiderStatus(rider.id, "approved")}
                              disabled={updating === rider.id}
                              className="bg-green-600 hover:bg-green-700 text-white"
                            >
                              {updating === rider.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <>
                                  <CheckCircle className="h-4 w-4 mr-1" />
                                  Approve
                                </>
                              )}
                            </Button>
                          )}
                          {rider.rider_approval_status !== "rejected" && (
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => updateRiderStatus(rider.id, "rejected")}
                              disabled={updating === rider.id}
                            >
                              {updating === rider.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <>
                                  <XCircle className="h-4 w-4 mr-1" />
                                  Reject
                                </>
                              )}
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="mt-4 text-sm text-gray-600">
            Showing {filteredRiders.length} of {riders.length} riders
          </div>
        </CardContent>
      </Card>
    </div>
  );
}






