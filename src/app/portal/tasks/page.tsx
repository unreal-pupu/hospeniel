"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Loader2, 
  Package, 
  MapPin, 
  Clock, 
  CheckCircle, 
  Phone,
  User,
  Store,
  Truck,
  Navigation,
  FileText
} from "lucide-react";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";

dayjs.extend(relativeTime);

interface DeliveryTask {
  id: string;
  order_id: string;
  status: string;
  payment_reference?: string | null;
  pickup_sequence?: number | null;
  total_stops?: number;
  pickup_address: string;
  delivery_address: string;
  delivery_city: string | null;
  delivery_state: string | null;
  delivery_zone: string | null;
  delivery_phone: string | null;
  special_instructions: string | null;
  customer_name: string;
  customer_phone: string;
  vendor_name: string;
  vendor_phone: string | null;
  vendor_address: string | null;
  vendor_instructions: string | null;
  created_at: string;
  assigned_at?: string | null;
  picked_up_at?: string | null;
  delivered_at?: string | null;
}

interface OrderRow {
  delivery_city?: string | null;
  delivery_state?: string | null;
  delivery_zone?: string | null;
  delivery_address_line_1?: string | null;
  delivery_address?: string | null;
  delivery_postal_code?: string | null;
  delivery_phone?: string | null;
  delivery_phone_number?: string | null;
  special_instructions?: string | null;
  total_price?: number | null;
  delivery_charge?: number | null;
  payment_reference?: string | null;
  quantity?: number | null;
  user_id?: string | null;
}

interface DeliveryTaskRow {
  id: string;
  order_id: string;
  vendor_id: string;
  vendor_location?: string | null;
  payment_reference?: string | null;
  pickup_sequence?: number | null;
  status: string;
  pickup_address: string;
  delivery_address: string;
  delivery_phone: string | null;
  created_at: string;
  assigned_at?: string | null;
  picked_up_at?: string | null;
  delivered_at?: string | null;
  orders?: OrderRow | OrderRow[];
}

interface VendorProfileRow {
  id: string;
  name: string | null;
  phone_number: string | null;
}

interface CustomerProfileRow {
  id: string;
  name: string | null;
  phone_number: string | null;
}

interface VendorRow {
  id?: string | null;
  profile_id?: string | null;
  business_name?: string | null;
  name?: string | null;
  address?: string | null;
  phone_number?: string | null;
  location?: string | null;
}

export default function RiderTasksPage() {
  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState<DeliveryTask[]>([]);
  const [filter, setFilter] = useState<"all" | "pending" | "in_progress" | "completed">("all");
  const [updating, setUpdating] = useState<string | null>(null);
  useEffect(() => {
    fetchTasks();

    // Set up real-time subscription for delivery tasks
    const channel = supabase
      .channel("rider-tasks-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "delivery_tasks",
        },
        () => {
          console.log("🔄 Delivery task changed, refreshing...");
          fetchTasks();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchTasks = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.error("❌ No user found");
        setLoading(false);
        return;
      }

      console.log("🔍 Fetching delivery tasks for rider:", user.id);

      const { data: riderProfile } = await supabase
        .from("profiles")
        .select("location")
        .eq("id", user.id)
        .single();

      const riderLocation = riderProfile?.location || null;

      // Fetch pending delivery tasks - simplified query without nested profiles
      let pendingQuery = supabase
        .from("delivery_tasks")
        .select(`
          id,
          order_id,
          vendor_id,
          vendor_location,
          payment_reference,
          pickup_sequence,
          status,
          pickup_address,
          delivery_address,
          delivery_phone,
          created_at,
          orders(
            delivery_city,
            delivery_state,
            delivery_zone,
            delivery_address_line_1,
            delivery_address,
            delivery_postal_code,
            delivery_phone,
            delivery_phone_number,
            special_instructions,
            total_price,
            delivery_charge,
            payment_reference,
            quantity,
            user_id
          )
        `)
        .eq("status", "Pending")
        .is("rider_id", null);

      if (riderLocation) {
        pendingQuery = pendingQuery.eq("vendor_location", riderLocation);
      }

      const { data: pendingTasks, error: pendingError } = await pendingQuery
        .order("created_at", { ascending: false });

      if (pendingError) {
        console.error("❌ Error fetching pending tasks:", pendingError);
      } else {
        console.log("✅ Pending tasks fetched:", pendingTasks?.length || 0);
        if (pendingTasks && pendingTasks.length > 0) {
          console.log("📋 Sample pending task:", JSON.stringify(pendingTasks[0], null, 2));
        }
      }

      // Fetch assigned delivery tasks - simplified query without nested profiles
      const { data: assignedTasks, error: assignedError } = await supabase
        .from("delivery_tasks")
        .select(`
          id,
          order_id,
          vendor_id,
          vendor_location,
          payment_reference,
          pickup_sequence,
          status,
          pickup_address,
          delivery_address,
          delivery_phone,
          created_at,
          assigned_at,
          picked_up_at,
          delivered_at,
          orders(
            delivery_city,
            delivery_state,
            delivery_zone,
            delivery_address_line_1,
            delivery_address,
            delivery_postal_code,
            delivery_phone,
            delivery_phone_number,
            special_instructions,
            total_price,
            delivery_charge,
            payment_reference,
            quantity,
            user_id
          )
        `)
        .eq("rider_id", user.id)
        .order("created_at", { ascending: false });

      if (assignedError) {
        console.error("❌ Error fetching assigned tasks:", assignedError);
      } else {
        console.log("✅ Assigned tasks fetched:", assignedTasks?.length || 0);
        if (assignedTasks && assignedTasks.length > 0) {
          console.log("📋 Sample assigned task:", JSON.stringify(assignedTasks[0], null, 2));
        }
      }

      const pendingTaskRows = (pendingTasks || []) as DeliveryTaskRow[];
      const assignedTaskRows = (assignedTasks || []) as DeliveryTaskRow[];

      // Get unique vendor IDs and customer user IDs to fetch details
      const allVendorIds = [
        ...pendingTaskRows.map((task) => task.vendor_id),
        ...assignedTaskRows.map((task) => task.vendor_id),
      ].filter(Boolean);

      // Extract customer user IDs from orders - handle both array and single order cases
      const extractCustomerUserIds = (tasks: DeliveryTaskRow[]) => {
        return tasks
          .map((task) => {
            if (task.orders) {
              if (Array.isArray(task.orders)) {
                return task.orders.map((order) => order.user_id).filter(Boolean);
              }
              return task.orders.user_id;
            }
            return null;
          })
          .filter(Boolean)
          .flat();
      };

      const allCustomerUserIds = [
        ...extractCustomerUserIds(pendingTaskRows),
        ...extractCustomerUserIds(assignedTaskRows),
      ].filter(Boolean);

      console.log("🔍 Vendor IDs to fetch:", allVendorIds);
      console.log("🔍 Customer User IDs to fetch:", allCustomerUserIds);
      
      // Debug: Log sample task structure
      if (pendingTasks && pendingTasks.length > 0) {
        console.log("📋 Sample pending task orders:", pendingTasks[0]?.orders);
      }
      if (assignedTasks && assignedTasks.length > 0) {
        console.log("📋 Sample assigned task orders:", assignedTasks[0]?.orders);
      }

      // Fetch vendor details from vendors table
      const vendorDetailsMap = new Map<string, { name: string; address: string | null; phone: string | null }>();
      if (allVendorIds.length > 0) {
        const uniqueVendorIds = [...new Set(allVendorIds)];
        uniqueVendorIds.forEach((vendorId) => {
          vendorDetailsMap.set(vendorId, {
            name: "Vendor",
            address: null,
            phone: null,
          });
        });
        const { data: vendorProfiles, error: vendorProfilesError } = await supabase
          .from("profiles")
          .select("id, name, phone_number")
          .in("id", uniqueVendorIds);

        if (vendorProfilesError) {
          console.error("❌ Error fetching vendor profiles:", vendorProfilesError);
        }

        const { data: vendorDataByProfile, error: vendorDataError } = await supabase
          .from("vendors")
          .select("profile_id, business_name, name, address, phone_number, location")
          .in("profile_id", uniqueVendorIds);

        if (vendorDataError) {
          console.error("❌ Error fetching vendor data:", vendorDataError);
        }

        const { data: vendorDataById, error: vendorDataByIdError } = await supabase
          .from("vendors")
          .select("id, profile_id, business_name, name, address, phone_number, location")
          .in("id", uniqueVendorIds);

        if (vendorDataByIdError) {
          console.error("❌ Error fetching vendor data by id:", vendorDataByIdError);
        }

        const vendorDataCombined = [
          ...(vendorDataByProfile || []),
          ...(vendorDataById || []),
        ] as VendorRow[];

        console.log("✅ Vendor profiles:", vendorProfiles?.length || 0);
        console.log("✅ Vendor data:", vendorDataCombined.length || 0);

        // Create map of vendor details (ensure vendors table data is not dropped)
        vendorDataCombined.forEach((vendor) => {
          const key = vendor.profile_id || vendor.id;
          if (!key) return;
          vendorDetailsMap.set(key, {
            name: vendor.business_name || vendor.name || "Vendor",
            address: vendor.address || vendor.location || null,
            phone: vendor.phone_number ? String(vendor.phone_number) : null,
          });
        });

        (vendorProfiles as VendorProfileRow[] | null)?.forEach((profile) => {
          const existing = vendorDetailsMap.get(profile.id) || {
            name: "Vendor",
            address: null,
            phone: null,
          };
          const vendor = vendorDataCombined.find(
            (candidate) => candidate.profile_id === profile.id || candidate.id === profile.id
          );
          vendorDetailsMap.set(profile.id, {
            name: vendor?.business_name || vendor?.name || profile.name || existing.name || "Vendor",
            address: vendor?.address || vendor?.location || existing.address || null,
            phone: vendor?.phone_number
              ? String(vendor.phone_number)
              : profile.phone_number
              ? String(profile.phone_number)
              : existing.phone || null,
          });
        });
      }

      // Fetch customer profiles from profiles table using orders.user_id
      // Relationship: orders.user_id → profiles.id
      const customerProfilesMap = new Map<string, { name: string | null; phone: string | null }>();
      if (allCustomerUserIds.length > 0) {
        const uniqueCustomerIds = [...new Set(allCustomerUserIds)].filter(
          (id): id is string => Boolean(id)
        );
        console.log("🔍 Fetching customer profiles from profiles table for user IDs:", uniqueCustomerIds);
        
        const { data: customerProfiles, error: customerProfilesError } = await supabase
          .from("profiles")
          .select("id, name, phone_number")
          .in("id", uniqueCustomerIds);

        if (customerProfilesError) {
          console.error("❌ Error fetching customer profiles from profiles table:", customerProfilesError);
        } else {
          const customerProfileRows: CustomerProfileRow[] = customerProfiles ?? [];
          console.log("✅ Customer profiles fetched from profiles table:", customerProfileRows.length);
          if (customerProfileRows.length > 0) {
            customerProfileRows.forEach((profile: CustomerProfileRow) => {
              // Store customer name from profiles table (orders.user_id → profiles.id)
              // Trim whitespace and use null if empty, fallback to "Customer" happens in mapping
              const customerName = profile.name?.trim() || null;
              customerProfilesMap.set(profile.id, {
                name: customerName,
                phone: profile.phone_number || null,
              });
              if (customerName) {
                console.log(`✅ Mapped customer from profiles table: ${profile.id} → ${customerName}`);
              } else {
                console.log(`ℹ️ Customer profile ${profile.id} exists but has no name field, will use fallback`);
              }
            });
          }
          
          // Log any missing profiles
          const fetchedIds = new Set(customerProfileRows.map((p: CustomerProfileRow) => p.id));
          const missingIds = uniqueCustomerIds.filter(id => !fetchedIds.has(id));
          if (missingIds.length > 0) {
            console.warn("⚠️ Customer profiles not found for user IDs:", missingIds);
          }
        }
      }

      // Helper function to map task data
      const mapTaskData = (task: DeliveryTaskRow, isPending = false) => {
        const vendorDetails = vendorDetailsMap.get(task.vendor_id) || {
          name: "Vendor",
          address: task.pickup_address || null,
          phone: null,
        };

        const orderData = Array.isArray(task.orders) ? task.orders[0] : task.orders;
        const orderUserId = orderData?.user_id;
        
        // Get customer profile from profiles table via orders.user_id → profiles.id
        const customerProfile = orderUserId ? customerProfilesMap.get(orderUserId) : null;
        
        // Customer name from profiles table, fallback to "Customer" if not found
        const customerName = customerProfile?.name || "Customer";

        // Get delivery address - try multiple sources
        const deliveryAddress = 
          task.delivery_address || 
          orderData?.delivery_address_line_1 || 
          orderData?.delivery_address || 
          "Address not provided";

        // Get customer phone - try multiple sources
        const customerPhone = 
          customerProfile?.phone || 
          task.delivery_phone || 
          orderData?.delivery_phone || 
          orderData?.delivery_phone_number || 
          "N/A";

        // Get pickup address - prefer vendor address, fallback to task pickup_address
        const pickupAddress = 
          vendorDetails.address || 
          task.pickup_address || 
          "Pickup address not provided";

        const mappedTask = {
          id: task.id,
          order_id: task.order_id,
          status: task.status,
          payment_reference: task.payment_reference || null,
          pickup_sequence: task.pickup_sequence ?? null,
          pickup_address: pickupAddress,
          delivery_address: deliveryAddress,
          delivery_city: orderData?.delivery_city || null,
          delivery_state: orderData?.delivery_state || null,
          delivery_zone: orderData?.delivery_zone || null,
          delivery_phone: customerPhone,
          special_instructions: orderData?.special_instructions || null,
          customer_name: customerName,
          customer_phone: customerPhone,
          vendor_name: vendorDetails.name,
          vendor_phone: vendorDetails.phone,
          vendor_address: vendorDetails.address || task.pickup_address || null,
          vendor_instructions: null,
          created_at: task.created_at,
          assigned_at: isPending ? null : task.assigned_at,
          picked_up_at: isPending ? null : task.picked_up_at,
          delivered_at: isPending ? null : task.delivered_at,
        };

        console.log("📦 Mapped task:", {
          id: mappedTask.id,
          vendor_name: mappedTask.vendor_name,
          customer_name: mappedTask.customer_name || "NOT FOUND",
          has_pickup: !!mappedTask.pickup_address,
          has_delivery: !!mappedTask.delivery_address,
          order_user_id: orderUserId,
          has_customer_profile: !!customerProfile,
          customer_profile_name: customerProfile?.name || "N/A",
        });

        return mappedTask;
      };

      // Combine pending and assigned tasks with vendor details
      const allTasks = [
        ...pendingTaskRows.map((task) => mapTaskData(task, true)),
        ...assignedTaskRows.map((task) => mapTaskData(task, false)),
      ];

      const groupCounts = new Map<string, number>();
      allTasks.forEach((task) => {
        if (task.payment_reference) {
          groupCounts.set(task.payment_reference, (groupCounts.get(task.payment_reference) || 0) + 1);
        }
      });

      const tasksWithStops = allTasks.map((task) => ({
        ...task,
        total_stops: task.payment_reference ? groupCounts.get(task.payment_reference) || 1 : 1,
      }));

      console.log("✅ Total tasks mapped:", allTasks.length);
      console.log("📊 Tasks summary:", {
        total: allTasks.length,
        pending: allTasks.filter(t => t.status === "Pending").length,
        assigned: allTasks.filter(t => t.status === "Assigned").length,
        pickedUp: allTasks.filter(t => t.status === "PickedUp").length,
        delivered: allTasks.filter(t => t.status === "Delivered").length,
      });

      if (allTasks.length > 0) {
        console.log("📦 First task details:", {
          id: allTasks[0].id,
          status: allTasks[0].status,
          vendor_name: allTasks[0].vendor_name,
          vendor_phone: allTasks[0].vendor_phone,
          vendor_address: allTasks[0].vendor_address,
          customer_name: allTasks[0].customer_name,
          customer_phone: allTasks[0].customer_phone,
          delivery_address: allTasks[0].delivery_address,
        });
      }

      setTasks(tasksWithStops);
    } catch (error) {
      console.error("❌ Error fetching tasks:", error);
      setTasks([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptTask = async (taskId: string) => {
    if (updating === taskId) return; // Prevent double submission
    setUpdating(taskId);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        alert("You must be logged in to accept tasks");
        return;
      }

      // Call API to accept delivery task
      const response = await fetch("/api/rider/delivery-tasks/accept", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          deliveryTaskId: taskId,
          riderId: user.id,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to accept delivery task");
      }

      // Refresh tasks to show updated status
      await fetchTasks();
    } catch (error) {
      console.error("Error accepting task:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to accept task";
      alert(errorMessage);
    } finally {
      setUpdating(null);
    }
  };

  const handleMarkPickedUp = async (taskId: string) => {
    if (updating === taskId) return; // Prevent double submission
    setUpdating(taskId);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        alert("You must be logged in");
        return;
      }

      // Call API to update delivery task status
      const response = await fetch("/api/rider/delivery-tasks/update-status", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          deliveryTaskId: taskId,
          newStatus: "PickedUp",
          riderId: user.id,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to update status");
      }

      // Refresh tasks to show updated status
      await fetchTasks();
    } catch (error) {
      console.error("Error marking as picked up:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to update status";
      alert(errorMessage);
    } finally {
      setUpdating(null);
    }
  };

  const handleMarkDelivered = async (taskId: string) => {
    if (updating === taskId) return; // Prevent double submission
    setUpdating(taskId);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        alert("You must be logged in");
        return;
      }

      // Call API to update delivery task status to Delivered
      const response = await fetch("/api/rider/delivery-tasks/update-status", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          deliveryTaskId: taskId,
          newStatus: "Delivered",
          riderId: user.id,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to mark as delivered");
      }

      // Refresh tasks to show updated status
      await fetchTasks();
    } catch (error) {
      console.error("Error marking as delivered:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to update status";
      alert(errorMessage);
    } finally {
      setUpdating(null);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; className: string; icon: React.ReactNode }> = {
      Pending: { 
        label: "Pending", 
        className: "bg-yellow-100 text-yellow-800 border-yellow-300",
        icon: <Clock className="h-4 w-4" />
      },
      Assigned: { 
        label: "Accepted", 
        className: "bg-blue-100 text-blue-800 border-blue-300",
        icon: <CheckCircle className="h-4 w-4" />
      },
      PickedUp: { 
        label: "Picked Up", 
        className: "bg-orange-100 text-orange-800 border-orange-300",
        icon: <Package className="h-4 w-4" />
      },
      Delivered: { 
        label: "Delivered", 
        className: "bg-green-100 text-green-800 border-green-300",
        icon: <CheckCircle className="h-4 w-4" />
      },
    };

    const statusInfo = statusMap[status] || { 
      label: status, 
      className: "bg-gray-100 text-gray-800 border-gray-300",
      icon: <Clock className="h-4 w-4" />
    };
    return (
      <span className={`px-3 py-1.5 rounded-full text-sm font-semibold flex items-center gap-2 border ${statusInfo.className}`}>
        {statusInfo.icon}
        {statusInfo.label}
      </span>
    );
  };

  const filteredTasks = tasks.filter((task) => {
    if (filter === "all") return true;
    if (filter === "pending") return task.status === "Pending";
    if (filter === "in_progress") return task.status === "Assigned" || task.status === "PickedUp";
    if (filter === "completed") return task.status === "Delivered";
    return true;
  });
  
  const sortedTasks = [...filteredTasks].sort((a, b) => {
    if (a.payment_reference && b.payment_reference && a.payment_reference === b.payment_reference) {
      const seqA = a.pickup_sequence ?? Number.MAX_SAFE_INTEGER;
      const seqB = b.pickup_sequence ?? Number.MAX_SAFE_INTEGER;
      return seqA - seqB;
    }
    return dayjs(b.created_at).valueOf() - dayjs(a.created_at).valueOf();
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="animate-spin text-indigo-600 h-8 w-8" />
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Delivery Tasks</h1>
          <p className="text-gray-600 mt-1 text-sm md:text-base">Manage your assigned deliveries</p>
        </div>
        {/* Filter Buttons - Mobile optimized */}
        <div className="flex gap-2 flex-wrap">
          <Button
            variant={filter === "all" ? "default" : "outline"}
            onClick={() => setFilter("all")}
            size="sm"
            className="text-xs sm:text-sm"
          >
            All
          </Button>
          <Button
            variant={filter === "pending" ? "default" : "outline"}
            onClick={() => setFilter("pending")}
            size="sm"
            className="text-xs sm:text-sm"
          >
            Pending
          </Button>
          <Button
            variant={filter === "in_progress" ? "default" : "outline"}
            onClick={() => setFilter("in_progress")}
            size="sm"
            className="text-xs sm:text-sm"
          >
            In Progress
          </Button>
          <Button
            variant={filter === "completed" ? "default" : "outline"}
            onClick={() => setFilter("completed")}
            size="sm"
            className="text-xs sm:text-sm"
          >
            Completed
          </Button>
        </div>
      </div>

      {/* Debug info - remove in production */}
      {process.env.NODE_ENV === "development" && (
        <Card className="bg-gray-50 border-gray-200">
          <CardContent className="p-4">
            <p className="text-xs text-gray-600">
              <strong>Debug:</strong> Total tasks: {tasks.length} | Filtered: {filteredTasks.length} | Filter: {filter}
            </p>
          </CardContent>
        </Card>
      )}

      {sortedTasks.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 font-medium">No tasks found</p>
            <p className="text-sm text-gray-500 mt-2">
              {filter === "all"
                ? tasks.length === 0
                  ? "You do not have any tasks available yet. Tasks will appear here when vendors request deliveries."
                  : `You have ${tasks.length} task(s) but none match the ${filter.replace("_", " ")} filter.`
                : `No ${filter.replace("_", " ")} tasks at the moment.`}
            </p>
            {tasks.length > 0 && (
              <p className="text-xs text-gray-400 mt-2">
                Try selecting &quot;All&quot; to see all available tasks.
              </p>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:gap-6">
          {sortedTasks.map((task) => {
            return (
              <Card key={task.id} className="overflow-hidden border-2 border-gray-200 hover:border-indigo-300 transition-colors shadow-sm">
                {/* Task Status Header - Prominent */}
                <div className={`px-4 md:px-6 py-4 border-b-2 ${
                  task.status === "Pending" ? "bg-gradient-to-r from-yellow-50 to-yellow-100 border-yellow-300" :
                  task.status === "Assigned" ? "bg-gradient-to-r from-blue-50 to-blue-100 border-blue-300" :
                  task.status === "PickedUp" ? "bg-gradient-to-r from-orange-50 to-orange-100 border-orange-300" :
                  task.status === "Delivered" ? "bg-gradient-to-r from-green-50 to-green-100 border-green-300" :
                  "bg-gray-50 border-gray-200"
                }`}>
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${
                        task.status === "Pending" ? "bg-yellow-200" :
                        task.status === "Assigned" ? "bg-blue-200" :
                        task.status === "PickedUp" ? "bg-orange-200" :
                        task.status === "Delivered" ? "bg-green-200" :
                        "bg-gray-200"
                      }`}>
                        <Truck className={`h-5 w-5 md:h-6 md:w-6 ${
                          task.status === "Pending" ? "text-yellow-700" :
                          task.status === "Assigned" ? "text-blue-700" :
                          task.status === "PickedUp" ? "text-orange-700" :
                          task.status === "Delivered" ? "text-green-700" :
                          "text-gray-700"
                        }`} />
                      </div>
                      <div>
                        <h3 className="font-bold text-base md:text-lg text-gray-900">
                          Task #{task.id.substring(0, 8).toUpperCase()}
                        </h3>
                        <p className="text-xs md:text-sm text-gray-600">
                          {task.assigned_at 
                            ? `Assigned ${dayjs(task.assigned_at).fromNow()}`
                            : `Created ${dayjs(task.created_at).fromNow()}`
                          }
                        </p>
                        {task.total_stops && task.total_stops > 1 && (
                          <p className="text-xs md:text-sm text-gray-500">
                            {task.pickup_sequence
                              ? `Stop ${task.pickup_sequence} of ${task.total_stops}`
                              : `Multi-stop delivery (${task.total_stops} stops)`}
                          </p>
                        )}
                      </div>
                    </div>
                    {getStatusBadge(task.status)}
                  </div>
                </div>

                <CardContent className="p-4 md:p-6 space-y-4 md:space-y-6">
                  {/* Pickup Section - Vendor Details */}
                  <Card className="border-2 border-blue-200 bg-blue-50/50 shadow-sm">
                    <CardHeader className="pb-3 px-4 md:px-6 pt-4 md:pt-6">
                      <CardTitle className="text-base md:text-lg flex items-center gap-2 text-blue-900">
                        <Store className="h-5 w-5" />
                        Pickup From
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 px-4 md:px-6 pb-4 md:pb-6">
                      <div>
                        <p className="text-xs md:text-sm font-semibold text-gray-700 mb-1">Vendor Name</p>
                        <p className="text-sm md:text-base font-medium text-gray-900">
                          {task.vendor_name || "Vendor Name Not Available"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs md:text-sm font-semibold text-gray-700 mb-1 flex items-center gap-1">
                          <MapPin className="h-4 w-4" />
                          Pickup Address
                        </p>
                        <p className="text-sm md:text-base text-gray-900 leading-relaxed">
                          {task.pickup_address || task.vendor_address || "Pickup address not available"}
                        </p>
                      </div>
                      {(task.vendor_phone || task.vendor_address) && (
                        <div>
                          <p className="text-xs md:text-sm font-semibold text-gray-700 mb-1">Vendor Contact</p>
                          {task.vendor_phone ? (
                            <a 
                              href={`tel:${task.vendor_phone}`}
                              className="flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium text-sm md:text-base transition-colors"
                            >
                              <Phone className="h-4 w-4" />
                              {task.vendor_phone}
                            </a>
                          ) : (
                            <p className="text-sm text-gray-500">Phone number not available</p>
                          )}
                        </div>
                      )}
                      {task.vendor_instructions && (
                        <div className="mt-3 pt-3 border-t border-blue-200">
                          <p className="text-xs md:text-sm font-semibold text-gray-700 mb-1 flex items-center gap-1">
                            <FileText className="h-4 w-4" />
                            Vendor Instructions
                          </p>
                          <p className="text-sm md:text-base text-gray-900 bg-white p-3 rounded-lg border border-blue-200">
                            {task.vendor_instructions}
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Delivery Section - Customer Details */}
                  <Card className="border-2 border-green-200 bg-green-50/50 shadow-sm">
                    <CardHeader className="pb-3 px-4 md:px-6 pt-4 md:pt-6">
                      <CardTitle className="text-base md:text-lg flex items-center gap-2 text-green-900">
                        <Navigation className="h-5 w-5" />
                        Deliver To
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 px-4 md:px-6 pb-4 md:pb-6">
                      <div>
                        <p className="text-xs md:text-sm font-semibold text-gray-700 mb-1">Customer Name</p>
                        <p className="text-sm md:text-base font-medium text-gray-900 flex items-center gap-2">
                          <User className="h-4 w-4 text-gray-500" />
                          {task.customer_name}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs md:text-sm font-semibold text-gray-700 mb-1 flex items-center gap-1">
                          <MapPin className="h-4 w-4" />
                          Delivery Address
                        </p>
                        <p className="text-sm md:text-base text-gray-900 leading-relaxed">
                          {task.delivery_address || "Delivery address not available"}
                        </p>
                        {(task.delivery_city || task.delivery_state) && (
                          <p className="text-xs md:text-sm text-gray-600 mt-1">
                            {[task.delivery_city, task.delivery_state].filter(Boolean).join(", ")}
                            {task.delivery_zone && ` • Zone: ${task.delivery_zone}`}
                          </p>
                        )}
                      </div>
                      <div>
                        <p className="text-xs md:text-sm font-semibold text-gray-700 mb-1">Customer Phone</p>
                        {task.customer_phone && task.customer_phone !== "N/A" ? (
                          <a 
                            href={`tel:${task.customer_phone}`}
                            className="flex items-center gap-2 text-green-600 hover:text-green-700 font-medium text-sm md:text-base transition-colors"
                          >
                            <Phone className="h-4 w-4" />
                            {task.customer_phone}
                          </a>
                        ) : (
                          <p className="text-sm text-gray-500">Phone number not available</p>
                        )}
                      </div>
                      {task.special_instructions && (
                        <div className="mt-3 pt-3 border-t border-green-200">
                          <p className="text-xs md:text-sm font-semibold text-gray-700 mb-1 flex items-center gap-1">
                            <FileText className="h-4 w-4" />
                            Delivery Instructions
                          </p>
                          <p className="text-sm md:text-base text-gray-900 bg-white p-3 rounded-lg border border-green-200">
                            {task.special_instructions}
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Task Timeline / Activity Log */}
                  {(task.assigned_at || task.picked_up_at || task.delivered_at) && (
                    <div className="border-t pt-4">
                      <p className="text-sm font-semibold text-gray-700 mb-3">Task Timeline</p>
                      <div className="space-y-2">
                        {task.assigned_at && (
                          <div className="flex items-center gap-2 text-sm">
                            <CheckCircle className="h-4 w-4 text-blue-600 flex-shrink-0" />
                            <span className="text-gray-600">Accepted</span>
                            <span className="text-gray-400">•</span>
                            <span className="text-gray-500">{dayjs(task.assigned_at).format("MMM DD, hh:mm A")}</span>
                          </div>
                        )}
                        {task.picked_up_at && (
                          <div className="flex items-center gap-2 text-sm">
                            <Package className="h-4 w-4 text-orange-600 flex-shrink-0" />
                            <span className="text-gray-600">Picked Up</span>
                            <span className="text-gray-400">•</span>
                            <span className="text-gray-500">{dayjs(task.picked_up_at).format("MMM DD, hh:mm A")}</span>
                          </div>
                        )}
                        {task.delivered_at && (
                          <div className="flex items-center gap-2 text-sm">
                            <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0" />
                            <span className="text-gray-600">Delivered</span>
                            <span className="text-gray-400">•</span>
                            <span className="text-gray-500">{dayjs(task.delivered_at).format("MMM DD, hh:mm A")}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Task Action Buttons - Conditional based on status */}
                  <div className="pt-4 border-t">
                    {task.status.toLowerCase() === "pending" && (
                      <Button
                        onClick={() => handleAcceptTask(task.id)}
                        disabled={updating === task.id}
                        className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-6 text-base md:text-lg shadow-md hover:shadow-lg transition-all"
                        size="lg"
                      >
                        {updating === task.id ? (
                          <>
                            <Loader2 className="h-5 w-5 animate-spin mr-2" />
                            Accepting...
                          </>
                        ) : (
                          <>
                            <CheckCircle className="h-5 w-5 mr-2" />
                            Accept Task
                          </>
                        )}
                      </Button>
                    )}
                    {task.status.toLowerCase() === "assigned" && (
                      <Button
                        onClick={() => handleMarkPickedUp(task.id)}
                        disabled={updating === task.id}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-6 text-base md:text-lg shadow-md hover:shadow-lg transition-all"
                        size="lg"
                      >
                        {updating === task.id ? (
                          <>
                            <Loader2 className="h-5 w-5 animate-spin mr-2" />
                            Updating...
                          </>
                        ) : (
                          <>
                            <Package className="h-5 w-5 mr-2" />
                            Mark as Picked Up
                          </>
                        )}
                      </Button>
                    )}
                    {task.status.toLowerCase() === "pickedup" && (
                      <Button
                        onClick={() => handleMarkDelivered(task.id)}
                        disabled={updating === task.id}
                        className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-6 text-base md:text-lg shadow-md hover:shadow-lg transition-all"
                        size="lg"
                      >
                        {updating === task.id ? (
                          <>
                            <Loader2 className="h-5 w-5 animate-spin mr-2" />
                            Completing...
                          </>
                        ) : (
                          <>
                            <CheckCircle className="h-5 w-5 mr-2" />
                            Mark as Delivered
                          </>
                        )}
                      </Button>
                    )}
                    {task.status === "Delivered" && (
                      <div className="w-full bg-green-50 border-2 border-green-200 rounded-lg p-4 md:p-6 text-center">
                        <CheckCircle className="h-8 w-8 md:h-10 md:w-10 text-green-600 mx-auto mb-2" />
                        <p className="font-semibold text-green-800 text-base md:text-lg">Delivery Completed</p>
                        <p className="text-xs md:text-sm text-green-600 mt-1">
                          Order #{task.order_id.substring(0, 8)} has been successfully delivered
                        </p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
