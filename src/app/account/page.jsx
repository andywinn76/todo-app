"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { upsertProfileFromAuthUser } from "@/utils/profileSync";
import { toast } from "sonner";
import Link from "next/link";

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
      const { error } = await upsertProfileFromAuthUser();
      if (error) console.warn("Profile sync failed:", error);
      setLoading(false);
    })();
  }, []);

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

      // Fetch profile row (upsertProfileFromAuthUser should have created it)
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

      if (profile) {
        setFirstName(profile.first_name ?? "");
        setLastName(profile.last_name ?? "");
        setUsername(profile.username ?? "");
        setAvatarUrl(profile.avatar_url ?? "");
      } else {
        // As a fallback only (shouldn’t happen after upsertProfileFromAuthUser)
        const { error: insertErr } = await supabase.from("profiles").insert({
          id: user.id,
          first_name: user.user_metadata?.first_name ?? "",
          last_name: user.user_metadata?.last_name ?? "",
          username: null,
          avatar_url: null,
          email: user.email ?? null,
          updated_at: new Date().toISOString(),
        });
        if (insertErr) toast.error("Could not create profile row");
        setFirstName(user.user_metadata?.first_name ?? "");
        setLastName(user.user_metadata?.last_name ?? "");
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
    const email = user.email || null;
    const { error: upErr } = await supabase.from("profiles").upsert(
      {
        id: user.id,
        first_name: firstName?.trim() || null,
        last_name: lastName?.trim() || null,
        username: username?.trim()?.toLowerCase() || null,
        avatar_url: avatarUrl || null,
        email,
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
        full_name: `${firstName ?? ""} ${lastName ?? ""}`.trim() || null,
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
    <main className="mx-auto max-w-3xl px-5 py-8 sm:px-8 sm:py-10">
      <div className="mb-7 border-b border-stone-200 pb-5">
        <h1 className="text-[1.65rem] font-semibold tracking-tight text-stone-900">Account</h1>
        <p className="mt-1 text-sm text-stone-500">Manage your profile and invitations.</p>
      </div>

      <form onSubmit={handleSave} className="space-y-6 rounded-xl border border-stone-200 bg-white p-5 sm:p-6">
        <h2 className="text-base font-semibold text-stone-900">Profile details</h2>
        <div>
          <label htmlFor="account-email" className="mb-1.5 block text-sm font-medium text-stone-700">Email</label>
          <input
            id="account-email"
            value={email}
            readOnly
            className="app-input w-full bg-stone-50 px-3 py-2.5 text-sm text-stone-500"
          />
          <p className="mt-1.5 text-xs text-stone-500">
            Your email address can’t be changed here.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="account-first-name" className="mb-1.5 block text-sm font-medium text-stone-700">First name</label>
            <input
              id="account-first-name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="app-input w-full px-3 py-2.5 text-sm"
              placeholder="Andy"
            />
          </div>
          <div>
            <label htmlFor="account-last-name" className="mb-1.5 block text-sm font-medium text-stone-700">Last name</label>
            <input
              id="account-last-name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className="app-input w-full px-3 py-2.5 text-sm"
              placeholder="Winn"
            />
          </div>
        </div>

        <div>
          <label htmlFor="account-username" className="mb-1.5 block text-sm font-medium text-stone-700">Username</label>
          <input
            id="account-username"
            value={username ?? ""}
            onChange={(e) => setUsername(e.target.value)}
            className="app-input w-full px-3 py-2.5 text-sm"
            placeholder="username"
            pattern="^[A-Za-z0-9_]{3,20}$"
            minLength={3}
            maxLength={20}
          />
          <p className="mt-1.5 text-xs text-stone-500">
            Unique username, 3 to 20 characters: letters, numbers, and
            underscores are allowed.
          </p>
        </div>

        {/* Avatar upload coming later */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-stone-700">
            Avatar (coming soon)
          </label>
          <div className="flex items-center gap-3">
            <div className="size-12 rounded-full bg-[#e9efeb]" />
            <button
              type="button"
              disabled
              className="cursor-not-allowed rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-400"
              title="Coming soon"
            >
              Upload…
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 border-t border-stone-100 pt-5">
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-[var(--accent)] px-4 py-2.5 text-sm font-medium text-white hover:bg-[var(--accent-hover)] disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save changes"}
          </button>

          <button
            type="button"
            onClick={handleSendResetEmail}
            className="rounded-lg border border-stone-200 bg-white px-4 py-2.5 text-sm font-medium text-stone-700 hover:bg-stone-50"
          >
            Send password reset email
          </button>
        </div>
      </form>

      <section className="mt-5 rounded-xl border border-stone-200 bg-white p-5 sm:p-6">
        <h2 className="text-base font-semibold text-stone-900">Invites</h2>
        <p className="mt-1 text-sm text-stone-500">Invite people to collaborate or review invitations.</p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link
            href="/invite"
            className="rounded-lg bg-[var(--accent)] px-4 py-2.5 text-sm font-medium text-white hover:bg-[var(--accent-hover)]"
          >
            Send Invites
          </Link>
          <Link
            href="/invite/manage"
            className="rounded-lg border border-stone-200 bg-white px-4 py-2.5 text-sm font-medium text-stone-700 hover:bg-stone-50"
          >
            Manage Invites
          </Link>
        </div>
      </section>
    </main>
  );
}
