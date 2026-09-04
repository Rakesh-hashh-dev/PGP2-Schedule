// Pet persistence: `pet_state` is the source of truth, localStorage is its
// cache and write buffer.
//
// Why not cloud-only: the pet renders in the greeting, above the fold on every
// `today` load, and campus wifi is unreliable — it has to paint and stay
// interactive before (or without) a round trip.
//
// Why not local-only: progression cannot be re-derived. iOS Safari evicts
// script-writable storage after ~7 days without a visit, every reader in this
// app returns an empty default when storage is blocked, and a new phone starts
// from nothing. Attendance survives that because it re-syncs; a local-only pet
// would have nothing to re-sync from.
//
// See docs/pet-companion-plan.md §3.

import { supabase } from "./supabase.js";
import { levelFor, mergePets, normalize, prune, xpOf } from "./pet.js";

export const PET_KEY = "pgp2.pet";

/**
 * Cache key for ONE user's pet.
 *
 * Namespaced by Clerk id on purpose. A single shared key would let the next
 * account signed in on the same browser merge the previous student's ledger
 * into its own — and `syncPetFromCloud` writes that union straight back to the
 * cloud, so the XP transfer would be permanent. Campus devices get shared, so
 * this is a real path, not a theoretical one.
 *
 * With no user there is no cache: better a blank pet for one paint than
 * somebody else's.
 */
function cacheKey(userId) {
  return userId ? `${PET_KEY}:${userId}` : null;
}

/** How long writes coalesce before hitting the network. */
const FLUSH_MS = 6000;

// ── Local ───────────────────────────────────────────────────────

export function loadPet(userId) {
  const key = cacheKey(userId);
  if (!key) return normalize(null);
  try { return normalize(JSON.parse(localStorage.getItem(key))); }
  catch { return normalize(null); }
}

export function savePetLocal(userId, state) {
  const key = cacheKey(userId);
  if (!key) return;
  try { localStorage.setItem(key, JSON.stringify(normalize(state))); }
  catch { /* private mode / quota — the cloud row is still authoritative */ }
}

export function clearPetLocal(userId) {
  const key = cacheKey(userId);
  if (!key) return;
  try { localStorage.removeItem(key); } catch { /* ignore */ }
}

// ── Row ⇄ state ─────────────────────────────────────────────────
// Exported so a test can round-trip them: this mapping is the one place a
// column rename in the migration would break persistence silently.

/**
 * `level` is written alongside the state purely so friends can read it without
 * being handed the ledger (see get_friend_pets). It is recomputed on every
 * save, so a stale value self-heals rather than compounding.
 */
export function toRow(userId, state) {
  const s = normalize(state);
  return {
    user_id: userId,
    pet_key: s.petKey,
    name: s.name || null,
    level: levelFor(xpOf(s)),
    base_xp: s.baseXp,
    // granted_xp is intentionally absent: it is admin-owned and server-pinned.
    // Sending it would let an ordinary save clobber a grant made while this
    // tab was open. The pet_state_touch trigger enforces this server-side too.
    adopted_at: s.adoptedAt,
    awarded: s.awarded,
    care: s.care,
    last_seen: s.lastSeen,
    unlocked: s.unlocked,
    cosmetics: s.cosmetics,
  };
}

export function fromRow(row) {
  if (!row) return null;
  return normalize({
    v: 1,
    petKey: row.pet_key ?? null,
    name: row.name ?? "",
    adoptedAt: row.adopted_at ?? null,
    baseXp: row.base_xp ?? 0,
    grantedXp: row.granted_xp ?? 0,
    awarded: row.awarded ?? {},
    care: row.care ?? { day: null, used: 0 },
    lastSeen: Number(row.last_seen) || 0,
    unlocked: row.unlocked ?? [],
    cosmetics: row.cosmetics ?? { accessory: true },
  });
}

// ── Sync ────────────────────────────────────────────────────────

/**
 * Reconcile the local copy with the cloud row and return the truth.
 *
 * Both sides are merged rather than one overwriting the other: a student who
 * earned XP offline on their phone and then opened a laptop must keep both
 * days. `mergePets` unions the award ledgers and recomputes XP, so the merge
 * is order-independent (see pet.js).
 */
export async function syncPetFromCloud(userId) {
  const local = loadPet(userId);
  if (!userId) return local;
  try {
    const { data, error } = await supabase
      .from("pet_state").select("*").eq("user_id", userId).maybeSingle();
    if (error) { console.warn("[pet] sync failed:", error.message); return local; }

    const remote = fromRow(data);
    const merged = prune(remote ? mergePets(local, remote) : local);
    savePetLocal(userId, merged);
    // Push back when the local side contributed something the row didn't have,
    // so an offline stretch lands the moment the app is online again.
    if (JSON.stringify(toRow(userId, merged)) !== JSON.stringify(toRow(userId, remote || normalize(null)))) {
      await writePet(userId, merged);
    }
    return merged;
  } catch {
    return local;
  }
}

/** Immediate upsert. Returns false when the write didn't land. */
/**
 * Write the pet to the cloud.
 *
 * Goes through the `pet_state_merge` RPC, which unions the award ledger inside
 * a single locked statement. A bare upsert would send this client's whole row
 * and drop entries another device wrote since this one last synced; merging in
 * JS narrowed that window but could not close it, because the read and the
 * write were still two round trips. Postgres does it atomically.
 *
 * The RPC also derives `level` server-side, where `granted_xp` is always
 * visible — a client that has not re-synced since an admin grant can no longer
 * write a level that is too low for friends to see.
 *
 * Returns the state actually persisted, or null if the write failed.
 */
export async function writePet(userId, state) {
  if (!userId) return null;
  const s = normalize(state);
  try {
    const { data, error } = await supabase.rpc("pet_state_merge", {
      p_pet_key: s.petKey,
      p_name: s.name || null,
      p_adopted_at: s.adoptedAt,
      p_base_xp: s.baseXp,
      p_awarded: s.awarded,
      p_care: s.care,
      p_last_seen: s.lastSeen,
      p_unlocked: s.unlocked,
      p_cosmetics: s.cosmetics,
    });
    if (!error) return fromRow(Array.isArray(data) ? data[0] : data) || s;

    // The RPC is missing only if the frontend shipped ahead of its migration.
    // Fall back to read-merge-write rather than dropping the student's XP on
    // the floor for the length of that gap.
    console.warn("[pet] merge rpc failed, falling back:", error.message);
    return await writePetFallback(userId, s);
  } catch { return null; }
}

/** Pre-RPC write path. Same merge, two round trips, so a race remains. */
async function writePetFallback(userId, state) {
  try {
    let next = normalize(state);
    const { data, error: readError } = await supabase
      .from("pet_state").select("*").eq("user_id", userId).maybeSingle();
    // A failed read must not become a silent overwrite of the remote ledger.
    if (readError) { console.warn("[pet] pre-write read failed:", readError.message); return null; }
    const remote = fromRow(data);
    if (remote) next = prune(mergePets(next, remote));

    const { error } = await supabase
      .from("pet_state").upsert(toRow(userId, next), { onConflict: "user_id" });
    if (error) { console.warn("[pet] write failed:", error.message); return null; }
    return next;
  } catch { return null; }
}


// ── Debounced writer ────────────────────────────────────────────
//
// XP awards are chatty — marking three classes fires three saves within a few
// seconds. Because the whole pet is ONE upserted row, a failed or skipped write
// needs no operation queue the way split expenses do: the next successful write
// carries everything. `pending` is the queue.

let pending = null;
let pendingUser = null;
let timer = null;
let listenersBound = false;

function bindFlushListeners() {
  if (listenersBound || typeof document === "undefined") return;
  listenersBound = true;
  // pagehide is the reliable one on iOS; visibilitychange covers tab switches.
  const flush = () => { flushPet(); };
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flush();
  });
  window.addEventListener("pagehide", flush);
  window.addEventListener("online", flush);
}

/**
 * Persist locally now, and to the cloud shortly. Local is synchronous so the
 * UI never waits, and so a crash between here and the flush loses nothing.
 */
export function savePet(userId, state) {
  const s = normalize(state);
  savePetLocal(userId, s);
  if (!userId) return;
  bindFlushListeners();
  pending = s;
  pendingUser = userId;
  if (timer) return;
  timer = setTimeout(() => { timer = null; flushPet(); }, FLUSH_MS);
}

/** Force the buffered write out. Safe to call when nothing is pending. */
export async function flushPet() {
  if (timer) { clearTimeout(timer); timer = null; }
  if (!pending || !pendingUser) return true;
  const state = pending;
  const userId = pendingUser;
  pending = null;
  pendingUser = null;
  const saved = await writePet(userId, state);
  // Failed writes go back in the buffer rather than being dropped; the next
  // save or the `online` listener retries with the newest state.
  if (!saved && !pending) { pending = state; pendingUser = userId; }
  // Keep the cache level with what the cloud now holds, so the next reload
  // starts from the merged truth rather than re-proposing a superseded row.
  if (saved) savePetLocal(userId, saved);
  return Boolean(saved);
}

/** True when a write is still buffered — used by tests and the debug panel. */
export function hasPendingPetWrite() {
  return Boolean(pending);
}

// ── Friends ─────────────────────────────────────────────────────

/**
 * Public summaries for a set of friends, keyed by user id. Goes through the
 * definer-side projection, which returns key/name/level and nothing else.
 */
export async function fetchFriendPets(cloudIds) {
  const ids = (cloudIds || []).filter(Boolean);
  if (!ids.length) return {};
  try {
    const { data, error } = await supabase.rpc("get_friend_pets", { p_ids: ids });
    if (error || !data) return {};
    const map = {};
    for (const row of data) {
      if (row?.user_id && row.pet_key) {
        map[row.user_id] = { key: row.pet_key, name: row.name || "", level: row.level || 1 };
      }
    }
    return map;
  } catch { return {}; }
}
