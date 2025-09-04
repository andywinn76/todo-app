"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "sonner";

export default function ResetPasswordClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [status, setStatus] = useState("checking"); // checking | ready | error
  const [errorMsg, setErrorMsg] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [show, setShow] = useState(false);

  const code = useMemo(() => searchParams.get("code"), [searchParams]);

  function parseHashParams() {
    if (typeof window === "undefined") return {};
    const hash = window.location.hash?.replace(/^#/, "");
    const params = new URLSearchParams(hash);
    return {
      type: params.get("type"),
      access_token: params.get("access_token"),
      refresh_token: params.get("refresh_token"),
    };
  }

  useEffect(() => {
    let cancelled = false;

    async function ensureSession() {
      try {
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
          if (!cancelled) setStatus("ready");
          return;
        }

        const { type, access_token, refresh_token } = parseHashParams();
        if (type === "recovery" && access_token && refresh_token) {
          const { error } = await supabase.auth.setSession({
            access_token,
            refresh_token,
          });
          if (error) throw error;
          if (!cancelled) setStatus("ready");
          return;
        }

        const { data: sessionRes, error: sessionErr } = await supabase.auth.getSession();
        if (sessionErr) throw sessionErr;
        if (sessionRes?.session) {
          if (!cancelled) setStatus("ready");
          return;
        }

        if (!cancelled) {
          setStatus("error");
          setErrorMsg(
            "This password reset link is invalid or has expired. Request a new reset email from the login page."
          );
        }
      } catch (err) {
        if (!cancelled) {
          setStatus("error");
          setErrorMsg(err?.message || "Could not validate reset link.");
        }
      }
    }

    ensureSession();
    return () => {
      cancelled = true;
    };
  }, [code]);

  const canSubmit =
    status === "ready" &&
    !submitting &&
    password.length >= 8 &&
    confirm.length >= 8 &&
    password === confirm;

  async function handleSubmit(e) {
    e.preventDefault();
    if (!canSubmit) return;

    try {
      setSubmitting(true);
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;

      toast.success("Password updated! Please log in with your new password.");
      if (typeof window !== "undefined") window.history.replaceState({}, "", "/login");
      router.replace("/login");
    } catch (err) {
      toast.error(err?.message || "Failed to update password.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl border bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold mb-1">Reset your password</h1>
        <p className="text-sm text-gray-600 mb-6">
          Choose a new password for your account.
        </p>

        {status === "checking" && (
          <div className="text-gray-700">Verifying your reset link…</div>
        )}

        {status === "error" && (
          <div className="space-y-4">
            <div className="rounded-md bg-red-50 border border-red-200 p-3 text-red-700">
              {errorMsg}
            </div>
            <div className="text-sm">
              Go back to{" "}
              <Link href="/login" className="text-blue-600 underline">
                Login
              </Link>{" "}
              to request a new password reset email.
            </div>
          </div>
        )}

        {status === "ready" && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="password" className="block text-sm font-medium mb-1">
                New password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={show ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-md border px-3 py-2 outline-none focus:ring-2 focus:ring-blue-600"
                  placeholder="At least 8 characters"
                  minLength={8}
                  required
                  autoComplete="new-password"
                />
              </div>
            </div>

            <div>
              <label htmlFor="confirm" className="block text-sm font-medium mb-1">
                Confirm new password
              </label>
              <input
                id="confirm"
                type={show ? "text" : "password"}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="w-full rounded-md border px-3 py-2 outline-none focus:ring-2 focus:ring-blue-600"
                placeholder="Re-enter your new password"
                minLength={8}
                required
                autoComplete="new-password"
              />
            </div>

            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setShow((s) => !s)}
                className="text-sm text-blue-700 underline"
              >
                {show ? "Hide password" : "Show password"}
              </button>

              <button
                type="submit"
                disabled={!canSubmit}
                className={`rounded-md px-4 py-2 text-white font-semibold ${
                  canSubmit
                    ? "bg-blue-600 hover:bg-blue-700"
                    : "bg-gray-400 cursor-not-allowed"
                }`}
              >
                {submitting ? "Saving…" : "Set new password"}
              </button>
            </div>

            {password && confirm && password !== confirm && (
              <p className="text-sm text-red-600">
                Passwords don’t match. Please re-enter.
              </p>
            )}
            {password && password.length < 8 && (
              <p className="text-sm text-red-600">
                Password must be at least 8 characters.
              </p>
            )}
          </form>
        )}
      </div>
    </main>
  );
}
