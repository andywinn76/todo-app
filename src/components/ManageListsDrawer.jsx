"use client";
import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "sonner";

export default function ManageListsDrawer({
  open,
  onClose,
  user,
  lists,
  onAfterDelete, // async fn: (deletedListId) => void
}) {
  const [deletingId, setDeletingId] = useState(null);
  const [confirmId, setConfirmId] = useState(null);
  const [busy, setBusy] = useState(false);

  if (!open) return null;

  async function handleDelete(list) {
    if (!user) return;
    setBusy(true);

    // Safer for now: delete todos first (in case FK isn't ON DELETE CASCADE)
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
      .eq("created_by", user.id); // creator-only policy

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

  return (
    <>
      {/* overlay */}
      <div
        className="fixed inset-0 bg-black/40 z-40"
        onClick={() => !busy && onClose()}
      />
      {/* drawer */}
      <aside
        className="fixed bottom-0 left-0 right-0 z-50 rounded-t-2xl bg-white shadow-2xl p-4 sm:left-auto sm:top-0 sm:bottom-0 sm:w-[380px] sm:rounded-none sm:right-0"
        aria-modal
        role="dialog"
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Manage Lists</h2>
          <button
            onClick={onClose}
            disabled={busy}
            className="text-sm px-3 py-1 rounded border hover:bg-gray-50"
          >
            Close
          </button>
        </div>

        <div className="space-y-2 max-h-[70vh] overflow-auto pr-1">
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
                  {/* room for a count later */}
                </div>

                {!isConfirming ? (
                  <div className="flex items-center gap-2">
                    {/* Placeholder for Rename later */}
                    <button
                      type="button"
                      disabled={busy}
                      className="text-sm px-2 py-1 rounded border hover:bg-gray-50 opacity-60 cursor-not-allowed"
                      title="Rename (coming soon)"
                    >
                      Rename
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmId(list.id)}
                      disabled={busy}
                      className="text-sm px-2 py-1 rounded border border-red-300 text-red-600 hover:bg-red-50"
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
                      disabled={busy}
                      className={`text-sm px-2 py-1 rounded bg-red-600 text-white hover:bg-red-700 ${
                        isDeleting ? "opacity-70 cursor-not-allowed" : ""
                      }`}
                      title="This removes the list and its todos"
                    >
                      {isDeleting ? "Deleting…" : "Confirm delete"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmId(null)}
                      disabled={busy}
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
