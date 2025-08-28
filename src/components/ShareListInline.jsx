"use client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { sendInvite } from "@/lib/invites";
import { FaUserPlus, FaTimes } from "react-icons/fa";
import { FaShareAlt } from "react-icons/fa";
import { FaXmark } from "react-icons/fa6";

/**
 * Props:
 * - listId (string | number)
 * - currentUserId (string)
 * - isOpen?: boolean           // controlled open state (optional)
 * - onOpenChange?: (open) => void
 * - onDone?: () => void        // called after successful invite
 * - render?: "combined" | "trigger" | "form-below"
 *     - "combined"   => button + popover dropdown (default)
 *     - "trigger"    => button only (use with a separate "form-below" instance)
 *     - "form-below" => renders the form as an inline block (when open)
 */
export default function ShareListInline({
  listId,
  currentUserId,
  isOpen,
  onOpenChange,
  onDone,
  render = "combined",
}) {
  const isControlled = typeof isOpen === "boolean" && typeof onOpenChange === "function";
  const [internalOpen, setInternalOpen] = useState(false);
  const open = isControlled ? isOpen : internalOpen;
  const setOpen = isControlled ? onOpenChange : setInternalOpen;

  const [username, setUsername] = useState("");
  const [busy, setBusy] = useState(false);

  // Close on Escape (for combined + form-below)
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, setOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim()) return;

    setBusy(true);
    const { error } = await sendInvite({ listId, username, currentUserId });
    setBusy(false);

    if (error) {
      toast.error(error.message || "Failed to send invite.");
      return;
    }

    toast.success("Invite sent successfully");
    setUsername("");
    setOpen(false);
    onDone?.();
  };

  const Trigger = (
    <button
      type="button"
      className="inline-flex items-center justify-center rounded p-1.5 hover:bg-gray-100"
      onClick={() => setOpen(!open)}
      aria-expanded={open}
      aria-controls={`share-form-${listId}`}
      aria-label="Invite user to this list"
      title="Invite user"
    >
      <FaShareAlt className="text-blue-600 w-5 h-5" />
    </button>
  );

  const Form = (
    <form
      id={`share-form-${listId}`}
      onSubmit={handleSubmit}
      className="w-full max-w-md rounded-md border bg-white p-2 shadow-sm"
    >
      <div className="flex items-start gap-2">
        <div className="flex-1">
          <label className="block text-xs text-gray-600 mb-1">
            Invite by username or email
          </label>
          <input
            type="text"
            placeholder="username or email"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full rounded border px-2 py-1 text-sm"
            disabled={busy}
            autoFocus
          />
        </div>
        <div className="flex flex-col gap-2">
          <button
            type="submit"
            className="rounded bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
            disabled={busy}
          >
            {busy ? "…" : "Invite"}
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="inline-flex items-center justify-center rounded border px-2 py-1 text-xs hover:bg-gray-50"
            aria-label="Close"
            title="Close"
          >
            <FaXmark />
          </button>
        </div>
      </div>
      <div className="mt-2 text-[11px] text-gray-500">
        Only list owners can send invites.
      </div>
    </form>
  );

  if (render === "trigger") {
    return <div className="relative">{Trigger}</div>;
  }

  if (render === "form-below") {
    // Inline block that pushes content below the title, no absolute positioning.
    return open ? <div className="mt-2">{Form}</div> : null;
  }

  // Default: combined with a small dropdown popover
  return (
    <div className="relative">
      {Trigger}
      {open && (
        <div className="absolute right-0 mt-2 w-72 rounded-md border bg-white p-2 shadow-lg z-50">
          {Form}
        </div>
      )}
    </div>
  );
}
