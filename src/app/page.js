"use client";
import { useEffect, useLayoutEffect, useState } from "react"; // ⬅ add useLayoutEffect
import { supabase } from "@/lib/supabaseClient";
import useRequireAuth from "@/hooks/useRequireAuth";
import TodoForm from "@/components/TodoForm";
import TodoList from "@/components/TodoList";
import ListSelector from "@/components/ListSelector";
import ShareListInline from "@/components/ShareListInline";

export default function Home() {
  const [todos, setTodos] = useState([]);
  const {user, userLoading } = useRequireAuth();
  const [isActive, setIsActive] = useState(false);
  const [activeListId, setActiveListId] = useState(undefined);
  const [lists, setLists] = useState([]);

  const [shareOpen, setShareOpen] = useState(false);

  const storageKey = user ? `lastListId:${user.id}` : null;

  function handleSelectList(id) {
    const raw = id ?? null;
    const nextId = raw === "" ? null : raw != null ? String(raw) : null;
    setActiveListId(nextId);
    if (storageKey) {
      if (nextId) localStorage.setItem(storageKey, nextId);
      else localStorage.removeItem(storageKey);
    }
  }

  // 🔑 Restore ASAP so ListSelector won't auto-pick the first list
  useLayoutEffect(() => {
    if (!user) return;
    const key = `lastListId:${user.id}`;
    const saved = localStorage.getItem(key);
    if (saved && activeListId !== saved) {
      // set local state before child effects run
      setActiveListId(saved);
    }
  }, [user]); // NOTE: not depending on lists here

  // ✅ Validate restored id once lists arrive; fall back if missing
  useEffect(() => {
    if (!user) return;
    if (!lists.length) return;

    if (
      activeListId &&
      !lists.some((l) => String(l.id) === String(activeListId))
    ) {
      // saved id no longer exists; clear storage and choose first (or null)
      if (storageKey) localStorage.removeItem(storageKey);
      handleSelectList(lists[0]?.id ?? null);
    }
  }, [user, lists]); // don't include activeListId; we only validate on lists load/change

  const activeList = lists.find((l) => String(l.id) === String(activeListId));
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

  const hasValidActive =
    activeListId != null &&
    activeListId !== "" &&
    lists.some((l) => String(l.id) === String(activeListId));

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
      console.error("Error:", error);
    } else {
      setTodos(data || []);
    }
  };

  const activeListName = (() => {
    if (!lists.length) return "Click Manage to Add a List";
    const found = lists.find((l) => String(l.id) === String(activeListId));
    return found ? found.name : "Click Manage to Add a List";
  })();

  useEffect(() => {
    if (!user) return;
    if (!hasValidActive) {
      setTodos([]);
      return;
    }
    fetchTodos();
  }, [user, activeListId, lists]);

  const handleSetActive = () => setIsActive(!isActive);

  if (!user || userLoading) return <p className="p-6">Loading...</p>;

  return (
    <main className="p-6">
      <ListSelector
        user={user}
        lists={lists}
        setLists={setLists}
        activeListId={activeListId}
        onSelect={handleSelectList} /* ⬅ use the persistence-aware setter */
        onListsChange={setLists}
      />
      <div className="flex items-center justify-between mb-6">
        <div className="min-w-0">
  <div className="flex items-center gap-2">
    <h1 className="text-2xl font-bold truncate">{activeListName}</h1>

    {activeListId && (
      <ShareListInline
        listId={activeListId}
        currentUserId={user.id}
        isOpen={shareOpen}
        onOpenChange={setShareOpen}
        render="trigger"              // icon-only next to the title
      />
    )}
  </div>

  {/* Inline form appears here when open, without wrecking the title spacing */}
  {activeListId && (
    <ShareListInline
      listId={activeListId}
      currentUserId={user.id}
      isOpen={shareOpen}
      onOpenChange={setShareOpen}
      onDone={() => setShareOpen(false)}
      render="form-below"             // stacks under the title
    />
  )}

  {lists.length > 0 && ownerLabel && (
    <p className="text-sm text-gray-500 mt-1 truncate">{ownerLabel}</p>
  )}
</div>
</div>

      {isActive && activeListId && (
        <TodoForm
          user={user}
          listId={activeListId}
          onTodoAdded={fetchTodos}
          isActive={isActive}
          setIsActive={setIsActive}
        />
      )}
      <TodoList user={user} todos={todos} onRefresh={fetchTodos} />
    </main>
  );
}
