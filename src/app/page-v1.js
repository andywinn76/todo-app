"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import useRequireAuth from "@/hooks/useRequireAuth";
import TodoForm from "@/components/TodoForm";
import TodoList from "@/components/TodoList";
import ListSelector from "@/components/ListSelector";

export default function Home() {
  const [todos, setTodos] = useState([]);
  const { user, userLoading } = useRequireAuth();
  const [isActive, setIsActive] = useState(false);

  // NEW: active list
  const [activeListId, setActiveListId] = useState(null);

  const fetchTodos = async () => {
    if (!user || !activeListId) return;

    const { data, error } = await supabase
      .from("todos")
      .select("*")
      .eq("list_id", activeListId) // ← filter by selected list
      .order("due_date", { ascending: true });

    if (error) console.error("Error:", error);
    else setTodos(data || []);
  };

  const handleSetActive = () => setIsActive((v) => !v);

  // Refetch when user or active list changes
  useEffect(() => {
    fetchTodos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, activeListId]);

  if (!user || userLoading) return <p className="p-6">Loading...</p>;

  return (
    <main className="p-6">
      {/* List selector */}
      <ListSelector user={user} activeListId={activeListId} onSelect={setActiveListId} />

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Todo List</h1>
        <button
          className={`${
            isActive ? "bg-red-400 hover:bg-red-500" : "bg-green-400 hover:bg-green-600"
          } text-white font-semibold py-2 px-4 rounded`}
          onClick={handleSetActive}
          disabled={!activeListId}
          title={!activeListId ? "Select or create a list first" : ""}
        >
          {isActive ? "Cancel" : "Add Todo"}
        </button>
      </div>

      {/* Only show the form when a list is selected */}
      {isActive && activeListId && (
        <TodoForm
          user={user}
          listId={activeListId}             // ← pass the selected list id
          onTodoAdded={fetchTodos}
          isActive={isActive}
          setIsActive={setIsActive}
        />
      )}

      <TodoList user={user} todos={todos} onRefresh={fetchTodos} />
    </main>
  );
}
