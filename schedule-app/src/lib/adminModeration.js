import { supabase } from './supabase';
async function rpc(name, args) {
  const { data, error } = await supabase.rpc(name, args);
  if (error) throw new Error(error.message);
  return data;
}
export async function reportContent(type,id,reason,detail='') {
  const result=await rpc('report_content',{p_type:type,p_id:id,p_reason:reason,p_detail:detail});
  if(typeof result!=='string'||!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(result)) throw new Error('Your report was not confirmed. Please retry.');
  return result;
}
export const loadReportQueue = (status = 'open',cursor=null) => rpc('admin_report_queue', { p_status: status, p_limit: 50,...(cursor?{p_before:cursor.created_at,p_before_id:cursor.id}:{}) });
export const moderateContent = (report, action, reason, owner = null) => rpc('admin_moderate_content', { p_report: report, p_action: action, p_reason: reason, p_owner: owner });
