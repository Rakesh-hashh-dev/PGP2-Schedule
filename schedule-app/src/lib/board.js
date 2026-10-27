import { supabase } from "./supabase.js";
import { sendSocialNotification } from "./friends.js";

// Campus Board — lost & found + buy/sell. Rows in `board_posts`, images in the
// public `board-images` bucket (see migrations 20260720120000_board.sql and
// 20261027140000_board_v2.sql). Posts expire 30 days after creation or their
// last renewal (filtered here, no cron).

export const BOARD_KINDS = [
  { id: "lost", label: "Lost", emoji: "🔍" },
  { id: "found", label: "Found", emoji: "🎒" },
  { id: "sell", label: "For sale", emoji: "🏷️" },
  { id: "ask", label: "Wanted", emoji: "🙏" },
];

export const MAX_BOARD_PHOTOS = 3;
export const BOARD_LIFETIME_DAYS = 30;

// Columns added by the v2 migration. Until it's applied, writes retry
// without them so posting keeps working on the old schema.
const V2_FIELDS = ["location", "negotiable", "image_paths"];

function isMissingColumn(error) {
  return error && (error.code === "PGRST204" || error.code === "42703" || /column/i.test(error.message || ""));
}

function withoutV2(row) {
  const copy = { ...row };
  V2_FIELDS.forEach(k => delete copy[k]);
  return copy;
}

/** All photos on a post, oldest schema (single image_path) included. */
export function postImagePaths(post) {
  if (Array.isArray(post?.image_paths) && post.image_paths.length) return post.image_paths;
  return post?.image_path ? [post.image_path] : [];
}

// The app paints optimistically before Clerk has loaded (cached schedule ⇒
// assume signed in), and the Supabase client only attaches a token once
// `window.Clerk.session` exists. Opening the board by link, push or refresh
// could therefore read before sign-in finished, and RLS answers an anonymous
// read with an empty list (no error) — an empty board. Board reads wait for
// Clerk to finish loading first; capped so a Clerk that never loads falls
// back to the old behaviour instead of hanging.
const CLERK_WAIT_MS = 8000;
let clerkReady = null;
function waitForClerk() {
  if (window.Clerk?.loaded) return Promise.resolve();
  if (!clerkReady) {
    clerkReady = new Promise(resolve => {
      const started = Date.now();
      const tick = setInterval(() => {
        if (window.Clerk?.loaded || Date.now() - started > CLERK_WAIT_MS) {
          clearInterval(tick);
          clerkReady = null;
          resolve();
        }
      }, 50);
    });
  }
  return clerkReady;
}

export async function fetchBoardPosts() {
  await waitForClerk();
  const query = select => supabase
    .from("board_posts")
    .select(select)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false });
  try {
    // Embedded count of visible comments (RLS-filtered). Falls back to the
    // plain feed if the comments migration isn't applied yet.
    let { data, error } = await query("*, board_comments(count)");
    if (error) ({ data, error } = await query("*"));
    if (error) { console.error("[fetchBoardPosts]", error.message); return null; }
    return (data || []).map(({ board_comments: c, ...post }) => ({ ...post, comment_count: c?.[0]?.count ?? 0 }));
  } catch { return null; }
}

// ── Comments (public thread per post) ────────────────────────────────────────

export const COMMENT_MAX = 500;

export async function fetchBoardComments(postId) {
  if (!postId) return [];
  await waitForClerk();
  try {
    const { data, error } = await supabase
      .from("board_comments")
      .select("*")
      .eq("post_id", postId)
      .order("created_at", { ascending: true });
    if (error) { console.error("[fetchBoardComments]", error.message); return null; }
    return data || [];
  } catch { return null; }
}

/** Returns the inserted row, or null (e.g. the post was resolved meanwhile — RLS refuses). */
export async function addBoardComment({ postId, userId, userName, body }) {
  const text = body?.trim().slice(0, COMMENT_MAX);
  if (!postId || !userId || !text) return null;
  try {
    const { data, error } = await supabase
      .from("board_comments")
      .insert({ post_id: postId, user_id: userId, user_name: userName || "Someone", body: text })
      .select()
      .single();
    if (error) { console.error("[addBoardComment]", error.message); return null; }
    return data;
  } catch { return null; }
}

export async function deleteBoardComment(commentId) {
  try {
    const { error } = await supabase.from("board_comments").delete().eq("id", commentId);
    if (error) console.error("[deleteBoardComment]", error.message);
    return !error;
  } catch { return false; }
}

/** Admin restore of a comment hidden by reports. */
export async function restoreBoardComment(commentId) {
  try {
    const { error } = await supabase.from("board_comments").update({ hidden: false, reported_by: [] }).eq("id", commentId);
    if (error) console.error("[restoreBoardComment]", error.message);
    return !error;
  } catch { return false; }
}

export async function reportBoardComment(commentId) {
  try {
    const { data, error } = await supabase.rpc("report_board_comment", { p_comment_id: commentId });
    if (error) { console.error("[reportBoardComment]", error.message); return null; }
    return data;
  } catch { return null; }
}

/**
 * Who hears about a new comment: someone else's comment pings the poster;
 * the poster's reply pings everyone else already in the thread.
 */
export async function notifyThread(post, comment, thread, fromId, fromName) {
  const preview = comment.body.length > 80 ? `${comment.body.slice(0, 77)}…` : comment.body;
  const meta = { fromId, fromName, group: post.title, postId: post.id, preview };
  if (fromId !== post.user_id) {
    await sendSocialNotification(post.user_id, "board_comment", meta);
    return;
  }
  const others = [...new Set(thread.map(c => c.user_id))].filter(id => id !== post.user_id);
  await Promise.all(others.map(id => sendSocialNotification(id, "board_reply", meta)));
}

/** Live changes to one post's thread. Returns unsubscribe fn. */
export function subscribeBoardComments(postId, onChange) {
  let timer = null;
  const channel = supabase
    .channel(`board-comments-${postId}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "board_comments", filter: `post_id=eq.${postId}` }, () => {
      clearTimeout(timer);
      timer = setTimeout(() => onChange?.(), 200);
    })
    // Realtime can't filter DELETE events, so listen to all of them; a
    // refetch of one short thread is cheap.
    .on("postgres_changes", { event: "DELETE", schema: "public", table: "board_comments" }, () => {
      clearTimeout(timer);
      timer = setTimeout(() => onChange?.(), 200);
    })
    .subscribe();
  return () => { clearTimeout(timer); supabase.removeChannel(channel); };
}

// Downscale to ≤maxPx and re-encode as webp so uploads stay well under the
// bucket's 2MB cap (typical result: 60–200KB). Safari can't encode webp —
// toBlob quietly hands back a large PNG instead — so fall back to JPEG there.
export async function resizeImage(file, maxPx = 1280, quality = 0.82) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxPx / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  canvas.getContext("2d").drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();
  const encode = type => new Promise(res => canvas.toBlob(res, type, quality));
  let blob = await encode("image/webp");
  if (blob?.type !== "image/webp") blob = await encode("image/jpeg");
  return blob || file;
}

const COMPRESSED_TYPES = { "image/webp": "webp", "image/jpeg": "jpg" };

async function uploadImages(userId, files) {
  const paths = [];
  for (const [i, file] of files.entries()) {
    // Composer pre-compresses; anything else (e.g. compression failed) gets another try.
    const blob = COMPRESSED_TYPES[file.type] && file.size < 1024 * 1024 ? file : await resizeImage(file);
    const ext = COMPRESSED_TYPES[blob.type] || "png";
    const path = `${userId}/${Date.now()}-${i}.${ext}`;
    const { error } = await supabase.storage
      .from("board-images")
      .upload(path, blob, { contentType: blob.type || "image/png", upsert: false });
    if (error) console.error("[boardUpload]", error.message);
    else paths.push(path);
  }
  return paths;
}

function removeImages(paths) {
  if (paths?.length) supabase.storage.from("board-images").remove(paths).then(() => {});
}

function cleanFields({ kind, title, body, price, contact, location, negotiable }) {
  const priced = kind === "sell" || kind === "ask";
  return {
    kind,
    title: title.trim().slice(0, 80),
    body: body?.trim()?.slice(0, 500) || null,
    price: priced && price !== "" && price != null ? Math.max(0, Math.round(Number(price))) : null,
    contact: contact?.trim()?.slice(0, 80) || null,
    location: location?.trim()?.slice(0, 60) || null,
    negotiable: kind === "sell" && !!negotiable,
  };
}

export async function createBoardPost({ userId, userName, imageFiles = [], ...fields }) {
  if (!userId || !fields.kind || !fields.title?.trim()) return null;
  try {
    const paths = await uploadImages(userId, imageFiles.slice(0, MAX_BOARD_PHOTOS));
    const row = {
      user_id: userId,
      user_name: userName || "Someone",
      ...cleanFields(fields),
      image_path: paths[0] || null,
      image_paths: paths,
    };
    let { data, error } = await supabase.from("board_posts").insert(row).select().single();
    if (isMissingColumn(error)) {
      ({ data, error } = await supabase.from("board_posts").insert(withoutV2(row)).select().single());
    }
    if (error) { console.error("[createBoardPost]", error.message); return null; }
    return data;
  } catch (e) { console.error("[createBoardPost]", e); return null; }
}

/**
 * Owner edit. `keepPaths` are the existing photos still wanted; `imageFiles`
 * are new ones to upload. Photos dropped from the post are deleted.
 */
export async function updateBoardPost(post, { userId, keepPaths = [], imageFiles = [], ...fields }) {
  if (!post?.id || !fields.title?.trim()) return null;
  try {
    const room = Math.max(0, MAX_BOARD_PHOTOS - keepPaths.length);
    const added = await uploadImages(userId || post.user_id, imageFiles.slice(0, room));
    const paths = [...keepPaths, ...added];
    const patch = { ...cleanFields(fields), image_path: paths[0] || null, image_paths: paths };
    let { data, error } = await supabase.from("board_posts").update(patch).eq("id", post.id).select().single();
    if (isMissingColumn(error)) {
      ({ data, error } = await supabase.from("board_posts").update(withoutV2(patch)).eq("id", post.id).select().single());
    }
    if (error) { console.error("[updateBoardPost]", error.message); removeImages(added); return null; }
    removeImages(postImagePaths(post).filter(p => !paths.includes(p)));
    return data;
  } catch (e) { console.error("[updateBoardPost]", e); return null; }
}

export function boardImageUrl(imagePath) {
  if (!imagePath) return null;
  return supabase.storage.from("board-images").getPublicUrl(imagePath).data?.publicUrl || null;
}

/** Owner toggles resolved; admin can set 'removed' or restore (clearing reports). */
export async function setBoardPostStatus(postId, status, extra = {}) {
  if (!postId) return false;
  try {
    const { error } = await supabase.from("board_posts").update({ status, ...extra }).eq("id", postId);
    if (error) console.error("[setBoardPostStatus]", error.message);
    return !error;
  } catch { return false; }
}

/** Owner pushes expiry back out to 30 days from now. Returns the new expiry or null. */
export async function renewBoardPost(postId) {
  if (!postId) return null;
  const expires = new Date(Date.now() + BOARD_LIFETIME_DAYS * 86400000).toISOString();
  try {
    const { error } = await supabase.from("board_posts").update({ expires_at: expires }).eq("id", postId);
    if (error) { console.error("[renewBoardPost]", error.message); return null; }
    return expires;
  } catch { return null; }
}

export async function deleteBoardPost(post) {
  if (!post?.id) return false;
  try {
    const { error } = await supabase.from("board_posts").delete().eq("id", post.id);
    if (error) { console.error("[deleteBoardPost]", error.message); return false; }
    removeImages(postImagePaths(post));
    return true;
  } catch { return false; }
}

/** One report per user (enforced server-side); 3 reports auto-hide the post. */
export async function reportBoardPost(postId) {
  if (!postId) return null;
  try {
    const { data, error } = await supabase.rpc("report_board_post", { p_post_id: postId });
    if (error) { console.error("[reportBoardPost]", error.message); return null; }
    return data; // current report count
  } catch { return null; }
}

/** In-app "I'm interested" ping to the poster (dedup: once per post per user). */
export async function contactPoster(post, fromId, fromName) {
  if (!post?.user_id || post.user_id === fromId) return;
  await sendSocialNotification(post.user_id, "board_contact", {
    fromId,
    fromName,
    group: post.title,   // copy fn's second arg — renders the post title
    postId: post.id,
  });
}

/** Absolute link that opens this post's sheet. */
export function boardPostLink(postId) {
  const url = new URL("/", window.location.origin);
  url.searchParams.set("view", "board");
  url.searchParams.set("post", postId);
  return url.toString();
}

/** Phone number in a free-text contact field, digits only with country code, or null. */
export function contactPhone(contact) {
  const digits = (contact || "").replace(/[^\d+]/g, "").replace(/^\+/, "");
  if (digits.length === 10 && /^[6-9]/.test(digits)) return `91${digits}`;
  if (digits.length === 12 && digits.startsWith("91")) return digits;
  return null;
}

const STOP_WORDS = new Set(["a", "an", "the", "my", "i", "of", "in", "on", "at", "near", "and", "with", "for", "to", "lost", "found", "someone", "anyone", "please", "black", "white", "blue"]);

function keywords(post) {
  return new Set(
    `${post.title} ${post.body || ""} ${post.location || ""}`
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter(w => w.length > 2 && !STOP_WORDS.has(w))
  );
}

/**
 * Lost ↔ found cross-matching: open posts of the opposite kind that share
 * keywords with this one, best overlap first. Client-side and approximate —
 * a nudge to look, not a claim.
 */
export function findMatches(post, posts, limit = 3) {
  const opposite = post?.kind === "lost" ? "found" : post?.kind === "found" ? "lost" : null;
  if (!opposite) return [];
  const mine = keywords(post);
  if (!mine.size) return [];
  return posts
    .filter(p => p.kind === opposite && p.status === "open" && p.id !== post.id)
    .map(p => {
      let score = 0;
      keywords(p).forEach(w => { if (mine.has(w)) score++; });
      return { post: p, score };
    })
    .filter(m => m.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(m => m.post);
}

/** Live inserts/updates/deletes on the board feed. Returns unsubscribe fn. */
export function subscribeBoard(onChange) {
  let timer = null;
  const channel = supabase
    .channel("board-posts")
    .on("postgres_changes", { event: "*", schema: "public", table: "board_posts" }, () => {
      // Coalesce bursts (report + auto-remove, multi-row edits) into one refetch.
      clearTimeout(timer);
      timer = setTimeout(() => onChange?.(), 250);
    })
    // Comment counts on the cards.
    .on("postgres_changes", { event: "*", schema: "public", table: "board_comments" }, () => {
      clearTimeout(timer);
      timer = setTimeout(() => onChange?.(), 250);
    })
    .subscribe();
  return () => { clearTimeout(timer); supabase.removeChannel(channel); };
}
