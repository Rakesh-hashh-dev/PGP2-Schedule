import { supabase } from './supabase';
export async function searchAdminData({ dataset, query = '', from, to, cursor = null, status = '', actor = '', exportRows = false }) {
  const { data, error } = await supabase.rpc('admin_operational_search', { p_dataset: dataset, p_query: query, p_from: from, p_to: to, p_before: cursor?.at || null, p_before_key: cursor?.key || null, p_status: status || null, p_actor: actor || null, p_export: exportRows });
  if (error) throw new Error(error.message);
  return data;
}
export async function loadPublicationVersion(id) {
  const {data,error}=await supabase.rpc('admin_publication_version',{p_id:id});
  if(error) throw new Error(error.message);
  if(!data) throw new Error('Publication version is no longer available.');
  return data;
}
export function csvCell(value) {
  let text = value == null ? '' : typeof value === 'object' ? JSON.stringify(value) : String(value);
  if (/^\s*[=+@-]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}
export function downloadAdminCsv(name, rows) {
  const columns = [...new Set(rows.flatMap(row => Object.keys(row)))];
  const body = [columns.map(csvCell).join(','), ...rows.map(row => columns.map(key => csvCell(row[key])).join(','))].join('\r\n');
  const url = URL.createObjectURL(new Blob(['\ufeff', body], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a'); link.href = url; link.download = `${name}.csv`; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
