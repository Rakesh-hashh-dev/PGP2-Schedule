import { supabase } from "./supabase";

export async function logAdminAction(_adminId, action, details) {
  try {
    const { error } = await supabase.rpc('admin_record_event', { p_action: action, p_details: details || {} });
    if (error) throw error;
  } catch (e) {
    console.error("Audit log failed", e);
  }
}
