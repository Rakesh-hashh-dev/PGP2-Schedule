import { supabase } from './supabase';

export async function loadStudentNote(userId) {
  const { data, error } = await supabase.from('admin_student_notes')
    .select('user_id,body,revision,updated_by,updated_at').eq('user_id', userId).maybeSingle();
  if (error) throw new Error(`Private note unavailable: ${error.message}`);
  return data || { user_id: userId, body: '', revision: 0, updated_by: null, updated_at: null };
}

export async function saveStudentNote(userId, body, revision) {
  if (!userId || typeof body !== 'string' || body.length > 20000 || !Number.isSafeInteger(revision) || revision < 0) {
    throw new Error('A student, note of at most 20,000 characters, and valid revision are required.');
  }
  const { data, error } = await supabase.rpc('admin_save_student_note', {
    p_user_id: userId, p_body: body, p_revision: revision,
  });
  if (error) throw new Error(error.message);
  const result = Array.isArray(data) ? data[0] : data;
  if (!result || result.user_id !== userId || Number(result.revision) !== revision + 1) {
    throw new Error('Save was not confirmed. Your edits are preserved; reload before retrying.');
  }
  return { ...result, revision: Number(result.revision) };
}
