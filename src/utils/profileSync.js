// utils/profileSync.js
import { supabase } from "@/lib/supabaseClient";

/** Upsert the public.profiles row using the current auth user as source of truth. */
export async function upsertProfileFromAuthUser() {
  const { data: { user }, error: userErr } = await supabase.auth.getUser();
  if (userErr || !user) return { error: userErr || new Error("No user") };

  const email = user.email || null;
  const md = user.user_metadata || {};
  const first = md.first_name ?? null;
  const last  = md.last_name  ?? null;
  const uname = (md.username || "").toLowerCase() || null;

  // Only include fields we actually want to store/update
  const payload = {
    id: user.id,
    first_name: first,
    last_name:  last,
    username:   uname,
    email,
    updated_at: new Date().toISOString(),
  };

  const { error: upErr } = await supabase
    .from("profiles")
    .upsert(payload, { onConflict: "id" });

  return { error: upErr || null };
}
