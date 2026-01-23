"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Bell, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Notification {
  id: string;
  title?: string;
  message: string;
  type: string;
  read: boolean;
  created_at: string;
  user_id?: string;
  vendor_id?: string;
  metadata?: {
    type?: string;
    order_id?: string;
    customer_name?: string;
    delivery_address?: string;
    delivery_zone?: string;
    [key: string]: unknown;
  };
}

export default function RiderNotificationsPage() {
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [filter, setFilter] = useState<"all" | "unread">("all");

  useEffect(() => {
    fetchNotifications();
    
    // Set up real-time subscription
    const channel = supabase
      .channel("rider-notifications-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
        },
        () => {
          fetchNotifications();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchNotifications = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // For riders, notifications use vendor_id as recipient_id (rider_id)
      // Check both user_id and vendor_id to support both notification schemas
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .or(`user_id.eq.${user.id},vendor_id.eq.${user.id}`)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      setNotifications(data || []);
    } catch (error) {
      console.error("Error fetching notifications:", error);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (notificationId: string) => {
    try {
      const { error } = await supabase
        .from("notifications")
        .update({ read: true })
        .eq("id", notificationId);

      if (error) throw error;
      fetchNotifications();
    } catch (error) {
      console.error("Error marking notification as read:", error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from("notifications")
        .update({ read: true })
        .or(`user_id.eq.${user.id},vendor_id.eq.${user.id}`)
        .eq("read", false);

      if (error) throw error;
      fetchNotifications();
    } catch (error) {
      console.error("Error marking all as read:", error);
    }
  };

  const filteredNotifications = notifications.filter((notif) => {
    if (filter === "all") return true;
    return !notif.read;
  });

  const unreadCount = notifications.filter((n) => !n.read).length;

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
          <h1 className="text-3xl font-bold text-gray-900">Notifications</h1>
          <p className="text-gray-600 mt-2">
            {unreadCount > 0 ? `${unreadCount} unread notification${unreadCount > 1 ? "s" : ""}` : "All caught up!"}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={filter === "all" ? "default" : "outline"}
            onClick={() => setFilter("all")}
          >
            All
          </Button>
          <Button
            variant={filter === "unread" ? "default" : "outline"}
            onClick={() => setFilter("unread")}
          >
            Unread ({unreadCount})
          </Button>
          {unreadCount > 0 && (
            <Button variant="outline" onClick={markAllAsRead}>
              Mark All as Read
            </Button>
          )}
        </div>
      </div>

      {filteredNotifications.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Bell className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">No notifications</p>
            <p className="text-sm text-gray-500 mt-2">
              {filter === "all" ? "You're all caught up!" : "No unread notifications."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredNotifications.map((notif) => (
            <Card
              key={notif.id}
              className={!notif.read ? "border-l-4 border-l-indigo-600 bg-indigo-50/50" : ""}
            >
              <CardContent className="pt-6">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    {notif.title && (
                      <p className="text-gray-900 font-semibold mb-1">{notif.title}</p>
                    )}
                    <p className="text-gray-900 font-medium">{notif.message}</p>
                    {notif.metadata?.order_id && (
                      <p className="text-xs text-indigo-600 mt-1">
                        Order #{notif.metadata.order_id.substring(0, 8)}
                      </p>
                    )}
                    <p className="text-sm text-gray-500 mt-1">
                      {new Date(notif.created_at).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {!notif.read && (
                      <span className="h-2 w-2 bg-indigo-600 rounded-full" />
                    )}
                    {!notif.read && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => markAsRead(notif.id)}
                      >
                        <CheckCircle className="h-4 w-4" />
                      </Button>
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


