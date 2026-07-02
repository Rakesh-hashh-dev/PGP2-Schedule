import { supabase } from "./supabase";

export async function logAdminAction(admin_id, action, details) {
  try {
    await supabase.from("admin_audit_logs").insert({ admin_id, action, details });
  } catch (e) {
    console.error("Audit log failed", e);
  }
}
