"use client";

import { useRouter } from "next/navigation";
import { useUser } from "@/components/AuthProvider"; // assumes you have a user context
import { supabase } from "@/lib/supabaseClient";
import { LogOut } from "lucide-react";

export default function Header({ children }) {
  const router = useRouter();
  const { user } = useUser();

  if (!user) return null;

  const firstName = user.user_metadata?.first_name || "";
  const lastName = user.user_metadata?.last_name || "";
  const fullName =
    firstName && lastName
      ? `${firstName} ${lastName}`
      : firstName ||
        user.user_metadata?.full_name ||
        user.user_metadata?.name ||
        "User";
  const initials = fullName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  return (
    <header className="flex items-center justify-between bg-gray-100 p-4 border-b">
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-lg">
          {initials}
        </div>
        <h1 className="text-xl font-semibold">Welcome, {firstName}!</h1>
      </div>

      <button
        onClick={handleLogout}
      >
        <LogOut className="w-6 h-6" />

      </button>

      {children}
    </header>
  );
}
