"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import useRequireAuth from "@/hooks/useRequireAuth";
import TodoForm from "@/components/TodoForm";
import TodoList from "@/components/TodoList";

export default function Home() {
  const [todos, setTodos] = useState([]);
  const { user, userLoading } = useRequireAuth();

  const fetchTodos = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("todos")
      .select("*")
      .eq("created_by", user.id)
      .order("due_date", { ascending: true });;
    if (error) console.error("Error:", error);
    else setTodos(data);
  };

  useEffect(() => {
    fetchTodos();
  }, [user]);

  if (!user || userLoading) return <p className="p-6">Loading...</p>;

  return (
    <main className="p-6">
      <h1 className="text-2xl font-bold mb-4">Todo List</h1>
      <TodoForm user={user} onTodoAdded={fetchTodos} />
      <TodoList user={user} todos={todos} onRefresh={fetchTodos}/>
    </main>
  );
}
