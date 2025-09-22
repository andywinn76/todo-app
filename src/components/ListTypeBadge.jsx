"use client";

import { LIST_TYPE_LABELS, LIST_TYPE_STYLES } from "@/utils/listTypes";

export default function ListTypeBadge({ type, className = "" }) {
  if (!type) return null;
  const style =
    LIST_TYPE_STYLES[type] || "bg-gray-50 text-gray-500 ring-gray-200";
  const label = LIST_TYPE_LABELS[type] || type;
  function capitalizeFirstLetter(val) {
    return String(val).charAt(0).toUpperCase() + String(val).slice(1);
  }

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs ring-1 ${style} ${className}`}
      title={`List type: ${label}`}
    >
      {capitalizeFirstLetter(label)}
    </span>
  );
}
