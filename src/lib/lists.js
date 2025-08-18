import { supabase } from "@/lib/supabaseClient";

// fetch all lists the user has access to
export async function fetchLists(userId) {
  const { data, error } = await supabase
    .from("lists")
    .select("id, name, created_at, created_by, list_members!inner(role)")
    .eq("list_members.user_id", userId)
    .order("created_at", { ascending: false });

  return { data, error };
}

// create a new list
export async function createList({ name, userId }) {
  const { data, error } = await supabase
    .from("lists")
    .insert([{ name, created_by: userId }])
    .select()
    .single();

  return { data, error };
}
