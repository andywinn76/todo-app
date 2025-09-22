// ListsProvider.jsx
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

const STORAGE_KEY = (userId) => `lastListId:${userId ?? "anon"}`;
const ListsContext = createContext();

export function ListsProvider({ children }) {
  const { user } = useUser();
  const [lists, setLists] = useState([]);
  const [activeListId, setActiveListId] = useState(null);

  const storageKey = user ? STORAGE_KEY(user.id) : null;

  // Single source of truth for selecting a list + persisting the choice
  const selectList = useCallback(
    (id) => {
      const nextId = id != null ? String(id) : null;
      setActiveListId(nextId);
      if (!storageKey) return;
      try {
        if (nextId) localStorage.setItem(storageKey, nextId);
        else localStorage.removeItem(storageKey);
      } catch {}
    },
    [storageKey]
  );

  // EARLY restore: on mount (per user), if nothing chosen yet, try saved id
  useLayoutEffect(() => {
    if (!user) return;
    if (activeListId != null) return;
    try {
      const saved = localStorage.getItem(STORAGE_KEY(user.id));
      if (saved) setActiveListId(saved); // okay to set directly here; selectList will run later on user actions
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

      // Selection policy:
      // - If something is already selected, leave it.
      // - Otherwise, prefer saved (if it still exists), else fall back to the first list.
      if (activeListId == null && enriched.length) {
        const saved = storageKey ? localStorage.getItem(storageKey) : null;
        const exists =
          saved && enriched.some((l) => String(l.id) === String(saved));
        selectList(exists ? saved : enriched[0].id);
      }

      return enriched;
    },
    [user, activeListId, selectList, storageKey]
  );

  // If selected id becomes invalid (e.g., list deleted or user unsubscribed), fall back gracefully
  useEffect(() => {
    if (!user) return;
    if (!lists.length) return;
    if (
      activeListId &&
      !lists.some((l) => String(l.id) === String(activeListId))
    ) {
      try {
        if (storageKey) localStorage.removeItem(storageKey);
      } catch {}
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
