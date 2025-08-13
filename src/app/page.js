"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import useRequireAuth from "@/hooks/useRequireAuth";
import TodoForm from "@/components/TodoForm";
import TodoList from "@/components/TodoList";

export default function Home() {
  const [todos, setTodos] = useState([]);
  const { user, userLoading } = useRequireAuth();
  const [isActive, setIsActive] = useState(false);

  const fetchTodos = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("todos")
      .select("*")
      .eq("created_by", user.id)
      .order("due_date", { ascending: true });
    if (error) console.error("Error:", error);
    else setTodos(data);
  };

  const handleSetActive = () => {
    setIsActive(!isActive);
  };

  useEffect(() => {
    fetchTodos();
  }, [user]);

  if (!user || userLoading) return <p className="p-6">Loading...</p>;

  return (
    <main className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Todo List</h1>
        <button
          className={`${
            isActive ? "bg-red-400 hover:bg-red-500" : "bg-green-400 hover:bg-green-600" } text-white font-semibold py-2 px-4 rounded`}
          onClick={handleSetActive}
        >
          {isActive ? "Cancel" : "Add Todo"}
        </button>
      </div>

      {isActive && <TodoForm user={user} onTodoAdded={fetchTodos} isActive={isActive} setIsActive={setIsActive}/>}

      <TodoList user={user} todos={todos} onRefresh={fetchTodos} />
    </main>
  );
}
