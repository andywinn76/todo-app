"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "sonner";
import ShareListInline from "@/components/ShareListInline";
import { FaPencilAlt } from "react-icons/fa";
import ListActions from "@/components/ListActions";
import { useLists } from "@/components/ListsProvider";
import ListTypeBadge from "@/components/ListTypeBadge";
import { LIST_TYPES, LIST_TYPE_LABELS } from "@/utils/listTypes";

function TypePicker({ value, onChange, disabled, id = "drawer-list-type" }) {
  return (
    <>
      <label className="block text-sm font-semibold mb-1" htmlFor={id}>
        List type
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        className="w-full border rounded px-3 py-2 mb-3"
        disabled={disabled}
      >
        <option value="todo">Todo</option>
        <option value="grocery">Grocery</option>
        <option value="note">Note</option>
        {/* {LIST_TYPES.map((type) => (
          <option key={type} value={type}>
            {LIST_TYPE_LABELS[type] ?? type}
          </option>
        ))} */}
      </select>
    </>
  );
}

export default function ManageListsDrawer({
  open,
  onClose,
  user,
  lists,
  onAfterDelete, // async (deletedListId) => void
  onAfterCreate, // async (createdList) => void
  onAfterRename,
  triggerRef, // ref to the "Manage" button (for focus return)
}) {
  const { activeListId, setActiveListId } = useLists(); // UUID strings
  const [busy, setBusy] = useState(false);

  // Create form state
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createdThisSession, setCreatedThisSession] = useState(false);
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState("todo");
  const [creating, setCreating] = useState(false);

  const panelRef = useRef(null);
  const focusStartRef = useRef(null);
  const createInputRef = useRef(null);

  // Sharing state (which list id is currently inviting)
  const [shareOpenId, setShareOpenId] = useState(null);
  // Optimistic update for sharing state
  const [optimisticNames, setOptimisticNames] = useState({});

  //Renaming lists state
  const [renamingId, setRenamingId] = useState(null);
  const [renameValue, setRenameValue] = useState("");
  const [renaming, setRenaming] = useState(false);

  // Helpers
  function isOwner(list) {
    if (list?.created_by) return list.created_by === user.id;
    if (list?._role) return list._role === "owner";
    return false;
  }

  function ownerLabelFor(list, user) {
    if (!list) return "—";
    if (list.created_by === user.id) return "Me";

    const f =
      (list.owner_first_name ?? list.owner?.first_name ?? "").trim?.() || "";
    const l =
      (list.owner_last_name ?? list.owner?.last_name ?? "").trim?.() || "";
    const u =
      (list.owner_username ?? list.owner?.username ?? "").trim?.() || "";

    if (f) {
      const initial = l ? `${l[0].toUpperCase()}.` : "";
      return `${f} ${initial}`.trim();
    }
    if (u) return u;
    return "—";
  }

  // Focus trap + esc + body scroll lock
  useEffect(() => {
    if (!open) return;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    setTimeout(() => (focusStartRef.current || panelRef.current)?.focus(), 0);

    function onKeyDown(e) {
      if (e.key === "Escape") {
        e.preventDefault();
        if (!busy && !creating) handleClose();
      }
      if (e.key === "Tab") {
        const root = panelRef.current;
        if (!root) return;
        const selectors =
          'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])';
        const focusables = Array.from(root.querySelectorAll(selectors)).filter(
          (el) => !el.hasAttribute("disabled") && el.tabIndex !== -1
        );
        if (!focusables.length) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        const current = document.activeElement;
        if (!e.shiftKey && current === last) {
          e.preventDefault();
          first.focus();
        }
        if (e.shiftKey && current === first) {
          e.preventDefault();
          last.focus();
        }
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, busy, creating]);

  useEffect(() => {
    if (showCreateForm) setTimeout(() => createInputRef.current?.focus(), 0);
  }, [showCreateForm]);

  useEffect(() => {
    if (!open) return;
    setShowCreateForm(false);
    setCreatedThisSession(false);
    setNewName("");
    setNewType("todo");
    setShareOpenId(null);
    // fresh session of the drawer: clear any stale optimistic names
    setOptimisticNames({});
  }, [open]);

  function handleClose() {
    onClose?.();
    setTimeout(() => triggerRef?.current?.focus?.(), 0);
  }

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
      .insert([{ name, created_by: user.id, type: newType }]) // include type
      .select()
      .single();
    setCreating(false);

    if (error) {
      console.error("create list error:", error);
      toast.error("Could not create list");
      return;
    }

    toast.success("List created");
    setNewName("");
    setNewType("todo");
    setShowCreateForm(false);
    setCreatedThisSession(true);
    await onAfterCreate?.(list); // parent refresh + select
    handleClose();
  }

  function startRename(list) {
    if (!isOwner(list)) {
      toast.error("Only the owner can rename this list.");
      return;
    }
    // if switching to a new list while renaming, reset state first
    setRenamingId(list.id);
    setRenameValue(list.name || "");
    setRenaming(false);
    setShareOpenId(null);
  }

  function cancelRename() {
    setRenamingId(null);
    setRenameValue("");
    setRenaming(false);
  }

  //Renaming function
  async function saveRename(list) {
    if (!user) return;
    const name = (renameValue || "").trim();
    if (!name) {
      toast.error("Please enter a list name");
      return;
    }
    if (name === (list.name || "")) {
      cancelRename();
      return;
    }
    setRenaming(true);
    // Optimistically update UI
    setOptimisticNames((m) => ({ ...m, [list.id]: name }));
    const { data: updated, error } = await supabase
      .from("lists")
      .update({ name })
      .eq("id", list.id)
      .select()
      .single();
    setRenaming(false);
    if (error) {
      console.error("rename list error:", error);
      toast.error("Could not rename list");
      // Roll back optimistic change
      setOptimisticNames((m) => {
        const copy = { ...m };
        delete copy[list.id];
        return copy;
      });
      return;
    }
    toast.success("List renamed");
    cancelRename();
    await onAfterRename?.(updated);
  }

  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 bg-black/40 z-40"
        onClick={() => !busy && !creating && handleClose()}
        aria-hidden="true"
      />
      <aside
        id="manage-lists-drawer"
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="manage-lists-title"
        className={`fixed inset-y-0 left-0 z-50 w-full max-w-[420px] bg-white shadow-2xl p-4 outline-none
          flex flex-col h-dvh transform transition-transform duration-300 ease-out ${
            open ? "translate-x-0" : "-translate-x-full"
          }`}
        tabIndex={-1}
      >
        <div className="flex items-baseline justify-between mb-3">
          <h2
            id="manage-lists-title"
            className="text-lg font-semibold"
            ref={focusStartRef}
            tabIndex={-1}
          >
            Manage Lists
          </h2>

          <div className="flex items-baseline gap-2">
            {!createdThisSession && !showCreateForm && (
              <button
                type="button"
                onClick={() => setShowCreateForm(true)}
                disabled={busy || creating}
                className="text-sm px-3 py-1 rounded bg-blue-600 text-white hover:bg-blue-700"
                aria-controls="create-list-form"
              >
                Add New
              </button>
            )}

            <button
              onClick={handleClose}
              disabled={busy || creating}
              className="text-sm px-3 py-1 rounded border hover:bg-gray-50"
              aria-label="Close manage lists"
            >
              Close
            </button>
          </div>
        </div>

        {/* Form to create a new list */}
        {showCreateForm && (
          <form
            id="create-list-form"
            onSubmit={handleCreate}
            className="rounded border bg-white p-3 shadow-sm mb-3"
          >
            <label className="block text-sm font-semibold mb-1">
              New list name
            </label>
            <input
              ref={createInputRef}
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="w-full border rounded px-3 py-2 mb-3"
              placeholder="e.g., Groceries, Trip Planning"
              disabled={creating}
            />

            <TypePicker
              value={newType}
              onChange={setNewType}
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
                onClick={() => {
                  setNewName("");
                  setNewType("todo");
                  setShowCreateForm(false);
                }}
                disabled={creating}
                className="border px-3 py-2 rounded hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {/* Existing lists */}
        <div className="space-y-2 flex-1 min-h-0 overflow-y-auto pr-1 pb-2">
          {lists.length === 0 && (
            <p className="space-y-2 flex-1 min-h-0 overflow-y-auto pr-1 pb-4">
              No lists found.
            </p>
          )}

          {lists.map((list) => {
            const inviting = shareOpenId === list.id;
            const canInvite = isOwner(list);
            const isCurrent = list.id === activeListId;

            return (
              <div
                key={list.id}
                className={`rounded border border-gray-400 pl-1 pr-3 py-1 ${
                  isCurrent ? "border-blue-200 bg-blue-50/30" : ""
                }`}
              >
                {/* Row header */}
                <div className="flex items-center justify-between mb-3 sticky top-0 bg-white z-10 pt-1">
                  {/* SELECT BUTTON (left column) */}
                  <button
                    type="button"
                    className="min-w-0 flex-1 text-left rounded px-2 py-1 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                    title="Select this list"
                    onClick={() => {
                      setActiveListId(list.id); // UUID string
                      handleClose();
                    }}
                  >
                    {/* List name */}
                    <div
                      className={`font-medium ${inviting ? "" : "truncate"}`}
                    >
                      {(optimisticNames[list.id] ?? list.name) || "Untitled"}
                      {isCurrent && (
                        <span className="ml-2 text-xs text-blue-600">
                          (current)
                        </span>
                      )}
                    </div>
                    {/* List owner and type of list badge */}
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <span className="inline-flex items-center gap-1">
                        Owner: {ownerLabelFor(list, user)}
                      </span>
                      {list?.type && (
                        <ListTypeBadge type={list?.type} className="mr-2" />
                      )}
                    </div>
                  </button>

                  {/* Actions: Share + Delete/Unsubscribe via ListActions */}
                  <div className="flex items-center gap-2 shrink-0">
                    {/* Rename (owners only) */}
                    {isOwner(list) &&
                      (renamingId === list.id ? (
                        // rename form
                        
                        
  <form
    onSubmit={(e) => {
    e.preventDefault();
    if (!renaming) saveRename(list);
  }}
  onKeyDown={(e) => {
    if (e.key === "Escape") cancelRename();
  }}
  className="min-w-0 flex flex-col sm:flex-row sm:items-center sm:gap-2 gap-3 w-full px-2 py-1"
>
  <input
    autoFocus
    type="text"
    value={renameValue}
    onChange={(e) => setRenameValue(e.target.value)}
    className="flex-1 min-w-0 w-full border rounded px-2 py-1"
    placeholder="List name"
    disabled={renaming || busy || creating}
    aria-label="Rename list"
  />
  <div className="flex gap-2 sm:mt-0 mt-2 w-full sm:w-auto justify-end">
    <button
      type="submit"
      disabled={
        renaming ||
        !renameValue.trim() ||
        renameValue.trim() === (list.name || "")
      }
      className="text-sm px-3 py-1 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
      aria-label="Save new name"
    >
      {renaming ? "Saving…" : "Save"}
    </button>
    <button
      type="button"
      onClick={cancelRename}
      disabled={renaming}
      className="text-sm px-3 py-1 rounded border hover:bg-gray-50"
      aria-label="Cancel rename"
    >
      Cancel
    </button>
  </div>
</form>

                      ) : (
                        // ✏️ Show the pencil when not renaming
                        <button
                          type="button"
                          disabled={busy || creating || renaming}
                          onClick={() => startRename(list)}
                          className="text-sm px-2 py-1 hover:bg-gray-100"
                          title="Rename list"
                        >
                          <FaPencilAlt className="w-5 h-5" />
                        </button>
                      ))}

                    {/* Share trigger (owners only here) */}
                    {canInvite && (
                      <ShareListInline
                        listId={list.id}
                        currentUserId={user.id}
                        isOpen={inviting}
                        onOpenChange={(open) =>
                          setShareOpenId(open ? list.id : null)
                        }
                        render="trigger"
                      />
                    )}

                    {/* ListActions (delete/unsubscribe) */}
                    <ListActions
                      activeList={list}
                      currentUserId={user.id}
                      onAfterDelete={async (deletedId) => {
                        await onAfterDelete?.(deletedId);
                      }}
                      onAfterUnsubscribe={async (leftId) => {
                        await onAfterDelete?.(leftId);
                      }}
                    />
                  </div>
                </div>

                {/* Invite form below the row (appears when inviting) */}
                {inviting && canInvite && (
                  <div className="mt-2">
                    <ShareListInline
                      listId={list.id}
                      currentUserId={user.id}
                      isOpen={true}
                      onOpenChange={(open) =>
                        setShareOpenId(open ? list.id : null)
                      }
                      onDone={() => setShareOpenId(null)}
                      render="form-below"
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </aside>
    </>
  );
}
