"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
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

export default function Home() {
  const { user, userLoading } = useRequireAuth();
  const { lists, activeListId, setActiveListId, refreshLists } =
    useLists?.() ?? {
      lists: [],
      activeListId: null,
    };

  const [todos, setTodos] = useState([]);
  const [addOpen, setAddOpen] = useState(false); // unified "Add" state across types
  const [shareOpen, setShareOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);

  const hasValidActive =
    activeListId != null &&
    activeListId !== "" &&
    lists.some((l) => String(l.id) === String(activeListId));

  const activeList = useMemo(
    () => lists.find((l) => String(l.id) === String(activeListId)),
    [lists, activeListId]
  );

  const activeListType = activeList?.type || "todo";
  const activeType = activeList?.type ?? null;

  // 💡 Type registry drives header button text/visibility
  const cfg = TYPE_CONFIG[activeListType] || {};

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

  // Load todos for todo lists only
  const fetchTodos = async () => {
    if (!user || !hasValidActive || activeListType !== "todo") {
      setTodos([]);
      return;
    }
    const { data, error } = await supabase
      .from("todos")
      .select("*")
      .eq("list_id", String(activeListId))
      .order("due_date", { ascending: true })
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error loading todos:", error);
      setTodos([]);
      return;
    }
    setTodos(data || []);
  };

  // Refresh lists on mount / user change
  useEffect(() => {
    if (!user) return;
    refreshLists?.();
  }, [user, refreshLists]);

  // Fetch todos when selection/type changes (todo only)
  useEffect(() => {
    if (!user) return;
    if (!hasValidActive || activeListType !== "todo") {
      setTodos([]);
      return;
    }
    fetchTodos();
  }, [user, activeListId, activeListType, lists]);

  if (!user || userLoading) return <p className="p-6">Loading...</p>;

  return (
    <main className="p-6">
      {/* Header row */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        {/* LEFT */}
        <div className="min-w-0 flex-1">
          <div className="min-w-0 flex items-center gap-2">
            {/* Title: allow grow, clamp with ellipsis */}
            <div className="min-w-0 flex-1">
              {/* If ListTitleSwitcher accepts className, pass it instead of this wrapper:
            <ListTitleSwitcher className="block min-w-0 truncate" onOpenManage={() => setManageOpen(true)} />
        */}
              <div className="truncate">
                <ListTitleSwitcher onOpenManage={() => setManageOpen(true)} />
              </div>
            </div>

            {activeListId && (
              <>
                {/* Controls never shrink */}
                <div className="flex items-center gap-2 shrink-0">
                  <ShareListInline
                    listId={activeListId}
                    currentUserId={user.id}
                    isOpen={shareOpen}
                    onOpenChange={setShareOpen}
                    render="trigger"
                  />

                  <ListActions
                    activeList={activeList}
                    currentUserId={user.id}
                    onAfterDelete={async (deletedId) => {
                      if (String(deletedId) === String(activeListId))
                        setActiveListId?.(null);
                      await refreshLists?.();
                    }}
                    onAfterUnsubscribe={async (leftId) => {
                      if (String(leftId) === String(activeListId))
                        setActiveListId?.(null);
                      await refreshLists?.();
                    }}
                  />
                </div>
              </>
            )}
          </div>

          {activeListId && (
            <ShareListInline
              listId={activeListId}
              currentUserId={user.id}
              isOpen={shareOpen}
              onOpenChange={setShareOpen}
              onDone={() => setShareOpen(false)}
              render="form-below"
            />
          )}

          {lists.length > 0 && (activeType || ownerLabel) && (
            <p className="mt-1 truncate text-sm text-gray-500">
              {activeType ? <>Type: {activeType}</> : null}
              {activeType && ownerLabel ? " • " : null}
              {ownerLabel || null}
            </p>
          )}
        </div>

        {/* RIGHT: Unified header Add button (driven by TYPE_CONFIG) */}
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
            >
              {addOpen ? "Cancel" : cfg.addLabel || "Add"}
            </button>
          </div>
        )}
      </div>

      {/* Body switches by list type */}
      {!hasValidActive ? (
        <div className="text-gray-600">
          Select or create a list to get started.
        </div>
      ) : activeListType === "todo" ? (
        <>
          {addOpen && activeListId && (
            <TodoForm
              user={user}
              onTodoAdded={fetchTodos}
              isActive={addOpen}
              setIsActive={setAddOpen}
            />
          )}
          <TodoList user={user} todos={todos} onRefresh={fetchTodos} />
        </>
      ) : activeListType === "grocery" ? (
        // Wire GroceryList to the unified header button
        <GroceryList
          user={user}
          listId={activeListId}
          open={addOpen}
          onOpenChange={setAddOpen}
        />
      ) : (
        // Notes: supportsAdd=false for now (no header button)
        <NoteEditor user={user} listId={activeListId} />
      )}

      {/* Drawer lives here so the TitleSwitcher can open it */}
      <ManageListsDrawer
        open={manageOpen}
        onClose={() => setManageOpen(false)}
        user={user}
        lists={lists}
        setLists={() => {}}
        triggerRef={{ current: null }}
        onAfterCreate={async (created) => {
          const updated = await refreshLists?.();
          if (created?.id) setActiveListId?.(created.id);
        }}
        onAfterDelete={async (deletedId) => {
          const updated = await refreshLists?.();
          if (String(deletedId) === String(activeListId)) {
            if (updated?.length) setActiveListId?.(updated[0].id);
            else setActiveListId?.(null);
          }
        }}
      />
    </main>
  );
}
