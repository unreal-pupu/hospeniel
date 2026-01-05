"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import Image from "next/image";

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [user, setUser] = useState<any>(null);

  const [profile, setProfile] = useState({
    username: "",
    phone: "",
    gender: "",
    notifications: true,
    avatar_url: "",
  });

  useEffect(() => {
    const fetchUserData = async () => {
      setLoading(true);

      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        console.error("Auth error:", authError?.message);
        setLoading(false);
        return;
      }

      setUser(user);

      const { data, error } = await supabase
        .from("user_settings")
        .select("username, phone, gender, notifications, avatar_url")
        .eq("user_id", user.id)
        .single();

      if (!error && data) {
        setProfile({
          username: data.username || "",
          phone: data.phone || "",
          gender: data.gender || "",
          notifications: data.notifications ?? true,
          avatar_url: data.avatar_url || "",
        });
      }

      setLoading(false);
    };

    fetchUserData();
  }, []);

 // ✅ Final Fixed Avatar Upload Logic
const handleAvatarUpload = async (event: any) => {
  try {
    setUploading(true);
    const file = event.target.files[0];
    if (!file) return;

    // ✅ Ensure user is authenticated - use getUser() for more reliable auth check
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError) {
      console.error("getUser error:", userError);
      throw new Error(`Authentication error: ${userError.message}`);
    }
    if (!user) {
      console.error("No user found");
      throw new Error("User not authenticated. Please log in again.");
    }

    // ✅ Verify session is still valid and contains access token
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) {
      console.error("Session error:", sessionError);
      throw new Error(`Session error: ${sessionError.message}`);
    }
    if (!session) {
      console.error("No session found");
      throw new Error("No active session found. Please log in again.");
    }
    if (!session.access_token) {
      console.error("Session missing access token");
      throw new Error("Session is invalid. Please log in again.");
    }

    console.log("User authenticated:", user.id, "Session valid:", !!session.access_token);

    // ✅ Generate unique file path (per user)
    // Don't include "avatars/" prefix since we're already specifying the bucket
    const fileExt = file.name.split(".").pop();
    const fileName = `${user.id}-${Date.now()}.${fileExt}`;
    const filePath = fileName;

    // ✅ Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(filePath, file, { upsert: true });

    if (uploadError) throw uploadError;

    // ✅ Get Public URL
    const { data: publicUrlData } = supabase.storage
      .from("avatars")
      .getPublicUrl(filePath);

    const publicUrl = publicUrlData?.publicUrl || "";

    // ✅ Save avatar URL to database - use safer pattern for RLS
    // First check if settings row exists (handle case where row doesn't exist)
    const { data: existingSettings, error: checkError } = await supabase
      .from("user_settings")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle();

    // If check query fails due to RLS, that's also okay - we'll try insert
    if (checkError && checkError.code !== 'PGRST116') {
      console.warn("Check query warning:", checkError);
    }

    let dbError;
    if (existingSettings) {
      // Update existing row
      console.log("Updating existing user_settings row for user:", user.id);
      const { error } = await supabase
        .from("user_settings")
        .update({
          avatar_url: publicUrl,
          updated_at: new Date(),
        })
        .eq("user_id", user.id);
      dbError = error;
    } else {
      // Insert new row
      console.log("Inserting new user_settings row for user:", user.id);
      const { error } = await supabase
        .from("user_settings")
        .insert({
          user_id: user.id,
          avatar_url: publicUrl,
          updated_at: new Date(),
        });
      dbError = error;
    }

    if (dbError) {
      console.error("Database error details:", {
        message: dbError.message,
        code: dbError.code,
        details: dbError.details,
        hint: dbError.hint,
      });
      throw new Error(`Failed to save avatar: ${dbError.message}`);
    }

    // ✅ Update local state instantly
    setProfile((prev) => ({ ...prev, avatar_url: publicUrl }));

    alert("✅ Avatar uploaded successfully!");
  } catch (error: any) {
    console.error("Upload error:", error.message);
    alert("Error uploading image: " + error.message);
  } finally {
    setUploading(false);
  }
};


  const handleSave = async () => {
    setSaving(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      alert("User not authenticated.");
      setSaving(false);
      return;
    }

    const { error } = await supabase.from("user_settings").upsert(
      {
        user_id: user.id,
        username: profile.username,
        phone: profile.phone,
        gender: profile.gender,
        notifications: profile.notifications,
        avatar_url: profile.avatar_url,
        updated_at: new Date(),
      },
      { onConflict: "user_id" }
    );

    if (error) {
      alert("Error saving settings: " + error.message);
    } else {
      alert("✅ Settings saved successfully!");
    }

    setSaving(false);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen text-gray-600">
        Loading settings...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-6 md:px-16 lg:px-32">
      <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow-xl p-8">
        <h1 className="text-3xl font-semibold text-indigo-700 mb-8 text-center">
          Account Settings
        </h1>

        {/* Avatar Upload Section */}
        <div className="flex flex-col items-center mb-8">
          <div className="relative">
            <Image
              src={profile.avatar_url || "/default-avatar.png"}
              alt="Profile Picture"
              width={120}
              height={120}
              className="rounded-full border-4 border-indigo-100 shadow-md object-cover"
            />
            <label className="absolute bottom-0 right-0 bg-indigo-600 text-white text-xs px-3 py-1 rounded-full cursor-pointer hover:bg-indigo-700">
              {uploading ? "..." : "Edit"}
              <input
                type="file"
                accept="image/*"
                onChange={handleAvatarUpload}
                className="hidden"
              />
            </label>
          </div>
        </div>

        {/* Email Display */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Email Address
          </label>
          <Input
            type="email"
            value={user?.email || ""}
            readOnly
            className="w-full border-gray-300 bg-gray-100 text-gray-600"
          />
        </div>

        {/* Username */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Username
          </label>
          <Input
            type="text"
            placeholder="Enter your username"
            value={profile.username}
            onChange={(e) =>
              setProfile({ ...profile, username: e.target.value })
            }
            className="w-full border-gray-300 focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>

        {/* Phone Number */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Phone Number
          </label>
          <Input
            type="tel"
            placeholder="Enter your phone number"
            value={profile.phone}
            onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
            className="w-full border-gray-300 focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>

        {/* Gender Dropdown */}
        <div className="mb-8">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Gender
          </label>
          <select
            value={profile.gender}
            onChange={(e) => setProfile({ ...profile, gender: e.target.value })}
            className="w-full border border-gray-300 rounded-md p-2 focus:ring-indigo-500 focus:border-indigo-500"
          >
            <option value="">Select gender</option>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
            <option value="Other">Other</option>
          </select>
        </div>

        {/* Notification Switch */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-sm font-medium text-gray-800">
              Email Notifications
            </h2>
            <p className="text-gray-500 text-sm">
              Get updates on your orders and account activity.
            </p>
          </div>

          <button
            type="button"
            onClick={() =>
              setProfile((prev) => ({
                ...prev,
                notifications: !prev.notifications,
              }))
            }
            className={`relative inline-flex h-7 w-14 rounded-full transition-colors duration-300 ease-in-out ${
              profile.notifications ? "bg-indigo-500" : "bg-gray-300"
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 h-6 w-6 bg-white rounded-full shadow-md transform transition-transform duration-300 ease-in-out ${
                profile.notifications ? "translate-x-7" : ""
              }`}
            />
          </button>
        </div>

        {/* Save Button */}
        <div className="flex justify-end">
          <Button
            onClick={handleSave}
            disabled={saving}
            className="bg-indigo-600 text-white px-6 py-2 rounded-full hover:bg-indigo-700 transition"
          >
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </div>

        {/* Back Link */}
        <div className="mt-10 text-center">
          <Link
            href="/explore"
            className="text-indigo-600 hover:text-indigo-800 font-medium"
          >
            ← Back to Explore
          </Link>
        </div>
      </div>
    </div>
  );
}
