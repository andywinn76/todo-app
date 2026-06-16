# Let's Dooo It — Project Backlog
_Last updated: 2026-06-16_

---

## ✅ Already Shipped

### Authentication & Account
- Sign up / login / password reset
- Username enforcement
- Profile management page
- Password change support

### Lists
- Create, rename, delete lists
- Four list types: `todo`, `grocery`, `note`, `secure_note`
- List type badge display
- Manage Lists drawer

### Sharing & Invites
- Dedicated sharing page
- Username-based sharing
- Invite management page (send, revoke, resend, copy link)

### Todo Lists
- Add, delete, complete todo items
- **Edit existing todos** — via slide-in drawer (title, description, priority, due date, progress toggle)
- **Due dates** — optional, shown on item with formatted date
- **Priority** — low / medium / high badge
- **Progress tracking** — slider per item, auto-completes at 100%
- Description field

### Grocery Lists
- Add, check, delete grocery items

### Notes
- **Rich text editor** (Tiptap): bold, italic, underline, H1/H2/H3, bullet list, ordered list, links, text color, highlight color, clear formatting
- **Tab indent** — 4 spaces in paragraphs; list nesting in list items
- **Auto-save** — 700 ms debounce, manual Save button
- Plain-text → HTML migration for old notes
- Sticky toolbar + sticky footer save bar

### Secure Notes
- Client-side AES encryption/decryption
- Master password unlock
- Auto-lock on tab blur
- No-recovery warning

### Search
- **Global search dialog** — searches todos (title), notes (body), grocery items (name)
- Grouped results by list, with snippet preview for notes
- Debounced with Escape-to-close

### Infrastructure
- Next.js App Router + Tailwind + Supabase Auth + Postgres + RLS
- Vercel deployment → letsdooooit.vercel.app
- DB keep-alive endpoint
- Sonner toast notifications
- PWA manifest + icons

---

## 🔴 High Priority

### Multi-select & Bulk Actions
- Tap/click checkbox to enter selection mode
- Select all / deselect all
- Bulk complete, bulk delete
- Visual selected state on todo items

### Drag-and-Drop Reordering
- Reorder todos within a list
- Persist `position` / `sort_order` to DB
- Library decision: `@dnd-kit/sortable` (recommended — no extra deps, touch-friendly)

### Email-Based Invites & Notifications
- Send invite by email address (not just username)
- Email notification on invite received
- Auto-remove invite row when revoked

### List Selector Placeholder Fix _(quick win)_
- Change "Add a List" → "Select a List" when lists exist but none is selected

---

## ✅ Shipped in this session (2026-06-16)

- **Manage Lists drawer — search filter**: magnifying glass icon + text input filters list names live
- **Manage Lists drawer — "Add New" → "+"**: button is now green to match app style
- **Manage Lists drawer — "Close" → "×"**: text replaced with × symbol

---

## 🟡 Medium Priority

### Todo Filtering & Sorting
- Sort by: due date, priority, created date, manual order
- Filter by: completed / incomplete, priority, due date range
- Persistent per-list preference (localStorage)

### Note Sorting
- Sort notes list (when multiple notes exist per list) by: last updated, name

### Mobile — Manage Invites Polish
- Responsive layout improvements for the invite management page
- Better touch targets

### Avatar Upload
- Upload and crop profile photo
- Display in header / profile page

### Progress-Task UX Decision _(resolve and close)_
- **Current state:** slider exists on todo items, toggled via "Track progress" in edit drawer
- **Decision needed:** keep slider-only, or also add tri-state checkbox cycle (Not Started → In Progress → Complete)?
- Recommendation: keep slider; tri-state adds complexity without clear gain given slider is already there

### Realtime Collaboration _(deferred — evaluate)_
- Supabase Realtime subscriptions for live list updates across users
- Currently app functions correctly with manual refresh; treat as stretch goal

---

## 🟢 Lower Priority / Nice-to-Have

### Recurring Tasks
- Repeat options: daily, weekly, monthly, custom
- Auto-create next instance on completion

### Task Categories / Tags
- User-defined tags per todo
- Filter by tag

### Secure Note Improvements
- Evaluate additional encryption hardening
- Shared-password workflow for collaborative secure notes

### Note — Mobile Double-Space Indent
- On mobile, detect double-space at start of line → convert to indent
- Discussed as alternative to Tab key (which isn't accessible on most mobile keyboards)

### Advanced Search
- Filter search results by list type
- Search within a single active list only
- Highlight matching term in results

---

## 💡 Decisions / Open Questions

| Topic | Status |
|---|---|
| Tri-state todos vs slider | Slider shipped; tri-state probably not needed — confirm to close |
| Realtime (Supabase subscriptions) | Deferred — revisit after bulk actions + reorder |
| Mobile double-space indent in notes | Not implemented — low effort if needed |
| Shared-password secure notes | No design yet — needs spec before building |
