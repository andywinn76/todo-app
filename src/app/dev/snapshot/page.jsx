// src/app/dev/snapshot/page.jsx
// Server Component: safe to use fs here
import fs from "fs";
import path from "path";

// Snapshot file list (current cleaned version)
const FILES = [
  "package.json",

  // ---- app routes ----
  "src/app/layout.js",
  "src/app/globals.css",
  "src/app/page.js",
  "src/app/account/page.jsx",
  "src/app/add/page.jsx",
  "src/app/invite/page.js",
  "src/app/invite/manage/page.jsx",
  "src/app/login/page.jsx",
  "src/app/reset-password/page.jsx",
  "src/app/reset-password/ResetPasswordClient.jsx",
  "src/app/dev/snapshot/page.jsx",

  // ---- components ----
  "src/components/AuthProvider.jsx",
  "src/components/ConditionalHeader.jsx",
  "src/components/DeleteIconButton.jsx",
  "src/components/GroceryList.jsx",
  "src/components/Header.jsx",
  "src/components/InvitesBell.jsx",
  "src/components/ListActions.jsx",
  "src/components/ListSelector.jsx",
  "src/components/ListTitleSwitcher.jsx",
  "src/components/ListTypeBadge.jsx",
  "src/components/ListsProvider.jsx",
  "src/components/Logo.jsx",
  "src/components/ManageListsDrawer.jsx",
  "src/components/NoteEditor.jsx",
  "src/components/ShareListInline.jsx",
  "src/components/TodoForm.jsx",
  "src/components/TodoItem.jsx",
  "src/components/TodoList.jsx",

  // ---- hooks ----
  "src/hooks/useRequireAuth.js",

  // ---- lib ----
  "src/lib/groceries.js",
  "src/lib/invites.js",
  "src/lib/lists.js",
  "src/lib/supabaseClient.js",
  "src/lib/todos.js",
  "src/lib/typeConfig.js",

  // ---- utils ----
  "src/utils/listTypes.js",
  "src/utils/profileSync.js",
];


// optional: gate with an env var so it’s not public in prod
const SNAPSHOT_ENABLED = process.env.NEXT_PUBLIC_SNAPSHOT === "true";

function readFile(relPath) {
  try {
    const p = path.join(process.cwd(), relPath);
    return fs.readFileSync(p, "utf8");
  } catch (e) {
    return `⚠️ Could not read ${relPath}\n${e?.message ?? e}`;
  }
}

export default function SnapshotPage() {
  if (!SNAPSHOT_ENABLED) {
    return (
      <main className="p-6">
        <h1 className="text-xl font-semibold">Snapshot disabled</h1>
        <p>Set <code>NEXT_PUBLIC_SNAPSHOT=true</code> to enable.</p>
      </main>
    );
  }

  return (
    <main className="p-6 space-y-8">
      <h1 className="text-2xl font-bold">Code Snapshot</h1>
      {FILES.map((file) => (
        <section key={file} className="space-y-2">
          <h2 className="text-lg font-semibold">{file}</h2>
          <pre className="whitespace-pre-wrap break-words border rounded p-3">
            {readFile(file)}
          </pre>
        </section>
      ))}
    </main>
  );
}
