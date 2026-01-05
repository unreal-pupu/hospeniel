"use client";

import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { MessageSquare, Send, Clock, CheckCircle, ArrowLeft } from "lucide-react";

interface SupportMessage {
  id: string;
  sender_id: string;
  sender_role: string;
  message: string;
  status: "pending" | "read" | "responded";
  response: string | null;
  responded_at: string | null;
  created_at: string;
}

export default function HelpCenterPage() {
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<"user" | "vendor" | null>(null);
  const [status, setStatus] = useState<{ type: "success" | "error" | null; message: string }>({
    type: null,
    message: "",
  });

  // Fetch user role and messages
  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setStatus({ type: "error", message: "Please login to access the Help Center." });
          setLoading(false);
          return;
        }

        // Get user profile to determine role
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .single();

        if (profile && (profile.role === "user" || profile.role === "vendor")) {
          setUserRole(profile.role);
        } else {
          setStatus({ type: "error", message: "Invalid user role." });
          setLoading(false);
          return;
        }

        // Fetch messages
        await fetchMessages();
      } catch (error) {
        console.error("Error fetching data:", error);
        setStatus({ type: "error", message: "Failed to load messages." });
      } finally {
        setLoading(false);
      }
    };

    fetchData();

    // Set up real-time subscription for new responses
    const subscription = supabase
      .channel("support_messages")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "support_messages",
        },
        () => {
          fetchMessages();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const fetchMessages = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch("/api/support/messages", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setMessages(data.messages || []);
      }
    } catch (error) {
      console.error("Error fetching messages:", error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || !userRole) return;

    setSending(true);
    setStatus({ type: null, message: "" });

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setStatus({ type: "error", message: "Please login to send a message." });
        setSending(false);
        return;
      }

      const response = await fetch("/api/support/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          message: message.trim(),
          sender_role: userRole,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setStatus({ type: "success", message: "Message sent successfully! Our team will respond soon." });
        setMessage("");
        await fetchMessages();
      } else {
        setStatus({ type: "error", message: data.error || "Failed to send message. Please try again." });
      }
    } catch (error) {
      console.error("Error sending message:", error);
      setStatus({ type: "error", message: "An error occurred. Please try again." });
    } finally {
      setSending(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "responded":
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case "read":
        return <Clock className="h-4 w-4 text-blue-600" />;
      default:
        return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "responded":
        return "Responded";
      case "read":
        return "Read";
      default:
        return "Pending";
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-hospineil-base-bg flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-hospineil-primary mx-auto mb-4"></div>
          <p className="text-gray-600 font-body">Loading Help Center...</p>
        </div>
      </div>
    );
  }

  return (
    <section className="min-h-screen bg-hospineil-base-bg py-16 px-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link href="/explore" className="inline-flex items-center gap-2 text-hospineil-primary hover:text-hospineil-accent transition-colors duration-300 mb-4">
            <ArrowLeft className="h-4 w-4" />
            <span className="font-body">Back to Explore</span>
          </Link>
          <h1 className="text-4xl font-header font-bold text-hospineil-primary mb-2">Help Center</h1>
          <p className="text-gray-600 font-body">
            Need help or have a question? Send us a message and our support team will respond promptly.
          </p>
        </div>

        {/* Status Message */}
        {status.message && (
          <div
            className={`mb-6 p-4 rounded-2xl ${
              status.type === "success"
                ? "bg-green-50 text-green-700 border border-green-200"
                : "bg-red-50 text-red-700 border border-red-200"
            }`}
          >
            <p className="font-body">{status.message}</p>
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-6">
          {/* Send Message Form */}
          <Card className="rounded-2xl shadow-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-header">
                <MessageSquare className="h-5 w-5 text-hospineil-primary" />
                Send a Message
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2 font-body">
                    Your Message
                  </label>
                  <Textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Describe your issue or question..."
                    required
                    rows={6}
                    className="bg-hospineil-light-bg border-gray-300 focus:ring-hospineil-primary focus:border-hospineil-primary font-body"
                  />
                </div>

                <Button
                  type="submit"
                  disabled={sending || !message.trim()}
                  className="w-full bg-hospineil-accent text-hospineil-light-bg hover:bg-hospineil-accent-hover transition-all duration-300 hover:scale-105 hover:shadow-lg font-button"
                >
                  {sending ? (
                    <span className="flex items-center gap-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Sending...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <Send className="h-4 w-4" />
                      Send Message
                    </span>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Message History */}
          <Card className="rounded-2xl shadow-md">
            <CardHeader>
              <CardTitle className="font-header">Message History</CardTitle>
            </CardHeader>
            <CardContent>
              {messages.length === 0 ? (
                <div className="text-center py-8">
                  <MessageSquare className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500 font-body">No messages yet. Send your first message above!</p>
                </div>
              ) : (
                <div className="space-y-4 max-h-96 overflow-y-auto">
                  {messages.map((msg) => (
                    <div
                      key={msg.id}
                      className="p-4 bg-hospineil-light-bg rounded-xl border border-gray-200"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {getStatusIcon(msg.status)}
                          <span className="text-xs text-gray-500 font-body">
                            {getStatusText(msg.status)}
                          </span>
                        </div>
                        <span className="text-xs text-gray-500 font-body">
                          {new Date(msg.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-gray-800 font-body mb-3">{msg.message}</p>
                      {msg.response && (
                        <div className="mt-3 pt-3 border-t border-gray-300">
                          <p className="text-sm font-semibold text-hospineil-primary mb-1 font-header">
                            Admin Response:
                          </p>
                          <p className="text-gray-700 font-body">{msg.response}</p>
                          {msg.responded_at && (
                            <p className="text-xs text-gray-500 mt-2 font-body">
                              {new Date(msg.responded_at).toLocaleString()}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}
