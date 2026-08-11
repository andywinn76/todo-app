"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import { TextStyle } from "@tiptap/extension-text-style";
import { Color } from "@tiptap/extension-color";
import Highlight from "@tiptap/extension-highlight";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "sonner";
import { Extension } from "@tiptap/core";
import LinkExtension from "@tiptap/extension-link";
import { readCachedNote, writeCachedNote } from "@/lib/offlineCache";
import useOnlineStatus from "@/hooks/useOnlineStatus";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  List,
  ListOrdered,
  Highlighter,
  Palette,
  RemoveFormatting,
  Link2,
  X,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Tab-indent extension
// In list items, StarterKit already handles Tab (sink/lift). For regular
// paragraphs, Tab inserts four non-breaking spaces and Shift-Tab is consumed
// so it doesn't accidentally move browser focus away from the editor.
// ---------------------------------------------------------------------------

const TabIndent = Extension.create({
  name: "tabIndent",
  addKeyboardShortcuts() {
    return {
      Tab: () => {
        if (this.editor.isActive("listItem")) return false; // let StarterKit handle it
        this.editor.commands.insertContent("    ");
        return true;
      },
      "Shift-Tab": () => {
        if (this.editor.isActive("listItem")) return false;
        return true; // consume outside lists so focus doesn't jump
      },
    };
  },
});

// ---------------------------------------------------------------------------
// Plain-text → HTML migration helper
// If the stored body has no HTML tags (old plain-text note), convert newlines
// to proper paragraph / line-break markup so Tiptap renders them correctly.
// ---------------------------------------------------------------------------

function prepareContent(body) {
  if (!body) return "";
  // Already HTML — use as-is
  if (/<[a-z][\s\S]*>/i.test(body)) return body;
  // Plain text: double newline → paragraph break, single newline → <br>
  return body
    .split(/\n{2,}/)
    .map((para) => `<p>${para.replace(/\n/g, "<br>")}</p>`)
    .join("");
}

// ---------------------------------------------------------------------------
// Toolbar primitives
// ---------------------------------------------------------------------------

function ToolbarBtn({ onClick, active = false, title, disabled = false, children }) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onMouseDown={(e) => {
        e.preventDefault(); // keep editor focus
        if (!disabled) onClick();
      }}
      className={`rounded p-1.5 transition-colors disabled:opacity-40 ${
        active
          ? "bg-blue-100 text-blue-700"
          : "text-gray-600 hover:bg-gray-100"
      }`}
    >
      {children}
    </button>
  );
}

function Separator() {
  return <div className="w-px h-5 bg-gray-200 mx-0.5 self-center shrink-0" />;
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function NoteEditor({ user, listId }) {
  const [saving, setSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState(null);
  const [linkInputActive, setLinkInputActive] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [usingCache, setUsingCache] = useState(false);
  const [offlinePending, setOfflinePending] = useState(false);
  const [conflict, setConflict] = useState(null); // { server } | null

  const online = useOnlineStatus();

  // Keep note state in a ref so doSave never captures a stale closure
  const noteRef = useRef(null);
  const saveTimer = useRef(null);
  const textColorRef = useRef(null);
  const highlightColorRef = useRef(null);
  const linkInputRef = useRef(null);
  // Version basis for the current edit session — used to detect whether the
  // server changed out from under an offline edit.
  const baselineUpdatedAtRef = useRef(null);
  // True whenever the editor holds content not yet confirmed saved.
  const dirtyRef = useRef(false);
  const offlineToastShownRef = useRef(false);
  const conflictRef = useRef(null);
  const prevOnlineRef = useRef(online);

  useEffect(() => {
    conflictRef.current = conflict;
  }, [conflict]);

  // ----- save ---------------------------------------------------------------

  const doSave = useCallback(
    async (html) => {
      if (conflictRef.current) return; // don't push writes while a conflict is unresolved
      const currentNote = noteRef.current;
      setSaving(true);
      try {
        let data, error;
        if (currentNote?.id) {
          ({ data, error } = await supabase
            .from("notes")
            .update({ body: html, updated_by: user.id })
            .eq("id", currentNote.id)
            .select()
            .single());
        } else {
          ({ data, error } = await supabase
            .from("notes")
            .insert([{ list_id: listId, body: html, updated_by: user.id }])
            .select()
            .single());
        }
        if (error) throw error;
        noteRef.current = data;
        baselineUpdatedAtRef.current = data.updated_at;
        dirtyRef.current = false;
        offlineToastShownRef.current = false;
        setLastSavedAt(data.updated_at);
        setOfflinePending(false);
        writeCachedNote(user.id, listId, data);
      } catch (e) {
        // Keep the edit safe locally so it isn't lost, then surface status.
        writeCachedNote(user.id, listId, noteRef.current, {
          body: html,
          since: new Date().toISOString(),
        });
        if (!navigator.onLine) {
          // Expected while offline — every debounced retry would otherwise
          // log a console.error and trip Next.js's dev error overlay.
          console.warn("Save deferred — offline:", e);
          setOfflinePending(true);
          if (!offlineToastShownRef.current) {
            toast("You're offline — this note is saved locally and will sync automatically.");
            offlineToastShownRef.current = true;
          }
        } else {
          console.error(e);
          toast.error("Failed to save note");
        }
      } finally {
        setSaving(false);
      }
    },
    [listId, user?.id]
  );

  // ----- link helpers -------------------------------------------------------

  function openLinkInput() {
    const existing = editor?.getAttributes("link").href ?? "";
    setLinkUrl(existing);
    setLinkInputActive(true);
    setTimeout(() => linkInputRef.current?.focus(), 50);
  }

  function closeLinkInput() {
    setLinkInputActive(false);
    setLinkUrl("");
    editor?.chain().focus().run();
  }

  function applyLink() {
    const href = linkUrl.trim();
    if (!href) {
      editor?.chain().focus().extendMarkRange("link").unsetLink().run();
    } else {
      editor
        ?.chain()
        .focus()
        .extendMarkRange("link")
        .setLink({ href, target: "_blank", rel: "noopener noreferrer" })
        .run();
    }
    closeLinkInput();
  }

  // ----- editor -------------------------------------------------------------

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      TabIndent,
      LinkExtension.configure({
        openOnClick: true,
        HTMLAttributes: {
          target: "_blank",
          rel: "noopener noreferrer",
        },
      }),
    ],
    content: "",
    editorProps: {
      attributes: {
        class:
          "note-editor-content outline-none px-4 py-3 min-h-[300px] leading-7",
      },
    },
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      dirtyRef.current = true;
      // Persist the in-progress edit immediately so it survives a closed tab
      // even if the debounced save below never reaches the server.
      writeCachedNote(user.id, listId, noteRef.current, {
        body: html,
        since: new Date().toISOString(),
      });
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => doSave(html), 700);
    },
  });

  // ----- load note when listId or editor changes ----------------------------

  useEffect(() => {
    if (!user || !listId || !editor) return;

    let cancelled = false;
    dirtyRef.current = false;
    offlineToastShownRef.current = false;
    setConflict(null);
    setUsingCache(false);
    setOfflinePending(false);

    // Instant paint from the local cache so the note is readable immediately,
    // regardless of connection speed — then reconcile with the server below.
    const cached = readCachedNote(user.id, listId);
    if (cached) {
      const hasPending = cached.pendingBody != null;
      const showBody = hasPending ? cached.pendingBody : cached.body;
      noteRef.current = cached.id
        ? { id: cached.id, list_id: cached.list_id, updated_at: cached.updated_at }
        : null;
      baselineUpdatedAtRef.current = cached.updated_at;
      setLastSavedAt(cached.updated_at);
      setUsingCache(true);
      // false = don't emit onUpdate (avoids saving immediately on load)
      editor.commands.setContent(prepareContent(showBody), false);

      if (hasPending) {
        dirtyRef.current = true;
        setOfflinePending(true);
        if (saveTimer.current) clearTimeout(saveTimer.current);
        saveTimer.current = setTimeout(() => doSave(showBody), 300);
      }
    }

    async function reconcile() {
      const { data, error } = await supabase
        .from("notes")
        .select("*")
        .eq("list_id", String(listId))
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (cancelled) return;

      if (error) {
        if (!cached) {
          console.error(error);
          toast.error("Failed to load note");
          noteRef.current = null;
          editor.commands.setContent("", false);
        }
        // else: keep showing the cached copy (usingCache stays true)
        return;
      }

      setUsingCache(false);

      if (!dirtyRef.current) {
        // No local edits in flight — just adopt the server's version.
        noteRef.current = data ?? null;
        baselineUpdatedAtRef.current = data?.updated_at ?? null;
        setLastSavedAt(data?.updated_at ?? null);
        editor.commands.setContent(prepareContent(data?.body), false);
        if (data) writeCachedNote(user.id, listId, data);
        return;
      }

      // There are local edits not yet confirmed by the server.
      if (data && data.updated_at !== baselineUpdatedAtRef.current) {
        setConflict({ server: data });
      }
      // else: server matches what we started from (or the note doesn't exist
      // there yet) — no external change, let the normal save flow continue.
    }

    reconcile();

    return () => {
      cancelled = true;
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [user, listId, editor, doSave]);

  // ----- resync when connection returns --------------------------------------

  useEffect(() => {
    const cameBackOnline = online && !prevOnlineRef.current;
    prevOnlineRef.current = online;

    if (!cameBackOnline || !user || !listId || !editor || !dirtyRef.current) {
      return;
    }

    (async () => {
      const { data, error } = await supabase
        .from("notes")
        .select("*")
        .eq("list_id", String(listId))
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) return; // still unreachable — edit stays pending, retried on next reconnect

      if (data && data.updated_at !== baselineUpdatedAtRef.current) {
        setConflict({ server: data });
      } else {
        doSave(editor.getHTML());
      }
    })();
  }, [online, user, listId, editor, doSave]);

  // ----- conflict resolution --------------------------------------------------

  function keepMyEdits() {
    if (!conflict || !editor) return;
    const { server } = conflict;
    noteRef.current = server;
    baselineUpdatedAtRef.current = server.updated_at;
    setConflict(null);
    // Use the editor's current content, not the snapshot taken when the
    // conflict was detected, in case the user kept typing meanwhile.
    doSave(editor.getHTML());
  }

  function loadLatestVersion() {
    if (!conflict || !editor) return;
    const { server } = conflict;
    noteRef.current = server;
    baselineUpdatedAtRef.current = server.updated_at;
    dirtyRef.current = false;
    setOfflinePending(false);
    setLastSavedAt(server.updated_at);
    writeCachedNote(user.id, listId, server);
    editor.commands.setContent(prepareContent(server.body), false);
    setConflict(null);
  }

  // ----- manual save --------------------------------------------------------

  function saveNow() {
    if (!editor) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    doSave(editor.getHTML());
  }

  // ----- footer subtitle ----------------------------------------------------

  const subtitle = useMemo(() => {
    if (saving) return "Saving…";
    if (offlinePending) return "Offline — changes saved locally, will sync automatically";
    if (usingCache) {
      if (!lastSavedAt) return "Offline — no cached copy available yet";
      const d = new Date(lastSavedAt);
      return isNaN(d.getTime())
        ? "Offline — showing last saved copy"
        : `Offline — showing last saved copy from ${d.toLocaleString()}`;
    }
    if (!lastSavedAt) return null;
    const d = new Date(lastSavedAt);
    if (isNaN(d.getTime())) return null;
    return `Last saved ${d.toLocaleString()}`;
  }, [saving, offlinePending, usingCache, lastSavedAt]);

  const isReady = !!editor;

  // ----- render -------------------------------------------------------------

  return (
    <section className="flex min-h-[100dvh] flex-col gap-3">
      {/* Editor card */}
      <div className="flex-1 flex flex-col border rounded shadow-sm">

        {/* ── Sticky toolbar + link bar wrapper ── */}
        <div className="sticky top-0 z-10 rounded-t">

        {/* ── Toolbar ── */}
        <div className="flex items-center gap-0.5 flex-wrap p-1.5 border-b bg-gray-50 rounded-t">

          {/* Bold / Italic / Underline */}
          <ToolbarBtn
            active={editor?.isActive("bold")}
            onClick={() => editor?.chain().focus().toggleBold().run()}
            title="Bold (⌘B)"
            disabled={!isReady}
          >
            <Bold className="w-4 h-4" />
          </ToolbarBtn>
          <ToolbarBtn
            active={editor?.isActive("italic")}
            onClick={() => editor?.chain().focus().toggleItalic().run()}
            title="Italic (⌘I)"
            disabled={!isReady}
          >
            <Italic className="w-4 h-4" />
          </ToolbarBtn>
          <ToolbarBtn
            active={editor?.isActive("underline")}
            onClick={() => editor?.chain().focus().toggleUnderline().run()}
            title="Underline (⌘U)"
            disabled={!isReady}
          >
            <UnderlineIcon className="w-4 h-4" />
          </ToolbarBtn>

          <Separator />

          {/* Headings */}
          {[1, 2, 3].map((level) => (
            <ToolbarBtn
              key={level}
              active={editor?.isActive("heading", { level })}
              onClick={() =>
                editor?.chain().focus().toggleHeading({ level }).run()
              }
              title={`Heading ${level}`}
              disabled={!isReady}
            >
              <span className="text-xs font-bold w-5 text-center leading-none select-none">
                H{level}
              </span>
            </ToolbarBtn>
          ))}

          <Separator />

          {/* Lists */}
          <ToolbarBtn
            active={editor?.isActive("bulletList")}
            onClick={() => editor?.chain().focus().toggleBulletList().run()}
            title="Bullet list"
            disabled={!isReady}
          >
            <List className="w-4 h-4" />
          </ToolbarBtn>
          <ToolbarBtn
            active={editor?.isActive("orderedList")}
            onClick={() => editor?.chain().focus().toggleOrderedList().run()}
            title="Numbered list"
            disabled={!isReady}
          >
            <ListOrdered className="w-4 h-4" />
          </ToolbarBtn>

          {/* Link */}
          <ToolbarBtn
            active={editor?.isActive("link")}
            onClick={() => {
              if (editor?.isActive("link")) {
                editor.chain().focus().unsetLink().run();
              } else {
                openLinkInput();
              }
            }}
            title={editor?.isActive("link") ? "Remove link" : "Add link"}
            disabled={!isReady}
          >
            <Link2 className="w-4 h-4" />
          </ToolbarBtn>

          <Separator />

          {/* Text color */}
          <ToolbarBtn
            onClick={() => textColorRef.current?.click()}
            title="Text color"
            disabled={!isReady}
          >
            <Palette className="w-4 h-4" />
          </ToolbarBtn>
          <input
            ref={textColorRef}
            type="color"
            className="sr-only"
            defaultValue="#000000"
            onChange={(e) =>
              editor?.chain().focus().setColor(e.target.value).run()
            }
          />

          {/* Highlight */}
          <ToolbarBtn
            active={editor?.isActive("highlight")}
            onClick={() => highlightColorRef.current?.click()}
            title="Highlight color"
            disabled={!isReady}
          >
            <Highlighter className="w-4 h-4" />
          </ToolbarBtn>
          <input
            ref={highlightColorRef}
            type="color"
            className="sr-only"
            defaultValue="#fef08a"
            onChange={(e) =>
              editor
                ?.chain()
                .focus()
                .toggleHighlight({ color: e.target.value })
                .run()
            }
          />

          <Separator />

          {/* Clear formatting */}
          <ToolbarBtn
            onClick={() =>
              editor?.chain().focus().unsetAllMarks().clearNodes().run()
            }
            title="Clear formatting"
            disabled={!isReady}
          >
            <RemoveFormatting className="w-4 h-4" />
          </ToolbarBtn>
        </div>

        {/* ── Link URL input bar ── */}
        {linkInputActive && (
          <div className="flex items-center gap-2 px-3 py-1.5 border-b bg-blue-50">
            <Link2 className="w-4 h-4 text-blue-600 shrink-0" />
            <input
              ref={linkInputRef}
              type="url"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") applyLink();
                if (e.key === "Escape") closeLinkInput();
              }}
              placeholder="https://..."
              className="flex-1 text-sm bg-transparent outline-none"
            />
            <button
              type="button"
              onMouseDown={(e) => { e.preventDefault(); applyLink(); }}
              className="text-xs font-semibold text-white bg-blue-600 rounded px-2 py-0.5 hover:bg-blue-700"
            >
              Apply
            </button>
            <button
              type="button"
              onMouseDown={(e) => { e.preventDefault(); closeLinkInput(); }}
              className="text-gray-400 hover:text-gray-600"
              aria-label="Cancel"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        </div>{/* end sticky wrapper */}

        {/* ── Sync conflict banner ── */}
        {conflict && (
          <div className="flex flex-col gap-2 border-b bg-amber-50 px-3 py-2 text-sm">
            <span className="text-amber-800">
              This note changed elsewhere while you were offline. Choose which version to keep.
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={keepMyEdits}
                className="rounded bg-blue-600 px-3 py-1 text-white hover:bg-blue-700"
              >
                Keep my edits
              </button>
              <button
                type="button"
                onClick={loadLatestVersion}
                className="rounded border px-3 py-1 hover:bg-gray-50"
              >
                Load latest version
              </button>
            </div>
          </div>
        )}

        {/* ── Editor content ── */}
        <div className="flex-1">
          <EditorContent editor={editor} className="h-full" />
        </div>
      </div>

      {/* ── Sticky footer ── */}
      <div className="sticky bottom-0 bg-white/90 backdrop-blur border-t py-3 pb-[calc(env(safe-area-inset-bottom)+12px)]">
        <div className="text-sm text-gray-500 mb-2">{subtitle}</div>
        <button
          type="button"
          onClick={saveNow}
          className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
          disabled={saving || !isReady}
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </section>
  );
}
