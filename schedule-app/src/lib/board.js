import { supabase } from "./supabase.js";
import { sendSocialNotification } from "./friends.js";

// Campus Board — lost & found + buy/sell. Rows in `board_posts`, images in the
// public `board-images` bucket (see migration 20260720120000_board.sql).
// Posts expire 30 days after creation (filtered here, no cron).

export const BOARD_KINDS = [
  { id: "lost", label: "Lost", emoji: "🔍" },
  { id: "found", label: "Found", emoji: "🎒" },
  { id: "sell", label: "For sale", emoji: "🏷️" },
  { id: "ask", label: "Wanted", emoji: "🙏" },
];

export async function fetchBoardPosts() {
  try {
    const { data, error } = await supabase
      .from("board_posts")
      .select("*")
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false });
    if (error) { console.error("[fetchBoardPosts]", error.message); return null; }
    return data || [];
  } catch { return null; }
}

// Downscale to ≤maxPx and re-encode as webp so uploads stay well under the
// bucket's 2MB cap (typical result: 60–200KB).
export async function resizeImage(file, maxPx = 1280, quality = 0.82) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxPx / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  canvas.getContext("2d").drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();
  const blob = await new Promise(res => canvas.toBlob(res, "image/webp", quality));
  return blob || file;
}

export async function createBoardPost({ userId, userName, kind, title, body, price, contact, imageFile }) {
  if (!userId || !kind || !title?.trim()) return null;
  let imagePath = null;
  try {
    if (imageFile) {
      const blob = imageFile.type === "image/webp" ? imageFile : await resizeImage(imageFile);
      imagePath = `${userId}/${Date.now()}.webp`;
      const { error: upErr } = await supabase.storage
        .from("board-images")
        .upload(imagePath, blob, { contentType: "image/webp", upsert: false });
      if (upErr) { console.error("[boardUpload]", upErr.message); imagePath = null; }
    }
    const { data, error } = await supabase
      .from("board_posts")
      .insert({
        user_id: userId,
        user_name: userName || "Someone",
        kind,
        title: title.trim().slice(0, 80),
        body: body?.trim()?.slice(0, 500) || null,
        price: (kind === "sell" || kind === "ask") && price !== "" && price != null ? Math.max(0, Math.round(Number(price))) : null,
        contact: contact?.trim()?.slice(0, 80) || null,
        image_path: imagePath,
      })
      .select()
      .single();
    if (error) { console.error("[createBoardPost]", error.message); return null; }
    return data;
  } catch (e) { console.error("[createBoardPost]", e); return null; }
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

export async function deleteBoardPost(post) {
  if (!post?.id) return false;
  try {
    if (post.image_path) {
      supabase.storage.from("board-images").remove([post.image_path]).then(() => {});
    }
    const { error } = await supabase.from("board_posts").delete().eq("id", post.id);
    if (error) console.error("[deleteBoardPost]", error.message);
    return !error;
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

/** Live inserts/updates/deletes on the board feed. Returns unsubscribe fn. */
export function subscribeBoard(onChange) {
  const channel = supabase
    .channel("board-posts")
    .on("postgres_changes", { event: "*", schema: "public", table: "board_posts" }, () => onChange?.())
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}
