"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import {
  MapPin,
  Mail,
  Phone,
  Facebook,
  Twitter,
  Instagram,
  Send,
  Music2,
} from "lucide-react"; 

export default function VendorContactPage() {
  const [form, setForm] = useState({ name: "", email: "", message: "" });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      alert("Please log in to send a message.");
      setLoading(false);
      return;
    }

    const { error } = await supabase.from("vendor_messages").insert([
      {
        vendor_id: user.id,
        name: form.name,
        email: form.email,
        message: form.message,
      },
    ]);

    if (error) {
      alert("Error sending message. Please try again.");
      console.error(error);
    } else {
      alert("Message sent successfully!");
      setForm({ name: "", email: "", message: "" });
    }
    setLoading(false);
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <h2 className="text-2xl font-semibold text-indigo-600 mb-6">Contact Us</h2>

      <div className="bg-white p-6 rounded-lg shadow-md mb-8">
        <h3 className="text-lg font-semibold text-gray-800 mb-3">Get in Touch</h3>
         <p className="text-gray-600 mb-3"> We're glad to have you here! contact us for the best experiences</p>

        <div className="space-y-3 text-gray-700">
          <div className="flex items-center gap-3">
            <MapPin className="text-indigo-600" size={20} />
            <span>123 Hospineil Street, Lagos, Nigeria</span>
          </div>
          <div className="flex items-center gap-3">
            <Phone className="text-indigo-600" size={20} />
            <span>+234 812 345 6789</span>
          </div>
          <div className="flex items-center gap-3">
            <Mail className="text-indigo-600" size={20} />
            <span>support@hospineil.com</span>
          </div>
        </div>

        {/* Social Media */}
        <div className="mt-6">
          <h4 className="text-gray-800 font-semibold mb-2">Follow Us</h4>
         
          <div className="flex gap-5 text-indigo-600">
            <a
              href="https://facebook.com"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-indigo-800"
            >
              <Facebook size={24} />
            </a>
            <a
              href="https://x.com"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-indigo-800"
            >
              <Twitter size={24} />
            </a>
            <a
              href="https://instagram.com"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-indigo-800"
            >
              <Instagram size={24} />
            </a>
            <a
              href="https://tiktok.com"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-indigo-800"
            >
              <Music2 size={24} />
            </a>
          </div>
        </div>
      </div>

      {/* Message Form */}
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">
          Send Us a Message
        </h3>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 max-w-lg">
          <input
            type="text"
            placeholder="Your Name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
            className="border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500"
          />
          <input
            type="email"
            placeholder="Your Email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            required
            className="border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500"
          />
          <textarea
            placeholder="Your Message"
            value={form.message}
            onChange={(e) => setForm({ ...form, message: e.target.value })}
            required
            className="border border-gray-300 rounded-lg p-2 h-32 focus:ring-2 focus:ring-indigo-500"
          />
          <button
            type="submit"
            disabled={loading}
            className={`flex items-center justify-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition ${
              loading ? "opacity-70 cursor-not-allowed" : ""
            }`}
          >
            <Send size={18} /> {loading ? "Sending..." : "Send Message"}
          </button>
        </form>
      </div>
    </div>
  );
}
