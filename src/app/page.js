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
import { TYPE_CONFIG } from "@/lib/typeConfig";
import ListTypeBadge from "@/components/ListTypeBadge";

export default function Home() {
  const { user, userLoading } = useRequireAuth();
  const { lists, activeListId, setActiveListId, refreshLists } = useLists();

  // ⬇️ local UI state only
  const [addOpen, setAddOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);

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
    [hasValidActive, lists, activeListId]
  );

  // Robust owner check
  const isOwner =
    !!activeList &&
    (String(activeList.created_by) === String(user?.id) ||
      String(activeList._role).toLowerCase() === "owner");

  const activeListType = activeList?.type || "todo";
  const cfg = useMemo(
    () => TYPE_CONFIG[activeListType] || {},
    [activeListType]
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

  if (!user || userLoading) return <p className="p-6">Loading...</p>;

  return (
    <main className="p-6">
      {/* Header row */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        {/* LEFT */}
        <div className="min-w-0 flex-1">
          <div className="min-w-0 flex items-center gap-2">
            <div className="min-w-0 flex-1">
              <div className="truncate">
                <ListTitleSwitcher onOpenManage={() => setManageOpen(true)} />
              </div>
            </div>

            {activeListId && (
              <div className="flex items-center gap-2 shrink-0">
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
              </div>
            )}
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
              {/* {activeListType ? <>Type: {activeListType}</> : null} */}
              <ListTypeBadge type={activeListType} className="mr-2" />
              {activeListType && ownerLabel ? " • " : null}
              {ownerLabel || null}
            </p>
          )}
        </div>

        {/* RIGHT */}
        {hasValidActive && cfg.supportsAdd && (
          <div className="shrink-0">
            <button
              onClick={() => setAddOpen((v) => !v)}
              className={`rounded px-4 py-2 font-semibold border ${
                addOpen
                  ? "bg-gray-200 hover:bg-gray-300"
                  : "bg-green-500 hover:bg-green-600 text-white"
              }`}
              aria-expanded={addOpen}
              aria-label={addOpen ? "Cancel" : cfg.addLabel || "Add"}
              title={addOpen ? "Cancel" : cfg.addLabel || "Add"}
              type="button"
            >
              {/* Mobile symbol */}
              <span className="sm:hidden text-xl leading-none">
                {addOpen ? "×" : "+"}
              </span>
              {/* Desktop label */}
              <span className="hidden sm:inline">
                {addOpen ? "Cancel" : cfg.addLabel || "Add"}
              </span>
            </button>
          </div>
        )}
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
                // Optimistic append path: hand the new row to <TodoList /> and close the form
                setLastCreated(row);
                setAddOpen(false);
              }}
              isActive={addOpen}
              setIsActive={setAddOpen}
            />
          )}
          {/* ⬇️ Send the last created row to TodoList (no refreshTick) */}
          <TodoList lastCreated={lastCreated} />
        </>
      ) : activeListType === "grocery" ? (
        <GroceryList
          user={user}
          listId={activeListId}
          open={addOpen}
          onOpenChange={setAddOpen}
        />
      ) : (
        <NoteEditor user={user} listId={activeListId} />
      )}

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
