// src/app/page.jsx
"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import useRequireAuth from "@/hooks/useRequireAuth";
import { useLists } from "@/components/ListsProvider";
import ListSelector from "@/components/ListSelector";
import ShareListInline from "@/components/ShareListInline";
import TodoForm from "@/components/TodoForm";
import TodoList from "@/components/TodoList";

export default function Home() {
  const { user, userLoading } = useRequireAuth();

  // 🔑 Pull list state from the provider
  const { lists, activeListId } = useLists();

  const [todos, setTodos] = useState([]);
  const [isActive, setIsActive] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);

  const hasValidActive =
    activeListId != null &&
    activeListId !== "" &&
    lists.some((l) => String(l.id) === String(activeListId));

  const activeList = lists.find((l) => String(l.id) === String(activeListId));
  const activeListName = activeList
    ? activeList.name
    : "Click Manage to Add a List";

  // Owner label (uses provider-enriched fields)
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

  // Load todos for the active list
  const fetchTodos = async () => {
    if (!user || !hasValidActive) {
      setTodos([]);
      return;
    }
    const { data, error } = await supabase
      .from("todos")
      .select("*")
      .eq("list_id", String(activeListId))
      .order("due_date", { ascending: true });

    if (error) {
      console.error("Error loading todos:", error);
      setTodos([]);
      return;
    }
    setTodos(data || []);
  };

  useEffect(() => {
    if (!user) return;
    if (!hasValidActive) {
      setTodos([]);
      return;
    }
    fetchTodos();
  }, [user, activeListId, lists, hasValidActive]); // re-run when selection or list set changes

  if (!user || userLoading) return <p className="p-6">Loading...</p>;

  return (
    <main className="p-6">
      {/* Provider-backed selector (no list state props needed) */}
      <ListSelector user={user} />

      <div className="flex items-start justify-between gap-4 mb-6">
        {/* LEFT */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold truncate">{activeListName}</h1>

            {activeListId && (
              <ShareListInline
                listId={activeListId}
                currentUserId={user.id}
                isOpen={shareOpen}
                onOpenChange={setShareOpen}
                render="trigger"
              />
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

          {lists.length > 0 && ownerLabel && (
            <p className="text-sm text-gray-500 mt-1 truncate">{ownerLabel}</p>
          )}
        </div>

        {/* RIGHT */}
        {hasValidActive && (
          <div className="shrink-0">
            <button
              onClick={() => setIsActive((v) => !v)}
              className={`px-4 py-2 rounded font-semibold border ${
                isActive
                  ? "bg-gray-200 hover:bg-gray-300"
                  : "bg-green-500 hover:bg-green-600 text-white"
              }`}
              aria-expanded={isActive}
            >
              {isActive ? "Cancel" : "Add Todo"}
            </button>
          </div>
        )}
      </div>

      {isActive && activeListId && (
        <TodoForm
          user={user}
          onTodoAdded={fetchTodos}
          isActive={isActive}
          setIsActive={setIsActive}
        />
      )}

      <TodoList user={user} todos={todos} onRefresh={fetchTodos} />
    </main>
  );
}
