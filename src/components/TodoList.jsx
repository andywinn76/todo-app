// src/components/TodoList.jsx
"use client";

import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { toast } from "sonner";
import TodoItem from "@/components/TodoItem";
import EditTodoDrawer from "@/components/EditTodoDrawer";
import { useLists } from "@/components/ListsProvider";
import {
  fetchTodos as apiFetchTodos,
  updateTodo as apiUpdateTodo,
  deleteTodo as apiDeleteTodo,
  reorderTodos as apiReorderTodos,
} from "@/lib/todos";

export default function TodoList({ lastCreated }) {
  const { activeListId } = useLists();

  const [todos, setTodos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sortOrder, setSortOrder] = useState("custom");
  const [draggingId, setDraggingId] = useState(null);
  const dragRef = useRef(null);

  // Track in-flight operations per-todo
  const [busyIds, setBusyIds] = useState(() => new Set());
  const setBusyFor = useCallback((id, flag) => {
    setBusyIds((prev) => {
      const next = new Set(prev);
      flag ? next.add(id) : next.delete(id);
      return next;
    });
  }, []);

  // NEW — editing drawer
  const [editingTodo, setEditingTodo] = useState(null);
  const openEdit = useCallback((todo) => setEditingTodo(todo), []);
  const closeEdit = useCallback(() => setEditingTodo(null), []);

  // ------------------------------------------------------------
  // 1. INITIAL FETCH WHEN ACTIVE LIST CHANGES
  // ------------------------------------------------------------
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

  useEffect(() => {
    setSortOrder("custom");
  }, [activeListId]);

  // ------------------------------------------------------------
  // 2. OPTIMISTIC APPEND FOR NEWLY CREATED TODO
  // ------------------------------------------------------------
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

  // ------------------------------------------------------------
  // 3. TOGGLE COMPLETION (PROGRESS-AWARE)
  // ------------------------------------------------------------
  const handleToggle = useCallback(
    async (id, nextCompleted) => {
      const current = todos.find((t) => t.id === id);

      let newProgress =
        current && current.progress != null ? current.progress : null;

      if (newProgress != null) {
        if (nextCompleted) {
          newProgress = 100;
        } else if (newProgress === 100) {
          newProgress = 0;
        }
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

  // ------------------------------------------------------------
  // 4. GENERIC UPDATE (EDIT DRAWER + PROGRESS SLIDER)
  // ------------------------------------------------------------
  const handleUpdate = useCallback(
    async (id, partial) => {
      // Optimistic update
      setTodos((prev) => prev.map((t) => (t.id === id ? { ...t, ...partial } : t)));

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

  // ------------------------------------------------------------
  // 5. DELETE TODO (OPTIMISTIC WITH RESTORE ON FAIL)
  // ------------------------------------------------------------
  const handleDelete = useCallback(
    async (id) => {
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

  const handleDragStart = useCallback((event, id) => {
    if (event.button !== 0 || busyIds.has(id)) return;

    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { id, original: todos, latest: todos };
    setDraggingId(id);

    const handleMove = (moveEvent) => {
      const edgeSize = 80;
      if (moveEvent.clientY < edgeSize) {
        window.scrollBy({ top: -12, behavior: "auto" });
      } else if (moveEvent.clientY > window.innerHeight - edgeSize) {
        window.scrollBy({ top: 12, behavior: "auto" });
      }

      const target = document
        .elementFromPoint(moveEvent.clientX, moveEvent.clientY)
        ?.closest("[data-todo-id]");
      const targetId = target?.dataset.todoId;
      if (!targetId || targetId === dragRef.current?.id) return;

      setTodos((current) => {
        const from = current.findIndex((todo) => String(todo.id) === String(id));
        const to = current.findIndex((todo) => String(todo.id) === targetId);
        if (from < 0 || to < 0 || from === to) return current;
        const next = current.slice();
        const [moved] = next.splice(from, 1);
        next.splice(to, 0, moved);
        dragRef.current.latest = next;
        return next;
      });
    };

    const handleEnd = async () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleEnd);
      window.removeEventListener("pointercancel", handleEnd);

      const drag = dragRef.current;
      dragRef.current = null;
      setDraggingId(null);
      if (!drag || drag.latest === drag.original) return;

      const { error } = await apiReorderTodos(drag.latest);
      if (error) {
        console.error("Error saving todo order:", error);
        setTodos(drag.original);
        toast.error("Couldn’t save the new order.");
      }
    };

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleEnd, { once: true });
    window.addEventListener("pointercancel", handleEnd, { once: true });
  }, [busyIds, todos]);

  // ------------------------------------------------------------
  // 6. EMPTY STATE / RENDER
  // ------------------------------------------------------------
  const isEmpty = useMemo(
    () => !loading && todos.length === 0,
    [loading, todos.length]
  );

  const displayedTodos = useMemo(() => {
    if (sortOrder === "custom") return todos;

    return [...todos].sort((a, b) => {
      const comparison = (a.title || "").localeCompare(b.title || "", undefined, {
        sensitivity: "base",
        numeric: true,
      });
      return sortOrder === "az" ? comparison : -comparison;
    });
  }, [sortOrder, todos]);

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
        <>
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="text-sm font-medium text-stone-500">{todos.filter((todo) => !todo.completed).length} remaining</p>
            <label className="flex items-center gap-2 text-sm text-gray-600">
              <span className="text-stone-500">Sort by</span>
              <select
                value={sortOrder}
                onChange={(event) => setSortOrder(event.target.value)}
                className="app-select"
                aria-label="Sort todo items"
              >
                <option value="custom">Custom order</option>
                <option value="az">A–Z</option>
                <option value="za">Z–A</option>
              </select>
            </label>
          </div>

          <ul className="todo-list-surface">
            {displayedTodos.map((todo) => (
              <TodoItem
                key={todo.id}
                todo={todo}
                busy={busyIds.has(todo.id)}
                dragging={draggingId === todo.id}
                reorderEnabled={sortOrder === "custom"}
                onToggle={(next) => handleToggle(todo.id, next)}
                onUpdate={(partial) => handleUpdate(todo.id, partial)}
                onDelete={() => handleDelete(todo.id)}
                onEdit={openEdit}
                onDragStart={handleDragStart}
              />
            ))}
          </ul>

          <p className="mt-3 text-right text-sm font-medium text-stone-500">
            {todos.length} total items
          </p>
        </>
      )}

      {/* --------------------------------------------------------
           EDIT DRAWER
         -------------------------------------------------------- */}
      {editingTodo && (
        <EditTodoDrawer
          todo={editingTodo}
          onClose={closeEdit}
          onSave={(partial) => handleUpdate(editingTodo.id, partial)}
        />
      )}
    </div>
  );
}
