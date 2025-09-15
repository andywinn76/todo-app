
"use client";
import {
  createContext,
  useContext,
  useState,
  useCallback,
  useLayoutEffect,
  useEffect,
} from "react";
import { supabase } from "@/lib/supabaseClient";
import { useUser } from "@/components/AuthProvider";

const ListsContext = createContext();

export function ListsProvider({ children }) {
  const { user } = useUser();
  const [lists, setLists] = useState([]);
  const [activeListId, setActiveListId] = useState(null);

  const storageKey = user ? `lastListId:${user.id}` : null;

  const selectList = useCallback(
    (id) => {
      const nextId = id ? String(id) : null;
      setActiveListId(nextId);
      if (!storageKey) return;
      try {
        if (nextId) localStorage.setItem(storageKey, nextId);
        else localStorage.removeItem(storageKey);
      } catch {}
    },
    [storageKey]
  );

  useLayoutEffect(() => {
    if (!user) return;
    try {
      const saved = localStorage.getItem(`lastListId:${user.id}`);
      if (saved) setActiveListId(saved);
    } catch {}
  }, [user]);

  const refreshLists = useCallback(
    async () => {
      if (!user) {
        setLists([]);
        return [];
      }

      // Pull role via list_members, and the nested lists *including type*.
      const { data, error } = await supabase
        .from("list_members")
        .select(`
          role,
          lists:lists(id, name, type, created_at, created_by)
        `)
        .eq("user_id", user.id)
        .order("created_at", { ascending: true, foreignTable: "lists" });

      if (error) {
        console.error("load my lists error:", error.message, error.details);
        setLists([]);
        return [];
      }

      const rows = data || [];
      const base = rows.map(({ role, lists }) => ({
        ...lists,
        _role: role,
      }));

      // Enrich with owner profile (first/last/username) for nice labels
      const ownerIds = [...new Set(base.map((l) => l.created_by).filter(Boolean))];
      let ownersById = {};
      if (ownerIds.length) {
        const { data: owners } = await supabase
          .from("profiles")
          .select("id, first_name, last_name, username")
          .in("id", ownerIds);
        if (owners) ownersById = Object.fromEntries(owners.map((o) => [o.id, o]));
      }

      const enriched = base.map((l) => {
        const o = ownersById[l.created_by] || {};
        return {
          ...l,
          owner_first_name: o.first_name ?? null,
          owner_last_name: o.last_name ?? null,
          owner_username: o.username ?? null,
        };
      });

      setLists(enriched);

      // Auto-select the first list if none chosen yet
      if (!activeListId && enriched.length) {
        selectList(enriched[0].id);
      }

      return enriched;
    },
    [user, activeListId, selectList]
  );

  useEffect(() => {
    if (!user) return;
    if (!lists.length) return;
    if (activeListId && !lists.some((l) => String(l.id) === String(activeListId))) {
      if (storageKey) localStorage.removeItem(storageKey);
      selectList(lists[0]?.id ?? null);
    }
  }, [user, lists, activeListId, storageKey, selectList]);

  return (
    <ListsContext.Provider
      value={{
        lists,
        setLists,
        activeListId,
        setActiveListId: selectList,
        refreshLists,
      }}
    >
      {children}
    </ListsContext.Provider>
  );
}

export function useLists() {
  const ctx = useContext(ListsContext);
  if (!ctx) throw new Error("useLists must be used within a ListsProvider");
  return ctx;
}
