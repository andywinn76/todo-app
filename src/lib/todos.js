import { supabase } from "./supabaseClient";

//Fetch all todos for a given list
export async function fetchTodos(listId) {
  const { data, error } = await supabase
    .from("todos")
    .select("*")
    .eq("list_id", listId)
    .order("due_date", { ascending: true })
    .order("created_at", { ascending: false });

  return { data, error };
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
    } = input || {};

    const listIdNormalized = listId ?? list_id;

    if (!listIdNormalized) {
      return { data: null, error: new Error("Missing listId/list_id") };
    }

    const payload = {
      title: (title ?? "").trim(),
      description: (description ?? "").trim() || null,
      due_date, 
      priority,
      list_id: String(listIdNormalized),
    };

    console.log("createTodo payload", payload); 

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
 * Update arbitrary fields (title, description, due_date, priority, etc.)
 */
export async function updateTodo(id, updates) {
  const sanitized = { ...updates };
  if (typeof sanitized.title === "string") {
    sanitized.title = sanitized.title.trim();
  }
  if (typeof sanitized.description === "string") {
    sanitized.description = sanitized.description.trim();
  }

  const { data, error } = await supabase
    .from("todos")
    .update(sanitized)
    .eq("id", id);

  return { data, error };
}

/**
 * Delete a todo by id.
 */
export async function deleteTodo(id) {
  const { data, error } = await supabase.from("todos").delete().eq("id", id);
  return { data, error };
}
