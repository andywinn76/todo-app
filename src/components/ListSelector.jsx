"use client";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "sonner";
import ManageListsDrawer from "@/components/ManageListsDrawer";
import { useLists } from "@/components/ListsProvider";

export default function ListSelector({ user }) {
  const { lists, setLists, activeListId, setActiveListId, refreshLists } =
    useLists();

  const [showForm, setShowForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const manageBtnRef = useRef(null);
  const inputRef = useRef(null);

  // Initial fetch
  useEffect(() => {
    if (!user) return;
    (async () => {
      await refreshLists();
    })();
  }, [user, refreshLists]);

  // Autofocus when new-list form opens
  useEffect(() => {
    if (showForm) setTimeout(() => inputRef.current?.focus(), 0);
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
      .insert([{ name, created_by: user.id }]) // trigger adds owner membership
      .select()
      .single();
    setCreating(false);

    if (error) {
      console.error("create list error:", error);
      toast.error("Could not create list");
      return;
    }

    // Refresh so dropdown has new option, then activate it
    await refreshLists();
    setActiveListId(list.id);

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
        <div className="flex items-center gap-2">
          <select
            value={activeListId ?? ""}
            onChange={(e) => {
              const v = e.target.value;
              setActiveListId(v === "" ? null : String(v));
            }}
            className="border rounded px-2 py-1 min-w-[12rem]"
          >
            {lists.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name ?? "(untitled)"}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => setManageOpen(true)}
            className="border text-sm font-semibold px-3 py-1 rounded hover:bg-gray-50"
            ref={manageBtnRef}
          >
            Manage
          </button>

          <button
            type="button"
            className="border text-sm px-3 py-1 rounded hover:bg-gray-50"
            onClick={() => setShowForm((v) => !v)}
          >
            New
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
        setLists={setLists}
        triggerRef={manageBtnRef}
        onAfterCreate={async (created) => {
          const updated = await refreshLists();
          if (created?.id) setActiveListId(created.id);
        }}
        onAfterDelete={async (deletedId) => {
          const updated = await refreshLists();
          if (String(deletedId) === String(activeListId)) {
            if (updated.length) setActiveListId(updated[0].id);
            else setActiveListId(null);
          }
          setManageOpen(false);
        }}
      />
    </div>
  );
}
