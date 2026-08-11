// Local-first cache for note content, keyed per user + list so device/user
// switches never leak another account's cached text. Notes cache full body
// text for offline reading/editing. Secure notes cache the encrypted blob
// only — plaintext must never touch localStorage.

const noteKey = (userId, listId) => `noteCache:${userId}:${listId}`;
const secureNoteKey = (userId, listId) => `secureNoteCache:${userId}:${listId}`;

function readJSON(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

export function readCachedNote(userId, listId) {
  if (!userId || !listId) return null;
  return readJSON(noteKey(userId, listId));
}

// note: server-confirmed row { id, list_id, body, updated_at }
// pendingBody/pendingSince: unsynced local edit, or null when nothing pending
export function writeCachedNote(userId, listId, note, pending = null) {
  if (!userId || !listId) return;
  writeJSON(noteKey(userId, listId), {
    id: note?.id ?? null,
    list_id: note?.list_id ?? String(listId),
    body: note?.body ?? "",
    updated_at: note?.updated_at ?? null,
    pendingBody: pending?.body ?? null,
    pendingSince: pending?.since ?? null,
  });
}

export function readCachedSecureNote(userId, listId) {
  if (!userId || !listId) return null;
  return readJSON(secureNoteKey(userId, listId));
}

// note: server-confirmed row { id, list_id, content_encrypted, salt, iv, crypto_version, updated_at }
export function writeCachedSecureNote(userId, listId, note) {
  if (!userId || !listId) return;
  writeJSON(secureNoteKey(userId, listId), {
    id: note?.id ?? null,
    list_id: note?.list_id ?? String(listId),
    content_encrypted: note?.content_encrypted ?? null,
    salt: note?.salt ?? null,
    iv: note?.iv ?? null,
    crypto_version: note?.crypto_version ?? null,
    updated_at: note?.updated_at ?? null,
  });
}
