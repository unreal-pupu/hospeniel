"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Loader2, Send, Mail, MessageSquare, HelpCircle, Phone, Clock, CheckCircle } from "lucide-react";

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

export default function RiderSupportPage() {
  const [loading, setLoading] = useState(false);
  const [messagesLoading, setMessagesLoading] = useState(true);
  const [formData, setFormData] = useState({
    subject: "",
    message: "",
  });
  const [submitted, setSubmitted] = useState(false);
  const [messages, setMessages] = useState<SupportMessage[]>([]);

  // Fetch messages on component mount and set up real-time subscription
  useEffect(() => {
    const fetchData = async () => {
      try {
        await fetchMessages();
      } catch (error) {
        console.error("Error fetching messages:", error);
      } finally {
        setMessagesLoading(false);
      }
    };

    fetchData();

    // Set up real-time subscription for new responses
    const subscription = supabase
      .channel("support_messages_rider")
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
        // Sort messages by created_at in descending order (newest first)
        const sortedMessages = (data.messages || []).sort((a: SupportMessage, b: SupportMessage) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        setMessages(sortedMessages);
      }
    } catch (error) {
      console.error("Error fetching messages:", error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        alert("Please log in to send a support message");
        setLoading(false);
        return;
      }

      // Format message with subject
      const fullMessage = formData.subject 
        ? `Subject: ${formData.subject}\n\n${formData.message}`
        : formData.message;

      // Use API route to send message
      const response = await fetch("/api/support/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          message: fullMessage,
          sender_role: "rider",
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error("API error response:", data);
        throw new Error(data.error || data.details || "Failed to send message");
      }

      console.log("Message sent successfully:", data);
      setSubmitted(true);
      setFormData({ subject: "", message: "" });
      setTimeout(() => setSubmitted(false), 5000);
      
      // Refresh messages to show the new one
      await fetchMessages();
    } catch (error) {
      console.error("Error sending support message:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to send message. Please try again.";
      alert(errorMessage);
    } finally {
      setLoading(false);
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Support & Contact</h1>
        <p className="text-gray-600 mt-2">Get help or contact the admin team</p>
      </div>

      {submitted && (
        <Card className="bg-green-50 border-green-200">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-green-600" />
              <p className="text-green-800">
                Your message has been sent successfully! We will get back to you soon.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Contact Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm font-medium text-gray-700">Email Support</p>
              <p className="text-gray-600">support@hospeniel.com</p>
              <p className="text-xs text-gray-500 mt-1">Responses available 24/7</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700 flex items-center gap-2">
                <Phone className="h-4 w-4" />
                Phone Support
              </p>
              <a 
                href="tel:+2348162813032" 
                className="text-blue-600 hover:text-blue-700 font-medium"
              >
                +234 816 281 3032
              </a>
              <p className="text-xs text-gray-500 mt-1">Available from 9am to 5pm</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <HelpCircle className="h-5 w-5" />
              Common Questions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm font-medium text-gray-700">How do I accept a delivery task?</p>
              <p className="text-sm text-gray-600">
                Go to the Tasks page and click &quot;Accept Task&quot; on any pending delivery.
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700">How do I update my availability?</p>
              <p className="text-sm text-gray-600">
                Go to Settings and toggle your availability status.
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700">When will I receive payment?</p>
              <p className="text-sm text-gray-600">
                Payments are processed weekly. Contact support for payment inquiries.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Send Message Form */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Send a Message
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="subject">Subject</Label>
                <Input
                  id="subject"
                  value={formData.subject}
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  placeholder="What is your message about?"
                  required
                />
              </div>

              <div>
                <Label htmlFor="message">Message</Label>
                <Textarea
                  id="message"
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  placeholder="Describe your issue or question..."
                  rows={6}
                  required
                />
              </div>

              <Button type="submit" disabled={loading} className="bg-indigo-600 hover:bg-indigo-700 w-full">
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Send Message
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Message History */}
        <Card>
          <CardHeader>
            <CardTitle>Message History</CardTitle>
          </CardHeader>
          <CardContent>
            {messagesLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
              </div>
            ) : messages.length === 0 ? (
              <div className="text-center py-8">
                <MessageSquare className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">No messages yet. Send your first message above!</p>
              </div>
            ) : (
              <div className="space-y-4 max-h-[600px] overflow-y-auto">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className="p-4 bg-gray-50 rounded-xl border border-gray-200"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(msg.status)}
                        <span className="text-xs text-gray-500">
                          {getStatusText(msg.status)}
                        </span>
                      </div>
                      <span className="text-xs text-gray-500">
                        {new Date(msg.created_at).toLocaleDateString()} {new Date(msg.created_at).toLocaleTimeString()}
                      </span>
                    </div>
                    <p className="text-gray-800 mb-3 whitespace-pre-wrap">{msg.message}</p>
                    {msg.response && (
                      <div className="mt-3 pt-3 border-t border-gray-300">
                        <p className="text-sm font-semibold text-indigo-600 mb-1">
                          Admin Response:
                        </p>
                        <p className="text-gray-700 whitespace-pre-wrap">{msg.response}</p>
                        {msg.responded_at && (
                          <p className="text-xs text-gray-500 mt-2">
                            {new Date(msg.responded_at).toLocaleDateString()} {new Date(msg.responded_at).toLocaleTimeString()}
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
  );
}






