"use client";

import { memo, useMemo, useCallback } from "react";
import { format } from "date-fns";
import { FaPencilAlt } from "react-icons/fa";
import DeleteIconButton from "./DeleteIconButton";

function TodoItem({ todo, onToggle, onDelete, onUpdate, onEdit, busy = false }) {
  const progressColor = useMemo(() => {
    if (todo.progress == null) return null;
    const h = Math.min(120, Math.max(0, todo.progress * 1.2));
    return `hsl(${h}, 70%, 45%)`;
  }, [todo.progress]);

  const handleProgressChange = useCallback(
    (e) => {
      const next = Number(e.target.value);
      if (Number.isNaN(next)) return;

      if (next === 100) {
        onUpdate?.({ progress: 100, completed: true });
      } else {
        onUpdate?.({ progress: next, completed: false });
      }
    },
    [onUpdate]
  );

  return (
    <li
      className={`flex items-start gap-2 border-b-1 border-slate-300 bg-white p-2 shadow-sm ${
        todo.completed ? "opacity-60" : ""
      }`}
    >
      <input
        type="checkbox"
        className="mt-1 size-4"
        checked={!!todo.completed}
        disabled={busy}
        onChange={(e) => onToggle?.(e.target.checked)}
      />

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p
            className={`truncate font-medium ${
              todo.completed
                ? "line-through text-gray-500"
                : "text-gray-900"
            }`}
          >
            {todo.title}
          </p>
        </div>

        {todo.description && (
          <p className="mt-1 text-sm text-gray-600 whitespace-pre-wrap">
            {todo.description}
          </p>
        )}

        {todo.progress != null && (
          <div className="mt-2 flex items-center gap-2">
            <input
              type="range"
              min="0"
              max="100"
              step="1"
              value={todo.progress}
              onChange={handleProgressChange}
              className="flex-1 appearance-none h-1 rounded-lg bg-gray-200 outline-none cursor-pointer
                         [&::-webkit-slider-thumb]:appearance-none
                         [&::-webkit-slider-thumb]:w-4
                         [&::-webkit-slider-thumb]:h-4
                         [&::-webkit-slider-thumb]:rounded-full
                         [&::-webkit-slider-thumb]:bg-white
                         [&::-webkit-slider-thumb]:border
                         [&::-webkit-slider-thumb]:border-gray-400
                         [&::-webkit-slider-thumb]:shadow"
              style={{
                background: progressColor
                  ? `linear-gradient(to right, ${progressColor} ${todo.progress}%, #e5e7eb ${todo.progress}%)`
                  : undefined,
              }}
            />
            <span className="text-xs text-gray-600 w-8 text-right">
              {todo.progress}%
            </span>
          </div>
        )}

        <div className="mt-1 text-xs text-gray-500 flex items-center gap-3">
          {todo.due_date && (
            <span>
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
            >
              {todo.priority}
            </span>
          )}
        </div>
      </div>

      {/* Edit + Delete */}
      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          className="text-blue-600 hover:text-blue-700 p-1"
          disabled={busy}
          onClick={() => onEdit?.(todo)}
          title="Edit item"
        >
          <FaPencilAlt className="w-5 h-5" />
        </button>

        <DeleteIconButton
          onClick={() => onDelete?.()}
          disabled={busy}
        />
      </div>
    </li>
  );
}

export default memo(TodoItem);
