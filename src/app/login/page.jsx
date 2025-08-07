"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "sonner";

export default function LoginPage() {
  const router = useRouter();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    const { error } = isSignUp
      ? await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              first_name: firstName,
              last_name: lastName,
            },
          },
        })
      : await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError(error.message);
    } else {
      toast.success(isSignUp ? "Account created!" : "Logged in!");
      router.push("/");
    }
  };

  return (
    <main className="max-w-md mx-auto mt-20 p-6 border rounded-xl shadow">
      <h1 className="text-3xl font-bold mb-4 ">Welcome to Your ToDo List!</h1>
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
          </>
        )}
        <input
          type="email"
          placeholder="Email"
          className="w-full border px-3 py-2 rounded"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          type="password"
          placeholder="Password"
          className="w-full border px-3 py-2 rounded"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error && <p className="text-red-500">{error}</p>}
        <button className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700">
          {isSignUp ? "Sign Up" : "Log In"}
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
