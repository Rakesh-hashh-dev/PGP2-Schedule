import { supabase } from './supabase';
import { stripPrivateAdminConfig } from './privateAdminConfig.js';
import {validDate} from './controlsSchema.js';

export const PUBLICATION_DOMAINS = ['schedule', 'communications', 'system'];
const COMMUNICATION_KEYS = new Set(['scheduledAnnouncements', 'scheduledPushes', 'quickLinks', 'feedbackFlashes', 'feedbackFlash', 'updatePrompt', 'whatsNew', 'socialFlash']);
const BOOKKEEPING = new Set(['configHistory', 'scheduledConfigDeploys', 'adminNotes', 'adminRoles']);
export function publicationDomain(key) {
  return BOOKKEEPING.has(key) ? null : key === 'classOverrides' ? 'schedule' : COMMUNICATION_KEYS.has(key) ? 'communications' : 'system';
}
export function domainPayload(domain, flags, announcement) {
  if (!PUBLICATION_DOMAINS.includes(domain)) throw new Error('Unknown publication area.');
  return { flags: Object.fromEntries(Object.entries(stripPrivateAdminConfig(flags || {})).filter(([key]) => publicationDomain(key) === domain)),
    ...(domain === 'communications' ? { announcement: announcement ?? null } : {}) };
}
export function mergePublishedDomain(flags, domain, payload) {
  return { ...Object.fromEntries(Object.entries(flags || {}).filter(([key]) => publicationDomain(key) !== domain)), ...payload.flags };
}
async function request(name, args) {
  const { data, error } = await supabase.rpc(name, args);
  if (error) throw new Error(error.message);
  return data;
}
export const loadPublication = domain => request('admin_load_publication', { p_domain: domain });
export async function publishDomain(domain, payload, revision) {
  const result = await request('admin_publish_domain', { p_domain: domain, p_payload: payload, p_revision: revision });
  if (result?.domain !== domain || !Number.isSafeInteger(Number(result.revision)) || Number(result.revision) < revision) throw new Error('Publication was not confirmed. Reload this area.');
  return result;
}
export async function scheduleDomain(domain, payload, revision, at, previewId = null) {
  // datetime-local is institute time, independent of the admin device timezone.
  if(typeof at!=='string'||!/^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d$/.test(at)||!validDate(at.slice(0,10))) throw new Error('Choose a valid IST publication time.');
  const timestamp = new Date(`${at}:00+05:30`);
  if (!Number.isFinite(timestamp.getTime())) throw new Error('Choose a valid IST publication time.');
  return request('admin_schedule_domain', { p_domain: domain, p_payload: payload, p_revision: revision, p_at: timestamp.toISOString(), p_notify: !!previewId, p_preview: previewId });
}
export const previewScheduleNotices = (payload, revision, message) => request('admin_preview_schedule_notices', { p_payload: payload, p_revision: revision, p_message: message || null });
export const publishScheduleWithNotice = (payload, revision, preview) => request('admin_publish_schedule_with_notice', { p_payload: payload, p_revision: revision, p_preview: preview });
export const cancelPublication = id => request('admin_cancel_publication', { p_id: id });
export async function listScheduledPublications() {
  const { data, error } = await supabase.from('admin_scheduled_publications').select('id,domain,scheduled_at,status,error,created_by,notify_students,estimated_recipients,actual_recipients,published_at').order('scheduled_at', { ascending: false }).limit(50);
  if (error) throw new Error(error.message);
  return data;
}
