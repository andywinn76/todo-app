// src/app/dev/snapshot/page.jsx
// Server Component: safe to use fs here
import fs from "fs";
import path from "path";

const FILES = [
  "package.json",
  "src/app/page.jsx",
  "src/components/Header.jsx",
  "src/components/ManageListsDrawer.jsx",
  "src/components/ListsProvider.jsx",
  "src/components/TodoList.jsx",
  "src/components/TodoForm.jsx",
  // add/remove as you like
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
