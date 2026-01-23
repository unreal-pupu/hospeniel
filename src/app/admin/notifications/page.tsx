"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Send } from "lucide-react";

interface Notification {
  id: string;
  vendor_id: string | null;
  user_id?: string | null;
  message: string;
  type: string;
  read: boolean;
  created_at: string;
  user_profile?: { name?: string; email?: string };
  vendor_profile?: { name?: string; email?: string };
}

export default function AdminNotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [notificationForm, setNotificationForm] = useState({
    message: "",
    type: "system",
    target: "all", // all, vendors, users
  });

  useEffect(() => {
    fetchNotifications();
    const intervalId = setInterval(fetchNotifications, 15000);

    return () => {
      clearInterval(intervalId);
    };
  }, []);

  const fetchNotifications = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setNotifications([]);
        return;
      }

      const response = await fetch("/api/admin/notifications", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        console.error("Error fetching notifications:", await response.text());
        setNotifications([]);
        return;
      }

      const data = await response.json();
      setNotifications(data.notifications || []);
    } catch (error) {
      console.error("Error fetching notifications:", error);
    } finally {
      setLoading(false);
    }
  };

  const sendNotification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!notificationForm.message.trim()) {
      alert("Please enter a message");
      return;
    }

    setSending(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const response = await fetch("/api/admin/notifications", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(notificationForm),
      });

      if (!response.ok) {
        console.error("Send notifications error:", await response.text());
        throw new Error("Failed to send notifications");
      }

      alert("Notifications sent successfully!");
      setNotificationForm({ message: "", type: "system", target: "all" });
      fetchNotifications();
    } catch (error) {
      console.error("Error sending notification:", error);
      alert("Failed to send notifications");
    } finally {
      setSending(false);
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
        <h1 className="text-3xl font-bold text-gray-900">Notifications</h1>
        <p className="text-gray-600 mt-2">Send platform-wide notifications</p>
      </div>

      {/* Send Notification Form */}
      <Card>
        <CardHeader>
          <CardTitle>Send Notification</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={sendNotification} className="space-y-4">
            <div>
              <Label htmlFor="message">Message</Label>
              <Input
                id="message"
                value={notificationForm.message}
                onChange={(e) =>
                  setNotificationForm({ ...notificationForm, message: e.target.value })
                }
                placeholder="Enter notification message..."
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="type">Type</Label>
                <Select
                  value={notificationForm.type}
                  onValueChange={(value) =>
                    setNotificationForm({ ...notificationForm, type: value })
                  }
                >
                  <SelectTrigger id="type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="system">System</SelectItem>
                    <SelectItem value="order_update">Order Update</SelectItem>
                    <SelectItem value="payment">Payment</SelectItem>
                    <SelectItem value="subscription">Subscription</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="target">Target</Label>
                <Select
                  value={notificationForm.target}
                  onValueChange={(value) =>
                    setNotificationForm({ ...notificationForm, target: value })
                  }
                >
                  <SelectTrigger id="target">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Users</SelectItem>
                    <SelectItem value="vendors">Vendors Only</SelectItem>
                    <SelectItem value="users">Users Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button type="submit" disabled={sending} className="w-full">
              {sending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Send Notification
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Recent Notifications */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Notifications</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {notifications.length === 0 ? (
              <p className="text-center py-8 text-gray-500">No notifications found</p>
            ) : (
              notifications.map((notification) => (
                <div
                  key={notification.id}
                  className="p-4 border border-gray-200 rounded-lg"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <p className="text-gray-900">{notification.message}</p>
                      <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
                        <span>Type: {notification.type}</span>
                        <span>
                          To: {notification.vendor_profile?.name || notification.user_profile?.name || "Unknown"}
                        </span>
                        <span>
                          {new Date(notification.created_at).toLocaleString()}
                        </span>
                      </div>
                    </div>
                    <span
                      className={`px-2 py-1 rounded-full text-xs ${
                        notification.read
                          ? "bg-gray-100 text-gray-600"
                          : "bg-blue-100 text-blue-800"
                      }`}
                    >
                      {notification.read ? "Read" : "Unread"}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

