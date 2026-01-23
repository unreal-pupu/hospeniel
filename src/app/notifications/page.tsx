"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface Notification {
  id: string;
  message: string;
  type: string;
  read: boolean;
  created_at: string;
}

export default function NotificationsPage() {
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
        .channel("user-notifications")
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "notifications",
            filter: `user_id=eq.${user.id}`,
          },
          (payload) => {
            console.log("🔔 User Notifications: Change detected:", payload);
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
        .eq("user_id", user.id)
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
        .eq("user_id", user.id)
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
      <div className="max-w-4xl mx-auto p-6">
        <div className="text-center py-12">
          <p className="text-gray-500">Loading notifications...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Notifications</h1>
          <p className="text-gray-500 mt-1">
            {unreadCount > 0 ? `${unreadCount} unread notification${unreadCount > 1 ? "s" : ""}` : "All caught up!"}
          </p>
        </div>
        {unreadCount > 0 && (
          <Button
            onClick={markAllAsRead}
            disabled={markingAllRead}
            variant="outline"
            className="rounded-lg"
          >
            {markingAllRead ? "Marking..." : "Mark All as Read"}
          </Button>
        )}
      </div>

      {notifications.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-gray-500 text-lg">No notifications yet</p>
            <p className="text-gray-400 text-sm mt-2">
              You&apos;ll see notifications about your orders and payments here
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {notifications.map((notification) => (
            <Card
              key={notification.id}
              className={`transition-all hover:shadow-md cursor-pointer ${
                !notification.read ? "border-l-4 border-l-indigo-600 bg-indigo-50/30" : ""
              }`}
              onClick={() => !notification.read && markAsRead(notification.id)}
            >
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  {!notification.read && (
                    <div className="mt-1.5 w-3 h-3 bg-indigo-600 rounded-full flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge
                        variant="outline"
                        className={`text-xs ${getTypeColor(notification.type)}`}
                      >
                        {notification.type.replace("_", " ")}
                      </Badge>
                      {!notification.read && (
                        <Badge variant="destructive" className="text-xs">
                          New
                        </Badge>
                      )}
                    </div>
                    <p
                      className={`text-base ${
                        !notification.read ? "font-semibold text-gray-900" : "text-gray-700"
                      }`}
                    >
                      {notification.message}
                    </p>
                    <p className="text-sm text-gray-500 mt-2">
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

