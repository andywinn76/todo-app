"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "sonner";
import { FaTrashAlt } from "react-icons/fa";

export default function GroceryList({ user, listId }) {
  const [items, setItems] = useState([]);
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("grocery_items")
      .select("*")
      .eq("list_id", String(listId))
      .order("is_checked", { ascending: true })
      .order("created_at", { ascending: true });
    setLoading(false);
    if (error) {
      console.error(error);
      toast.error("Failed to load grocery items");
      setItems([]);
      return;
    }
    setItems(data || []);
  }

  useEffect(() => {
    if (!user || !listId) return;
    load();
  }, [user, listId]);

  async function addItem(e) {
    e.preventDefault();
    if (saving) return;
    const trimmed = (name || "").trim();
    if (!trimmed) return toast.error("Enter an item name");
    setSaving(true);
    const { error } = await supabase
      .from("grocery_items")
      .insert([{ list_id: listId, name: trimmed, quantity: quantity || null }]);
    setSaving(false);
    if (error) {
      console.error(error);
      return toast.error("Failed to add item");
    }
    setName("");
    setQuantity("");
    load();
  }

  async function toggle(id, checked) {
    const { error } = await supabase
      .from("grocery_items")
      .update({ is_checked: !checked })
      .eq("id", id);
    if (error) {
      console.error(error);
      return toast.error("Failed to update item");
    }
    load();
  }

  async function remove(id) {
    const { error } = await supabase.from("grocery_items").delete().eq("id", id);
    if (error) {
      console.error(error);
      return toast.error("Failed to delete item");
    }
    load();
  }

  const uncheckedCount = items.filter((i) => !i.is_checked).length;

  return (
    <section className="space-y-4">
      <form onSubmit={addItem} className="flex flex-col sm:flex-row gap-2 bg-white p-4 rounded border shadow-sm">
        <input
          type="text"
          placeholder="Add item (e.g., milk)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="flex-1 border rounded px-3 py-2"
          disabled={saving}
        />
        <input
          type="text"
          placeholder="Qty (optional)"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          className="w-full sm:w-40 border rounded px-3 py-2"
          disabled={saving}
        />
        <button
          type="submit"
          disabled={saving || !name.trim()}
          className={`px-4 py-2 rounded font-semibold ${saving ? "opacity-70 cursor-not-allowed" : "bg-blue-600 text-white hover:bg-blue-700"}`}
        >
          {saving ? "Adding…" : "Add"}
        </button>
      </form>

      <div className="text-sm text-gray-600">Remaining: {uncheckedCount}</div>

      {loading ? (
        <div>Loading…</div>
      ) : items.length === 0 ? (
        <div className="text-gray-600">No items yet.</div>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => (
            <li
              key={item.id}
              className={`p-2 border rounded flex items-center gap-3 ${item.is_checked ? "bg-green-50" : "bg-white"}`}
            >
              <input
                type="checkbox"
                checked={item.is_checked}
                onChange={() => toggle(item.id, item.is_checked)}
                aria-label={item.is_checked ? "Uncheck item" : "Check item"}
              />
              <div className="flex-1 min-w-0">
                <span className={`truncate ${item.is_checked ? "line-through text-gray-500" : ""}`}>
                  {item.name}
                </span>
                {item.quantity && (
                  <span className="ml-2 text-xs text-gray-500">({item.quantity})</span>
                )}
              </div>
              <button
                onClick={() => remove(item.id)}
                className="p-2 rounded hover:bg-gray-100"
                title="Delete item"
                aria-label="Delete item"
              >
                <FaTrashAlt />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
