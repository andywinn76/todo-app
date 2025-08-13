"use client";

import { useRouter } from "next/navigation";
import { useUser } from "@/components/AuthProvider"; // assumes you have a user context
import { supabase } from "@/lib/supabaseClient";
import { LogOut } from "lucide-react";
import Logo from "./Logo";

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
      <Logo />
      <div className="flex items-center gap-4 sm:gap-2">
        <div className="sm:w-6 sm:h-6 w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-lg">
          {initials}
        </div>
        <h1 className="text-base md:text-lg lg:text-xl font-semibold mr-5 sm:mr-2">Welcome, {firstName}!</h1>
        <button onClick={handleLogout}>
          <LogOut className="w-6 h-6 mr-4 sm:mr-1" />
        </button>
      </div>

      {children}
    </header>
  );
}
