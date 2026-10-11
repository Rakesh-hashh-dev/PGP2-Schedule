// Client API for the admin-only stores added in Phase 0 of the admin-tools
// roadmap (docs/ADMIN_TOOLS_ENHANCEMENTS.md).
//
// These live in their own tables rather than in system_config.flags for two
// reasons that are easy to forget and expensive to rediscover:
//
//   1. `flags` is world-readable — the whole app reads the config row on every
//      load, and RLS is row-level, so a draft parked in `flags` would be
//      visible to every student before it was ever published.
//   2. Everything in `flags` is downloaded by every user on cold start. Drafts,
//      snapshots and templates are admin-only data; putting them there taxes
//      the student startup path to serve a handful of admins.
//
// The PUBLISHED override map deliberately stays at flags.classOverrides, so the
// student app, class-reminders and schedule-diff keep reading exactly what they
// read today. Publishing a draft merges into that map — see publishDraft below.

import { supabase } from "./supabase";
import { makeOverrideKey } from "./overrides";

// Reads are gated on is_admin(), writes on can_write_config(), both server-side.
// A monitor therefore gets rows back but a silent 0-row result on writes, so
// every mutating call here reports the row it wrote and callers check it.

// ── Drafts ────────────────────────────────────────────────────────────────
export async function listDrafts({ status = "draft" } = {}) {
  const q = supabase.from("schedule_drafts").select("*").order("updated_at", { ascending: false });
  const { data, error } = status ? await q.eq("status", status) : await q;
  if (error) throw error;
  return data || [];
}

// `baseUpdatedAt` pins the config version this draft branched from so publish
// can tell "still current" from "the config moved under me".
export async function createDraft({ name, payload = {}, note = "", baseUpdatedAt = null }) {
  const { data, error } = await supabase
    .from("schedule_drafts")
    .insert({ name: name || "Untitled draft", payload, note, base_updated_at: baseUpdatedAt })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateDraft(id, patch) {
  const { data, error } = await supabase
    .from("schedule_drafts")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function discardDraft(id) {
  return updateDraft(id, { status: "discarded" });
}

// Merge a draft's overrides into a flags object, returning a NEW flags object.
// Kept pure and separate from the write so the same function can power the
// pre-publish impact preview (roadmap item 2) without touching the database.
export function mergeDraftIntoFlags(flags, draft) {
  const next = { ...(flags || {}) };
  const overrides = { ...(next.classOverrides || {}) };
  Object.entries(draft?.payload || {}).forEach(([date, entries]) => {
    overrides[date] = { ...(overrides[date] || {}), ...entries };
  });
  next.classOverrides = overrides;
  return next;
}

// Flatten a draft to the rows an impact preview lists. Uses the shared override
// keying so a draft and a live override describe a class the same way.
export function draftEntries(draft) {
  const out = [];
  Object.entries(draft?.payload || {}).forEach(([date, entries]) => {
    Object.entries(entries || {}).forEach(([key, value]) => {
      out.push({ date, key, ...value });
    });
  });
  return out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

// Build a draft payload entry with the same keying the live map uses, so a
// published draft lands on exactly the class the admin picked.
export function draftKeyFor(ident, section, start) {
  return makeOverrideKey(ident, section, start);
}

// Mark a draft published. The caller writes the merged flags to system_config
// FIRST and passes the resulting updated_at — this only records the outcome, so
// a failed config write never leaves a draft claiming to be live.
export async function markDraftPublished(id, publishedBy) {
  return updateDraft(id, {
    status: "published",
    published_at: new Date().toISOString(),
    published_by: publishedBy || null,
  });
}

// ── Named versions ────────────────────────────────────────────────────────
// Extends flags.configHistory (15 unlabelled auto-snapshots) rather than
// replacing it: history keeps working, this adds the named, durable ones.
export async function listVersions() {
  const { data, error } = await supabase
    .from("schedule_versions")
    .select("id, name, summary, created_by, created_at")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function saveVersion({ name, summary = "", flags }) {
  const { data, error } = await supabase
    .from("schedule_versions")
    .insert({ name, summary, flags })
    .select("id, name, summary, created_at")
    .single();
  if (error) throw error;
  return data;
}

export async function loadVersion(id) {
  const { data, error } = await supabase.from("schedule_versions").select("*").eq("id", id).single();
  if (error) throw error;
  return data;
}

// ── Templates ─────────────────────────────────────────────────────────────
export async function listTemplates() {
  const { data, error } = await supabase
    .from("schedule_templates")
    .select("*")
    .order("name", { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function saveTemplate({ name, kind = "custom", payload = {}, sections = [] }) {
  const { data, error } = await supabase
    .from("schedule_templates")
    .insert({ name, kind, payload, sections })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteTemplate(id) {
  const { error } = await supabase.from("schedule_templates").delete().eq("id", id);
  if (error) throw error;
}

// Sections are hardwired A/B and shift across term rollovers, so a template
// authored last term can silently target sections that no longer exist. Callers
// must run this before applying and surface anything it returns.
export function staleTemplateSections(template, liveSections) {
  const live = new Set(liveSections || []);
  return (template?.sections || []).filter((s) => !live.has(s));
}
