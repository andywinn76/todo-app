"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "sonner";
import { format } from "date-fns";
import DeleteIconButton from "./DeleteIconButton";

export default function TodoItem({ todo, onUpdate }) {
  const [busy, setBusy] = useState(false);

  async function toggleComplete() {
    try {
      setBusy(true);
      const { error } = await supabase
        .from("todos")
        .update({ completed: !todo.completed })
        .eq("id", todo.id)
        .select()
        .single();

      if (error) throw error;
      onUpdate?.();
    } catch (err) {
      console.error(err);
      toast.error("Couldn’t update the todo.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteTodo() {
    try {
      setBusy(true);
      const { error } = await supabase.from("todos").delete().eq("id", todo.id);
      if (error) throw error;
      toast.success("Todo deleted");
      onUpdate?.();
    } catch (err) {
      console.error(err);
      toast.error("Couldn’t delete the todo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <li
      className={`flex items-start gap-3 rounded border bg-white p-3 shadow-sm ${
        todo.completed ? "opacity-70" : ""
      }`}
    >
      <input
        type="checkbox"
        className="mt-1 size-4"
        checked={!!todo.completed}
        disabled={busy}
        onChange={toggleComplete}
      />

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p
            className={`truncate font-medium ${
              todo.completed ? "line-through text-gray-500" : "text-gray-900"
            }`}
            title={todo.title}
          >
            {todo.title}
          </p>
        </div>

        {todo.description && (
          <p className="mt-1 text-sm text-gray-600 whitespace-pre-wrap">
            {todo.description}
          </p>
        )}

        <div className="mt-1 text-xs text-gray-500 flex items-center gap-3">
          {todo.due_date && (
            <span title="Due date">
              Due {format(new Date(todo.due_date), "MMM d, yyyy")}
            </span>
          )}
          {todo.priority && (
            <span
              className={`rounded px-1.5 py-0.5 text-[10px] ring-1 ${
                todo.priority === "high"
                  ? "bg-red-100 text-red-700 ring-red-200"
                  : todo.priority === "medium"
                  ? "bg-amber-100 text-amber-800 ring-amber-200"
                  : "bg-gray-100 text-gray-700 ring-gray-200"
              }`}
              title={`Priority: ${todo.priority}`}
            >
              {todo.priority}
            </span>
          )}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {/* Small edit hook if I decide to add inline editing later */}
        <DeleteIconButton
          onClick={deleteTodo}
          disabled={busy}
          title="Delete item"
          aria-label="Delete item"
        />
      </div>
    </li>
  );
}
