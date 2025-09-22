// "use client";
// import { useEffect, useRef, useState } from "react";
// import { toast } from "sonner";
// import ManageListsDrawer from "@/components/ManageListsDrawer";
// import { useLists } from "@/components/ListsProvider";
// import { createList } from "@/lib/lists";

// function TypePicker({ value, onChange, disabled, id = "list-type" }) {
//   return (
//     <>
//       <label className="mb-1 block text-sm font-semibold" htmlFor={id}>
//         List type
//       </label>
//       <select
//         id={id}
//         value={value}
//         onChange={(e) => onChange?.(e.target.value)}
//         className="mb-3 w-full rounded border px-3 py-2"
//         disabled={disabled}
//       >
//         <option value="todo">Todo</option>
//         <option value="grocery">Grocery</option>
//         <option value="note">Note</option>
//       </select>
//     </>
//   );
// }

// export default function ListSelector({ user }) {
//   const { lists, setLists, activeListId, setActiveListId, refreshLists } =
//     useLists();

//   const [showForm, setShowForm] = useState(false);
//   const [newName, setNewName] = useState("");
//   const [newType, setNewType] = useState("todo");
//   const [creating, setCreating] = useState(false);
//   const [manageOpen, setManageOpen] = useState(false);
//   const manageBtnRef = useRef(null);
//   const inputRef = useRef(null);

//   // Initial fetch
//   useEffect(() => {
//     if (!user) return;
//     (async () => {
//       await refreshLists();
//     })();
//   }, [user, refreshLists]);

//   // Autofocus when new-list form opens
//   useEffect(() => {
//     if (showForm) setTimeout(() => inputRef.current?.focus(), 0);
//   }, [showForm]);

//   async function handleCreate(e) {
//     e.preventDefault();
//     if (!user) return;

//     const name = newName.trim();
//     if (!name) {
//       toast.error("Please enter a list name");
//       return;
//     }

//     setCreating(true);
//     const { data: list, error } = await createList({
//       name,
//       userId: user.id,
//       type: newType,
//     });
//     setCreating(false);

//     if (error) {
//       console.error("create list error:", error);
//       toast.error("Could not create list");
//       return;
//     }

//     await refreshLists();
//     setActiveListId(list.id);

//     setNewName("");
//     setNewType("todo");
//     setShowForm(false);
//     toast.success("List created");
//   }

//   function handleCancel() {
//     setNewName("");
//     setNewType("todo");
//     setShowForm(false);
//   }

//   return (
//     <div className="mb-4">
//       {/* Row: select grows, buttons never shrink */}
//       <div className="flex flex-wrap items-center gap-2">
//         {/* Make the select the flexible piece */}
//         <div className="min-w-0 flex-1">
//           <select
//             value={activeListId ?? ""}
//             onChange={(e) => {
//               const v = e.target.value;
//               setActiveListId(v === "" ? null : String(v));
//             }}
//             title={
//               lists.find((l) => String(l.id) === String(activeListId))?.name ??
//               ""
//             }
//             className="w-full truncate rounded border px-2 py-1"
//           >
//             {lists.map((l) => (
//               <option key={l.id} value={l.id}>
//                 {l.name ?? "(untitled)"} {l.type ? `• ${l.type}` : ""}
//               </option>
//             ))}
//           </select>
//         </div>

//         {/* Controls: never shrink or get pushed off */}
//         <div className="flex items-center gap-2 shrink-0">
//           <button
//             type="button"
//             onClick={() => setManageOpen(true)}
//             className="rounded border px-3 py-1 text-sm font-semibold hover:bg-gray-50"
//             ref={manageBtnRef}
//           >
//             Manage
//           </button>
//           <button
//             type="button"
//             className="rounded border px-3 py-1 text-sm hover:bg-gray-50"
//             onClick={() => setShowForm((v) => !v)}
//           >
//             New
//           </button>
//         </div>
//       </div>

//       {showForm && (
//         <form
//           onSubmit={handleCreate}
//           className="mt-3 rounded border bg-white p-3 shadow-sm"
//         >
//           <label className="mb-1 block text-sm font-semibold">
//             New list name
//           </label>
//           <input
//             ref={inputRef}
//             type="text"
//             value={newName}
//             onChange={(e) => setNewName(e.target.value)}
//             className="mb-3 w-full rounded border px-3 py-2"
//             placeholder="e.g., Groceries, Trip Planning"
//             disabled={creating}
//           />

//           <TypePicker
//             value={newType}
//             onChange={setNewType}
//             disabled={creating}
//           />

//           <div className="flex gap-2">
//             <button
//               type="submit"
//               disabled={creating || !newName.trim()}
//               className={`${
//                 creating ? "cursor-not-allowed opacity-75" : ""
//               } rounded bg-blue-600 px-3 py-2 text-white hover:bg-blue-700`}
//             >
//               {creating ? "Creating…" : "Create List"}
//             </button>
//             <button
//               type="button"
//               onClick={handleCancel}
//               className="rounded border px-3 py-2 hover:bg-gray-50"
//               disabled={creating}
//             >
//               Cancel
//             </button>
//           </div>
//         </form>
//       )}

//       <ManageListsDrawer
//         open={manageOpen}
//         onClose={() => setManageOpen(false)}
//         user={user}
//         lists={lists}
//         setLists={setLists}
//         triggerRef={manageBtnRef}
//         onAfterCreate={async (created) => {
//           const updated = await refreshLists();
//           if (created?.id) setActiveListId(created.id);
//         }}
//         onAfterDelete={async (deletedId) => {
//           const updated = await refreshLists();
//           if (String(deletedId) === String(activeListId)) {
//             if (updated.length) setActiveListId(updated[0].id);
//             else setActiveListId(null);
//           }
//           setManageOpen(false);
//         }}
//       />
//     </div>
//   );
// }
"use client";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import ManageListsDrawer from "@/components/ManageListsDrawer";
import { useLists } from "@/components/ListsProvider";
import { createList } from "@/lib/lists";

function TypePicker({ value, onChange, disabled, id = "list-type" }) {
  return (
    <>
      <label className="mb-1 block text-sm font-semibold" htmlFor={id}>
        List type
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        className="mb-3 w-full rounded border px-3 py-2"
        disabled={disabled}
      >
        <option value="todo">Todo</option>
        <option value="grocery">Grocery</option>
        <option value="note">Note</option>
      </select>
    </>
  );
}

export default function ListSelector({ user }) {
  const { lists, setLists, activeListId, setActiveListId, refreshLists } =
    useLists();

  const [showForm, setShowForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState("todo");
  const [creating, setCreating] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const manageBtnRef = useRef(null);
  const inputRef = useRef(null);

  // Initial fetch
  useEffect(() => {
    if (!user) return;
    (async () => {
      await refreshLists();
    })();
  }, [user, refreshLists]);

  // Autofocus when new-list form opens
  useEffect(() => {
    if (showForm) setTimeout(() => inputRef.current?.focus(), 0);
  }, [showForm]);

  async function handleCreate(e) {
    e.preventDefault();
    if (!user) return;

    const name = newName.trim();
    if (!name) {
      toast.error("Please enter a list name");
      return;
    }

    setCreating(true);
    const { data: list, error } = await createList({
      name,
      userId: user.id,
      type: newType,
    });
    setCreating(false);

    if (error) {
      console.error("create list error:", error);
      toast.error("Could not create list");
      return;
    }

    await refreshLists();
    setActiveListId(list.id); // UUID string

    setNewName("");
    setNewType("todo");
    setShowForm(false);
    toast.success("List created");
  }

  function handleCancel() {
    setNewName("");
    setNewType("todo");
    setShowForm(false);
  }

  return (
    <div className="mb-4">
      {/* Row: select grows, buttons never shrink */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Make the select the flexible piece */}
        <div className="min-w-0 flex-1">
          <select
            value={activeListId ?? ""}
            onChange={(e) => {
              const v = e.target.value; // string
              if (v === "") {
                setActiveListId(null);
              } else {
                const match = lists.find((l) => l.id === v);
                setActiveListId(match?.id ?? null);
              }
            }}
            title={lists.find((l) => l.id === activeListId)?.name ?? ""}
            className="w-full truncate rounded border px-2 py-1"
          >
            {lists.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name ?? "(untitled)"} {l.type ? `• ${l.type}` : ""}
              </option>
            ))}
          </select>
        </div>

        {/* Controls: never shrink or get pushed off */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setManageOpen(true)}
            className="rounded border px-3 py-1 text-sm font-semibold hover:bg-gray-50"
            ref={manageBtnRef}
          >
            Manage
          </button>
          <button
            type="button"
            className="rounded border px-3 py-1 text-sm hover:bg-gray-50"
            onClick={() => setShowForm((v) => !v)}
          >
            New
          </button>
        </div>
      </div>

      {showForm && (
        <form
          onSubmit={handleCreate}
          className="mt-3 rounded border bg-white p-3 shadow-sm"
        >
          <label className="mb-1 block text-sm font-semibold">
            New list name
          </label>
          <input
            ref={inputRef}
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="mb-3 w-full rounded border px-3 py-2"
            placeholder="e.g., Groceries, Trip Planning"
            disabled={creating}
          />

          <TypePicker value={newType} onChange={setNewType} disabled={creating} />

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={creating || !newName.trim()}
              className={`${creating ? "cursor-not-allowed opacity-75" : ""} rounded bg-blue-600 px-3 py-2 text-white hover:bg-blue-700`}
            >
              {creating ? "Creating…" : "Create List"}
            </button>
            <button
              type="button"
              onClick={handleCancel}
              className="rounded border px-3 py-2 hover:bg-gray-50"
              disabled={creating}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <ManageListsDrawer
        open={manageOpen}
        onClose={() => setManageOpen(false)}
        user={user}
        lists={lists}
        triggerRef={manageBtnRef}
        onAfterCreate={async (created) => {
          const updated = await refreshLists();
          if (created?.id) setActiveListId(created.id);
        }}
        onAfterDelete={async (deletedId) => {
          const updated = await refreshLists();
          if (deletedId === activeListId) {
            if (updated.length) setActiveListId(updated[0].id);
            else setActiveListId(null);
          }
          setManageOpen(false);
        }}
      />
    </div>
  );
}
