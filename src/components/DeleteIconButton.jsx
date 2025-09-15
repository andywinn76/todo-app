// src/components/DeleteIconButton.jsx
"use client";
import { FaTrashAlt } from "react-icons/fa";

/**
 * A compact, accessible red trash-can button used across list types.
 *
 * Props:
 * - onClick: () => void
 * - title?: string
 * - ariaLabel?: string
 * - disabled?: boolean
 * - className?: string (to allow small layout tweaks per context)
 */
export default function DeleteIconButton({
  onClick,
  title = "Delete",
  ariaLabel = "Delete",
  disabled = false,
  className = "",
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={ariaLabel}
      disabled={disabled}
      className={[
        "p-2 rounded transition",
        "text-red-600 hover:text-red-700",
        "hover:bg-red-50 focus:outline-none",
        "focus:ring-2 focus:ring-red-500/40",
        disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer",
        className,
      ].join(" ")}
    >
      <FaTrashAlt className="w-4 h-4" />
    </button>
  );
}
