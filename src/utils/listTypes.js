// Central place to define list-type metadata and sensible defaults.
// You can add more types or tweak defaults without touching UI components.

export const LIST_TYPES = [
  // "Personal",
  // "Work",
  // "Groceries",
  // "Errands",
  // "Projects",
  "todo",
  "grocery",
  "note",
];

export const LIST_TYPE_LABELS = {
  // Personal: "Personal",
  // Work: "Work",
  // Groceries: "Groceries",
  // Errands: "Errands",
  // Projects: "Projects",
  todo: "Todo",
  grocery: "Grocery",
  note: "Note",
};

// Tailwind utility classes for subtle color-coding per type.
export const LIST_TYPE_STYLES = {
  Personal: "bg-pink-100 text-pink-800 ring-pink-200",
  Work: "bg-blue-100 text-blue-800 ring-blue-200",
  Groceries: "bg-green-100 text-green-800 ring-green-200",
  Errands: "bg-amber-100 text-amber-900 ring-amber-200",
  Projects: "bg-purple-100 text-purple-800 ring-purple-200",
};

// Defaults that the TodoForm can use when a given list type is active.
export const LIST_TYPE_DEFAULTS = {
  Personal: { priority: "medium", dueInDays: 3 },
  Work: { priority: "high", dueInDays: 2 },
  Groceries: { priority: "low", dueInDays: 1 },
  Errands: { priority: "medium", dueInDays: 2 },
  Projects: { priority: "medium", dueInDays: 7 },
};
