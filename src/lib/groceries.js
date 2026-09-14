// lib/groceries.js
import { supabase } from "@/lib/supabaseClient";

/** Columns we care about for UI rendering */
const SELECT_COLS =
  "id, list_id, name, quantity, is_checked, created_at";

const orderKey = (listId) => `grocery-order:${listId}`;

function applyLocalOrder(listId, items) {
  if (typeof window === "undefined") return items;
  try {
    const ids = JSON.parse(localStorage.getItem(orderKey(listId)) || "[]");
    const positions = new Map(ids.map((id, index) => [String(id), index]));
    return [...items].sort((a, b) =>
      (positions.get(String(a.id)) ?? Infinity) - (positions.get(String(b.id)) ?? Infinity)
    );
  } catch {
    return items;
  }
}

/** Fetch grocery items in their saved custom order, with a legacy fallback. */
export async function fetchGroceries(listId) {
  if (!listId) return { data: [], error: null, supportsPosition: false };

  const ordered = await supabase
    .from("grocery_items")
    .select(`${SELECT_COLS}, position`)
    .eq("list_id", String(listId))
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });

  if (!ordered.error) {
    return { data: Array.isArray(ordered.data) ? ordered.data : [], error: null, supportsPosition: true };
  }
  if (ordered.error.code !== "42703" && ordered.error.code !== "PGRST204") {
    return { data: [], error: ordered.error, supportsPosition: false };
  }

  const { data, error } = await supabase
    .from("grocery_items")
    .select(SELECT_COLS)
    .eq("list_id", String(listId))
    .order("is_checked", { ascending: true })
    .order("created_at", { ascending: true });

  return { data: applyLocalOrder(listId, Array.isArray(data) ? data : []), error, supportsPosition: false };
}

export async function reorderGroceries(listId, items, supportsPosition) {
  if (!supportsPosition) {
    try {
      localStorage.setItem(orderKey(listId), JSON.stringify(items.map((item) => item.id)));
      return { error: null };
    } catch (error) {
      return { error };
    }
  }
  const results = await Promise.all(
    items.map((item, position) =>
      supabase.from("grocery_items").update({ position }).eq("id", item.id)
    )
  );
  return { error: results.find((result) => result.error)?.error ?? null };
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
