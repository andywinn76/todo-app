"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "sonner";
import Logo from "@/components/Logo";

const USERNAME_REGEX = /^[a-zA-Z0-9_]{3,20}$/;

export default function LoginPage() {
  const router = useRouter();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName]   = useState("");
  const [username, setUsername]   = useState("");
  const [email, setEmail]         = useState("");
  const [password, setPassword]   = useState("");
  const [isSignUp, setIsSignUp]   = useState(false);
  const [error, setError]         = useState("");
  const [busy, setBusy]           = useState(false);

  async function usernameAvailable(name) {
    if (!name) return false;
    const clean = name.trim().toLowerCase();
    const { count, error: err } = await supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("username", clean);

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

    const emailTrim = email.trim();
    const passTrim = password;
    const first = firstName.trim();
    const last  = lastName.trim();
    const uname = username.trim().toLowerCase();

    try {
      if (isSignUp) {
        // Basic client-side validation
        if (!USERNAME_REGEX.test(uname)) {
          setError("Username must be 3–20 chars: letters, numbers, or underscore.");
          setBusy(false);
          return;
        }

        // Pre-check availability to show a friendly error
        const ok = await usernameAvailable(uname);
        if (!ok) {
          setError("That username is already taken. Try another.");
          setBusy(false);
          return;
        }

        // Create auth user and stash names in user_metadata
        const { data: sign, error: signErr } = await supabase.auth.signUp({
          email: emailTrim,
          password: passTrim,
          options: {
            data: {
              first_name: first,
              last_name:  last,
              full_name:  `${first} ${last}`.trim(),
              // (optional) also stash username in metadata for reference
              username:   uname,
            },
          },
        });

        if (signErr) {
          setError(signErr.message);
          setBusy(false);
          return;
        }

        // If email confirmations are OFF, we’ll have a session now and can write profiles.
        // If confirmations are ON, there may be no session yet; the Account page will upsert later.
        const hasSession = !!sign.session;
        if (hasSession && sign.user) {
          const { error: upErr } = await supabase
            .from("profiles")
            .upsert(
              {
                id: sign.user.id,
                first_name: first || null,
                last_name:  last || null,
                username:   uname, // unique enforced in DB
                avatar_url: null,
                updated_at: new Date().toISOString(),
              },
              { onConflict: "id" }
            );

          if (upErr) {
            // 23505 = unique violation (race condition edge case)
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

        toast.success("Account created! Check your email to verify (if required).");
        router.push("/"); // Your app guards root; will redirect if not verified/signed in
      } else {
        // Login
        const { error: signInErr } = await supabase.auth.signInWithPassword({
          email: emailTrim,
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
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                3–20 characters. Letters, numbers, and underscores only.
              </p>
            </div>
          </>
        )}

        <input
          type="email"
          placeholder="Email"
          className="w-full border px-3 py-2 rounded"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="Password"
          className="w-full border px-3 py-2 rounded"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        {error && <p className="text-red-500">{error}</p>}

        <button
          disabled={busy}
          className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {busy ? (isSignUp ? "Creating…" : "Logging in…") : (isSignUp ? "Sign Up" : "Log In")}
        </button>
      </form>

      <p className="mt-4 text-sm">
        {isSignUp ? "Already have an account?" : "Need an account?"}{" "}
        <button
          onClick={() => setIsSignUp(!isSignUp)}
          className="underline text-blue-600"
        >
          {isSignUp ? "Log in" : "Sign up"}
        </button>
      </p>
    </main>
  );
}
