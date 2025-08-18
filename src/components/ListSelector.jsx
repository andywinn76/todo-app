"use client";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "sonner";
import ManageListsDrawer from "@/components/ManageListsDrawer";

export default function ListSelector({ user, activeListId, onSelect }) {
  const [lists, setLists] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const inputRef = useRef(null);

  async function refreshLists() {
    if (!user) return [];
    const { data, error } = await supabase
      .from("lists")
      .select("id, name, created_at")
      .eq("created_by", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("load my lists error:", error);
      toast.error("Error loading lists");
      return [];
    }
    setLists(data || []);
    return data || [];
  }

  useEffect(() => {
    if (!user) return;
    (async () => {
      const data = await refreshLists();
      if (!activeListId && data.length) onSelect(data[0].id);
    })();
  }, [user]);

  useEffect(() => {
    if (showForm) {
      // autofocus when opening the form
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [showForm]);

  async function handleCreate(e) {
    e.preventDefault();
    if (!user) return;

    const name = newName.trim();
    if (!name) {
      toast.error("Please enter a list name");
      return;
    }

    setCreating(true);
    const { data: list, error } = await supabase
      .from("lists")
      .insert([{ name, created_by: user.id }]) // trigger will add owner membership
      .select()
      .single();
    setCreating(false);

    if (error) {
      console.error("create list error:", error);
      toast.error("Could not create list");
      return;
    }

    // Refresh to ensure dropdown has the new option, then select it
    await refreshLists();
    onSelect(list.id);

    // reset form
    setNewName("");
    setShowForm(false);
    toast.success("List created");
  }

  function handleCancel() {
    setNewName("");
    setShowForm(false);
  }

  return (
    <div className="mb-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
        <label className="text-sm font-medium">List:</label>
        <div className="flex items-center gap-2">
          <select
            value={activeListId || ""}
            onChange={(e) => onSelect(e.target.value)}
            className="border rounded px-2 py-1 min-w-[12rem]"
          >
            {lists.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name ?? "(untitled)"}
              </option>
            ))}
          </select>

          {!showForm && (
            <button
              onClick={() => setShowForm(true)}
              className="bg-green-500 hover:bg-green-600 text-white text-sm font-semibold px-3 py-1 rounded"
            >
              + New
            </button>
          )}
          <button
            type="button"
            onClick={() => setManageOpen(true)}
            className="border text-sm font-semibold px-3 py-1 rounded hover:bg-gray-50"
          >
            Manage
          </button>
        </div>
      </div>

      {showForm && (
        <form
          onSubmit={handleCreate}
          className="mt-3 rounded border bg-white p-3 shadow-sm"
        >
          <label className="block text-sm font-semibold mb-1">
            New list name
          </label>
          <input
            ref={inputRef}
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="w-full border rounded px-3 py-2 mb-3"
            placeholder="e.g., Groceries, Trip Planning"
            disabled={creating}
          />
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={creating || !newName.trim()}
              className={`${
                creating ? "opacity-75 cursor-not-allowed" : ""
              } bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded`}
            >
              {creating ? "Creating…" : "Create List"}
            </button>
            <button
              type="button"
              onClick={handleCancel}
              className="border px-3 py-2 rounded hover:bg-gray-50"
              disabled={creating}
            >
              Cancel
            </button>
          </div>
        </form>
      )}
      <ManageListsDrawer
        open={manageOpen}
        onClose={() => setManageOpen(false)}
        user={user}
        lists={lists}
        onAfterDelete={async (deletedId) => {
          // Refresh lists after deletion
          const updated = await refreshLists(); // If the deleted list was selected, pick the newest remaining; otherwise keep current selection
          if (activeListId === deletedId) {
            if (updated.length) onSelect(updated[0].id);
            else onSelect(null);
          }
          setManageOpen(false);
        }}
      />
    </div>
  );
}
