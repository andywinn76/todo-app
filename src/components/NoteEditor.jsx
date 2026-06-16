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

  // Keep note state in a ref so doSave never captures a stale closure
  const noteRef = useRef(null);
  const saveTimer = useRef(null);
  const textColorRef = useRef(null);
  const highlightColorRef = useRef(null);
  const linkInputRef = useRef(null);

  // ----- save ---------------------------------------------------------------

  const doSave = useCallback(
    async (html) => {
      const currentNote = noteRef.current;
      setSaving(true);
      try {
        if (currentNote?.id) {
          const { data, error } = await supabase
            .from("notes")
            .update({ body: html, updated_by: user.id })
            .eq("id", currentNote.id)
            .select()
            .single();
          if (error) throw error;
          noteRef.current = data;
          setLastSavedAt(data.updated_at);
        } else {
          const { data, error } = await supabase
            .from("notes")
            .insert([{ list_id: listId, body: html, updated_by: user.id }])
            .select()
            .single();
          if (error) throw error;
          noteRef.current = data;
          setLastSavedAt(data.updated_at);
        }
      } catch (e) {
        console.error(e);
        toast.error("Failed to save note");
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
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => doSave(html), 700);
    },
  });

  // ----- load note when listId or editor changes ----------------------------

  useEffect(() => {
    if (!user || !listId || !editor) return;

    let cancelled = false;

    async function loadNote() {
      const { data, error } = await supabase
        .from("notes")
        .select("*")
        .eq("list_id", String(listId))
        .limit(1)
        .maybeSingle();

      if (cancelled) return;

      if (error) {
        console.error(error);
        toast.error("Failed to load note");
        noteRef.current = null;
        editor.commands.setContent("", false);
        return;
      }

      noteRef.current = data ?? null;
      setLastSavedAt(data?.updated_at ?? null);
      // false = don't emit onUpdate (avoids saving immediately on load)
      editor.commands.setContent(prepareContent(data?.body), false);
    }

    loadNote();

    return () => {
      cancelled = true;
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [user, listId, editor]);

  // ----- manual save --------------------------------------------------------

  function saveNow() {
    if (!editor) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    doSave(editor.getHTML());
  }

  // ----- footer subtitle ----------------------------------------------------

  const subtitle = useMemo(() => {
    if (saving) return "Saving…";
    if (!lastSavedAt) return null;
    const d = new Date(lastSavedAt);
    if (isNaN(d.getTime())) return null;
    return `Last saved ${d.toLocaleString()}`;
  }, [saving, lastSavedAt]);

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
