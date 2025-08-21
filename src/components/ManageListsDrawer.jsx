"use client";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "sonner";

export default function ManageListsDrawer({
  open,
  onClose,
  user,
  lists,
  onAfterDelete, // async (deletedListId) => void
  onAfterCreate, // async (createdList) => void
  triggerRef, // ref to the "Manage" button (for focus return)
}) {
  const [deletingId, setDeletingId] = useState(null);
  const [confirmId, setConfirmId] = useState(null);
  const [busy, setBusy] = useState(false);

  // Create form state
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createdThisSession, setCreatedThisSession] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const panelRef = useRef(null);
  const focusStartRef = useRef(null);
  const createInputRef = useRef(null);

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

  // Autofocus when the create form is revealed
  useEffect(() => {
    if (showCreateForm) setTimeout(() => createInputRef.current?.focus(), 0);
  }, [showCreateForm]);

  //Session reset when drawer opens
  useEffect(() => {
    if (!open) return;
    setShowCreateForm(false);
    setCreatedThisSession(false);
    setNewName("");
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
      .insert([{ name, created_by: user.id }]) // trigger will add owner membership
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
    setShowCreateForm(false);
    setCreatedThisSession(true);
    await onAfterCreate?.(list); // parent will refresh + select
    handleClose();
  }

  async function handleDelete(list) {
    if (!user) return;
    setBusy(true);

    // delete todos first (safer if FK isn't cascade)
    const { error: tdErr } = await supabase
      .from("todos")
      .delete()
      .eq("list_id", list.id);
    if (tdErr) {
      console.error("delete todos error:", tdErr);
      toast.error("Could not delete todos for this list");
      setBusy(false);
      return;
    }

    const { error: lsErr } = await supabase
      .from("lists")
      .delete()
      .eq("id", list.id)
      .eq("created_by", user.id); // creator-only
    setBusy(false);

    if (lsErr) {
      console.error("delete list error:", lsErr);
      toast.error("Could not delete list");
      return;
    }

    toast.success(`Deleted “${list.name || "Untitled"}”`);
    setConfirmId(null);
    setDeletingId(null);
    await onAfterDelete?.(list.id);
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
        className="fixed bottom-0 left-0 right-0 z-50 rounded-t-2xl bg-white shadow-2xl p-4 outline-none
                   sm:left-auto sm:top-0 sm:bottom-0 sm:w-[380px] sm:rounded-none sm:right-0"
        tabIndex={-1}
      >
        <div className="flex items-center justify-between mb-3">
          <h2
            id="manage-lists-title"
            className="text-lg font-semibold"
            ref={focusStartRef}
            tabIndex={-1}
          >
            Manage Lists
          </h2>
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
        <div className="space-y-2 max-h-[60vh] overflow-auto pr-1">
          {lists.length === 0 && (
            <p className="text-sm text-gray-600">No lists yet.</p>
          )}

          {lists.map((list) => {
            const isConfirming = confirmId === list.id;
            const isDeleting = deletingId === list.id && busy;

            return (
              <div
                key={list.id}
                className="flex items-center justify-between rounded border p-3"
              >
                <div className="min-w-0">
                  <div className="font-medium truncate">
                    {list.name || "Untitled"}
                  </div>
                </div>

                {!isConfirming ? (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={busy || creating}
                      className="text-sm px-2 py-1 rounded border hover:bg-gray-50 opacity-60 cursor-not-allowed"
                      title="Rename (coming soon)"
                      aria-disabled="true"
                    >
                      Rename
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmId(list.id)}
                      disabled={busy || creating}
                      className="text-sm px-2 py-1 rounded border border-red-300 text-red-600 hover:bg-red-50"
                      aria-label={`Delete list ${list.name || "Untitled"}`}
                    >
                      Delete
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setDeletingId(list.id);
                        handleDelete(list);
                      }}
                      disabled={busy || creating}
                      className={`text-sm px-2 py-1 rounded bg-red-600 text-white hover:bg-red-700 ${
                        isDeleting ? "opacity-70 cursor-not-allowed" : ""
                      }`}
                      title="This removes the list and its todos"
                    >
                      {isDeleting ? "Deleting…" : "Confirm"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmId(null)}
                      disabled={busy || creating}
                      className="text-sm px-2 py-1 rounded border hover:bg-gray-50"
                    >
                      Cancel
                    </button>
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
