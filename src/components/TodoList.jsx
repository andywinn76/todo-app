"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "sonner";
import TodoItem from "@/components/TodoItem";
import { useLists } from "@/components/ListsProvider";
import ListTypeBadge from "@/components/ListTypeBadge";

export default function TodoList() {
  const { lists, activeListId } = useLists();
  const [todos, setTodos] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!activeListId) {
      setTodos([]);
      return;
    }
    fetchTodos(activeListId);
  }, [activeListId]);

  async function fetchTodos(listId) {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("todos")
        .select("*")
        .eq("list_id", listId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setTodos(data || []);
    } catch (err) {
      console.error("Error fetching todos:", err);
      toast.error("Failed to fetch todos");
    } finally {
      setLoading(false);
    }
  }

  if (!activeListId) {
    return (
      <p className="mt-6 text-gray-600 text-center">
        Select a list to view its todos.
      </p>
    );
  }

  const activeList = lists.find((l) => String(l.id) === String(activeListId));

  return (
    <div className="mt-6">
      <div className="mb-4 flex items-center gap-2">
        
        
      </div>

      {loading ? (
        <p className="text-gray-500">Loading lists...</p>
      ) : todos.length === 0 ? (
        <p className="text-gray-700 text-2xl">No items.</p>
      ) : (
        <ul className="space-y-2">
          {todos.map((todo) => (
            <TodoItem
              key={todo.id}
              todo={todo}
              onUpdate={() => fetchTodos(activeListId)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
