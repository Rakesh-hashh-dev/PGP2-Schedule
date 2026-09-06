// Admin role management (roadmap item 8, steps 1-2).
//
// Roles used to live at flags.adminRoles — inside the world-readable config
// blob — and were enforced by a client-side alert() while the database's
// is_admin() treated every key in that map as a full admin. A "monitor" could
// open devtools and write system_config directly.
//
// Roles now live on public.admins, which students cannot read, and enforcement
// is in Postgres: can_write_config() gates the system_config UPDATE policy and
// every Phase 0 store. The helpers here are UX only — they decide what to grey
// out, never what is permitted. The database is the authority, so a stale or
// spoofed role in the browser buys nothing.

import { supabase } from "./supabase";

export const ROLE_MONITOR = "monitor";
export const ROLE_SUPERADMIN = "superadmin";

export const ROLE_LABELS = {
  [ROLE_MONITOR]: "Monitor (read-only)",
  [ROLE_SUPERADMIN]: "Superadmin",
};

// public.admins has no client write policy; role changes go through
// SECURITY DEFINER RPCs, which is also where the last-superadmin guard lives.
export async function listAdminRoles() {
  const { data, error } = await supabase.rpc("admin_list_roles");
  if (error) throw error;
  return data || [];
}

export async function setAdminRole(userId, role) {
  const { error } = await supabase.rpc("admin_set_role", { p_user_id: userId, p_role: role });
  if (error) throw error;
}

export async function removeAdminRole(userId) {
  const { error } = await supabase.rpc("admin_remove_role", { p_user_id: userId });
  if (error) throw error;
}

// The signed-in admin's own role, or null when they are not an admin.
export async function myAdminRole() {
  const { data, error } = await supabase.rpc("admin_role");
  if (error) throw error;
  return data ?? null;
}

// UX gate only — see the note at the top of this file.
export function canWrite(role) {
  return role !== ROLE_MONITOR;
}

// Turn the database's error into something an admin can act on. A monitor's
// write is refused by RLS as a silent 0-row update rather than an exception,
// so callers that see "no rows" on a write they expected to land should say so
// with this rather than inventing a cause.
export const READ_ONLY_MESSAGE =
  "Your account is a read-only Monitor. Ask a Superadmin to make this change.";
