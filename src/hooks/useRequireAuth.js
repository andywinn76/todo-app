"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/components/AuthProvider";

export default function useRequireAuth() {
  const { user, loading } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user === null) {
      router.push("/login");
    }
  }, [user, loading]);

  return { user, userLoading: loading };
}
