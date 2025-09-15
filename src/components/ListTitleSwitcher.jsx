"use client";

import { useMemo, useRef } from "react";
import { useLists } from "@/components/ListsProvider";
import { FaChevronDown } from "react-icons/fa";

export default function ListTitleSwitcher({
  onOpenManage, // () => void (opens ManageListsDrawer)
}) {
  const { lists, activeListId } = useLists();
  const btnRef = useRef(null);

  const activeList = useMemo(
    () => lists.find((l) => String(l.id) === String(activeListId)),
    [lists, activeListId]
  );
  const activeName = activeList?.name ?? "Add a List";

  return (
    <div className="relative inline-block">
      {/* Title-as-button (no dropdown; opens Manage) */}
      <button
        ref={btnRef}
        type="button"
        className="inline-flex max-w-full items-center gap-2 text-2xl font-bold leading-none focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        aria-haspopup="dialog"
        aria-expanded={false}
        onClick={() => onOpenManage?.()}
        title="Manage lists"
      >
        <span className="truncate">{activeName}</span>
        <FaChevronDown className="ml-1 shrink-0" />
      </button>
    </div>
  );
}
