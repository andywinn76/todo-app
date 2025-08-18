"use client";

import { useState } from "react";
import { toast } from "sonner";
import { createTodo } from "@/lib/todos";

export default function TodoForm({ user, listId, onTodoAdded, isActive, setIsActive }) {
  const userId = user?.id;
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState("medium");
  const [dueDate, setDueDate] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!listId) {
      toast.error("Select or create a list first");
      return;
    }
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }
    if (!priority) {
      toast.error("Priority must be selected");
      return;
    }
    if (!dueDate) {
      toast.error("Due date is required");
      return;
    }

    setSaving(true);
    const { error } = await createTodo({
      title,
      description,
      due_date: dueDate,
      priority,
      userId,
      listId,              // ← add this
    });
    setSaving(false);

    if (error) {
      toast.error("Failed to add todo");
    } else {
      toast.success("Todo added!");
      setTitle("");
      setPriority("medium");
      setDueDate("");
      setDescription("");
      setIsActive(false);      // close the form after adding
      onTodoAdded?.();         // refresh list
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 p-4 bg-white rounded shadow">
      <div>
        <label className="block font-semibold">Title *</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full border px-3 py-2 rounded"
          required
        />
      </div>

      <div>
        <label className="block font-semibold">Priority *</label>
        <select
          value={priority}
          onChange={(e) => setPriority(e.target.value)}
          className="w-full border px-3 py-2 rounded"
          required
        >
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </select>
      </div>

      <div>
        <label className="block font-semibold">Due Date *</label>
        <input
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          className="w-full border px-3 py-2 rounded"
          required
        />
      </div>

      <div>
        <label className="block font-semibold">Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full border px-3 py-2 rounded"
        />
      </div>

      <button
        type="submit"
        disabled={saving || !listId}
        title={!listId ? "Select or create a list first" : ""}
        className={`${
          saving ? "opacity-75 cursor-not-allowed" : ""
        } bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700`}
      >
        {saving ? "Adding..." : "Add Todo"}
      </button>
    </form>
  );
}
