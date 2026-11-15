import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import ReportContentButton from './ReportContentDialog.jsx';
import {
  Package, Plus, X, Check, Flag, Trash2, MessageSquare, MessageCircle, Phone, ImagePlus, ShieldAlert, CheckCircle2,
  IndianRupee, Search, Backpack, Tag, Megaphone, MapPin, Share2, Pencil, RefreshCw, ChevronLeft, ChevronRight,
  Sparkles, Clock, Images, Copy, Lock, Send,
} from "lucide-react";
import {
  BOARD_KINDS, MAX_BOARD_PHOTOS, fetchBoardPosts, createBoardPost, updateBoardPost, boardImageUrl, postImagePaths,
  resizeImage, setBoardPostStatus, renewBoardPost, deleteBoardPost, reportBoardPost, contactPoster, subscribeBoard,
  boardPostLink, contactPhone, findMatches, COMMENT_MAX, fetchBoardComments, addBoardComment, deleteBoardComment,
  restoreBoardComment, reportBoardComment, notifyThread, subscribeBoardComments,
} from "../lib/board.js";
import "../styles/board.css";
import { useBackClose } from "../lib/backClose.js";
import { useDialog, dialogProps } from "../hooks/useDialog.js";
import { takeInitialBoardPost } from "../lib/navView.js";

// Campus Board — cohort lost & found + buy/sell. Feed is Supabase-backed with
// realtime refresh; moderation is report-to-hide (3 reports) plus admin
// remove/restore from a post's sheet. Tapping a card opens its detail sheet,
// which holds every action; cards only carry the one primary action.

const DAY = 86400000;

// Posts this student has pinged / reported, remembered per account in this
// browser so the buttons stay "Pinged" / "Reported" across reloads. The server
// already ignores a repeat ping (notification dedup key), so a second device
// showing the button again can't double-notify the poster.
const MAX_REMEMBERED = 300;
function loadIdSet(key) {
  try { return new Set(JSON.parse(localStorage.getItem(key) || "[]")); } catch { return new Set(); }
}
function saveIdSet(key, set) {
  try { localStorage.setItem(key, JSON.stringify([...set].slice(-MAX_REMEMBERED))); } catch { /* storage unavailable — session-only */ }
}

// Posted within the last 3h — drives the "New" freshness pill. Module-scope
// (like timeAgo) so the Date.now() read stays out of the render body.
function isRecent(iso, hours = 3) {
  return Date.now() - new Date(iso).getTime() < hours * 3600 * 1000;
}

function timeAgo(iso) {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// "919876543210" → "+91 98765 43210"
function formatPhone(digits) {
  return `+${digits.slice(0, 2)} ${digits.slice(2, 7)} ${digits.slice(7)}`;
}

function daysLeft(iso) {
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / DAY));
}

const KIND_META = Object.fromEntries(BOARD_KINDS.map(k => [k.id, k]));

const KIND_ICONS = {
  lost: Search,
  found: Backpack,
  sell: Tag,
  ask: Megaphone,
  celebrate: Sparkles,
};

const SORTS = [
  { id: "new", label: "Newest" },
  { id: "price-asc", label: "Price: low to high" },
  { id: "price-desc", label: "Price: high to low" },
];

const TITLE_HINTS = {
  lost: "What did you lose?",
  found: "What did you find?",
  sell: "What are you selling?",
  ask: "What are you looking for?",
  celebrate: 'A wish, a campus moment, a little celebration…',
};

const LOCATION_LABELS = {
  lost: "Last seen at",
  found: "Found at",
  sell: "Pickup spot",
  celebrate: 'Celebration spot',
};

function KindIcon({ kind, size = 14, className = "" }) {
  const Icon = KIND_ICONS[kind] || Package;
  return <Icon size={size} className={`board-kind-ico ${className}`} aria-hidden="true" />;
}

function KindBadge({ kind, float = false }) {
  const meta = KIND_META[kind] || KIND_META.lost;
  return (
    <span className={`board-kind-badge board-k-${kind}${float ? " board-kind-badge-float" : ""}`}>
      <KindIcon kind={kind} size={12} /> {meta.label}
    </span>
  );
}

function Price({ post }) {
  if (post.price == null) return null;
  return (
    <span className="board-price-tag">
      {post.price === 0 ? "Free" : `₹${post.price.toLocaleString("en-IN")}`}
      {post.negotiable && <small>neg.</small>}
    </span>
  );
}

function StatusBadges({ post, isAdmin }) {
  const reportCount = Array.isArray(post.reported_by) ? post.reported_by.length : 0;
  return (
    <>
      {post.status === "resolved" && <span className="board-status-badge"><CheckCircle2 size={11} /> {post.kind === "sell" ? "Sold" : "Resolved"}</span>}
      {post.status === "removed" && <span className="board-status-badge board-removed-badge"><ShieldAlert size={11} /> Removed</span>}
      {isAdmin && reportCount > 0 && post.status !== "removed" && (
        <span className="board-status-badge board-removed-badge"><Flag size={10} /> {reportCount}</span>
      )}
    </>
  );
}

// ── Composer (create + edit) ─────────────────────────────────────────────────

let photoKey = 0;

function BoardComposer({ userId, userName, post, onSaved, onClose, initialKind }) {
  useBackClose(onClose);
  const dialogRef = useDialog(true, onClose);
  const editing = !!post;
  const [kind, setKind] = useState(post?.kind || initialKind || "lost");
  const [title, setTitle] = useState(post?.title || "");
  const [body, setBody] = useState(post?.body || "");
  const [price, setPrice] = useState(post?.price ?? "");
  const [negotiable, setNegotiable] = useState(!!post?.negotiable);
  const [location, setLocation] = useState(post?.location || "");
  const [contact, setContact] = useState(() => {
    if (post?.contact) return post.contact;
    try {
      return localStorage.getItem("pgp2.board-contact") || localStorage.getItem("pgp2.travel-wa") || "";
    } catch {
      return "";
    }
  });
  // { key, path } for photos already on the post, { key, file, url } for new ones
  const [photos, setPhotos] = useState(() => postImagePaths(post).map(path => ({ key: ++photoKey, path, url: boardImageUrl(path) })));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const fileRef = useRef(null);
  const photosRef = useRef(photos);
  useEffect(() => { photosRef.current = photos; }, [photos]);
  useEffect(() => () => photosRef.current.forEach(p => p.file && URL.revokeObjectURL(p.url)), []);

  async function addFiles(fileList) {
    const files = [...(fileList || [])].filter(f => f.type.startsWith("image/"));
    if (!files.length) return;
    const room = MAX_BOARD_PHOTOS - photosRef.current.length;
    if (room <= 0) { setError(`Up to ${MAX_BOARD_PHOTOS} photos per post.`); return; }
    if (files.some(f => f.size > 15 * 1024 * 1024)) { setError("One of those images is over 15MB — pick a smaller one."); return; }
    setError(files.length > room ? `Only the first ${room} photo${room === 1 ? "" : "s"} added (max ${MAX_BOARD_PHOTOS}).` : null);
    for (const f of files.slice(0, room)) {
      const key = ++photoKey;
      const url = URL.createObjectURL(f);
      setPhotos(prev => [...prev, { key, file: f, url }]);
      // Compress straight away so posting is quick.
      resizeImage(f)
        .then(blob => setPhotos(prev => prev.map(p => p.key === key ? { ...p, file: blob } : p)))
        .catch(() => { /* upload falls back to resizing the original */ });
    }
  }

  function removePhoto(key) {
    setPhotos(prev => {
      const gone = prev.find(p => p.key === key);
      if (gone?.file) URL.revokeObjectURL(gone.url);
      return prev.filter(p => p.key !== key);
    });
    if (fileRef.current) fileRef.current.value = "";
  }

  function onPaste(e) {
    const files = [...(e.clipboardData?.items || [])].filter(i => i.type.startsWith("image/")).map(i => i.getAsFile()).filter(Boolean);
    if (files.length) { e.preventDefault(); addFiles(files); }
  }

  async function submit(e) {
    e.preventDefault();
    if (!title.trim() || busy) return;
    setBusy(true);
    setError(null);
    const fields = { kind, title, body, price, negotiable, location: kind === "ask" ? "" : location, contact };
    const imageFiles = photos.filter(p => p.file).map(p => p.file);
    const row = editing
      ? await updateBoardPost(post, { ...fields, userId, keepPaths: photos.filter(p => p.path).map(p => p.path), imageFiles })
      : await createBoardPost({ ...fields, userId, userName, imageFiles });
    setBusy(false);
    if (!row) { setError(`Couldn’t ${editing ? "save" : "post"} — check your connection and try again.`); return; }
    if (contact.trim()) {
      const p = contactPhone(contact);
      if (p) {
        try {
          localStorage.setItem("pgp2.travel-wa", p.slice(2));
          localStorage.setItem("pgp2.board-contact", contact.trim());
        } catch { /* ok */ }
      }
    }
    onSaved(row);
  }

  const showPrice = kind === "sell" || kind === "ask";

  return createPortal(
    <div className="board-modal-backdrop board-modal-top" onClick={onClose}>
      <form
        ref={dialogRef}
        {...dialogProps(null, { labelledBy: "board-composer-title" })}
        className="board-composer"
        onClick={e => e.stopPropagation()}
        onSubmit={submit}
        onPaste={onPaste}
        onDrop={e => { e.preventDefault(); addFiles(e.dataTransfer?.files); }}
        onDragOver={e => e.preventDefault()}
      >
        <div className="board-composer-head">
          <div>
            <span className="board-eyebrow">Campus Board</span>
            <h3 id="board-composer-title">{editing ? <Pencil size={18} aria-hidden="true" /> : <Package size={18} aria-hidden="true" />} {editing ? "Edit post" : "Create a post"}</h3>
            <p>{editing ? "Changes show up for everyone straight away." : "Live for the batch for 30 days — renew it from the post if you need longer."}</p>
          </div>
          <button type="button" className="board-icon-btn" onClick={onClose} aria-label="Close"><X size={16} /></button>
        </div>

        <div className="board-field">
          <span className="board-field-label">What kind of post is this?</span>
          <div className="board-kind-picker">
            {BOARD_KINDS.map(k => (
              <button key={k.id} type="button" aria-pressed={kind === k.id} className={`board-kind-chip board-k-${k.id}${kind === k.id ? " on" : ""}`} onClick={() => setKind(k.id)}>
                <KindIcon kind={k.id} size={14} /> {k.label}
              </button>
            ))}
          </div>
        </div>

        <label className="board-field">
          <span className="board-field-label">Title</span>
          <input className="board-input" placeholder={TITLE_HINTS[kind]} maxLength={80} value={title} onChange={e => setTitle(e.target.value)} autoFocus={!editing} />
        </label>
        <label className="board-field">
          <span className="board-field-label">Details <em>Optional</em></span>
          <textarea className="board-input board-textarea" placeholder={kind === 'celebrate' ? 'Share a Diwali wish or the story behind your campus celebration…' : 'Colour, brand, condition, when — anything that helps…'} maxLength={500} rows={3} value={body} onChange={e => setBody(e.target.value)} />
          <span className="board-char-count">{body.length}/500</span>
        </label>

        {(showPrice || kind !== "ask") && (
          <div className="board-composer-row">
            {showPrice && (
              <label className="board-field board-price-field">
                <span className="board-field-label">{kind === "ask" ? "Budget" : "Price"} <em>0 = free</em></span>
                <div className="board-price-wrap"><IndianRupee size={13} aria-hidden="true" /><input className="board-input board-price" type="number" inputMode="numeric" min="0" placeholder="0" value={price} onChange={e => setPrice(e.target.value)} /></div>
              </label>
            )}
            {kind !== "ask" && (
              <label className="board-field">
                <span className="board-field-label">{LOCATION_LABELS[kind]} <em>Optional</em></span>
                <div className="board-price-wrap"><MapPin size={13} aria-hidden="true" /><input className="board-input" placeholder={kind === "sell" ? "e.g. Hostel B, room 214" : "e.g. Library 2nd floor"} maxLength={60} value={location} onChange={e => setLocation(e.target.value)} /></div>
              </label>
            )}
          </div>
        )}

        {kind === "sell" && (
          <label className="board-check">
            <input type="checkbox" checked={negotiable} onChange={e => setNegotiable(e.target.checked)} />
            <span>Price is negotiable</span>
          </label>
        )}

        {kind !== 'celebrate' && <label className="board-field">
          <span className="board-field-label">Contact <em>Optional — a 10-digit number adds WhatsApp &amp; call buttons</em></span>
          <input className="board-input" placeholder="Phone or room number" maxLength={80} value={contact} onChange={e => setContact(e.target.value)} />
        </label>}

        <div className="board-field">
          <span className="board-field-label">Photos <em>{photos.length}/{MAX_BOARD_PHOTOS} · paste or drop works too</em></span>
          {kind === 'celebrate' && <p className="board-celebrate-note">Photos use shareable image links. Post people’s photos only with their permission. Reports go to the campus moderation queue.</p>}
          <div className="board-photo-row">
            <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={e => addFiles(e.target.files)} />
            {photos.map(p => (
              <span key={p.key} className="board-img-preview">
                <img src={p.url} alt="" />
                <button type="button" className="board-icon-btn" aria-label="Remove photo" onClick={() => removePhoto(p.key)}><X size={12} /></button>
              </span>
            ))}
            {photos.length < MAX_BOARD_PHOTOS && (
              <button type="button" className="board-img-btn" onClick={() => fileRef.current?.click()}>
                <ImagePlus size={16} /> <span>Add photo</span>
              </button>
            )}
          </div>
        </div>

        {error && <div className="board-error" role="alert">{error}</div>}

        <div className="board-composer-footer">
          <p className="board-composer-note">{contact.trim() ? "Your contact is visible to the whole batch." : "No contact? People can still reach you with an in-app ping."}</p>
          <button type="submit" className="board-submit" disabled={!title.trim() || busy} aria-busy={busy}>
            {busy ? (editing ? "Saving…" : "Posting…") : (editing ? "Save changes" : "Post to board")}
          </button>
        </div>
      </form>
    </div>,
    document.body
  );
}

// ── Comment thread ───────────────────────────────────────────────────────────

// Public discussion under a post. The server only accepts comments while the
// post is open, so "resolved locks the thread" holds even for a stale client.
function CommentThread({ post, userId, userName, isAdmin, onToast }) {
  const [comments, setComments] = useState(null); // null = loading
  const [unavailable, setUnavailable] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [reported, setReported] = useState(() => new Set());
  const [confirmId, setConfirmId] = useState(null);
  const locked = post.status !== "open";
  const ownPost = post.user_id === userId;

  useEffect(() => {
    let alive = true;
    const load = () => fetchBoardComments(post.id).then(rows => {
      if (!alive) return;
      if (rows === null) { setUnavailable(true); setComments(c => c ?? []); return; }
      setUnavailable(false);
      setComments(rows);
    });
    load();
    const unsub = subscribeBoardComments(post.id, load);
    const interval = setInterval(load, 30000);
    return () => { alive = false; unsub(); clearInterval(interval); };
  }, [post.id]);

  async function submit(e) {
    e.preventDefault();
    const text = draft.trim();
    if (!text || sending || locked) return;
    setSending(true);
    const row = await addBoardComment({ postId: post.id, userId, userName, body: text });
    setSending(false);
    if (!row) { onToast("Couldn’t post your comment — the post may have just been resolved. Try again."); return; }
    const before = comments || [];
    setDraft("");
    setComments([...before.filter(c => c.id !== row.id), row]);
    notifyThread(post, row, before, userId, userName);
  }

  async function remove(c) {
    setConfirmId(null);
    setComments(prev => (prev || []).filter(x => x.id !== c.id));
    if (!(await deleteBoardComment(c.id))) {
      onToast("Couldn’t delete that comment");
      fetchBoardComments(post.id).then(rows => rows && setComments(rows));
    }
  }

  async function _report(c) {
    setReported(prev => new Set(prev).add(c.id));
    const n = await reportBoardComment(c.id);
    onToast(n == null ? "Couldn’t send report — try again" : "Thanks — reported to moderators");
  }

  async function restore(c) {
    if (await restoreBoardComment(c.id)) setComments(prev => prev.map(x => x.id === c.id ? { ...x, hidden: false, reported_by: [] } : x));
    else onToast("Couldn’t restore that comment");
  }

  const count = comments?.length ?? 0;
  return (
    <section className="board-thread" aria-label="Comments">
      <h3><MessageSquare size={15} aria-hidden="true" /> Comments{count > 0 && <span>{count}</span>}</h3>

      {comments === null ? (
        <p className="board-thread-note">Loading comments…</p>
      ) : unavailable && count === 0 ? (
        <p className="board-thread-note">Comments aren’t available right now.</p>
      ) : count === 0 ? (
        <p className="board-thread-note">{locked ? "No comments were left on this post." : post.kind === "lost" || post.kind === "found" ? "No comments yet. Seen it somewhere? Share a lead." : "No comments yet. Ask a question about it."}</p>
      ) : (
        <ol className="board-comments">
          {comments.map(c => {
            const mine = c.user_id === userId;
            const byPoster = c.user_id === post.user_id;
            const canDelete = mine || ownPost || isAdmin;
            return (
              <li key={c.id} className={`board-comment${byPoster ? " is-poster" : ""}${c.hidden ? " is-hidden" : ""}`}>
                <div className="board-comment-head">
                  <strong>{mine ? "You" : c.user_name || "Someone"}</strong>
                  {byPoster && <span className="board-poster-tag">Poster</span>}
                  <time dateTime={c.created_at} title={new Date(c.created_at).toLocaleString("en-IN")}>{timeAgo(c.created_at)}</time>
                </div>
                <p>{c.body}</p>
                {c.hidden && <small className="board-comment-flag"><ShieldAlert size={11} /> Hidden after reports{isAdmin ? "" : " — only you can see it"}</small>}
                <div className="board-comment-actions">
                  {!mine && !c.hidden && (reported.has(c.id)
                    ? <span>Reported</span>
                    : <ReportContentButton type="board_comment" contentId={c.id} />)}
                  {isAdmin && c.hidden && <button type="button" onClick={() => restore(c)}>Restore</button>}
                  {canDelete && (confirmId === c.id
                    ? <><button type="button" className="is-danger" onClick={() => remove(c)}>Confirm delete</button><button type="button" onClick={() => setConfirmId(null)}>Keep</button></>
                    : <button type="button" onClick={() => setConfirmId(c.id)}>Delete</button>)}
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {locked ? (
        <p className="board-thread-locked"><Lock size={13} aria-hidden="true" /> Comments are closed — this post is {post.status === "removed" ? "removed" : post.kind === "sell" ? "sold" : "resolved"}.{ownPost && post.status === "resolved" ? " Reopen it to allow replies." : ""}</p>
      ) : (
        <form className="board-thread-form" onSubmit={submit}>
          <label className="board-sr" htmlFor={`board-comment-${post.id}`}>Write a comment</label>
          <textarea
            id={`board-comment-${post.id}`}
            className="board-input"
            rows={2}
            maxLength={COMMENT_MAX}
            placeholder={ownPost ? "Reply to the thread…" : "Write a comment…"}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) submit(e); }}
          />
          <div className="board-thread-form-foot">
            <small>{draft.length > COMMENT_MAX - 100 ? `${COMMENT_MAX - draft.length} left` : "Visible to your whole batch"}</small>
            <button type="submit" className="board-act board-act-primary board-thread-send" disabled={!draft.trim() || sending}>
              <Send size={13} /> {sending ? "Posting…" : "Post"}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}

// ── Detail sheet ─────────────────────────────────────────────────────────────

function PostSheet({ post, posts, userId, userName, isAdmin, pinged, reported, onContact, onReport: _onReport, onStatus, onRenew, onDelete, onEdit, onOpen, onToast, onClose }) {
  useBackClose(onClose);
  const dialogRef = useDialog(true, onClose);
  const [photoIdx, setPhotoIdx] = useState(0);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const paths = postImagePaths(post);
  const own = post.user_id === userId;
  const phone = contactPhone(post.contact);
  const left = daysLeft(post.expires_at);
  const matches = useMemo(() => post.status === "open" ? findMatches(post, posts) : [], [post, posts]);
  const idx = Math.min(photoIdx, Math.max(0, paths.length - 1));

  async function share() {
    const url = boardPostLink(post.id);
    try {
      if (navigator.share) { await navigator.share({ title: post.title, text: `Campus Board: ${post.title}`, url }); return; }
      await navigator.clipboard.writeText(url);
      onToast("Link copied");
    } catch (e) {
      if (e?.name !== "AbortError") onToast("Couldn’t share this post");
    }
  }

  async function copyContact() {
    try {
      await navigator.clipboard.writeText(phone ? `+${phone}` : post.contact);
      onToast(phone ? "Number copied" : "Contact copied");
    } catch {
      onToast("Couldn’t copy — long-press the number instead");
    }
  }

  const waText = encodeURIComponent(`Hi! About your Campus Board post "${post.title}"`);

  return createPortal(
    <div className="board-modal-backdrop" onClick={onClose}>
      <article
        ref={dialogRef}
        {...dialogProps(null, { labelledBy: "board-sheet-title" })}
        className={`board-sheet board-k-${post.kind}${paths.length ? " has-photos" : ""}`}
        onClick={e => e.stopPropagation()}
      >
        <button type="button" className="board-icon-btn board-sheet-close" onClick={onClose} aria-label="Close"><X size={16} /></button>

        {paths.length > 0 && (
          <div className="board-gallery">
            <div className="board-gallery-main">
              <img src={boardImageUrl(paths[idx])} alt={`${post.title} — photo ${idx + 1} of ${paths.length}`} />
              {paths.length > 1 && (
                <>
                  <button type="button" className="board-gallery-nav prev" aria-label="Previous photo" onClick={() => setPhotoIdx((idx - 1 + paths.length) % paths.length)}><ChevronLeft size={18} /></button>
                  <button type="button" className="board-gallery-nav next" aria-label="Next photo" onClick={() => setPhotoIdx((idx + 1) % paths.length)}><ChevronRight size={18} /></button>
                </>
              )}
            </div>
            {paths.length > 1 && (
              <div className="board-gallery-thumbs">
                {paths.map((p, i) => (
                  <button key={p} type="button" aria-label={`Photo ${i + 1}`} aria-current={i === idx} className={i === idx ? "on" : ""} onClick={() => setPhotoIdx(i)}>
                    <img src={boardImageUrl(p)} alt="" loading="lazy" />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="board-sheet-body">
          <div className="board-card-top">
            <KindBadge kind={post.kind} />
            <StatusBadges post={post} isAdmin={isAdmin} />
            <Price post={post} />
          </div>
          <h2 id="board-sheet-title" className="board-sheet-title">{post.title}</h2>
          {post.body && <p className="board-sheet-text">{post.body}</p>}

          <dl className="board-facts">
            {post.location && <div><dt><MapPin size={13} /> {LOCATION_LABELS[post.kind] || "Where"}</dt><dd>{post.location}</dd></div>}
            <div><dt><Clock size={13} /> Posted</dt><dd>{own ? "You" : post.user_name || "Someone"} · {timeAgo(post.created_at)}</dd></div>
            {post.contact && (
              <div>
                <dt><Phone size={13} /> Contact</dt>
                <dd className="board-contact-dd">
                  {phone ? <a href={`tel:+${phone}`}>{formatPhone(phone)}</a> : post.contact}
                  <button type="button" className="board-copy-btn" onClick={copyContact} aria-label={phone ? "Copy phone number" : "Copy contact"} title="Copy"><Copy size={12} /></button>
                </dd>
              </div>
            )}
            {own && <div><dt><RefreshCw size={13} /> Expires</dt><dd>{left <= 0 ? "Today" : `In ${left} day${left === 1 ? "" : "s"}`}</dd></div>}
          </dl>

          {!own && post.status === "open" && post.kind !== 'celebrate' && (
            <div className="board-sheet-cta">
              {pinged
                ? <span className="board-act board-act-done board-act-wide"><Check size={14} /> Pinged — they’ll see it in their notifications</span>
                : <button type="button" className="board-act board-act-primary" onClick={() => onContact(post)}><MessageSquare size={14} /> I’m interested</button>}
              {phone && (
                <>
                  <a className="board-act board-act-wa" href={`https://wa.me/${phone}?text=${waText}`} target="_blank" rel="noopener noreferrer"><MessageCircle size={14} /> WhatsApp</a>
                  <a className="board-act" href={`tel:+${phone}`}><Phone size={14} /> Call</a>
                </>
              )}
            </div>
          )}

          {own && (
            <div className="board-sheet-actions">
              <button type="button" className="board-act" onClick={() => onEdit(post)}><Pencil size={13} /> Edit</button>
              {post.status === "open" && <button type="button" className="board-act" onClick={() => onStatus(post, "resolved")}><Check size={13} /> {post.kind === "sell" ? "Mark sold" : "Mark resolved"}</button>}
              {post.status === "resolved" && <button type="button" className="board-act" onClick={() => onStatus(post, "open")}>Reopen</button>}
              {left <= 7 && <button type="button" className="board-act" onClick={() => onRenew(post)}><RefreshCw size={13} /> Renew 30 days</button>}
              {confirmDelete
                ? <button type="button" className="board-act board-act-danger" onClick={() => onDelete(post)}><Trash2 size={13} /> Confirm delete</button>
                : <button type="button" className="board-act" onClick={() => setConfirmDelete(true)}><Trash2 size={13} /> Delete</button>}
            </div>
          )}

          <div className="board-sheet-foot">
            <button type="button" className="board-act" onClick={share}><Share2 size={13} /> Share</button>
            {!own && post.status === "open" && (
              reported
                ? <span className="board-act board-act-done"><Flag size={12} /> Reported</span>
                : <ReportContentButton type="board_post" contentId={post.id} />
            )}
            {isAdmin && !own && post.status !== "removed" && (
              <button type="button" className="board-act board-act-danger" onClick={() => onStatus(post, "removed")}><ShieldAlert size={12} /> Remove</button>
            )}
            {isAdmin && post.status === "removed" && (
              <button type="button" className="board-act" onClick={() => onStatus(post, "open", { reported_by: [] })}>Restore</button>
            )}
          </div>

          {matches.length > 0 && (
            <section className="board-matches" aria-label="Possible matches">
              <h3><Sparkles size={14} aria-hidden="true" /> Could be a match</h3>
              <p>{post.kind === "lost" ? "Found posts" : "Lost posts"} that mention the same things.</p>
              {matches.map(m => (
                <button key={m.id} type="button" className="board-match" onClick={() => onOpen(m.id)}>
                  <KindBadge kind={m.kind} />
                  <span className="board-match-title">{m.title}</span>
                  <span className="board-match-meta">{m.location ? `${m.location} · ` : ""}{timeAgo(m.created_at)}</span>
                </button>
              ))}
            </section>
          )}

          <CommentThread post={post} userId={userId} userName={userName} isAdmin={isAdmin} onToast={onToast} />
        </div>
      </article>
    </div>,
    document.body
  );
}

// ── Feed card ────────────────────────────────────────────────────────────────

function PostCard({ post, userId, isAdmin, pinged, onOpen, onContact }) {
  const paths = postImagePaths(post);
  const img = boardImageUrl(paths[0]);
  const own = post.user_id === userId;
  // "New" is derived from age, not a stored field — honest freshness, not manufactured urgency
  const isNew = post.status === "open" && isRecent(post.created_at);
  const left = own && post.status === "open" ? daysLeft(post.expires_at) : null;
  const phone = contactPhone(post.contact);
  const waText = phone ? encodeURIComponent(`Hi! About your Campus Board post "${post.title}"`) : "";
  return (
    <article className={`board-card board-k-${post.kind}${post.status !== "open" ? " is-done" : ""}${img ? " has-img" : ""}`}>
      <button type="button" className="board-card-hit" onClick={() => onOpen(post.id)} aria-label={`Open “${post.title}”`} />
      {img && (
        <div className="board-card-img">
          <img src={img} alt="" loading="lazy" />
          <KindBadge kind={post.kind} float />
          {isNew && <span className="board-badge-new">New</span>}
          {paths.length > 1 && <span className="board-photo-count"><Images size={11} /> {paths.length}</span>}
        </div>
      )}
      <div className="board-card-body">
        <div className="board-card-top">
          {!img && <KindBadge kind={post.kind} />}
          {!img && isNew && <span className="board-badge-new board-badge-new-inline">New</span>}
          <StatusBadges post={post} isAdmin={isAdmin} />
          <Price post={post} />
        </div>
        <h3 className="board-card-title">{post.title}</h3>
        {post.body && <p className="board-card-text">{post.body}</p>}
        <div className="board-card-meta">
          {post.location && <span className="board-card-loc"><MapPin size={11} aria-hidden="true" /> {post.location}</span>}
          {post.contact && post.status === "open" && <span className="board-card-loc"><Phone size={11} aria-hidden="true" /> {contactPhone(post.contact) ? formatPhone(contactPhone(post.contact)) : post.contact}</span>}
          <span>{own ? "You" : post.user_name || "Someone"} · {timeAgo(post.created_at)}</span>
          {post.comment_count > 0 && <span className="board-card-comments" aria-label={`${post.comment_count} comment${post.comment_count === 1 ? "" : "s"}`}><MessageSquare size={11} aria-hidden="true" /> {post.comment_count}</span>}
        </div>
        {(own || post.status === "open") && (
          <div className="board-card-actions">
            {own ? (
              <>
                <span className="board-own-tag">Your post</span>
                {left != null && left <= 5 && <span className="board-expiry"><Clock size={11} /> {left <= 0 ? "Expires today" : `${left}d left`}</span>}
              </>
            ) : post.kind === 'celebrate' ? (
              <span className="board-act"><MessageSquare size={13} /> Read wishes &amp; comments</span>
            ) : (
              <>
                {phone && (
                  <a
                    className="board-act board-act-wa"
                    href={`https://wa.me/${phone}?text=${waText}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    title={`WhatsApp ${post.user_name || "poster"}`}
                  >
                    <MessageCircle size={13} /> WhatsApp
                  </a>
                )}
                {pinged ? (
                  <span className="board-act board-act-done"><Check size={13} /> Pinged</span>
                ) : (
                  <button type="button" className="board-act board-act-primary" onClick={(e) => { e.stopPropagation(); onContact(post); }}>
                    <MessageSquare size={13} /> I&rsquo;m interested
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </article>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function BoardPage({ userId, userName, isAdmin, initialKind }) {
  const [posts, setPosts] = useState(null); // null = loading, [] = empty
  const [filter, setFilter] = useState(BOARD_KINDS.some(kind => kind.id === initialKind) ? initialKind : 'all'); // all | kind | mine | reported (admin)
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("new");
  const [showDone, setShowDone] = useState(false);
  const [composer, setComposer] = useState(null); // null | { post?: row }
  const [openId, setOpenId] = useState(null);
  const reportedKey = `pgp2.board.reported.${userId}`;
  const pingedKey = `pgp2.board.pinged.${userId}`;
  const [reported, setReported] = useState(() => loadIdSet(reportedKey)); // post ids I reported
  const [pinged, setPinged] = useState(() => loadIdSet(pingedKey));       // post ids I contacted
  useEffect(() => { saveIdSet(reportedKey, reported); }, [reportedKey, reported]);
  useEffect(() => { saveIdSet(pingedKey, pinged); }, [pingedKey, pinged]);
  const [toast, setToast] = useState(null);
  const pendingOpenRef = useRef(takeInitialBoardPost());
  const toastTimer = useRef(null);

  const reload = useRef(null);
  useEffect(() => {
    let alive = true;
    const load = () => fetchBoardPosts().then(rows => { if (alive && rows) setPosts(rows); });
    reload.current = load;
    load();
    const unsub = subscribeBoard(load);
    const interval = setInterval(load, 30000);
    const t = setTimeout(() => { if (alive) setPosts(p => p ?? []); }, 4000); // offline fallback
    return () => { alive = false; unsub(); clearInterval(interval); clearTimeout(t); clearTimeout(toastTimer.current); };
  }, []);

  function showToast(msg) {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2600);
  }

  // Deep link (?view=board&post=<id>) — open once the feed has loaded.
  useEffect(() => {
    const id = pendingOpenRef.current;
    if (!id || !posts) return;
    pendingOpenRef.current = null;
    if (posts.some(p => p.id === id)) setOpenId(id);
    else showToast("That post is no longer on the board");
  }, [posts]);

  const openPost = posts?.find(p => p.id === openId) || null;

  // Optimistic write: apply locally, refetch to undo if the server refuses.
  async function mutate(apply, call, failMsg = "Couldn’t update — try again") {
    setPosts(prev => apply(prev || []));
    const ok = await call();
    if (!ok) { showToast(failMsg); reload.current?.(); }
    return ok;
  }

  const handleStatus = (post, status, extra = {}) =>
    mutate(prev => prev.map(x => x.id === post.id ? { ...x, status, ...extra } : x), () => setBoardPostStatus(post.id, status, extra));

  async function handleRenew(post) {
    const expires = await renewBoardPost(post.id);
    if (!expires) { showToast("Couldn’t renew — try again"); return; }
    setPosts(prev => prev.map(x => x.id === post.id ? { ...x, expires_at: expires } : x));
    showToast("Renewed for 30 more days");
  }

  async function handleDelete(post) {
    setOpenId(null);
    const ok = await mutate(prev => prev.filter(x => x.id !== post.id), () => deleteBoardPost(post), "Couldn’t delete — try again");
    if (ok) showToast("Post deleted");
  }

  async function handleReport(post) {
    setReported(prev => new Set(prev).add(post.id));
    const count = await reportBoardPost(post.id);
    showToast(count == null ? "Couldn’t send report — try again" : "Thanks — reported to moderators");
  }

  async function handleContact(post) {
    setPinged(prev => new Set(prev).add(post.id));
    await contactPoster(post, userId, userName);
  }

  const live = useMemo(() => (posts || []).filter(p => {
    const reportCount = Array.isArray(p.reported_by) ? p.reported_by.length : 0;
    if (!isAdmin && p.status === "removed" && p.user_id !== userId) return false;
    if (!isAdmin && reportCount >= 3 && p.user_id !== userId) return false; // belt & braces with the RPC auto-hide
    return true;
  }), [posts, isAdmin, userId]);

  const q = query.trim().toLowerCase();
  const visiblePosts = useMemo(() => {
    const rows = live.filter(p => {
      const reportCount = Array.isArray(p.reported_by) ? p.reported_by.length : 0;
      if (filter === "reported") return reportCount > 0 || p.status === "removed";
      if (filter === "mine") { if (p.user_id !== userId) return false; }
      else {
        if (p.status === "removed") return false;
        if (p.status === "resolved" && !showDone) return false;
        if (filter !== "all" && p.kind !== filter) return false;
      }
      if (q && !`${p.title} ${p.body || ""} ${p.location || ""} ${p.user_name || ""}`.toLowerCase().includes(q)) return false;
      return true;
    });
    if (sort === "new") return rows;
    const dir = sort === "price-asc" ? 1 : -1;
    // Unpriced posts sink to the end either way.
    return [...rows].sort((a, b) => (a.price == null) - (b.price == null) || dir * ((a.price ?? 0) - (b.price ?? 0)));
  }, [live, filter, showDone, q, sort, userId]);

  const openCount = live.filter(p => p.status === "open").length;
  const resolvedCount = live.filter(p => p.status === "resolved").length;
  const mineCount = live.filter(p => p.user_id === userId).length;
  const reportedCount = isAdmin ? live.filter(p => (p.reported_by?.length || 0) > 0 || p.status === "removed").length : 0;
  const kindCounts = useMemo(() => Object.fromEntries(BOARD_KINDS.map(k => [k.id, live.filter(p => p.status === "open" && p.kind === k.id).length])), [live]);
  const feedTitle = q ? `Results for “${query.trim()}”`
    : filter === "all" ? "Latest from campus"
    : filter === "reported" ? "Moderation queue"
    : filter === "mine" ? "Your posts"
    : KIND_META[filter]?.label || "Campus posts";
  const priceSortable = filter === "all" || filter === "sell" || filter === "ask" || filter === "mine";

  return (
    <div className="board-pg">
      <section className="board-hero">
        <div className="board-head">
          <div className="board-head-title">
            <span className="board-eyebrow">Batch community</span>
            <h1>Campus Board</h1>
            <p>Find what went missing, pass things on, or ask the batch for help.</p>
          </div>
          <button className="board-new-btn" onClick={() => setComposer({})}>
            <Plus size={16} /> Create post
          </button>
        </div>
        <div className="board-hero-meta" aria-label="Board summary">
          <div><strong>{openCount}</strong><span>Live posts</span></div>
          <div><strong>{resolvedCount}</strong><span>Sorted out</span></div>
          <button type="button" className={filter === "mine" ? "on" : ""} onClick={() => setFilter(f => f === "mine" ? "all" : "mine")} aria-pressed={filter === "mine"}>
            <strong>{mineCount}</strong><span>Your posts</span>
          </button>
        </div>
      </section>

      <section className="board-feed">
        {filter === 'celebrate' && <div className="board-celebrate-intro"><Sparkles size={20} aria-hidden="true" /><div><h2>A little light, shared with campus.</h2><p>Diwali wishes, rangoli, and moments worth keeping. Add a wish or a photo; existing comments, reporting, and moderation apply.</p></div></div>}
        <div className="board-toolbar">
          <label className="board-search">
            <Search size={15} aria-hidden="true" />
            <input type="search" placeholder="Search posts, places, people…" value={query} onChange={e => setQuery(e.target.value)} aria-label="Search the board" />
            {query && <button type="button" className="board-search-clear" onClick={() => setQuery("")} aria-label="Clear search"><X size={13} /></button>}
          </label>
          <select className="board-sort" value={priceSortable ? sort : "new"} onChange={e => setSort(e.target.value)} aria-label="Sort posts" disabled={!priceSortable}>
            {SORTS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </div>

        <div className="board-chips" role="group" aria-label="Filter campus posts">
          <button aria-pressed={filter === "all"} className={`board-chip${filter === "all" ? " on" : ""}`} onClick={() => setFilter("all")}>All <span>{openCount}</span></button>
          {BOARD_KINDS.map(k => (
            <button key={k.id} aria-pressed={filter === k.id} className={`board-chip board-k-${k.id}${filter === k.id ? " on" : ""}`} onClick={() => setFilter(k.id)}>
              <KindIcon kind={k.id} size={13} /> {k.label} <span>{kindCounts[k.id]}</span>
            </button>
          ))}
          {mineCount > 0 && (
            <button aria-pressed={filter === "mine"} className={`board-chip${filter === "mine" ? " on" : ""}`} onClick={() => setFilter("mine")}>Mine <span>{mineCount}</span></button>
          )}
          {isAdmin && reportedCount > 0 && (
            <button aria-pressed={filter === "reported"} className={`board-chip board-chip-reported${filter === "reported" ? " on" : ""}`} onClick={() => setFilter("reported")}>
              <ShieldAlert size={12} /> Reported <span>{reportedCount}</span>
            </button>
          )}
        </div>

        <div className="board-feed-head">
          <h2>{feedTitle}</h2>
          <div className="board-feed-side">
            <span>{visiblePosts.length} {visiblePosts.length === 1 ? "post" : "posts"}</span>
            {filter !== "mine" && filter !== "reported" && resolvedCount > 0 && (
              <button type="button" className={`board-toggle${showDone ? " on" : ""}`} aria-pressed={showDone} onClick={() => setShowDone(v => !v)}>
                <CheckCircle2 size={12} /> {showDone ? "Hide" : "Show"} resolved
              </button>
            )}
          </div>
        </div>

        {posts === null ? (
          <div className="board-grid">
            {[0, 1, 2, 3].map(i => <div key={i} className="board-card board-card-skeleton" style={{ opacity: 1 - i * 0.16 }} />)}
          </div>
        ) : visiblePosts.length === 0 ? (
          <div className="board-empty">
            <div className="board-empty-ico">{q ? <Search size={24} /> : <Package size={24} />}</div>
            <div>
              <h3>{q ? "Nothing matches that" : filter === "all" ? "The board is open" : filter === "mine" ? "You haven’t posted yet" : `No ${filter === "reported" ? "reported" : KIND_META[filter]?.label?.toLowerCase()} posts`}</h3>
              <p>{q ? "Try fewer words, or post it yourself so others can find you." : filter === "all" ? "Be the first to share something with the batch." : "Try another category or create a new post."}</p>
            </div>
            <button className="board-new-btn" onClick={() => setComposer({})}><Plus size={14} /> Create post</button>
          </div>
        ) : (
          <div className="board-grid">
            {visiblePosts.map(p => (
              <PostCard key={p.id} post={p} userId={userId} isAdmin={isAdmin} pinged={pinged.has(p.id)} onOpen={setOpenId} onContact={handleContact} />
            ))}
          </div>
        )}
      </section>

      {openPost && (
        <PostSheet
          key={openPost.id}
          post={openPost}
          posts={live}
          userId={userId}
          userName={userName}
          isAdmin={isAdmin}
          pinged={pinged.has(openPost.id)}
          reported={reported.has(openPost.id)}
          onContact={handleContact}
          onReport={handleReport}
          onStatus={handleStatus}
          onRenew={handleRenew}
          onDelete={handleDelete}
          onEdit={(post) => setComposer({ post })}
          onOpen={setOpenId}
          onToast={showToast}
          onClose={() => setOpenId(null)}
        />
      )}

      {composer && (
        <BoardComposer
          initialKind={filter === 'celebrate' ? 'celebrate' : undefined}
          userId={userId}
          userName={userName}
          post={composer.post}
          onClose={() => setComposer(null)}
          onSaved={(row) => {
            const editing = !!composer.post;
            setComposer(null);
            setPosts(prev => editing ? (prev || []).map(x => x.id === row.id ? row : x) : [row, ...(prev || [])]);
            showToast(editing ? "Changes saved" : "Posted to the board");
          }}
        />
      )}

      {toast && <div className="board-toast" role="status">{toast}</div>}
    </div>
  );
}
