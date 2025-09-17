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
      {/* 
        Mobile: stacked in this order → Title, Description, Priority, Date, Add
        Desktop (md+): single row for Title / Priority / Date / Add, with Description moved below full-width
      */}
      <div className="flex flex-col gap-3 md:flex-row md:flex-wrap">
        {/* Title */}
        <input
          type="text"
          placeholder={
            activeList?.list_type === "Groceries"
              ? "e.g., Milk, eggs, spinach…"
              : "What needs doing?"
          }
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="min-w-0 flex-1 rounded border px-3 py-2"
          disabled={!activeListId || busy}
          autoFocus
        />

        {/* Description (placed before the button in DOM so it stays above on mobile) */}
        <textarea
          placeholder="Optional description…"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full rounded border px-3 py-2 text-sm md:order-last md:basis-full"
          rows={2}
          disabled={!activeListId || busy}
        />

        {/* Priority */}
        <select
          value={priority}
          onChange={(e) => setPriority(e.target.value)}
          className="rounded border px-2 py-2 text-sm md:w-40"
          disabled={!activeListId || busy}
        >
          {PRIORITIES.map((p) => (
            <option key={p} value={p}>
              Priority: {p}
            </option>
          ))}
        </select>

        {/* Due date */}
        <input
          type="date"
          value={dueDate || ""}
          onChange={(e) => setDueDate(e.target.value)}
          className="rounded border px-2 py-2 text-sm md:w-44"
          disabled={!activeListId || busy}
        />

        {/* Submit */}
        <button
          type="submit"
          disabled={!activeListId || busy}
          className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {busy ? "Adding..." : "Add"}
        </button>
      </div>
    </form>
  );
}
