"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, Loader2 } from "lucide-react";

interface Notification {
  id: string;
  message: string;
  type: string;
  read: boolean;
  created_at: string;
  metadata?: {
    type?: string;
    service_request_id?: string;
    order_id?: string;
    user_id?: string;
    user_name?: string;
    contact_info?: string;
  };
}

export default function VendorNotificationsPage() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [markingAllRead, setMarkingAllRead] = useState(false);

  useEffect(() => {
    let isMounted = true;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const setupNotifications = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/loginpage");
        return;
      }

      if (isMounted) {
        await fetchNotifications();
      }

      if (!isMounted) return;

      channel = supabase
        .channel("vendor-notifications")
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "notifications",
            filter: `vendor_id=eq.${user.id}`,
          },
          (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
            console.log("🔔 Vendor Notifications: Change detected:", payload);
            if (isMounted) {
              // Small delay to ensure database is ready
              setTimeout(() => {
                fetchNotifications();
              }, 500);
            }
          }
        )
        .subscribe();
    };

    setupNotifications();

    return () => {
      isMounted = false;
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [router]);

  const fetchNotifications = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("vendor_id", user.id)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching notifications:", error);
        return;
      }

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

      if (error) {
        console.error("Error marking notification as read:", error);
        return;
      }

      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n))
      );
    } catch (error) {
      console.error("Error marking notification as read:", error);
    }
  };

  const markAllAsRead = async () => {
    setMarkingAllRead(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from("notifications")
        .update({ read: true })
        .eq("vendor_id", user.id)
        .eq("read", false);

      if (error) {
        console.error("Error marking all as read:", error);
        return;
      }

      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch (error) {
      console.error("Error marking all as read:", error);
    } finally {
      setMarkingAllRead(false);
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

  const getTypeColor = (type: string) => {
    switch (type) {
      case "order_update":
        return "bg-blue-100 text-blue-800";
      case "payment":
        return "bg-green-100 text-green-800";
      case "system":
        return "bg-purple-100 text-purple-800";
      case "subscription":
        return "bg-orange-100 text-orange-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  if (loading) {
    return (
      <div className="w-full flex flex-col items-center justify-center min-h-[400px] bg-hospineil-base-bg">
        <Loader2 className="animate-spin text-hospineil-primary h-8 w-8 mb-4" />
        <p className="text-gray-600 font-body">Loading notifications...</p>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="mb-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-hospineil-primary mb-2 font-header">Notifications</h1>
            <p className="text-gray-600 font-body">
              {unreadCount > 0 ? `${unreadCount} unread notification${unreadCount > 1 ? "s" : ""}` : "All caught up!"}
            </p>
          </div>
          {unreadCount > 0 && (
            <Button
              onClick={markAllAsRead}
              disabled={markingAllRead}
              className="bg-hospineil-primary text-white rounded-lg hover:bg-hospineil-primary/90 hover:scale-105 transition-all font-button"
            >
              {markingAllRead ? "Marking..." : "Mark All as Read"}
            </Button>
          )}
        </div>
      </div>

      {notifications.length === 0 ? (
        <div className="bg-hospineil-light-bg rounded-2xl shadow-md p-12 text-center">
          <MessageSquare className="mx-auto h-16 w-16 text-gray-400 mb-4" />
          <p className="text-gray-600 text-lg font-body">No notifications yet</p>
          <p className="text-gray-500 text-sm mt-2 font-body">
            You&apos;ll see notifications about new orders and payments here
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {notifications.map((notification) => (
            <Card
              key={notification.id}
              className={`bg-hospineil-light-bg rounded-2xl shadow-md transition-all hover:shadow-lg hover:scale-105 cursor-pointer border border-gray-200 ${
                !notification.read ? "border-l-4 border-l-hospineil-primary bg-hospineil-primary/5" : ""
              }`}
              onClick={() => {
                if (!notification.read) {
                  markAsRead(notification.id);
                }
                // Navigate to service requests page if it's a service request notification
                if ((notification.metadata?.type === 'service_request' || notification.metadata?.type === 'service_request_paid') && notification.metadata?.service_request_id) {
                  router.push(`/vendor/service-requests?request_id=${notification.metadata.service_request_id}`);
                }
              }}
            >
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  {!notification.read && (
                    <div className="mt-1.5 w-3 h-3 bg-hospineil-primary rounded-full flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge
                        variant="outline"
                        className={`text-xs font-button ${getTypeColor(notification.type)}`}
                      >
                        {notification.type.replace("_", " ")}
                      </Badge>
                      {!notification.read && (
                        <Badge className="text-xs bg-hospineil-accent text-white font-button">
                          New
                        </Badge>
                      )}
                    </div>
                    <p
                      className={`text-base whitespace-pre-wrap font-body ${
                        !notification.read ? "font-semibold text-gray-800" : "text-gray-700"
                      }`}
                    >
                      {notification.message}
                    </p>
                    {notification.metadata?.type === 'service_request' && (
                      <p className="text-xs text-hospineil-primary mt-2 font-medium flex items-center gap-1 font-body">
                        <MessageSquare className="h-3 w-3" />
                        Click to view full request details →
                      </p>
                    )}
                    <p className="text-sm text-gray-600 mt-2 font-body">
                      {formatTimeAgo(notification.created_at)}
                    </p>
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

