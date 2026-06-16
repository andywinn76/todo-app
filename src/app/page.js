"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import useRequireAuth from "@/hooks/useRequireAuth";
import { useLists } from "@/components/ListsProvider";
import ShareListInline from "@/components/ShareListInline";
import TodoForm from "@/components/TodoForm";
import TodoList from "@/components/TodoList";
import GroceryList from "@/components/GroceryList";
import NoteEditor from "@/components/NoteEditor";
import ListActions from "@/components/ListActions";
import ManageListsDrawer from "@/components/ManageListsDrawer";
import ListTitleSwitcher from "@/components/ListTitleSwitcher";
import SecureNotesEditor from "@/components/SecureNotesEditor";
import { TYPE_CONFIG } from "@/lib/typeConfig";
import ListTypeBadge from "@/components/ListTypeBadge";
import SearchDialog from "@/components/SearchDialog";
import { Search } from "lucide-react";

export default function Home() {
  const { user, userLoading } = useRequireAuth();
  const { lists, activeListId, setActiveListId, refreshLists } = useLists();

  // ⬇️ local UI state only
  const [addOpen, setAddOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  // ⬇️ NEW: last created row for optimistic append (sent to <TodoList />)
  const [lastCreated, setLastCreated] = useState(null);

  // --- Effects hardening ---
  const didRunForUserId = useRef(null);
  const lastRefreshAt = useRef(0);
  const COOLDOWN_MS = 400;

  useEffect(() => {
    if (userLoading) return; // wait until auth is settled
    const uid = user?.id ?? null;

    if (!uid) {
      // Logout or unauthenticated
      didRunForUserId.current = null;
      return;
    }

    if (didRunForUserId.current === uid) return; // StrictMode double-mount guard

    const now = Date.now();
    if (now - lastRefreshAt.current < COOLDOWN_MS) return; // tiny cooldown

    didRunForUserId.current = uid;
    lastRefreshAt.current = now;
    void refreshLists?.();
  }, [user?.id, userLoading, refreshLists]);

  const hasValidActive =
    activeListId != null && lists.some((l) => l.id === activeListId);

  const activeList = useMemo(
    () => (hasValidActive ? lists.find((l) => l.id === activeListId) : null),
    [hasValidActive, lists, activeListId],
  );

  // Robust owner check
  const isOwner =
    !!activeList &&
    (String(activeList.created_by) === String(user?.id) ||
      String(activeList._role).toLowerCase() === "owner");

  const activeListType = activeList?.type || "todo";
  const cfg = useMemo(
    () => TYPE_CONFIG[activeListType] || {},
    [activeListType],
  );

  // Owner label
  const ownerFirst =
    activeList?.owner_first_name ||
    user?.user_metadata?.first_name ||
    user?.user_metadata?.full_name?.split(" ")?.[0] ||
    "";
  const ownerLast =
    activeList?.owner_last_name ||
    user?.user_metadata?.last_name ||
    user?.user_metadata?.full_name?.split(" ")?.[1] ||
    "";
  const ownerLabel = ownerFirst
    ? `List Owner: ${ownerFirst} ${
        ownerLast ? ownerLast[0].toUpperCase() + "." : ""
      }`
    : null;

  // Auto-close Add when switching to a type that doesn’t support it
  useEffect(() => {
    if (addOpen && !cfg.supportsAdd) setAddOpen(false);
  }, [cfg.supportsAdd, addOpen]);

  // Cmd/Ctrl+K to open search
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen((v) => !v);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  if (!user || userLoading) return <p className="p-6">Loading...</p>;

  return (
    <main className="px-4 sm:px-6 py-6">
      {/* Header row */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3 sm:gap-4">
        {/* LEFT */}
        <div className="min-w-0 flex-1">
          <div className="min-w-0 flex items-center gap-2">
            <div className="min-w-0 flex-1 sm:max-w-[70%]">
              <div className="truncate">
                <ListTitleSwitcher onOpenManage={() => setManageOpen(true)} />
              </div>
            </div>
          </div>

          {activeListId && isOwner && (
            <ShareListInline
              listId={activeListId}
              currentUserId={user.id}
              isOpen={shareOpen}
              onOpenChange={setShareOpen}
              onDone={() => setShareOpen(false)}
              render="form-below"
            />
          )}

          {lists.length > 0 && (activeListType || ownerLabel) && (
            <p className="mt-1 truncate text-sm text-gray-500">
              <ListTypeBadge type={activeListType} className="mr-2" />
              {activeListType && ownerLabel ? " • " : null}
              {ownerLabel || null}
            </p>
          )}
        </div>

        {/* RIGHT */}
        <div className="shrink-0 flex items-center gap-2">
          {/* Search button — always visible */}
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            aria-label="Search"
            title="Search (⌘K)"
            className="inline-flex items-center justify-center rounded p-1.5 hover:bg-gray-100"
          >
            <Search className="w-5 h-5 text-gray-600" />
          </button>

          {/* Per-list actions */}
          {activeListId && (
            <>
              {isOwner && (
                <ShareListInline
                  listId={activeListId}
                  currentUserId={user.id}
                  isOpen={shareOpen}
                  onOpenChange={setShareOpen}
                  render="trigger"
                />
              )}

              <ListActions
                activeList={activeList}
                currentUserId={user.id}
                onAfterDelete={async (deletedId) => {
                  if (deletedId === activeListId) setActiveListId?.(null);
                  lastRefreshAt.current = Date.now();
                  await refreshLists?.();
                }}
                onAfterUnsubscribe={async (leftId) => {
                  if (leftId === activeListId) setActiveListId?.(null);
                  lastRefreshAt.current = Date.now();
                  await refreshLists?.();
                }}
              />
            </>
          )}

          {/* Add / Cancel button */}
          {hasValidActive && cfg.supportsAdd && (
            <button
              onClick={() => setAddOpen((v) => !v)}
              className={`rounded w-9 h-9 flex items-center justify-center font-bold text-xl leading-none border ${
                addOpen
                  ? "bg-gray-200 hover:bg-gray-300"
                  : "bg-green-500 hover:bg-green-600 text-white"
              }`}
              aria-expanded={addOpen}
              aria-label={addOpen ? "Cancel" : cfg.addLabel || "Add"}
              title={addOpen ? "Cancel" : cfg.addLabel || "Add"}
              type="button"
            >
              {addOpen ? "×" : "+"}
            </button>
          )}
        </div>
      </div>

      {/* Body */}
      {!hasValidActive ? (
        <div className="text-gray-600">
          Select or create a list to get started.
        </div>
      ) : activeListType === "todo" ? (
        <>
          {addOpen && activeListId && (
            <TodoForm
              user={user}
              onCreated={(row) => {
                setLastCreated(row);
                setAddOpen(false);
              }}
              isActive={addOpen}
              setIsActive={setAddOpen}
            />
          )}
          <TodoList lastCreated={lastCreated} />
        </>
      ) : activeListType === "grocery" ? (
        <GroceryList
          user={user}
          listId={activeListId}
          open={addOpen}
          onOpenChange={setAddOpen}
        />
      ) : activeListType === "secure_note" ? (
        <SecureNotesEditor user={user} listId={activeListId} />
      ) : activeListType === "note" ? (
        <NoteEditor user={user} listId={activeListId} />
      ) : null}

      <SearchDialog
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
      />

      <ManageListsDrawer
        open={manageOpen}
        onClose={() => setManageOpen(false)}
        user={user}
        lists={lists}
        triggerRef={{ current: null }}
        onAfterCreate={async (created) => {
          lastRefreshAt.current = Date.now();
          const updated = await refreshLists?.();
          if (created?.id) setActiveListId?.(created.id);
        }}
        onAfterRename={async () => {
          lastRefreshAt.current = Date.now();
          await refreshLists?.();
        }}
        onAfterDelete={async (deletedId) => {
          lastRefreshAt.current = Date.now();
          const updated = await refreshLists?.();
          if (deletedId === activeListId) {
            if (updated?.length) setActiveListId?.(updated[0].id);
            else setActiveListId?.(null);
          }
        }}
      />
    </main>
  );
}
