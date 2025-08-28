"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "sonner";

export default function AccountPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [username, setUsername] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      const {
        data: { user },
        error: userErr,
      } = await supabase.auth.getUser();

      if (userErr) {
        toast.error("Auth error loading user");
        setLoading(false);
        return;
      }
      if (!user) {
        // If you have a protected route, you likely already redirect elsewhere.
        setLoading(false);
        return;
      }

      setEmail(user.email ?? "");

      // Try to fetch profile row
      const { data: profile, error: profErr } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();

      if (profErr) {
        toast.error("Failed to load profile");
        setLoading(false);
        return;
      }

      if (!profile) {
        // Create a default profile row if missing (RLS allows insert for self)
        const { error: insertErr } = await supabase.from("profiles").insert({
          id: user.id,
          first_name: user.user_metadata?.first_name ?? "",
          last_name: user.user_metadata?.last_name ?? "",
          username: null,
          avatar_url: null,
        });
        if (insertErr) {
          toast.error("Could not create profile row");
        } else {
          setFirstName(user.user_metadata?.first_name ?? "");
          setLastName(user.user_metadata?.last_name ?? "");
        }
      } else {
        setFirstName(profile.first_name ?? "");
        setLastName(profile.last_name ?? "");
        setUsername(profile.username ?? "");
        setAvatarUrl(profile.avatar_url ?? "");
      }

      setLoading(false);
    })();
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);

    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();
    if (userErr || !user) {
      toast.error("Not authenticated");
      setSaving(false);
      return;
    }

    // 1) Update profiles
    const { error: upErr } = await supabase
      .from("profiles")
      .upsert(
        {
          id: user.id,
          first_name: firstName?.trim() || null,
          last_name: lastName?.trim() || null,
          username: username?.trim() || null,
          avatar_url: avatarUrl || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" }
      );

    if (upErr) {
      // Unique violation code from Postgres is 23505 (surfaced by Supabase)
      if (upErr.code === "23505") {
        toast.error("That username is already taken. Try another.");
      } else {
        toast.error(upErr.message || "Failed to save profile");
      }
      setSaving(false);
      return;
    }

    // 2) Mirror names into auth.user_metadata for your header initials
    const { error: metaErr } = await supabase.auth.updateUser({
      data: {
        first_name: firstName?.trim() || null,
        last_name: lastName?.trim() || null,
        full_name:
          `${firstName ?? ""} ${lastName ?? ""}`.trim() || null,
      },
    });
    if (metaErr) {
      // Not fatal to the save—just let you know
      toast.warning("Saved profile, but couldn't update header metadata");
    }

    toast.success("Profile saved");
    setSaving(false);
  };

  const handleSendResetEmail = async () => {
    if (!email) return;
    const redirectTo =
      typeof window !== "undefined"
        ? `${window.location.origin}/reset-password`
        : undefined;

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
    });
    if (error) {
      toast.error(error.message || "Could not send reset email");
    } else {
      toast.success("Password reset email sent");
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="h-5 w-40 bg-gray-200 animate-pulse rounded mb-4" />
        <div className="h-10 w-full bg-gray-200 animate-pulse rounded mb-2" />
        <div className="h-10 w-full bg-gray-200 animate-pulse rounded mb-2" />
        <div className="h-10 w-full bg-gray-200 animate-pulse rounded mb-6" />
      </div>
    );
  }

  return (
    <main className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-semibold mb-6">Account</h1>

      <form onSubmit={handleSave} className="space-y-6">
        <div>
          <label className="block text-sm font-medium mb-1">Email</label>
          <input
            value={email}
            readOnly
            className="w-full rounded border px-3 py-2 bg-gray-50 text-gray-600"
          />
          <p className="text-xs text-gray-500 mt-1">
            Email is managed by Supabase Auth.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">
              First name
            </label>
            <input
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="w-full rounded border px-3 py-2"
              placeholder="Andy"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">
              Last name
            </label>
            <input
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className="w-full rounded border px-3 py-2"
              placeholder="Winn"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Username</label>
          <input
            value={username ?? ""}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full rounded border px-3 py-2"
            placeholder="andywinn"
          />
          <p className="text-xs text-gray-500 mt-1">
            Must be unique. Letters, numbers, and underscores are safest.
          </p>
        </div>

        {/* Avatar upload coming later */}
        <div>
          <label className="block text-sm font-medium mb-1">
            Avatar (coming soon)
          </label>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-gray-200" />
            <button
              type="button"
              disabled
              className="rounded px-3 py-2 border text-sm text-gray-400 cursor-not-allowed"
              title="Coming soon"
            >
              Upload…
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={saving}
            className="rounded bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save changes"}
          </button>

          <button
            type="button"
            onClick={handleSendResetEmail}
            className="rounded border px-4 py-2"
          >
            Send password reset email
          </button>
        </div>
      </form>
    </main>
  );
}
