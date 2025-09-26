"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import useRequireAuth from "@/hooks/useRequireAuth";
import { toast } from "sonner";
import { Copy, XCircle, RefreshCw } from "lucide-react";
import Link from "next/link";

export default function InviteManagePage() {
  const { user, userLoading } = useRequireAuth();
  const [invites, setInvites] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || userLoading) return;
    fetchInvites();
  }, [user, userLoading]);

  async function fetchInvites() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("app_invites")
        .select("id, email, status, created_at, accepted_at, expires_at, token")
        .eq("invited_by", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setInvites(data || []);
    } catch (err) {
      toast.error(err.message || "Failed to load invites");
    } finally {
      setLoading(false);
    }
  }

  async function copyLink(token) {
    try {
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      const url = `${origin}/login?token=${token}`;
      await navigator.clipboard.writeText(url);
      toast.success("Invite link copied");
    } catch {
      toast.error("Could not copy link");
    }
  }

  async function revokeInvite(id) {
    try {
      const { error } = await supabase
        .from("app_invites")
        .update({ status: "revoked" })
        .eq("id", id);

      if (error) throw error;
      toast.success("Invite revoked");
      fetchInvites();
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function resendInvite(id, email) {
    try {
      const newToken = crypto.randomUUID().replace(/-/g, "");
      const twoWeeks = 1000 * 60 * 60 * 24 * 14;
      const { error } = await supabase
        .from("app_invites")
        .update({
          token: newToken,
          status: "pending",
          expires_at: new Date(Date.now() + twoWeeks).toISOString(),
        })
        .eq("id", id);

      if (error) throw error;
      toast.success("Invite resent");
      fetchInvites();
    } catch (err) {
      toast.error(err.message);
    }
  }

  return (
    <div className="max-w-3xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Manage Invites</h1>

      {loading ? (
        <p>Loading…</p>
      ) : invites.length === 0 ? (
        <p className="text-gray-600">No invites sent yet.</p>
      ) : (
        <table className="w-full border text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-2 text-left">Email</th>
              <th className="p-2 text-left">Status</th>
              <th className="p-2 text-left">Created</th>
              <th className="p-2 text-left">Accepted</th>
              <th className="p-2 text-left">Expires</th>
              <th className="p-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {invites.map((inv) => (
              <tr key={inv.id} className="border-t">
                <td className="p-2">{inv.email}</td>
                <td className="p-2 capitalize">{inv.status}</td>
                <td className="p-2">{new Date(inv.created_at).toLocaleDateString()}</td>
                <td className="p-2">{inv.accepted_at ? new Date(inv.accepted_at).toLocaleDateString() : "—"}</td>
                <td className="p-2">{inv.expires_at ? new Date(inv.expires_at).toLocaleDateString() : "—"}</td>
                <td className="p-2 space-x-2">
                  <button
                    className="text-blue-600 hover:text-blue-800"
                    onClick={() => copyLink(inv.token)}
                  >
                    <Copy className="inline w-4 h-4 mr-1" /> Copy
                  </button>
                  {inv.status === "pending" && (
                    <>
                      <button
                        className="text-red-600 hover:text-red-800"
                        onClick={() => revokeInvite(inv.id)}
                      >
                        <XCircle className="inline w-4 h-4 mr-1" /> Revoke
                      </button>
                      <button
                        className="text-green-600 hover:text-green-800"
                        onClick={() => resendInvite(inv.id, inv.email)}
                      >
                        <RefreshCw className="inline w-4 h-4 mr-1" /> Resend
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <div className="mt-6 space-x-4">
      <Link
            href="/invite"
            className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
          >
            Send Invites
          </Link></div>
    </div>
  );
}
