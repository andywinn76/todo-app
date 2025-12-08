"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "sonner";
import { addDays, formatISO } from "date-fns";
import { useLists } from "@/components/ListsProvider";
import { LIST_TYPE_DEFAULTS } from "@/utils/listTypes";

const PRIORITIES = ["low", "medium", "high"];

export default function TodoForm({ onCreated }) {
  const { lists, activeListId } = useLists();
  const titleRef = useRef(null);

  const activeList = useMemo(
    () => lists.find((l) => String(l.id) === String(activeListId)),
    [lists, activeListId]
  );

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("medium");
  const [dueDate, setDueDate] = useState("");
  const [busy, setBusy] = useState(false);

  // progress tracking
  const [trackProgressEnabled, setTrackProgressEnabled] = useState(false);
  // const [progress, setProgress] = useState(0);

  const [dueDateEnabled, setDueDateEnabled] = useState(false);
  const [priorityEnabled, setPriorityEnabled] = useState(false);
  const [descriptionEnabled, setDescriptionEnabled] = useState(false);

  // Color for slider
  // const progressColor = useMemo(() => {
  //   const h = Math.min(120, Math.max(0, progress * 1.2));
  //   return `hsl(${h}, 70%, 45%)`;
  // }, [progress]);

  useEffect(() => {
    if (!activeList) return;

    const defaults = LIST_TYPE_DEFAULTS[activeList.list_type] || {
      priority: "medium",
      dueInDays: 3,
    };

    // Only set defaults IF the option is enabled
    if (priorityEnabled) {
      setPriority(defaults.priority);
    }

    if (dueDateEnabled) {
      const newDue = formatISO(addDays(new Date(), defaults.dueInDays), {
        representation: "date",
      });
      setDueDate((prev) => (prev ? prev : newDue));
    }
  }, [activeList?.id, activeList?.list_type, priorityEnabled, dueDateEnabled]);

  useEffect(() => {
    if (!activeListId || busy) return;
    const t = setTimeout(() => {
      const el = titleRef.current;
      if (el) {
        el.focus();
        try {
          el.setSelectionRange(el.value.length, el.value.length);
        } catch {}
      }
    }, 0);
    return () => clearTimeout(t);
  }, [activeListId, busy]);

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
        list_id: activeListId,
      };

      // Add description only when enabled
      if (descriptionEnabled) {
        payload.description = description.trim() || null;
      } else {
        payload.description = null;
      }

      // Add priority only when enabled
      if (priorityEnabled) {
        payload.priority = priority;
      } else {
        payload.priority = null;
      }

      // Add due date only when enabled
      if (dueDateEnabled) {
        payload.due_date = dueDate || null;
      } else {
        payload.due_date = null;
      }

      // Add progress only when enabled
      if (trackProgressEnabled) {
        payload.progress = 0;
      }

      const { data, error } = await supabase
        .from("todos")
        .insert(payload)
        .select()
        .single();

      if (error) throw error;

      toast.success("Todo added!");
      setTitle("");
      setDescription("");
      setTrackProgressEnabled(false);

      onCreated?.(data);
      requestAnimationFrame(() => titleRef.current?.focus());
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
      <div className="flex flex-col gap-3">
        {/* Title */}
        <input
          type="text"
          ref={titleRef}
          placeholder={
            activeList?.list_type === "Groceries"
              ? "e.g., Milk, eggs, spinach…"
              : "Add an item..."
          }
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="min-w-0 flex-1 rounded border px-3 py-2"
          disabled={!activeListId || busy}
        />

        {/* Option toggles */}
        <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-2 md:flex md:flex-wrap md:items-center">
          {/* Track progress */}
          <div className="flex items-center gap-1">
            <input
              type="checkbox"
              id="trackProgressEnabled"
              checked={trackProgressEnabled}
              onChange={(e) => setTrackProgressEnabled(e.target.checked)}
              disabled={!activeListId || busy}
            />
            <label
              htmlFor="trackProgressEnabled"
              className="text-sm text-gray-700"
            >
              Track progress
            </label>
          </div>

          {/* Add due date */}
          <div className="flex items-center gap-1">
            <input
              type="checkbox"
              id="dueDateEnabled"
              checked={dueDateEnabled}
              onChange={(e) => setDueDateEnabled(e.target.checked)}
              disabled={!activeListId || busy}
            />
            <label htmlFor="dueDateEnabled" className="text-sm text-gray-700">
              Add due date
            </label>
          </div>

          {/* Add priority */}
          <div className="flex items-center gap-1">
            <input
              type="checkbox"
              id="priorityEnabled"
              checked={priorityEnabled}
              onChange={(e) => setPriorityEnabled(e.target.checked)}
              disabled={!activeListId || busy}
            />
            <label htmlFor="priorityEnabled" className="text-sm text-gray-700">
              Add priority
            </label>
          </div>

          {/* Add description */}
          <div className="flex items-center gap-1">
            <input
              type="checkbox"
              id="descriptionEnabled"
              checked={descriptionEnabled}
              onChange={(e) => setDescriptionEnabled(e.target.checked)}
              disabled={!activeListId || busy}
            />
            <label
              htmlFor="descriptionEnabled"
              className="text-sm text-gray-700"
            >
              Add description
            </label>
          </div>
        </div>

        {/* Date + Priority row (same row when both enabled) */}
        {(dueDateEnabled || priorityEnabled) && (
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:flex-wrap">
            {/* Due date */}
            {dueDateEnabled && (
              <>
                <span>Due:</span>
                <input
                  type="date"
                  value={dueDate || ""}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="rounded border px-2 py-2 text-sm md:w-44"
                  disabled={!activeListId || busy}
                />
              </>
            )}

            {/* Priority */}
            {priorityEnabled && (
              <>
                <span>Priority:</span>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  className="rounded border px-2 py-2 text-sm md:w-40"
                  disabled={!activeListId || busy}
                >
                  {PRIORITIES.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </>
            )}
          </div>
        )}

        {/* Description */}
        {descriptionEnabled && (
          <textarea
            placeholder="Optional description…"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full rounded border px-3 py-2 text-sm"
            rows={2}
            disabled={!activeListId || busy}
          />
        )}

        {/* Submit – always at the bottom */}
        <button
          type="submit"
          disabled={!activeListId || busy}
          className="self-start rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {busy ? "Adding..." : "Add"}
        </button>
      </div>
    </form>
  );
}
