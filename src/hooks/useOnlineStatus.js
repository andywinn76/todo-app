"use client";
import { useEffect, useState } from "react";

export default function useOnlineStatus() {
  // Assume online during SSR/first paint; corrected immediately on mount.
  const [online, setOnline] = useState(true);

  useEffect(() => {
    setOnline(navigator.onLine);

    function goOnline() {
      setOnline(true);
    }
    function goOffline() {
      setOnline(false);
    }

    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  return online;
}
