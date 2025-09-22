// "use client";
// import { useEffect, useRef, useState } from "react";
// import { toast } from "sonner";
// import {
//   acceptInvite,
//   declineInvite,
//   fetchPendingInvites,
//   subscribeToInvites,
// } from "@/lib/invites";
// import { Check } from "lucide-react";
// import { supabase } from "@/lib/supabaseClient";
// import { useLists } from "@/components/ListsProvider";

// function BellIcon({ className = "w-5 h-5" }) {
  
//   return (
//     <svg
//       className={className}
//       viewBox="0 0 24 24"
//       fill="none"
//       aria-hidden="true"
//     >
//       <path
//         d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 1 0-12 0v3.2c0 .5-.2 1-.6 1.4L4 17h5m6 0a3 3 0 1 1-6 0m6 0H9"
//         stroke="currentColor"
//         strokeWidth="1.5"
//         strokeLinecap="round"
//         strokeLinejoin="round"
//       />
//     </svg>
//   );
// }

// export default function InvitesBell({ userId }) {
//   const { refreshLists, setActiveListId } = useLists();
//   const [open, setOpen] = useState(false);
//   const [items, setItems] = useState([]);
//   const [busy, setBusy] = useState(false);
//   const rootRef = useRef(null);

//   async function refreshInvites() {
//     const listRes = await fetchPendingInvites(userId);
//     if (!listRes.error) setItems(listRes.data || []);
//   }

//   useEffect(() => {
//     if (!userId) return;
//     refreshInvites();
//     const unsubscribe = subscribeToInvites(userId, () => {
//       refreshInvites();
//       toast.info("You have a new list invite.");
//     });
//     return unsubscribe;
//   }, [userId]);

//   // Close popover on Escape / outside click
//   useEffect(() => {
//     if (!open) return;

//     const onKeyDown = (e) => {
//       if (e.key === "Escape") {
//         e.preventDefault();
//         setOpen(false);
//       }
//     };
//     const onPointerDown = (e) => {
//       const root = rootRef.current;
//       if (root && !root.contains(e.target)) setOpen(false);
//     };

//     document.addEventListener("keydown", onKeyDown);
//     document.addEventListener("pointerdown", onPointerDown, true);
//     return () => {
//       document.removeEventListener("keydown", onKeyDown);
//       document.removeEventListener("pointerdown", onPointerDown, true);
//     };
//   }, [open]);

  
//   async function handlePostAccept(listId, listName) {
//   await refreshLists();
//   setActiveListId(listId);
//   toast.success(`Joined “${listName || "list"}”`);
// }


//   // Accept a SINGLE invite (expects the full invite object with listId/listName)
//   async function onAcceptInvite(inv) {
//     if (busy) return;
//     setBusy(true);
//     const { error } = await acceptInvite(inv.id);
//     setBusy(false);

//     if (error) {
//       return toast.error(error.message || "Could not accept invite");
//     }

//     // Remove it from the local list and close popover
//     setItems((prev) => prev.filter((i) => i.id !== inv.id));
//     setOpen(false);

//     // Now run the post-accept cascade
//     await handlePostAccept(inv.listId, inv.listName);
//   }

//   // Decline a SINGLE invite
//   async function onDeclineInvite(invId) {
//     if (busy) return;
//     setBusy(true);
//     const { error } = await declineInvite(invId);
//     setBusy(false);
//     if (error) return toast.error(error.message || "Could not decline invite");
//     toast.success("Invite declined");
//     refreshInvites();
//     setOpen(false)
//   }

//   // One-click: accept newest invite (uses the first item from state)
//   async function onQuickAccept() {
//     if (busy) return;

//     if (items.length) {
//       await onAcceptInvite(items[0]);
//       return;
//     }

//     // Fallback fetch
//     const { data, error } = await supabase
//       .from("invites")
//       .select("id, list_id")
//       .eq("invitee", userId)
//       .eq("status", "pending")
//       .order("created_at", { ascending: false })
//       .limit(1);

//     if (!error && data?.length) {
//       // We only have list_id here, not name — that’s okay
//       setBusy(true);
//       const { error: err2 } = await acceptInvite(data[0].id);
//       setBusy(false);
//       if (err2) return toast.error(err2.message || "Could not accept invite");
//       setOpen(false);
//       await handlePostAccept(data[0].list_id, undefined);
//     }
//   }

//   // Accept ALL pending invites (activate the newest one by default)
//   async function onAcceptAll() {
//     if (busy || items.length === 0) return;

//     setBusy(true);
//     const results = await Promise.allSettled(
//       items.map((i) => acceptInvite(i.id))
//     );
//     setBusy(false);

//     const failed = results.filter(
//       (r) => r.status === "rejected" || r.value?.error
//     );
//     if (failed.length) {
//       toast.error(`Some invites failed (${failed.length}).`);
//     } else {
//       toast.success(
//         `Joined ${items.length} list${items.length > 1 ? "s" : ""}`
//       );
//     }

//     // Choose which list to activate: the newest one (first item, since you order desc)
//     const newest = items[0];
//     setItems([]);
//     setOpen(false);

//     if (newest) {
//       await handlePostAccept(newest.listId, newest.listName);
//     } else {
//       // If for some reason we don't have it, just soft-reload
//       setTimeout(() => window.location.reload(), 150);
//     }
//   }

//   const count = items.length;

//   return (
//     <div ref={rootRef} className="relative flex items-center gap-1.5">
//       {count > 0 && (
//         <button
//           onClick={onQuickAccept}
//           disabled={busy}
//           className="inline-flex items-center justify-center rounded p-1.5 hover:bg-gray-100 disabled:opacity-50"
//           aria-label="Accept latest invite"
//           title="Accept latest invite"
//           type="button"
//         >
//           <Check className="w-5 h-5" />
//         </button>
//       )}

//       <button
//         onClick={() => setOpen((v) => !v)}
//         className="relative inline-flex items-center justify-center rounded p-1.5 hover:bg-gray-100 disabled:opacity-50"
//         aria-label="Invites"
//         aria-expanded={open}
//         aria-haspopup="menu"
//         title="Invites"
//         type="button"
//         disabled={busy}
//       >
//         <BellIcon />
//         {count > 0 && (
//           <span
//             className="absolute -top-1 -right-1 inline-flex items-center justify-center rounded-full bg-red-600 text-white text-xs px-1"
//             style={{ minWidth: "1.25rem", height: "1.25rem" }}
//           >
//             {count > 9 ? "9+" : count}
//           </span>
//         )}
//       </button>

//       {/* MOBILE BACKDROP */}
//       {open && (
//         <div
//           className="fixed inset-0 z-40 bg-black/20 sm:hidden"
//           onClick={() => setOpen(false)}
//           aria-hidden="true"
//         />
//       )}

//       {open && (
//         <div
//           role="menu"
//           aria-label="Invites"
//           className={[
//             "z-50 bg-white border shadow-lg",
//             "fixed inset-x-3 top-20 rounded-2xl max-h-[75vh] overflow-hidden sm:inset-auto sm:top-auto sm:rounded",
//             "sm:absolute sm:right-0 sm:mt-2 sm:w-72",
//           ].join(" ")}
//         >
//           <div className="px-3 py-2 border-b flex items-center justify-between sticky top-0 bg-white">
//             <div className="font-medium text-sm">Invites</div>
//             {count > 1 && (
//               <button
//                 onClick={onAcceptAll}
//                 disabled={busy}
//                 className="text-xs rounded border px-2 py-1 hover:bg-gray-50 disabled:opacity-50"
//                 title="Accept all invites"
//                 type="button"
//               >
//                 Accept all
//               </button>
//             )}
//           </div>

//           <div className="max-h-[65vh] sm:max-h-72 overflow-auto">
//             {count === 0 ? (
//               <div className="px-3 py-4 text-sm text-gray-500">
//                 No pending invites
//               </div>
//             ) : (
//               items.map((inv) => (
//                 <div
//                   key={inv.id}
//                   className="px-3 py-2 border-b last:border-b-0"
//                 >
//                   <div className="text-sm font-medium">{inv.listName}</div>
//                   <div className="text-xs text-gray-500 mb-2">
//                     from {inv.inviterName}
//                   </div>
//                   <div className="flex items-center gap-2">
//                     <button
//                       onClick={() => onAcceptInvite(inv)}
//                       disabled={busy}
//                       className="rounded bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
//                       type="button"
//                     >
//                       Accept
//                     </button>
//                     <button
//                       onClick={() => onDeclineInvite(inv.id)}
//                       disabled={busy}
//                       className="rounded border px-3 py-1 text-sm hover:bg-gray-50 disabled:opacity-50"
//                       type="button"
//                     >
//                       Decline
//                     </button>
//                   </div>
//                 </div>
//               ))
//             )}
//           </div>
//         </div>
//       )}
//     </div>
//   );
// }
"use client";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  acceptInvite,
  declineInvite,
  fetchPendingInvites,
  subscribeToInvites,
} from "@/lib/invites";
import { Check } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useLists } from "@/components/ListsProvider";

function BellIcon({ className = "w-5 h-5" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 1 0-12 0v3.2c0 .5-.2 1-.6 1.4L4 17h5m6 0a3 3 0 1 1-6 0m6 0H9"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function InvitesBell({ userId }) {
  const { lists, refreshLists, setActiveListId } = useLists();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [busy, setBusy] = useState(false);
  const rootRef = useRef(null);

  async function refreshInvites() {
    const listRes = await fetchPendingInvites(userId);
    if (!listRes.error) setItems(listRes.data || []);
  }

  useEffect(() => {
    if (!userId) return;
    refreshInvites();
    const unsubscribe = subscribeToInvites(userId, () => {
      refreshInvites();
      toast.info("You have a new list invite.");
    });
    return unsubscribe;
  }, [userId]);

  // Close popover on Escape / outside click
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
      }
    };
    const onPointerDown = (e) => {
      const root = rootRef.current;
      if (root && !root.contains(e.target)) setOpen(false);
    };

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown, true);
    };
  }, [open]);

  // Ensure we activate a list using the provider's normalized ID (string UUID)
  async function handlePostAccept(listId, listName) {
    const updated = await refreshLists();
    const targetId = String(listId);
    const match =
      (updated || lists || []).find((l) => l.id === targetId) ||
      (lists || []).find((l) => l.id === targetId);

    if (match?.id) {
      setActiveListId(match.id);
    } else {
      // Fallback: set whatever we got (string)
      setActiveListId(targetId);
    }
    toast.success(`Joined “${listName || "list"}”`);
  }

  // Accept a SINGLE invite (expects the full invite object with listId/listName)
  async function onAcceptInvite(inv) {
    if (busy) return;
    setBusy(true);
    const { error } = await acceptInvite(inv.id);
    setBusy(false);

    if (error) {
      return toast.error(error.message || "Could not accept invite");
    }

    // Remove it from the local list and close popover
    setItems((prev) => prev.filter((i) => i.id !== inv.id));
    setOpen(false);

    // Now run the post-accept cascade
    await handlePostAccept(inv.listId, inv.listName);
  }

  // Decline a SINGLE invite
  async function onDeclineInvite(invId) {
    if (busy) return;
    setBusy(true);
    const { error } = await declineInvite(invId);
    setBusy(false);
    if (error) return toast.error(error.message || "Could not decline invite");
    toast.success("Invite declined");
    refreshInvites();
    setOpen(false);
  }

  // One-click: accept newest invite (uses the first item from state)
  async function onQuickAccept() {
    if (busy) return;

    if (items.length) {
      await onAcceptInvite(items[0]);
      return;
    }

    // Fallback fetch
    const { data, error } = await supabase
      .from("invites")
      .select("id, list_id")
      .eq("invitee", userId)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(1);

    if (!error && data?.length) {
      setBusy(true);
      const { error: err2 } = await acceptInvite(data[0].id);
      setBusy(false);
      if (err2) return toast.error(err2.message || "Could not accept invite");
      setOpen(false);
      await handlePostAccept(data[0].list_id, undefined);
    }
  }

  // Accept ALL pending invites (activate the newest one by default)
  async function onAcceptAll() {
    if (busy || items.length === 0) return;

    setBusy(true);
    const results = await Promise.allSettled(items.map((i) => acceptInvite(i.id)));
    setBusy(false);

    const failed = results.filter(
      (r) => r.status === "rejected" || r.value?.error
    );
    if (failed.length) {
      toast.error(`Some invites failed (${failed.length}).`);
    } else {
      toast.success(`Joined ${items.length} list${items.length > 1 ? "s" : ""}`);
    }

    // Choose which list to activate: the newest one by created_at (first item)
    const newest = items[0];
    setItems([]);
    setOpen(false);

    if (newest) {
      await handlePostAccept(newest.listId, newest.listName);
    } else {
      // Soft-reload if we lack context
      setTimeout(() => window.location.reload(), 150);
    }
  }

  const count = items.length;

  return (
    <div ref={rootRef} className="relative flex items-center gap-1.5">
      {count > 0 && (
        <button
          onClick={onQuickAccept}
          disabled={busy}
          className="inline-flex items-center justify-center rounded p-1.5 hover:bg-gray-100 disabled:opacity-50"
          aria-label="Accept latest invite"
          title="Accept latest invite"
          type="button"
        >
          <Check className="w-5 h-5" />
        </button>
      )}

      <button
        onClick={() => setOpen((v) => !v)}
        className="relative inline-flex items-center justify-center rounded p-1.5 hover:bg-gray-100 disabled:opacity-50"
        aria-label="Invites"
        aria-expanded={open}
        aria-haspopup="menu"
        title="Invites"
        type="button"
        disabled={busy}
      >
        <BellIcon />
        {count > 0 && (
          <span
            className="absolute -top-1 -right-1 inline-flex items-center justify-center rounded-full bg-red-600 text-white text-xs px-1"
            style={{ minWidth: "1.25rem", height: "1.25rem" }}
          >
            {count > 9 ? "9+" : count}
          </span>
        )}
      </button>

      {/* MOBILE BACKDROP */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/20 sm:hidden"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      {open && (
        <div
          role="menu"
          aria-label="Invites"
          className={[
            "z-50 bg-white border shadow-lg",
            "fixed inset-x-3 top-20 rounded-2xl max-h-[75vh] overflow-hidden sm:inset-auto sm:top-auto sm:rounded",
            "sm:absolute sm:right-0 sm:mt-2 sm:w-72",
          ].join(" ")}
        >
          <div className="px-3 py-2 border-b flex items-center justify-between sticky top-0 bg-white">
            <div className="font-medium text-sm">Invites</div>
            {count > 1 && (
              <button
                onClick={onAcceptAll}
                disabled={busy}
                className="text-xs rounded border px-2 py-1 hover:bg-gray-50 disabled:opacity-50"
                title="Accept all invites"
                type="button"
              >
                Accept all
              </button>
            )}
          </div>

          <div className="max-h-[65vh] sm:max-h-72 overflow-auto">
            {count === 0 ? (
              <div className="px-3 py-4 text-sm text-gray-500">No pending invites</div>
            ) : (
              items.map((inv) => (
                <div key={inv.id} className="px-3 py-2 border-b last:border-b-0">
                  <div className="text-sm font-medium">{inv.listName}</div>
                  <div className="text-xs text-gray-500 mb-2">from {inv.inviterName}</div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onAcceptInvite(inv)}
                      disabled={busy}
                      className="rounded bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
                      type="button"
                    >
                      Accept
                    </button>
                    <button
                      onClick={() => onDeclineInvite(inv.id)}
                      disabled={busy}
                      className="rounded border px-3 py-1 text-sm hover:bg-gray-50 disabled:opacity-50"
                      type="button"
                    >
                      Decline
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
