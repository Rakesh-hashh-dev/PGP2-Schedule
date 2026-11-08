import { supabase } from './supabase';
async function request(name, args) {
  const { data, error } = await supabase.rpc(name, args);
  if (error) throw new Error(error.message);
  return data;
}
export const loadWorkspaceDraft = domain => request('admin_load_workspace_draft', { p_domain: domain });
export const saveWorkspaceDraft = (domain, payload, base, baseRevision, draftRevision) => request('admin_save_workspace_draft', {
  p_domain: domain, p_payload: payload, p_base: base, p_base_revision: baseRevision, p_draft_revision: draftRevision,
});
export const discardWorkspaceDraft = (domain, draftRevision) => request('admin_discard_workspace_draft', { p_domain: domain, p_draft_revision: draftRevision });

// Serialises autosaves. A response always advances the draft revision before a
// newer edit is sent; an older save can never overwrite a newer one in-flight.
export function createDraftAutosaver({ save, onSaved, onError, delay = 1000, initialRevision = 0 }) {
  let revision = initialRevision, timer, pending = false, latest, stopped = false;
  async function flush() {
    if (stopped || pending || !latest) return;
    const item = latest; latest = null; pending = true;
    try {
      const result = await save(item, revision);
      revision = Number(result.draft_revision);
      if (!stopped) onSaved(result);
    } catch (error) {
      // Retain the failed payload but stop automatic retries until another edit
      // or an explicit retry. Conflicts must never become unconditional writes.
      latest ||= item;
      if (!stopped) onError(error);
      return;
    } finally { pending = false; }
    if (!stopped && latest) timer = setTimeout(flush, delay);
  }
  return {
    update(item) { if (stopped) return; latest = item; clearTimeout(timer); timer = setTimeout(flush, delay); },
    retry() { clearTimeout(timer); return flush(); },
    stop() { stopped = true; clearTimeout(timer); },
  };
}
