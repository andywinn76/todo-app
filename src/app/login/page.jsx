"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "sonner";
import Logo from "@/components/Logo";

const USERNAME_REGEX = /^[a-zA-Z0-9_]{3,20}$/;

function looksLikeEmail(v) {
  return /\S+@\S+\.\S+/.test(v);
}

export default function LoginPage() {
  const router = useRouter();
  const search = useSearchParams();
  const token = search?.get("token")?.trim() || "";

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [username, setUsername] = useState("");
  const [emailOrUsername, setEmailOrUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteStatus, setInviteStatus] = useState(null);
  const [inviteChecked, setInviteChecked] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!token) {
        setInviteChecked(true);
        return;
      }
      try {
        const { data, error } = await supabase
          .from("app_invites")
          .select("email, status, expires_at")
          .eq("token", token)
          .maybeSingle();

        if (error) throw error;

        if (!data) {
          if (!cancelled) {
            setInviteStatus("invalid");
            toast.error("Invite link is invalid.");
          }
          return;
        }

        const expired = data.expires_at && new Date(data.expires_at).getTime() < Date.now();
        if (expired) {
          if (!cancelled) {
            setInviteStatus("expired");
            toast.error("This invite link has expired.");
          }
          return;
        }

        if (data.status && data.status !== "pending") {
          if (!cancelled) {
            setInviteStatus(data.status);
            toast.error(
              data.status === "accepted"
                ? "This invite was already accepted."
                : "This invite is no longer valid."
            );
          }
          return;
        }

        if (!cancelled) {
          setInviteEmail(data.email);
          setInviteStatus("pending");
          setIsSignUp(true);
          setEmailOrUsername(data.email);
        }
      } catch (err) {
        if (!cancelled) {
          setInviteStatus("error");
          toast.error("Could not verify invite. Try again later.");
        }
      } finally {
        if (!cancelled) setInviteChecked(true);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function usernameAvailable(name) {
    if (!name) return false;
    const clean = name.trim().toLowerCase();
    const { count, error: err } = await supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .ilike("username", clean);
    if (err) {
      toast.error("Could not check username. Try again.");
      return false;
    }
    return (count ?? 0) === 0;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);

    const passTrim = password;
    const first = firstName.trim();
    const last = lastName.trim();
    const uname = username.trim().toLowerCase();

    try {
      if (isSignUp) {
        if (!USERNAME_REGEX.test(uname)) {
          setError("Username must be 3–20 chars: letters, numbers, or underscore.");
          setBusy(false);
          return;
        }

        const ok = await usernameAvailable(uname);
        if (!ok) {
          setError("That username is already taken. Try another.");
          setBusy(false);
          return;
        }

        const emailTrim = emailOrUsername.trim().toLowerCase();
        if (!looksLikeEmail(emailTrim)) {
          setError("Please enter a valid email address.");
          setBusy(false);
          return;
        }

        if (inviteEmail && inviteEmail.toLowerCase() !== emailTrim) {
          setError("This invite is for a different email address.");
          setBusy(false);
          return;
        }

        const { data: sign, error: signErr } = await supabase.auth.signUp({
          email: emailTrim,
          password: passTrim,
          options: {
            data: {
              first_name: first,
              last_name: last,
              full_name: `${first} ${last}`.trim(),
              username: uname,
            },
          },
        });

        if (signErr) {
          setError(signErr.message);
          setBusy(false);
          return;
        }

        const hasSession = !!sign.session;
        if (hasSession && sign.user) {
          const { error: upErr } = await supabase.from("profiles").upsert(
            {
              id: sign.user.id,
              first_name: first || null,
              last_name: last || null,
              username: uname,
              email: emailTrim,
              avatar_url: null,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "id" }
          );

          if (upErr) {
            if (upErr.code === "23505") {
              setError("That username was just taken. Please choose another.");
              setBusy(false);
              return;
            }
            setError(upErr.message || "Could not save your profile.");
            setBusy(false);
            return;
          }
        }

        // ✅ Mark invite accepted if token + email match
        if (token && inviteEmail && inviteStatus === "pending") {
          const { error: updErr } = await supabase
            .from("app_invites")
            .update({ status: "accepted", accepted_at: new Date().toISOString() })
            .eq("token", token)
            .eq("email", emailTrim);

          if (updErr) {
            console.warn("Could not update invite status:", updErr.message);
            toast.error("Account created, but could not mark invite as accepted.");
          } else {
            toast.success("Invite accepted!");
          }
        }

        toast.success("Account created! Check your email to verify (if required).");
        router.push("/");
      } else {
        const raw = emailOrUsername.trim();
        let emailToUse = raw;
        if (!looksLikeEmail(raw)) {
          const { data: resolved, error: rpcErr } = await supabase.rpc(
            "lookup_email_for_username",
            { uname: raw.toLowerCase() }
          );
          if (rpcErr) {
            setError("Could not look up that username. Try again.");
            setBusy(false);
            return;
          }
          if (!resolved) {
            setError("No account found with that username.");
            setBusy(false);
            return;
          }
          emailToUse = resolved;
        }

        const { error: signInErr } = await supabase.auth.signInWithPassword({
          email: emailToUse,
          password: passTrim,
        });

        if (signInErr) {
          setError(signInErr.message);
          setBusy(false);
          return;
        }

        toast.success("Logged in!");
        router.push("/");
      }
    } finally {
      setBusy(false);
    }
  };

  const emailLocked = Boolean(inviteEmail) && inviteStatus === "pending";

  return (
    <main className="max-w-md mx-auto mt-20 p-6 border rounded-xl shadow">
      <Logo type="static" size={200} className="mx-auto mb-6 rounded-2xl" priority />
      <h1 className="text-3xl font-bold mb-4">Welcome to Let's Doooo It!</h1>
      <p className="mx-14 text-blue-600 text-center mb-6">
        To get started, either login or sign-up using the form below.
      </p>

      <h1 className="text-2xl font-bold mb-4">
        {isSignUp ? "Create an Account" : "Login"}
      </h1>

      {token && (
        <div className="mb-3 text-sm rounded-md p-2 border">
          <strong>Invite link</strong>
          {inviteChecked && inviteStatus === "pending" && inviteEmail && (
            <span className="ml-2">for <span className="font-medium">{inviteEmail}</span></span>
          )}
          {inviteChecked && inviteStatus && inviteStatus !== "pending" && (
            <span className="ml-2 text-red-600">(not valid)</span>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {isSignUp && (
          <>
            <input
              type="text"
              placeholder="First Name"
              className="w-full border px-3 py-2 rounded"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              required
            />
            <input
              type="text"
              placeholder="Last Name"
              className="w-full border px-3 py-2 rounded"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              required
            />
            <div>
              <input
                type="text"
                placeholder="Username"
                className="w-full border px-3 py-2 rounded"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                pattern="^[A-Za-z0-9_]{3,20}$"
                minLength={3}
                maxLength={20}
                autoComplete="username"
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                3–20 characters. Letters, numbers, and underscores only.
              </p>
            </div>
          </>
        )}

        <input
          type="text"
          placeholder={isSignUp ? "Email" : "Email or Username"}
          className={`w-full border px-3 py-2 rounded ${emailLocked ? "bg-gray-100" : ""}`}
          value={emailOrUsername}
          onChange={(e) => setEmailOrUsername(e.target.value)}
          autoComplete={isSignUp ? "email" : "username"}
          required
          disabled={emailLocked}
        />
        {emailLocked && (
          <p className="text-xs text-gray-600 -mt-2">
            Email locked from invite link. Use this address to sign up.
          </p>
        )}

        <input
          type="password"
          placeholder="Password"
          className="w-full border px-3 py-2 rounded"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete={isSignUp ? "new-password" : "current-password"}
          required
        />

        {error && <p className="text-red-500">{error}</p>}

        <button
          disabled={busy}
          className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {busy ? (isSignUp ? "Creating…" : "Logging in…") : isSignUp ? "Sign Up" : "Log In"}
        </button>
      </form>

      <p className="mt-4 text-sm">
        {isSignUp ? "Already have an account?" : "Need an account?"}{" "}
        <button
          onClick={() => {
            setIsSignUp(!isSignUp);
            setError("");
          }}
          className="underline text-blue-600"
        >
          {isSignUp ? "Log in" : "Sign up"}
        </button>
      </p>
    </main>
  );
}