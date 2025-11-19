import { supabase } from "./supabaseClient";

//Fetch all todos for a given list
export async function fetchTodos(listId) {
  if (!listId) return { data: [], error: null };

  const { data, error } = await supabase
    .from("todos")
    .select("*")
    .eq("list_id", String(listId))
    .order("due_date", { ascending: true })
    .order("created_at", { ascending: false });

  return { data: data ?? [], error };
}

//Create a new item
export async function createTodo(input) {
  try {
    const {
      title,
      description,
      due_date,
      priority,
      userId, // ignored; DB should set created_by DEFAULT auth.uid()
      listId, // camelCase
      list_id, // snake_case
      progress, // Optional progress field 0-100
    } = input || {};

    const listIdNormalized = listId ?? list_id;

    if (!listIdNormalized) {
      return { data: null, error: new Error("Missing listId/list_id") };
    }

    // Normalize progress if provided
    let normalizedProgress = null;
    if (typeof progress === "number") {
      const num = Math.round(progress);
      if (!Number.isNaN(num)) {
        normalizedProgress = Math.min(100, Math.max(0, num));
      }
    }

    const payload = {
      title: (title ?? "").trim(),
      description: (description ?? "").trim() || null,
      due_date,
      priority,
      list_id: String(listIdNormalized),
      // Only send progress if we successfully normalized it
      ...(normalizedProgress !== null ? { progress: normalizedProgress } : {}),
    };

    // console.log("createTodo payload", payload);

    const { data, error } = await supabase
      .from("todos")
      .insert([payload])
      .select()
      .single();

    if (error) console.error("createTodo supabase error", error);
    return { data, error };
  } catch (err) {
    console.error("createTodo unexpected error", err);
    return { data: null, error: err };
  }
}

/**
 * Toggle completion.
 * (RLS should ensure the caller is a member of the list for this todo.)
 */
export async function toggleTodo(id, completed) {
  const { data, error } = await supabase
    .from("todos")
    .update({ completed })
    .eq("id", id);
  return { data, error };
}

/**
 * Update arbitrary fields (title, description, due_date, priority, progress, etc.)
 */
export async function updateTodo(id, updates) {
  const sanitized = { ...updates };
  if (typeof sanitized.title === "string") {
    sanitized.title = sanitized.title.trim();
  }
  if (typeof sanitized.description === "string") {
    sanitized.description = sanitized.description.trim();
  }

  // NEW: normalize progress if present
  if ("progress" in sanitized) {
    const value = sanitized.progress;

    if (value == null) {
      // allow explicitly clearing progress
      sanitized.progress = null;
    } else {
      const num = Math.round(Number(value));
      if (Number.isNaN(num)) {
        // bad value – don’t send it at all
        delete sanitized.progress;
      } else {
        sanitized.progress = Math.min(100, Math.max(0, num));
      }
    }
  }

  const { data, error } = await supabase
    .from("todos")
    .update(sanitized)
    .eq("id", id);

  return { data, error };
}

//Delete a todo by ID
export async function deleteTodo(id) {
  const { data, error } = await supabase.from("todos").delete().eq("id", id);
  return { data, error };
}
