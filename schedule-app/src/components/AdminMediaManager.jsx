import { useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabase.js';
import { hasAdminCapability } from '../lib/adminCapabilities.js';
import { Image, Trash2, RefreshCw, Search, X, ExternalLink, AlertTriangle, HardDrive, ChevronRight, Download, Check, Copy } from 'lucide-react';

// ── Admin Media Manager ──────────────────────────────────────────────────────
// Browse, inspect, and delete files in the `board-images` Supabase storage
// bucket. Lives inside the Database tab alongside the operational search panel.
//
// Media is listed by folder (each folder = one user's uploads). Admins can
// preview images, see which board post they belong to (by cross-referencing
// image_path / image_paths), and delete files (e.g. after a moderation action).
//
// Capabilities: data.read to list; moderation.write to delete.

const BUCKET = 'board-images';
const PAGE_SIZE = 50;

function formatBytes(bytes) {
  if (bytes == null) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function timeAgo(iso) {
  if (!iso) return '—';
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export default function AdminMediaManager({ role }) {
  const canRead = hasAdminCapability(role, 'data.read');
  const canDelete = hasAdminCapability(role, 'moderation.write');

  // Folder listing (top-level = user id folders)
  const [folders, setFolders] = useState(null);       // null = loading
  const [selectedFolder, setSelectedFolder] = useState(null); // user-id string or null (all)
  const [files, setFiles] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(null);      // file object for inspector
  const [deleting, setDeleting] = useState(null);       // path being deleted
  const [confirmDelete, setConfirmDelete] = useState(null); // path awaiting confirm
  const [toast, setToast] = useState('');
  const [postMap, setPostMap] = useState({});           // path → post title
  const [stats, setStats] = useState(null);             // { totalFiles, totalBytes }
  const [copyStatus, setCopyStatus] = useState('');
  const toastTimer = useRef(null);

  function showToast(msg) {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 3000);
  }

  // Load folder listing
  async function loadFolders() {
    setError('');
    try {
      const { data, error: err } = await supabase.storage.from(BUCKET).list('', {
        limit: 500,
        sortBy: { column: 'name', order: 'asc' },
      });
      if (err) throw err;
      // Folders show up as items with metadata = null in Supabase storage list
      const dirs = (data || []).filter(item => item.id === null || item.metadata === null);
      setFolders(dirs.map(d => d.name));
    } catch (e) {
      setError(e.message || 'Failed to load folders');
      setFolders([]);
    }
  }

  // Load files in a folder (or all folders)
  async function loadFiles(folder) {
    setLoading(true);
    setError('');
    setFiles(null);
    try {
      if (folder) {
        const { data, error: err } = await supabase.storage.from(BUCKET).list(folder, {
          limit: PAGE_SIZE,
          sortBy: { column: 'created_at', order: 'desc' },
        });
        if (err) throw err;
        const items = (data || []).filter(f => f.name && f.metadata).map(f => ({
          ...f,
          path: `${folder}/${f.name}`,
          folder,
        }));
        setFiles(items);
      } else {
        // Load files from all folders (first PAGE_SIZE across first folders)
        const all = [];
        for (const dir of (folders || []).slice(0, 100)) {
          const { data } = await supabase.storage.from(BUCKET).list(dir, {
            limit: 20,
            sortBy: { column: 'created_at', order: 'desc' },
          });
          if (data) {
            all.push(...data.filter(f => f.name && f.metadata).map(f => ({
              ...f,
              path: `${dir}/${f.name}`,
              folder: dir,
            })));
          }
          if (all.length >= PAGE_SIZE) break;
        }
        setFiles(all.slice(0, PAGE_SIZE));
      }
    } catch (e) {
      setError(e.message || 'Failed to load files');
      setFiles([]);
    } finally {
      setLoading(false);
    }
  }

  // Cross-reference files with board_posts to find which post uses each image
  async function loadPostMap() {
    try {
      const { data } = await supabase
        .from('board_posts')
        .select('title, image_path, image_paths')
        .not('image_path', 'is', null);
      if (!data) return;
      const map = {};
      for (const post of data) {
        if (post.image_path) map[post.image_path] = post.title;
        if (Array.isArray(post.image_paths)) {
          for (const p of post.image_paths) {
            if (p) map[p] = post.title;
          }
        }
      }
      setPostMap(map);
    } catch { /* non-critical */ }
  }

  // Calculate bucket stats
  useEffect(() => {
    if (!files) return;
    const totalFiles = files.length;
    const totalBytes = files.reduce((sum, f) => sum + (f.metadata?.size || 0), 0);
    setStats({ totalFiles, totalBytes });
  }, [files]);

  // Initial load
  useEffect(() => {
    if (!canRead) return;
    loadFolders();
    loadPostMap();
    return () => clearTimeout(toastTimer.current);
  }, [canRead]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load files when folder changes
  useEffect(() => {
    if (!canRead || !folders) return;
    loadFiles(selectedFolder);
  }, [selectedFolder, folders, canRead]); // eslint-disable-line react-hooks/exhaustive-deps

  async function deleteFile(path) {
    setDeleting(path);
    setError('');
    try {
      const { error: err } = await supabase.storage.from(BUCKET).remove([path]);
      if (err) throw err;
      setFiles(prev => (prev || []).filter(f => f.path !== path));
      if (selected?.path === path) setSelected(null);
      setConfirmDelete(null);
      showToast('File deleted');
    } catch (e) {
      setError(e.message || 'Failed to delete file');
    } finally {
      setDeleting(null);
    }
  }

  function getPublicUrl(path) {
    return supabase.storage.from(BUCKET).getPublicUrl(path).data?.publicUrl || null;
  }

  async function copyUrl(path) {
    const url = getPublicUrl(path);
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopyStatus(path);
      setTimeout(() => setCopyStatus(''), 2000);
    } catch { showToast("Couldn't copy URL"); }
  }

  const filteredFiles = (files || []).filter(f => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    const postTitle = postMap[f.path] || '';
    return f.name.toLowerCase().includes(q)
      || f.path.toLowerCase().includes(q)
      || postTitle.toLowerCase().includes(q);
  });

  if (!canRead) {
    return (
      <section className="admin-card admin-ops-panel admin-span-all admin-g-database" aria-label="Media manager">
        <h2><Image size={20} /> Media manager</h2>
        <p>You don't have permission to view storage media. A <em>superadmin</em> or <em>data.read</em> role is required.</p>
      </section>
    );
  }

  return (
    <section className="admin-card admin-ops-panel admin-span-all admin-g-database admin-media-manager" aria-label="Media manager" style={{ minWidth: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
        <div>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Image size={20} /> Media manager</h2>
          <p style={{ margin: '4px 0 0', opacity: 0.7 }}>Browse and manage images in the <code>board-images</code> storage bucket. Cross-referenced with board posts.</p>
        </div>
        <button
          type="button"
          onClick={() => { loadFolders(); loadPostMap(); setSelected(null); }}
          disabled={loading}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', color: 'inherit', fontSize: 13, fontWeight: 600 }}
        >
          <RefreshCw size={14} className={loading ? 'spin-icon' : ''} /> Refresh
        </button>
      </div>

      {/* Stats bar */}
      {stats && (
        <div style={{ display: 'flex', gap: 20, margin: '12px 0 4px', fontSize: 13 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <HardDrive size={13} /> <strong>{stats.totalFiles}</strong> files loaded
          </span>
          <span><strong>{formatBytes(stats.totalBytes)}</strong> total</span>
          {folders && <span><strong>{folders.length}</strong> user folders</span>}
        </div>
      )}

      {/* Folder picker + search bar */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '10px 0' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
          Folder
          <select
            value={selectedFolder || ''}
            onChange={e => { setSelectedFolder(e.target.value || null); setSelected(null); setQuery(''); }}
            style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--card)', color: 'inherit', fontSize: 13 }}
          >
            <option value="">All folders</option>
            {(folders || []).map(f => <option key={f} value={f}>{f}</option>)}
          </select>
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 180, position: 'relative' }}>
          <Search size={14} />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search by filename or post title…"
            style={{ padding: '6px 28px 6px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--card)', color: 'inherit', fontSize: 13, width: '100%' }}
          />
          {query && (
            <button type="button" onClick={() => setQuery('')} aria-label="Clear search" style={{ position: 'absolute', right: 6, background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: 2 }}>
              <X size={14} />
            </button>
          )}
        </label>
        <span style={{ fontSize: 12, color: 'var(--text-dim)', alignSelf: 'center' }}>
          {filteredFiles.length} of {(files || []).length} files
        </span>
      </div>

      {error && <p role="alert" style={{ color: 'var(--danger)', fontSize: 13 }}><AlertTriangle size={13} /> {error}</p>}

      {/* File grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10, margin: '8px 0' }}>
        {loading && !files && (
          <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: 40, opacity: 0.6 }}>
            <RefreshCw size={22} className="spin-icon" /><br />Loading media…
          </div>
        )}
        {files && filteredFiles.length === 0 && (
          <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: 40, opacity: 0.6 }}>
            {query ? 'No files match your search.' : 'No files in this folder.'}
          </div>
        )}
        {filteredFiles.map(f => {
          const url = getPublicUrl(f.path);
          const linkedPost = postMap[f.path];
          const isOrphan = !linkedPost;
          const isSelected = selected?.path === f.path;
          return (
            <button
              type="button"
              key={f.path}
              onClick={() => { setSelected(f); setCopyStatus(''); }}
              style={{
                position: 'relative',
                border: isSelected ? '2px solid var(--blue-text, #3b82f6)' : '1px solid var(--border)',
                borderRadius: 10,
                overflow: 'hidden',
                background: 'var(--card)',
                cursor: 'pointer',
                padding: 0,
                textAlign: 'left',
                transition: 'border-color 0.15s',
              }}
              aria-pressed={isSelected}
              title={f.path}
            >
              {url && (
                <img
                  src={url}
                  alt={f.name}
                  loading="lazy"
                  style={{ width: '100%', height: 120, objectFit: 'cover', display: 'block', background: '#f3f4f6' }}
                />
              )}
              <div style={{ padding: '8px 10px', fontSize: 12 }}>
                <div style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {f.name}
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 4, opacity: 0.7, fontSize: 11 }}>
                  <span>{formatBytes(f.metadata?.size)}</span>
                  <span>{timeAgo(f.created_at)}</span>
                </div>
                {linkedPost ? (
                  <div style={{ marginTop: 4, fontSize: 11, color: 'var(--green, #10b981)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    📌 {linkedPost}
                  </div>
                ) : (
                  <div style={{ marginTop: 4, fontSize: 11, color: 'var(--orange, #f59e0b)' }}>
                    ⚠ Orphaned
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Inspector panel */}
      {selected && (
        <div style={{ marginTop: 12, border: '1px solid var(--border)', borderRadius: 10, padding: 16, background: 'var(--card)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
            <h3 style={{ margin: 0, fontSize: 15 }}>File inspector</h3>
            <button type="button" onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}><X size={16} /></button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '6px 16px', marginTop: 12, fontSize: 13 }}>
            <strong>Path</strong><code style={{ wordBreak: 'break-all' }}>{selected.path}</code>
            <strong>Folder</strong><span>{selected.folder}</span>
            <strong>Filename</strong><span>{selected.name}</span>
            <strong>Size</strong><span>{formatBytes(selected.metadata?.size)}</span>
            <strong>MIME</strong><span>{selected.metadata?.mimetype || '—'}</span>
            <strong>Uploaded</strong><span>{selected.created_at ? new Date(selected.created_at).toLocaleString('en-IN') : '—'}</span>
            <strong>Linked post</strong>
            <span style={{ color: postMap[selected.path] ? 'var(--green, #10b981)' : 'var(--orange, #f59e0b)' }}>
              {postMap[selected.path] || 'Orphaned — not linked to any active post'}
            </span>
          </div>
          {getPublicUrl(selected.path) && (
            <img
              src={getPublicUrl(selected.path)}
              alt={selected.name}
              style={{ marginTop: 12, maxWidth: '100%', maxHeight: 300, borderRadius: 8, objectFit: 'contain', background: '#f3f4f6' }}
            />
          )}
          <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => copyUrl(selected.path)}
              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 14px', borderRadius: 7, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', color: 'inherit', fontSize: 12, fontWeight: 600 }}
            >
              {copyStatus === selected.path ? <><Check size={13} /> Copied</> : <><Copy size={13} /> Copy URL</>}
            </button>
            {getPublicUrl(selected.path) && (
              <a
                href={getPublicUrl(selected.path)}
                target="_blank"
                rel="noopener noreferrer"
                style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 14px', borderRadius: 7, border: '1px solid var(--border)', textDecoration: 'none', color: 'inherit', fontSize: 12, fontWeight: 600 }}
              >
                <ExternalLink size={13} /> Open full size
              </a>
            )}
            {canDelete && (
              confirmDelete === selected.path ? (
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <button
                    type="button"
                    onClick={() => deleteFile(selected.path)}
                    disabled={deleting === selected.path}
                    style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 14px', borderRadius: 7, border: 'none', background: 'var(--danger, #ef4444)', color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}
                  >
                    <Trash2 size={13} /> {deleting === selected.path ? 'Deleting…' : 'Confirm delete'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(null)}
                    style={{ padding: '7px 14px', borderRadius: 7, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', color: 'inherit', fontSize: 12, fontWeight: 600 }}
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(selected.path)}
                  style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 14px', borderRadius: 7, border: '1px solid var(--danger, #ef4444)', background: 'transparent', color: 'var(--danger, #ef4444)', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}
                >
                  <Trash2 size={13} /> Delete file
                </button>
              )
            )}
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', background: '#1f2937', color: '#fff', padding: '10px 20px', borderRadius: 10, fontSize: 13, fontWeight: 600, zIndex: 9999, boxShadow: '0 4px 12px rgba(0,0,0,.25)' }} role="status">
          {toast}
        </div>
      )}
    </section>
  );
}

