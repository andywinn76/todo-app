// src/components/TodoList.jsx
"use client";

import { useEffect, useMemo, useState, useCallback, useRef  } from "react";
import { toast } from "sonner";
import TodoItem from "@/components/TodoItem";
import { useLists } from "@/components/ListsProvider";
import {
  fetchTodos as apiFetchTodos,
  toggleTodo as apiToggleTodo,
  deleteTodo as apiDeleteTodo,
} from "@/lib/todos";

export default function TodoList({ lastCreated }) {
  const { activeListId } = useLists();

  const [todos, setTodos] = useState([]);
  const [loading, setLoading] = useState(false);

  // Track in-flight operations per-todo to disable controls on just those rows
  const [busyIds, setBusyIds] = useState(() => new Set());
  const setBusyFor = useCallback((id, isBusy) => {
    setBusyIds((prev) => {
      const next = new Set(prev);
      if (isBusy) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  // Simple fetch on list change (cancel via local flag)
  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!activeListId) {
        setTodos([]);
        return;
      }
      setLoading(true);
      const { data, error } = await apiFetchTodos(activeListId);
      if (!cancelled) {
        if (error) {
          console.error("Error fetching todos:", error);
          toast.error("Failed to fetch todos");
          setTodos([]);
        } else {
          setTodos(Array.isArray(data) ? data : []);
        }
        setLoading(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [activeListId]);

  // ⬇️ Optimistic append: when a new row is created for this list, push it locally.
  const lastHandledIdRef = useRef(null);
  useEffect(() => {
  if (!lastCreated) return;
  if (!activeListId) return;
  if (lastCreated.list_id !== activeListId) return;

  // Skip if we've already handled this id
  if (lastHandledIdRef.current === lastCreated.id) return;

  setTodos((prev) => {
    const exists = prev.some((t) => t.id === lastCreated.id);
    if (exists) return prev;
    return [...prev, lastCreated];
  });

  lastHandledIdRef.current = lastCreated.id;
}, [lastCreated, activeListId]);

  // Optimistic toggle (no refetch)
  const handleToggle = useCallback(
    async (id, nextCompleted) => {
      setTodos((prev) =>
        prev.map((t) => (t.id === id ? { ...t, completed: nextCompleted } : t))
      );
      setBusyFor(id, true);

      const { error } = await apiToggleTodo(id, nextCompleted);

      setBusyFor(id, false);

      if (error) {
        // revert on error
        setTodos((prev) =>
          prev.map((t) =>
            t.id === id ? { ...t, completed: !nextCompleted } : t
          )
        );
        toast.error("Couldn’t update the todo.");
      }
    },
    [setBusyFor]
  );

  // Optimistic delete (soft refetch on error)
  const handleDelete = useCallback(
    async (id) => {
      // optimistic remove
      let removed = null;
      setTodos((prev) => {
        const idx = prev.findIndex((t) => t.id === id);
        if (idx === -1) return prev;
        const copy = prev.slice();
        removed = copy[idx];
        copy.splice(idx, 1);
        return copy;
      });
      setBusyFor(id, true);

      const { error } = await apiDeleteTodo(id);

      setBusyFor(id, false);

      if (error) {
        toast.error("Couldn’t delete the todo. Restoring…");
        // restore locally
        setTodos((prev) => {
          if (!removed) return prev;
          return [...prev, removed];
        });
        // soft refetch to re-sync ordering
        const { data: refetch, error: refetchErr } = await apiFetchTodos(
          activeListId
        );
        if (refetchErr) {
          console.error(refetchErr);
          toast.error("Failed to restore list.");
        } else {
          setTodos(Array.isArray(refetch) ? refetch : []);
        }
      } else {
        toast.success("Todo deleted");
      }
    },
    [activeListId, setBusyFor]
  );

  const isEmpty = useMemo(
    () => !loading && todos.length === 0,
    [loading, todos.length]
  );

  if (!activeListId) {
    return (
      <p className="mt-6 text-gray-600 text-center">
        Select a list to view its todos.
      </p>
    );
  }

  return (
    <div className="mt-6">
      {loading ? (
        <p className="text-gray-500">Loading items...</p>
      ) : isEmpty ? (
        <p className="text-gray-700 text-2xl">No items.</p>
      ) : (
        <ul className="space-y-2">
          {todos.map((todo) => (
            <TodoItem
              key={todo.id}
              todo={todo}
              busy={busyIds.has(todo.id)}
              onToggle={(nextCompleted) => handleToggle(todo.id, nextCompleted)}
              onDelete={() => handleDelete(todo.id)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
