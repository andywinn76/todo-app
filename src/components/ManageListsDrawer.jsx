"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "sonner";
import ShareListInline from "@/components/ShareListInline";
import { FaGripVertical, FaPencilAlt } from "react-icons/fa";
import ListActions from "@/components/ListActions";
import { useLists } from "@/components/ListsProvider";
import ListTypeBadge from "@/components/ListTypeBadge";
import { LIST_TYPES, LIST_TYPE_LABELS } from "@/utils/listTypes";
import { Search } from "lucide-react";

function TypePicker({ value, onChange, disabled, id = "drawer-list-type" }) {
  return (
    <>
      <label className="mb-1.5 block text-sm font-medium text-stone-700" htmlFor={id}>
        List type
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        className="app-select mb-3 w-full"
        disabled={disabled}
      >
        <option value="todo">Todo</option>
        <option value="grocery">Grocery</option>
        <option value="note">Note</option>
        <option value="secure_note">Secure Note</option>
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
  onOpenSearch,
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

  // List filter / search
  const [filterQuery, setFilterQuery] = useState("");
  const [sortOrder, setSortOrder] = useState("custom");
  const [orderedIds, setOrderedIds] = useState([]);
  const [databaseOrderAvailable, setDatabaseOrderAvailable] = useState(false);
  const [draggingId, setDraggingId] = useState(null);
  const dragRef = useRef(null);
  const listScrollRef = useRef(null);
  const orderKey = user ? `list-order:${user.id}` : null;

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
    setFilterQuery("");
  }, [open]);

  useEffect(() => {
    if (!open || !orderKey || !user?.id || !lists.length) return;
    let cancelled = false;
    let localIds = [];
    try {
      const saved = JSON.parse(localStorage.getItem(orderKey) || "[]");
      localIds = Array.isArray(saved) ? saved.map(String) : [];
    } catch {}
    setOrderedIds(localIds);
    setDatabaseOrderAvailable(false);

    async function loadOrder() {
      const { data, error } = await supabase
        .from("list_members")
        .select("list_id, position")
        .eq("user_id", user.id);
      if (cancelled || error) return; // Browser order remains available until migration.
      setDatabaseOrderAvailable(true);

      const savedRows = (data || [])
        .filter((row) => Number.isInteger(row.position))
        .sort((a, b) => a.position - b.position);
      if (savedRows.length) {
        setOrderedIds(savedRows.map((row) => String(row.list_id)));
        return;
      }

      // Carry an existing browser order into the database once, when no
      // database order has been saved yet for this member.
      if (localIds.length) {
        const knownIds = new Set(lists.map((list) => String(list.id)));
        const imported = [...new Set(localIds.filter((id) => knownIds.has(id)))];
        for (const list of lists) {
          if (!imported.includes(String(list.id))) imported.push(String(list.id));
        }
        const { error: importError } = await supabase.rpc("reorder_my_lists", {
          ordered_list_ids: imported,
        });
        if (!cancelled) {
          if (importError) setDatabaseOrderAvailable(false);
          else setOrderedIds(imported);
        }
      }
    }

    loadOrder();
    return () => { cancelled = true; };
  }, [open, orderKey, user?.id, lists]);

  const displayedLists = useMemo(() => {
    const query = filterQuery.trim().toLocaleLowerCase();
    const filtered = lists.filter((list) =>
      !query || (list.name || "").toLocaleLowerCase().includes(query)
    );
    if (sortOrder !== "custom") {
      return filtered.sort((a, b) => {
        const comparison = (optimisticNames[a.id] ?? a.name ?? "").localeCompare(
          optimisticNames[b.id] ?? b.name ?? "", undefined,
          { sensitivity: "base", numeric: true }
        );
        return sortOrder === "az" ? comparison : -comparison;
      });
    }
    const positions = new Map(orderedIds.map((id, index) => [id, index]));
    return filtered.sort((a, b) =>
      (positions.get(String(a.id)) ?? Infinity) - (positions.get(String(b.id)) ?? Infinity)
    );
  }, [filterQuery, lists, optimisticNames, orderedIds, sortOrder]);

  function handleDragStart(event, id) {
    if (event.button !== 0 || sortOrder !== "custom" || filterQuery.trim()) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const original = displayedLists.map((list) => String(list.id));
    dragRef.current = { id: String(id), original, latest: original };
    setDraggingId(id);

    const handleMove = (moveEvent) => {
      const scroll = listScrollRef.current;
      if (scroll) {
        const bounds = scroll.getBoundingClientRect();
        if (moveEvent.clientY < bounds.top + 45) scroll.scrollTop -= 12;
        else if (moveEvent.clientY > bounds.bottom - 45) scroll.scrollTop += 12;
      }
      const targetId = document.elementFromPoint(moveEvent.clientX, moveEvent.clientY)
        ?.closest("[data-drawer-list-id]")?.dataset.drawerListId;
      const drag = dragRef.current;
      if (!drag || !targetId || targetId === drag.id) return;
      const next = drag.latest.slice();
      const from = next.indexOf(drag.id);
      const to = next.indexOf(targetId);
      if (from < 0 || to < 0 || from === to) return;
      next.splice(from, 1);
      next.splice(to, 0, drag.id);
      drag.latest = next;
      setOrderedIds(next);
    };

    const handleEnd = async () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleEnd);
      window.removeEventListener("pointercancel", handleEnd);
      const drag = dragRef.current;
      dragRef.current = null;
      setDraggingId(null);
      if (!drag || drag.latest.join() === drag.original.join()) return;
      if (databaseOrderAvailable) {
        const { error } = await supabase.rpc("reorder_my_lists", {
          ordered_list_ids: drag.latest,
        });
        if (error) {
          console.error("Error saving list order:", error);
          setOrderedIds(drag.original);
          toast.error("Couldn’t save the new list order.");
          return;
        }
      }
      try {
        localStorage.setItem(orderKey, JSON.stringify(drag.latest));
      } catch {
        if (!databaseOrderAvailable) {
          setOrderedIds(drag.original);
          toast.error("Couldn’t save the new list order.");
        }
      }
    };
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleEnd, { once: true });
    window.addEventListener("pointercancel", handleEnd, { once: true });
  }

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
        className={`fixed inset-y-0 left-0 z-50 w-full max-w-[420px] bg-[var(--surface)] shadow-2xl p-5 outline-none
          flex flex-col h-dvh transform transition-transform duration-300 ease-out ${
            open ? "translate-x-0" : "-translate-x-full"
          }`}
        tabIndex={-1}
      >
        <div className="mb-5 flex items-center justify-between">
          <h2
            id="manage-lists-title"
            className="text-xl font-semibold tracking-tight text-stone-900"
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
                className="flex size-9 items-center justify-center rounded-lg bg-[var(--accent)] text-xl font-medium leading-none text-white hover:bg-[var(--accent-hover)]"
                aria-controls="create-list-form"
                aria-label="Add new list"
              >
                +
              </button>
            )}

            <button
              onClick={handleClose}
              disabled={busy || creating}
              className="app-icon-button text-xl"
              aria-label="Close manage lists"
            >
              ×
            </button>
          </div>
        </div>

        {/* Search / filter */}
        <div className="relative mb-5">
          <Search className="list-filter-icon pointer-events-none absolute top-1/2 size-4 -translate-y-1/2 text-stone-400" aria-hidden="true" />
          <input
            type="text"
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            placeholder="Filter lists…"
            className="app-input list-filter-input w-full pr-3 py-2.5 text-sm"
          />
        </div>

        <button
          type="button"
          onClick={() => {
            onClose?.();
            onOpenSearch?.();
          }}
          className="mb-5 flex w-full items-center gap-2 rounded-lg border border-stone-200 bg-white px-3 py-2.5 text-left text-sm font-medium text-[var(--accent)] transition hover:border-[#c7d8cd] hover:bg-[#f5f9f5] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)]"
        >
          <Search className="size-4 shrink-0" aria-hidden="true" />
          Search all items
          <span className="ml-auto text-xs font-normal text-stone-400">Ctrl/⌘ K</span>
        </button>

        {/* Form to create a new list */}
        {showCreateForm && (
          <form
            id="create-list-form"
            onSubmit={handleCreate}
            className="mb-5 rounded-xl border border-[#dfe8df] bg-[#f8faf7] p-4"
          >
            <h3 className="mb-4 text-base font-semibold text-stone-900">Create a list</h3>
            <label className="mb-1.5 block text-sm font-medium text-stone-700" htmlFor="new-list-name">
              New list name
            </label>
            <input
              id="new-list-name"
              ref={createInputRef}
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="app-input mb-4 w-full px-3 py-2.5 text-sm"
              placeholder="e.g., Groceries, Trip Planning"
              disabled={creating}
            />

            <TypePicker
              value={newType}
              onChange={setNewType}
              disabled={creating}
            />

            <div className="mt-4 flex gap-2">
              <button
                type="submit"
                disabled={creating || !newName.trim()}
                className={`${
                  creating ? "opacity-75 cursor-not-allowed" : ""
                } rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed disabled:opacity-70`}
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
                className="rounded-lg border border-stone-200 bg-white px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        <div className="mb-3 flex items-center justify-between gap-3">
          <span className="text-sm font-medium text-stone-500">{lists.length} lists</span>
          <label className="flex items-center gap-2 text-sm text-stone-500">
            <span>Sort by</span>
            <select
              value={sortOrder}
              onChange={(event) => setSortOrder(event.target.value)}
              className="app-select"
              aria-label="Sort lists"
            >
              <option value="custom">Custom order</option>
              <option value="az">A–Z</option>
              <option value="za">Z–A</option>
            </select>
          </label>
        </div>

        {/* Existing lists */}
        <div ref={listScrollRef} className="min-h-0 flex-1 space-y-1 overflow-y-auto pr-1 pb-2">
          {lists.length === 0 && (
            <p className="space-y-2 flex-1 min-h-0 overflow-y-auto pr-1 pb-4">
              No lists found.
            </p>
          )}

          {lists.length > 0 && filterQuery.trim() && displayedLists.length === 0 && (
            <p className="text-sm text-gray-500 px-1 py-2">
              No lists match &ldquo;{filterQuery}&rdquo;
            </p>
          )}

          {displayedLists.map((list) => {
            const inviting = shareOpenId === list.id;
            const canInvite = isOwner(list);
            const isCurrent = list.id === activeListId;

            return (
              <div
                key={list.id}
                data-drawer-list-id={list.id}
                className={`drawer-list-row rounded-xl px-2 py-1 ${
                  isCurrent
                    ? "drawer-list-row-current"
                    : ""
                } ${draggingId === list.id ? "relative z-10 shadow-md ring-2 ring-[var(--accent)]" : ""}`}
              >
                {/* Row header */}
                <div className="flex items-center justify-between gap-1">
                  <button
                    type="button"
                    onPointerDown={(event) => handleDragStart(event, list.id)}
                    disabled={sortOrder !== "custom" || !!filterQuery.trim()}
                    className="-ml-1 flex size-7 shrink-0 touch-none cursor-grab items-center justify-center rounded text-stone-400 hover:bg-stone-100 hover:text-stone-700 active:cursor-grabbing focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)] disabled:cursor-default disabled:opacity-30 disabled:hover:bg-transparent"
                    aria-label={`Reorder ${list.name}`}
                    title={sortOrder !== "custom" ? "Choose Custom order to drag lists" : filterQuery.trim() ? "Clear the filter to drag lists" : "Drag to reorder"}
                  >
                    <FaGripVertical className="size-4" aria-hidden="true" />
                  </button>
                  {/* SELECT BUTTON (left column) */}
                  <button
                    type="button"
                    className="min-w-0 flex-1 rounded-lg px-2 py-2 text-left hover:bg-white/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
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
                        <span className="ml-2 text-xs font-medium text-[var(--accent)]">
                          Current
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
                  <div className="drawer-list-actions flex shrink-0 items-center gap-0.5">
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
                          className="min-w-0 w-full px-2 py-1"
                        >
                          <div className="backdrop-blur-sm bg-blue-500/5 border border-black/20 rounded-md p-2 shadow-md flex flex-col sm:flex-row sm:items-center sm:gap-1 gap-2">
                            <span>Renaming list...</span>
                            
                            <input
                              autoFocus
                              type="text"
                              value={renameValue}
                              onChange={(e) => setRenameValue(e.target.value)}
                              className="flex-1 min-w-0 w-full border rounded px-2 py-1 bg-white"
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
                          </div>
                        </form>
                      ) : (
                        // ✏️ Show the pencil when not renaming
                        <button
                          type="button"
                          disabled={busy || creating || renaming}
                          onClick={() => startRename(list)}
                          className="app-icon-button"
                          title="Rename list"
                        >
                          <FaPencilAlt className="size-4" />
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
