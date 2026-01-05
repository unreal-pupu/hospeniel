"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MessageSquare, Send, Search, Eye, CheckCircle, Clock } from "lucide-react";

interface SupportMessage {
  id: string;
  sender_id: string;
  sender_role: string;
  message: string;
  status: "pending" | "read" | "responded";
  response: string | null;
  responded_at: string | null;
  responded_by: string | null;
  created_at: string;
  sender?: {
    id: string;
    name: string;
    email: string;
  };
  responder?: {
    id: string;
    name: string;
  };
}

export default function AdminSupportPage() {
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMessage, setSelectedMessage] = useState<SupportMessage | null>(null);
  const [response, setResponse] = useState("");
  const [sending, setSending] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "read" | "responded">("all");

  useEffect(() => {
    fetchMessages();

    // Set up real-time subscription
    const subscription = supabase
      .channel("support_messages_admin")
      .on(
        "postgres_changes",
        {
          event: "*",
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
    } finally {
      setLoading(false);
    }
  };

  const handleViewMessage = async (message: SupportMessage) => {
    setSelectedMessage(message);
    setResponse("");

    // Mark as read if pending
    if (message.status === "pending") {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        await fetch(`/api/support/messages/${message.id}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ status: "read" }),
        });

        // Refresh messages
        await fetchMessages();
      } catch (error) {
        console.error("Error updating message status:", error);
      }
    }
  };

  const handleSendResponse = async () => {
    if (!selectedMessage || !response.trim()) return;

    setSending(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch(`/api/support/messages/${selectedMessage.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          response: response.trim(),
          status: "responded",
        }),
      });

      if (res.ok) {
        setResponse("");
        setSelectedMessage(null);
        await fetchMessages();
        alert("Response sent successfully!");
      } else {
        const data = await res.json();
        alert(data.error || "Failed to send response");
      }
    } catch (error) {
      console.error("Error sending response:", error);
      alert("An error occurred. Please try again.");
    } finally {
      setSending(false);
    }
  };

  const filteredMessages = messages.filter((msg) => {
    const matchesSearch = searchTerm === "" || 
      msg.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
      msg.sender?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      msg.sender?.email?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || msg.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "responded":
        return (
          <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-body flex items-center gap-1">
            <CheckCircle className="h-3 w-3" />
            Responded
          </span>
        );
      case "read":
        return (
          <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-body flex items-center gap-1">
            <Eye className="h-3 w-3" />
            Read
          </span>
        );
      default:
        return (
          <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-body flex items-center gap-1">
            <Clock className="h-3 w-3" />
            Pending
          </span>
        );
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-hospineil-primary mx-auto mb-4"></div>
          <p className="text-gray-600 font-body">Loading support messages...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-header font-bold text-hospineil-primary mb-2">Support Messages</h1>
        <p className="text-gray-600 font-body">Manage and respond to user and vendor support messages.</p>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Messages List */}
        <div className="lg:col-span-2 space-y-4">
          {/* Filters */}
          <Card className="rounded-2xl shadow-md">
            <CardContent className="p-4">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <input
                    type="text"
                    placeholder="Search messages..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-hospineil-light-bg border border-gray-300 rounded-xl focus:ring-2 focus:ring-hospineil-primary focus:border-hospineil-primary font-body"
                  />
                </div>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as "all" | "pending" | "read" | "responded")}
                  className="px-4 py-2 bg-hospineil-light-bg border border-gray-300 rounded-xl focus:ring-2 focus:ring-hospineil-primary focus:border-hospineil-primary font-body"
                >
                  <option value="all">All Status</option>
                  <option value="pending">Pending</option>
                  <option value="read">Read</option>
                  <option value="responded">Responded</option>
                </select>
              </div>
            </CardContent>
          </Card>

          {/* Messages */}
          <div className="space-y-4">
            {filteredMessages.length === 0 ? (
              <Card className="rounded-2xl shadow-md">
                <CardContent className="p-8 text-center">
                  <MessageSquare className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500 font-body">No messages found.</p>
                </CardContent>
              </Card>
            ) : (
              filteredMessages.map((msg) => (
                <Card
                  key={msg.id}
                  className={`rounded-2xl shadow-md cursor-pointer transition-all duration-300 hover:shadow-lg ${
                    selectedMessage?.id === msg.id ? "ring-2 ring-hospineil-primary" : ""
                  }`}
                  onClick={() => handleViewMessage(msg)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold text-gray-900 font-header">
                            {msg.sender?.name || "Unknown User"}
                          </span>
                          <span className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded-full font-body">
                            {msg.sender_role}
                          </span>
                          {getStatusBadge(msg.status)}
                        </div>
                        <p className="text-sm text-gray-500 font-body">
                          {msg.sender?.email || "No email"}
                        </p>
                      </div>
                      <span className="text-xs text-gray-500 font-body">
                        {new Date(msg.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-gray-700 font-body line-clamp-2">{msg.message}</p>
                    {msg.response && (
                      <div className="mt-2 pt-2 border-t border-gray-200">
                        <p className="text-xs text-gray-500 font-body">Response provided</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>

        {/* Message Detail & Response */}
        <div className="lg:col-span-1">
          {selectedMessage ? (
            <Card className="rounded-2xl shadow-md sticky top-24">
              <CardHeader>
                <CardTitle className="font-header">Message Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm font-semibold text-gray-700 mb-1 font-body">From:</p>
                  <p className="text-gray-900 font-body">
                    {selectedMessage.sender?.name || "Unknown User"}
                  </p>
                  <p className="text-sm text-gray-500 font-body">
                    {selectedMessage.sender?.email || "No email"}
                  </p>
                  <p className="text-xs text-gray-500 mt-1 font-body">
                    Role: {selectedMessage.sender_role}
                  </p>
                </div>

                <div>
                  <p className="text-sm font-semibold text-gray-700 mb-1 font-body">Message:</p>
                  <p className="text-gray-800 font-body whitespace-pre-wrap">
                    {selectedMessage.message}
                  </p>
                </div>

                {selectedMessage.response && (
                  <div>
                    <p className="text-sm font-semibold text-gray-700 mb-1 font-body">Previous Response:</p>
                    <p className="text-gray-700 font-body whitespace-pre-wrap bg-hospineil-light-bg p-3 rounded-xl">
                      {selectedMessage.response}
                    </p>
                    {selectedMessage.responded_at && (
                      <p className="text-xs text-gray-500 mt-1 font-body">
                        {new Date(selectedMessage.responded_at).toLocaleString()}
                      </p>
                    )}
                  </div>
                )}

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2 font-body">
                    Your Response:
                  </label>
                  <Textarea
                    value={response}
                    onChange={(e) => setResponse(e.target.value)}
                    placeholder="Type your response here..."
                    rows={6}
                    className="bg-hospineil-light-bg border-gray-300 focus:ring-hospineil-primary focus:border-hospineil-primary font-body"
                  />
                </div>

                <Button
                  onClick={handleSendResponse}
                  disabled={sending || !response.trim()}
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
                      Send Response
                    </span>
                  )}
                </Button>

                <Button
                  variant="outline"
                  onClick={() => {
                    setSelectedMessage(null);
                    setResponse("");
                  }}
                  className="w-full font-button"
                >
                  Close
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card className="rounded-2xl shadow-md">
              <CardContent className="p-8 text-center">
                <MessageSquare className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500 font-body">Select a message to view details and respond.</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

