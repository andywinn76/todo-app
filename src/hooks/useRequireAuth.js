"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/components/AuthProvider";

export default function useRequireAuth(redirectTo = "/login") {
  const { user, loading } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) router.replace(redirectTo); // replace avoids back-nav to protected page
  }, [loading, user, router, redirectTo]);

  return { user, userLoading: loading };
}
