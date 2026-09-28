import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Package, Plus, X, Check, Flag, Trash2, MessageSquare, Phone, ImagePlus, ShieldAlert, CheckCircle2, IndianRupee, Search, Backpack, Tag, Megaphone } from "lucide-react";
import {
  BOARD_KINDS, fetchBoardPosts, createBoardPost, boardImageUrl, resizeImage,
  setBoardPostStatus, deleteBoardPost, reportBoardPost, contactPoster, subscribeBoard,
} from "../lib/board.js";
import "../styles/board.css";

// Campus Board — cohort lost & found + buy/sell. Feed is Supabase-backed with
// realtime refresh; moderation is report-to-hide (3 reports) plus admin
// remove/delete on any card.

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

const KIND_META = Object.fromEntries(BOARD_KINDS.map(k => [k.id, k]));

const KIND_ICONS = {
  lost: Search,
  found: Backpack,
  sell: Tag,
  ask: Megaphone,
};

function KindIcon({ kind, size = 14, className = "" }) {
  const Icon = KIND_ICONS[kind] || Package;
  return <Icon size={size} className={className} style={{ marginRight: 6, verticalAlign: "-2px" }} />;
}

function BoardComposer({ userId, userName, onCreated, onClose }) {
  const [kind, setKind] = useState("lost");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [price, setPrice] = useState("");
  const [contact, setContact] = useState("");
  const [imageFile, setImageFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  async function handleFile(f) {
    if (!f || !f.type.startsWith("image/")) return;
    if (f.size > 15 * 1024 * 1024) {
      alert("This image is too large (max 15MB). Please choose a smaller one.");
      return;
    }
    if (preview) URL.revokeObjectURL(preview);
    const tempUrl = URL.createObjectURL(f);
    setPreview(tempUrl);
    // Background compress immediately so the post is faster
    try {
      const blob = await resizeImage(f);
      setImageFile(blob);
    } catch (e) {
      console.error("Compression failed", e);
      setImageFile(f);
    }
  }

  function pickImage(e) {
    handleFile(e.target.files?.[0]);
  }

  function onPaste(e) {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) { handleFile(file); e.preventDefault(); break; }
      }
    }
  }

  function onDrop(e) {
    e.preventDefault();
    const file = e.dataTransfer?.files?.[0];
    if (file) handleFile(file);
  }

  function onDragOver(e) {
    e.preventDefault();
  }

  async function submit(e) {
    e.preventDefault();
    if (!title.trim() || busy) return;
    setBusy(true);
    setFailed(false);
    const row = await createBoardPost({ userId, userName, kind, title, body, price, contact, imageFile });
    setBusy(false);
    if (!row) { setFailed(true); return; }
    onCreated(row);
  }

  const showPrice = kind === "sell" || kind === "ask";

  return createPortal(
    <div className="board-modal-backdrop" onClick={onClose}>
      <form 
        className="board-composer" 
        onClick={e => e.stopPropagation()} 
        onSubmit={submit}
        onPaste={onPaste}
        onDrop={onDrop}
        onDragOver={onDragOver}
      >
        <div className="board-composer-head">
          <div>
            <span className="board-eyebrow">Campus Board</span>
            <h3><Package size={18} /> Create a post</h3>
            <p>Share it with your batch for the next 30 days.</p>
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
          <input className="board-input" placeholder={kind === "lost" ? "What did you lose?" : kind === "found" ? "What did you find?" : kind === "sell" ? "What are you selling?" : "What are you looking for?"} maxLength={80} value={title} onChange={e => setTitle(e.target.value)} autoFocus />
        </label>
        <label className="board-field">
          <span className="board-field-label">Details <em>Optional</em></span>
          <textarea className="board-input board-textarea" placeholder="Add where, when, condition, or anything useful…" maxLength={500} rows={3} value={body} onChange={e => setBody(e.target.value)} />
          <span className="board-char-count">{body.length}/500</span>
        </label>

        <div className="board-composer-row">
          {showPrice && (
            <label className="board-field board-price-field">
              <span className="board-field-label">{kind === "ask" ? "Budget" : "Price"}</span>
              <div className="board-price-wrap"><IndianRupee size={13} /><input className="board-input board-price" type="number" min="0" placeholder="0" value={price} onChange={e => setPrice(e.target.value)} /></div>
            </label>
          )}
          <label className="board-field board-contact-field">
            <span className="board-field-label">Contact <em>Optional</em></span>
            <input className="board-input" placeholder="Room or phone" maxLength={80} value={contact} onChange={e => setContact(e.target.value)} />
          </label>
        </div>

        <div className="board-photo-row">
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={pickImage} />
          <button type="button" className="board-img-btn" onClick={() => fileRef.current?.click()}>
            <ImagePlus size={14} /> {imageFile ? "Change photo" : "Add photo"}
          </button>
          {preview && (
            <span className="board-img-preview">
              <img src={preview} alt="" />
              <button type="button" className="board-icon-btn" aria-label="Remove photo" onClick={() => { URL.revokeObjectURL(preview); setPreview(null); setImageFile(null); if (fileRef.current) fileRef.current.value = ""; }}><X size={12} /></button>
            </span>
          )}
        </div>

        {failed && <div className="board-error">Couldn&rsquo;t post — check your connection and try again.</div>}

        <div className="board-composer-footer">
          <p className="board-composer-note">No contact added? People can still reach you with an in-app ping.</p>
          <button type="submit" className="board-submit" disabled={!title.trim() || busy} aria-busy={busy}>
            {busy ? "Posting…" : "Post to board"}
          </button>
        </div>
      </form>
    </div>,
    document.body
  );
}

export default function BoardPage({ userId, userName, isAdmin }) {
  const [posts, setPosts] = useState(null); // null = loading, [] = empty
  const [filter, setFilter] = useState("all"); // all | kind | reported (admin)
  const [composerOpen, setComposerOpen] = useState(false);
  const [reported, setReported] = useState(() => new Set()); // post ids I reported this session
  const [pinged, setPinged] = useState(() => new Set());     // post ids I contacted this session
  const [confirmDelete, setConfirmDelete] = useState(null);

  useEffect(() => {
    let alive = true;
    const load = () => fetchBoardPosts().then(rows => { if (alive && rows) setPosts(rows); });
    load();
    const unsub = subscribeBoard(load);
    const t = setTimeout(() => { if (alive) setPosts(p => p ?? []); }, 4000); // offline fallback
    return () => { alive = false; unsub(); clearTimeout(t); };
  }, []);

  const visiblePosts = useMemo(() => {
    if (!posts) return [];
    return posts.filter(p => {
      const reportCount = Array.isArray(p.reported_by) ? p.reported_by.length : 0;
      if (!isAdmin && p.status === "removed") return false;
      if (!isAdmin && reportCount >= 3) return false; // belt & braces with the RPC auto-hide
      if (filter === "reported") return reportCount > 0 || p.status === "removed";
      if (p.status === "removed" && filter !== "reported") return false;
      return filter === "all" || p.kind === filter;
    });
  }, [posts, filter, isAdmin]);

  const openCount = posts?.filter(p => p.status === "open").length ?? 0;
  const reportedCount = isAdmin ? (posts?.filter(p => (p.reported_by?.length || 0) > 0 || p.status === "removed").length ?? 0) : 0;
  const kindCounts = useMemo(() => Object.fromEntries(BOARD_KINDS.map(k => [k.id, posts?.filter(p => p.status === "open" && p.kind === k.id).length ?? 0])), [posts]);
  const feedTitle = filter === "all" ? "Latest from campus" : filter === "reported" ? "Moderation queue" : KIND_META[filter]?.label || "Campus posts";

  async function handleReport(post) {
    setReported(prev => new Set(prev).add(post.id));
    await reportBoardPost(post.id);
  }

  async function handleContact(post) {
    setPinged(prev => new Set(prev).add(post.id));
    await contactPoster(post, userId, userName);
  }

  return (
    <div className="board-pg">
      <section className="board-hero">
        <div className="board-head">
          <div className="board-head-title">
            <span className="board-eyebrow">Batch community</span>
            <h1>Campus Board</h1>
            <p>Find what went missing, pass things on, or ask the batch for help.</p>
          </div>
          <button className="board-new-btn" onClick={() => setComposerOpen(true)}>
            <Plus size={16} /> Create post
          </button>
        </div>
        <div className="board-hero-meta" aria-label="Board summary">
          <div><strong>{openCount}</strong><span>Live posts</span></div>
          <div><strong>{BOARD_KINDS.length}</strong><span>Categories</span></div>
          <div><strong>30d</strong><span>Post lifetime</span></div>
        </div>
      </section>

      <section className="board-feed">
        <div className="board-feed-head">
          <div><span className="board-eyebrow">Browse</span><h2>{feedTitle}</h2></div>
          <span>{visiblePosts.length} {visiblePosts.length === 1 ? "post" : "posts"}</span>
        </div>

        <div className="board-chips" role="group" aria-label="Filter campus posts">
          <button aria-pressed={filter === "all"} className={`board-chip${filter === "all" ? " on" : ""}`} onClick={() => setFilter("all")}>All <span>{openCount}</span></button>
          {BOARD_KINDS.map(k => (
            <button key={k.id} aria-pressed={filter === k.id} className={`board-chip board-k-${k.id}${filter === k.id ? " on" : ""}`} onClick={() => setFilter(k.id)}>
              <KindIcon kind={k.id} size={13} /> {k.label} <span>{kindCounts[k.id]}</span>
            </button>
          ))}
          {isAdmin && reportedCount > 0 && (
            <button aria-pressed={filter === "reported"} className={`board-chip board-chip-reported${filter === "reported" ? " on" : ""}`} onClick={() => setFilter("reported")}>
              <ShieldAlert size={12} /> Reported <span>{reportedCount}</span>
            </button>
          )}
        </div>

      {posts === null ? (
        <div className="board-grid">
          {[0, 1, 2, 3].map(i => <div key={i} className="board-card board-card-skeleton" style={{ opacity: 1 - i * 0.16 }} />)}
        </div>
      ) : visiblePosts.length === 0 ? (
        <div className="board-empty">
          <div className="board-empty-ico"><Package size={24} /></div>
          <div><h3>{filter === "all" ? "The board is open" : `No ${filter === "reported" ? "reported" : KIND_META[filter]?.label?.toLowerCase()} posts`}</h3><p>{filter === "all" ? "Be the first to share something with the batch." : "Try another category or create a new post."}</p></div>
          <button className="board-new-btn" onClick={() => setComposerOpen(true)}><Plus size={14} /> Create post</button>
        </div>
      ) : (
        <div className="board-grid">
          {visiblePosts.map((p) => {
            const meta = KIND_META[p.kind] || KIND_META.lost;
            const img = boardImageUrl(p.image_path);
            const own = p.user_id === userId;
            const reportCount = Array.isArray(p.reported_by) ? p.reported_by.length : 0;
            // "New" is derived from age, not a stored field — honest freshness, not manufactured urgency
            const isNew = p.status === "open" && isRecent(p.created_at);
            return (
              <article key={p.id} className={`board-card board-k-${p.kind}${p.status !== "open" ? " is-done" : ""}`}>
                {img && (
                  <div className="board-card-img">
                    <img src={img} alt="" loading="lazy" />
                    <span className={`board-kind-badge board-kind-badge-float board-k-${p.kind}`}><KindIcon kind={p.kind} size={12} /> {meta.label}</span>
                    {isNew && <span className="board-badge-new">New</span>}
                  </div>
                )}
                <div className="board-card-body">
                  <div className="board-card-top">
                    {!img && <span className={`board-kind-badge board-k-${p.kind}`}><KindIcon kind={p.kind} size={12} /> {meta.label}</span>}
                    {!img && isNew && <span className="board-badge-new board-badge-new-inline">New</span>}
                    {p.status === "resolved" && <span className="board-status-badge"><CheckCircle2 size={11} /> Resolved</span>}
                    {p.status === "removed" && <span className="board-status-badge board-removed-badge"><ShieldAlert size={11} /> Removed</span>}
                    {isAdmin && reportCount > 0 && p.status !== "removed" && (
                      <span className="board-status-badge board-removed-badge"><Flag size={10} /> {reportCount}</span>
                    )}
                    {p.price != null && <span className="board-price-tag">₹{p.price}</span>}
                  </div>
                  <h3 className="board-card-title">{p.title}</h3>
                  {p.body && <p className="board-card-text">{p.body}</p>}
                  <div className="board-card-meta">
                    <span>{own ? "You" : p.user_name || "Someone"}</span>
                    <span>·</span>
                    <span>{timeAgo(p.created_at)}</span>
                  </div>
                  <div className="board-card-actions">
                    {own ? (
                      <>
                        {p.status === "open" && (
                          <button className="board-act" onClick={() => { setPosts(prev => prev.map(x => x.id === p.id ? { ...x, status: "resolved" } : x)); setBoardPostStatus(p.id, "resolved"); }}>
                            <Check size={13} /> Mark resolved
                          </button>
                        )}
                        {p.status === "resolved" && (
                          <button className="board-act" onClick={() => { setPosts(prev => prev.map(x => x.id === p.id ? { ...x, status: "open" } : x)); setBoardPostStatus(p.id, "open"); }}>
                            Reopen
                          </button>
                        )}
                        {confirmDelete === p.id ? (
                          <button className="board-act board-act-danger" onClick={() => { setPosts(prev => prev.filter(x => x.id !== p.id)); deleteBoardPost(p); }}>
                            <Trash2 size={13} /> Confirm delete
                          </button>
                        ) : (
                          <button className="board-act" onClick={() => setConfirmDelete(p.id)}><Trash2 size={13} /> Delete</button>
                        )}
                      </>
                    ) : (
                      <>
                        {p.status === "open" && (
                          pinged.has(p.id)
                            ? <span className="board-act board-act-done"><Check size={13} /> Pinged</span>
                            : <button className="board-act board-act-primary" onClick={() => handleContact(p)}>
                                <MessageSquare size={13} /> I&rsquo;m interested
                              </button>
                        )}
                        {p.contact && <span className="board-contact"><Phone size={12} /> {p.contact}</span>}
                        {!reported.has(p.id) && p.status === "open" && (
                          <button className="board-act board-act-flag" title="Report this post" aria-label="Report this post" onClick={() => handleReport(p)}>
                            <Flag size={12} />
                          </button>
                        )}
                        {reported.has(p.id) && <span className="board-act board-act-done"><Flag size={12} /> Reported</span>}
                        {isAdmin && p.status !== "removed" && (
                          <button className="board-act board-act-danger" onClick={() => { setPosts(prev => prev.map(x => x.id === p.id ? { ...x, status: "removed" } : x)); setBoardPostStatus(p.id, "removed"); }}>
                            <ShieldAlert size={12} /> Remove
                          </button>
                        )}
                        {isAdmin && p.status === "removed" && (
                          <button className="board-act" onClick={() => { setPosts(prev => prev.map(x => x.id === p.id ? { ...x, status: "open", reported_by: [] } : x)); setBoardPostStatus(p.id, "open", { reported_by: [] }); }}>
                            Restore
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
      </section>

      {composerOpen && (
        <BoardComposer
          userId={userId}
          userName={userName}
          onClose={() => setComposerOpen(false)}
          onCreated={(row) => { setComposerOpen(false); setPosts(prev => [row, ...(prev || [])]); }}
        />
      )}
    </div>
  );
}
