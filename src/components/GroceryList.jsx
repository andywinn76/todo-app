"use client";
import { useEffect, useRef, useState, useCallback, useMemo, memo } from "react";
import { toast } from "sonner";
import DeleteIconButton from "@/components/DeleteIconButton";
import {
  fetchGroceries,
  insertGrocery,
  setGroceryChecked,
  deleteGrocery as deleteGroceryApi,
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
    const { data, error } = await fetchGroceries(listId);
    setLoading(false);

    if (error) {
      console.error(error);
      toast.error("Failed to load grocery items");
      setItems([]);
      return;
    }
    setItems(data);
  }, [listId]);

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

      // Optimistically insert a temp row
      const tempId = `temp-${Date.now()}`;
      const tempItem = {
        id: tempId,
        list_id: String(listId),
        name: trimmed,
        quantity: quantity || null,
        is_checked: false,
        created_at: new Date().toISOString(),
      };
      setItems((prev) => [...prev, tempItem]);
      setSaving(true);

      const { data, error } = await insertGrocery({
        list_id: listId,
        name: trimmed,
        quantity: quantity || null,
      });

      setSaving(false);

      if (error) {
        // Remove temp and report
        setItems((prev) => prev.filter((i) => i.id !== tempId));
        console.error(error);
        return toast.error("Failed to add item");
      }

      // Replace temp with real row
      setItems((prev) => prev.map((i) => (i.id === tempId ? data : i)));

      // Clear + refocus
      setName("");
      setQuantity("");
      setTimeout(() => inputRef.current?.focus(), 0);
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

  return (
    <section className="space-y-2">
      {!isControlled && !showForm && (
        <div className="flex justify-start">
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="px-4 py-1 rounded border hover:bg-gray-50"
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
            className="flex flex-col sm:flex-row gap-2 bg-white p-4"
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
              className="flex-1 border rounded px-3 py-2"
              readOnly={saving}
              autoFocus
            />
            <input
              type="text"
              placeholder="Qty (optional)"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="w-full sm:w-40 border rounded px-3 py-2"
              readOnly={saving}
            />
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={saving || !name.trim()}
                className={`px-4 py-1 rounded font-semibold ${
                  saving
                    ? "opacity-70 cursor-not-allowed"
                    : "bg-blue-600 text-white hover:bg-blue-700"
                }`}
              >
                {saving ? "Adding…" : "Add"}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-1 rounded border hover:bg-gray-50 text-sm"
              >
                Close
              </button>
            </div>
          </form>
        </div>
      </div>

      <div className="text-sm text-gray-600">Remaining: {uncheckedCount}</div>

      {loading ? (
        <div>Loading…</div>
      ) : items.length === 0 ? (
        <div className="text-gray-700 text-xl">No items yet.</div>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => (
            <GroceryRow
              key={item.id}
              item={item}
              busy={busyIds.has(item.id)}
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
const GroceryRow = memo(function GroceryRow({ item, onToggle, onDelete, busy }) {
  return (
    <li
      className={`p-2 border rounded flex items-center gap-3 ${
        item.is_checked ? "bg-green-50" : "bg-white"
      }`}
    >
      <input
        type="checkbox"
        checked={item.is_checked}
        onChange={onToggle}
        aria-label={item.is_checked ? "Uncheck item" : "Check item"}
        disabled={busy}
      />
      <div className="flex-1 min-w-0">
        <span
          className={`truncate ${
            item.is_checked ? "line-through text-gray-500" : ""
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
      />
    </li>
  );
});
