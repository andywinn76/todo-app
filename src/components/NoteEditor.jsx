"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "sonner";

export default function NoteEditor({ user, listId }) {
  const [note, setNote] = useState(null); // row
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState(null);
  const saveTimer = useRef(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("notes")
      .select("*")
      .eq("list_id", String(listId))
      .limit(1)
      .maybeSingle();
    if (error) {
      console.error(error);
      toast.error("Failed to load note");
      setNote(null);
      setBody("");
      return;
    }
    setNote(data);
    setBody(data?.body || "");
    setLastSavedAt(data?.updated_at || null);
  }, [listId]);

  useEffect(() => {
    if (!user || !listId) return;
    load();
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [user, listId, load]);

  const doSave = useCallback(async (content) => {
    setSaving(true);
    try {
      if (note?.id) {
        const { data, error } = await supabase
          .from("notes")
          .update({ body: content, updated_by: user.id })
          .eq("id", note.id)
          .select()
          .single();
        if (error) throw error;
        setNote(data);
        setLastSavedAt(data.updated_at);
      } else {
        const { data, error } = await supabase
          .from("notes")
          .insert([{ list_id: listId, body: content, updated_by: user.id }])
          .select()
          .single();
        if (error) throw error;
        setNote(data);
        setLastSavedAt(data.updated_at);
      }
    } catch (e) {
      console.error(e);
      toast.error("Failed to save note");
    } finally {
      setSaving(false);
    }
  }, [note, listId, user?.id]);

  function onChange(e) {
    const value = e.target.value;
    setBody(value);

    // Debounced autosave (~700ms)
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      doSave(value);
    }, 700);
  }

  function saveNow() {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    doSave(body);
  }

  const subtitle = useMemo(() => {
    if (saving) return "Saving…";
    if (!lastSavedAt) return null;
    const d = new Date(lastSavedAt);
    if (isNaN(d.getTime())) return null;
    return `Last saved ${d.toLocaleString()}`;
  }, [saving, lastSavedAt]);

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-lg">Notes</h2>
        <div className="text-sm text-gray-500">{subtitle}</div>
      </div>
      <textarea
        value={body}
        onChange={onChange}
        placeholder="Write your notes… (Enter for a new line)"
        className="w-full min-h-[280px] border rounded p-3 leading-6"
      />
      <div className="flex gap-2">
        <button
          type="button"
          onClick={saveNow}
          className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700"
          disabled={saving}
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </section>
  );
}
