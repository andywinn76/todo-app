"use client";
import { useEffect, useState } from "react";
import { fetchTodos, toggleTodo, updateTodo, deleteTodo } from "@/lib/todos";
import { toast } from "sonner";
import { FaTrashAlt } from "react-icons/fa";
import { FaPencilAlt } from "react-icons/fa";
import { FaCheck, FaTimes } from "react-icons/fa";

export default function TodoList({ user, todos, onRefresh }) {
  const userId = user?.id;
  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState("");
  const [editPriority, setEditPriority] = useState("medium");

  async function loadTodos() {
    const { data, error } = await fetchTodos(userId);
    if (error) return toast.error("Failed to load todos");
    onRefresh();
  }

  useEffect(() => {
    if (userId) loadTodos();
  }, [userId]);

  async function handleToggle(id, completed) {
    const { error } = await toggleTodo(id, !completed);
    if (error) return toast.error("Could not update todo");
    loadTodos();
  }

  async function handleSave(id) {
    const { error } = await updateTodo(id, {
      title: editTitle,
      priority: editPriority,
    });
    if (error) return toast.error("Error saving changes");
    toast.success("Todo updated!");
    setEditingId(null);
    onRefresh();
  }

  async function handleDelete(id) {
    if (confirm("Are you sure you want to delete this todo?")) {
      const { error } = await deleteTodo(id);
      if (error) return toast.error("Error deleting todo");
      toast.success("Todo deleted");
      onRefresh();
    }
  }

  if (!todos.length) return <p className="text-gray-500">No todos found.</p>;

  return (
    <ul className="space-y-2">
      {todos.map((todo) => (
        <li
          key={todo.id}
          className={`p-2 border rounded flex items-center gap-2 ${
            todo.completed ? "bg-green-100" : "bg-orange-50"
          }`}
        >
          <input
            type="checkbox"
            checked={todo.completed}
            onChange={() => handleToggle(todo.id, todo.completed)}
          />

          {editingId === todo.id ? (
            <>
              <input
                className="flex-1 border p-1"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
              />
              <select
                value={editPriority}
                onChange={(e) => setEditPriority(e.target.value)}
                className="border p-1"
              >
                <option value="low">low</option>
                <option value="medium">medium</option>
                <option value="high">high</option>
              </select>
              <button onClick={() => handleSave(todo.id)} title="Save">
                <FaCheck />
              </button>
              <button onClick={() => setEditingId(null)} title="Cancel">
                <FaTimes />
              </button>
            </>
          ) : (
            <>
              <span
                className={`flex-1 ${todo.completed ? "line-through" : ""}`}
              >
                {todo.title}
              </span>
              <span className="text-sm text-gray-500 capitalize">
                ({todo.priority})
              </span>
              <button
                onClick={() => {
                  setEditingId(todo.id);
                  setEditTitle(todo.title);
                  setEditPriority(todo.priority);
                }}
                title="Edit"
              >
                <FaPencilAlt />
              </button>
              <button onClick={() => handleDelete(todo.id)} title="Delete">
                <FaTrashAlt />
              </button>
            </>
          )}
        </li>
      ))}
    </ul>
  );
}
