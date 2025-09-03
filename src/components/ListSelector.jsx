"use client";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "sonner";
import ManageListsDrawer from "@/components/ManageListsDrawer";

export default function ListSelector({
  user,
  activeListId,
  onSelect,
  onListsChange,
  lists,
  setLists,
}) {
  // const [lists, setLists] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const manageBtnRef = useRef(null);
  const inputRef = useRef(null);

  async function refreshLists() {
    if (!user) return [];

    const { data, error } = await supabase
      .from("list_members")
      .select(
        `
  role,
  lists:lists(id, name, created_at, created_by)
`
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: true, foreignTable: "lists" }); // <-- key fix
      console.log('rows sample', (data||[])[0]);

    if (error) {
      console.error(
        "load my lists error:",
        error.message,
        error.details,
        error.hint
      );
      toast.error("Error loading lists");
      return [];
    }

    // const rows = data || [];
    // const transformed = rows.map((row) => ({ ...row.lists, _role: row.role }));
    const rows = data || [];
    const transformed = rows.map(({ role, lists }) => ({
      ...lists,
      _role: role,
      owner_first_name: lists?.owner?.first_name ?? null,
      owner_last_name: lists?.owner?.last_name ?? null,
      owner_username: lists?.owner?.username ?? null,
    }));
    // collect unique owner ids
    const ownerIds = [
      ...new Set(transformed.map((l) => l.created_by).filter(Boolean)),
    ];

    let ownersById = {};
    if (ownerIds.length) {
      const { data: owners, error: ownersErr } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, username")
        .in("id", ownerIds);

      if (!ownersErr && owners) {
        ownersById = Object.fromEntries(owners.map((o) => [o.id, o]));
      }
    }

    // enrich each list with owner fields (if available)
    const enriched = transformed.map((l) => {
      const o = ownersById[l.created_by] || {};
      return {
        ...l,
        owner_first_name: o.first_name ?? null,
        owner_last_name: o.last_name ?? null,
        owner_username: o.username ?? null,
      };
    });

    setLists(enriched);
    onListsChange?.(enriched);
    return enriched;

    // setLists(transformed);
    // onListsChange?.(transformed);
    // return transformed;
  }

  useEffect(() => {
    if (!user) return;
    (async () => {
      const data = await refreshLists();
      // if (typeof activeListId === "undefined" && data.length) onSelect(String(data[0].id));
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
        {/* <label className="text-sm font-medium">List:</label> */}
        <div className="flex items-center gap-2">
          <select
            value={activeListId ?? ""}
            onChange={(e) => {
              const v = e.target.value;
              onSelect(v === "" ? null : String(v));
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
        setLists={setLists}
        triggerRef={manageBtnRef}
        onAfterCreate={async (created) => {
          const updated = await refreshLists(); //Select the new list
          if (created?.id) onSelect(created.id);
        }}
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
