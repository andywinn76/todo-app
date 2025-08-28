// src/lib/invites.js
import { supabase } from "@/lib/supabaseClient";

export async function findUserIdByUsername(username) {
  const q = username.trim().toLowerCase();
  if (!q) return { userId: null, error: new Error("Username is required.") };

  const { data, error } = await supabase
    .from("profiles")
    .select("id")
    .eq("username_ci", q)
    .single();

  if (error || !data) {
    return { userId: null, error: new Error("No user found with that username.") };
  }
  return { userId: data.id, error: null };
}

// Resolve a user by username OR email
export async function findUserIdByIdentifier(identifier) {
  const raw = identifier.trim();
  if (!raw) return { userId: null, error: new Error("Username or email is required.") };

  // Treat anything containing '@' as an email
  if (raw.includes("@")) {
    const { data, error } = await supabase.rpc("find_user_by_email", { p_email: raw.toLowerCase() });
    if (error || !data) return { userId: null, error: new Error("No user found with that email.") };
    return { userId: data, error: null }; // RPC returns the user UUID
  }

  // Fallback to username path
  return findUserIdByUsername(raw);
}

export async function sendInvite({ listId, username, currentUserId }) {
  // "username" here can be a username OR an email
  const { userId: inviteeId, error: lookupErr } = await findUserIdByIdentifier(username);
  if (lookupErr || !inviteeId) return { error: lookupErr ?? new Error("Lookup failed.") };
  if (inviteeId === currentUserId) return { error: new Error("You can’t invite yourself.") };

  const { data: existingMember } = await supabase
    .from("list_members")
    .select("user_id")
    .eq("list_id", listId)
    .eq("user_id", inviteeId)
    .maybeSingle();

  if (existingMember) {
    return { error: new Error("That user is already a member of this list.") };
  }

  const { data, error } = await supabase
    .from("invites")
    .insert([
      {
        list_id: listId,
        inviter: currentUserId,
        invitee: inviteeId,
        status: "pending",
      },
    ])
    .select()
    .single();

  if (error) {
    const msg = (error.message || "").toLowerCase();
    if (msg.includes("duplicate")) {
      return { error: new Error("An invite already exists for this user.") };
    }
    return { error };
  }
  return { data, error: null };
}

// Realtime subscribe to new pending invites for a user
export function subscribeToInvites(userId, onInsert) {
  const channel = supabase
    .channel("invites-realtime")
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "invites",
        filter: `invitee=eq.${userId}`,
      },
      (payload) => {
        if (payload.new?.status === "pending") onInsert?.(payload.new);
      }
    )
    .subscribe();

  return () => supabase.removeChannel(channel);
}

// Count pending invites for a user (accurate with count)
export async function fetchPendingInviteCount(userId) {
  const { count, error } = await supabase
    .from("invites")
    .select("id", { count: "exact", head: true })
    .eq("invitee", userId)
    .eq("status", "pending");

  return { count: count ?? 0, error };
}

// Fetch pending invites for a user with list + inviter names (via separate queries)
export async function fetchPendingInvites(userId) {
  const { data: invites, error } = await supabase
    .from("invites")
    .select("id, created_at, list_id, status, inviter, invitee")
    .eq("invitee", userId)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  if (error || !invites?.length) return { data: invites ? [] : [], error };

  const listIds = [...new Set(invites.map((i) => i.list_id))];
  const inviterIds = [...new Set(invites.map((i) => i.inviter))];

  const [{ data: lists }, { data: profs }] = await Promise.all([
    supabase.from("lists").select("id, name").in("id", listIds),
    supabase.from("profiles").select("id, username").in("id", inviterIds),
  ]);

  const listMap = new Map((lists || []).map((l) => [l.id, l.name || "Untitled"]));
  const userMap = new Map((profs || []).map((p) => [p.id, p.username || "Someone"]));

  const items = invites.map((row) => ({
    id: row.id,
    listId: row.list_id,
    listName: listMap.get(row.list_id) ?? "Untitled",
    inviterId: row.inviter,
    inviterName: userMap.get(row.inviter) ?? "Someone",
    createdAt: row.created_at,
  }));

  return { data: items, error: null };
}

// Accept (invitee only) — calls the secure DB function
export async function acceptInvite(inviteId) {
  const { data, error } = await supabase.rpc("accept_invite", { p_invite_id: inviteId });
  return { data, error };
}

// Decline (simple row update)
export async function declineInvite(inviteId) {
  const { data, error } = await supabase
    .from("invites")
    .update({ status: "declined" })
    .eq("id", inviteId)
    .select()
    .single();
  return { data, error };
}
