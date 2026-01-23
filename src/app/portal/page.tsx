"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Package, CheckCircle, Clock, AlertCircle } from "lucide-react";

interface TaskStats {
  pending: number;
  in_progress: number;
  completed: number;
  total: number;
}

interface DeliveryTaskRow {
  id: string;
  status: string;
}

export default function RiderDashboard() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<TaskStats>({
    pending: 0,
    in_progress: 0,
    completed: 0,
    total: 0,
  });

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch pending delivery tasks (available for acceptance)
      const { data: pendingTasks } = await supabase
        .from("delivery_tasks")
        .select("id, status")
        .eq("status", "Pending")
        .is("rider_id", null);

      // Fetch assigned delivery tasks (accepted by this rider)
      const { data: assignedTasks } = await supabase
        .from("delivery_tasks")
        .select("id, status")
        .eq("rider_id", user.id);

      const pendingRows: DeliveryTaskRow[] = pendingTasks ?? [];
      const assignedRows: DeliveryTaskRow[] = assignedTasks ?? [];
      const pending = pendingRows.length;
      const inProgress =
        assignedRows.filter(
          (t: DeliveryTaskRow) => t.status === "Assigned" || t.status === "PickedUp"
        ).length || 0;
      const completed =
        assignedRows.filter((t: DeliveryTaskRow) => t.status === "Delivered").length || 0;
      const total = assignedRows.length + pending;

      setStats({
        pending,
        in_progress: inProgress,
        completed,
        total,
      });
    } catch (error) {
      console.error("Error fetching stats:", error);
      setStats({ pending: 0, in_progress: 0, completed: 0, total: 0 });
    } finally {
      setLoading(false);
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
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600 mt-2">Overview of your delivery tasks</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Tasks</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">All assigned deliveries</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <Clock className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
            <p className="text-xs text-muted-foreground">Awaiting pickup</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">In Progress</CardTitle>
            <AlertCircle className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats.in_progress}</div>
            <p className="text-xs text-muted-foreground">Currently delivering</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.completed}</div>
            <p className="text-xs text-muted-foreground">Successfully delivered</p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              View and manage your delivery tasks from the{" "}
              <a href="/portal/tasks" className="text-indigo-600 hover:underline">
                Tasks page
              </a>
              .
            </p>
            <p className="text-sm text-gray-600">
              Check your{" "}
              <a href="/portal/notifications" className="text-indigo-600 hover:underline">
                notifications
              </a>{" "}
              for new assignments and updates.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}



