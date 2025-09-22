// lib/groceries.js
import { supabase } from "@/lib/supabaseClient";

/** Columns we care about for UI rendering */
const SELECT_COLS =
  "id, list_id, name, quantity, is_checked, created_at";

/** Fetch all grocery items for a given list, unchecked first then by created_at */
export async function fetchGroceries(listId) {
  if (!listId) return { data: [], error: null };

  const { data, error } = await supabase
    .from("grocery_items")
    .select(SELECT_COLS)
    .eq("list_id", String(listId))
    .order("is_checked", { ascending: true })
    .order("created_at", { ascending: true });

  return { data: Array.isArray(data) ? data : [], error };
}

/** Insert a new grocery item */
export async function insertGrocery({ list_id, name, quantity = null }) {
  const { data, error } = await supabase
    .from("grocery_items")
    .insert([{ list_id, name, quantity }])
    .select(SELECT_COLS)
    .single();

  return { data, error };
}

/** Toggle is_checked explicitly to the given boolean */
export async function setGroceryChecked(id, is_checked) {
  const { data, error } = await supabase
    .from("grocery_items")
    .update({ is_checked })
    .eq("id", id)
    .select(SELECT_COLS)
    .single();

  return { data, error };
}

/** Update arbitrary fields for a grocery item */
export async function updateGrocery(id, patch) {
  const { data, error } = await supabase
    .from("grocery_items")
    .update(patch)
    .eq("id", id)
    .select(SELECT_COLS)
    .single();

  return { data, error };
}

/** Delete by id */
export async function deleteGrocery(id) {
  const { error } = await supabase.from("grocery_items").delete().eq("id", id);
  return { error };
}
