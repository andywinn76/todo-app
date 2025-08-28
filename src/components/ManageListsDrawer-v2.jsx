"use client";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "sonner";
import ShareListInline from "@/components/ShareListInline";
import { FaTrashAlt, FaPencilAlt } from "react-icons/fa";
import { FaXmark } from "react-icons/fa6";

export default function ManageListsDrawer({
  open,
  onClose,
  user,
  lists,
  setLists,
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

  // Sharing state (which list id is currently inviting)
  const [shareOpenId, setShareOpenId] = useState(null);

  // Unsubscribe state (which list id is currently unsubscribing)
  const [unsubscribingId, setUnsubscribingId] = useState(null);
  const [confirmUnsubId, setConfirmUnsubId] = useState(null);

  // Unsubscribe helper: determine if the current user owns a given list
  function isOwner(list) {
    // prefer role if you already include it in your lists query
    if (list.role) return list.role === "owner";
    // fallback if you have owner_id on the list row
    if (list.owner_id) return list.owner_id === user.id;
    return false;
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

  // Autofocus when the create form is revealed
  useEffect(() => {
    if (showCreateForm) setTimeout(() => createInputRef.current?.focus(), 0);
  }, [showCreateForm]);

  // Session reset when drawer opens
  useEffect(() => {
    if (!open) return;
    setShowCreateForm(false);
    setCreatedThisSession(false);
    setNewName("");
    setShareOpenId(null);
    setDeletingId(null);
    setConfirmId(null);
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

  //Helper to get owner label
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
    if (u) return u; // fallback to username if no names
    return "—";
  }

  async function handleUnsubscribe(listId, userId) {
    const { error } = await supabase
      .from("list_members")
      .delete()
      .eq("list_id", listId)
      .eq("user_id", userId);

    if (error) {
      toast.error("Error unsubscribing");
    } else {
      toast.success("You’ve unsubscribed from this list");
      // Refresh lists
      onAfterDelete(listId);
    }
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
            const inviting = shareOpenId === list.id;
            const canInvite =
              list?.created_by === user.id || list?._role === "owner";

            return (
              <div key={list.id} className="rounded border p-3">
                {/* Row header */}
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div
                      className={`font-medium ${inviting ? "" : "truncate"}`}
                    >
                      {list.name || "Untitled"}
                    </div>
                    <div className="text-xs text-gray-500">
                      Owner: {ownerLabelFor(list, user)}
                    </div>
                  </div>

                  {/* Actions */}
                  {!isConfirming ? (
                    <div className="flex items-center gap-2 shrink-0">
                      {/* Hide Rename/Delete when inviting; show only trigger next to name (form is below) */}
                      {!inviting && (
                        <>
                          <button
                            type="button"
                            disabled={busy || creating}
                            className="text-sm px-2 py-1 hover:bg-gray-100 opacity-60"
                            title="Rename (coming soon)"
                            aria-disabled="true"
                          >
                            <FaPencilAlt className="w-5 h-5" />
                          </button>

                          {canInvite && (
                            <ShareListInline
                              listId={list.id}
                              currentUserId={user.id}
                              isOpen={inviting}
                              onOpenChange={(open) =>
                                setShareOpenId(open ? list.id : null)
                              }
                              render="trigger" // icon-only
                            />
                          )}

                          <button
                            type="button"
                            onClick={() => setConfirmId(list.id)}
                            disabled={busy || creating}
                            className="text-sm px-2 py-1 text-red-600 hover:bg-red-50"
                            aria-label={`Delete list ${
                              list.name || "Untitled"
                            }`}
                          >
                            <FaTrashAlt className="w-5 h-5" />
                          </button>
                        </>
                      )}

                      {/* When inviting, keep actions minimal (close lives in the form below) */}
                      {inviting && canInvite && (
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
                        aria-label="Cancel delete"
                        title="Cancel"
                      >
                        <FaXmark />
                      </button>
                    </div>
                  )}
                </div>

                {/* Invite form below the row (appears only when inviting) */}
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
