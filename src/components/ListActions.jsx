"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "sonner";
import { FaTrashAlt } from "react-icons/fa";
import { FaUserMinus } from "react-icons/fa6";

/**
 * Props:
 * - activeList: { id, name, created_by?, owner_id?, owner?, _role?, ... }
 * - currentUserId: string
 * - onAfterDelete?: (deletedListId: string|number) => Promise<void> | void
 * - onAfterUnsubscribe?: (listId: string|number) => Promise<void> | void
 * - size?: "sm" | "md"
 */
export default function ListActions({
  activeList,
  currentUserId,
  onAfterDelete,
  onAfterUnsubscribe,
  size = "sm",
}) {
  const [busy, setBusy] = useState(false);

  if (!activeList?.id) return null;

  // ✅ Robust owner check for your data shapes
  const isOwner = (() => {
    const cid = String(currentUserId ?? "");
    const createdBy =
      activeList?.created_by != null ? String(activeList.created_by) : null;
    const ownerId =
      activeList?.owner_id != null
        ? String(activeList.owner_id)
        : activeList?.owner?.id != null
        ? String(activeList.owner.id)
        : null;
    const roleOwner = activeList?._role === "owner";
    return cid && (cid === createdBy || cid === ownerId || roleOwner);
  })();

  const btnBase =
    "inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium transition disabled:opacity-50 disabled:cursor-not-allowed";
  const btnSm = size === "sm" ? "h-7" : "h-8";
  const btnMed = size === "md" ? "h-12" : "h-8";
  const danger = "hover:bg-red-100 text-red-700";
  const warn = "border-amber-200 bg-amber-50 hover:bg-amber-100 text-amber-700";

  async function handleDelete() {
    if (!window.confirm(`Delete “${activeList.name}”? This cannot be undone.`))
      return;
    try {
      setBusy(true);
      const { error } = await supabase
        .from("lists")
        .delete()
        .eq("id", activeList.id);
      if (error) throw error;
      toast.success("List deleted.");
      await onAfterDelete?.(activeList.id);
    } catch (err) {
      console.error(err);
      toast.error("Could not delete the list.");
    } finally {
      setBusy(false);
    }
  }

  async function handleUnsubscribe() {
    if (
      !window.confirm(`Leave “${activeList.name}”? You will lose access to it.`)
    )
      return;
    try {
      setBusy(true);
      const { error } = await supabase
        .from("list_members")
        .delete()
        .match({ list_id: activeList.id, user_id: currentUserId });
      if (error) throw error;
      toast.success("You've left the list.");
      await onAfterUnsubscribe?.(activeList.id);
    } catch (err) {
      console.error(err);
      toast.error("Could not leave the list.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      {isOwner ? (
        <button
          type="button"
          onClick={handleDelete}
          disabled={busy}
          className={`${btnSm} ${danger}`}
          title="Delete list"
        >
          <FaTrashAlt className="w-5 h-5" />
        </button>
      ) : (
        <button
          type="button"
          onClick={handleUnsubscribe}
          disabled={busy}
          className={` ${warn}`}
          title="Leave this list"
        >
          <FaUserMinus className="w-5 h-5" />
          {/* <span className="hidden sm:inline">Unsubscribe</span> */}
        </button>
      )}
    </div>
  );
}
