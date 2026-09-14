"use client";
import { useEffect, useRef, useState, useCallback, useMemo, memo } from "react";
import { toast } from "sonner";
import { FaGripVertical } from "react-icons/fa";
import DeleteIconButton from "@/components/DeleteIconButton";
import {
  fetchGroceries,
  insertGrocery,
  setGroceryChecked,
  deleteGrocery as deleteGroceryApi,
  reorderGroceries,
} from "@/lib/groceries";

/**
 * Props:
 * - user
 * - listId
 * - open?: boolean                // optional: controlled open state
 * - onOpenChange?: (open:boolean) // optional: controlled change handler
 */
export default function GroceryList({ user, listId, open, onOpenChange }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sortOrder, setSortOrder] = useState("custom");
  const [supportsPosition, setSupportsPosition] = useState(false);
  const [draggingId, setDraggingId] = useState(null);
  const dragRef = useRef(null);

  // Track in-flight operations per item id
  const [busyIds, setBusyIds] = useState(() => new Set());
  const setBusyFor = useCallback((id, isBusy) => {
    setBusyIds((prev) => {
      const next = new Set(prev);
      if (isBusy) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  // If `open` is undefined, we manage our own internal state.
  const isControlled = open !== undefined;
  const [internalOpen, setInternalOpen] = useState(false);
  const showForm = isControlled ? open : internalOpen;
  const setShowForm = (next) => {
    if (isControlled) onOpenChange?.(next);
    else setInternalOpen(next);
  };

  // 🔑 Form state + input ref
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("");
  const inputRef = useRef(null);

  const load = useCallback(async () => {
    if (!listId) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error, supportsPosition: hasPosition } = await fetchGroceries(listId);
    setLoading(false);

    if (error) {
      console.error(error);
      toast.error("Failed to load grocery items");
      setItems([]);
      return;
    }
    setItems(data);
    setSupportsPosition(hasPosition);
  }, [listId]);

  useEffect(() => setSortOrder("custom"), [listId]);

  // Initial load + reload when list/user changes
  useEffect(() => {
    if (!user || !listId) return;
    load();
  }, [user, listId, load]);

  // Focus when the panel opens
  useEffect(() => {
    if (showForm) {
      const t = setTimeout(() => inputRef.current?.focus(), 0);
      return () => clearTimeout(t);
    }
  }, [showForm]);

  // ---- Mutations (optimistic) ----

  // Add item (optimistic insert)
  const addItem = useCallback(
    async (e) => {
      e.preventDefault();
      if (saving) return;

      const trimmed = (name || "").trim();
      if (!trimmed) return toast.error("Enter an item name");
      const submittedQuantity = quantity || null;

      // Keep focus in the name field during the async save. Waiting until the
      // request finishes can prevent mobile browsers from reopening the keyboard.
      setName("");
      setQuantity("");
      inputRef.current?.focus();

      // Optimistically insert a temp row
      const tempId = `temp-${Date.now()}`;
      const tempItem = {
        id: tempId,
        list_id: String(listId),
        name: trimmed,
        quantity: submittedQuantity,
        is_checked: false,
        created_at: new Date().toISOString(),
      };
      setItems((prev) => [...prev, tempItem]);
      setSaving(true);

      const { data, error } = await insertGrocery({
        list_id: listId,
        name: trimmed,
        quantity: submittedQuantity,
      });

      setSaving(false);

      if (error) {
        // Remove temp and report
        setItems((prev) => prev.filter((i) => i.id !== tempId));
        setName((current) => current || trimmed);
        setQuantity((current) => current || submittedQuantity || "");
        console.error(error);
        return toast.error("Failed to add item");
      }

      // Replace temp with real row
      setItems((prev) => prev.map((i) => (i.id === tempId ? data : i)));

    },
    [saving, name, quantity, listId]
  );

  // Toggle check (optimistic)
  const toggle = useCallback(
    async (id, checked) => {
      // optimistic flip
      setItems((prev) =>
        prev.map((i) => (i.id === id ? { ...i, is_checked: !checked } : i))
      );
      setBusyFor(id, true);

      const { error } = await setGroceryChecked(id, !checked);

      setBusyFor(id, false);

      if (error) {
        // revert on error
        setItems((prev) =>
          prev.map((i) => (i.id === id ? { ...i, is_checked: checked } : i))
        );
        console.error(error);
        return toast.error("Failed to update item");
      }
    },
    [setBusyFor]
  );

  // Delete (optimistic)
  const remove = useCallback(
    async (id) => {
      // optimistic remove
      const snapshot = items;
      setItems((prev) => prev.filter((i) => i.id !== id));
      setBusyFor(id, true);

      const { error } = await deleteGroceryApi(id);

      setBusyFor(id, false);

      if (error) {
        // restore on error
        console.error(error);
        setItems(snapshot);
        return toast.error("Failed to delete item");
      } else {
        toast.success("Item deleted");
      }
    },
    [items, setBusyFor]
  );

  const uncheckedCount = useMemo(
    () => items.reduce((acc, i) => acc + (i.is_checked ? 0 : 1), 0),
    [items]
  );

  const displayedItems = useMemo(() => {
    if (sortOrder === "custom") return items;
    return [...items].sort((a, b) => {
      const comparison = (a.name || "").localeCompare(b.name || "", undefined, {
        sensitivity: "base",
        numeric: true,
      });
      return sortOrder === "az" ? comparison : -comparison;
    });
  }, [items, sortOrder]);

  const handleDragStart = useCallback((event, id) => {
    if (event.button !== 0 || sortOrder !== "custom" || busyIds.has(id)) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { id, original: items, latest: items };
    setDraggingId(id);

    const handleMove = (moveEvent) => {
      if (moveEvent.clientY < 80) window.scrollBy({ top: -12, behavior: "auto" });
      else if (moveEvent.clientY > window.innerHeight - 80) {
        window.scrollBy({ top: 12, behavior: "auto" });
      }

      const targetId = document.elementFromPoint(moveEvent.clientX, moveEvent.clientY)
        ?.closest("[data-grocery-id]")?.dataset.groceryId;
      if (!targetId || targetId === String(id)) return;

      setItems((current) => {
        const from = current.findIndex((item) => String(item.id) === String(id));
        const to = current.findIndex((item) => String(item.id) === targetId);
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
      const { error } = await reorderGroceries(listId, drag.latest, supportsPosition);
      if (error) {
        console.error("Error saving grocery order:", error);
        setItems(drag.original);
        toast.error("Couldn’t save the new order.");
      }
    };

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleEnd, { once: true });
    window.addEventListener("pointercancel", handleEnd, { once: true });
  }, [busyIds, items, listId, sortOrder, supportsPosition]);

  return (
    <section className="space-y-3 pt-1">
      {!isControlled && !showForm && (
        <div className="flex justify-start">
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--accent-hover)]"
          >
            Add items
          </button>
        </div>
      )}

      {/* Collapsible panel that contains the form */}
      <div
        id="grocery-form-panel"
        className={`grid transition-[grid-template-rows] duration-300 ease-in-out ${
          showForm ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
      >
        <div className="overflow-hidden">
          <form
            onSubmit={addItem}
            className="flex flex-col gap-3 rounded-xl border border-stone-200 bg-[#f8faf7] p-4 sm:flex-row"
            onKeyDown={(e) => {
              if (e.key === "Escape") setShowForm(false);
            }}
          >
            <input
              ref={inputRef}
              type="text"
              placeholder="Add item (e.g., milk)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="app-input min-w-0 flex-1 px-3 py-2 text-sm"
              autoFocus
            />
            <input
              type="text"
              placeholder="Qty (optional)"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="app-input w-full px-3 py-2 text-sm sm:w-40"
            />
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={saving || !name.trim()}
                className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed disabled:opacity-70"
              >
                {saving ? "Adding…" : "Add"}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="rounded-lg border border-stone-200 bg-white px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50"
              >
                Close
              </button>
            </div>
          </form>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-stone-500">{uncheckedCount} remaining</p>
        <label className="flex items-center gap-2 text-sm text-stone-500">
          <span>Sort by</span>
          <select
            value={sortOrder}
            onChange={(event) => setSortOrder(event.target.value)}
            className="app-select"
            aria-label="Sort grocery items"
          >
            <option value="custom">Custom order</option>
            <option value="az">A–Z</option>
            <option value="za">Z–A</option>
          </select>
        </label>
      </div>

      {loading ? (
        <div>Loading…</div>
      ) : items.length === 0 ? (
        <div className="text-gray-700 text-xl">No items yet.</div>
      ) : (
        <ul className="todo-list-surface">
          {displayedItems.map((item) => (
            <GroceryRow
              key={item.id}
              item={item}
              busy={busyIds.has(item.id)}
              dragging={draggingId === item.id}
              reorderEnabled={sortOrder === "custom"}
              onDragStart={(event) => handleDragStart(event, item.id)}
              onToggle={() => toggle(item.id, item.is_checked)}
              onDelete={() => remove(item.id)}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

/** Memoized row so other rows don’t re-render on each toggle/delete */
const GroceryRow = memo(function GroceryRow({ item, onToggle, onDelete, onDragStart, reorderEnabled, dragging, busy }) {
  return (
    <li
      data-grocery-id={item.id}
      className={`todo-row group relative flex items-center gap-2 transition ${
        dragging ? "z-10 scale-[1.01] shadow-md ring-2 ring-[var(--accent)]" : ""
      }`}
    >
      <button
        type="button"
        className="-ml-1 flex size-7 shrink-0 touch-none cursor-grab items-center justify-center rounded text-stone-400 hover:bg-stone-100 hover:text-stone-700 active:cursor-grabbing focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)] disabled:cursor-default disabled:opacity-30 disabled:hover:bg-transparent"
        onPointerDown={onDragStart}
        disabled={!reorderEnabled || busy}
        aria-label={`Reorder ${item.name}`}
        title={reorderEnabled ? "Drag to reorder" : "Choose Custom order to drag items"}
      >
        <FaGripVertical className="size-4" aria-hidden="true" />
      </button>
      <input
        type="checkbox"
        checked={item.is_checked}
        onChange={onToggle}
        aria-label={item.is_checked ? "Uncheck item" : "Check item"}
        disabled={busy}
        className="size-4 shrink-0 accent-[var(--accent)]"
      />
      <div className="flex-1 min-w-0">
        <span
          className={`truncate ${
            item.is_checked ? "line-through text-stone-400" : "font-medium text-stone-800"
          }`}
          title={item.name}
        >
          {item.name}
        </span>
        {item.quantity && (
          <span className="ml-2 text-xs text-gray-500">({item.quantity})</span>
        )}
      </div>
      <DeleteIconButton
        onClick={onDelete}
        disabled={busy}
        title="Delete item"
        aria-label="Delete item"
        className="grocery-delete-button"
      />
    </li>
  );
});
