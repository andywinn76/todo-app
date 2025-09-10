"use client";

import { LIST_TYPE_LABELS, LIST_TYPE_STYLES } from "@/utils/listTypes";

export default function ListTypeBadge({ type, className = "" }) {
  if (!type) return null;
  const style = LIST_TYPE_STYLES[type] || "bg-gray-100 text-gray-800 ring-gray-200";
  const label = LIST_TYPE_LABELS[type] || type;

  return (
    <span
      className={`inline-flex items-center rounded px-2 py-0.5 text-xs ring-1 ${style} ${className}`}
      title={`List type: ${label}`}
    >
      {label}
    </span>
  );
}
