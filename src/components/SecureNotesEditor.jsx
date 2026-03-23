"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "sonner";
import { decryptText, encryptText } from "@/lib/crypto";

export default function SecureNotesEditor({ user, listId }) {
  const [note, setNote] = useState(null); // encrypted row
  const [body, setBody] = useState("");
  const [masterPassword, setMasterPassword] = useState("");
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [unlocking, setUnlocking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState(null);

  const saveTimer = useRef(null);

  const load = useCallback(async () => {
    if (!user || !listId) return;

    setIsLoading(true);

    const { data, error } = await supabase
      .from("secure_notes")
      .select("*")
      .eq("list_id", String(listId))
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error(error);
      toast.error("Failed to load secure note");
      setNote(null);
      setBody("");
      setLastSavedAt(null);
      setIsLoading(false);
      return;
    }

    setNote(data);
    setBody("");
    setLastSavedAt(data?.updated_at || null);
    setIsLoading(false);
  }, [user, listId]);

  useEffect(() => {
  if (!listId) return;

  setNote(null);
  setBody("");
  setMasterPassword("");
  setIsUnlocked(false);
  setLastSavedAt(null);

  load();
}, [listId]);

  const handleUnlock = useCallback(
    async (e) => {
      e?.preventDefault();

      if (!masterPassword) {
        toast.error("Enter your master password");
        return;
      }

      setUnlocking(true);

      try {
        if (!note) {
          // No secure note exists yet for this list
          setBody("");
          setIsUnlocked(true);
          return;
        }

        const decrypted = await decryptText({
          content_encrypted: note.content_encrypted,
          salt: note.salt,
          iv: note.iv,
          masterPassword,
        });

        setBody(decrypted);
        setIsUnlocked(true);
      } catch (error) {
        toast.error("Failed to unlock secure note. Check your master password.");
      } finally {
        setUnlocking(false);
      }
    },
    [masterPassword, note]
  );

  const doSave = useCallback(
  async (content) => {
    if (!masterPassword) {
      toast.error("Master password missing. Lock and unlock again.");
      return false;
    }

    setSaving(true);

    try {
      const encrypted = await encryptText(content, masterPassword);

      if (note?.id) {
        const { data, error } = await supabase
          .from("secure_notes")
          .update({
            content_encrypted: encrypted.content_encrypted,
            salt: encrypted.salt,
            iv: encrypted.iv,
            crypto_version: encrypted.crypto_version,
            updated_by: user.id,
          })
          .eq("id", note.id)
          .select()
          .single();

        if (error) throw error;
        setNote(data);
        setLastSavedAt(data.updated_at);
      } else {
        const { data, error } = await supabase
          .from("secure_notes")
          .insert([
            {
              list_id: listId,
              content_encrypted: encrypted.content_encrypted,
              salt: encrypted.salt,
              iv: encrypted.iv,
              crypto_version: encrypted.crypto_version,
              updated_by: user.id,
            },
          ])
          .select()
          .single();

        if (error) throw error;
        setNote(data);
        setLastSavedAt(data.updated_at);
      }

      return true;
    } catch (error) {
      console.error(error);
      toast.error("Failed to save secure note");
      return false;
    } finally {
      setSaving(false);
    }
  },
  [listId, masterPassword, note, user?.id]
);

async function lockNow() {
  if (saveTimer.current) clearTimeout(saveTimer.current);

  const ok = await doSave(body);
  if (!ok) return;

  setIsUnlocked(false);
  setBody("");
  setMasterPassword("");
}

  function onChange(e) {
    const value = e.target.value;
    setBody(value);

    if (saveTimer.current) clearTimeout(saveTimer.current);

    saveTimer.current = setTimeout(() => {
      doSave(value);
    }, 700);
  }

  function saveNow() {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    doSave(body);
  }

  async function lockNow() {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    await doSave(body);

    setIsUnlocked(false);
    setBody("");
    setMasterPassword("");
  }

  const subtitle = useMemo(() => {
    if (saving) return "Saving…";
    if (!lastSavedAt) return null;

    const d = new Date(lastSavedAt);
    if (isNaN(d.getTime())) return null;

    return `Last saved ${d.toLocaleString()}`;
  }, [saving, lastSavedAt]);

  if (isLoading) {
    return (
      <section className="flex min-h-[100dvh] items-center justify-center">
        <div className="text-gray-600">Loading secure note…</div>
      </section>
    );
  }

  if (!isUnlocked) {
    return (
      <section className="flex min-h-[50dvh] flex-col items-center justify-center gap-4">
        <h2 className="text-xl font-semibold">Secure Note Locked</h2>

        <form
          onSubmit={handleUnlock}
          className="flex w-full max-w-sm flex-col gap-3"
        >
          <input
            type="password"
            placeholder="Enter master password"
            value={masterPassword}
            onChange={(e) => setMasterPassword(e.target.value)}
            className="w-full rounded border px-3 py-2"
          />
          <span className="text-xs text-center">If you forget your master password, your secure note cannot be recovered.</span>

          <button
            type="submit"
            className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-60"
            disabled={unlocking}
          >
            {unlocking ? "Unlocking…" : "Unlock"}
          </button>
        </form>
      </section>
    );
  }

  return (
    <section className="flex min-h-[100dvh] flex-col gap-3">
      <textarea
        value={body}
        onChange={onChange}
        placeholder="Write your secure note…"
        className="w-full flex-1 min-h-[280px] resize-y rounded border p-3 leading-6 md:min-h-0"
      />

      <div className="sticky bottom-0 border-t bg-white/90 py-3 pb-[calc(env(safe-area-inset-bottom)+12px)] backdrop-blur">
        <div className="text-sm text-gray-500">{subtitle}</div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={saveNow}
            className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
            disabled={saving}
          >
            {saving ? "Saving…" : "Save"}
          </button>

          <button
            type="button"
            onClick={lockNow}
            className="rounded border px-4 py-2 hover:bg-gray-50"
            disabled={saving}
          >
            Lock
          </button>
        </div>
      </div>
    </section>
  );
}