import { useEffect, useState } from 'react';
import {
  AlertCircle, ArrowLeft, ArrowRight, BellRing, BookOpen, Calendar,
  Check, ChevronDown, Code, Copy, Database, Download, FileSearch,
  Filter, Loader2, Mail, MessageSquare, Plane, Search, ShieldCheck,
  User, X
} from 'lucide-react';
import { downloadAdminCsv, searchAdminData, loadPublicationVersion } from '../lib/adminOperationalSearch.js';
import { hasAdminCapability } from '../lib/adminCapabilities.js';
import { loadAdminWorkspacePrefs, saveAdminWorkspacePrefs } from '../lib/adminWorkspacePrefs.js';
import { ADMIN_SEARCH_DATASETS as DATASETS, adminSearchRange, buildAdminSearchFilter, adminRecordTime } from '../lib/adminSearchView.js';
import '../styles/admin-record-search.css';

const labelFor = key => key.replaceAll('_', ' ').replace(/^./, text => text.toUpperCase());

function CopyableText({ text, label = 'Copy' }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = (e) => {
    e.stopPropagation();
    if (!text) return;
    navigator.clipboard?.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };
  return (
    <button type="button" className="ars-copy-inline" onClick={handleCopy} title={`${label}: ${text}`}>
      <span>{text}</span>
      {copied ? <Check size={11} className="is-success" /> : <Copy size={11} />}
    </button>
  );
}

function StudentRecordView({ data, row, onInspect }) {
  const [copiedKey, setCopiedKey] = useState('');
  const copyText = (text, key) => {
    if (!text) return;
    navigator.clipboard?.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(''), 1800);
  };

  const coursesObj = data.courses && typeof data.courses === 'object' ? data.courses : {};
  const coursesList = Object.entries(coursesObj).filter(([k]) => !k.startsWith('_'));
  const away = coursesObj._away;

  const nowStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  const isAwayNow = Boolean(away?.from && away?.to && nowStr >= away.from && nowStr <= away.to);
  const isAwayUpcoming = Boolean(away?.from && nowStr < away.from);

  const name = data.name || coursesObj._name || 'Student';
  const email = data.email || '';
  const imageUrl = coursesObj._imageUrl || data.image_url || data.avatar_url;
  const initials = name.split(' ').filter(Boolean).map(w => w[0]).join('').slice(0, 2).toUpperCase() || 'ST';

  return (
    <div className="ars-student-profile">
      {/* Student Profile Quick Bar */}
      <div className="ars-student-bar">
        <div className="ars-student-bar-left">
          <div className="ars-avatar-box">
            {imageUrl ? (
              <img src={imageUrl} alt={name} className="ars-avatar-img" />
            ) : (
              <span className="ars-avatar-initials">{initials}</span>
            )}
          </div>
          <div className="ars-student-identity">
            <div className="ars-student-name-row">
              <h4>{name}</h4>
              {data.user_id && (
                <button
                  type="button"
                  className="ars-copy-pill"
                  title="Copy User ID"
                  onClick={() => copyText(data.user_id, 'uid')}
                >
                  <span>{data.user_id.slice(0, 16)}…</span>
                  {copiedKey === 'uid' ? <Check size={10} className="is-success" /> : <Copy size={10} />}
                </button>
              )}
            </div>
            {email && (
              <div className="ars-student-email-row">
                <Mail size={12} />
                <span>{email}</span>
                <button
                  type="button"
                  className="ars-copy-icon"
                  title="Copy Email"
                  onClick={() => copyText(email, 'email')}
                >
                  {copiedKey === 'email' ? <Check size={10} className="is-success" /> : <Copy size={10} />}
                </button>
              </div>
            )}
          </div>
        </div>

        {data.user_id && onInspect && (
          <button
            type="button"
            className="ars-inspect-btn"
            onClick={() => onInspect(data.user_id)}
          >
            <User size={13} /> Inspect Student <ArrowRight size={13} />
          </button>
        )}
      </div>

      {/* Away Banner if scheduled */}
      {away?.from && away?.to && (
        <div className={`ars-away-card ${isAwayNow ? 'is-active' : 'is-upcoming'}`}>
          <div className="ars-away-card-left">
            <Plane size={15} className="ars-away-icon" />
            <div>
              <strong>{isAwayNow ? 'Currently away on leave' : isAwayUpcoming ? 'Upcoming leave scheduled' : 'Past leave recorded'}</strong>
              <small>
                {new Date(away.from + 'T00:00:00+05:30').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                {' → '}
                {new Date(away.to + 'T00:00:00+05:30').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
              </small>
            </div>
          </div>
          <span className={`ars-away-badge ${isAwayNow ? 'is-now' : ''}`}>
            {isAwayNow ? 'Away now' : 'Scheduled'}
          </span>
        </div>
      )}

      {/* Enrolled Courses */}
      <div className="ars-student-section">
        <div className="ars-section-title">
          <BookOpen size={13} />
          <span>Enrolled Courses</span>
          <span className="ars-count-badge">{coursesList.length}</span>
        </div>
        {coursesList.length > 0 ? (
          <div className="ars-course-grid">
            {coursesList.map(([code, section]) => (
              <div key={code} className="ars-course-card">
                <strong className="ars-course-code">{code}</strong>
                <span className="ars-course-sec">
                  {section === 'Single' ? 'Single section' : `Section ${section}`}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="ars-null-note">No enrolled courses saved in profile.</p>
        )}
      </div>

      {/* Activity Timestamps & Details */}
      <div className="ars-meta-cards">
        <div className="ars-meta-card">
          <span className="ars-meta-card-label">Last seen activity</span>
          <strong>{adminRecordTime(data.last_seen_at || data.seen_at || row.at)}</strong>
        </div>
        {data.created_at && (
          <div className="ars-meta-card">
            <span className="ars-meta-card-label">Profile registered</span>
            <strong>{adminRecordTime(data.created_at)}</strong>
          </div>
        )}
        {coursesObj._assignments && typeof coursesObj._assignments === 'object' && (
          <div className="ars-meta-card">
            <span className="ars-meta-card-label">Assignments recorded</span>
            <strong>{Object.keys(coursesObj._assignments).length} assignments</strong>
          </div>
        )}
      </div>

      {/* Collapsible Raw JSON for admins needing low-level inspection */}
      <details className="ars-raw-toggle">
        <summary>
          <Code size={12} />
          <span>View raw database fields</span>
        </summary>
        <div className="ars-raw-content">
          <div className="ars-raw-header">
            <span>Raw JSON payload</span>
            <button
              type="button"
              className="ars-copy-pill"
              onClick={() => copyText(JSON.stringify(data, null, 2), 'raw')}
            >
              {copiedKey === 'raw' ? 'Copied JSON!' : 'Copy JSON'}
            </button>
          </div>
          <pre>{JSON.stringify(data, null, 2)}</pre>
        </div>
      </details>
    </div>
  );
}

function RecordFields({ data, dataset, row, onInspect }) {
  if (dataset === 'students' || (data?.courses && data?.name && !data?.action)) {
    return <StudentRecordView data={data} row={row} onInspect={onInspect} />;
  }

  return (
    <dl className="ars-fields">
      {Object.entries(data || {}).map(([key, value]) => {
        const isDateKey = /_at$|^at$|^timestamp$|^date$/i.test(key);
        const isDateString = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value);
        const isCourses = key === 'courses' && typeof value === 'object' && value != null;

        return (
          <div key={key}>
            <dt>{labelFor(key)}</dt>
            <dd>
              {value == null ? (
                <span className="ars-null">Not recorded</span>
              ) : isCourses ? (
                <div className="ars-course-grid-compact">
                  {Object.entries(value)
                    .filter(([k]) => !k.startsWith('_'))
                    .map(([code, section]) => (
                      <span key={code} className="ars-course-pill">
                        <b>{code}</b> ({section})
                      </span>
                    ))}
                </div>
              ) : isDateKey || isDateString ? (
                <span className="ars-date-val">{adminRecordTime(value)}</span>
              ) : typeof value === 'boolean' ? (
                <span className={`ars-bool-pill ${value ? 'is-yes' : 'is-no'}`}>{value ? 'Yes' : 'No'}</span>
              ) : typeof value === 'object' ? (
                <div className="ars-object-box">
                  <div className="ars-object-header">
                    <span className="ars-object-badge">{Array.isArray(value) ? `${value.length} items` : 'Object'}</span>
                    <button
                      type="button"
                      className="ars-copy-pill"
                      onClick={() => navigator.clipboard?.writeText(JSON.stringify(value, null, 2))}
                    >
                      <Copy size={10} /> Copy
                    </button>
                  </div>
                  <pre>{JSON.stringify(value, null, 2)}</pre>
                </div>
              ) : (
                String(value)
              )}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

function RecordIcon({ dataset, data, title }) {
  if (dataset === 'students') {
    const imageUrl = data?.courses?._imageUrl || data?.image_url || data?.avatar_url;
    const name = data?.name || data?.courses?._name || title || 'Student';
    const initials = name.split(' ').filter(Boolean).map(w => w[0]).join('').slice(0, 2).toUpperCase() || 'ST';
    return (
      <span className="ars-record-icon is-student">
        {imageUrl ? (
          <img src={imageUrl} alt={name} className="ars-icon-avatar" />
        ) : (
          <span className="ars-icon-initials">{initials}</span>
        )}
      </span>
    );
  }
  if (dataset === 'audit') {
    return <span className="ars-record-icon is-audit"><ShieldCheck size={14} aria-hidden="true" /></span>;
  }
  if (dataset === 'feedback') {
    return <span className="ars-record-icon is-feedback"><MessageSquare size={14} aria-hidden="true" /></span>;
  }
  if (dataset === 'notifications') {
    return <span className="ars-record-icon is-notifications"><BellRing size={14} aria-hidden="true" /></span>;
  }
  return <span className="ars-record-icon is-default"><Database size={14} aria-hidden="true" /></span>;
}

export default function AdminHistoryExplorer({ role, initialDataset = 'audit', requestedDataset, onInspect, userId, workspace = 'database' }) {
  const allowed = Object.entries(DATASETS).filter(([, value]) => hasAdminCapability(role, value.capability));
  const [initial] = useState(() => {
    const prefs = loadAdminWorkspacePrefs(userId).filters;
    const dataset = allowed.some(([key]) => key === requestedDataset) ? requestedDataset : allowed.some(([key]) => key === prefs.dataset) ? prefs.dataset : allowed.some(([key]) => key === initialDataset) ? initialDataset : allowed[0]?.[0];
    const range = { ...adminSearchRange(), from: prefs.from || adminSearchRange().from, to: prefs.to || adminSearchRange().to };
    try { buildAdminSearchFilter({ dataset, ...range }); } catch { Object.assign(range, adminSearchRange()); }
    return { dataset, ...range, query: '', status: '', actor: '' };
  });
  const [draft, setDraft] = useState(initial);
  const [filter, setFilter] = useState(() => initial.dataset ? buildAdminSearchFilter(initial) : null);
  const [appliedDates, setAppliedDates] = useState({ from: initial.from, to: initial.to });
  const [cursors, setCursors] = useState([null]);
  const [response, setResponse] = useState(null);
  const [validation, setValidation] = useState('');
  const [exporting, setExporting] = useState(false), [exportMessage, setExportMessage] = useState('');
  const [versions, setVersions] = useState({});
  const cursor = cursors.at(-1);
  const loading = !!filter && (response?.filter !== filter || response?.cursor !== cursor);
  const result = !loading ? response?.data : null;
  const searchError = !loading ? response?.error : '';
  const meta = DATASETS[draft.dataset];
  let changed;
  try { changed = JSON.stringify(buildAdminSearchFilter(draft)) !== JSON.stringify(filter); } catch { changed = true; }

  useEffect(() => {
    if (!filter || !hasAdminCapability(role, DATASETS[filter.dataset].capability)) return;
    let active = true;
    searchAdminData({ ...filter, cursor }).then(data => { if (active) setResponse({ filter, cursor, data }); })
      .catch(error => { if (active) setResponse({ filter, cursor, error: error.message }); });
    return () => { active = false; };
  }, [filter, cursor, role]);

  const update = patch => { setDraft(current => ({ ...current, ...patch })); setValidation(''); };
  const search = event => {
    event.preventDefault();
    try {
      const next = buildAdminSearchFilter(draft);
      if (!hasAdminCapability(role, DATASETS[next.dataset].capability)) throw new Error('Your role cannot search this record type.');
      const prefs = loadAdminWorkspacePrefs(userId);
      saveAdminWorkspacePrefs(userId, { ...prefs, filters: { ...prefs.filters, dataset: draft.dataset, from: draft.from, to: draft.to } });
      setValidation(''); setExportMessage(''); setFilter(next); setAppliedDates({ from: draft.from, to: draft.to }); setCursors([null]);
    } catch (error) { setValidation(error.message); }
  };
  const exportData = async () => {
    setExporting(true); setExportMessage('');
    try {
      const data = await searchAdminData({ ...filter, exportRows: true });
      downloadAdminCsv(`admin-${filter.dataset}`, data.rows.map(row => row.data));
      setExportMessage(data.has_more ? 'Downloaded the newest 1,000 matches. Narrow the date range to export more.' : `Downloaded ${data.rows.length} matching records.`);
    } catch (error) { setExportMessage(`Export failed: ${error.message}`); }
    finally { setExporting(false); }
  };
  const inspectVersion = async row => {
    setVersions(current => ({ ...current, [row.key]: { loading: true } }));
    try { const data = await loadPublicationVersion(row.data.id); setVersions(current => ({ ...current, [row.key]: { data } })); }
    catch (error) { setVersions(current => ({ ...current, [row.key]: { error: error.message } })); }
  };

  return <section className={`admin-card admin-span-all admin-g-${workspace} ars-panel`} aria-label="Search admin records">
    <header className="ars-header">
      <span className="ars-heading-icon"><FileSearch size={22} aria-hidden="true" /></span>
      <div>
        <span className="ars-eyebrow">Records explorer</span>
        <h2>Search admin records</h2>
        <p>Find activity, feedback, students and published changes.</p>
      </div>
      <span className="ars-access"><ShieldCheck size={13} aria-hidden="true" />Role-based access</span>
    </header>

    {!allowed.length ? <p className="ars-empty">Your role has no searchable record types.</p> : <>
      <form className="ars-form" onSubmit={search}>
        <div className="ars-search-row">
          <label className="ars-dataset">
            Record type
            <select value={draft.dataset} onChange={event => update({ dataset: event.target.value, status: '', actor: '' })}>
              {allowed.map(([key,value]) => <option key={key} value={key}>{value.label}</option>)}
            </select>
          </label>
          <label className="ars-query">
            Search records
            <span className="ars-input-wrap">
              <Search size={15} aria-hidden="true" />
              <input value={draft.query} maxLength={200} placeholder={meta?.placeholder} onChange={event => update({ query: event.target.value })} />
              {draft.query && <button type="button" aria-label="Clear search text" onClick={() => update({ query: '' })}><X size={14} /></button>}
            </span>
          </label>
          <button className="ars-search-button" type="submit" disabled={loading}>
            <Search size={14} aria-hidden="true" />{loading ? 'Searching…' : 'Search records'}
          </button>
        </div>

        <div className="ars-filter-row">
          <label>From · IST<input type="date" required value={draft.from} onChange={event => update({ from: event.target.value })} /></label>
          <label>To · IST<input type="date" required value={draft.to} onChange={event => update({ to: event.target.value })} /></label>
          <div className="ars-presets" role="group" aria-label="Quick date ranges">
            <span>Date range</span>
            <div>
              {[7,30,90].map(days => {
                const range = adminSearchRange(days);
                return <button type="button" key={days} aria-pressed={draft.from === range.from && draft.to === range.to} onClick={() => update(range)}>{days} days</button>;
              })}
            </div>
          </div>
          {draft.dataset === 'feedback' && <label>Status<input value={draft.status} placeholder="Any status" onChange={event => update({ status: event.target.value })} /></label>}
          {['audit','versions'].includes(draft.dataset) && <label>Administrator ID<input value={draft.actor} placeholder="Any administrator" onChange={event => update({ actor: event.target.value })} /></label>}
        </div>

        <div className="ars-filter-help">
          <p><Filter size={13} aria-hidden="true" />{meta?.hint}</p>
          {changed && <span className="ars-changed-alert">Filters changed · click search to apply</span>}
        </div>
        {validation && <p className="ars-alert" role="alert"><AlertCircle size={15} aria-hidden="true" />{validation}</p>}
      </form>

      <div className="ars-results-heading">
        <div>
          <h3>
            {filter && DATASETS[filter.dataset].label}
            <span className="ars-badge-count">{result ? result.total.toLocaleString('en-IN') : '—'}</span>
          </h3>
          <p>
            {appliedDates.from} – {appliedDates.to} · IST
            {filter?.query && ` · “${filter.query}”`}
            {filter?.status && ` · Status: ${filter.status}`}
            {filter?.actor && ` · Admin: ${filter.actor}`}
          </p>
        </div>
        <button type="button" className="ars-export" disabled={exporting || loading || !result?.total} onClick={exportData} title="Download up to 1,000 matching records as CSV">
          <Download size={14} aria-hidden="true" />{exporting ? 'Exporting…' : 'Export results'}
        </button>
      </div>

      {exportMessage && <p className="ars-export-message" role="status">{exportMessage}</p>}
      {loading && <div className="ars-loading" role="status"><Loader2 size={21} aria-hidden="true" /><strong>Searching records…</strong><span>Applying your filters to the selected record type.</span></div>}
      {searchError && <div className="ars-error" role="alert"><AlertCircle size={20} aria-hidden="true" /><div><strong>Records could not load</strong><p>{searchError}</p><button type="button" onClick={() => setFilter(current => ({ ...current }))}>Try again</button></div></div>}

      {result && (result.rows.length === 0 ? (
        <div className="ars-empty">
          <Search size={26} aria-hidden="true" />
          <strong>No matching records</strong>
          <p>Try a broader date range or fewer filters, then search again.</p>
          <button type="button" onClick={() => update({ ...adminSearchRange(), query: '', status: '', actor: '' })}>Reset filters</button>
        </div>
      ) : <>
        <div className="ars-result-list" role="region" aria-label="Search results" tabIndex={0}>
          {result.rows.map(row => {
            const data = row.data;
            const isStudent = filter.dataset === 'students';
            const studentCourses = isStudent && data.courses && typeof data.courses === 'object' ? data.courses : null;
            const coursesCount = studentCourses ? Object.keys(studentCourses).filter(k => !k.startsWith('_')).length : null;
            const studentAway = studentCourses?._away;
            const nowDay = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
            const isAwayNow = Boolean(studentAway?.from && studentAway?.to && nowDay >= studentAway.from && nowDay <= studentAway.to);

            const title = data.action
              ? labelFor(data.action)
              : data.name || data.message || data.title || (data.domain ? `${labelFor(data.domain)} · Revision ${data.revision}` : data.type ? labelFor(data.type) : data.user_id || data.id || row.key);

            const secondary = data.admin_id
              ? `Admin · ${data.admin_id}`
              : data.created_by
              ? `Published by · ${data.created_by}`
              : data.email || (data.user_id ? `Student · ${data.user_id}` : row.key);

            const version = versions[row.key];

            return (
              <details className="ars-record" key={`${filter.dataset}:${row.key}`}>
                <summary>
                  <RecordIcon dataset={filter.dataset} data={data} title={title} />
                  <span className="ars-record-copy">
                    <span className="ars-record-title-row">
                      <strong>{title}</strong>
                      {coursesCount !== null && (
                        <span className="ars-mini-badge">{coursesCount} course{coursesCount === 1 ? '' : 's'}</span>
                      )}
                      {isAwayNow && <span className="ars-mini-badge is-away">Away</span>}
                    </span>
                    <small>{secondary}</small>
                  </span>
                  <span className="ars-record-meta">
                    {(data.status || data.push_delivery_state) && (
                      <span className="ars-badge">{labelFor(data.status || data.push_delivery_state)}</span>
                    )}
                    <time dateTime={row.at}>{adminRecordTime(row.at)}</time>
                  </span>
                  <ChevronDown className="ars-chevron" size={15} aria-hidden="true" />
                </summary>

                <div className="ars-record-body">
                  <RecordFields data={data} dataset={filter.dataset} row={row} onInspect={onInspect} />

                  {(filter.dataset === 'versions' || (data.user_id && onInspect && filter.dataset !== 'students')) && (
                    <div className="ars-record-actions">
                      {filter.dataset === 'versions' && (
                        <button type="button" disabled={version?.loading} onClick={() => inspectVersion(row)}>
                          <FileSearch size={14} aria-hidden="true" />
                          {version?.loading ? 'Loading settings…' : version?.error ? 'Retry published settings' : 'Inspect published settings'}
                        </button>
                      )}
                      {data.user_id && onInspect && filter.dataset !== 'students' && (
                        <button type="button" onClick={() => onInspect(data.user_id)}>
                          Inspect student<ArrowRight size={14} aria-hidden="true" />
                        </button>
                      )}
                    </div>
                  )}

                  {version?.error && <p className="ars-alert" role="alert">{version.error}</p>}
                  {version?.data && (
                    <div className="ars-version">
                      <h4><Check size={14} aria-hidden="true" />Published settings</h4>
                      <pre>{JSON.stringify(version.data.payload, null, 2)}</pre>
                    </div>
                  )}
                </div>
              </details>
            );
          })}
        </div>

        <div className="ars-pagination">
          <span>Page {cursors.length} · {(cursors.length - 1) * 50 + 1}–{(cursors.length - 1) * 50 + result.rows.length} of {result.total.toLocaleString('en-IN')}</span>
          <div>
            <button type="button" disabled={cursors.length === 1} onClick={() => setCursors(previous => previous.slice(0,-1))}>
              <ArrowLeft size={14} aria-hidden="true" />Previous
            </button>
            <button type="button" disabled={!result.has_more} onClick={() => setCursors(previous => [...previous,result.rows.at(-1)])}>
              Next<ArrowRight size={14} aria-hidden="true" />
            </button>
          </div>
        </div>
      </>)}

      <footer className="ars-footer">
        <span><ShieldCheck size={13} aria-hidden="true" />Only fields available to your role are returned.</span>
        <span>50 per page · CSV exports up to 1,000 matches</span>
      </footer>
    </>}
  </section>;
}
