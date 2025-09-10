import { supabase } from "@/lib/supabaseClient";

// Fetch all lists the user has access to (includes type)
export async function fetchLists(userId) {
  const { data, error } = await supabase
    .from("lists")
    .select("id, name, type, created_at, created_by, list_members!inner(role)")
    .eq("list_members.user_id", userId)
    .order("created_at", { ascending: false });

  return { data, error };
}

// Create a new list with a type
export async function createList({ name, userId, type = "todo" }) {
  const { data, error } = await supabase
    .from("lists")
    .insert([{ name, created_by: userId, type }])
    .select()
    .single();

  return { data, error };
}
