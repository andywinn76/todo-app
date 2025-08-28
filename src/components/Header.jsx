"use client";

import { useRouter } from "next/navigation";
import { useUser } from "@/components/AuthProvider";
import { supabase } from "@/lib/supabaseClient";
import { LogOut } from "lucide-react";
import Logo from "./Logo";
import InvitesBell from "@/components/InvitesBell";

export default function Header({ children }) {
  const router = useRouter();
  const { user } = useUser();

  if (!user) return null;

  const firstName = user.user_metadata?.first_name || "";
  const lastName = user.user_metadata?.last_name || "";
  const fullName =
    (firstName && lastName && `${firstName} ${lastName}`) ||
    firstName ||
    user.user_metadata?.full_name ||
    user.user_metadata?.name ||
    "User";

  const initials = fullName
    .split(" ")
    .filter(Boolean)
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  return (
    <header className="flex items-center justify-between bg-gray-100 p-4 border-b">
      <Logo type="responsive" size="header" className="ml-2 sm:ml-4" priority />

      <div className="flex items-center gap-2 sm:gap-4">
        <InvitesBell userId={user.id} />

        <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-lg">
          {initials}
        </div>

        <h1 className="text-base md:text-lg lg:text-xl font-semibold mr-2 md:mr-5">
          Welcome, {firstName || "Friend"}!
        </h1>

        <button
          onClick={handleLogout}
          aria-label="Log out"
          title="Log out"
          className="inline-flex items-center justify-center rounded p-1.5 hover:bg-gray-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600"
        >
          <LogOut className="w-6 h-6 md:mr-1" />
        </button>
      </div>

      {children}
    </header>
  );
}
