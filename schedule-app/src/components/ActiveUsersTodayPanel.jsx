import { useEffect, useState } from "react";
import { Activity, RefreshCw, Download, Copy, ChevronDown, ChevronRight, Search, VenetianMask, Ban, X, Filter } from "lucide-react";

const time = value => Number.isFinite(value) ? `${new Date(value).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" })} IST` : "Unavailable";
const stamp = value => Number.isFinite(value) ? new Date(value).toISOString() : "";
const relativeTime = (value, now) => {
  if (!Number.isFinite(value)) return "Unavailable";
  const minutes = Math.max(0, Math.floor((now - value) / 60000));
  return minutes < 1 ? "Just now" : minutes < 60 ? `${minutes}m ago` : `${Math.floor(minutes / 60)}h ago`;
};
const courseKeys = user => Object.keys(user.courses || {}).filter(code => !code.startsWith("_"));
const section = user => {
  const codes = courseKeys(user);
  return ["A", "B"].filter(s => codes.some(code => code.endsWith(`_${s}`) || user.courses[code] === s)).join("/") || "—";
};

// Deterministic avatar color palette keyed to first char of name
const AVATAR_PALETTES = [
  { bg: "rgba(109,91,208,.18)", color: "#6D5BD0" },
  { bg: "rgba(59,130,246,.18)", color: "#3B82F6" },
  { bg: "rgba(31,169,113,.18)", color: "#1FA971" },
  { bg: "rgba(201,136,43,.18)", color: "#C9882B" },
  { bg: "rgba(236,72,153,.18)", color: "#EC4899" },
  { bg: "rgba(239,68,68,.18)", color: "#EF4444" },
  { bg: "rgba(20,184,166,.18)", color: "#14B8A6" },
  { bg: "rgba(168,85,247,.18)", color: "#A855F7" },
];
const avatarPalette = name => AVATAR_PALETTES[((name || "S").charCodeAt(0)) % AVATAR_PALETTES.length];

export default function ActiveUsersTodayPanel({ users, day, historyAvailable, asOf, pushIds, roster, bannedIds, loading, onClose, onRefresh, onInspect, onViewAs, onToggleBan, readOnly, exportCsv, legend }) {
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState({ section: "all", push: "all", access: "all", course: "all", recency: "all", hour: "all" });
  const [sort, setSort] = useState("recent");
  const [selected, setSelected] = useState(new Set());
  const [expanded, setExpanded] = useState(null);
  const [notice, setNotice] = useState("");
  const [moreFilters, setMoreFilters] = useState(false);
  const [displayNow, setDisplayNow] = useState(() => Date.now());
  useEffect(() => {
    const update = () => { if (!document.hidden) setDisplayNow(Date.now()); };
    const timer = setInterval(update, 60000);
    document.addEventListener("visibilitychange", update);
    return () => { clearInterval(timer); document.removeEventListener("visibilitychange", update); };
  }, []);
  const advancedCount = [filters.access, filters.course, filters.recency].filter(value => value !== "all").length;
  const push = new Set(pushIds);
  const roles = new Map(roster.map(row => [row.user_id, row.role]));
  const banned = new Set(bannedIds);
  const presence = new Map((day?.users || []).map(row => [row.userId, row]));
  const rows = users.filter(user => presence.has(user.user_id)).map(user => ({ ...user, presence: presence.get(user.user_id), section: section(user), codes: courseKeys(user) }));
  const updateFilter = (key, value) => setFilters(current => ({ ...current, [key]: value }));
  const reset = () => { setQuery(""); setFilters({ section: "all", push: "all", access: "all", course: "all", recency: "all", hour: "all" }); setSort("recent"); };
  const filtered = rows.filter(user => {
    const age = Math.max(0, asOf - user.presence.seenTs);
    return (!query.trim() || [user.name, user.email, user.user_id, ...user.codes].join(" ").toLowerCase().includes(query.trim().toLowerCase()))
      && (filters.section === "all" || (filters.section === "none" ? user.section === "—" : user.section.includes(filters.section)))
      && (filters.push === "all" || push.has(user.user_id) === (filters.push === "on"))
      && (filters.access === "all" || (filters.access === "admin" ? roles.has(user.user_id) : banned.has(user.user_id) === (filters.access === "banned")))
      && (filters.course === "all" || (filters.course === "none" ? user.codes.length === 0 : user.codes.includes(filters.course)))
      && (filters.recency === "all" || age <= Number(filters.recency) * 60000)
      && (filters.hour === "all" || user.presence.hours.includes(Number(filters.hour)));
  }).sort((a, b) => sort === "name" ? (a.name || "").localeCompare(b.name || "") : sort === "courses" ? b.codes.length - a.codes.length : sort === "heartbeats" ? b.presence.heartbeatCount - a.presence.heartbeatCount : sort === "oldest" ? a.presence.seenTs - b.presence.seenTs : b.presence.seenTs - a.presence.seenTs);
  const selectedRows = rows.filter(row => selected.has(row.user_id));
  const exportRows = selectedRows.length ? selectedRows : filtered;
  const selectRow = (id, checked) => setSelected(current => { const next = new Set(current); checked ? next.add(id) : next.delete(id); return next; });
  const allSelected = filtered.length > 0 && filtered.every(row => selected.has(row.user_id));
  const recentCount = rows.filter(row => asOf - row.presence.seenTs <= 30 * 60000).length;
  const pushCount = rows.filter(row => push.has(row.user_id)).length;
  const maxHour = Math.max(...(day?.hourBuckets || []), 1);
  const peak = day?.hourBuckets?.indexOf(maxHour);
  const writeClipboard = async text => {
    try { await navigator.clipboard.writeText(text); setNotice("Copied to clipboard."); }
    catch { setNotice("Clipboard unavailable. Use CSV export instead."); }
  };
  const exportRoster = () => exportCsv(`termflow-active-users-${day?.isoDate || "today"}.csv`, ["User ID", "Name", "Email", "Section", "Courses", "First activity today (UTC)", "Last activity today (UTC)", "Recorded hours (IST)", "Heartbeats", "Push", "Admin role", "Staged access"], exportRows.map(row => [row.user_id, row.name, row.email, row.section, row.codes.join(";"), historyAvailable ? stamp(row.presence.firstSeenTs) : "", stamp(row.presence.seenTs), row.presence.hours.join(";"), historyAvailable ? row.presence.heartbeatCount : "", push.has(row.user_id) ? "Enabled" : "Off", roles.get(row.user_id) || "Student", banned.has(row.user_id) ? "Banned" : "Allowed"]));

  return <div className="aut-panel">
    <div className="admin-modal-header aut-header">
      <div>
        <h3 className="admin-modal-title aut-title"><Activity size={20} /><span>Active Users Today</span><span className="admin-modal-live-pill" role="status">{filtered.length} / {rows.length} Active</span></h3>
        <p className="admin-modal-subtitle">Unique students who opened TermFlow from 12:00 AM to 11:59 PM IST. Last-seen values refresh about every five minutes while the app is visible.</p>
      </div>
      <button type="button" className="admin-modal-close-btn" aria-label="Close modal" onClick={onClose}><X size={18} /></button>
    </div>
    <div className="aut-overview">
      {[["Active today", rows.length, `${users.length ? Math.round(rows.length / users.length * 100) : 0}% of loaded profiles`], ["Seen within 30m", recentCount, "At the last data refresh"], ["Push enabled", pushCount, `${rows.length ? Math.round(pushCount / rows.length * 100) : 0}% of today's users`], ["Needs enrollment", rows.filter(row => !row.codes.length).length, "No courses selected"]].map(([label, value, caption]) => <div key={label}><span>{label}</span><strong>{value}</strong><small>{caption}</small></div>)}
    </div>
    <div className="aut-data-bar"><span><Activity size={14} /> {historyAvailable ? "Daily presence history" : "Latest-heartbeat snapshot"} · Refreshed {time(asOf)}</span><button className="admin-btn outline" disabled={loading} onClick={onRefresh}><RefreshCw size={14} className={loading ? "spin-icon" : ""} /> {loading ? "Refreshing…" : "Refresh data"}</button></div>
    <p className="aut-note">{historyAvailable ? "Heartbeats are activity signals, recorded about every five minutes while the app is visible. They do not measure sessions or time spent." : "Daily history is unavailable. Only each profile's latest heartbeat is shown; first activity and heartbeat totals are unavailable."}</p>
    <section className="aut-hours" aria-label="Hourly recorded activity">
      <div className="aut-section-head"><div><strong>{historyAvailable ? "Unique users by hour" : "Latest heartbeat by hour"}</strong><small>{day?.date} · IST{peak >= 0 ? ` · Peak ${String(peak).padStart(2, "0")}:00 (${maxHour})` : ""}</small></div><button className="admin-btn outline" disabled={filters.hour === "all"} onClick={() => updateFilter("hour", "all")}>Clear hour</button></div>
      <div className="aut-hour-chart">{(day?.hourBuckets || []).map((count, hour) => <button type="button" key={hour} disabled={!count} className={filters.hour === String(hour) ? "is-selected" : ""} aria-pressed={filters.hour === String(hour)} aria-label={`${hour}:00 IST, ${count} users. Filter by hour`} title={`${hour}:00–${hour}:59 IST · ${count} users`} onClick={() => updateFilter("hour", filters.hour === String(hour) ? "all" : String(hour))}><span>{count || ""}</span><i style={{ height: `${Math.max(3, count / maxHour * 42)}px` }} /><small>{String(hour).padStart(2, "0")}</small></button>)}</div>
    </section>
    <div className="aut-filters">
      <label className="aut-search"><Search size={16} /><input type="search" aria-label="Search active students" placeholder="Search name, email, ID or course..." value={query} onChange={e => setQuery(e.target.value)} /></label>
      <div className="admin-modal-filter-pills" role="group" aria-label="Filter by section">{[["all", "All"], ["A", "Sec A"], ["B", "Sec B"], ["none", "No section"]].map(([value, label]) => <button type="button" key={value} className={`admin-modal-filter-btn${filters.section === value ? " active" : ""}`} aria-pressed={filters.section === value} onClick={() => updateFilter("section", value)}>{label}</button>)}</div>
      <select aria-label="Push status" value={filters.push} onChange={e => updateFilter("push", e.target.value)}><option value="all">Any push</option><option value="on">Push only</option><option value="off">Push off</option></select>
      <select aria-label="Sort by" value={sort} onChange={e => setSort(e.target.value)}><option value="recent">Most recent</option><option value="oldest">Oldest first</option><option value="name">Name A-Z</option><option value="courses">Most subjects</option>{historyAvailable && <option value="heartbeats">Most heartbeats</option>}</select>
      <button type="button" className="admin-btn outline aut-more-filters" aria-expanded={moreFilters} aria-controls="aut-extra-filters" onClick={() => setMoreFilters(!moreFilters)}><Filter size={13} /> More filters{advancedCount > 0 ? ` (${advancedCount})` : ""}</button>
    </div>
    {moreFilters && <div className="aut-extra-filters" id="aut-extra-filters">{[["access", "Access", [["all", "All users"], ["allowed", "Allowed"], ["banned", "Banned (staged)"], ["admin", "Admins"]]], ["recency", "Activity", [["all", "Any time today"], ["15", "Within 15 minutes"], ["30", "Within 30 minutes"], ["60", "Within 1 hour"]]], ["course", "Enrollment", [["all", "All courses"], ["none", "No courses"], ...[...new Set(rows.flatMap(row => row.codes))].sort().map(code => [code, code])]]].map(([key, label, options]) => <label key={key}><span>{label}</span><select value={filters[key]} onChange={e => updateFilter(key, e.target.value)}>{options.map(([value, text]) => <option value={value} key={value}>{text}</option>)}</select></label>)}</div>}
    <div className="aut-results"><label><input type="checkbox" aria-label="Select all matching students" checked={allSelected} onChange={e => { const checked = e.target.checked; setSelected(current => { const next = new Set(current); filtered.forEach(row => checked ? next.add(row.user_id) : next.delete(row.user_id)); return next; }); }} /> Select matching</label><span><strong>{filtered.length}</strong> of {rows.length} active users{selectedRows.length > 0 && ` · ${selectedRows.length} selected across filters`}{filters.hour !== "all" && ` · Hour ${filters.hour}:00 IST`}</span><button className="admin-btn outline" onClick={reset}>Reset filters</button></div>
    <div className="aut-actions"><span>{selectedRows.length ? "Actions use selected users across all filters." : "Actions use the matching list."}</span><div>{selectedRows.length > 0 && <button className="admin-btn outline" onClick={() => setSelected(new Set())}>Clear selection</button>}<button className="admin-btn outline" disabled={!exportRows.length || loading} onClick={() => writeClipboard(exportRows.map(row => `${row.name || "Student"} | ${row.email || row.user_id} | Section ${row.section} | Last activity ${time(row.presence.seenTs)}`).join("\n"))}><Copy size={14} /> Copy roster</button><button className="admin-btn outline" disabled={!exportRows.length || loading} onClick={exportRoster}><Download size={14} /> Export {exportRows.length}</button></div></div>
    {notice && <p className="aut-notice" role="status">{notice}</p>}

    <div className="aut-roster" aria-label="Active students">
      {loading
        ? <p className="admin-empty" role="status">Loading latest activity...</p>
        : !filtered.length
          ? <p className="admin-empty">{rows.length ? "No students match these filters." : "No recorded activity today."}</p>
          : filtered.map(row => {
            const isExpanded = expanded === row.user_id;
            const role = roles.get(row.user_id);
            const isBanned = banned.has(row.user_id);
            const isRecent = Number.isFinite(row.presence.seenTs) && (asOf - row.presence.seenTs) <= 5 * 60000;
            const palette = avatarPalette(row.name);

            return <article className={`aut-user${selected.has(row.user_id) ? " is-selected" : ""}${isExpanded ? " is-expanded" : ""}`} key={row.user_id}>
              <div className="aut-user-row">
                <div className="aut-person">
                  <input type="checkbox" className="aut-checkbox" checked={selected.has(row.user_id)} aria-label={`Select ${row.name || row.user_id}`} onChange={e => selectRow(row.user_id, e.target.checked)} />
                  <button className="aut-expand-btn" aria-expanded={isExpanded} aria-controls={`aut-details-${row.user_id}`} onClick={() => setExpanded(isExpanded ? null : row.user_id)} aria-label={isExpanded ? "Collapse" : "Expand"}>
                    {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </button>
                  <div className="aut-avatar-wrap">
                    <span className="aut-avatar" aria-hidden="true" style={{ background: palette.bg, color: palette.color }}>
                      {(row.name || "Student").split(/\s+/).filter(Boolean).slice(0, 2).map(word => word[0]).join("").toUpperCase()}
                    </span>
                    <span className={`aut-online-dot${isRecent ? " is-online" : ""}`} aria-hidden="true" />
                  </div>
                  <div className="aut-person-info">
                    <div className="aut-person-name-row">
                      <strong className="aut-person-name">{row.name || "Student"}</strong>
                      {role === "superadmin" && <span className="aut-badge aut-badge-superadmin">SUPERADMIN</span>}
                      {role && role !== "superadmin" && <span className="aut-badge aut-badge-admin">ADMIN</span>}
                      {isBanned && <span className="aut-badge aut-badge-banned">BANNED</span>}
                    </div>
                    <div className="aut-person-meta">
                      <span className="aut-meta-item">{row.codes.length} subject{row.codes.length === 1 ? "" : "s"}</span>
                      <span className="aut-meta-sep">·</span>
                      <span className="aut-meta-email">{row.email || row.user_id}</span>
                    </div>
                  </div>
                </div>
                <div className="aut-user-right">
                  <div className="aut-time-cell">
                    <span className="aut-time-main">{time(row.presence.seenTs)}</span>
                    <span className="aut-time-rel">({relativeTime(row.presence.seenTs, displayNow)})</span>
                  </div>
                  <button className="aut-nav-btn" onClick={() => onInspect(row)} aria-label={`Open ${row.name || "student"} profile`} title="Open student profile">
                    <ChevronRight size={15} />
                  </button>
                </div>
              </div>
              {isExpanded && <div className="aut-details" id={`aut-details-${row.user_id}`}>
                <div className="aut-details-col">
                  <span className="aut-details-label">USER ID</span>
                  <code className="aut-details-code">{row.user_id}</code>
                  <button className="admin-btn outline aut-details-copy-btn" onClick={() => writeClipboard(row.user_id)}>Copy ID</button>
                  <div className="aut-details-tags">
                    <span className="aut-details-tag">{row.section === "—" ? "No section" : `Section ${row.section}`}</span>
                    <span className="aut-details-tag">Push {push.has(row.user_id) ? "on" : "off"}</span>
                    <span className="aut-details-tag">{role || "Student"}</span>
                    {isBanned && <span className="aut-details-tag aut-details-tag-danger">Banned</span>}
                  </div>
                  <div className="aut-row-actions">
                    <button className="admin-btn outline" onClick={() => onInspect(row)}>Profile</button>
                    <button className="admin-btn-icon" disabled={readOnly} onClick={() => onViewAs(row)} aria-label={`View as ${row.name || "student"}`} title="View as student"><VenetianMask size={16} /></button>
                    <button className="admin-btn-icon" disabled={readOnly} onClick={() => onToggleBan(row)} aria-label={`${isBanned ? "Stage unban" : "Stage ban"} for ${row.name || "student"}`} title={isBanned ? "Stage unban" : "Stage ban"}><Ban size={16} /></button>
                  </div>
                </div>
                <div className="aut-details-col">
                  <span className="aut-details-label">FIRST / LAST ACTIVITY TODAY</span>
                  <strong className="aut-details-activity">{historyAvailable ? time(row.presence.firstSeenTs) : "Unavailable"} / {time(row.presence.seenTs)}</strong>
                  <small className="aut-details-sub">{historyAvailable ? `${row.presence.heartbeatCount} heartbeats · ${row.presence.hours.length} recorded hours` : "Latest recorded heartbeat"}</small>
                  <small className="aut-details-sub">Recorded hours (IST): {row.presence.hours.slice().sort((a, b) => a - b).map(hour => `${String(hour).padStart(2, "0")}:00`).join(", ") || "—"}</small>
                </div>
                <div className="aut-details-col">
                  <span className="aut-details-label">SAVED ENROLLMENT</span>
                  <div className="aut-course-list">
                    {row.codes.length
                      ? row.codes.map(code => <span key={code} className="aut-course-chip">
                          <span className="aut-course-code">{code}</span>
                          <span className="aut-course-name"> · {legend?.[code]?.name || "Course"}{["A", "B"].includes(row.courses[code]) ? ` · Section ${row.courses[code]}` : ""}</span>
                        </span>)
                      : <small className="aut-details-sub">No courses selected.</small>}
                  </div>
                </div>
              </div>}
            </article>;
          })
      }
    </div>
    <p className="aut-note">Profile opens the existing student detail view. Ban/unban changes are staged in Admin Tools and take effect after deployment.{readOnly ? " Your monitor role permits read-only access." : ""}</p>
  </div>;
}
