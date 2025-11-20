// src/components/TodoList.jsx
"use client";

import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { toast } from "sonner";
import TodoItem from "@/components/TodoItem";
import { useLists } from "@/components/ListsProvider";
import {
  fetchTodos as apiFetchTodos,
  updateTodo as apiUpdateTodo,
  deleteTodo as apiDeleteTodo,
} from "@/lib/todos";

export default function TodoList({ lastCreated }) {
  const { activeListId } = useLists();

  const [todos, setTodos] = useState([]);
  const [loading, setLoading] = useState(false);

  // Track in-flight operations per-todo
  const [busyIds, setBusyIds] = useState(() => new Set());
  const setBusyFor = useCallback((id, isBusy) => {
    setBusyIds((prev) => {
      const next = new Set(prev);
      if (isBusy) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  // Initial fetch whenever the active list changes
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

  // Optimistic append for newly created todo
  const lastHandledIdRef = useRef(null);
  useEffect(() => {
    if (!lastCreated) return;
    if (!activeListId) return;
    if (lastCreated.list_id !== activeListId) return;

    if (lastHandledIdRef.current === lastCreated.id) return;

    setTodos((prev) => {
      const exists = prev.some((t) => t.id === lastCreated.id);
      if (exists) return prev;
      return [...prev, lastCreated];
    });

    lastHandledIdRef.current = lastCreated.id;
  }, [lastCreated, activeListId]);

  // ----------------------------------------------------------
  // TOGGLE COMPLETION (now also keeps progress in sync)
  // ----------------------------------------------------------
  const handleToggle = useCallback(
    async (id, nextCompleted) => {
      // Look up current todo to decide how progress should change
      const current = todos.find((t) => t.id === id);
      let newProgress =
        current && current.progress != null ? current.progress : null;

      if (newProgress != null) {
        if (nextCompleted) {
          // Checking the box: force to 100%
          newProgress = 100;
        } else if (newProgress === 100) {
          // Unchecking from 100%: reset to 0
          newProgress = 0;
        }
        // If progress was e.g. 50 and we uncheck, leave as 50
      }

      // Optimistic update
      setTodos((prev) =>
        prev.map((t) =>
          t.id === id
            ? {
                ...t,
                completed: nextCompleted,
                ...(newProgress != null ? { progress: newProgress } : {}),
              }
            : t
        )
      );

      setBusyFor(id, true);

      const updates = {
        completed: nextCompleted,
        ...(newProgress != null ? { progress: newProgress } : {}),
      };

      const { error } = await apiUpdateTodo(id, updates);

      setBusyFor(id, false);

      if (error) {
        toast.error("Couldn’t update the todo.");
        // Refetch to restore authoritative state
        const { data: refetch, error: refetchErr } = await apiFetchTodos(
          activeListId
        );
        if (refetchErr) {
          console.error(refetchErr);
          toast.error("Failed to restore list.");
        } else {
          setTodos(Array.isArray(refetch) ? refetch : []);
        }
      }
    },
    [todos, activeListId, setBusyFor]
  );

  // ----------------------------------------------------------
  // UPDATE (partial updates: progress, title, description, etc.)
  // ----------------------------------------------------------
  const handleUpdate = useCallback(
    async (id, partial) => {
      // Optimistic update
      setTodos((prev) =>
        prev.map((t) => (t.id === id ? { ...t, ...partial } : t))
      );
      setBusyFor(id, true);

      const { error } = await apiUpdateTodo(id, partial);

      setBusyFor(id, false);

      if (error) {
        toast.error("Couldn’t update the item.");
        const { data: refetch, error: refetchErr } = await apiFetchTodos(
          activeListId
        );
        if (refetchErr) {
          console.error(refetchErr);
          toast.error("Failed to restore list.");
        } else {
          setTodos(Array.isArray(refetch) ? refetch : []);
        }
      }
    },
    [activeListId, setBusyFor]
  );

  // ----------------------------------------------------------
  // DELETE (existing behavior)
  // ----------------------------------------------------------
  const handleDelete = useCallback(
    async (id) => {
      let removed = null;

      // optimistic remove
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

        setTodos((prev) => {
          if (!removed) return prev;
          return [...prev, removed];
        });

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
              onUpdate={(partial) => handleUpdate(todo.id, partial)}
              onDelete={() => handleDelete(todo.id)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
