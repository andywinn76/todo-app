"use client";
import { useState } from "react";
import { toggleTodo, updateTodo, deleteTodo } from "@/lib/todos";
import { toast } from "sonner";
import { FaTrashAlt, FaPencilAlt, FaCheck, FaTimes } from "react-icons/fa";

export default function TodoList({ user, todos, onRefresh }) {
  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState("");
  const [editPriority, setEditPriority] = useState("medium");

  async function handleToggle(id, completed) {
    const { error } = await toggleTodo(id, !completed);
    if (error) return toast.error("Could not update todo");
    onRefresh?.();
  }

  async function handleSave(id) {
    const { error } = await updateTodo(id, {
      title: editTitle,
      priority: editPriority,
    });
    if (error) return toast.error("Error saving changes");
    toast.success("Todo updated!");
    setEditingId(null);
    onRefresh?.();
  }

  async function handleDelete(id) {
    if (confirm("Are you sure you want to delete this todo?")) {
      const { error } = await deleteTodo(id);
      if (error) return toast.error("Error deleting todo");
      toast.success("Todo deleted");
      onRefresh?.();
    }
  }

  if (!todos || todos.length === 0) {
    return (
      <div className="text-center">
        <p className="text-gray-700 text-2xl">No todos found.</p>
        <p className="text-gray-500 text-xl mt-3">
          Use the add button to add items to your list.
        </p>
      </div>
    );
  }

  return (
    <ul className="space-y-2">
      {todos.map((todo) => {
        const isEditing = editingId === todo.id;
        return (
          <li
            key={todo.id}
            className={`p-2 border rounded flex flex-wrap items-center gap-2 ${
              todo.completed ? "bg-green-100" : "bg-orange-50"
            }`}
          >
            <input
              type="checkbox"
              checked={todo.completed}
              onChange={() => handleToggle(todo.id, todo.completed)}
              className="flex-none disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label={todo.completed ? "Mark as not completed" : "Mark as completed"}
              disabled={isEditing}
            />

            {isEditing ? (
              <div className="w-full md:w-auto flex-1 min-w-0 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                <input
                  className="min-w-0 flex-1 w-full border p-2 rounded"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  placeholder="Edit title"
                />

                <select
                  value={editPriority}
                  onChange={(e) => setEditPriority(e.target.value)}
                  className="w-full sm:w-40 border p-2 rounded"
                >
                  <option value="low">low</option>
                  <option value="medium">medium</option>
                  <option value="high">high</option>
                </select>

                <div className="flex w-full sm:w-auto gap-2 justify-end sm:justify-start">
                  <button
                    className="p-2 rounded hover:bg-gray-200"
                    onClick={() => handleSave(todo.id)}
                    title="Save"
                    aria-label="Save"
                  >
                    <FaCheck />
                  </button>
                  <button
                    className="p-2 rounded hover:bg-gray-200"
                    onClick={() => setEditingId(null)}
                    title="Cancel"
                    aria-label="Cancel"
                  >
                    <FaTimes />
                  </button>
                </div>
              </div>
            ) : (
              <div className="w-full md:w-auto flex-1 min-w-0 flex flex-wrap items-center gap-2">
                <span className={`min-w-0 flex-1 ${todo.completed ? "line-through" : ""}`}>
                  {todo.title}
                </span>

                <span className="text-sm text-gray-500 capitalize">
                  ( {todo.priority} )
                </span>

                <div className="flex gap-2 ml-auto">
                  <button
                    onClick={() => {
                      setEditingId(todo.id);
                      setEditTitle(todo.title);
                      setEditPriority(todo.priority);
                    }}
                    title="Edit"
                    className="p-2 rounded hover:bg-gray-200"
                    aria-label="Edit"
                  >
                    <FaPencilAlt />
                  </button>
                  <button
                    onClick={() => handleDelete(todo.id)}
                    title="Delete"
                    className="p-2 rounded hover:bg-gray-200"
                    aria-label="Delete"
                  >
                    <FaTrashAlt />
                  </button>
                </div>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
