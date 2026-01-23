"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2, Save, CheckCircle } from "lucide-react";

interface RiderProfile {
  name: string;
  email: string;
  phone_number: string | null;
  address: string;
  avatar_url: string | null;
  is_available: boolean;
}

export default function RiderSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<RiderProfile>({
    name: "",
    email: "",
    phone_number: null,
    address: "",
    avatar_url: null,
    is_available: true,
  });
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch profile data (avatar_url is in user_settings, not profiles)
      const { data, error } = await supabase
        .from("profiles")
        .select("name, email, phone_number, address, is_available")
        .eq("id", user.id)
        .single();

      if (error) throw error;

      // Optionally fetch avatar from user_settings (don't block if it fails)
      let avatarUrl: string | null = null;
      try {
        const { data: settings } = await supabase
          .from("user_settings")
          .select("avatar_url")
          .eq("user_id", user.id)
          .maybeSingle();
        avatarUrl = settings?.avatar_url || null;
      } catch (avatarError) {
        console.log("Could not fetch avatar (non-critical):", avatarError);
        // Continue without avatar - don't block profile loading
      }

      setProfile({
        name: data.name || "",
        email: data.email || "",
        phone_number: data.phone_number || null,
        address: data.address || "",
        avatar_url: avatarUrl,
        is_available: data.is_available ?? true,
      });
    } catch (error) {
      console.error("Error fetching profile:", error);
      alert("Failed to load profile");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from("profiles")
        .update({
          name: profile.name,
          phone_number: profile.phone_number,
          address: profile.address,
          is_available: profile.is_available,
        })
        .eq("id", user.id);

      if (error) throw error;

      setMessage({ type: "success", text: "Settings saved successfully!" });
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error("Error saving settings:", error);
      setMessage({ type: "error", text: "Failed to save settings. Please try again." });
    } finally {
      setSaving(false);
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
        <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-600 mt-2">Manage your profile and availability</p>
      </div>

      {message && (
        <Card className={message.type === "success" ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              {message.type === "success" && <CheckCircle className="h-5 w-5 text-green-600" />}
              <p className={message.type === "success" ? "text-green-800" : "text-red-800"}>
                {message.text}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <form onSubmit={handleSave}>
        <Card>
          <CardHeader>
            <CardTitle>Personal Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                value={profile.name}
                onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                required
              />
            </div>

            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={profile.email}
                disabled
                className="bg-gray-100"
              />
              <p className="text-xs text-gray-500 mt-1">Email cannot be changed</p>
            </div>

            <div>
              <Label htmlFor="phone">Phone Number</Label>
              <Input
                id="phone"
                type="tel"
                value={profile.phone_number || ""}
                onChange={(e) => setProfile({ ...profile, phone_number: e.target.value || null })}
                placeholder="+2348012345678"
              />
            </div>

            <div>
              <Label htmlFor="address">Address</Label>
              <Input
                id="address"
                value={profile.address}
                onChange={(e) => setProfile({ ...profile, address: e.target.value })}
                required
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Availability</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="is_available"
                checked={profile.is_available}
                onChange={(e) => setProfile({ ...profile, is_available: e.target.checked })}
                className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              <Label htmlFor="is_available" className="cursor-pointer">
                I am available to accept new delivery tasks
              </Label>
            </div>
            <p className="text-sm text-gray-500 mt-2">
              When unavailable, you will not receive new task assignments.
            </p>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button type="submit" disabled={saving} className="bg-indigo-600 hover:bg-indigo-700">
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Changes
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}


