// "use client";
// import { useState } from "react";
// import { toast } from "sonner";
// import { createTodo } from "@/lib/todos";
// import { useLists } from "@/components/ListsProvider";

// export default function TodoForm({ user, onTodoAdded, isActive, setIsActive }) {
//   const { activeListId } = useLists(); 
//   const [title, setTitle] = useState("");
//   const [priority, setPriority] = useState("medium");
//   const [dueDate, setDueDate] = useState("");
//   const [description, setDescription] = useState("");
//   const [saving, setSaving] = useState(false);

//   const handleSubmit = async (e) => {
//     e.preventDefault();
//     if (saving) return;

//     if (!activeListId) return toast.error("Select or create a list first");
//     if (!title.trim()) return toast.error("Title is required");
//     if (!priority) return toast.error("Priority must be selected");
//     if (!dueDate) return toast.error("Due date is required");

//     setSaving(true);
//     try {
//       const { error } = await createTodo({
//         title: title.trim(),
//         description,
//         due_date: dueDate,
//         priority,
//         listId: activeListId, // ← guaranteed from provider
//       });
//       if (error) {
//         console.error("createTodo error", error);
//         toast.error("Failed to add todo");
//         return;
//       }

//       toast.success("Todo added!");
//       setTitle("");
//       setPriority("medium");
//       setDueDate("");
//       setDescription("");
//       setIsActive(false);
//       onTodoAdded?.();
//     } finally {
//       setSaving(false);
//     }
//   };

//   return (
//     <form onSubmit={handleSubmit} className="space-y-4 p-4 bg-white rounded shadow">
//       <div>
//         <label className="block font-semibold">Title *</label>
//         <input
//           type="text"
//           value={title}
//           onChange={(e) => setTitle(e.target.value)}
//           className="w-full border px-3 py-2 rounded"
//           required
//         />
//       </div>

//       <div>
//         <label className="block font-semibold">Priority *</label>
//         <select
//           value={priority}
//           onChange={(e) => setPriority(e.target.value)}
//           className="w-full border px-3 py-2 rounded"
//           required
//         >
//           <option value="low">Low</option>
//           <option value="medium">Medium</option>
//           <option value="high">High</option>
//         </select>
//       </div>

//       <div>
//         <label className="block font-semibold">Due Date *</label>
//         <input
//           type="date"
//           value={dueDate}
//           onChange={(e) => setDueDate(e.target.value)}
//           className="w-full border px-3 py-2 rounded"
//           required
//         />
//       </div>

//       <div>
//         <label className="block font-semibold">Description</label>
//         <textarea
//           value={description}
//           onChange={(e) => setDescription(e.target.value)}
//           className="w-full border px-3 py-2 rounded"
//         />
//       </div>

//       <button
//         type="submit"
//         disabled={saving || !activeListId}
//         title={!activeListId ? "Select or create a list first" : ""}
//         className={`${saving ? "opacity-75 cursor-not-allowed" : ""} bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700`}
//       >
//         {saving ? "Adding..." : "Add Todo"}
//       </button>
//     </form>
//   );
// }
"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "sonner";
import { addDays, formatISO } from "date-fns";
import { useLists } from "@/components/ListsProvider";
import { LIST_TYPE_DEFAULTS } from "@/utils/listTypes";

const PRIORITIES = ["low", "medium", "high"];

export default function TodoForm({ onCreated }) {
  const { lists, activeListId } = useLists();

  const activeList = useMemo(
    () => lists.find((l) => String(l.id) === String(activeListId)),
    [lists, activeListId]
  );

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("medium");
  const [dueDate, setDueDate] = useState("");
  const [busy, setBusy] = useState(false);

  // When the list (and thus list_type) changes, set sensible defaults
  useEffect(() => {
    if (!activeList) return;

    const defaults = LIST_TYPE_DEFAULTS[activeList.list_type] || {
      priority: "medium",
      dueInDays: 3,
    };

    setPriority(defaults.priority);

    // Only auto-set due date if empty or switching lists
    const newDue = formatISO(addDays(new Date(), defaults.dueInDays), {
      representation: "date",
    });
    setDueDate((prev) => (prev ? prev : newDue));
  }, [activeList?.id, activeList?.list_type]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSubmit(e) {
    e.preventDefault();
    if (!activeListId) {
      toast.error("Pick a list first.");
      return;
    }
    if (!title.trim()) {
      toast.error("Please enter a title.");
      return;
    }

    try {
      setBusy(true);

      const payload = {
        title: title.trim(),
        description: description.trim() || null,
        priority,
        due_date: dueDate || null,
        list_id: activeListId,
      };

      const { data, error } = await supabase
        .from("todos")
        .insert(payload)
        .select()
        .single();

      if (error) throw error;

      toast.success("Todo added!");
      setTitle("");
      setDescription("");
      // Keep the priority/due date defaults tied to list_type for faster entry
      onCreated?.(data);
    } catch (err) {
      console.error(err);
      toast.error("Couldn’t create the todo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded border bg-white p-3 shadow-sm"
    >
      <div className="flex flex-col gap-3 md:flex-row">
        <input
          type="text"
          placeholder={
            activeList?.list_type === "Groceries"
              ? "e.g., Milk, eggs, spinach…"
              : "What needs doing?"
          }
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="flex-1 rounded border px-3 py-2"
          disabled={!activeListId || busy}
          autoFocus
        />

        <select
          value={priority}
          onChange={(e) => setPriority(e.target.value)}
          className="rounded border px-2 py-2 text-sm"
          disabled={!activeListId || busy}
        >
          {PRIORITIES.map((p) => (
            <option key={p} value={p}>
              Priority: {p}
            </option>
          ))}
        </select>

        <input
          type="date"
          value={dueDate || ""}
          onChange={(e) => setDueDate(e.target.value)}
          className="rounded border px-2 py-2 text-sm"
          disabled={!activeListId || busy}
        />

        <button
          type="submit"
          disabled={!activeListId || busy}
          className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
        >
          Add
        </button>
      </div>

      <textarea
        placeholder="Optional description…"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        className="mt-3 w-full rounded border px-3 py-2 text-sm"
        rows={2}
        disabled={!activeListId || busy}
      />
    </form>
  );
}
