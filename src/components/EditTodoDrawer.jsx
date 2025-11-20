"use client";

import { useEffect, useState, useRef } from "react";

const PRIORITIES = ["low", "medium", "high"];

export default function EditTodoDrawer({ todo, onClose, onSave }) {
  const titleRef = useRef(null);

  const [title, setTitle] = useState(todo.title || "");
  const [description, setDescription] = useState(todo.description || "");
  const [priority, setPriority] = useState(todo.priority || "medium");
  const [dueDate, setDueDate] = useState(todo.due_date || "");
  const [saving, setSaving] = useState(false);

  const [descriptionEnabled, setDescriptionEnabled] = useState(
    !!todo.description
  );
  const [priorityEnabled, setPriorityEnabled] = useState(!!todo.priority);
  const [dueDateEnabled, setDueDateEnabled] = useState(!!todo.due_date);
  const [trackProgressEnabled, setTrackProgressEnabled] = useState(
    todo.progress != null
  );

  // Focus on drawer open
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        titleRef.current?.focus();
        titleRef.current?.setSelectionRange(
          titleRef.current.value.length,
          titleRef.current.value.length
        );
      } catch {}
    }, 60);
    return () => clearTimeout(t);
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!title.trim()) return;

    try {
      setSaving(true);

      const updates = { title: title.trim() };

      // Description
      updates.description = descriptionEnabled
        ? description.trim() || null
        : null;

      // Priority
      updates.priority = priorityEnabled ? priority : null;

      // Due date
      updates.due_date = dueDateEnabled ? dueDate || null : null;

      // Track progress (NO slider here)
      const hadProgress = todo.progress != null;
      if (trackProgressEnabled && !hadProgress) {
        updates.progress = 0; // enable tracking
      } else if (!trackProgressEnabled && hadProgress) {
        updates.progress = null; // disable tracking
      }

      await onSave?.(updates);
      onClose?.();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex">
      {/* Backdrop */}
      <button
        type="button"
        onClick={onClose}
        className="flex-1 bg-black/30 backdrop-blur-sm"
        aria-label="Close edit panel"
      />

      {/* Drawer */}
      <div className="w-full max-w-md h-full bg-white shadow-2xl border-l
                      transform transition-transform duration-300 ease-out translate-x-0
                      flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h2 className="text-lg font-semibold text-gray-800">Edit item</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-xl"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <form
          onSubmit={handleSubmit}
          className="flex-1 overflow-y-auto px-4 py-3 space-y-4"
        >
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Title
            </label>
            <input
              ref={titleRef}
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded border px-3 py-2 text-sm"
            />
          </div>

          {/* Toggles */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={descriptionEnabled}
                onChange={(e) => setDescriptionEnabled(e.target.checked)}
              />
              Add description
            </label>

            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={priorityEnabled}
                onChange={(e) => setPriorityEnabled(e.target.checked)}
              />
              Add priority
            </label>

            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={dueDateEnabled}
                onChange={(e) => setDueDateEnabled(e.target.checked)}
              />
              Add due date
            </label>

            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={trackProgressEnabled}
                onChange={(e) => setTrackProgressEnabled(e.target.checked)}
              />
              Track progress
            </label>
          </div>

          {/* Description */}
          {descriptionEnabled && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full rounded border px-3 py-2 text-sm"
                placeholder="Optional description…"
              />
            </div>
          )}

          {/* Priority */}
          {priorityEnabled && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Priority
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="rounded border px-2 py-2 text-sm w-full max-w-xs"
              >
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    Priority: {p}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Due date */}
          {dueDateEnabled && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Due date
              </label>
              <input
                type="date"
                value={dueDate || ""}
                onChange={(e) => setDueDate(e.target.value)}
                className="rounded border px-2 py-2 text-sm w-full max-w-xs"
              />
            </div>
          )}

          {/* Footer */}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 rounded border text-sm text-gray-700 hover:bg-gray-50"
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
