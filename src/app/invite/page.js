"use client";

import { useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import useRequireAuth from "@/hooks/useRequireAuth";
import { toast } from "sonner";
import { X, Mail, Copy } from "lucide-react";
import Link from "next/link";

// Pragmatic email regex for common cases
const EMAIL_RE = /^(?:[a-zA-Z0-9_.'%+\-]+)@(?:[a-zA-Z0-9.-]+)\.[a-zA-Z]{2,}$/;

function parseEmails(input) {
  return input
    .split(/[\n,;\s,]+/) // commas, semicolons, spaces, newlines
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

function randomToken(len = 32) {
  // URL-safe-ish random hex string
  const bytes = new Uint8Array(len);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < len; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(bytes, (b) => ("0" + b.toString(16)).slice(-2)).join("");
}

export default function InvitePage() {
  const { user, userLoading } = useRequireAuth();

  const [raw, setRaw] = useState("");
  const [busy, setBusy] = useState(false);
  const [generated, setGenerated] = useState([]); // [{email, token}]

  const all = useMemo(() => Array.from(new Set(parseEmails(raw))), [raw]);
  const valid = useMemo(() => all.filter((e) => EMAIL_RE.test(e)), [all]);
  const invalid = useMemo(() => all.filter((e) => !EMAIL_RE.test(e)), [all]);

  function removeEmail(target) {
    const remaining = all.filter((e) => e !== target);
    setRaw(remaining.join(", "));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!user || userLoading) return;

    if (valid.length === 0) {
      toast.error("Please enter at least one valid email.");
      return;
    }

    setBusy(true);
    try {
      const now = Date.now();
      const twoWeeks = 1000 * 60 * 60 * 24 * 14;

      const rows = valid.map((email) => ({
        email,
        invited_by: user.id,
        status: "pending",
        token: randomToken(32),
        expires_at: new Date(now + twoWeeks).toISOString(),
      }));

      const { error } = await supabase.from("app_invites").insert(rows);

      if (error) {
        if (String(error.code) === "23505") {
          toast.warning(
            "Some emails already have a pending invite. New invites were added where possible."
          );
        } else {
          throw error;
        }
      }

      const { data, error: fetchErr } = await supabase
        .from("app_invites")
        .select("email, token")
        .in("email", valid);

      if (fetchErr) throw fetchErr;

      setGenerated(data || []);
      toast.success(
        `Invites queued: ${valid.length}${invalid.length ? ` (skipped ${invalid.length} invalid)` : ""}`
      );
      setRaw("");
    } catch (err) {
      toast.error(err?.message || "Failed to send invites.");
    } finally {
      setBusy(false);
    }
  }

  async function copyLink(token) {
    try {
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      const url = `${origin}/signup?token=${token}`;
      await navigator.clipboard.writeText(url);
      toast.success("Invite link copied to clipboard");
    } catch {
      toast.error("Could not copy link");
    }
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-2">Invite Friends</h1>
      <p className="text-sm text-gray-600 mb-4">
        Invite friends to the app! Enter email addresses separated with a comma. You can also use spaces or new lines.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="block text-sm font-medium">Email addresses</label>
        <textarea
          className="w-full border rounded-lg p-3 h-36 focus:outline-none focus:ring focus:ring-blue-200"
          placeholder={"friend1@example.com, friend2@example.com\nfriend3@example.com"}
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          spellCheck={false}
        />

        {all.length > 0 && (
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              {valid.map((email) => (
                <span
                  key={email}
                  className="inline-flex items-center bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs"
                  title="Valid email"
                >
                  <Mail className="w-3 h-3 mr-1" />
                  {email}
                  <button
                    type="button"
                    className="ml-1 opacity-70 hover:opacity-100"
                    onClick={() => removeEmail(email)}
                    aria-label={`Remove ${email}`}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
              {invalid.map((email) => (
                <span
                  key={email}
                  className="inline-flex items-center bg-red-100 text-red-800 px-2 py-1 rounded-full text-xs"
                  title="Invalid email format"
                >
                  <Mail className="w-3 h-3 mr-1" />
                  {email}
                  <button
                    type="button"
                    className="ml-1 opacity-70 hover:opacity-100"
                    onClick={() => removeEmail(email)}
                    aria-label={`Remove ${email}`}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
            <p className="text-xs text-gray-500">
              {valid.length} valid {valid.length === 1 ? "email" : "emails"}
              {invalid.length > 0 && ` • ${invalid.length} invalid (will be skipped)`}
            </p>
          </div>
        )}

        <div className="flex items-center gap-2">
          <button
            type="submit"
            disabled={busy}
            className="px-4 py-2 rounded-lg bg-blue-600 text-white disabled:opacity-50 hover:bg-blue-700"
          >
            {busy ? "Sending…" : "Send Invites"}
          </button>
          <Link
            href="/invite/manage"
            className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
          >
            Manage Invites
          </Link>
          <button
            type="button"
            onClick={() => setRaw("")}
            className="px-3 py-2 rounded-lg border hover:bg-gray-50"
          >
            Clear
          </button>
        </div>
      </form>

      {generated.length > 0 && (
        <div className="mt-8">
          <h2 className="text-lg font-semibold mb-2">Invite Links</h2>
          <p className="text-sm text-gray-600 mb-3">Copy and share these links with your friends:</p>
          <ul className="space-y-2">
            {generated.map(({ email, token }) => (
              <li key={email} className="flex items-center justify-between gap-3 border rounded-lg p-2">
                <div className="text-sm">
                  <span className="font-medium">{email}</span>
                </div>
                <button
                  type="button"
                  className="inline-flex items-center gap-1 text-blue-700 hover:text-blue-900"
                  onClick={() => copyLink(token)}
                >
                  <Copy className="w-4 h-4" /> Copy link
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
