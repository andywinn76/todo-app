import { supabase } from "./supabaseClient";

export async function fetchTodos(listId) {
  const { data, error } = await supabase
    .from("todos")
    .select("*")
    .eq("list_id", listId)
    .order("created_at", { ascending: false });

  return { data, error };
}

export async function createTodo({ title, description, due_date, priority, userId, listId }) {
  const { data, error } = await supabase.from("todos").insert([
    {
      title,
      description,
      due_date,
      priority,
      created_by: userId,
      list_id: listId,
    },
  ]);
  return { data, error };
}

export async function toggleTodo(id, completed) {
  const { data, error } = await supabase
    .from("todos")
    .update({ completed })
    .eq("id", id);
  return { data, error };
}

export async function updateTodo(id, updates) {
  const { data, error } = await supabase
    .from("todos")
    .update(updates)
    .eq("id", id);

  return { data, error };
}

export async function deleteTodo(id) {
  const { data, error } = await supabase
    .from("todos")
    .delete()
    .eq("id", id);

  return { data, error };
}