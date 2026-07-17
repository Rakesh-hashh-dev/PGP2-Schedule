import { supabase } from "./supabase.js";

// Client data layer for the unified `notifications` event store (Phase 1).
// Read + realtime + mark-read only — producers write server-side (Phase 2), so
// there is no client insert here. Powers the in-app inbox; the same rows drive
// push delivery via delivered_push_at. See docs/notification-architecture.md.

const PAGE_SIZE = 50;

// Newest-first page of a user's notifications. Best-effort: returns [] on error
// so the inbox degrades to empty rather than throwing.
export async function fetchNotifications(userId, { limit = PAGE_SIZE, before } = {}) {
  if (!userId) return [];
  let q = supabase
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (before) q = q.lt("created_at", before);
  const { data, error } = await q;
  if (error) {
    console.error("[notifications] fetch:", error.message);
    return [];
  }
  return data || [];
}

// Count of unread rows (read_at is null). Cheap head-count query.
export async function fetchUnreadCount(userId) {
  if (!userId) return 0;
  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .is("read_at", null);
  if (error) {
    console.error("[notifications] unread count:", error.message);
    return 0;
  }
  return count || 0;
}

// Live inbox: fire onInsert for new rows and onUpdate for changed ones (e.g. a
// row gaining delivered_push_at, or read_at synced from another device).
// Mirrors the friend_pings realtime pattern in App.jsx. Returns an unsubscribe fn.
export function subscribeToNotifications(userId, { onInsert, onUpdate } = {}) {
  if (!userId) return () => {};
  const channel = supabase
    .channel(`notifications-realtime-${userId}`)
    .on("postgres_changes", {
      event: "INSERT", schema: "public", table: "notifications",
      filter: `user_id=eq.${userId}`,
    }, (payload) => { if (payload.new) onInsert?.(payload.new); })
    .on("postgres_changes", {
      event: "UPDATE", schema: "public", table: "notifications",
      filter: `user_id=eq.${userId}`,
    }, (payload) => { if (payload.new) onUpdate?.(payload.new); })
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}

// Mark one row read. No-ops silently if it fails (RLS scopes it to the owner).
export async function markNotificationRead(id) {
  if (!id) return;
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id)
    .is("read_at", null); // don't churn already-read rows
  if (error) console.error("[notifications] mark read:", error.message);
}

// Mark every unread row for a user read (the "mark all read" action).
export async function markAllNotificationsRead(userId) {
  if (!userId) return;
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", userId)
    .is("read_at", null);
  if (error) console.error("[notifications] mark all read:", error.message);
}
