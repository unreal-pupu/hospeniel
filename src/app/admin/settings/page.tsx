"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle, XCircle } from "lucide-react";
import { validatePassword, getPasswordRequirements } from "@/lib/passwordValidation";

interface AdminProfile {
  name: string;
  email: string;
  phone_number: string;
  address: string;
  avatar_url: string | null;
}

export default function AdminSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [profile, setProfile] = useState<AdminProfile>({
    name: "",
    email: "",
    phone_number: "",
    address: "",
    avatar_url: null,
  });
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordErrors, setPasswordErrors] = useState<string[]>([]);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setLoading(true);
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError || !user) {
          setMessage({ type: "error", text: "Please log in to access settings." });
          setLoading(false);
          return;
        }

        const { data: profileData, error: profileError } = await supabase
          .from("profiles")
          .select("name, email, phone_number, address")
          .eq("id", user.id)
          .single();

        if (profileError) {
          throw profileError;
        }

        let avatarUrl: string | null = null;
        try {
          const { data: settingsData } = await supabase
            .from("user_settings")
            .select("avatar_url")
            .eq("user_id", user.id)
            .maybeSingle();
          avatarUrl = settingsData?.avatar_url || null;
        } catch (avatarError) {
          console.warn("Avatar fetch warning:", avatarError);
        }

        setProfile({
          name: profileData?.name || "",
          email: profileData?.email || user.email || "",
          phone_number: profileData?.phone_number || "",
          address: profileData?.address || "",
          avatar_url: avatarUrl,
        });
        setNewEmail(profileData?.email || user.email || "");
      } catch (error) {
        console.error("Error fetching admin profile:", error);
        setMessage({ type: "error", text: "Failed to load profile information." });
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, []);

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setUploading(true);
      const file = event.target.files?.[0];
      if (!file) return;

      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        throw new Error("User not authenticated.");
      }

      const fileExt = file.name.split(".").pop();
      const fileName = `${user.id}-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(fileName, file, { upsert: true });

      if (uploadError) {
        throw uploadError;
      }

      const { data: publicUrlData } = supabase.storage
        .from("avatars")
        .getPublicUrl(fileName);

      const publicUrl = publicUrlData?.publicUrl || "";

      const { data: existingSettings } = await supabase
        .from("user_settings")
        .select("user_id")
        .eq("user_id", user.id)
        .maybeSingle();

      const { error: updateError } = existingSettings
        ? await supabase
            .from("user_settings")
            .update({ avatar_url: publicUrl, updated_at: new Date() })
            .eq("user_id", user.id)
        : await supabase
            .from("user_settings")
            .insert({ user_id: user.id, avatar_url: publicUrl, updated_at: new Date() });

      if (updateError) {
        throw updateError;
      }

      setProfile((prev) => ({ ...prev, avatar_url: publicUrl }));
      setMessage({ type: "success", text: "Avatar updated successfully." });
    } catch (error) {
      console.error("Avatar upload error:", error);
      setMessage({ type: "error", text: "Failed to upload avatar." });
    } finally {
      setUploading(false);
    }
  };

  const handleSaveProfile = async (event: React.FormEvent) => {
    event.preventDefault();
    setSavingProfile(true);
    setMessage(null);

    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        throw new Error("User not authenticated.");
      }

      if (newEmail && newEmail !== profile.email) {
        const { error: emailError } = await supabase.auth.updateUser({ email: newEmail });
        if (emailError) {
          throw emailError;
        }
      }

      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          name: profile.name,
          email: newEmail,
          phone_number: profile.phone_number,
          address: profile.address,
        })
        .eq("id", user.id);

      if (profileError) {
        throw profileError;
      }

      setProfile((prev) => ({ ...prev, email: newEmail }));
      setMessage({ type: "success", text: "Profile updated successfully." });
    } catch (error) {
      console.error("Profile update error:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to update profile.";
      setMessage({ type: "error", text: errorMessage });
    } finally {
      setSavingProfile(false);
    }
  };

  const handlePasswordUpdate = async (event: React.FormEvent) => {
    event.preventDefault();
    setSavingPassword(true);
    setMessage(null);
    setPasswordErrors([]);

    try {
      if (!newPassword || !confirmPassword) {
        setPasswordErrors(["Both password fields are required."]);
        return;
      }

      if (newPassword !== confirmPassword) {
        setPasswordErrors(["Passwords do not match."]);
        return;
      }

      const passwordValidation = validatePassword(newPassword);
      if (!passwordValidation.isValid) {
        setPasswordErrors(passwordValidation.errors);
        return;
      }

      const { error } = await supabase.auth.updateUser({ password: newPassword.trim() });
      if (error) {
        throw error;
      }

      setNewPassword("");
      setConfirmPassword("");
      setMessage({ type: "success", text: "Password updated successfully." });
    } catch (error) {
      console.error("Password update error:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to update password.";
      setMessage({ type: "error", text: errorMessage });
    } finally {
      setSavingPassword(false);
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
        <p className="text-gray-600 mt-2">Manage your admin profile details</p>
      </div>

      {message && (
        <Card className={message.type === "success" ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              {message.type === "success" ? (
                <CheckCircle className="h-5 w-5 text-green-600" />
              ) : (
                <XCircle className="h-5 w-5 text-red-600" />
              )}
              <p className={message.type === "success" ? "text-green-800" : "text-red-800"}>
                {message.text}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Profile Photo</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
            <div className="h-20 w-20 rounded-full bg-gray-100 overflow-hidden flex items-center justify-center">
              {profile.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={profile.avatar_url} alt="Admin avatar" className="h-full w-full object-cover" />
              ) : (
                <span className="text-gray-400 text-sm">No Photo</span>
              )}
            </div>
            <div>
              <Label htmlFor="avatar">Upload new photo</Label>
              <Input id="avatar" type="file" accept="image/*" onChange={handleAvatarUpload} disabled={uploading} />
              <p className="text-xs text-gray-500 mt-1">PNG, JPG up to 2MB</p>
              {uploading && <p className="text-sm text-gray-600 mt-2">Uploading...</p>}
            </div>
          </div>
        </CardContent>
      </Card>

      <form onSubmit={handleSaveProfile} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Profile Information</CardTitle>
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
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                Changing email may require verification.
              </p>
            </div>
            <div>
              <Label htmlFor="phone">Phone Number</Label>
              <Input
                id="phone"
                type="tel"
                value={profile.phone_number}
                onChange={(e) => setProfile({ ...profile, phone_number: e.target.value })}
                placeholder="+2348012345678"
              />
            </div>
            <div>
              <Label htmlFor="address">Address</Label>
              <Input
                id="address"
                value={profile.address}
                onChange={(e) => setProfile({ ...profile, address: e.target.value })}
                placeholder="Office address"
              />
            </div>
            <Button type="submit" disabled={savingProfile}>
              {savingProfile ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Profile"
              )}
            </Button>
          </CardContent>
        </Card>
      </form>

      <form onSubmit={handlePasswordUpdate} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Update Password</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="new-password">New Password</Label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password"
              />
            </div>
            <div>
              <Label htmlFor="confirm-password">Confirm Password</Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter new password"
              />
            </div>
            <p className="text-xs text-gray-500">{getPasswordRequirements()}</p>
            {passwordErrors.length > 0 && (
              <div className="text-sm text-red-600 space-y-1">
                {passwordErrors.map((error) => (
                  <p key={error}>{error}</p>
                ))}
              </div>
            )}
            <Button type="submit" disabled={savingPassword}>
              {savingPassword ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Updating...
                </>
              ) : (
                "Update Password"
              )}
            </Button>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
