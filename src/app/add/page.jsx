"use client";

import { supabase } from "@/lib/supabaseClient";
import { useUser } from "@/components/AuthProvider";
import { useState } from "react";

export default function DebugNameButton() {
  const { user } = useUser();
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");

  const handleClick = async () => {
    setLoading(true);
    setStatus("");

    const { data, error } = await supabase.auth.updateUser({
      data: {
        first_name: "Andy",
        last_name: "Winn",
      },
    });

    if (error) {
      console.error("Error updating metadata:", error.message);
      setStatus("Error: " + error.message);
    } else {
      console.log("Updated metadata:", data);
      setStatus("User metadata updated successfully.");
    }

    setLoading(false);
  };

  if (!user) return null;

  return (
    <div className="mt-6 p-4 border rounded bg-yellow-50">
      <button
        onClick={handleClick}
        disabled={loading}
        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
      >
        {loading ? "Updating..." : "Add First and Last Name"}
      </button>
      {status && <p className="mt-2 text-sm text-gray-700">{status}</p>}
    </div>
  );
}