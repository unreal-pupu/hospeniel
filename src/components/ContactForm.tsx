"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export default function ContactForm() {
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    mobile: "",
    details: "",
  });
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ type: "success" | "error" | null; message: string }>({
    type: null,
    message: "",
  });

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setStatus({ type: null, message: "" });

    try {
      // Insert into contact_messages table
      const { error } = await supabase.from("contact_messages").insert([
        {
          full_name: formData.fullName,
          email: formData.email,
          mobile: formData.mobile,
          details: formData.details,
          created_at: new Date().toISOString(),
        },
      ]);

      if (error) {
        console.error("Error sending message:", error);
        setStatus({
          type: "error",
          message: "Failed to send message. Please try again.",
        });
      } else {
        setStatus({
          type: "success",
          message: "Message sent successfully! We'll get back to you soon.",
        });
        // Reset form
        setFormData({
          fullName: "",
          email: "",
          mobile: "",
          details: "",
        });
      }
    } catch (err) {
      console.error("Unexpected error:", err);
      setStatus({
        type: "error",
        message: "An unexpected error occurred. Please try again.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <section id="contact" className="py-16 px-6 bg-hospineil-base-bg">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-4xl md:text-5xl font-header italic tracking-wide capitalize mb-4">
            Get In Touch
          </h2>
          <p className="text-lg text-gray-800 font-body">
            Have a question or want to reach out? Send us a message and we'll respond as soon as possible.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 bg-hospineil-light-bg p-8 rounded-2xl shadow-md">
          <div>
            <label htmlFor="fullName" className="block text-sm font-semibold text-gray-800 mb-2 font-body">
              Full Name
            </label>
            <Input
              type="text"
              id="fullName"
              name="fullName"
              value={formData.fullName}
              onChange={handleChange}
              placeholder="Enter your full name"
              required
              className="bg-white border-gray-300 focus:ring-hospineil-primary focus:border-hospineil-primary"
            />
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-semibold text-gray-800 mb-2 font-body">
              Email
            </label>
            <Input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="Enter your email address"
              required
              className="bg-white border-gray-300 focus:ring-hospineil-primary focus:border-hospineil-primary"
            />
          </div>

          <div>
            <label htmlFor="mobile" className="block text-sm font-semibold text-gray-800 mb-2 font-body">
              Mobile
            </label>
            <Input
              type="tel"
              id="mobile"
              name="mobile"
              value={formData.mobile}
              onChange={handleChange}
              placeholder="Enter your mobile number"
              required
              className="bg-white border-gray-300 focus:ring-hospineil-primary focus:border-hospineil-primary"
            />
          </div>

          <div>
            <label htmlFor="details" className="block text-sm font-semibold text-gray-800 mb-2 font-body">
              Details
            </label>
            <Textarea
              id="details"
              name="details"
              value={formData.details}
              onChange={handleChange}
              placeholder="Tell us how we can help you..."
              required
              rows={6}
              className="bg-white border-gray-300 focus:ring-hospineil-primary focus:border-hospineil-primary resize-none"
            />
          </div>

          {status.message && (
            <div
              className={`p-4 rounded-lg text-center font-body ${
                status.type === "success"
                  ? "bg-green-50 text-green-700 border border-green-200"
                  : "bg-red-50 text-red-700 border border-red-200"
              }`}
            >
              {status.message}
            </div>
          )}

          <div className="flex justify-center pt-4">
            <Button
              type="submit"
              disabled={loading}
              className="px-8 py-3 rounded-full bg-hospineil-accent text-hospineil-light-bg font-button font-medium hover:bg-hospineil-accent-hover focus:ring-2 focus:ring-hospineil-primary focus:ring-offset-2 shadow-lg transition-all duration-300 hover:scale-105 hover:shadow-xl disabled:bg-hospineil-disabled-bg disabled:text-hospineil-disabled-text disabled:cursor-not-allowed disabled:hover:scale-100"
            >
              {loading ? "Sending..." : "Send"}
            </Button>
          </div>
        </form>
      </div>
    </section>
  );
}

