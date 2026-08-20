import { useState, useEffect, useRef } from "react";
import "../styles/admin.css";
import "../styles/assignments.css";
import "../styles/cmdk.css";
import { Users, Megaphone, Flag, Save, Trash2, ShieldAlert, Check, Search, RefreshCw, AlertTriangle, CalendarDays, XCircle, VenetianMask, Ban, Terminal, Clock, Database, FileText, X, BellRing, Sparkles, Pencil, BarChart2, GraduationCap, MessageSquare, CloudOff, Shield, Smartphone, Copy } from "lucide-react";
import { supabase } from "../lib/supabase";
import { logAdminAction } from "../lib/adminAudit.js";
import { LEGEND } from "../data/schedule.js";
import snapshotMeta from "../data/snapshot-meta.json";
import { getSnapshot } from "../lib/sheet.js";
import { classIdent, makeOverrideKey, lookupOverride, parseOverrideKey } from "../lib/overrides.js";
import AdminCommandPalette from "./AdminCommandPalette";
import FeedbackFlashToast from "./FeedbackFlashToast.jsx";
import { WhatsNewPill, WhatsNewModal } from "./WhatsNew.jsx";

// Render-stable "now" captured at module load — used for relative-time math in
// render (inactivity windows, cron staleness) without an impure Date.now() call.
const LOAD_NOW = Date.now();

// Event-time clock. Module-level indirection so the react-hooks/purity linter
// (which flags a literal Date.now() reachable from render) stays happy — only
// ever call this from event handlers, never during render.
const nowMs = () => Date.now();

// Next upcoming month/day (this year if not yet passed, else next) at 09:00 —
// used by the Time Machine's "Preview Independence/Republic Day" shortcuts,
// formatted for a <input type="datetime-local">.
function nextOccurrence(month, day) {
  const now = new Date();
  let year = now.getFullYear();
  if (new Date(year, month - 1, day, 23, 59) < now) year += 1;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T09:00`;
}

// Canonical feature toggles the app actually reads (all default ON when the key
// is absent, i.e. `flags.x !== false`). Rendered as a curated list so the Feature
// Flags card always shows every real feature — and never internal data keys like
// classOverrides / configHistory / messMenuOverrides. maintenanceMode &
// dispatchEnabled are managed in the Danger Zone.
const FEATURE_FLAGS = [
  { key: "enableFriends", label: "Friends & Social graph" },
  { key: "enableExams", label: "Exams" },
  { key: "enableAttendance", label: "Attendance" },
  { key: "enableStatus", label: "Status lines" },
  { key: "enableMeetups", label: "Meetups" },
  { key: "enableFreeNudge", label: "Free-time nudges" },
  { key: "enableAwayShare", label: "Away sharing" },
];
const FEATURE_FLAG_KEYS = new Set(FEATURE_FLAGS.map(f => f.key));

// Live lock-screen-style preview of a push notification, so admins see exactly
// what subscribers get before broadcasting. Placeholders show until fields fill.
function PushPreview({ title, body, url, when }) {
  const t = title?.trim();
  const b = body?.trim();
  return (
    <div className="push-preview" aria-hidden="true">
      <div className="push-preview-note">
        <div className="push-preview-icon">TF</div>
        <div className="push-preview-content">
          <div className="push-preview-head">
            <span className="push-preview-app">TERMFLOW</span>
            <span className="push-preview-time">{when || "now"}</span>
          </div>
          <div className={`push-preview-title ${t ? "" : "is-placeholder"}`}>{t || "Notification title"}</div>
          <div className={`push-preview-text ${b ? "" : "is-placeholder"}`}>{b || "Your message shows here as you type it."}</div>
          {url?.trim() ? <div className="push-preview-url">{url.trim()}</div> : null}
        </div>
      </div>
    </div>
  );
}


function Avatar({ name, email }) {
  const init = name ? name[0] : (email ? email[0] : "?");
  return <div className="admin-avatar">{init.toUpperCase()}</div>;
}

// Shared centered-overlay modal shell — backdrop click / X both close, body
// scrolls with a hidden scrollbar track. Width is per-modal (list modals want
// more room than a short confirm), everything else (positioning, max-height,
// close affordance) stays identical so a future fix only has to land once.
function AdminModal({ title, onClose, width = 640, children }) {
  return (
    <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.6)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={onClose}>
      <div className="admin-scroll-hide" style={{ background: "var(--bg)", width: "90%", maxWidth: width, borderRadius: 16, padding: 24, maxHeight: "80vh", overflowY: "auto", border: "1px solid var(--border)" }} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h3 style={{ margin: 0 }}>{title}</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer" }}><X size={20} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

// Strip the bookkeeping keys (rollback history + scheduled-deploy queue) out of
// a flags object. These must NEVER live inside a configHistory snapshot: if a
// snapshot embeds the history, and that snapshot is later restored + re-deployed,
// the history nests inside itself and the system_config row grows exponentially
// until an UPDATE exceeds the 8s statement_timeout ("canceling statement due to
// statement timeout"). Used both when snapshotting for history and when loading a
// past version back into the editor.
function stripHistoryKeys(flags) {
  if (!flags) return flags;
  const { configHistory: _h, scheduledConfigDeploys: _q, ...rest } = flags;
  return rest;
}

// ── Pre-deploy config review ─────────────────────────────────────────────────
// Human-readable diff of the local flag edits vs the last-loaded cloud config,
// shown by the "Review changes" button next to Deploy Config to Cloud.

const FLAG_LABELS = {
  enableFriends: "Social / Friends",
  enableExams: "Exams view",
  enableAttendance: "Attendance view",
  enableStatus: "Friend statuses",
  enableMeetups: "Meetup plans",
  maintenanceMode: "Maintenance mode",
  dispatchEnabled: "Push dispatch",
  wrappedReleaseDate: "TermFlow Wrapped release",
  heroBackdrop: "Hero backdrop strategy",
  classOverrides: "Class overrides",
  bannedUsers: "Banned users",
  scheduledAnnouncements: "Scheduled announcements",
  feedbackFlashes: "Feedback flashes",
  quickLinks: "Quick links",
  messMenuOverrides: "Mess menu overrides",
  adminRoles: "Admin roles",
  abTests: "A/B tests",
  whatsNew: "What's New",
  updatePrompt: "Update prompt",
};

function describeVal(v) {
  if (v === undefined || v === null) return "not set";
  if (typeof v === "boolean") return v ? "ON" : "OFF";
  if (typeof v === "string") return v === "" ? "empty" : `“${v.length > 60 ? v.slice(0, 57) + "…" : v}”`;
  if (typeof v === "number") return String(v);
  if (Array.isArray(v)) return `${v.length} item${v.length === 1 ? "" : "s"}`;
  const n = Object.keys(v).length;
  return `${n} entr${n === 1 ? "y" : "ies"}`;
}

// Best-effort display name for an item inside an array flag
function itemLabel(item) {
  if (item == null || typeof item !== "object") return String(item);
  return item.title || item.name || item.label
    || (typeof item.message === "string" ? `“${item.message.slice(0, 40)}${item.message.length > 40 ? "…" : ""}”` : null)
    || item.id || "(item)";
}

function diffFlagKey(key, before, after) {
  const details = [];
  const bothArrays = Array.isArray(before) && Array.isArray(after);
  const bothObjects = !bothArrays && before && after
    && typeof before === "object" && typeof after === "object"
    && !Array.isArray(before) && !Array.isArray(after);

  if (bothArrays) {
    const keyOf = (it, i) => (it && typeof it === "object" && it.id != null) ? `id:${it.id}` : JSON.stringify(it) || `#${i}`;
    const beforeMap = new Map(before.map((it, i) => [keyOf(it, i), it]));
    const afterMap = new Map(after.map((it, i) => [keyOf(it, i), it]));
    for (const [k, it] of afterMap) {
      if (!beforeMap.has(k)) details.push(`+ added ${itemLabel(it)}`);
      else if (JSON.stringify(beforeMap.get(k)) !== JSON.stringify(it)) details.push(`~ edited ${itemLabel(it)}`);
    }
    for (const [k, it] of beforeMap) {
      if (!afterMap.has(k)) details.push(`− removed ${itemLabel(it)}`);
    }
  } else if (bothObjects) {
    const subKeys = [...new Set([...Object.keys(before), ...Object.keys(after)])];
    for (const sk of subKeys) {
      const b = before[sk], a = after[sk];
      if (JSON.stringify(b) === JSON.stringify(a)) continue;
      if (b === undefined) details.push(`+ ${sk}: ${describeVal(a)}`);
      else if (a === undefined) details.push(`− ${sk} (was ${describeVal(b)})`);
      else details.push(`~ ${sk}: ${describeVal(b)} → ${describeVal(a)}`);
    }
  }

  return {
    key,
    label: FLAG_LABELS[key] || key,
    summary: `${describeVal(before)} → ${describeVal(after)}`,
    details: details.slice(0, 12),
    extra: details.length > 12 ? details.length - 12 : 0,
  };
}

function summarizeConfigChanges(orig, cur) {
  if (!orig) return [];
  const keys = [...new Set([...Object.keys(cur || {}), ...Object.keys(orig)])]
    .filter(k => k !== "configHistory");
  const out = [];
  for (const k of keys) {
    if (JSON.stringify(cur?.[k]) === JSON.stringify(orig[k])) continue;
    out.push(diffFlagKey(k, orig[k], cur?.[k]));
  }
  return out.sort((a, b) => a.label.localeCompare(b.label));
}

export default function AdminDashboard({ user, startImpersonation, syncLogs = [], timeOverride, setTimeOverride, allChanges = [] }) {
  const [totalUsers, setTotalUsers] = useState(null);
  const [activeUsers, setActiveUsers] = useState(0);
  const [statsLoading, setStatsLoading] = useState(true);
  const [dbSize, setDbSize] = useState("...");
  // Metrics fetch stays live (loadDashboardData); the display card was removed,
  // so the read halves are intentionally unused for now.
  const [_sysMetrics, setSysMetrics] = useState(null);
  const [_sysMetricsLoading, setSysMetricsLoading] = useState(false);
  const [_sysMetricsError, setSysMetricsError] = useState("");
  
  const [announcement, setAnnouncement] = useState("");
  const [activeAnnouncement, setActiveAnnouncement] = useState(null);
  
  const [showAllAdminNotifs, setShowAllAdminNotifs] = useState(false);

  // Top-level tab for the admin dashboard. Sections are grouped via `admin-g-*`
  // classes and shown/hidden with CSS keyed off [data-active-tab] on the masonry.
  const [activeTab, setActiveTab] = useState("broadcast");
  const [previewTheme, setPreviewTheme] = useState("dark"); // announcement banner preview

  const [flags, setFlags] = useState({
    enableFriends: true,
    enableExams: true,
    enableAttendance: true,
    maintenanceMode: false,
    bannedUsers: [],
    classOverrides: {},
    abTests: {},
    dispatchEnabled: true
  });
  
  const [popularCourses, setPopularCourses] = useState([]);
  const [overrideDate, setOverrideDate] = useState(new Date().toISOString().split("T")[0]);
  const [overrideClass, setOverrideClass] = useState("");
  const [overrideSection, setOverrideSection] = useState("All");

  const [bulkCsv, setBulkCsv] = useState("");
  const [copySourceDate, setCopySourceDate] = useState("");
  const [copyTargetDate, setCopyTargetDate] = useState("");
  const [roomOverrideDate, setRoomOverrideDate] = useState("");
  const [roomOverrideClass, setRoomOverrideClass] = useState("");
  const [roomOverrideRoom, setRoomOverrideRoom] = useState("");
  const [roomOverrideStart, setRoomOverrideStart] = useState("");
  const [roomOverrideEnd, setRoomOverrideEnd] = useState("");
  const [roomOverrideSection, setRoomOverrideSection] = useState("All");
  
  const [showAllLogs, setShowAllLogs] = useState(false);
  const displayedLogs = showAllLogs ? syncLogs : syncLogs.slice(0, 5);
  
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const [forceDeployReady, setForceDeployReady] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  // Set when the live config's updated_at no longer matches what we loaded —
  // i.e. another admin deployed since. Surfaces the concurrency guard (P2)
  // proactively in the review modal instead of only at deploy time.
  const [reviewDrift, setReviewDrift] = useState(null); // null | { when }

  const [allUsers, setAllUsers] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loadingUsers, setLoadingUsers] = useState(true);

  // New states
  const [feedbackList, setFeedbackList] = useState([]);
  const [feedbackFilter, setFeedbackFilter] = useState("pending");
  const [auditLogs, setAuditLogs] = useState([]);
  const [announcementTarget, setAnnouncementTarget] = useState("global");
  const [selectedUser, setSelectedUser] = useState(null);

  const [activeUsersListModalOpen, setActiveUsersListModalOpen] = useState(false);
  const [activeUsersSort, setActiveUsersSort] = useState("recent"); // "recent" | "name"
  const [pushSubscribersModalOpen, setPushSubscribersModalOpen] = useState(false);
  const [pushSubscribersList, setPushSubscribersList] = useState([]);

  // New states for added features
  const [pushSubCount, setPushSubCount] = useState("...");
  const [skipStats, setSkipStats] = useState([]);
  const [friendPingsCount, setFriendPingsCount] = useState("...");
  const [shareCodes, setShareCodes] = useState([]);
  const [userSectionFilter, setUserSectionFilter] = useState("All");

  // Scheduled Announcements State
  const [announcementStart, setAnnouncementStart] = useState("");
  const [announcementEnd, setAnnouncementEnd] = useState("");

  // Quick Links State
  const [qlTitle, setQlTitle] = useState("");
  const [qlUrl, setQlUrl] = useState("");
  const [qlStart, setQlStart] = useState("");
  const [qlEnd, setQlEnd] = useState("");

  // Push Notification Broadcast State
  const [pushTitle, setPushTitle] = useState("");
  const [pushBody, setPushBody] = useState("");
  const [pushUrl, setPushUrl] = useState("");
  const [pushSending, setPushSending] = useState(false);
  const [pushResult, setPushResult] = useState("");
  const [pushScheduleDate, setPushScheduleDate] = useState("");
  const [pushScheduleTime, setPushScheduleTime] = useState("");

  const [selectedUserIds, setSelectedUserIds] = useState(new Set());

  // What's New (feature updates) State
  const [wnEmoji, setWnEmoji] = useState("");
  const [wnTitle, setWnTitle] = useState("");
  const [wnDesc, setWnDesc] = useState("");
  const [wnEditingId, setWnEditingId] = useState(null);
  const [wnPreviewOpen, setWnPreviewOpen] = useState(false);

  // ── New admin-tools features ──
  const [activeTiers, setActiveTiers] = useState({ dau: 0, wau: 0, mau: 0 }); // active-user tiers
  const [pushStats, setPushStats] = useState(null); // broadcast delivery analytics (RPC)
  const [cronHealth, setCronHealth] = useState(null); // edge-fn / cron health (RPC)
  const [announcementSeverity, setAnnouncementSeverity] = useState("info"); // banner severity
  const [holidayStart, setHolidayStart] = useState("");
  const [holidayEnd, setHolidayEnd] = useState("");
  const [relocFrom, setRelocFrom] = useState("");
  const [relocTo, setRelocTo] = useState("");
  const [relocStart, setRelocStart] = useState("");
  const [relocEnd, setRelocEnd] = useState("");
  const [csvPreview, setCsvPreview] = useState(null); // dry-run summary of Bulk CSV
  const [roleUserId, setRoleUserId] = useState("");
  const [roleValue, setRoleValue] = useState("full");
  const [reEngaging, setReEngaging] = useState(false);
  const [reEngageMsg, setReEngageMsg] = useState("");
  const [inactiveDays, setInactiveDays] = useState(14);
  const configFileRef = useRef(null); // hidden file input for config import
  const [auditActionFilter, setAuditActionFilter] = useState("all");
  const [auditSearch, setAuditSearch] = useState("");
  const [pushTarget, setPushTarget] = useState("all"); // targeted push audience
  const [presentAdmins, setPresentAdmins] = useState([]); // realtime admin presence
  const [scheduleDeployAt, setScheduleDeployAt] = useState(""); // scheduled config deploy time
  const [relocEmail, setRelocEmail] = useState(""); // email→relocation parser input
  const [viewAsUser, setViewAsUser] = useState(null); // read-only "view as" impersonation
  const [viewAsDate, setViewAsDate] = useState(() => new Date().toISOString().split("T")[0]); // date picker for view-as schedule
  const [selfTest, setSelfTest] = useState(null); // aggregated self-test result
  const [selfTesting, setSelfTesting] = useState(false);
  const [tplLabel, setTplLabel] = useState(""); // new announcement-template name

  // Software Update Config
  const [updatePromptTitle, setUpdatePromptTitle] = useState("");
  const [updatePromptDesc, setUpdatePromptDesc] = useState("");
  const [updatePromptHighlights, setUpdatePromptHighlights] = useState("");

  // Social Flash Notification State
  const [socialFlashTitle, setSocialFlashTitle] = useState("⚡ New Social Update");
  const [socialFlashMsg, setSocialFlashMsg] = useState("Someone added a new status on TermFlow!");
  const [socialFlashIcon, setSocialFlashIcon] = useState("social");
  const [socialFlashDuration, setSocialFlashDuration] = useState(6000);
  const [socialFlashUrl, setSocialFlashUrl] = useState("");
  const [socialFlashSending, setSocialFlashSending] = useState(false);
  const [socialFlashStatus, setSocialFlashStatus] = useState("");

  async function triggerSocialFlashBroadcast() {
    setSocialFlashSending(true);
    setSocialFlashStatus("");
    try {
      const payload = {
        title: socialFlashTitle.trim() || "⚡ New Social Update",
        message: socialFlashMsg.trim() || "Someone added a new status on TermFlow!",
        iconType: socialFlashIcon,
        duration: parseInt(socialFlashDuration, 10) || 6000,
        url: socialFlashUrl.trim() || null,
        timestamp: Date.now()
      };
      
      const channel = supabase.channel("social-flash-channel");
      await channel.subscribe();
      await channel.send({
        type: "broadcast",
        event: "social-flash",
        payload
      });

      window.dispatchEvent(new CustomEvent("social-flash-trigger", { detail: payload }));
      
      setSocialFlashStatus("Broadcast sent live to active users!");
      setTimeout(() => setSocialFlashStatus(""), 4000);
    } catch (err) {
      setSocialFlashStatus("Failed: " + err.message);
    } finally {
      setSocialFlashSending(false);
    }
  }

  function testSocialFlashLocal() {
    const payload = {
      title: socialFlashTitle.trim() || "⚡ New Social Update",
      message: socialFlashMsg.trim() || "Someone added a new status on TermFlow!",
      iconType: socialFlashIcon,
      duration: parseInt(socialFlashDuration, 10) || 6000,
      url: socialFlashUrl.trim() || null,
      timestamp: Date.now()
    };
    window.dispatchEvent(new CustomEvent("social-flash-trigger", { detail: payload }));
  }

  // Feedback Flash Config
  const [feedbackFlashes, setFeedbackFlashes] = useState([]);
  const [previewFlashId, setPreviewFlashId] = useState(null);
  // Minute tick so flash status badges/countdowns stay current while the page sits open
  const [flashNow, setFlashNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setFlashNow(Date.now()), 60000);
    return () => clearInterval(t);
  }, []);

  // ── Broadcast Tab Accordion & Announcement Revamp States ──
  const [annFilter, setAnnFilter] = useState("all"); // "all" | "active" | "upcoming" | "expired"
  const [annSearch, setAnnSearch] = useState("");
  const [editingAnnId, setEditingAnnId] = useState(null);
  const [editAnnMsg, setEditAnnMsg] = useState("");
  const [editAnnStart, setEditAnnStart] = useState("");
  const [editAnnEnd, setEditAnnEnd] = useState("");
  const [editAnnTarget, setEditAnnTarget] = useState("global");
  const [editAnnSeverity, setEditAnnSeverity] = useState("info");

  // ── Broadcast Tab Accordion States ──
  const [openBcast, setOpenBcast] = useState({ announcements: true, push: false, social: false });
  const [openContent, setOpenContent] = useState({ whatsNew: true, quickLinks: false, updatePrompt: false });

  // ── Command Centre State (Week View + Quick Actions + Undo Stack) ──
  const [cmdSection, setCmdSection] = useState("All");       // "All" | "A" | "B"
  const [cmdUndoStack, setCmdUndoStack] = useState([]);      // [{ label, prevOverrides }]
  const [cmdQuickRoom, setCmdQuickRoom] = useState(null);    // { classKey, date } | null
  const [cmdQuickRoomValue, setCmdQuickRoomValue] = useState("");
  const [draggedIdx, setDraggedIdx] = useState(null);        // idx of dragged class card
  // ── Active Overrides Hub State ──
  const [ovrFilterType, setOvrFilterType] = useState("all"); // all|cancelled|room|time|exam|custom
  const [ovrSearch, setOvrSearch] = useState("");
  const [ovrEditKey, setOvrEditKey] = useState(null);        // "date::code" being edited inline
  const [ovrEditValues, setOvrEditValues] = useState({ room: "", start: "", end: "" });

  // Live Editor State
  const [liveSchedule] = useState(() => getSnapshot().CLASSES || []);
  const [liveEditorDate, setLiveEditorDate] = useState(new Date().toISOString().split("T")[0]);
  const [liveEditorModal, setLiveEditorModal] = useState(null);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);

  // Database Data Explorer State
  const [dbTable, setDbTable] = useState("profiles");
  const [dbRows, setDbRows] = useState([]);
  const [dbLoading, setDbLoading] = useState(false);
  const [dbError, setDbError] = useState("");

  // Keep original fetched config for diffing
  const [originalFlags, setOriginalFlags] = useState(null);
  // `updated_at` of the config row as we last loaded/saved it. Used as an
  // optimistic-concurrency token so a second admin's Deploy can't silently
  // clobber a first admin's just-saved changes (last-write-wins guard).
  const [loadedUpdatedAt, setLoadedUpdatedAt] = useState(null);
  // Undo toast for destructive one-click actions. Local-state deletes (list
  // items, bans) fire immediately with no confirm; this gives a short grace
  // window to reverse an accidental click before it's Deployed.
  const [undoToast, setUndoToast] = useState(null); // { label, undo, key }

  // API Health Check — live ping results
  const [healthStatus, setHealthStatus] = useState({ supabase: null, sheets: null, push: null });
  const [healthChecking, setHealthChecking] = useState(false);

  // 7-day activity analytics (index 0 = 6 days ago, index 6 = today)
  const [activityChartData, setActivityChartData] = useState(Array(7).fill(0));
  const [peakHour, setPeakHour] = useState(null);

  // Weekly Presence card — selected day index (0 = 6 days ago, 6 = today), sort mode, hour filter
  const [weeklyPresenceDay, setWeeklyPresenceDay] = useState(null);
  const [weeklyPresenceSort, setWeeklyPresenceSort] = useState("time"); // "time" | "name"
  const [weeklyPresenceHourFilter, setWeeklyPresenceHourFilter] = useState(null); // null = all


  // Reactive flag — avoids stale localStorage.getItem() at render time
  const [_hasAdminKey, setHasAdminKey] = useState(() => !!localStorage.getItem("pgp2.push-admin-key"));

  // Live Editor Modal — controlled input state (replaces document.getElementById anti-pattern)
  const [modalSection, setModalSection] = useState("All");
  const [modalRoom, setModalRoom] = useState("");
  const [modalStart, setModalStart] = useState("");
  const [modalEnd, setModalEnd] = useState("");
  const [modalCode, setModalCode] = useState("");
  const [modalName, setModalName] = useState("");
  const [modalIsNew, setModalIsNew] = useState(false);

  // Modern Mobile UI Toggle
  const [isModernUi, setIsModernUi] = useState(() => {
    return localStorage.getItem("pgp2.admin-modern-ui") !== "false";
  });
  useEffect(() => {
    localStorage.setItem("pgp2.admin-modern-ui", isModernUi);
  }, [isModernUi]);

  // A/B Test editor
  const [abTestName, setAbTestName] = useState("");
  const [abTestRollout, setAbTestRollout] = useState(50);

  const admin_id = user?.id || user?.user_id || "unknown";

  // Realtime presence — who else is in the admin panel right now
  useEffect(() => {
    const ch = supabase.channel("admin-presence", { config: { presence: { key: admin_id } } });
    ch.on("presence", { event: "sync" }, () => {
      const state = ch.presenceState();
      const seen = {}; const uniq = [];
      Object.values(state).flat().forEach(p => { if (p?.id && !seen[p.id]) { seen[p.id] = 1; uniq.push({ id: p.id, name: p.name }); } });
      setPresentAdmins(uniq);
    });
    ch.subscribe(async status => {
      if (status === "SUBSCRIBED") await ch.track({ id: admin_id, name: user?.firstName || user?.username || "Admin" });
    });
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [admin_id]);

  useEffect(() => {
    if (activeTab === "database") {
      let isMounted = true;
      setDbLoading(true); setDbError("");
      supabase.from(dbTable).select("*").limit(50).then(({ data, error }) => {
        if (!isMounted) return;
        if (error) setDbError(error.message);
        else setDbRows(data || []);
        setDbLoading(false);
      });
      return () => { isMounted = false; };
    }
  }, [activeTab, dbTable]);

  useEffect(() => {
    const handleOpen = () => setIsCommandPaletteOpen(true);
    document.addEventListener("open-admin-command-palette", handleOpen);
    return () => document.removeEventListener("open-admin-command-palette", handleOpen);
  }, []);

  const fetchSysMetrics = async () => {
    let adminKey = localStorage.getItem("pgp2.push-admin-key") || "";
    if (!adminKey) return;
    setSysMetricsLoading(true);
    setSysMetricsError("");
    try {
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-metrics`, {
        headers: { "x-admin-key": adminKey }
      });
      if (!resp.ok) {
        setSysMetricsError(`Failed to fetch metrics: ${resp.status}`);
      } else {
        const data = await resp.json();
        setSysMetrics(data.metrics);
      }
    } catch (e) {
      setSysMetricsError(e.message);
    }
    setSysMetricsLoading(false);
  };

  // Kept for the (currently unwired) metrics card — underscore keeps lint quiet.
  const _promptAdminKey = () => {
    const key = prompt("Enter the Admin Secret Key (set as ADMIN_SECRET or PUSH_ADMIN_SECRET in Supabase):");
    if (key) {
      localStorage.setItem("pgp2.push-admin-key", key);
      setHasAdminKey(true);
      fetchSysMetrics();
    }
  };

  // Fetches everything; loading flags start true at mount, so only the manual
  // Refresh action needs to flip them back on (see fetchDashboardData below).
  const loadDashboardData = async () => {
    async function fetchStatsAndUsers() {
      try {
        // profiles still holds pre-cutover DEV ghost rows (kept as the data
        // source for migrate-user's on-login restore). Exclude them so the
        // stats reflect the Clerk PROD instance. If the RPC is gone (post
        // Phase 2 cleanup) the filter is simply empty.
        const [{ data, error }, devIdsRes] = await Promise.all([
          supabase.from("profiles").select("user_id, email, courses, last_seen_at, updated_at"),
          supabase.rpc("get_dev_user_ids"),
        ]);
        const devIds = new Set((devIdsRes.data || []).map(r => (typeof r === "string" ? r : r.dev_user_id)));
        if (error) {
          console.error("Supabase Error:", error);
          setTotalUsers("Error: " + error.message);
        } else if (data) {
          const prodRows = data.filter(d => !devIds.has(d.user_id));
          setTotalUsers(prodRows.length);
          let allEnrolled = [];
          const usersWithNames = prodRows.map(d => {
            if (d.courses) {
               const courses = Object.keys(d.courses).filter(c => !c.startsWith("_"));
               allEnrolled.push(...courses);
            }
            return {
              user_id: d.user_id,
              email: d.email,
              name: d.courses?._name || "Student",
              courses: d.courses,
              last_seen_at: d.last_seen_at
            };
          });
          setAllUsers(usersWithNames);

          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const todayTs = today.getTime();

          // True DAU (active since midnight local time)
          const dau = prodRows.filter(d => d.last_seen_at && new Date(d.last_seen_at).getTime() >= todayTs).length;
          setActiveUsers(dau);

          // Rolling active-user tiers (last 1 / 7 / 30 days) for retention at a glance
          const nowTs = Date.now();
          const within = days => prodRows.filter(d => d.last_seen_at && (nowTs - new Date(d.last_seen_at).getTime()) <= days * 86400000).length;
          setActiveTiers({ dau, wau: within(7), mau: within(30) });

          // Build 7-day calendar bar chart and peak hour using prod users only
          const counts = Array(7).fill(0);
          const hourCounts = Array(24).fill(0);
          prodRows.forEach(row => {
             if (!row.last_seen_at) return;
             const rowDate = new Date(row.last_seen_at);
             hourCounts[rowDate.getHours()]++;
             rowDate.setHours(0, 0, 0, 0);
             const daysAgo = Math.round((todayTs - rowDate.getTime()) / 86400000);
             if (daysAgo >= 0 && daysAgo < 7) counts[6 - daysAgo]++;
          });
          setActivityChartData(counts);
          setPeakHour(hourCounts.indexOf(Math.max(...hourCounts, 0)));

          // Tally popular courses
          const courseCounts = {};
          allEnrolled.forEach(c => { courseCounts[c] = (courseCounts[c] || 0) + 1; });
          const topCourses = Object.entries(courseCounts).sort((a,b) => b[1] - a[1]).slice(0, 3);
          setPopularCourses(topCourses);
        } else {
          setTotalUsers("No data returned");
        }
      } catch (e) {
        console.error("Fetch Error:", e);
        setTotalUsers("Error: " + e.message);
      }
    }

    async function fetchDbSize() {
      try {
        const { data, error } = await supabase.rpc("get_db_size");
        if (error) {
          setDbSize("Error");
        } else {
          setDbSize(data || "N/A");
        }
      } catch (e) {
        setDbSize("Error");
      }
    }

    async function fetchFeedbackAndLogs() {
      const { data: fb } = await supabase.from("feedback").select("*").order("created_at", { ascending: false }).limit(20);
      if (fb) setFeedbackList(fb);

      const { data: logs } = await supabase.from("admin_audit_logs").select("*").order("created_at", { ascending: false }).limit(200);
      if (logs) setAuditLogs(logs);
    }

    async function fetchInsightsRpcs() {
      // Both are SECURITY DEFINER RPCs (see 20260731120000_admin_insights_rpcs.sql).
      // If not yet deployed, leave state null so the cards show a "deploy" hint.
      const { data: ps, error: psErr } = await supabase.rpc("get_push_broadcast_stats");
      if (!psErr && Array.isArray(ps)) setPushStats(ps);
      const { data: ch, error: chErr } = await supabase.rpc("get_cron_health");
      if (!chErr && Array.isArray(ch)) setCronHealth(ch);
    }

    async function fetchExtraAdminStats() {
      try {
        const { data: sc } = await supabase.from("share_codes").select("*");
        if (sc) setShareCodes(sc);

        // push_subscriptions / friend_pings / attendance are RLS-locked to the
        // requesting user, so counting them client-side only sees the admin's
        // own rows. get_admin_stats() (SECURITY DEFINER) returns true
        // cohort-wide aggregates; fall back to the clipped counts if the RPC
        // is ever dropped.
        const { data: stats, error: statsErr } = await supabase.rpc("get_admin_stats");
        if (!statsErr && stats) {
          setPushSubCount(stats.push_subscriptions ?? 0);
          setFriendPingsCount(stats.friend_pings ?? 0);
          setSkipStats(stats.skips_by_course || []);
          if (stats.push_user_ids) {
            setPushSubscribersList(stats.push_user_ids);
          }
          return;
        }

        const { count: pCount } = await supabase.from("push_subscriptions").select("*", { count: "exact", head: true });
        setPushSubCount(pCount ?? 0);

        const { count: fCount } = await supabase.from("friend_pings").select("*", { count: "exact", head: true });
        setFriendPingsCount(fCount ?? 0);

        const { data: att } = await supabase.from("attendance").select("session_key, status").eq("status", "absent");
        if (att) {
           const skipsByCourse = {};
           att.forEach(a => {
              // session_key: YYYY-MM-DD_HH:MM_CODE_SECTION
              const parts = a.session_key.split("_");
              if (parts.length >= 3) {
                 const code = parts[2];
                 skipsByCourse[code] = (skipsByCourse[code] || 0) + 1;
              }
           });
           const topSkips = Object.entries(skipsByCourse).sort((a,b) => b[1] - a[1]).slice(0, 5);
           setSkipStats(topSkips);
        }
      } catch (e) {
         // ignore
      }
    }

    await Promise.all([
      fetchStatsAndUsers(),
      fetchDbSize(),
      fetchFeedbackAndLogs(),
      fetchSysMetrics(),
      fetchExtraAdminStats(),
      fetchInsightsRpcs()
    ]);
    
    setStatsLoading(false);
    setLoadingUsers(false);
  };

  // Manual Refresh action — an event handler, so sync setState here is fine
  const fetchDashboardData = () => {
    setStatsLoading(true);
    setLoadingUsers(true);
    return loadDashboardData();
  };

  useEffect(() => {
    // All setState calls inside happen after awaits; the analyzer just can't
    // see through Promise.all of async fns. Loading flags already default true.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadDashboardData();

    async function fetchConfig() {
      try {
        const { data } = await supabase.from("system_config").select("*").eq("id", "global").single();
        if (data) {
          setLoadedUpdatedAt(data.updated_at ?? null);
          if (data.announcement) {
            setActiveAnnouncement(data.announcement);
            setAnnouncement(data.announcement);
          }
          if (data.flags) {
            setFlags(prev => ({ ...prev, ...data.flags }));
            setOriginalFlags(data.flags);
            if (data.flags.updatePrompt) {
              setUpdatePromptTitle(data.flags.updatePrompt.title || "");
              setUpdatePromptDesc(data.flags.updatePrompt.desc || "");
              setUpdatePromptHighlights(data.flags.updatePrompt.highlights?.join("\n") || "");
            }
            if (data.flags.feedbackFlashes) {
              setFeedbackFlashes(data.flags.feedbackFlashes);
            } else if (data.flags.feedbackFlash) {
              setFeedbackFlashes([{ ...data.flags.feedbackFlash, id: Date.now().toString() }]);
            }
          }
        }
      } catch (e) {
        // Table likely doesn't exist yet
      }
    }
    fetchConfig();
    // Mount-only initial load. loadDashboardData is recreated each render, so
    // listing it would refetch on every render — the empty deps are intentional.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const changesCount = originalFlags ? Object.keys(flags).reduce((acc, k) => {
    if (JSON.stringify(flags[k]) !== JSON.stringify(originalFlags[k])) return acc + 1;
    return acc;
  }, 0) : 0;

  // Warn on tab close when there are unsaved config changes
  useEffect(() => {
    if (changesCount === 0) return;
    const handler = (e) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
   
  }, [changesCount]);

  async function saveConfig({ force = false } = {}) {
    if (flags.adminRoles && flags.adminRoles[admin_id] === "monitor") {
       return alert("You only have 'Monitor' access. Configuration changes are disabled for your role.");
    }
    setSaving(true);
    setSaveMsg("");
    try {
      // Ensure announcedAt is set for newly enabled flashes
      const updatedFlashes = feedbackFlashes.map(ff => {
        const originalFf = originalFlags?.feedbackFlashes?.find(o => o.id === ff.id) || 
                           (originalFlags?.feedbackFlash && originalFlags.feedbackFlash.id === ff.id ? originalFlags.feedbackFlash : null);
        
        let announcedAt = ff.announcedAt;
        if (ff.enabled && (!originalFf?.enabled || originalFf?.deadline !== ff.deadline)) {
            announcedAt = new Date().toISOString();
        }
        return { ...ff, announcedAt };
      });

      const newFlags = {
        ...flags,
        updatePrompt: {
          title: updatePromptTitle,
          desc: updatePromptDesc,
          highlights: updatePromptHighlights.split("\n").filter(l => l.trim())
        },
        feedbackFlashes: updatedFlashes
      };
      
      // Clean up legacy flag
      delete newFlags.feedbackFlash;
      
      // Snapshot the PREVIOUS config for rollback, but strip its own history/queue
      // first — otherwise each entry re-embeds all prior snapshots and the config
      // row grows exponentially (the main cause of slow deploys).
      const prevSnapshot = stripHistoryKeys(originalFlags || {});
      const historyEntry = {
         timestamp: new Date().toISOString(),
         flags: prevSnapshot,
         author: admin_id
      };
      // Defensively re-strip carried-forward entries too: a restored pre-fix
      // snapshot could still carry an embedded history that would otherwise nest.
      const carried = (newFlags.configHistory || []).map(h => (
         h && h.flags ? { ...h, flags: stripHistoryKeys(h.flags) } : h
      ));
      newFlags.configHistory = [historyEntry, ...carried].slice(0, 15);

      const nextUpdatedAt = new Date().toISOString();
      const row = { id: "global", announcement: activeAnnouncement, flags: newFlags, updated_at: nextUpdatedAt };

      // Optimistic-concurrency guard: if the config row already existed when
      // we loaded it, only write when its updated_at still matches what we
      // read. If another admin Deployed in the meantime the guarded update
      // touches 0 rows — we abort instead of silently clobbering their work.
      // force=true bypasses this check (used by Force Deploy after a conflict).
      let error = null, conflicted = false;
      if (force) {
        // Unconditional overwrite — admin explicitly chose to overwrite.
        // Use update (not upsert) so we don't trigger the INSERT RLS policy.
        const { error: upErr } = await supabase.from("system_config").update(row).eq("id", "global");
        error = upErr;
      } else if (loadedUpdatedAt) {
        const { data: updRows, error: updErr } = await supabase
          .from("system_config")
          .update(row)
          .eq("id", "global")
          .eq("updated_at", loadedUpdatedAt)
          .select("updated_at");
        error = updErr;
        conflicted = !updErr && (!updRows || updRows.length === 0);
      } else {
        // First-ever save (no row yet) — plain upsert.
        const { error: upErr } = await supabase.from("system_config").upsert(row);
        error = upErr;
      }

      if (conflicted) {
        // Fetch the current updated_at so the admin can force-overwrite in one click
        const { data: cur } = await supabase
          .from("system_config").select("updated_at").eq("id", "global").single();
        const when = cur?.updated_at ? new Date(cur.updated_at).toLocaleTimeString() : "just now";
        if (cur?.updated_at) setLoadedUpdatedAt(cur.updated_at); // sync so force-deploy works
        setSaveMsg(`⚠ Another deploy happened at ${when}. Force deploy to overwrite.`);
        setForceDeployReady(true);
      } else if (error) {
        setSaveMsg("Failed: " + error.message);
      } else {
        setForceDeployReady(false);
        setOriginalFlags(newFlags);
        setLoadedUpdatedAt(nextUpdatedAt);
        setSaveMsg("Successfully saved to cloud!");
        setTimeout(() => setSaveMsg(""), 3000);
        logAdminAction(admin_id, "save_config", {
          changes: changesCount,
          announcement: activeAnnouncement || null,
        });
      }
    } catch (e) {
      setSaveMsg("Error saving config.");
    }
    setSaving(false);
  }

  function getPushKey() {
    let pushKey = localStorage.getItem("pgp2.push-admin-key") || "";
    if (!pushKey) {
      pushKey = prompt("Enter the push admin key (PUSH_ADMIN_SECRET set on the send-push edge function):") || "";
      if (!pushKey) return "";
      localStorage.setItem("pgp2.push-admin-key", pushKey);
    }
    return pushKey;
  }

  // Shared push sender. Pass a targetUserId to deliver only to that user's devices
  // (used by "Send test to me"); omit it to broadcast to everyone.
  async function postPush({ targetUserId } = {}) {
    const pushKey = getPushKey();
    if (!pushKey) return;
    setPushSending(true);
    setPushResult("");
    try {
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-push`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-push-key": pushKey,
          "Authorization": `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          title: pushTitle.trim(),
          body: pushBody.trim(),
          url: pushUrl.trim() || "/",
          ...(targetUserId ? { target_user_id: targetUserId } : {}),
        }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        if (resp.status === 401) localStorage.removeItem("pgp2.push-admin-key");
        setPushResult(`Failed: ${data.error || resp.status}`);
      } else if (targetUserId) {
        setPushResult("Test queued to your devices — should arrive within ~1 min.");
        await logAdminAction(admin_id, "push_test", { title: pushTitle.trim() });
      } else {
        const n = data.sent ?? data.queued ?? 0;
        setPushResult(`Sent to ${n} device${n !== 1 ? "s" : ""}${data.failed ? `, ${data.failed} failed` : ""}${data.pruned ? `, ${data.pruned} stale pruned` : ""}.`);
        setPushTitle(""); setPushBody(""); setPushUrl("");
        await logAdminAction(admin_id, "push_broadcast", { title: pushTitle.trim() });
      }
    } catch (e) {
      setPushResult("Error: " + e.message);
    }
    setPushSending(false);
  }

  async function sendPushBroadcast() {
    if (!pushTitle.trim() || !pushBody.trim()) return alert("Fill in title and message.");
    const dup = recentDuplicatePush(pushTitle);
    if (dup && !confirm(`⚠️ A push titled "${dup.title}" was already sent ${Math.round((nowMs() - new Date(dup.sent_at).getTime()) / 60000)} min ago to ${dup.total} device(s).\n\nSend this one anyway?`)) return;
    if (inQuietHours(nowMs()) && !confirm(`⚠️ It's currently quiet hours (${quietHours.start}–${quietHours.end} IST). Sending now will buzz every device.\n\nSend anyway?`)) return;
    if (!confirm(`Send this push notification to ALL subscribed devices?\n\n${pushTitle}\n${pushBody}`)) return;
    await postPush();
  }

  async function sendTestPushToMe() {
    if (!pushTitle.trim() || !pushBody.trim()) return alert("Fill in title and message.");
    await postPush({ targetUserId: admin_id });
  }

  // ── Audience-size preview ──
  // Estimates how many loaded users match an announcement/push target. Mirrors
  // announcementTargetMatches() in App.jsx. Returns null when it can't be known
  // client-side (e.g. has_friends, which isn't in the profiles projection).
  function audienceCount(target) {
    if (!target || target === "global") return allUsers.length;
    if (target === "has_friends") return null;
    if (target === "section_A" || target === "section_B") {
      const s = target.endsWith("A") ? "_A" : "_B";
      return allUsers.filter(u => Object.keys(u.courses || {}).some(c => c.endsWith(s))).length;
    }
    if (target.startsWith("subject_")) {
      const code = target.replace("subject_", "");
      return allUsers.filter(u => Object.keys(u.courses || {}).some(c => c === code || c.startsWith(code + "_"))).length;
    }
    return null;
  }

  // ── Holiday / day-off bulk cancel ──
  function applyHolidayCancel() {
    if (!holidayStart || !holidayEnd) return alert("Pick a start and end date.");
    if (holidayEnd < holidayStart) return alert("End date must be after start date.");
    const affected = liveSchedule.filter(c => c.date >= holidayStart && c.date <= holidayEnd && c.type !== "break");
    if (affected.length === 0) return alert("No classes found in that range.");
    if (!confirm(`Cancel ${affected.length} class(es) between ${holidayStart} and ${holidayEnd}? This writes overrides — deploy to apply.`)) return;
    const next = { ...flags.classOverrides };
    affected.forEach(c => {
      const key = makeOverrideKey(classIdent(c), c.section);
      next[c.date] = { ...(next[c.date] || {}), [key]: { type: "cancelled", modifiedAt: new Date().toISOString(), modifiedBy: admin_id } };
    });
    setFlags({ ...flags, classOverrides: next });
    logAdminAction(admin_id, "holiday_cancel", { start: holidayStart, end: holidayEnd, count: affected.length });
    setHolidayStart(""); setHolidayEnd("");
    alert(`Staged ${affected.length} cancellations. Review & Deploy Config to apply.`);
  }

  // ── Bulk room relocation (e.g. "all A01 classes → A04" for a date range) ──
  function applyRoomRelocation() {
    const from = relocFrom.trim(), to = relocTo.trim();
    if (!from || !to || !relocStart || !relocEnd) return alert("Fill from-room, to-room and both dates.");
    if (relocEnd < relocStart) return alert("End date must be after start date.");
    const affected = liveSchedule.filter(c => c.date >= relocStart && c.date <= relocEnd && c.type !== "break" && (c.room || "").toLowerCase() === from.toLowerCase());
    if (affected.length === 0) return alert(`No classes found in room ${from} in that range.`);
    if (!confirm(`Move ${affected.length} class(es) from ${from} to ${to} between ${relocStart} and ${relocEnd}? Stages overrides — Review & Deploy to apply.`)) return;
    const next = { ...flags.classOverrides };
    affected.forEach(c => {
      const key = makeOverrideKey(classIdent(c), c.section);
      const existing = next[c.date]?.[key] || {};
      // keep any existing time override, just swap the room
      next[c.date] = { ...(next[c.date] || {}), [key]: { type: "class", ...existing, room: to, modifiedAt: new Date().toISOString(), modifiedBy: admin_id } };
    });
    setFlags({ ...flags, classOverrides: next });
    logAdminAction(admin_id, "room_relocation", { from, to, start: relocStart, end: relocEnd, count: affected.length });
    setRelocFrom(""); setRelocTo(""); setRelocStart(""); setRelocEnd("");
    alert(`Staged ${affected.length} room change(s). Review & Deploy Config to apply.`);
  }

  // ── Email → Room Relocation parser ──────────────────────────
  // Reads a pasted notice like "A01 will be shifted to A04 from 5 Aug to 12 Aug"
  // and pre-fills the Room Relocation form (rooms + date range). Best-effort:
  // fills what it can find, leaves the rest for the admin to complete.
  function parseRelocationEmail() {
    const text = (relocEmail || "").trim();
    if (!text) return alert("Paste the email / notice text first.");
    let filled = [];
    // Rooms: first two room-like tokens (letter(s)+digits), or an explicit "X → Y"
    const arrow = text.match(/\b([A-Z]{1,3}-?\d{1,3})\b\s*(?:→|->|to|shifted to|moved to|changed to)\s*([A-Z]{1,3}-?\d{1,3})\b/i);
    if (arrow) {
      setRelocFrom(arrow[1].toUpperCase()); setRelocTo(arrow[2].toUpperCase());
      filled.push(`room ${arrow[1].toUpperCase()} → ${arrow[2].toUpperCase()}`);
    } else {
      const rooms = [...text.matchAll(/\b([A-Z]{1,3}-?\d{1,3})\b/g)].map(m => m[1].toUpperCase());
      if (rooms[0]) { setRelocFrom(rooms[0]); filled.push(`from ${rooms[0]}`); }
      if (rooms[1]) { setRelocTo(rooms[1]); filled.push(`to ${rooms[1]}`); }
    }
    // Dates: ISO first, else "5 Aug", "Aug 5", "05/08/2026"
    const dates = extractDates(text);
    if (dates[0]) { setRelocStart(dates[0]); filled.push(`from ${dates[0]}`); }
    if (dates[1]) { setRelocEnd(dates[1]); filled.push(`to ${dates[1]}`); }
    else if (dates[0]) { setRelocEnd(dates[0]); } // single-day notice
    alert(filled.length ? `Pre-filled: ${filled.join(", ")}.\nReview the Room Relocation fields below, then Relocate.` : "Couldn't find rooms or dates — fill the form manually.");
  }

  // Extract up to 2 dates (chronological) from free text → ["YYYY-MM-DD", ...]
  function extractDates(text) {
    const MONTHS = { jan:0,feb:1,mar:2,apr:3,may:4,jun:5,jul:6,aug:7,sep:8,oct:9,nov:10,dec:11 };
    const yr = new Date().getFullYear();
    const found = [];
    // ISO
    [...text.matchAll(/\b(\d{4})-(\d{2})-(\d{2})\b/g)].forEach(m => found.push(`${m[1]}-${m[2]}-${m[3]}`));
    // "5 Aug" / "5th August" / "Aug 5"
    const iso = (y, mo, d) => `${y}-${String(mo + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    [...text.matchAll(/\b(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]{3,})\b/g)].forEach(m => {
      const mo = MONTHS[m[2].slice(0, 3).toLowerCase()];
      if (mo !== undefined) found.push(iso(yr, mo, +m[1]));
    });
    [...text.matchAll(/\b([A-Za-z]{3,})\s+(\d{1,2})(?:st|nd|rd|th)?\b/g)].forEach(m => {
      const mo = MONTHS[m[1].slice(0, 3).toLowerCase()];
      if (mo !== undefined) found.push(iso(yr, mo, +m[2]));
    });
    // dd/mm/yyyy or dd/mm
    [...text.matchAll(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/g)].forEach(m => {
      const y = m[3] ? (m[3].length === 2 ? 2000 + +m[3] : +m[3]) : yr;
      found.push(iso(y, +m[2] - 1, +m[1]));
    });
    return [...new Set(found)].sort();
  }

  // ── Quiet hours: block broadcasts during a configured IST window ─────
  const quietHours = flags.quietHours || { enabled: false, start: "23:00", end: "07:00" };
  // Pass a timestamp (render passes the minute-tick `flashNow`; handlers pass Date.now())
  function inQuietHours(nowMs) {
    if (!quietHours.enabled) return false;
    // current IST wall-clock minutes
    const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(new Date(nowMs ?? LOAD_NOW));
    const h = +parts.find(p => p.type === "hour").value, m = +parts.find(p => p.type === "minute").value;
    const cur = h * 60 + m;
    const [sh, sm] = (quietHours.start || "23:00").split(":").map(Number);
    const [eh, em] = (quietHours.end || "07:00").split(":").map(Number);
    const s = sh * 60 + sm, e = eh * 60 + em;
    return s <= e ? (cur >= s && cur < e) : (cur >= s || cur < e); // handle overnight window
  }

  // ── Announcement template library (stored in flags.announcementTemplates) ──
  function saveAnnouncementTemplate() {
    const label = tplLabel.trim();
    if (!label) return alert("Name the template first.");
    if (!announcement?.trim()) return alert("Type an announcement above to save as a template.");
    const entry = { id: Date.now().toString(), label, text: announcement, severity: announcementSeverity };
    setFlags({ ...flags, announcementTemplates: [...(flags.announcementTemplates || []), entry] });
    setTplLabel("");
  }
  function applyAnnouncementTemplate(t) {
    setAnnouncement(t.text);
    if (t.severity) setAnnouncementSeverity(t.severity);
  }
  function removeAnnouncementTemplate(id) {
    const prev = flags.announcementTemplates || [];
    setFlags({ ...flags, announcementTemplates: prev.filter(t => t.id !== id) });
    removeWithUndo("Template removed", () => setFlags(f => ({ ...f, announcementTemplates: prev })));
  }

  // ── Override-only expiry cleanup (past-dated classOverrides) ──
  function purgeStaleOverrides() {
    if (staleOverrideDates.length === 0) return;
    if (!window.confirm(`Remove ${staleOverrideDates.length} past-dated override date(s)? Deploy afterwards to shrink the config students download.`)) return;
    const next = { ...(flags.classOverrides || {}) };
    staleOverrideDates.forEach(d => delete next[d]);
    setFlags({ ...flags, classOverrides: next });
    logAdminAction(admin_id, "purge_stale_overrides", { dates: staleOverrideDates.length });
  }

  // ── Aggregated self-test: ping every service in one click ─────────────
  async function runSelfTest() {
    setSelfTesting(true); setSelfTest(null);
    const checks = [];
    // 1. Supabase DB
    try { const t = Date.now(); const { error } = await supabase.from("system_config").select("id").limit(1); checks.push({ name: "Supabase DB", ok: !error, detail: error ? error.message : `${Date.now() - t}ms` }); }
    catch (e) { checks.push({ name: "Supabase DB", ok: false, detail: e.message }); }
    // 2. Insights RPCs
    try { const { error } = await supabase.rpc("get_push_broadcast_stats"); checks.push({ name: "Insights RPCs", ok: !error, detail: error ? error.message : "responding" }); }
    catch (e) { checks.push({ name: "Insights RPCs", ok: false, detail: e.message }); }
    // 3. Cron health (via RPC) — flag any job that hasn't run in >2h
    try {
      const { data, error } = await supabase.rpc("get_cron_health");
      if (error) checks.push({ name: "Cron jobs", ok: false, detail: error.message });
      else {
        const stale = (data || []).filter(j => !j.last_run || (LOAD_NOW - new Date(j.last_run).getTime()) > 2 * 3600000);
        checks.push({ name: "Cron jobs", ok: stale.length === 0, detail: stale.length ? `${stale.length} stale: ${stale.map(s => s.jobname || s.jobid).join(", ")}` : `${(data || []).length} healthy` });
      }
    } catch (e) { checks.push({ name: "Cron jobs", ok: false, detail: e.message }); }
    // 4. send-push edge fn reachable
    try {
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-push`, {
        method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`, "x-push-key": "__health_check__" },
        body: JSON.stringify({ __healthcheck: true }),
      });
      checks.push({ name: "send-push fn", ok: resp.status < 500, detail: `HTTP ${resp.status}` });
    } catch (e) { checks.push({ name: "send-push fn", ok: false, detail: e.message }); }
    // 5. Google Sheets feed
    const FEED_URL = "https://script.google.com/macros/s/AKfycbwOCmpZAbzN7hRkb-xx6-SDejt3c45E5NBZ0NHuJW8CBRYO4ROJfwE_MI_g4aODwo08Gg/exec";
    try { const ctrl = new AbortController(); const timer = setTimeout(() => ctrl.abort(), 6000); const resp = await fetch(`${FEED_URL}?action=ping`, { signal: ctrl.signal }); clearTimeout(timer); checks.push({ name: "Sheets feed", ok: resp.ok, detail: resp.ok ? "reachable" : `HTTP ${resp.status}` }); }
    catch (e) { checks.push({ name: "Sheets feed", ok: false, detail: e.name === "AbortError" ? "timeout" : e.message }); }
    setSelfTest({ at: new Date().toISOString(), checks });
    setSelfTesting(false);
    await logAdminAction(admin_id, "self_test", { failed: checks.filter(c => !c.ok).length });
  }

  // ── Onboarding funnel: signup → picked section → push → active this week ──
  const funnel = (() => {
    const signedUp = allUsers.length;
    const pickedSection = allUsers.filter(u => Object.keys(u.courses || {}).some(c => !c.startsWith("_"))).length;
    const activeWeek = allUsers.filter(u => u.last_seen_at && (LOAD_NOW - new Date(u.last_seen_at).getTime()) <= 7 * 86400000).length;
    const pushDevices = Number(pushSubCount) || 0;
    return { signedUp, pickedSection, pushDevices, activeWeek };
  })();

  // ── Weekly Presence: per-day, per-hour buckets from last_seen_at ────────────
  // One entry per user per day (last_seen_at is a single heartbeat per user,
  // stamped at most once/hour). Index 0 = 6 days ago, index 6 = today.
  const weeklyPresence = (() => {
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(LOAD_NOW - (6 - i) * 86400000);
      d.setHours(0, 0, 0, 0);
      return {
        ts: d.getTime(),
        label: d.toLocaleDateString("en-IN", { weekday: "short" }),
        date: d.toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
        isoDate: d.toISOString().split("T")[0],
        users: [],           // { name, hour, userId, section, isNew, seenTs }
        hourBuckets: Array(24).fill(0),
      };
    });

    allUsers.forEach(u => {
      if (!u.last_seen_at) return;
      const seenDate = new Date(u.last_seen_at);
      const dayStart = new Date(seenDate); dayStart.setHours(0, 0, 0, 0);
      const dayIdx = days.findIndex(d => d.ts === dayStart.getTime());
      if (dayIdx === -1) return;
      const hour = seenDate.getHours();
      // Derive section from the first non-underscore course key
      const courseKeys = Object.keys(u.courses || {}).filter(c => !c.startsWith("_"));
      const section = courseKeys.length > 0
        ? (courseKeys.find(c => /_[ABC]$/.test(c))?.match(/_([ABC])$/)?.[1] || "—")
        : "—";
      // Mark as "new" if they signed up (updated_at) within 24h of the day
      const isNew = u.updated_at
        ? Math.abs(new Date(u.updated_at).getTime() - dayStart.getTime()) <= 86400000
        : false;
      days[dayIdx].users.push({
        name: u.name || "Student",
        hour,
        userId: u.user_id,
        section,
        isNew,
        seenTs: seenDate.getTime(),
      });
      days[dayIdx].hourBuckets[hour]++;
    });

    return days;
  })();

  // ── Streak users: seen on every one of the last 7 days ──────────────────────
  const streakUserIds = new Set(
    allUsers
      .filter(u => {
        if (!u.last_seen_at) return false;
        return weeklyPresence.every(day => day.users.some(wu => wu.userId === u.user_id));
      })
      .map(u => u.user_id)
  );

  // ── Ghost users: not seen in 7+ days (only if they ever logged in) ──────────
  const ghostUsers = allUsers.filter(u =>
    u.last_seen_at && (LOAD_NOW - new Date(u.last_seen_at).getTime()) > 7 * 86400000
  );

  // ── Admin action leaderboard: audit actions per admin in the last 7 days ──
  const adminLeaderboard = (() => {
    const cutoff = LOAD_NOW - 7 * 86400000;
    const by = {};
    auditLogs.forEach(l => {
      if (new Date(l.created_at).getTime() < cutoff) return;
      const k = l.admin_id || "unknown";
      (by[k] = by[k] || { id: k, count: 0, last: l.created_at, actions: {} });
      by[k].count++;
      by[k].actions[l.action] = (by[k].actions[l.action] || 0) + 1;
      if (l.created_at > by[k].last) by[k].last = l.created_at;
    });
    return Object.values(by).sort((a, b) => b.count - a.count).slice(0, 8);
  })();

  // ── Config drift: what live config layers on top of the bundled snapshot ──
  const configDrift = (() => {
    const overrideDays = Object.keys(flags.classOverrides || {}).length;
    const overrideClasses = Object.values(flags.classOverrides || {}).reduce((a, d) => a + Object.keys(d).length, 0);
    const announcements = (flags.scheduledAnnouncements || []).length;
    const quickLinks = (flags.quickLinks || []).length;
    const total = overrideClasses + announcements + quickLinks;
    return { overrideDays, overrideClasses, announcements, quickLinks, total };
  })();

  // ── Broadcast agenda: all scheduled pushes/announcements/deploys, next 21 days ──
  const broadcastAgenda = (() => {
    const items = [];
    (flags.scheduledPushes || []).forEach(p => items.push({ when: `${p.date || ""} ${p.time || ""}`.trim(), sort: `${p.date || ""}T${p.time || "00:00"}`, kind: "Push", label: p.title || "(push)", color: "var(--live)" }));
    (flags.scheduledAnnouncements || []).forEach(a => items.push({ when: a.start || "", sort: `${a.start || ""}T00:00`, kind: "Announcement", label: (a.text || a.message || "").slice(0, 50) || "(announcement)", color: "var(--amber)", end: a.end }));
    (flags.scheduledConfigDeploys || []).forEach(d => items.push({ when: (d.at || "").replace("T", " "), sort: d.at || "", kind: "Config deploy", label: "Queued config", color: "var(--violet)" }));
    (flags.quickLinks || []).filter(q => q.start).forEach(q => items.push({ when: q.start, sort: `${q.start}T00:00`, kind: "Quick link", label: q.title || q.url || "(link)", color: "var(--blue)", end: q.end }));
    return items.filter(i => i.sort).sort((a, b) => a.sort.localeCompare(b.sort));
  })();

  // ── Double-send guard: was a similar broadcast sent in the last hour? ──
  // Reads the delivery-analytics RPC (pushStats); returns the matching row or null.
  function recentDuplicatePush(title) {
    const t = (title || "").trim().toLowerCase();
    if (!t || !Array.isArray(pushStats)) return null;
    return pushStats.find(s => (s.title || "").trim().toLowerCase() === t && s.sent_at && (nowMs() - new Date(s.sent_at).getTime()) < 3600000) || null;
  }

  // ── Saved audiences: reusable target filters (flags.savedAudiences) ──
  function saveCurrentAudience() {
    if (pushTarget === "all") return alert("Pick a specific audience first (not Everyone).");
    const label = prompt("Name this audience:", pushTarget.replace(/_/g, " "));
    if (!label?.trim()) return;
    setFlags({ ...flags, savedAudiences: [...(flags.savedAudiences || []), { id: Date.now().toString(), label: label.trim(), target: pushTarget }] });
  }

  // ── Scheduled-announcement overlap detector ──
  // Two announcements clash if their date ranges overlap AND their audiences
  // intersect (same target, or either is global → everyone).
  const announcementOverlaps = (() => {
    const list = (flags.scheduledAnnouncements || []).filter(a => a.start && a.end);
    const clashes = [];
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i], b = list[j];
        const datesOverlap = a.start <= b.end && b.start <= a.end;
        const audienceIntersect = a.target === b.target || a.target === "global" || b.target === "global";
        if (datesOverlap && audienceIntersect) clashes.push({ a, b });
      }
    }
    return clashes;
  })();

  // ── Room / time conflict detector (base snapshot) ──
  const scheduleConflicts = (() => {
    const groups = {};
    liveSchedule.forEach(c => {
      if (c.type === "break" || !c.room || !c.start) return;
      const k = `${c.date}|${c.room}|${c.start}`;
      (groups[k] = groups[k] || []).push(c);
    });
    return Object.entries(groups)
      .filter(([, list]) => new Set(list.map(c => `${c.code}_${c.section || ""}`)).size > 1)
      .map(([k, list]) => {
        const [date, room, start] = k.split("|");
        return { date, room, start, codes: [...new Set(list.map(c => c.code))] };
      })
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 20);
  })();

  // ── Bulk CSV dry-run ──
  function previewCsvImport() {
    if (!bulkCsv.trim()) { setCsvPreview(null); return; }
    const lines = bulkCsv.trim().split("\n");
    let valid = 0; const invalid = []; const sample = [];
    lines.forEach((line, i) => {
      const [date, code, section, room, start, end, cancelStr] = line.split(",").map(s => s?.trim());
      if (!date || !code || !section) { invalid.push(i + 1); return; }
      valid++;
      if (sample.length < 5) {
        sample.push(cancelStr?.toLowerCase() === "true"
          ? `${date} · ${code} (${section}) → CANCELLED`
          : `${date} · ${code} (${section}) → ${[room && `room ${room}`, start && `${start}-${end || "?"}`].filter(Boolean).join(", ") || "no change"}`);
      }
    });
    setCsvPreview({ valid, invalid, sample, total: lines.length });
  }

  // ── Config import (JSON restore) ──
  // Note: rollback to a previous deploy already exists as the "Restore Past
  // Version" dropdown in the save footer (reads flags.configHistory).
  function handleImportConfig(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        const nextFlags = parsed.flags || parsed;
        if (!nextFlags || typeof nextFlags !== "object") throw new Error("No flags object found.");
        if (!confirm("Import this config? It replaces the current unsaved flags — review & Deploy to apply.")) return;
        setFlags(nextFlags);
        if (parsed.announcement !== undefined) setActiveAnnouncement(parsed.announcement);
        if (nextFlags.updatePrompt) {
          setUpdatePromptTitle(nextFlags.updatePrompt.title || "");
          setUpdatePromptDesc(nextFlags.updatePrompt.desc || "");
          setUpdatePromptHighlights((nextFlags.updatePrompt.highlights || []).join("\n"));
        }
        if (Array.isArray(nextFlags.feedbackFlashes)) setFeedbackFlashes(nextFlags.feedbackFlashes);
        logAdminAction(admin_id, "config_import", { file: file.name });
        alert("Config imported. Review & Deploy Config to apply.");
      } catch (err) {
        alert("Invalid config file: " + err.message);
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  // ── Admin roles editor ──
  function saveAdminRole() {
    const id = roleUserId.trim();
    if (!id) return alert("Enter a user ID.");
    setFlags({ ...flags, adminRoles: { ...(flags.adminRoles || {}), [id]: roleValue } });
    setRoleUserId("");
  }
  function removeAdminRole(id) {
    if (!confirm(`Remove admin access for ${id}?`)) return;
    const next = { ...(flags.adminRoles || {}) };
    delete next[id];
    setFlags({ ...flags, adminRoles: next });
  }

  // ── Push to an explicit set of user IDs (bulk "Push Selected" + re-engagement) ──
  async function pushToUserIds(ids, { title, body, url = "/?view=today", confirmMsg } = {}) {
    if (!ids || ids.length === 0) return alert("No users to push to.");
    const pushKey = getPushKey();
    if (!pushKey) return;
    if (confirmMsg && !confirm(confirmMsg)) return;
    const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-push`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-push-key": pushKey, "Authorization": `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}` },
      body: JSON.stringify({ title, body, url, target_user_ids: ids }),
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok && resp.status === 401) localStorage.removeItem("pgp2.push-admin-key");
    return { ok: resp.ok, data };
  }

  async function pushSelectedUsers() {
    const ids = [...selectedUserIds];
    if (ids.length === 0) return alert("Select users first.");
    const title = prompt(`Push title for ${ids.length} selected user(s):`);
    if (!title) return;
    const body = prompt("Push message:");
    if (!body) return;
    const res = await pushToUserIds(ids, { title: title.trim(), body: body.trim() });
    if (res?.ok) { await logAdminAction(admin_id, "bulk_push", { count: ids.length }); alert(`Queued to ${res.data.queued ?? ids.length} user(s).`); }
    else alert("Failed: " + (res?.data?.error || "unknown"));
  }

  // ── Re-engagement push to inactive users ──
  const inactiveUsers = allUsers.filter(u => {
    if (!u.last_seen_at) return true;
    return (LOAD_NOW - new Date(u.last_seen_at).getTime()) > inactiveDays * 86400000;
  });

  // ── Audit log filtering ──
  const filteredAuditLogs = auditLogs.filter(l => {
    if (auditActionFilter !== "all" && l.action !== auditActionFilter) return false;
    if (auditSearch.trim()) {
      const hay = `${l.action} ${l.admin_id} ${JSON.stringify(l.details || {})}`.toLowerCase();
      if (!hay.includes(auditSearch.trim().toLowerCase())) return false;
    }
    return true;
  });
  async function sendReEngagement() {
    const ids = inactiveUsers.map(u => u.user_id).filter(Boolean);
    if (ids.length === 0) return alert("No inactive users in that window.");
    setReEngaging(true); setReEngageMsg("");
    try {
      const res = await pushToUserIds(ids, {
        title: "We miss you at TermFlow 👋",
        body: "Your schedule, mess menu and friends are waiting — jump back in.",
        confirmMsg: `Send a re-engagement push to ${ids.length} user(s) inactive for ${inactiveDays}+ days?`,
      });
      if (!res) { setReEngaging(false); return; }
      if (!res.ok) setReEngageMsg(`Failed: ${res.data.error || "error"}`);
      else { setReEngageMsg(`Queued to ${res.data.queued ?? ids.length} user(s).`); await logAdminAction(admin_id, "reengagement_push", { count: ids.length, inactiveDays }); }
    } catch (e) { setReEngageMsg("Error: " + e.message); }
    setReEngaging(false);
  }

  // ── Targeted push: resolve an audience filter to concrete user IDs ──
  // Returns null for "all" (→ broadcast) or targets that can't be resolved client-side.
  function audienceIds(target) {
    if (!target || target === "all") return null;
    if (target === "inactive") return inactiveUsers.map(u => u.user_id).filter(Boolean);
    if (target === "section_A" || target === "section_B") {
      const s = target.endsWith("A") ? "_A" : "_B";
      return allUsers.filter(u => Object.keys(u.courses || {}).some(c => c.endsWith(s))).map(u => u.user_id).filter(Boolean);
    }
    if (target.startsWith("subject_")) {
      const code = target.replace("subject_", "");
      return allUsers.filter(u => Object.keys(u.courses || {}).some(c => c === code || c.startsWith(code + "_"))).map(u => u.user_id).filter(Boolean);
    }
    return null;
  }

  // ── CSV export helper ──
  function exportCsv(filename, headers, rows) {
    const esc = v => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const csv = [headers.map(esc).join(","), ...rows.map(r => r.map(esc).join(","))].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  }

  // Auto-dismiss the undo toast ~7s after it appears (restarts on each new one
  // via its `key`). Effect-based so we avoid ref/global access from render.
  useEffect(() => {
    if (!undoToast) return;
    const t = setTimeout(() => setUndoToast(null), 7000);
    return () => clearTimeout(t);
    // Keyed on `.key` so the dismiss timer only restarts for a genuinely new
    // toast; depending on the whole object would reset it on any field change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [undoToast?.key]);

  // ── Undo toast for reversible destructive actions ──
  // Apply the change immediately, then surface a "Undo" toast for ~7s. If the
  // admin clicks Undo we call `undo()` to restore. Auto-dismisses otherwise.
  function removeWithUndo(label, undo) {
    // `key` forces the auto-dismiss effect to restart even for back-to-back
    // deletes with the same label.
    setUndoToast({ label, undo, key: nowMs() });
  }
  function runUndo() {
    undoToast?.undo?.();
    setUndoToast(null);
  }

  // ── Typed confirmation for destructive actions ──
  function typedConfirm(word, message) {
    const v = prompt(`${message}\n\nType ${word} to confirm:`);
    return (v || "").trim().toUpperCase() === word.toUpperCase();
  }

  // ── Scheduled config deploy: queue the current pending config for a future time ──
  async function queueConfigDeploy() {
    if (!scheduleDeployAt) return alert("Pick a date & time to schedule the deploy.");
    const snapshot = { ...flags };
    delete snapshot.scheduledConfigDeploys;
    delete snapshot.configHistory;
    snapshot.updatePrompt = { title: updatePromptTitle, desc: updatePromptDesc, highlights: updatePromptHighlights.split("\n").filter(l => l.trim()) };
    snapshot.feedbackFlashes = feedbackFlashes;
    const entry = { id: Date.now().toString(), at: scheduleDeployAt, author: admin_id, flags: snapshot, announcement: activeAnnouncement };
    // Persist ONLY the queue onto live config (don't disturb the deployed flags/announcement).
    const { data: live } = await supabase.from("system_config").select("flags, announcement").eq("id", "global").single();
    const liveFlags = { ...(live?.flags || {}), scheduledConfigDeploys: [ ...((live?.flags?.scheduledConfigDeploys) || []), entry ] };
    const stamp = new Date().toISOString();
    const { error } = await supabase.from("system_config").upsert({ id: "global", announcement: live?.announcement ?? null, flags: liveFlags, updated_at: stamp });
    if (error) return alert("Failed to schedule: " + error.message);
    setLoadedUpdatedAt(stamp);
    setFlags(f => ({ ...f, scheduledConfigDeploys: liveFlags.scheduledConfigDeploys }));
    setScheduleDeployAt("");
    logAdminAction(admin_id, "schedule_config_deploy", { at: entry.at });
    alert("Scheduled. It auto-deploys at the chosen time (requires the apply-scheduled-config cron).");
  }
  async function removeScheduledDeploy(id) {
    const { data: live } = await supabase.from("system_config").select("flags, announcement").eq("id", "global").single();
    const liveFlags = { ...(live?.flags || {}), scheduledConfigDeploys: ((live?.flags?.scheduledConfigDeploys) || []).filter(e => e.id !== id) };
    const stamp = new Date().toISOString();
    await supabase.from("system_config").upsert({ id: "global", announcement: live?.announcement ?? null, flags: liveFlags, updated_at: stamp });
    setLoadedUpdatedAt(stamp);
    setFlags(f => ({ ...f, scheduledConfigDeploys: liveFlags.scheduledConfigDeploys }));
  }

  async function forceRefresh() {
    if (typedConfirm("REFRESH", "Force ALL active users to reload the app now?")) {
      await saveConfig();
      await logAdminAction(admin_id, "force_refresh", {});
      alert("Broadcast sent! Users will refresh on their next navigation.");
    }
  }

  const [rebuilding, setRebuilding] = useState(false);
  const [rebuildMsg, setRebuildMsg] = useState("");

  async function triggerSnapshotRebuild() {
    const hook = import.meta.env.VITE_DEPLOY_HOOK_URL;
    if (!hook) {
      alert("No deploy hook configured.\n\nCreate one in Vercel → Project Settings → Git → Deploy Hooks, then add its URL as VITE_DEPLOY_HOOK_URL in Vercel env vars.");
      return;
    }
    if (!confirm("Trigger a redeploy to regenerate the bundled snapshot from the live sheet?")) return;
    setRebuilding(true);
    setRebuildMsg("");
    try {
      // Deploy hooks don't send CORS headers — no-cors still fires the request
      await fetch(hook, { method: "POST", mode: "no-cors" });
      await logAdminAction(admin_id, "snapshot_rebuild", {});
      setRebuildMsg("Redeploy triggered — new snapshot goes live in ~2 min.");
    } catch (e) {
      setRebuildMsg("Failed to trigger: " + e.message);
    }
    setRebuilding(false);
  }

  const filteredUsers = allUsers.filter(u => {
    const matchesSearch = u.name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          u.user_id?.toLowerCase().includes(searchQuery.toLowerCase());
    let matchesSection = true;
    if (userSectionFilter !== "All") {
       matchesSection = Object.keys(u.courses || {}).some(c => c.endsWith(`_${userSectionFilter}`));
    }
    return matchesSearch && matchesSection;
  });

  const cancelClass = (date, code, section) => {
    const key = !section || section === "All" || section === "Single" ? code : `${code}_${section}`;
    const nextOverrides = { ...(flags.classOverrides || {}) };
    nextOverrides[date] = { ...(nextOverrides[date] || {}), [key]: { type: "cancelled", name: `Cancelled: ${key}`, modifiedAt: new Date().toISOString(), modifiedBy: admin_id } };
    setFlags({ ...flags, classOverrides: nextOverrides });
    logAdminAction(admin_id, "cancel_class", { date, class: key });
  };

  // Only lifts the cancellation — leaves room/time overrides on the same key intact
  const restoreClass = (date, code, section) => {
    const nextOverrides = { ...(flags.classOverrides || {}) };
    const forDate = { ...(nextOverrides[date] || {}) };
    [code, `${code}_${section}`].forEach(key => {
      if (forDate[key]?.type === "cancelled") delete forDate[key];
    });
    if (Object.keys(forDate).length === 0) delete nextOverrides[date];
    else nextOverrides[date] = forDate;
    setFlags({ ...flags, classOverrides: nextOverrides });
    logAdminAction(admin_id, "restore_class", { date, class: code, section });
  };

  const handleAddOverride = () => {
    const code = overrideClass.trim().toUpperCase();
    if (!overrideDate || !code) {
      alert("Please select a date and enter a class code to cancel.");
      return;
    }
    if (!LEGEND[code] && !window.confirm(`"${code}" isn't a known course code. Cancel it anyway?`)) return;
    cancelClass(overrideDate, code, overrideSection);
    setOverrideClass("");
    setOverrideSection("All");
  };

  const handleAddRoomOverride = () => {
    if (!roomOverrideDate || !roomOverrideClass || (!roomOverrideRoom && !roomOverrideStart && !roomOverrideEnd)) {
      alert("Please fill in Date, Class Code, and at least one change (Room, Start Time, or End Time).");
      return;
    }
    const nextOverrides = { ...(flags.classOverrides || {}) };
    nextOverrides[roomOverrideDate] = { ...(nextOverrides[roomOverrideDate] || {}) };
    
    const overrideKey = roomOverrideSection === "All" ? roomOverrideClass : `${roomOverrideClass}_${roomOverrideSection}`;
    const existing = nextOverrides[roomOverrideDate][overrideKey] || {};
    
    const changes = { ...existing };
    if (roomOverrideRoom) changes.room = roomOverrideRoom;
    if (roomOverrideStart) changes.start = roomOverrideStart;
    if (roomOverrideEnd) changes.end = roomOverrideEnd;
    changes.modifiedAt = new Date().toISOString();
    changes.modifiedBy = admin_id;

    nextOverrides[roomOverrideDate][overrideKey] = changes;
    setFlags({...flags, classOverrides: nextOverrides});
    logAdminAction(admin_id, "edit_class_override", { date: roomOverrideDate, class: overrideKey, changes });
    setRoomOverrideClass("");
    setRoomOverrideRoom("");
    setRoomOverrideStart("");
    setRoomOverrideEnd("");
    setRoomOverrideSection("All");
  };

  // Stale = date-keyed config students still download but that can never apply again
  const todayISO = new Date().toISOString().split("T")[0];
  const staleOverrideDates = Object.keys(flags.classOverrides || {}).filter(d => d < todayISO);
  const staleAnnouncements = (flags.scheduledAnnouncements || []).filter(a => a.end && a.end < todayISO);
  const staleQuickLinks = (flags.quickLinks || []).filter(ql => ql.end && ql.end < todayISO);
  const staleConfigCount = staleOverrideDates.length + staleAnnouncements.length + staleQuickLinks.length;

  const activeOverrideDates = Object.keys(flags.classOverrides || {}).filter(d => d >= todayISO);
  const activeOverrideCount = activeOverrideDates.reduce((acc, d) => acc + Object.keys(flags.classOverrides[d]).length, 0);


  const purgeStaleConfig = () => {
    if (!window.confirm(`Remove ${staleOverrideDates.length} past override date(s), ${staleAnnouncements.length} expired announcement(s) and ${staleQuickLinks.length} expired quick link(s)? Remember to deploy after.`)) return;
    const nextOverrides = { ...(flags.classOverrides || {}) };
    staleOverrideDates.forEach(d => delete nextOverrides[d]);
    setFlags({
      ...flags,
      classOverrides: nextOverrides,
      scheduledAnnouncements: (flags.scheduledAnnouncements || []).filter(a => !(a.end && a.end < todayISO)),
      quickLinks: (flags.quickLinks || []).filter(ql => !(ql.end && ql.end < todayISO)),
    });
    logAdminAction(admin_id, "purge_stale_config", { overrideDates: staleOverrideDates.length, announcements: staleAnnouncements.length, quickLinks: staleQuickLinks.length });
  };

  const markFeedbackResolved = async (id) => {
    await supabase.from("feedback").update({ status: "resolved" }).eq("id", id);
    setFeedbackList(feedbackList.map(f => f.id === id ? { ...f, status: "resolved" } : f));
  };

  const _exportConfigJSON = () => {
    const json = JSON.stringify({ announcement: activeAnnouncement, flags }, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'config_backup.json';
    a.click();
    logAdminAction(admin_id, "export_config", {});
  };

  // ── API Health Check: probes real services ──────────────────
  const checkApiHealth = async () => {
    setHealthChecking(true);
    const next = { supabase: null, sheets: null, push: null };

    // 1. Supabase DB latency
    try {
      const t = Date.now();
      const { error } = await supabase.from("system_config").select("id").limit(1);
      next.supabase = error ? "error" : `${Date.now() - t}ms`;
    } catch (e) { next.supabase = "error"; }

    // 2. Push Gateway — verify the edge function responds (sends no push)
    try {
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-push`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          "x-push-key": localStorage.getItem("pgp2.push-admin-key") || "__health_check__",
        },
        body: JSON.stringify({ __healthcheck: true }),
      });
      // 400/401 = function is reachable (auth or bad body); 5xx = down
      next.push = resp.status < 500 ? "ok" : "error";
    } catch (e) { next.push = "error"; }

    // 3. Google Sheets live feed — HEAD-like fetch with a short timeout
    const FEED_URL = "https://script.google.com/macros/s/AKfycbwOCmpZAbzN7hRkb-xx6-SDejt3c45E5NBZ0NHuJW8CBRYO4ROJfwE_MI_g4aODwo08Gg/exec";
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 6000);
      const resp = await fetch(`${FEED_URL}?action=ping`, { signal: ctrl.signal, redirect: "follow" });
      clearTimeout(timer);
      next.sheets = resp.ok ? "ok" : "error";
    } catch (e) {
      next.sheets = e.name === "AbortError" ? "timeout" : "error";
    }

    setHealthStatus(next);
    setHealthChecking(false);
  };

  // Helper to open the Live Editor modal AND initialise controlled inputs
  const openLiveEditorModal = (c, isNew = false) => {
    setLiveEditorModal(c);
    setModalIsNew(isNew);
    setModalCode(c.code || "");
    setModalName(c.name || "");
    setModalSection(c.section === "Single" ? "All" : (c.section || "All"));
    setModalRoom(c.room || "");
    setModalStart(c.start || "");
    setModalEnd(c.end || "");
  };

  return (
    <div className={`admin-page ${isModernUi ? "modern-ui" : ""}`}>

      {/* ── Undo toast for destructive one-click actions ── */}
      {undoToast && (
        <div style={{ position: "fixed", left: "50%", bottom: 28, transform: "translateX(-50%)", zIndex: 1000, display: "flex", alignItems: "center", gap: 16, padding: "12px 18px", background: "var(--text)", color: "var(--bg)", borderRadius: 12, boxShadow: "0 8px 30px rgba(0,0,0,0.25)", fontSize: 14, fontWeight: 600, maxWidth: "90vw" }}>
          <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{undoToast.label}</span>
          <button onClick={runUndo} style={{ background: "transparent", border: "none", color: "var(--live)", fontWeight: 800, cursor: "pointer", fontSize: 14, padding: "2px 6px", flex: "0 0 auto" }}>Undo</button>
        </div>
      )}

      {/* ── Hero Section ── */}
      <section className="hero" style={{ marginBottom: 32, padding: "40px 20px", textAlign: "center", borderRadius: 24, position: "relative", overflow: "hidden" }}>
        <div style={{ display: "inline-flex", background: "rgba(109, 91, 208, 0.1)", color: "var(--live)", padding: "12px 24px", borderRadius: 30, alignItems: "center", gap: 12, marginBottom: 16, flexWrap: "wrap", justifyContent: "center" }}>
          <ShieldAlert size={28} />
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, letterSpacing: "-0.5px" }}>Admin Control Center</h1>
          <button onClick={fetchDashboardData} disabled={statsLoading} style={{ background: "transparent", border: "none", color: "var(--live)", cursor: "pointer", padding: 4, display: "flex", alignItems: "center", justifyContent: "center", opacity: statsLoading ? 0.5 : 1 }} title="Refresh Data">
            <RefreshCw size={20} className={statsLoading ? "spin-icon" : ""} />
          </button>
          <button onClick={() => setIsCommandPaletteOpen(true)} style={{ background: "transparent", border: "none", color: "var(--live)", cursor: "pointer", padding: 4, display: "flex", alignItems: "center", justifyContent: "center" }} title="Open Command Palette (Cmd+Shift+K)">
            <Search size={20} />
          </button>
          <button onClick={() => setIsModernUi(!isModernUi)} style={{ background: "transparent", border: "none", color: "var(--live)", cursor: "pointer", padding: 4, display: "flex", alignItems: "center", justifyContent: "center" }} title={isModernUi ? "Switch to Legacy Mobile UI" : "Switch to Modern Mobile UI"}>
            <Smartphone size={20} opacity={isModernUi ? 1 : 0.4} />
          </button>
        </div>
        <p style={{ color: "var(--muted)", margin: "0 0 16px 0", fontSize: 16 }}>Global settings, feature flags, and user management.</p>

        {presentAdmins.length > 0 && (
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, marginBottom: 24, padding: "6px 14px", background: "var(--card)", border: "1px solid var(--border)", borderRadius: 30, fontSize: 13 }} title={presentAdmins.map(a => a.name).join(", ")}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--live)", boxShadow: "0 0 0 3px rgba(31,169,113,0.2)" }} />
            <span style={{ color: "var(--muted)" }}>
              {presentAdmins.length === 1 ? "You're the only admin here" : `${presentAdmins.length} admins here: ${presentAdmins.map(a => a.name).join(", ")}`}
            </span>
          </div>
        )}

        <div className="admin-stats-grid">
          <div style={{ background: "var(--card)", padding: "16px 32px", borderRadius: 16, border: "1px solid var(--border)", minWidth: 180 }} title="Total registered students (excluding dev/admin accounts)">
            <div style={{ fontSize: 12, textTransform: "uppercase", fontWeight: 700, color: "var(--muted)", marginBottom: 8, letterSpacing: "1px" }}>Total Users</div>
            <div style={{ fontSize: 36, fontWeight: 800, fontFamily: "var(--display)", color: "var(--text)" }}>{statsLoading ? "..." : totalUsers}</div>
          </div>
          <div style={{ background: "var(--card)", padding: "16px 32px", borderRadius: 16, border: "1px solid var(--border)", minWidth: 180, cursor: "pointer" }} title="Unique students active since midnight local time" onClick={() => setActiveUsersListModalOpen(true)}>
            <div style={{ fontSize: 12, textTransform: "uppercase", fontWeight: 700, color: "var(--muted)", marginBottom: 8, letterSpacing: "1px" }}>Active Today</div>
            <div style={{ fontSize: 36, fontWeight: 800, fontFamily: "var(--display)", color: "var(--text)", textDecoration: "underline", textDecorationColor: "var(--border)", textUnderlineOffset: 4 }}>{statsLoading ? "..." : activeUsers}</div>
          </div>
          <div style={{ background: "var(--card)", padding: "16px 32px", borderRadius: 16, border: "1px solid var(--border)", minWidth: 180 }} title="PostgreSQL database size (Free tier limit is 500MB)">
            <div style={{ fontSize: 12, textTransform: "uppercase", fontWeight: 700, color: "var(--muted)", marginBottom: 8, letterSpacing: "1px", display: "flex", alignItems: "center", gap: 6 }}><Database size={14}/> DB Storage Used</div>
            <div style={{ fontSize: 36, fontWeight: 800, fontFamily: "var(--display)", color: "var(--text)" }}>{statsLoading ? "..." : dbSize}</div>
          </div>
          <div style={{ background: "var(--card)", padding: "16px 32px", borderRadius: 16, border: "1px solid var(--border)", minWidth: 180, cursor: "pointer" }} title="Total devices enrolled for FCM web push notifications" onClick={() => setPushSubscribersModalOpen(true)}>
            <div style={{ fontSize: 12, textTransform: "uppercase", fontWeight: 700, color: "var(--muted)", marginBottom: 8, letterSpacing: "1px", display: "flex", alignItems: "center", gap: 6 }}><BellRing size={14}/> Push Subscribers</div>
            <div style={{ fontSize: 36, fontWeight: 800, fontFamily: "var(--display)", color: "var(--text)", textDecoration: "underline", textDecorationColor: "var(--border)", textUnderlineOffset: 4 }}>{statsLoading ? "..." : pushSubCount}</div>
          </div>

        </div>
        <div style={{ marginTop: 24 }}>
           <details style={{ cursor: "pointer", color: "var(--muted)", fontSize: 13 }}>
              <summary>Keyboard Shortcuts</summary>
              <div style={{ marginTop: 8, background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, padding: 12, display: "inline-block", textAlign: "left" }}>
                 <div style={{ display: "flex", justifyContent: "space-between", gap: 32, marginBottom: 4 }}><span>Open Command Palette</span><kbd>Cmd/Ctrl + Shift + K</kbd></div>
              </div>
           </details>
        </div>
      </section>

      {/* ── Tab nav: groups the ~24 sections into 5 categories ── */}
      <nav className="admin-tabs" role="tablist" aria-label="Admin sections">
        {[
          { id: "broadcast", label: "Broadcast", Icon: Megaphone, isNew: true },
          { id: "schedule", label: "Schedule", Icon: CalendarDays },
          { id: "users", label: "Users", Icon: Users },
          { id: "insights", label: "Insights", Icon: BarChart2 },
          { id: "moderation", label: "Moderation", Icon: Shield },
          { id: "database", label: "Database", Icon: Database },
          { id: "system", label: "System", Icon: ShieldAlert },
        ].map(({ id, label, Icon, isNew }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={activeTab === id}
            className={`admin-tab ${activeTab === id ? "active" : ""}`}
            onClick={() => {
              setActiveTab(id);
              const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
              window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
            }}
          >
            <Icon size={16} />
            <span className="admin-tab-label">{label}</span>
            {isNew && (
              <span style={{
                background: "linear-gradient(135deg, #8B5CF6 0%, #EC4899 100%)",
                color: "#fff",
                fontSize: "9px",
                fontWeight: 800,
                padding: "1px 5px",
                borderRadius: "6px",
                marginLeft: "4px"
              }}>NEW</span>
            )}
          </button>
        ))}
      </nav>

      {/* ── Card flow: 2-col masonry ≥1200px, single column below ── */}
      <div className="admin-masonry" data-active-tab={activeTab}>



          {/* ── Live Schedule Command Centre ── */}
          <section className="admin-card admin-span-all admin-g-schedule" style={{ gridColumn: "1 / -1" }}>
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
              <div>
                <h2 style={{ marginBottom: 4 }}><CalendarDays size={20} color="var(--blue)" /> Schedule Command Centre</h2>
                <p className="admin-subtext" style={{ margin: 0 }}>Click a class card for quick cancel, room move, or full edit. Drag two cards to swap their time slots.</p>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button className="admin-btn primary" style={{ padding: "7px 14px", fontSize: 13 }}
                  onClick={() => openLiveEditorModal({ date: liveEditorDate, code: "", name: "", type: "class", section: "All" }, true)}>
                  + Add Class
                </button>
                <button className="admin-btn outline" style={{ padding: "7px 14px", fontSize: 13, borderColor: "var(--danger)", color: "var(--danger)" }}
                  onClick={() => {
                    const dayClasses = liveSchedule.filter(c => c.date === liveEditorDate && c.type !== "break");
                    if (dayClasses.length === 0) return alert("No classes to cancel on this date.");
                    if (!window.confirm(`Mark all ${dayClasses.length} classes on ${liveEditorDate} as Holiday?`)) return;
                    const prev = flags.classOverrides;
                    const next = { ...flags.classOverrides };
                    if (!next[liveEditorDate]) next[liveEditorDate] = {};
                    dayClasses.forEach(c => { const k = makeOverrideKey(classIdent(c), c.section); next[liveEditorDate][k] = { type: "cancelled", modifiedAt: new Date().toISOString(), modifiedBy: admin_id }; });
                    setFlags({ ...flags, classOverrides: next });
                    setCmdUndoStack(s => [{ label: `Holiday: all classes on ${liveEditorDate} cancelled`, prevOverrides: prev }, ...s.slice(0, 9)]);
                  }}>
                  <XCircle size={14} /> Holiday (Cancel All)
                </button>
              </div>
            </div>

            {/* Week View Ribbon */}
            {(() => {
              const today = new Date().toISOString().split("T")[0];
              const weekDays = Array.from({ length: 7 }, (_, i) => {
                const d = new Date(); d.setDate(d.getDate() - 3 + i);
                const iso = d.toISOString().split("T")[0];
                const count = liveSchedule.filter(c => c.date === iso && c.type !== "break").length;
                const hasOverride = !!(flags.classOverrides?.[iso] && Object.keys(flags.classOverrides[iso]).length > 0);
                return { iso, label: d.toLocaleDateString("en-IN", { weekday: "short" }), num: d.getDate(), count, hasOverride, isToday: iso === today };
              });
              return (
                <div style={{ display: "flex", gap: 6, marginBottom: 16, overflowX: "auto" }}>
                  {weekDays.map(d => (
                    <button key={d.iso}
                      onClick={() => setLiveEditorDate(d.iso)}
                      style={{ flex: "0 0 auto", minWidth: 56, padding: "8px 6px", borderRadius: 12, border: liveEditorDate === d.iso ? "2px solid var(--blue)" : "1px solid var(--border)", background: liveEditorDate === d.iso ? "rgba(59,130,246,0.10)" : d.isToday ? "rgba(109,91,208,0.06)" : "var(--bg)", cursor: "pointer", textAlign: "center", position: "relative", transition: "border-color 0.15s" }}>
                      <div style={{ fontSize: 10, fontWeight: 600, color: liveEditorDate === d.iso ? "var(--blue)" : "var(--muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>{d.label}</div>
                      <div style={{ fontSize: 16, fontWeight: 800, color: liveEditorDate === d.iso ? "var(--blue)" : "var(--text)", fontFamily: "var(--display)" }}>{d.num}</div>
                      <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 2 }}>{d.count > 0 ? `${d.count} cls` : "—"}</div>
                      {d.hasOverride && <span style={{ position: "absolute", top: 5, right: 7, width: 6, height: 6, borderRadius: "50%", background: "var(--amber)" }} title="Has overrides" />}
                      {d.isToday && <div style={{ position: "absolute", bottom: 4, left: "50%", transform: "translateX(-50%)", width: 4, height: 4, borderRadius: "50%", background: "var(--violet)" }} />}
                    </button>
                  ))}
                </div>
              );
            })()}

            {/* Day toolbar: date picker + section filter */}
            <div style={{ display: "flex", gap: 10, marginBottom: 16, alignItems: "center", flexWrap: "wrap" }}>
              <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                <button onClick={() => { const d = new Date(liveEditorDate); d.setDate(d.getDate() - 1); setLiveEditorDate(d.toISOString().split("T")[0]); }}
                  style={{ background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 8, padding: "6px 10px", cursor: "pointer", color: "var(--muted)" }}>‹</button>
                <input type="date" className="admin-input" value={liveEditorDate} onChange={e => setLiveEditorDate(e.target.value)}
                  style={{ padding: "7px 12px", borderRadius: 8 }} />
                <button onClick={() => { const d = new Date(liveEditorDate); d.setDate(d.getDate() + 1); setLiveEditorDate(d.toISOString().split("T")[0]); }}
                  style={{ background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 8, padding: "6px 10px", cursor: "pointer", color: "var(--muted)" }}>›</button>
              </div>
              <div style={{ display: "flex", gap: 4 }}>
                {["All", "A", "B"].map(s => (
                  <button key={s} onClick={() => setCmdSection(s)}
                    style={{ padding: "6px 14px", borderRadius: 8, border: cmdSection === s ? "1.5px solid var(--blue)" : "1px solid var(--border)", background: cmdSection === s ? "rgba(59,130,246,0.10)" : "var(--bg)", cursor: "pointer", fontSize: 13, fontWeight: cmdSection === s ? 700 : 500, color: cmdSection === s ? "var(--blue)" : "var(--muted)" }}>
                    {s === "All" ? "All Sections" : `Sec ${s}`}
                  </button>
                ))}
              </div>
            </div>

            {/* Undo stack bar */}
            {cmdUndoStack.length > 0 && (
              <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", background: "rgba(109,91,208,0.07)", border: "1px solid rgba(109,91,208,0.3)", borderRadius: 10, marginBottom: 14, fontSize: 13 }}>
                <span style={{ flex: 1, color: "var(--muted)" }}>Staged: <b style={{ color: "var(--text)" }}>{cmdUndoStack[0].label}</b></span>
                <button onClick={() => {
                  setFlags(f => ({ ...f, classOverrides: cmdUndoStack[0].prevOverrides }));
                  setCmdUndoStack(s => s.slice(1));
                }} style={{ background: "none", color: "var(--violet)", fontWeight: 700, cursor: "pointer", fontSize: 13, padding: "2px 8px", borderRadius: 6, border: "1px solid var(--violet)" }}>↩ Undo</button>
                {cmdUndoStack.length > 1 && <span style={{ fontSize: 11, color: "var(--muted)" }}>(+{cmdUndoStack.length - 1} more)</span>}
                <button onClick={() => setCmdUndoStack([])} style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer", fontSize: 11, padding: "2px 6px" }}>Clear all</button>
              </div>
            )}

            {/* Class grid */}
            {(() => {
              const overridesForDate = flags.classOverrides?.[liveEditorDate] || {};
              const baseClasses = liveSchedule.filter(c => c.date === liveEditorDate && c.type !== "break");
              const newClasses = [];
              Object.keys(overridesForDate).forEach(key => {
                const { ident: code, section } = parseOverrideKey(key);
                const exists = baseClasses.some(c => classIdent(c) === code && (c.section === section || section === "All" || c.section === "Single"));
                if (!exists) {
                  const ovr = overridesForDate[key];
                  if (ovr.type !== "cancelled") newClasses.push({ date: liveEditorDate, code, section, name: ovr.name || "Custom Class", room: ovr.room || "", start: ovr.start || "", end: ovr.end || "", type: ovr.type || "class" });
                }
              });
              let displayClasses = [...baseClasses, ...newClasses]
                .sort((a, b) => (a.start || "").localeCompare(b.start || "") || (a.code || "").localeCompare(b.code || ""));
              if (cmdSection !== "All") displayClasses = displayClasses.filter(c => c.section === cmdSection || c.section === "Single" || c.section === "All");

              // Conflict detector
              function toMin(t) { if (!t) return 0; const [h, m] = t.split(":").map(Number); return h * 60 + (m || 0); }
              const conflicts = [];
              for (let i = 0; i < displayClasses.length; i++) {
                for (let j = i + 1; j < displayClasses.length; j++) {
                  const c1 = displayClasses[i]; const c2 = displayClasses[j];
                  const o1 = lookupOverride(overridesForDate, c1); const o2 = lookupOverride(overridesForDate, c2);
                  if (o1?.type === "cancelled" || o2?.type === "cancelled") continue;
                  const r1 = o1?.room || c1.room; const r2 = o2?.room || c2.room;
                  const s1 = toMin(o1?.start || c1.start); const e1 = toMin(o1?.end || c1.end);
                  const s2 = toMin(o2?.start || c2.start); const e2 = toMin(o2?.end || c2.end);
                  if (s1 < e2 && s2 < e1) {
                    if (r1 && r2 && r1.toLowerCase() === r2.toLowerCase() && r1.toLowerCase() !== "tbd") conflicts.push(`Room double-booked: ${r1} (${c1.code} & ${c2.code})`);
                    else if (c1.section === c2.section || c1.section === "All" || c2.section === "All") conflicts.push(`Section overlap: Sec ${c1.section === "All" ? c2.section : c1.section} — ${c1.code} & ${c2.code}`);
                  }
                }
              }

              if (displayClasses.length === 0) return <div className="admin-empty" style={{ padding: "24px 0" }}>No classes on this date{cmdSection !== "All" ? ` for Section ${cmdSection}` : ""}.</div>;

              return (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {conflicts.length > 0 && (
                    <div style={{ background: "rgba(231,76,60,0.08)", border: "1px solid var(--danger)", borderRadius: 10, padding: "10px 14px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700, color: "var(--danger)", marginBottom: 6 }}><AlertTriangle size={15} /> Conflict Warning</div>
                      {Array.from(new Set(conflicts)).map((c, i) => <div key={i} style={{ fontSize: 12, color: "var(--danger)" }}>• {c}</div>)}
                    </div>
                  )}
                  {displayClasses.map((c, idx) => {
                    const override = lookupOverride(overridesForDate, c);
                    const isCancelled = override?.type === "cancelled";
                    const isExam = override?.type === "exam";
                    const hasRoomChange = !!override?.room;
                    const hasTimeChange = !!override?.start || !!override?.end;
                    const isModified = hasRoomChange || hasTimeChange || isExam;
                    const isGuest = (c.session || "").toLowerCase().includes("guest");
                    const displayRoom = override?.room || c.room;
                    const displayStart = override?.start || c.start;
                    const displayEnd = override?.end || c.end;
                    const ident = classIdent(c);
                    const isBeingDragged = draggedIdx === idx;
                    const isQuickRoomOpen = cmdQuickRoom?.date === liveEditorDate && cmdQuickRoom?.classKey === ident + "_" + c.section;

                    return (
                      <div key={idx}
                        draggable
                        onDragStart={() => setDraggedIdx(idx)}
                        onDragEnd={() => setDraggedIdx(null)}
                        onDragOver={e => e.preventDefault()}
                        onDrop={() => {
                          if (draggedIdx === null || draggedIdx === idx) return;
                          const src = displayClasses[draggedIdx];
                          const dst = c;
                          if (!src || !dst) return;
                          // Swap the start/end times between the two classes
                          const srcStart = override?.start || src.start; const srcEnd = override?.end || src.end;
                          const dstOvr = lookupOverride(overridesForDate, dst);
                          const dstStart = dstOvr?.start || dst.start; const dstEnd = dstOvr?.end || dst.end;
                          const prev = flags.classOverrides;
                          const next = { ...flags.classOverrides };
                          next[liveEditorDate] = { ...(next[liveEditorDate] || {}) };
                          const srcKey = makeOverrideKey(classIdent(src), src.section);
                          const dstKey = makeOverrideKey(classIdent(dst), dst.section);
                          next[liveEditorDate][srcKey] = { ...(next[liveEditorDate][srcKey] || {}), start: dstStart, end: dstEnd, modifiedAt: new Date().toISOString(), modifiedBy: admin_id };
                          next[liveEditorDate][dstKey] = { ...(next[liveEditorDate][dstKey] || {}), start: srcStart, end: srcEnd, modifiedAt: new Date().toISOString(), modifiedBy: admin_id };
                          setFlags({ ...flags, classOverrides: next });
                          setCmdUndoStack(s => [{ label: `Swapped times: ${src.code} ↔ ${dst.code}`, prevOverrides: prev }, ...s.slice(0, 9)]);
                          setDraggedIdx(null);
                          logAdminAction(admin_id, "swap_time_slots", { date: liveEditorDate, src: srcKey, dst: dstKey });
                        }}
                        style={{
                          border: `1px solid ${isCancelled ? "var(--danger)" : isModified ? "var(--amber)" : isGuest ? "var(--violet)" : "var(--border)"}`,
                          borderRadius: 12, background: isCancelled ? "rgba(231,76,60,0.04)" : isModified ? "rgba(245,158,11,0.04)" : "var(--bg)",
                          opacity: isCancelled ? 0.75 : 1, transition: "border-color 0.15s, box-shadow 0.15s",
                          boxShadow: isBeingDragged ? "0 4px 20px rgba(0,0,0,0.15)" : "none",
                        }}>
                        {/* Card main row */}
                        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px" }}>
                          {/* Drag handle */}
                          <div style={{ cursor: "grab", color: "var(--muted)", flexShrink: 0 }} title="Drag to swap time slot">⇅</div>
                          {/* Class info */}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)", textDecoration: isCancelled ? "line-through" : "none", display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                              {c.code} — {c.name || LEGEND[c.code]?.name || "Class"}
                              {isCancelled && <span style={{ fontSize: 10, fontWeight: 800, background: "var(--danger)", color: "#fff", padding: "1px 7px", borderRadius: 4 }}>CANCELLED</span>}
                              {isExam && !isCancelled && <span style={{ fontSize: 10, fontWeight: 800, background: "var(--violet)", color: "#fff", padding: "1px 7px", borderRadius: 4 }}>EXAM</span>}
                              {isModified && !isCancelled && !isExam && <span style={{ fontSize: 10, fontWeight: 800, background: "var(--amber)", color: "#000", padding: "1px 7px", borderRadius: 4 }}>OVERRIDDEN</span>}
                              {isGuest && <span style={{ fontSize: 10, fontWeight: 800, background: "var(--violet)", color: "#fff", padding: "1px 7px", borderRadius: 4 }}>GUEST</span>}
                            </div>
                            <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 3, textDecoration: isCancelled ? "line-through" : "none" }}>
                              {displayStart}–{displayEnd} · Sec: {c.section === "Single" ? "All" : c.section} · Room: {displayRoom || "TBD"}
                            </div>
                          </div>
                          {/* Action buttons */}
                          <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                            {isCancelled ? (
                              <button title="Restore class" onClick={() => {
                                const prev = flags.classOverrides;
                                restoreClass(liveEditorDate, ident, c.section);
                                setCmdUndoStack(s => [{ label: `Restored: ${c.code} on ${liveEditorDate}`, prevOverrides: prev }, ...s.slice(0, 9)]);
                              }} style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg)", cursor: "pointer", fontSize: 12, fontWeight: 600, color: "var(--live)", display: "flex", alignItems: "center", gap: 4 }}>
                                <RefreshCw size={12} /> Restore
                              </button>
                            ) : (
                              <button title="Quick cancel this class" onClick={() => {
                                if (!window.confirm(`Cancel ${c.code} on ${liveEditorDate}?`)) return;
                                const prev = flags.classOverrides;
                                cancelClass(liveEditorDate, ident, c.section);
                                setCmdUndoStack(s => [{ label: `Cancelled: ${c.code} on ${liveEditorDate}`, prevOverrides: prev }, ...s.slice(0, 9)]);
                              }} style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid var(--danger)", background: "var(--bg)", cursor: "pointer", fontSize: 12, fontWeight: 600, color: "var(--danger)", display: "flex", alignItems: "center", gap: 4 }}>
                                <XCircle size={12} /> Cancel
                              </button>
                            )}
                            <button title="Quick room change" onClick={() => {
                              setCmdQuickRoom(isQuickRoomOpen ? null : { date: liveEditorDate, classKey: ident + "_" + c.section });
                              setCmdQuickRoomValue(displayRoom || "");
                            }} style={{ padding: "6px 12px", borderRadius: 8, border: `1px solid ${isQuickRoomOpen ? "var(--blue)" : "var(--border)"}`, background: isQuickRoomOpen ? "rgba(59,130,246,0.10)" : "var(--bg)", cursor: "pointer", fontSize: 12, fontWeight: 600, color: isQuickRoomOpen ? "var(--blue)" : "var(--muted)", display: "flex", alignItems: "center", gap: 4 }}>
                              📍 Room
                            </button>
                            <button title="Full edit (timing, name, section, exam)" onClick={() => openLiveEditorModal(c)} style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg)", cursor: "pointer", fontSize: 12, fontWeight: 600, color: "var(--muted)", display: "flex", alignItems: "center", gap: 4 }}>
                              <Pencil size={12} /> Edit
                            </button>
                          </div>
                        </div>
                        {/* Quick room inline input */}
                        {isQuickRoomOpen && (
                          <div style={{ display: "flex", gap: 8, padding: "0 14px 12px 14px", alignItems: "center" }}>
                            <input autoFocus type="text" placeholder="New room (e.g. C-104)" className="admin-input"
                              value={cmdQuickRoomValue} onChange={e => setCmdQuickRoomValue(e.target.value)}
                              onKeyDown={e => { if (e.key === "Enter") document.getElementById("cmd-quick-room-save-" + idx)?.click(); if (e.key === "Escape") setCmdQuickRoom(null); }}
                              style={{ flex: 1, padding: "6px 10px", fontSize: 13 }} />
                            <button id={"cmd-quick-room-save-" + idx}
                              onClick={() => {
                                if (!cmdQuickRoomValue.trim()) return;
                                const prev = flags.classOverrides;
                                const next = { ...flags.classOverrides };
                                next[liveEditorDate] = { ...(next[liveEditorDate] || {}) };
                                const key = makeOverrideKey(ident, c.section);
                                next[liveEditorDate][key] = { ...(next[liveEditorDate][key] || {}), room: cmdQuickRoomValue.trim(), modifiedAt: new Date().toISOString(), modifiedBy: admin_id };
                                setFlags({ ...flags, classOverrides: next });
                                setCmdUndoStack(s => [{ label: `Room: ${c.code} → ${cmdQuickRoomValue.trim()}`, prevOverrides: prev }, ...s.slice(0, 9)]);
                                logAdminAction(admin_id, "quick_room_change", { date: liveEditorDate, class: key, room: cmdQuickRoomValue.trim() });
                                setCmdQuickRoom(null); setCmdQuickRoomValue("");
                              }}
                              className="admin-btn primary" style={{ padding: "6px 14px", fontSize: 13 }}>Save</button>
                            <button onClick={() => setCmdQuickRoom(null)} style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer", padding: 4 }}><X size={14} /></button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })()}

            {/* Manual entry for classes not in snapshot */}
            <details style={{ marginTop: 16 }}>
              <summary style={{ fontSize: 13, color: "var(--muted)", cursor: "pointer", fontWeight: 600 }}>Manual entry (class not listed above?)</summary>
              <div className="admin-field-row" style={{ marginTop: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
                <div className="admin-field">
                  <label>Class Code</label>
                  <input type="text" list="cancel-course-codes" placeholder="e.g. BM" className="admin-input" value={overrideClass} onChange={e => setOverrideClass(e.target.value)} />
                  <datalist id="cancel-course-codes">
                    {Object.entries(LEGEND).map(([code, info]) => <option key={code} value={code}>{info.name}</option>)}
                  </datalist>
                </div>
                <div className="admin-field">
                  <label>Section</label>
                  <select className="admin-input" value={overrideSection} onChange={e => setOverrideSection(e.target.value)}>
                    <option value="All">All Sections</option>
                    <option value="A">Section A</option>
                    <option value="B">Section B</option>
                  </select>
                </div>
                <button className="admin-btn danger" onClick={handleAddOverride} style={{ flex: "0 0 auto", marginBottom: 10, padding: "9px 16px" }}>
                  <XCircle size={15} /> Cancel Class
                </button>
              </div>
            </details>
          </section>
          {/* Holiday / Day-off bulk cancel */}
          <section className="admin-card admin-span-all admin-g-schedule" style={{ gridColumn: "1 / -1" }}>
            <h2><XCircle size={20} color="var(--danger)" /> Holiday / Day-off</h2>
            <p className="admin-subtext">Cancel every class across a date range in one action (e.g. a festival break). Stages overrides — Review &amp; Deploy Config to apply.</p>
            <div className="admin-field-row" style={{ maxWidth: 560, alignItems: "flex-end" }}>
              <div className="admin-field"><label>From</label><input type="date" className="admin-input" value={holidayStart} onChange={e => setHolidayStart(e.target.value)} /></div>
              <div className="admin-field"><label>To</label><input type="date" className="admin-input" value={holidayEnd} onChange={e => setHolidayEnd(e.target.value)} /></div>
              <button className="admin-btn danger" style={{ flex: "0 0 auto", marginBottom: 10, padding: "9px 16px" }} onClick={applyHolidayCancel}><XCircle size={15} /> Cancel All</button>
            </div>
            {holidayStart && holidayEnd && holidayEnd >= holidayStart && (
              <div style={{ fontSize: 12, color: "var(--muted)" }}>{liveSchedule.filter(c => c.date >= holidayStart && c.date <= holidayEnd && c.type !== "break").length} class(es) will be cancelled in this range.</div>
            )}
          </section>

          {/* Bulk room relocation */}
          <section className="admin-card admin-span-all admin-g-schedule" style={{ gridColumn: "1 / -1" }}>
            <h2><CalendarDays size={20} color="var(--blue)" /> Room Relocation</h2>
            <p className="admin-subtext">Move every class from one room to another across a date range (e.g. "all A01 classes → A04 until 2 Aug"). Stages room overrides — Review &amp; Deploy to apply.</p>
            <details style={{ marginBottom: 12 }}>
              <summary style={{ cursor: "pointer", fontSize: 13, color: "var(--live)", fontWeight: 600 }}>📋 Paste from email / notice</summary>
              <div style={{ marginTop: 8 }}>
                <textarea className="admin-input" rows={3} value={relocEmail} onChange={e => setRelocEmail(e.target.value)} placeholder="e.g. Kindly note that room A01 will be shifted to A04 from 5 Aug to 12 Aug 2026." style={{ width: "100%", resize: "vertical" }} />
                <button className="admin-btn outline" style={{ marginTop: 6 }} onClick={parseRelocationEmail}><Search size={14} /> Parse &amp; pre-fill</button>
              </div>
            </details>
            <div className="admin-field-row" style={{ alignItems: "flex-end", flexWrap: "wrap" }}>
              <div className="admin-field"><label>From room</label><input className="admin-input" value={relocFrom} onChange={e => setRelocFrom(e.target.value)} placeholder="A01" /></div>
              <div className="admin-field"><label>To room</label><input className="admin-input" value={relocTo} onChange={e => setRelocTo(e.target.value)} placeholder="A04" /></div>
              <div className="admin-field"><label>From date</label><input type="date" className="admin-input" value={relocStart} onChange={e => setRelocStart(e.target.value)} /></div>
              <div className="admin-field"><label>To date</label><input type="date" className="admin-input" value={relocEnd} onChange={e => setRelocEnd(e.target.value)} /></div>
              <button className="admin-btn primary" style={{ flex: "0 0 auto", marginBottom: 10 }} onClick={applyRoomRelocation}><CalendarDays size={15} /> Relocate</button>
            </div>
            {relocFrom.trim() && relocStart && relocEnd && relocEnd >= relocStart && (
              <div style={{ fontSize: 12, color: "var(--muted)" }}>{liveSchedule.filter(c => c.date >= relocStart && c.date <= relocEnd && c.type !== "break" && (c.room || "").toLowerCase() === relocFrom.trim().toLowerCase()).length} class(es) in {relocFrom.trim()} will move.</div>
            )}
          </section>

          {/* Room / time conflict detector */}
          <section className="admin-card admin-span-all admin-g-schedule" style={{ gridColumn: "1 / -1" }}>
            <h2><AlertTriangle size={20} color="var(--amber)" /> Room &amp; Time Conflicts</h2>
            <p className="admin-subtext">Same room booked for different classes at the same date &amp; time in the bundled schedule.</p>
            {scheduleConflicts.length === 0 ? (
              <div className="admin-empty">No conflicts detected.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {scheduleConflicts.map((c, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "8px 12px", background: "rgba(245,158,11,0.08)", border: "1px solid var(--amber)", borderRadius: 8, fontSize: 13 }}>
                    <span><b>{c.room}</b> @ {c.start} · {c.date}</span>
                    <span style={{ color: "var(--amber-text, var(--amber))", fontWeight: 700 }}>{c.codes.join(" vs ")}</span>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Class Editor */}
          <section className="admin-card admin-span-all admin-g-schedule" style={{ gridColumn: "1 / -1" }}>
            <h2><CalendarDays size={20} color="var(--blue)" /> Class Editor</h2>
            <p className="admin-subtext">Globally change the classroom or timings for a specific class on a given date.</p>
            <div className="admin-field-row" style={{ marginTop: 10 }}>
              <div className="admin-field">
                <label>Date</label>
                <input type="date" className="admin-input" value={roomOverrideDate} onChange={e => setRoomOverrideDate(e.target.value)} />
              </div>
              <div className="admin-field">
                <label>Class Code</label>
                <input type="text" placeholder="e.g. BM" className="admin-input" value={roomOverrideClass} onChange={e => setRoomOverrideClass(e.target.value)} />
              </div>
              <div className="admin-field">
                <label>Section</label>
                <select className="admin-input" value={roomOverrideSection} onChange={e => setRoomOverrideSection(e.target.value)}>
                  <option value="All">All Sections</option>
                  <option value="A">Section A</option>
                  <option value="B">Section B</option>
                </select>
              </div>
            </div>
            <div className="admin-field-row">
              <div className="admin-field">
                <label>New Start <span className="admin-optional">(optional)</span></label>
                <input type="time" className="admin-input" value={roomOverrideStart} onChange={e => setRoomOverrideStart(e.target.value)} />
              </div>
              <div className="admin-field">
                <label>New End <span className="admin-optional">(optional)</span></label>
                <input type="time" className="admin-input" value={roomOverrideEnd} onChange={e => setRoomOverrideEnd(e.target.value)} />
              </div>
              <div className="admin-field">
                <label>New Classroom <span className="admin-optional">(optional)</span></label>
                <input type="text" placeholder="e.g. C-104" className="admin-input" value={roomOverrideRoom} onChange={e => setRoomOverrideRoom(e.target.value)} />
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 4, flexWrap: "wrap" }}>
               <button className="admin-btn blue" onClick={handleAddRoomOverride} style={{ padding: "9px 16px" }}><CalendarDays size={15} /> Save Change</button>
               {roomOverrideDate && roomOverrideClass && flags.classOverrides?.[roomOverrideDate]?.[roomOverrideSection === "All" ? roomOverrideClass : `${roomOverrideClass}_${roomOverrideSection}`] && (
                 <button onClick={() => {
                    const overrideKey = roomOverrideSection === "All" ? roomOverrideClass : `${roomOverrideClass}_${roomOverrideSection}`;
                    const next = {...flags.classOverrides};
                    next[roomOverrideDate] = { ...next[roomOverrideDate] };
                    delete next[roomOverrideDate][overrideKey];
                    if (Object.keys(next[roomOverrideDate]).length === 0) delete next[roomOverrideDate];
                    setFlags({...flags, classOverrides: next});
                    setRoomOverrideClass("");
                    setRoomOverrideRoom("");
                    setRoomOverrideStart("");
                    setRoomOverrideEnd("");
                    setRoomOverrideSection("All");
                 }} className="admin-btn outline" style={{ padding: "9px 16px", borderColor: "var(--danger)", color: "var(--danger)" }}>Remove Override</button>
               )}
            </div>
          </section>

          {/* Bulk Overrides & Copy */}
          <section className="admin-card admin-span-all admin-g-schedule" style={{ gridColumn: "1 / -1", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 32 }}>
             <div>
                <h2><CalendarDays size={20} color="var(--violet)" /> Copy Overrides</h2>
                <p className="admin-subtext">Duplicate all overrides (cancellations/rooms) from one day to another.</p>
                <div className="admin-field-row" style={{ marginTop: 12 }}>
                   <div className="admin-field">
                      <label>Source Date</label>
                      <input type="date" className="admin-input" value={copySourceDate} onChange={e => setCopySourceDate(e.target.value)} />
                   </div>
                   <div className="admin-field">
                      <label>Target Date</label>
                      <input type="date" className="admin-input" value={copyTargetDate} onChange={e => setCopyTargetDate(e.target.value)} />
                   </div>
                </div>
                <button className="admin-btn outline" style={{ marginTop: 12 }} onClick={() => {
                   if(!copySourceDate || !copyTargetDate) return alert("Select both dates.");
                   if(!flags.classOverrides?.[copySourceDate]) return alert("No overrides found on source date.");
                   if(!window.confirm(`Copy all overrides from ${copySourceDate} to ${copyTargetDate}?`)) return;
                   
                   const next = {...flags.classOverrides};
                   next[copyTargetDate] = JSON.parse(JSON.stringify(next[copySourceDate]));
                   setFlags({...flags, classOverrides: next});
                   setCopySourceDate(""); setCopyTargetDate("");
                }}>Copy to Target Date</button>
             </div>
             <div>
                <h2><FileText size={20} color="var(--blue)" /> Bulk CSV Importer</h2>
                <p className="admin-subtext">Format: Date,Code,Section,Room,Start,End,Cancel(true/false)</p>
                <textarea className="admin-textarea" value={bulkCsv} onChange={e => setBulkCsv(e.target.value)} placeholder="2026-07-20,BM,A,C-104,10:00,11:30,false&#10;2026-07-21,QM,B,,,,true" rows={4} style={{ marginTop: 12, fontFamily: "monospace", fontSize: 12, whiteSpace: "pre" }}></textarea>
                <button className="admin-btn outline" style={{ marginTop: 12 }} onClick={() => {
                   if (!bulkCsv.trim()) return;
                   try {
                      const next = {...flags.classOverrides};
                      const lines = bulkCsv.trim().split("\n");
                      let count = 0;
                      for (const line of lines) {
                         const [date, code, section, room, start, end, cancelStr] = line.split(",").map(s => s?.trim());
                         if (!date || !code || !section) continue;
                         if (!next[date]) next[date] = {};
                         const sectionKey = section === "All" || section === "Single" ? code : `${code}_${section}`;
                         
                         if (cancelStr?.toLowerCase() === "true") {
                            next[date][sectionKey] = { type: "cancelled", modifiedAt: new Date().toISOString(), modifiedBy: admin_id };
                         } else {
                            next[date][sectionKey] = {
                               type: "class",
                               ...(room && { room }),
                               ...(start && { start }),
                               ...(end && { end }),
                               modifiedAt: new Date().toISOString(),
                               modifiedBy: admin_id
                            };
                         }
                         count++;
                      }
                      setFlags({...flags, classOverrides: next});
                      setBulkCsv(""); setCsvPreview(null);
                      alert(`Imported ${count} overrides successfully.`);
                   } catch (e) {
                      alert("Invalid CSV format. " + e.message);
                   }
                }}>Import CSV</button>
                <button className="admin-btn outline" style={{ marginTop: 12, marginLeft: 8 }} onClick={previewCsvImport}>Preview (dry run)</button>
                {csvPreview && (
                   <div style={{ marginTop: 10, padding: 12, background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}>
                      <div style={{ fontWeight: 700, marginBottom: 6 }}>
                        {csvPreview.valid} valid row(s)
                        {csvPreview.invalid.length > 0 && <span style={{ color: "var(--danger)" }}> · {csvPreview.invalid.length} invalid (line {csvPreview.invalid.join(", ")})</span>}
                      </div>
                      {csvPreview.sample.map((s, i) => <div key={i} style={{ color: "var(--muted)", fontFamily: "var(--mono)" }}>{s}</div>)}
                      {csvPreview.valid > csvPreview.sample.length && <div style={{ color: "var(--muted)" }}>…and {csvPreview.valid - csvPreview.sample.length} more</div>}
                   </div>
                )}
             </div>
          </section>

          {/* ── Active Class Overrides Hub ── */}
          {flags.classOverrides && Object.keys(flags.classOverrides).length > 0 && (
            <section className="admin-card admin-span-all admin-g-schedule" style={{ gridColumn: "1 / -1" }}>
              <h2><Pencil size={20} color="var(--blue)" /> Active Class Overrides</h2>

              {/* Summary metrics */}
              {(() => {
                let nCancelled = 0, nRoom = 0, nTime = 0, nExam = 0, nCustom = 0;
                Object.values(flags.classOverrides).forEach(day => Object.values(day).forEach(ovr => {
                  if (ovr.type === "cancelled") nCancelled++;
                  else if (ovr.type === "exam") nExam++;
                  else if (ovr.type === "class") nCustom++;
                  else { if (ovr.room) nRoom++; if (ovr.start || ovr.end) nTime++; }
                }));
                const total = nCancelled + nRoom + nTime + nExam + nCustom;
                return (
                  <div style={{ display: "flex", gap: 12, marginTop: 12, marginBottom: 14, flexWrap: "wrap" }}>
                    {[
                      { label: `${total} Total`, color: "var(--text)", bg: "var(--bg)", filter: "all" },
                      { label: `${nCancelled} Cancelled`, color: "var(--danger)", bg: "rgba(231,76,60,0.06)", filter: "cancelled" },
                      { label: `${nRoom} Room`, color: "var(--blue)", bg: "rgba(59,130,246,0.06)", filter: "room" },
                      { label: `${nTime} Time`, color: "var(--amber)", bg: "rgba(245,158,11,0.06)", filter: "time" },
                      { label: `${nExam} Exam`, color: "var(--violet)", bg: "rgba(109,91,208,0.08)", filter: "exam" },
                      { label: `${nCustom} Custom`, color: "var(--live)", bg: "rgba(31,169,113,0.06)", filter: "custom" },
                    ].map(chip => (
                      <button key={chip.filter} onClick={() => setOvrFilterType(chip.filter)}
                        style={{ padding: "5px 14px", borderRadius: 20, border: `1.5px solid ${ovrFilterType === chip.filter ? chip.color : "var(--border)"}`, background: ovrFilterType === chip.filter ? chip.bg : "transparent", color: ovrFilterType === chip.filter ? chip.color : "var(--muted)", cursor: "pointer", fontSize: 12, fontWeight: 700, transition: "all 0.15s" }}>
                        {chip.label}
                      </button>
                    ))}
                    <input type="text" placeholder="Search code or room…" value={ovrSearch} onChange={e => setOvrSearch(e.target.value)}
                      className="admin-input" style={{ marginLeft: "auto", width: 180, padding: "5px 10px", fontSize: 12 }} />
                  </div>
                );
              })()}

              {/* Stale overrides alert */}
              {staleOverrideDates.length > 0 && (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", padding: "10px 14px", background: "rgba(245,158,11,0.08)", border: "1px solid var(--amber)", borderRadius: 10, marginBottom: 12 }}>
                  <span style={{ fontSize: 13 }}><AlertTriangle size={15} color="var(--amber)" style={{ verticalAlign: "middle", marginRight: 6 }} />{staleOverrideDates.length} override date(s) are in the past — students still download them.</span>
                  <button className="admin-btn outline" onClick={purgeStaleOverrides} style={{ borderColor: "var(--amber)", color: "var(--amber)" }}><Trash2 size={14} /> Purge expired</button>
                </div>
              )}

              {/* Override rows */}
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {Object.entries(flags.classOverrides).flatMap(([date, classes]) =>
                  Object.entries(classes).map(([code, override]) => {
                    const isCancelled = override.type === "cancelled";
                    const isExam = override.type === "exam";
                    const isCustom = override.type === "class";
                    const hasRoom = !!override.room;
                    const hasTime = !!override.start || !!override.end;
                    const { ident: keyIdent, section: keySection } = parseOverrideKey(code);
                    const displayBase = keyIdent || "⚠ legacy";
                    const displayCode = keySection !== "All" ? `${displayBase} (Sec ${keySection})` : displayBase;
                    const rowKey = `${date}::${code}`;
                    const isEditing = ovrEditKey === rowKey;

                    // Filter logic
                    const matchesType = ovrFilterType === "all"
                      || (ovrFilterType === "cancelled" && isCancelled)
                      || (ovrFilterType === "exam" && isExam)
                      || (ovrFilterType === "custom" && isCustom)
                      || (ovrFilterType === "room" && hasRoom && !isCancelled && !isExam)
                      || (ovrFilterType === "time" && hasTime && !isCancelled && !isExam);
                    const matchesSearch = !ovrSearch || displayCode.toLowerCase().includes(ovrSearch.toLowerCase()) || (override.room || "").toLowerCase().includes(ovrSearch.toLowerCase());
                    if (!matchesType || !matchesSearch) return null;

                    // Type badge
                    const typeBadge = isCancelled ? { label: "CANCELLED", color: "var(--danger)", bg: "rgba(231,76,60,0.10)" }
                      : isExam ? { label: "EXAM", color: "var(--violet)", bg: "rgba(109,91,208,0.10)" }
                      : isCustom ? { label: "CUSTOM CLASS", color: "var(--live)", bg: "rgba(31,169,113,0.10)" }
                      : hasRoom && hasTime ? { label: `ROOM+TIME`, color: "var(--amber)", bg: "rgba(245,158,11,0.10)" }
                      : hasRoom ? { label: `ROOM: ${override.room}`, color: "var(--blue)", bg: "rgba(59,130,246,0.10)" }
                      : { label: `TIME: ${override.start || "?"}–${override.end || "?"}`, color: "var(--amber)", bg: "rgba(245,158,11,0.10)" };

                    return (
                      <div key={rowKey} style={{ borderRadius: 10, border: `1px solid ${isEditing ? "var(--blue)" : "var(--border)"}`, background: isEditing ? "rgba(59,130,246,0.03)" : "var(--bg)", overflow: "hidden", transition: "border-color 0.15s" }}>
                        {/* Main row */}
                        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px" }}>
                          {/* Type badge */}
                          <span style={{ fontSize: 10, fontWeight: 800, padding: "2px 8px", borderRadius: 6, background: typeBadge.bg, color: typeBadge.color, flexShrink: 0, letterSpacing: "0.5px" }}>{typeBadge.label}</span>
                          {/* Info */}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 700, fontSize: 13 }}>
                              {new Date(date + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" })} — {displayCode}
                            </div>
                            {override.modifiedAt && (
                              <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
                                Modified {new Date(override.modifiedAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                                {override.modifiedBy ? ` · ${allUsers.find(u => u.user_id === override.modifiedBy)?.name || "admin"}` : ""}
                              </div>
                            )}
                          </div>
                          {/* Actions */}
                          <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
                            {isCancelled && (
                              <button title="Restore class" onClick={() => {
                                const prev = flags.classOverrides;
                                const next = { ...flags.classOverrides };
                                const forDate = { ...next[date] };
                                delete forDate[code];
                                if (Object.keys(forDate).length === 0) delete next[date]; else next[date] = forDate;
                                setFlags({ ...flags, classOverrides: next });
                                removeWithUndo(`Override removed — ${displayCode}`, () => setFlags(f => ({ ...f, classOverrides: prev })));
                              }} style={{ background: "none", border: "1px solid var(--live)", borderRadius: 6, cursor: "pointer", color: "var(--live)", fontSize: 12, fontWeight: 600, padding: "3px 10px", display: "flex", alignItems: "center", gap: 4 }}>
                                <RefreshCw size={12} /> Restore
                              </button>
                            )}
                            {!isCancelled && (
                              <button title="Edit inline" onClick={() => {
                                if (isEditing) { setOvrEditKey(null); return; }
                                setOvrEditKey(rowKey);
                                setOvrEditValues({ room: override.room || "", start: override.start || "", end: override.end || "" });
                              }} style={{ background: "none", border: `1px solid ${isEditing ? "var(--blue)" : "var(--border)"}`, borderRadius: 6, cursor: "pointer", color: isEditing ? "var(--blue)" : "var(--muted)", fontSize: 12, fontWeight: 600, padding: "3px 10px", display: "flex", alignItems: "center", gap: 4 }}>
                                <Pencil size={12} /> {isEditing ? "Close" : "Edit"}
                              </button>
                            )}
                            <button title="Delete override" onClick={() => {
                              const prev = flags.classOverrides;
                              const next = { ...prev };
                              next[date] = { ...next[date] };
                              delete next[date][code];
                              if (Object.keys(next[date]).length === 0) delete next[date];
                              setFlags({ ...flags, classOverrides: next });
                              removeWithUndo(`Override removed — ${displayCode}`, () => setFlags(f => ({ ...f, classOverrides: prev })));
                              if (isEditing) setOvrEditKey(null);
                            }} style={{ background: "none", border: "none", cursor: "pointer", padding: 4, display: "flex", alignItems: "center" }}>
                              <Trash2 size={15} color="var(--danger)" />
                            </button>
                          </div>
                        </div>
                        {/* Inline edit form */}
                        {isEditing && (
                          <div style={{ borderTop: "1px solid var(--border)", padding: "12px 14px", display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap", background: "rgba(59,130,246,0.03)" }}>
                            <div className="admin-field" style={{ flex: 1, minWidth: 100 }}>
                              <label>Room</label>
                              <input type="text" placeholder="e.g. C-104" className="admin-input" value={ovrEditValues.room} onChange={e => setOvrEditValues(v => ({ ...v, room: e.target.value }))} />
                            </div>
                            <div className="admin-field" style={{ flex: 1, minWidth: 100 }}>
                              <label>New Start</label>
                              <input type="time" className="admin-input" value={ovrEditValues.start} onChange={e => setOvrEditValues(v => ({ ...v, start: e.target.value }))} />
                            </div>
                            <div className="admin-field" style={{ flex: 1, minWidth: 100 }}>
                              <label>New End</label>
                              <input type="time" className="admin-input" value={ovrEditValues.end} onChange={e => setOvrEditValues(v => ({ ...v, end: e.target.value }))} />
                            </div>
                            <button className="admin-btn primary" style={{ marginBottom: 10, padding: "8px 16px" }}
                              onClick={() => {
                                if (!ovrEditValues.room && !ovrEditValues.start && !ovrEditValues.end) return alert("Enter at least one change.");
                                const next = { ...flags.classOverrides };
                                next[date] = { ...next[date] };
                                const existing = next[date][code] || {};
                                const changes = { ...existing };
                                if (ovrEditValues.room) changes.room = ovrEditValues.room;
                                if (ovrEditValues.start) changes.start = ovrEditValues.start;
                                if (ovrEditValues.end) changes.end = ovrEditValues.end;
                                changes.modifiedAt = new Date().toISOString();
                                changes.modifiedBy = admin_id;
                                next[date][code] = changes;
                                setFlags({ ...flags, classOverrides: next });
                                logAdminAction(admin_id, "inline_edit_override", { date, class: code, changes: ovrEditValues });
                                setOvrEditKey(null);
                              }}>
                              <Check size={14} /> Save Changes
                            </button>
                            <button className="admin-btn outline" style={{ marginBottom: 10, padding: "8px 14px" }} onClick={() => setOvrEditKey(null)}>Cancel</button>
                          </div>
                        )}
                      </div>
                    );
                  }).filter(Boolean)
                )}
              </div>
            </section>
          )}
                {/* ── 1. Broadcast Studio (Announcements + Push + Social Flash + Quiet Hours) ── */}
        <section className="admin-card admin-span-all admin-g-broadcast" style={{ gridColumn: "1 / -1" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
            <div>
              <h2 style={{ marginBottom: 4 }}><Megaphone size={20} color="var(--amber)" /> Broadcast Studio</h2>
              <p className="admin-subtext" style={{ margin: 0 }}>Compose and dispatch banners, push notifications, and live toast alerts to students.</p>
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={() => setOpenBcast(o => ({ ...o, announcements: !o.announcements }))}
                style={{
                  padding: "6px 12px", borderRadius: 8, fontSize: 12.5, fontWeight: 700, cursor: "pointer",
                  border: openBcast.announcements ? "1.5px solid var(--amber)" : "1px solid var(--border)",
                  background: openBcast.announcements ? "rgba(245,158,11,0.12)" : "var(--bg)",
                  color: openBcast.announcements ? "var(--amber)" : "var(--muted)",
                  display: "flex", alignItems: "center", gap: 6
                }}>
                <Megaphone size={14} /> Banners {(flags.scheduledAnnouncements || []).length > 0 ? `(${flags.scheduledAnnouncements.length})` : ""}
              </button>
              <button
                type="button"
                onClick={() => setOpenBcast(o => ({ ...o, push: !o.push }))}
                style={{
                  padding: "6px 12px", borderRadius: 8, fontSize: 12.5, fontWeight: 700, cursor: "pointer",
                  border: openBcast.push ? "1.5px solid var(--live)" : "1px solid var(--border)",
                  background: openBcast.push ? "rgba(31,169,113,0.12)" : "var(--bg)",
                  color: openBcast.push ? "var(--live)" : "var(--muted)",
                  display: "flex", alignItems: "center", gap: 6
                }}>
                <BellRing size={14} /> Web Push {(flags.scheduledPushes || []).length > 0 ? `(${flags.scheduledPushes.length})` : ""}
              </button>
              <button
                type="button"
                onClick={() => setOpenBcast(o => ({ ...o, social: !o.social }))}
                style={{
                  padding: "6px 12px", borderRadius: 8, fontSize: 12.5, fontWeight: 700, cursor: "pointer",
                  border: openBcast.social ? "1.5px solid var(--violet)" : "1px solid var(--border)",
                  background: openBcast.social ? "rgba(139,92,246,0.12)" : "var(--bg)",
                  color: openBcast.social ? "var(--violet)" : "var(--muted)",
                  display: "flex", alignItems: "center", gap: 6
                }}>
                <Sparkles size={14} /> Social Flash
              </button>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                        {/* ── Accordion 1: In-App Scheduled Announcements ── */}
            <div style={{ border: `1px solid ${openBcast.announcements ? "var(--amber)" : "var(--border)"}`, borderRadius: 12, overflow: "hidden", background: "var(--bg)", transition: "border-color 0.15s" }}>
              <div
                onClick={() => setOpenBcast(o => ({ ...o, announcements: !o.announcements }))}
                style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", cursor: "pointer", background: openBcast.announcements ? "rgba(245,158,11,0.06)" : "transparent" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <Megaphone size={17} color="var(--amber)" />
                  <span style={{ fontWeight: 700, fontSize: 14, color: "var(--text)" }}>In-App Banner Announcements</span>
                  {(flags.scheduledAnnouncements || []).length > 0 && (
                    <span style={{ fontSize: 11, fontWeight: 800, padding: "2px 8px", borderRadius: 10, background: "rgba(245,158,11,0.15)", color: "var(--amber)" }}>
                      {flags.scheduledAnnouncements.length} active
                    </span>
                  )}
                </div>
                <span style={{ color: "var(--muted)", fontSize: 13, fontWeight: 600 }}>{openBcast.announcements ? "▲ Collapse" : "▼ Expand"}</span>
              </div>

              {openBcast.announcements && (
                <div style={{ padding: "16px", borderTop: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: 14 }}>
                  
                  {/* Template presets library */}
                  {(flags.announcementTemplates || []).length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>Templates:</span>
                      {(flags.announcementTemplates || []).map(t => (
                        <span key={t.id} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "var(--card)", border: "1px solid var(--border)", borderRadius: 20, padding: "3px 6px 3px 10px", fontSize: 11.5 }}>
                          <button type="button" onClick={() => applyAnnouncementTemplate(t)} title={t.text} style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--text)", fontWeight: 600, padding: 0 }}>{t.label}</button>
                          <button type="button" onClick={() => removeAnnouncementTemplate(t.id)} title="Delete template" style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--danger)", display: "flex", padding: 0 }}><X size={12} /></button>
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Date range presets row */}
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                      <label style={{ fontSize: 11.5, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>Schedule &amp; Dates</label>
                      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                        {[
                          { label: "Today", days: 0 },
                          { label: "Next 3 Days", days: 3 },
                          { label: "This Week", days: 7 },
                          { label: "2 Weeks", days: 14 },
                          { label: "Term End", termEnd: "2026-09-04" },
                        ].map(p => (
                          <button key={p.label} type="button"
                            onClick={() => {
                              const t = new Date();
                              const start = t.toISOString().split("T")[0];
                              let end = start;
                              if (p.termEnd) {
                                end = p.termEnd;
                              } else {
                                const e = new Date(); e.setDate(e.getDate() + p.days);
                                end = e.toISOString().split("T")[0];
                              }
                              setAnnouncementStart(start);
                              setAnnouncementEnd(end);
                            }}
                            style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, padding: "2px 8px", fontSize: 11, fontWeight: 600, color: "var(--muted)", cursor: "pointer" }}>
                            {p.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <input type="date" value={announcementStart} onChange={e => setAnnouncementStart(e.target.value)} className="admin-input" style={{ flex: "1 1 130px", padding: "8px", borderRadius: 8 }} title="Start Date" />
                      <input type="date" value={announcementEnd} onChange={e => setAnnouncementEnd(e.target.value)} className="admin-input" style={{ flex: "1 1 130px", padding: "8px", borderRadius: 8 }} title="End Date (Inclusive)" />
                      <select className="admin-input" value={announcementTarget} onChange={e => setAnnouncementTarget(e.target.value)} style={{ flex: "2 1 170px", padding: "8px", borderRadius: 8 }}>
                        <option value="global">🌐 Global (All Students)</option>
                        <option value="section_A">🅰️ Section A Only</option>
                        <option value="section_B">🅱️ Section B Only</option>
                        <option value="has_friends">👥 Social Users</option>
                        <optgroup label="Subject Specific">
                          {Object.entries(LEGEND || {}).map(([code, info]) => (
                            <option key={code} value={`subject_${code}`}>{code} — {info.name}</option>
                          ))}
                        </optgroup>
                      </select>
                      <select className="admin-input" value={announcementSeverity} onChange={e => setAnnouncementSeverity(e.target.value)} style={{ flex: "1.5 1 140px", padding: "8px", borderRadius: 8 }} title="Banner severity / colour">
                        <option value="info">🟣 Info (Purple)</option>
                        <option value="warning">🟡 Warning (Amber)</option>
                        <option value="urgent">🔴 Urgent (Red)</option>
                        <option value="celebration">🟢 Celebration (Green 🎉)</option>
                        <option value="exam">🎓 Exam Alert (Indigo)</option>
                      </select>
                    </div>
                  </div>

                  {/* Audience estimator */}
                  {(() => { const n = audienceCount(announcementTarget); return (
                    <div style={{ fontSize: 12, color: "var(--muted)", display: "flex", alignItems: "center", gap: 6, marginTop: -4 }}>
                      <Users size={13} /> Estimated Audience: <b style={{ color: "var(--text)" }}>{n === null ? "Varies per student" : `~${n} students`}</b>
                    </div>
                  ); })()}

                  {/* Message composition with quick emoji helpers */}
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                      <label style={{ fontSize: 11.5, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>Announcement Message</label>
                      <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                        <span style={{ fontSize: 11, color: "var(--muted)", marginRight: 4 }}>Add icon:</span>
                        {["⚡", "📢", "🚨", "🎉", "🎓", "ℹ️", "🗓️", "🔔"].map(em => (
                          <button key={em} type="button" onClick={() => setAnnouncement(prev => prev ? `${em} ${prev}` : `${em} `)}
                            style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 6, padding: "1px 5px", fontSize: 12, cursor: "pointer" }}>
                            {em}
                          </button>
                        ))}
                      </div>
                    </div>
                    <textarea
                      className="admin-textarea"
                      value={announcement}
                      onChange={e => setAnnouncement(e.target.value)}
                      placeholder="e.g., 📢 Term 5 Exam registrations close tomorrow at 5:00 PM!"
                      rows={2}
                    />
                  </div>

                  {/* Realtime student preview */}
                  {announcement.trim() && (
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".05em", textTransform: "uppercase", color: "var(--muted)" }}>Student In-App Live Preview</span>
                        <button type="button" onClick={() => setPreviewTheme(previewTheme === "dark" ? "light" : "dark")} style={{ background: "transparent", border: "1px solid var(--border)", borderRadius: 8, padding: "3px 10px", fontSize: 11, fontWeight: 600, color: "var(--text)", cursor: "pointer" }}>
                          {previewTheme === "dark" ? "🌙 Dark" : "☀️ Light"} mode preview
                        </button>
                      </div>
                      {(() => {
                        const bg = announcementSeverity === "urgent" ? "var(--danger, #EF4444)"
                          : announcementSeverity === "info" ? "var(--violet, #8B5CF6)"
                          : announcementSeverity === "celebration" ? "var(--green, #10B981)"
                          : announcementSeverity === "exam" ? "var(--blue, #6366F1)"
                          : "var(--amber, #F59E0B)";
                        const fg = announcementSeverity === "warning" ? "#000" : "#fff";
                        return (
                          <div style={{ padding: 14, borderRadius: 12, border: "1px solid var(--border)", background: previewTheme === "dark" ? "#101216" : "#F3F1EA" }}>
                            <div style={{ background: bg, color: fg, padding: "11px 14px", borderRadius: 10, display: "flex", gap: 10, alignItems: "center", fontWeight: 600, fontSize: 13.5, boxShadow: "0 2px 8px rgba(0,0,0,0.15)" }}>
                              <Megaphone size={16} style={{ flexShrink: 0 }} />
                              <span style={{ flex: 1, lineHeight: 1.4 }}>{announcement}</span>
                              <X size={15} style={{ flexShrink: 0, opacity: 0.75, cursor: "pointer" }} />
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  )}

                  {/* Action buttons */}
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                    <button className="admin-btn primary" onClick={() => {
                      if (!announcement.trim() || !announcementStart || !announcementEnd) return alert("Please fill message and start/end dates.");
                      const newItem = { id: Date.now().toString(), message: announcement.trim(), target: announcementTarget, start: announcementStart, end: announcementEnd, severity: announcementSeverity };
                      setFlags({...flags, scheduledAnnouncements: [...(flags.scheduledAnnouncements || []), newItem]});
                      setAnnouncement(""); setAnnouncementStart(""); setAnnouncementEnd(""); setAnnouncementSeverity("info");
                    }}>
                      <Megaphone size={14} /> Add Scheduled Announcement
                    </button>
                    <input className="admin-input" value={tplLabel} onChange={e => setTplLabel(e.target.value)} placeholder="Template name (e.g. Exam)" style={{ flex: "1 1 140px", maxWidth: 180 }} />
                    <button className="admin-btn outline" onClick={saveAnnouncementTemplate} disabled={!announcement.trim() || !tplLabel.trim()} title="Save the current message + severity as a reusable template"><Save size={14} /> Save template</button>
                  </div>

                  {/* Overlap detector warning */}
                  {announcementOverlaps.length > 0 && (
                    <div style={{ padding: "10px 14px", background: "rgba(245,158,11,0.08)", border: "1px solid var(--amber)", borderRadius: 10 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "var(--amber)", display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}><AlertTriangle size={15} /> {announcementOverlaps.length} overlapping announcement(s) detected</div>
                      {announcementOverlaps.map((c, i) => (
                        <div key={i} style={{ fontSize: 12, color: "var(--muted)" }}>
                          • “{(c.a.message || "").slice(0, 32)}” &amp; “{(c.b.message || "").slice(0, 32)}” both appear to {c.a.target === "global" || c.b.target === "global" ? "everyone" : c.a.target} on overlapping dates.
                        </div>
                      ))}
                    </div>
                  )}

                  {/* ── Active Announcements Manager Table / List ── */}
                  {(() => {
                    const todayStr = new Date().toISOString().split("T")[0];
                    const items = flags.scheduledAnnouncements || [];
                    const nActive = items.filter(a => a.start <= todayStr && todayStr <= a.end).length;
                    const nUpcoming = items.filter(a => a.start > todayStr).length;
                    const nExpired = items.filter(a => a.end < todayStr).length;

                    const filtered = items.filter(a => {
                      const isLive = a.start <= todayStr && todayStr <= a.end;
                      const isUpcoming = a.start > todayStr;
                      const isExpired = a.end < todayStr;
                      if (annFilter === "active" && !isLive) return false;
                      if (annFilter === "upcoming" && !isUpcoming) return false;
                      if (annFilter === "expired" && !isExpired) return false;
                      if (annSearch.trim()) {
                        const q = annSearch.toLowerCase();
                        return (a.message || "").toLowerCase().includes(q) || (a.target || "").toLowerCase().includes(q);
                      }
                      return true;
                    });

                    return (
                      <div style={{ marginTop: 8, borderTop: "1px solid var(--border)", paddingTop: 14 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                            {[
                              { id: "all", label: `All (${items.length})` },
                              { id: "active", label: `🟢 Live Now (${nActive})` },
                              { id: "upcoming", label: `🟣 Upcoming (${nUpcoming})` },
                              { id: "expired", label: `🔴 Expired (${nExpired})` },
                            ].map(f => (
                              <button key={f.id} type="button" onClick={() => setAnnFilter(f.id)}
                                style={{ padding: "4px 10px", borderRadius: 16, border: annFilter === f.id ? "1.5px solid var(--blue)" : "1px solid var(--border)", background: annFilter === f.id ? "rgba(59,130,246,0.10)" : "var(--card)", color: annFilter === f.id ? "var(--blue)" : "var(--muted)", fontSize: 12, fontWeight: annFilter === f.id ? 700 : 500, cursor: "pointer" }}>
                                {f.label}
                              </button>
                            ))}
                          </div>
                          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                            <input type="text" placeholder="Search banners…" value={annSearch} onChange={e => setAnnSearch(e.target.value)}
                              className="admin-input" style={{ width: 150, padding: "4px 8px", fontSize: 12 }} />
                            {nExpired > 0 && (
                              <button type="button" onClick={() => {
                                if (!confirm(`Remove all ${nExpired} expired announcement(s)?`)) return;
                                const prev = flags.scheduledAnnouncements || [];
                                setFlags({ ...flags, scheduledAnnouncements: prev.filter(a => a.end >= todayStr) });
                                removeWithUndo("Expired announcements purged", () => setFlags(f => ({ ...f, scheduledAnnouncements: prev })));
                              }} className="admin-btn outline" style={{ fontSize: 11, padding: "4px 8px", color: "var(--danger)", borderColor: "var(--danger)" }}>
                                Purge Expired
                              </button>
                            )}
                          </div>
                        </div>

                        {filtered.length === 0 ? (
                          <div className="admin-empty" style={{ padding: "16px 0" }}>No announcements match this filter.</div>
                        ) : (
                          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                            {filtered.map(a => {
                              const isLive = a.start <= todayStr && todayStr <= a.end;
                              const isUpcoming = a.start > todayStr;
                              const isExpired = a.end < todayStr;
                              const isEditing = editingAnnId === a.id;

                              const statusTag = isLive ? { label: "LIVE NOW", color: "var(--live, #10B981)", bg: "rgba(16,185,129,0.12)" }
                                : isUpcoming ? { label: "UPCOMING", color: "var(--violet, #8B5CF6)", bg: "rgba(139,92,246,0.12)" }
                                : { label: "EXPIRED", color: "var(--danger, #EF4444)", bg: "rgba(239,68,68,0.12)" };

                              return (
                                <div key={a.id} style={{ borderRadius: 10, border: `1px solid ${isEditing ? "var(--blue)" : isLive ? "var(--live)" : "var(--border)"}`, background: isEditing ? "rgba(59,130,246,0.03)" : "var(--card)", padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                                  <div style={{ display: "flex", alignItems: "flex-start", gap: 10, justifyContent: "space-between" }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                                      <span style={{ fontSize: 10, fontWeight: 800, padding: "2px 7px", borderRadius: 6, background: statusTag.bg, color: statusTag.color, letterSpacing: "0.5px" }}>
                                        {statusTag.label}
                                      </span>
                                      <span style={{ fontSize: 10.5, fontWeight: 700, padding: "2px 7px", borderRadius: 6, background: "var(--bg)", border: "1px solid var(--border)", color: "var(--muted)", textTransform: "uppercase" }}>
                                        {a.severity || "info"}
                                      </span>
                                      <span style={{ fontSize: 11.5, color: "var(--muted)" }}>
                                        Target: <b style={{ color: "var(--text)" }}>{a.target === "global" ? "Everyone" : a.target}</b> · {a.start} to {a.end}
                                      </span>
                                    </div>
                                    <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                                      {/* Clone button */}
                                      <button type="button" title="Duplicate announcement" onClick={() => {
                                        const copy = { ...a, id: Date.now().toString(), message: `(Copy) ${a.message}` };
                                        setFlags({ ...flags, scheduledAnnouncements: [...(flags.scheduledAnnouncements || []), copy] });
                                      }} className="admin-btn outline" style={{ padding: "3px 8px", fontSize: 11 }}>
                                        <Copy size={12} />
                                      </button>
                                      {/* Edit button */}
                                      <button type="button" title="Edit announcement" onClick={() => {
                                        if (isEditing) { setEditingAnnId(null); return; }
                                        setEditingAnnId(a.id);
                                        setEditAnnMsg(a.message || "");
                                        setEditAnnStart(a.start || "");
                                        setEditAnnEnd(a.end || "");
                                        setEditAnnTarget(a.target || "global");
                                        setEditAnnSeverity(a.severity || "info");
                                      }} className="admin-btn outline" style={{ padding: "3px 8px", fontSize: 11, color: isEditing ? "var(--blue)" : "var(--muted)" }}>
                                        <Pencil size={12} />
                                      </button>
                                      {/* Delete button */}
                                      <button type="button" title="Delete announcement" onClick={() => {
                                        const prev = flags.scheduledAnnouncements;
                                        setFlags({ ...flags, scheduledAnnouncements: prev.filter(x => x.id !== a.id) });
                                        removeWithUndo("Announcement removed", () => setFlags(f => ({ ...f, scheduledAnnouncements: prev })));
                                        if (isEditing) setEditingAnnId(null);
                                      }} className="admin-btn danger" style={{ padding: "3px 8px", fontSize: 11 }}>
                                        <Trash2 size={12} />
                                      </button>
                                    </div>
                                  </div>

                                  {!isEditing ? (
                                    <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text)", lineHeight: 1.4 }}>
                                      {a.message}
                                    </div>
                                  ) : (
                                    /* Inline Edit Form */
                                    <div style={{ borderTop: "1px solid var(--border)", paddingTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
                                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                        <input type="date" value={editAnnStart} onChange={e => setEditAnnStart(e.target.value)} className="admin-input" style={{ flex: "1 1 120px", padding: "6px" }} />
                                        <input type="date" value={editAnnEnd} onChange={e => setEditAnnEnd(e.target.value)} className="admin-input" style={{ flex: "1 1 120px", padding: "6px" }} />
                                        <select className="admin-input" value={editAnnTarget} onChange={e => setEditAnnTarget(e.target.value)} style={{ flex: "1.5 1 140px", padding: "6px" }}>
                                          <option value="global">🌐 Global</option>
                                          <option value="section_A">🅰️ Section A</option>
                                          <option value="section_B">🅱️ Section B</option>
                                          <option value="has_friends">👥 Social</option>
                                          {Object.keys(LEGEND || {}).map(c => <option key={c} value={`subject_${c}`}>{c}</option>)}
                                        </select>
                                        <select className="admin-input" value={editAnnSeverity} onChange={e => setEditAnnSeverity(e.target.value)} style={{ flex: "1 1 120px", padding: "6px" }}>
                                          <option value="info">🟣 Info</option>
                                          <option value="warning">🟡 Warning</option>
                                          <option value="urgent">🔴 Urgent</option>
                                          <option value="celebration">🟢 Celebration</option>
                                          <option value="exam">🎓 Exam</option>
                                        </select>
                                      </div>
                                      <textarea className="admin-textarea" rows={2} value={editAnnMsg} onChange={e => setEditAnnMsg(e.target.value)} />
                                      <div style={{ display: "flex", gap: 8 }}>
                                        <button className="admin-btn primary" style={{ padding: "6px 14px", fontSize: 12.5 }} onClick={() => {
                                          if (!editAnnMsg.trim() || !editAnnStart || !editAnnEnd) return alert("Fill all fields.");
                                          setFlags({
                                            ...flags,
                                            scheduledAnnouncements: (flags.scheduledAnnouncements || []).map(item => item.id === a.id ? {
                                              ...item,
                                              message: editAnnMsg.trim(),
                                              start: editAnnStart,
                                              end: editAnnEnd,
                                              target: editAnnTarget,
                                              severity: editAnnSeverity
                                            } : item)
                                          });
                                          setEditingAnnId(null);
                                        }}>
                                          <Check size={13} /> Save Updates
                                        </button>
                                        <button className="admin-btn outline" style={{ padding: "6px 12px", fontSize: 12.5 }} onClick={() => setEditingAnnId(null)}>
                                          Cancel
                                        </button>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
{/* ── Accordion 2: Push Notifications ── */}
            <div style={{ border: `1px solid ${openBcast.push ? "var(--live)" : "var(--border)"}`, borderRadius: 12, overflow: "hidden", background: "var(--bg)", transition: "border-color 0.15s" }}>
              <div
                onClick={() => setOpenBcast(o => ({ ...o, push: !o.push }))}
                style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", cursor: "pointer", background: openBcast.push ? "rgba(31,169,113,0.06)" : "transparent" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <BellRing size={17} color="var(--live)" />
                  <span style={{ fontWeight: 700, fontSize: 14, color: "var(--text)" }}>Web Push Notifications</span>
                  {(flags.scheduledPushes || []).length > 0 && (
                    <span style={{ fontSize: 11, fontWeight: 800, padding: "2px 8px", borderRadius: 10, background: "rgba(31,169,113,0.15)", color: "var(--live)" }}>
                      {flags.scheduledPushes.length} queued
                    </span>
                  )}
                </div>
                <span style={{ color: "var(--muted)", fontSize: 13, fontWeight: 600 }}>{openBcast.push ? "▲ Collapse" : "▼ Expand"}</span>
              </div>

              {openBcast.push && (
                <div style={{ padding: "16px", borderTop: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: 12 }}>
                  {/* Saved push templates */}
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
                    {(flags.pushTemplates || []).map(t => (
                      <span key={t.id} className="admin-tag">
                        <button type="button" className="admin-tag-label" onClick={() => { setPushTitle(t.title || ""); setPushBody(t.body || ""); setPushUrl(t.url || ""); }} title="Apply this template">{t.title || "(untitled)"}</button>
                        <button type="button" className="admin-tag-del" onClick={() => { if (!confirm(`Delete template "${t.title || "(untitled)"}"?`)) return; setFlags({ ...flags, pushTemplates: (flags.pushTemplates || []).filter(x => x.id !== t.id) }); }} aria-label="Delete template"><X size={12} /></button>
                      </span>
                    ))}
                    <button type="button" className="admin-btn outline" style={{ fontSize: 11, padding: "4px 10px" }} onClick={() => {
                      if (!pushTitle.trim() || !pushBody.trim()) return alert("Fill title and message first, then save as template.");
                      setFlags({ ...flags, pushTemplates: [...(flags.pushTemplates || []), { id: Date.now().toString(), title: pushTitle.trim(), body: pushBody.trim(), url: pushUrl.trim() }] });
                    }}>+ Save current as template</button>
                  </div>

                  <div className="admin-field-row">
                    <div className="admin-field">
                      <label>Title</label>
                      <input className="admin-input" value={pushTitle} onChange={e => setPushTitle(e.target.value)} placeholder="e.g. Room change: FIN-201 today" maxLength={80} />
                    </div>
                    <div className="admin-field">
                      <label>Open URL <span className="admin-optional">(optional)</span></label>
                      <input className="admin-input" value={pushUrl} onChange={e => setPushUrl(e.target.value)} placeholder="/?view=today" />
                    </div>
                  </div>
                  <div className="admin-field">
                    <label>Message</label>
                    <textarea className="admin-textarea" value={pushBody} onChange={e => setPushBody(e.target.value)} placeholder="e.g. Today's 11:30 FIN-201 class moved to Room C-104." rows={2} maxLength={200}></textarea>
                  </div>
                  <div className="admin-field-row">
                    <div className="admin-field">
                      <label>Schedule Date <span className="admin-optional">(Optional)</span></label>
                      <input type="date" className="admin-input" value={pushScheduleDate} onChange={e => setPushScheduleDate(e.target.value)} />
                    </div>
                    <div className="admin-field">
                      <label>Schedule Time <span className="admin-optional">(Optional)</span></label>
                      <input type="time" className="admin-input" value={pushScheduleTime} onChange={e => setPushScheduleTime(e.target.value)} />
                    </div>
                  </div>

                  <div className="admin-field">
                    <label>Audience {pushTarget !== "all" && (() => { const ids = audienceIds(pushTarget); return <span className="admin-optional">— {ids ? `${ids.length} recipient(s)` : "n/a"}</span>; })()}</label>
                    <select className="admin-input" value={pushTarget} onChange={e => setPushTarget(e.target.value)}>
                      <option value="all">Everyone (broadcast)</option>
                      <option value="section_A">Section A</option>
                      <option value="section_B">Section B</option>
                      <option value="inactive">Inactive {inactiveDays}+ days</option>
                      <optgroup label="Subject-wise">
                        {Object.keys(LEGEND || {}).map(c => <option key={c} value={`subject_${c}`}>{c}</option>)}
                      </optgroup>
                      {(flags.savedAudiences || []).length > 0 && (
                        <optgroup label="Saved audiences">
                          {(flags.savedAudiences || []).map(sa => <option key={sa.id} value={sa.target}>★ {sa.label}</option>)}
                        </optgroup>
                      )}
                    </select>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6, alignItems: "center" }}>
                      {(flags.savedAudiences || []).map(sa => (
                        <span key={sa.id} className={`admin-tag${pushTarget === sa.target ? " active" : ""}`}>
                          <button type="button" className="admin-tag-label" onClick={() => setPushTarget(sa.target)} title={sa.target}>★ {sa.label}</button>
                          <button type="button" className="admin-tag-del" onClick={() => { if (!confirm(`Delete saved audience "${sa.label}"?`)) return; setFlags({ ...flags, savedAudiences: (flags.savedAudiences || []).filter(x => x.id !== sa.id) }); }} aria-label="Delete saved audience"><X size={12} /></button>
                        </span>
                      ))}
                      <button type="button" className="admin-btn outline" style={{ fontSize: 11, padding: "4px 10px" }} onClick={saveCurrentAudience} disabled={pushTarget === "all"}>+ Save current audience</button>
                    </div>
                  </div>

                  <PushPreview title={pushTitle} body={pushBody} url={pushUrl} when={pushScheduleDate && pushScheduleTime ? `${pushScheduleDate} · ${pushScheduleTime}` : "now"} />

                  <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                    <button className="admin-btn primary" onClick={() => {
                      if (pushScheduleDate && pushScheduleTime) {
                        if (pushTarget !== "all") return alert("Scheduled pushes currently go to everyone. For a targeted push, clear the schedule and send now.");
                        if (!pushTitle.trim() || !pushBody.trim()) return alert("Fill in title and message.");
                        const newItem = { id: Date.now().toString(), title: pushTitle.trim(), body: pushBody.trim(), url: pushUrl.trim(), date: pushScheduleDate, time: pushScheduleTime };
                        setFlags({...flags, scheduledPushes: [...(flags.scheduledPushes || []), newItem]});
                        setPushTitle(""); setPushBody(""); setPushUrl(""); setPushScheduleDate(""); setPushScheduleTime("");
                        setPushResult("Push scheduled successfully (Requires deploy).");
                      } else if (pushTarget !== "all") {
                        const ids = audienceIds(pushTarget);
                        if (!ids || ids.length === 0) return alert("No recipients match that audience.");
                        if (!pushTitle.trim() || !pushBody.trim()) return alert("Fill in title and message.");
                        const dup = recentDuplicatePush(pushTitle);
                        if (dup && !confirm(`⚠️ A push titled "${dup.title}" was already sent ${Math.round((nowMs() - new Date(dup.sent_at).getTime()) / 60000)} min ago. Send this one anyway?`)) return;
                        (async () => {
                          setPushSending(true); setPushResult("");
                          const res = await pushToUserIds(ids, { title: pushTitle.trim(), body: pushBody.trim(), url: pushUrl.trim() || "/", confirmMsg: `Send this push to ${ids.length} user(s) in "${pushTarget}"?` });
                          if (res?.ok) { setPushResult(`Sent to ${res.data.queued ?? ids.length} user(s).`); setPushTitle(""); setPushBody(""); setPushUrl(""); await logAdminAction(admin_id, "push_targeted", { target: pushTarget, count: ids.length }); }
                          else if (res) setPushResult(`Failed: ${res.data?.error || "error"}`);
                          setPushSending(false);
                        })();
                      } else {
                        sendPushBroadcast();
                      }
                    }} disabled={pushSending}>
                      <BellRing size={14} /> {pushSending ? "Sending..." : (pushScheduleDate && pushScheduleTime ? "Queue Push Notification" : pushTarget !== "all" ? "Send to Audience" : "Send to All Subscribers")}
                    </button>
                    <button className="admin-btn outline" onClick={sendTestPushToMe} disabled={pushSending} title="Delivers only to your own subscribed devices — arrives within ~1 min">
                      <BellRing size={14} /> Send test to me
                    </button>
                    {pushResult && (
                      <span className="admin-subtext" style={{ margin: 0, color: pushResult.startsWith("Sent") || pushResult.startsWith("Push scheduled") || pushResult.startsWith("Test") ? "var(--live)" : "var(--danger)" }}>{pushResult}</span>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* ── Accordion 3: Social Flash Notifications ── */}
            <div style={{ border: `1px solid ${openBcast.social ? "var(--violet)" : "var(--border)"}`, borderRadius: 12, overflow: "hidden", background: "var(--bg)", transition: "border-color 0.15s" }}>
              <div
                onClick={() => setOpenBcast(o => ({ ...o, social: !o.social }))}
                style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", cursor: "pointer", background: openBcast.social ? "rgba(139,92,246,0.06)" : "transparent" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <Sparkles size={17} color="var(--violet)" />
                  <span style={{ fontWeight: 700, fontSize: 14, color: "var(--text)" }}>Social Flash Toast Notifications</span>
                  <span style={{ background: "linear-gradient(135deg, #8B5CF6 0%, #EC4899 100%)", color: "#fff", fontSize: "9px", fontWeight: 800, padding: "2px 6px", borderRadius: "8px" }}>REALTIME</span>
                </div>
                <span style={{ color: "var(--muted)", fontSize: 13, fontWeight: 600 }}>{openBcast.social ? "▲ Collapse" : "▼ Expand"}</span>
              </div>

              {openBcast.social && (
                <div style={{ padding: "16px", borderTop: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: 12 }}>
                  <div className="admin-field">
                    <label>Title</label>
                    <input className="admin-input" value={socialFlashTitle} onChange={e => setSocialFlashTitle(e.target.value)} placeholder="⚡ New Social Update" />
                  </div>
                  <div className="admin-field">
                    <label>Message</label>
                    <textarea className="admin-textarea" value={socialFlashMsg} onChange={e => setSocialFlashMsg(e.target.value)} placeholder="Someone added a new status on TermFlow!" rows={2}></textarea>
                  </div>
                  <div className="admin-grid-2">
                    <div className="admin-field">
                      <label>Icon Style</label>
                      <select className="admin-input" value={socialFlashIcon} onChange={e => setSocialFlashIcon(e.target.value)}>
                        <option value="social">👥 Social (Purple)</option>
                        <option value="alert">⚡ Alert (Amber)</option>
                        <option value="announcement">📣 Announcement (Blue)</option>
                        <option value="sparkles">✨ Sparkles (Pink)</option>
                        <option value="success">✅ Success (Green)</option>
                      </select>
                    </div>
                    <div className="admin-field">
                      <label>Display Duration</label>
                      <select className="admin-input" value={socialFlashDuration} onChange={e => setSocialFlashDuration(Number(e.target.value))}>
                        <option value={5000}>5 Seconds</option>
                        <option value={6000}>6 Seconds (Default)</option>
                        <option value={7000}>7 Seconds</option>
                      </select>
                    </div>
                  </div>
                  <div className="admin-field">
                    <label>Action Link <span className="admin-optional">(Optional)</span></label>
                    <input className="admin-input" value={socialFlashUrl} onChange={e => setSocialFlashUrl(e.target.value)} placeholder="https://termflow.app/friends or /meetups" />
                  </div>

                  {/* Toast preview */}
                  <div style={{ marginTop: 4 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                      <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>Live Toast Preview ({socialFlashDuration / 1000}s)</span>
                      <button type="button" onClick={testSocialFlashLocal} className="admin-btn outline" style={{ fontSize: 11.5, padding: "4px 10px", color: "var(--violet)", borderColor: "rgba(139,92,246,0.3)" }}>
                        <Sparkles size={13} /> Test Toast on Screen
                      </button>
                    </div>

                    <div style={{
                      position: "relative",
                      width: "100%",
                      background: "var(--card, #1A1A2E)",
                      border: "1px solid color-mix(in srgb, var(--violet, #8B5CF6) 40%, transparent)",
                      borderRadius: 14,
                      padding: "12px 14px",
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 12,
                      boxShadow: "0 4px 20px rgba(0, 0, 0, 0.25)"
                    }}>
                      <div style={{
                        flexShrink: 0,
                        width: 34,
                        height: 34,
                        borderRadius: 8,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        marginTop: 2,
                        background: socialFlashIcon === "alert" ? "rgba(245, 158, 11, 0.2)" : socialFlashIcon === "announcement" ? "rgba(59, 130, 246, 0.2)" : socialFlashIcon === "sparkles" ? "rgba(236, 72, 153, 0.2)" : socialFlashIcon === "success" ? "rgba(16, 185, 129, 0.2)" : "rgba(139, 92, 246, 0.2)",
                        border: `1px solid ${socialFlashIcon === "alert" ? "#F59E0B44" : socialFlashIcon === "announcement" ? "#3B82F644" : socialFlashIcon === "sparkles" ? "#EC489944" : socialFlashIcon === "success" ? "#10b98144" : "#8B5CF644"}`
                      }}>
                        {socialFlashIcon === "alert" && <span style={{ fontSize: 16 }}>⚡</span>}
                        {socialFlashIcon === "announcement" && <span style={{ fontSize: 16 }}>📣</span>}
                        {socialFlashIcon === "sparkles" && <span style={{ fontSize: 16 }}>✨</span>}
                        {socialFlashIcon === "success" && <span style={{ fontSize: 16 }}>✅</span>}
                        {socialFlashIcon === "social" && <span style={{ fontSize: 16 }}>👥</span>}
                      </div>

                      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
                        <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--ink, #fff)" }}>
                          {socialFlashTitle.trim() || "⚡ New Social Update"}
                        </div>
                        <div style={{ fontSize: "12px", color: "var(--muted, rgba(255,255,255,0.7))", lineHeight: 1.4 }}>
                          {socialFlashMsg.trim() || "Someone added a new status on TermFlow!"}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <button
                      type="button"
                      className="admin-btn primary"
                      disabled={socialFlashSending}
                      onClick={triggerSocialFlashBroadcast}
                      style={{
                        background: "var(--violet, #8B5CF6)",
                        color: "#fff",
                        padding: "9px 16px",
                        borderRadius: 8,
                        fontWeight: 700,
                        fontSize: 13,
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6
                      }}
                    >
                      <Sparkles size={14} />
                      {socialFlashSending ? "Pushing Live..." : "Push Social Flash to All Users"}
                    </button>
                    {socialFlashStatus && (
                      <span style={{ fontSize: 12.5, fontWeight: 600, color: socialFlashStatus.startsWith("Failed") ? "var(--danger)" : "var(--live)" }}>
                        {socialFlashStatus}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── Footer Row: Quiet Hours Guard ── */}
          <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <label className="admin-flag-item" style={{ margin: 0, fontSize: 13 }}>
                <input type="checkbox" checked={!!quietHours.enabled} onChange={e => setFlags({ ...flags, quietHours: { ...quietHours, enabled: e.target.checked } })} />
                <span style={{ fontWeight: 600 }}>Quiet Hours Guard (IST)</span>
              </label>
              <div style={{ display: "flex", alignItems: "center", gap: 6, opacity: quietHours.enabled ? 1 : 0.45 }}>
                <input type="time" className="admin-input" style={{ width: "auto", padding: "4px 8px", fontSize: 12 }} value={quietHours.start || "23:00"} disabled={!quietHours.enabled} onChange={e => setFlags({ ...flags, quietHours: { ...quietHours, start: e.target.value } })} />
                <span style={{ fontSize: 12, color: "var(--muted)" }}>to</span>
                <input type="time" className="admin-input" style={{ width: "auto", padding: "4px 8px", fontSize: 12 }} value={quietHours.end || "07:00"} disabled={!quietHours.enabled} onChange={e => setFlags({ ...flags, quietHours: { ...quietHours, end: e.target.value } })} />
              </div>
            </div>
            {quietHours.enabled && (() => { const q = inQuietHours(flashNow); return (
              <div style={{ fontSize: 12, color: q ? "var(--danger)" : "var(--live)", display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: q ? "var(--danger)" : "var(--live)" }} />
                {q ? "Within quiet hours (warning active)" : "Outside quiet hours (normal)"}
              </div>
            ); })()}
          </div>
        </section>

        {/* ── 2. Mission Control (Timeline Agenda + Delivery Stats + Queued Pushes) ── */}
        <section className="admin-card admin-span-all admin-g-broadcast" style={{ gridColumn: "1 / -1" }}>
          <h2><Clock size={20} color="var(--live)" /> Broadcast Mission Control</h2>
          <p className="admin-subtext">Unified schedule of upcoming pushes, active banners, and recent broadcast delivery performance.</p>

          {/* Scheduled Timeline Agenda */}
          <div style={{ marginTop: 12, marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8 }}>Scheduled Timeline Agenda</div>
            {broadcastAgenda.length === 0 ? (
              <div className="admin-empty" style={{ padding: "16px 0" }}>Nothing scheduled. Queued pushes, announcements &amp; deploys will appear here.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {broadcastAgenda.map((it, i) => {
                  const prev = broadcastAgenda[i - 1];
                  const day = (it.sort || "").slice(0, 10);
                  const newDay = !prev || (prev.sort || "").slice(0, 10) !== day;
                  const sameSlot = prev && (prev.sort || "").slice(0, 13) === (it.sort || "").slice(0, 13);
                  return (
                    <div key={i}>
                      {newDay && <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em", color: "var(--muted)", margin: "6px 0 2px" }}>{day ? new Date(day).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" }) : "Undated"}</div>}
                      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", background: sameSlot ? "rgba(245,158,11,0.08)" : "var(--bg)", borderRadius: 8, border: `1px solid ${sameSlot ? "var(--amber)" : "var(--border)"}` }} title={sameSlot ? "Fires in the same slot as the item above — possible collision" : ""}>
                        <span style={{ width: 8, height: 8, borderRadius: "50%", background: it.color, flexShrink: 0 }} />
                        <span style={{ fontSize: 12, fontWeight: 700, color: it.color, minWidth: 88 }}>{it.kind}</span>
                        <span style={{ fontSize: 13, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.label}</span>
                        <span style={{ fontSize: 11, color: "var(--muted)", whiteSpace: "nowrap" }}>{it.when}{it.end ? ` → ${it.end}` : ""}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Collapsible Queued Pushes */}
          {flags.scheduledPushes && flags.scheduledPushes.length > 0 && (
            <details style={{ borderTop: "1px solid var(--border)", paddingTop: 12, marginBottom: 12 }}>
              <summary style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", cursor: "pointer" }}>
                Queued Push Notifications ({flags.scheduledPushes.length})
              </summary>
              <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
                {flags.scheduledPushes.map(p => (
                  <div key={p.id} className="admin-list-item" style={{ padding: "8px 12px" }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{p.title}</div>
                      <div style={{ fontSize: 11, color: "var(--muted)" }}>Scheduled for {p.date} at {p.time}</div>
                    </div>
                    <button onClick={() => {
                      const prev = flags.scheduledPushes;
                      setFlags({...flags, scheduledPushes: prev.filter(x => x.id !== p.id)});
                      removeWithUndo("Queued push removed", () => setFlags(f => ({ ...f, scheduledPushes: prev })));
                    }} className="admin-btn danger" style={{ padding: "4px 8px" }}><Trash2 size={14} /></button>
                  </div>
                ))}
              </div>
            </details>
          )}

          {/* Collapsible Push Delivery Analytics */}
          <details style={{ borderTop: "1px solid var(--border)", paddingTop: 12 }} open>
            <summary style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", cursor: "pointer" }}>
              Push Delivery Analytics
            </summary>
            <div style={{ marginTop: 10 }}>
              {pushStats === null ? (
                <div className="admin-empty">Needs the <code>get_push_broadcast_stats</code> RPC (migration 20260731120000) deployed.</div>
              ) : pushStats.length === 0 ? (
                <div className="admin-empty">No broadcasts sent yet.</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {pushStats.slice(0, 6).map(s => {
                    const dPct = s.total ? Math.round((s.delivered / s.total) * 100) : 0;
                    const oPct = s.total ? Math.round((s.opened / s.total) * 100) : 0;
                    return (
                      <div key={s.dedup_key} style={{ padding: "8px 12px", background: "var(--bg)", borderRadius: 8, border: "1px solid var(--border)" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 4 }}>
                          <span style={{ fontSize: 12.5, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.title || "(no title)"}</span>
                          <span style={{ fontSize: 11, color: "var(--muted)", whiteSpace: "nowrap" }}>{new Date(s.sent_at).toLocaleDateString()}</span>
                        </div>
                        <div style={{ display: "flex", gap: 14, fontSize: 11.5 }}>
                          <span><b>{s.total}</b> sent</span>
                          <span style={{ color: "var(--blue)" }}><b>{s.delivered}</b> delivered ({dPct}%)</span>
                          <span style={{ color: "var(--live)" }}><b>{s.opened}</b> opened ({oPct}%)</span>
                        </div>
                        <div style={{ height: 5, background: "var(--card)", borderRadius: 3, overflow: "hidden", border: "1px solid var(--border)", marginTop: 4, position: "relative" }}>
                          <div style={{ position: "absolute", inset: 0, width: `${dPct}%`, background: "var(--blue)", opacity: 0.35 }} />
                          <div style={{ position: "absolute", inset: 0, width: `${oPct}%`, background: "var(--live)" }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </details>
        </section>

        {/* ── 3. Content Hub (What's New + Quick Links + Update Prompt) ── */}
        <section className="admin-card admin-span-all admin-g-broadcast" style={{ gridColumn: "1 / -1" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
            <div>
              <h2 style={{ marginBottom: 4 }}><Sparkles size={20} color="var(--violet)" /> App Content Hub</h2>
              <p className="admin-subtext" style={{ margin: 0 }}>Publish in-app feature notes, dynamic sidebar links, and client update prompts.</p>
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={() => setOpenContent(o => ({ ...o, whatsNew: !o.whatsNew }))}
                style={{
                  padding: "6px 12px", borderRadius: 8, fontSize: 12.5, fontWeight: 700, cursor: "pointer",
                  border: openContent.whatsNew ? "1.5px solid var(--violet)" : "1px solid var(--border)",
                  background: openContent.whatsNew ? "rgba(109,91,208,0.12)" : "var(--bg)",
                  color: openContent.whatsNew ? "var(--violet)" : "var(--muted)",
                  display: "flex", alignItems: "center", gap: 6
                }}>
                <Sparkles size={14} /> What&rsquo;s New {(flags.whatsNew || []).length > 0 ? `(${flags.whatsNew.length})` : ""}
              </button>
              <button
                type="button"
                onClick={() => setOpenContent(o => ({ ...o, quickLinks: !o.quickLinks }))}
                style={{
                  padding: "6px 12px", borderRadius: 8, fontSize: 12.5, fontWeight: 700, cursor: "pointer",
                  border: openContent.quickLinks ? "1.5px solid var(--blue)" : "1px solid var(--border)",
                  background: openContent.quickLinks ? "rgba(59,130,246,0.12)" : "var(--bg)",
                  color: openContent.quickLinks ? "var(--blue)" : "var(--muted)",
                  display: "flex", alignItems: "center", gap: 6
                }}>
                <Flag size={14} /> Quick Links {(flags.quickLinks || []).length > 0 ? `(${flags.quickLinks.length})` : ""}
              </button>
              <button
                type="button"
                onClick={() => setOpenContent(o => ({ ...o, updatePrompt: !o.updatePrompt }))}
                style={{
                  padding: "6px 12px", borderRadius: 8, fontSize: 12.5, fontWeight: 700, cursor: "pointer",
                  border: openContent.updatePrompt ? "1.5px solid var(--live)" : "1px solid var(--border)",
                  background: openContent.updatePrompt ? "rgba(31,169,113,0.12)" : "var(--bg)",
                  color: openContent.updatePrompt ? "var(--live)" : "var(--muted)",
                  display: "flex", alignItems: "center", gap: 6
                }}>
                <RefreshCw size={14} /> Update Prompt
              </button>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {/* ── Content Section 1: What's New ── */}
            <div style={{ border: `1px solid ${openContent.whatsNew ? "var(--violet)" : "var(--border)"}`, borderRadius: 12, overflow: "hidden", background: "var(--bg)", transition: "border-color 0.15s" }}>
              <div
                onClick={() => setOpenContent(o => ({ ...o, whatsNew: !o.whatsNew }))}
                style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", cursor: "pointer", background: openContent.whatsNew ? "rgba(109,91,208,0.06)" : "transparent" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <Sparkles size={17} color="var(--violet)" />
                  <span style={{ fontWeight: 700, fontSize: 14, color: "var(--text)" }}>What&rsquo;s New (Feature Updates)</span>
                  {(flags.whatsNew || []).length > 0 && (
                    <span style={{ fontSize: 11, fontWeight: 800, padding: "2px 8px", borderRadius: 10, background: "rgba(109,91,208,0.15)", color: "var(--violet)" }}>
                      {flags.whatsNew.length} entries
                    </span>
                  )}
                </div>
                <span style={{ color: "var(--muted)", fontSize: 13, fontWeight: 600 }}>{openContent.whatsNew ? "▲ Collapse" : "▼ Expand"}</span>
              </div>

              {openContent.whatsNew && (
                <div style={{ padding: "16px", borderTop: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: 12 }}>
                  <div className="admin-field-row">
                    <div className="admin-field" style={{ flex: "0 0 90px" }}>
                      <label>Emoji</label>
                      <input className="admin-input" value={wnEmoji} onChange={e => setWnEmoji(e.target.value)} placeholder="🔔" maxLength={4} />
                    </div>
                    <div className="admin-field">
                      <label>Feature Title</label>
                      <input className="admin-input" value={wnTitle} onChange={e => setWnTitle(e.target.value)} placeholder="e.g. Class reminders are here" maxLength={60} />
                    </div>
                  </div>
                  <div className="admin-field">
                    <label>Description</label>
                    <textarea className="admin-textarea" value={wnDesc} onChange={e => setWnDesc(e.target.value)} placeholder="e.g. Enable push on the Announcements tab to get pinged 15/30/60 min before your classes." rows={2} maxLength={200}></textarea>
                  </div>

                  {wnTitle.trim() && (
                    <div style={{ marginTop: 2, marginBottom: 8 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".05em", textTransform: "uppercase", color: "var(--muted)", display: "block", marginBottom: 6 }}>Student preview — click pill to test modal</span>
                      <WhatsNewPill
                        item={{ id: "preview", emoji: wnEmoji.trim(), title: wnTitle.trim(), desc: wnDesc.trim(), date: new Date().toISOString().split("T")[0] }}
                        count={1}
                        onOpen={() => setWnPreviewOpen(true)}
                      />
                    </div>
                  )}
                  {wnPreviewOpen && (
                    <WhatsNewModal
                      items={[{ id: "preview", emoji: wnEmoji.trim(), title: wnTitle.trim() || "Feature title", desc: wnDesc.trim(), date: new Date().toISOString().split("T")[0] }]}
                      onClose={() => setWnPreviewOpen(false)}
                    />
                  )}

                  <div style={{ display: "flex", gap: 10 }}>
                    <button className="admin-btn primary" onClick={() => {
                      if (!wnTitle.trim()) return alert("Feature title is required.");
                      if (wnEditingId) {
                        setFlags({
                          ...flags,
                          whatsNew: (flags.whatsNew || []).map(x => x.id === wnEditingId
                            ? { ...x, emoji: wnEmoji.trim(), title: wnTitle.trim(), desc: wnDesc.trim() }
                            : x)
                        });
                      } else {
                        const entry = {
                          id: Date.now().toString(),
                          date: new Date().toISOString().split("T")[0],
                          emoji: wnEmoji.trim(),
                          title: wnTitle.trim(),
                          desc: wnDesc.trim(),
                        };
                        setFlags({ ...flags, whatsNew: [entry, ...(flags.whatsNew || [])].slice(0, 10) });
                      }
                      setWnEmoji(""); setWnTitle(""); setWnDesc(""); setWnEditingId(null);
                    }}>
                      <Sparkles size={14} /> {wnEditingId ? "Save Changes" : "Add Feature Update"}
                    </button>
                    {wnEditingId && (
                      <button className="admin-btn outline" onClick={() => { setWnEmoji(""); setWnTitle(""); setWnDesc(""); setWnEditingId(null); }}>
                        Cancel
                      </button>
                    )}
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 4 }}>
                    {(flags.whatsNew || []).map(w => (
                      <div key={w.id} className="admin-list-item" style={{ gap: 10, background: w.id === wnEditingId ? "rgba(109, 91, 208, 0.08)" : "var(--bg)", border: `1px solid ${w.id === wnEditingId ? "var(--violet)" : "var(--border)"}` }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{w.emoji ? `${w.emoji} ` : ""}{w.title}</div>
                          <div style={{ fontSize: 11, color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{w.date}{w.desc ? ` — ${w.desc}` : ""}</div>
                        </div>
                        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                          <button onClick={() => { setWnEmoji(w.emoji || ""); setWnTitle(w.title || ""); setWnDesc(w.desc || ""); setWnEditingId(w.id); }} className="admin-btn outline" style={{ padding: "4px 8px" }} aria-label="Edit"><Pencil size={14} /></button>
                          <button onClick={() => {
                            if (!confirm(`Delete "What's New" entry "${w.title}"?`)) return;
                            setFlags({ ...flags, whatsNew: flags.whatsNew.filter(x => x.id !== w.id) });
                            if (wnEditingId === w.id) { setWnEmoji(""); setWnTitle(""); setWnDesc(""); setWnEditingId(null); }
                          }} className="admin-btn danger" style={{ padding: "4px 8px" }} aria-label="Delete"><Trash2 size={14} /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* ── Content Section 2: Dynamic Quick Links ── */}
            <div style={{ border: `1px solid ${openContent.quickLinks ? "var(--blue)" : "var(--border)"}`, borderRadius: 12, overflow: "hidden", background: "var(--bg)", transition: "border-color 0.15s" }}>
              <div
                onClick={() => setOpenContent(o => ({ ...o, quickLinks: !o.quickLinks }))}
                style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", cursor: "pointer", background: openContent.quickLinks ? "rgba(59,130,246,0.06)" : "transparent" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <Flag size={17} color="var(--blue)" />
                  <span style={{ fontWeight: 700, fontSize: 14, color: "var(--text)" }}>Dynamic Quick Links</span>
                  {(flags.quickLinks || []).length > 0 && (
                    <span style={{ fontSize: 11, fontWeight: 800, padding: "2px 8px", borderRadius: 10, background: "rgba(59,130,246,0.15)", color: "var(--blue)" }}>
                      {flags.quickLinks.length} active
                    </span>
                  )}
                </div>
                <span style={{ color: "var(--muted)", fontSize: 13, fontWeight: 600 }}>{openContent.quickLinks ? "▲ Collapse" : "▼ Expand"}</span>
              </div>

              {openContent.quickLinks && (
                <div style={{ padding: "16px", borderTop: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: 12 }}>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <input type="text" placeholder="Link Title (e.g. Exam Portal)" value={qlTitle} onChange={e => setQlTitle(e.target.value)} className="admin-input" style={{ flex: 1, padding: "8px", minWidth: 150 }} />
                    <input type="url" placeholder="https://..." value={qlUrl} onChange={e => setQlUrl(e.target.value)} className="admin-input" style={{ flex: 2, padding: "8px", minWidth: 200 }} />
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <input type="date" value={qlStart} onChange={e => setQlStart(e.target.value)} className="admin-input" style={{ flex: "1 1 130px", padding: "8px" }} title="Start Date" />
                    <input type="date" value={qlEnd} onChange={e => setQlEnd(e.target.value)} className="admin-input" style={{ flex: "1 1 130px", padding: "8px" }} title="End Date (Inclusive)" />
                    <button className="admin-btn primary" style={{ flex: "1 1 130px" }} onClick={() => {
                      if (!qlTitle || !qlUrl || !qlStart || !qlEnd) return alert("Fill all fields.");
                      const newItem = { id: Date.now().toString(), title: qlTitle, url: qlUrl, start: qlStart, end: qlEnd };
                      setFlags({...flags, quickLinks: [...(flags.quickLinks || []), newItem]});
                      setQlTitle(""); setQlUrl(""); setQlStart(""); setQlEnd("");
                    }}>
                      Add Quick Link
                    </button>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 4 }}>
                    {(flags.quickLinks || []).map((ql, idx) => (
                      <div key={ql.id} className="admin-list-item" style={{ padding: "8px 12px" }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 600 }}>{ql.title}</div>
                          <div style={{ fontSize: 11, color: "var(--muted)" }}>{ql.url} · {ql.start} to {ql.end}</div>
                        </div>
                        <div style={{ display: "flex", gap: 6 }}>
                          <button onClick={() => {
                            if(idx === 0) return;
                            const next = [...flags.quickLinks];
                            [next[idx-1], next[idx]] = [next[idx], next[idx-1]];
                            setFlags({...flags, quickLinks: next});
                          }} disabled={idx === 0} className="admin-btn outline" style={{ padding: "4px 8px", opacity: idx === 0 ? 0.3 : 1 }}>↑</button>
                          <button onClick={() => {
                            if(idx === flags.quickLinks.length - 1) return;
                            const next = [...flags.quickLinks];
                            [next[idx+1], next[idx]] = [next[idx], next[idx+1]];
                            setFlags({...flags, quickLinks: next});
                          }} disabled={idx === flags.quickLinks.length - 1} className="admin-btn outline" style={{ padding: "4px 8px", opacity: idx === flags.quickLinks.length - 1 ? 0.3 : 1 }}>↓</button>
                          <button onClick={() => {
                            const prev = flags.quickLinks;
                            setFlags({...flags, quickLinks: prev.filter(x => x.id !== ql.id)});
                            removeWithUndo("Quick link removed", () => setFlags(f => ({ ...f, quickLinks: prev })));
                          }} className="admin-btn danger" style={{ padding: "4px 8px" }}><Trash2 size={14} /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* ── Content Section 3: Update Prompt Text ── */}
            <div style={{ border: `1px solid ${openContent.updatePrompt ? "var(--live)" : "var(--border)"}`, borderRadius: 12, overflow: "hidden", background: "var(--bg)", transition: "border-color 0.15s" }}>
              <div
                onClick={() => setOpenContent(o => ({ ...o, updatePrompt: !o.updatePrompt }))}
                style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", cursor: "pointer", background: openContent.updatePrompt ? "rgba(31,169,113,0.06)" : "transparent" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <RefreshCw size={17} color="var(--live)" />
                  <span style={{ fontWeight: 700, fontSize: 14, color: "var(--text)" }}>Update Prompt Text</span>
                </div>
                <span style={{ color: "var(--muted)", fontSize: 13, fontWeight: 600 }}>{openContent.updatePrompt ? "▲ Collapse" : "▼ Expand"}</span>
              </div>

              {openContent.updatePrompt && (
                <div style={{ padding: "16px", borderTop: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: 12 }}>
                  <div className="admin-field">
                    <label>Title</label>
                    <input className="admin-input" value={updatePromptTitle} onChange={e => setUpdatePromptTitle(e.target.value)} placeholder="TermFlow just got better" />
                  </div>
                  <div className="admin-field">
                    <label>Description</label>
                    <textarea className="admin-textarea" value={updatePromptDesc} onChange={e => setUpdatePromptDesc(e.target.value)} placeholder="A fresh version is cached..." rows={2}></textarea>
                  </div>
                  <div className="admin-field">
                    <label>Highlights (one per line)</label>
                    <textarea className="admin-textarea" value={updatePromptHighlights} onChange={e => setUpdatePromptHighlights(e.target.value)} placeholder="Faster load times&#10;New features..." rows={3}></textarea>
                  </div>

                  {/* Live preview */}
                  <div style={{ marginTop: 4 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                      <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>Live Toast Preview</span>
                      <button
                        type="button"
                        onClick={() => {
                          window.dispatchEvent(new CustomEvent("sw-update-available", {
                            detail: { updateSW: () => alert("Test refresh triggered! (In production this reloads the app with the new version)") }
                          }));
                        }}
                        className="admin-btn outline"
                        style={{ fontSize: 11.5, padding: "4px 10px", color: "var(--violet)" }}
                      >
                        <Sparkles size={13} /> Test Toast on Screen
                      </button>
                    </div>

                    <div className="sw-update-preview-box" style={{
                      position: "relative",
                      width: "100%",
                      background: "linear-gradient(160deg, rgba(26, 26, 46, 0.96) 0%, rgba(22, 33, 62, 0.96) 100%)",
                      border: "1px solid rgba(109, 91, 208, 0.35)",
                      borderRadius: 14,
                      padding: "12px 14px",
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      boxShadow: "0 4px 20px rgba(0, 0, 0, 0.25)"
                    }}>
                      <div className="sw-update-toast-icon" style={{ flexShrink: 0 }}>
                        <RefreshCw size={16} color="#fff" strokeWidth={2.5} className="sw-update-spin-icon" />
                      </div>
                      <div className="sw-update-toast-text" style={{ flex: 1, minWidth: 0 }}>
                        <span className="sw-update-toast-title" style={{ color: "#fff", fontWeight: 700, fontSize: "13px", display: "block" }}>
                          {updatePromptTitle.trim() || "TermFlow just got better"}
                        </span>
                        <span className="sw-update-toast-desc" style={{ color: "rgba(255, 255, 255, 0.65)", fontSize: "11.5px", display: "block" }}>
                          {updatePromptDesc.trim() || "A new version is available."}
                        </span>
                        {updatePromptHighlights.trim() && (
                          <div style={{ marginTop: 6, display: "flex", flexWrap: "wrap", gap: 4 }}>
                            {updatePromptHighlights.split("\n").filter(l => l.trim()).map((h, i) => (
                              <span key={i} style={{
                                background: "rgba(109, 91, 208, 0.3)",
                                border: "1px solid rgba(109, 91, 208, 0.5)",
                                color: "rgba(255, 255, 255, 0.9)",
                                fontSize: "10.5px",
                                fontWeight: 600,
                                padding: "1px 7px",
                                borderRadius: 6
                              }}>
                                ✨ {h.trim()}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <button type="button" className="sw-update-toast-refresh" style={{ pointerEvents: "none", fontSize: 12, padding: "4px 10px" }}>
                        Refresh
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ── 4. Feedback Flash Scheduler (Revamped Deck) ── */}
        <section className="admin-card admin-span-all admin-g-broadcast" style={{ gridColumn: "1 / -1" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10, marginBottom: 14 }}>
            <div>
              <h2 style={{ marginBottom: 4, display: "flex", alignItems: "center", gap: 8 }}>
                <MessageSquare size={20} color="var(--amber)" /> Feedback Flash Scheduler
              </h2>
              <p className="admin-subtext" style={{ margin: 0 }}>
                Automated 3-stage nudges (on announce, 2h before, 20m before deadline). Active nudges dock as in-app feedback toasts.
              </p>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button 
                onClick={() => {
                  const newId = Date.now().toString();
                  setFeedbackFlashes([
                    ...feedbackFlashes,
                    { id: newId, enabled: true, deadline: "", link: "", subjects: [] }
                  ]);
                }} 
                className="admin-btn primary" style={{ fontSize: 13, padding: "7px 14px" }}
              >
                + Add Feedback Flash
              </button>
            </div>
          </div>

          {/* Quick Metrics & Expired Purge Bar */}
          {(() => {
            const now = flashNow;
            const total = feedbackFlashes.length;
            const live = feedbackFlashes.filter(f => f.enabled && f.deadline && (new Date(f.deadline).getTime() > now)).length;
            const expired = feedbackFlashes.filter(f => f.deadline && (new Date(f.deadline).getTime() <= now)).length;

            return (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8, padding: "8px 12px", background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 10, marginBottom: 14, fontSize: 12.5 }}>
                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  <span><b>{total}</b> total flash{total !== 1 ? "es" : ""}</span>
                  <span style={{ color: "var(--live)" }}>• <b>{live}</b> active / scheduled</span>
                  {expired > 0 && <span style={{ color: "var(--danger)" }}>• <b>{expired}</b> expired</span>}
                </div>
                {expired > 0 && (
                  <button type="button" onClick={() => {
                    if (!confirm(`Purge ${expired} expired flash schedule(s)?`)) return;
                    setFeedbackFlashes(feedbackFlashes.filter(f => !f.deadline || (new Date(f.deadline).getTime() > now)));
                  }} className="admin-btn outline" style={{ fontSize: 11, padding: "3px 8px", color: "var(--danger)", borderColor: "var(--danger)" }}>
                    Purge Expired ({expired})
                  </button>
                )}
              </div>
            );
          })()}

          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {feedbackFlashes.map((ff, index) => {
              const HOUR = 60 * 60 * 1000;
              const now = flashNow;
              const deadlineMs = ff.deadline ? new Date(ff.deadline).getTime() : null;

              const fmtAbs = ms => new Date(ms).toLocaleString("en-IN", { weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
              const fmtRel = ms => {
                const diff = ms - now;
                const mins = Math.round(Math.abs(diff) / 60000);
                const txt = mins < 60 ? `${mins}m` : mins < 1440 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${Math.floor(mins / 1440)}d ${Math.floor((mins % 1440) / 60)}h`;
                return diff >= 0 ? `in ${txt}` : `${txt} ago`;
              };

              const triggers = deadlineMs ? [
                { key: "announced", name: "Stage 1: Announce", time: ff.announcedAt ? new Date(ff.announcedAt).getTime() : null, pendingNote: "on first save" },
                { key: "2h", name: "Stage 2: 2h Before", time: deadlineMs - 2 * HOUR },
                { key: "20m", name: "Stage 3: 20m Before", time: deadlineMs - 20 * 60 * 1000 },
              ] : [];
              const inWindow = t => t != null && now >= t && now <= t + HOUR;

              const isExpired = deadlineMs && now > deadlineMs;
              const isLive = deadlineMs && now <= deadlineMs && triggers.some(t => inWindow(t.time));
              const isScheduled = deadlineMs && now <= deadlineMs && !isLive;

              const status = !ff.enabled
                ? { label: "Draft / Disabled", color: "var(--muted)", bg: "rgba(255,255,255,0.06)", border: "var(--border)" }
                : !deadlineMs
                  ? { label: "Needs Deadline", color: "var(--amber)", bg: "rgba(245,158,11,0.12)", border: "var(--amber)" }
                  : isExpired
                    ? { label: "Expired", color: "var(--danger)", bg: "rgba(239,68,68,0.12)", border: "var(--danger)" }
                    : isLive
                      ? { label: "🟢 Nudge Window Live Now", color: "var(--live)", bg: "rgba(16,185,129,0.14)", border: "var(--live)" }
                      : { label: "Scheduled", color: "var(--violet)", bg: "rgba(139,92,246,0.12)", border: "var(--violet)" };

              return (
                <div key={ff.id} style={{
                  display: "flex", flexDirection: "column", gap: 14, padding: 18,
                  background: isLive ? "rgba(16,185,129,0.03)" : "var(--card)",
                  border: `1.5px solid ${ff.enabled ? status.border : "var(--border)"}`,
                  borderRadius: 14,
                  opacity: ff.enabled ? 1 : 0.75,
                  transition: "all 0.15s",
                  boxShadow: isLive ? "0 4px 20px rgba(16,185,129,0.15)" : "none"
                }}>

                  {/* Header Bar */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontWeight: 700, fontSize: 14.5 }}>
                        <input type="checkbox" checked={ff.enabled} onChange={e => setFeedbackFlashes(feedbackFlashes.map(f => f.id === ff.id ? { ...f, enabled: e.target.checked } : f))} />
                        <span>Flash #{index + 1}</span>
                      </label>
                      <span style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".04em", color: status.color, background: status.bg, padding: "3px 10px", borderRadius: 20 }}>
                        {status.label}
                      </span>
                    </div>

                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      {/* Test Toast Button */}
                      <button type="button" onClick={() => setPreviewFlashId(ff.id)} className="admin-btn outline" style={{ padding: "4px 10px", fontSize: 12, color: "var(--violet)", borderColor: "rgba(139,92,246,0.35)" }}>
                        <Sparkles size={13} /> Test Toast
                      </button>
                      {/* Clone Button */}
                      <button type="button" title="Clone Flash Config" onClick={() => {
                        const copy = { ...ff, id: Date.now().toString(), enabled: true };
                        setFeedbackFlashes([...feedbackFlashes, copy]);
                      }} className="admin-btn outline" style={{ padding: "4px 8px", fontSize: 12 }}>
                        <Copy size={13} />
                      </button>
                      {/* Remove Button */}
                      <button type="button" title="Remove Flash" onClick={() => setFeedbackFlashes(feedbackFlashes.filter(f => f.id !== ff.id))} className="admin-btn danger" style={{ padding: "4px 8px", fontSize: 12 }}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>

                  {/* Summary Bar */}
                  <div style={{ fontSize: 13, color: "var(--muted)", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    {deadlineMs ? (
                      <>
                        <span>⏰ Deadline: <strong style={{ color: "var(--text)" }}>{fmtAbs(deadlineMs)}</strong> ({fmtRel(deadlineMs)})</span>
                        <span>•</span>
                        <span>👥 {(ff.subjects || []).length ? `Targets ${ff.subjects.length} course(s): ${ff.subjects.join(", ")}` : "All students"}</span>
                        <span>•</span>
                        <span>📋 {ff.link ? "External Form Link" : "In-app Feedback Widget"}</span>
                      </>
                    ) : (
                      <span style={{ color: "var(--amber)" }}>⚠️ No deadline set — pick a deadline preset below to activate nudges.</span>
                    )}
                  </div>

                  {/* 3-Stage Visual Nudge Progression Bar */}
                  {deadlineMs && !isExpired && (
                    <div style={{ background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 10, padding: "10px 14px" }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", marginBottom: 8, letterSpacing: "0.5px" }}>Automated 3-Stage Nudge Timeline</div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 8 }}>
                        {triggers.map(t => {
                          const live = inWindow(t.time);
                          const fired = t.time != null && now > t.time + HOUR;
                          const color = live ? "var(--live)" : fired ? "var(--muted)" : "var(--violet)";
                          return (
                            <div key={t.key} style={{
                              display: "flex", alignItems: "center", gap: 8, fontSize: 12, fontWeight: 600, color,
                              background: live ? "rgba(16,185,129,0.08)" : "var(--card)",
                              border: `1px solid ${live ? "var(--live)" : "var(--border)"}`,
                              borderRadius: 8, padding: "6px 10px"
                            }}>
                              <span style={{ width: 8, height: 8, borderRadius: "50%", background: color, flexShrink: 0, boxShadow: live ? "0 0 8px var(--live)" : "none" }} />
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div>{t.name}</div>
                                <div style={{ fontSize: 10.5, opacity: 0.8 }}>{t.time == null ? t.pendingNote : live ? "⚡ LIVE NOW" : fired ? "✓ shown" : fmtRel(t.time)}</div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Deadline Quick Presets */}
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                      <label style={{ fontSize: 11.5, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                        Deadline Configuration
                      </label>
                      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                        {[
                          { label: "Today 11:59 PM", getMs: () => { const d = new Date(); d.setHours(23, 59, 0, 0); return d; } },
                          { label: "Tomorrow 5:00 PM", getMs: () => { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(17, 0, 0, 0); return d; } },
                          { label: "This Friday 11:59 PM", getMs: () => { const d = new Date(); const day = d.getDay(); const diff = (5 - day + 7) % 7 || 7; d.setDate(d.getDate() + diff); d.setHours(23, 59, 0, 0); return d; } },
                          { label: "+7 Days", getMs: () => { const d = new Date(); d.setDate(d.getDate() + 7); d.setHours(23, 59, 0, 0); return d; } },
                        ].map(p => (
                          <button key={p.label} type="button" onClick={() => {
                            const dt = p.getMs();
                            const isoLocal = new Date(dt.getTime() - dt.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
                            setFeedbackFlashes(feedbackFlashes.map(f => f.id === ff.id ? { ...f, deadline: isoLocal } : f));
                          }} style={{ background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 10, padding: "2px 8px", fontSize: 11, fontWeight: 600, color: "var(--muted)", cursor: "pointer" }}>
                            {p.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="admin-grid-2">
                      <div className="admin-field">
                        <label>Deadline Date &amp; Time</label>
                        <input type="datetime-local" className="admin-input" value={ff.deadline || ""} onChange={e => setFeedbackFlashes(feedbackFlashes.map(f => f.id === ff.id ? { ...f, deadline: e.target.value } : f))} />
                      </div>

                      <div className="admin-field">
                        <label>External Form Link <span className="admin-optional">(Optional — leave blank for in-app form)</span></label>
                        <input type="url" className="admin-input" value={ff.link || ""} onChange={e => setFeedbackFlashes(feedbackFlashes.map(f => f.id === ff.id ? { ...f, link: e.target.value } : f))} placeholder="https://forms.gle/..." />
                      </div>
                    </div>
                  </div>

                  {/* Target Courses Selector */}
                  <div className="admin-field">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                      <label>Target Courses <span className="admin-optional">({(ff.subjects || []).length === 0 ? "All Courses / Everyone" : `${ff.subjects.length} selected`})</span></label>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button type="button" onClick={() => {
                          setFeedbackFlashes(feedbackFlashes.map(f => f.id === ff.id ? { ...f, subjects: Object.keys(LEGEND) } : f));
                        }} style={{ background: "none", border: "none", color: "var(--blue)", fontSize: 11.5, fontWeight: 700, cursor: "pointer" }}>
                          Select All
                        </button>
                        <span style={{ color: "var(--muted)" }}>|</span>
                        <button type="button" onClick={() => {
                          setFeedbackFlashes(feedbackFlashes.map(f => f.id === ff.id ? { ...f, subjects: [] } : f));
                        }} style={{ background: "none", border: "none", color: "var(--muted)", fontSize: 11.5, fontWeight: 700, cursor: "pointer" }}>
                          Clear All (Everyone)
                        </button>
                      </div>
                    </div>

                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {Object.keys(LEGEND).map(code => {
                        const isSelected = (ff.subjects || []).includes(code);
                        return (
                          <button
                            key={code}
                            type="button"
                            onClick={() => {
                              const newSubjects = isSelected ? (ff.subjects || []).filter(c => c !== code) : [...(ff.subjects || []), code];
                              setFeedbackFlashes(feedbackFlashes.map(f => f.id === ff.id ? { ...f, subjects: newSubjects } : f));
                            }}
                            className={`admin-btn ${isSelected ? "primary" : "outline"}`}
                            style={{ padding: "4px 9px", fontSize: 11.5, borderRadius: 16 }}
                            title={LEGEND[code].name}
                          >
                            {code}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}

            {feedbackFlashes.length === 0 && (
              <div style={{ padding: 24, textAlign: "center", color: "var(--muted)", background: "var(--bg)", borderRadius: 12, border: "1px dashed var(--border)" }}>
                No feedback flashes scheduled. Click <b>+ Add Feedback Flash</b> above to set up automated deadline nudges for course evaluations.
              </div>
            )}

            <div style={{ display: "flex", gap: 12, marginTop: 4 }}>
              <button onClick={saveConfig} disabled={saving} className="admin-btn primary" style={{ padding: "9px 20px" }}>
                <Save size={15} /> Save Scheduler Config
              </button>
            </div>

            {/* Live on-screen preview trigger */}
            {previewFlashId && (
              <FeedbackFlashToast 
                config={{ 
                  deadline: feedbackFlashes.find(f => f.id === previewFlashId)?.deadline, 
                  link: feedbackFlashes.find(f => f.id === previewFlashId)?.link,
                  subjectName: (feedbackFlashes.find(f => f.id === previewFlashId)?.subjects || []).length > 0 ? LEGEND[feedbackFlashes.find(f => f.id === previewFlashId).subjects[0]]?.name : null
                }} 
                onClose={() => setPreviewFlashId(null)} 
              />
            )}
          </div>
        </section>
          {/* Onboarding funnel */}
          <section className="admin-card admin-g-users" style={{ display: "flex", flexDirection: "column" }}>
            <h2><BarChart2 size={20} color="var(--green)" /> Onboarding Funnel</h2>
            <p className="admin-subtext">Where students drop off between signing up and staying active. Push count is device-based; the rest are user counts.</p>
            {(() => {
              const steps = [
                { label: "Signed up", n: funnel.signedUp, color: "var(--green)" },
                { label: "Picked a section", n: funnel.pickedSection, color: "var(--blue)" },
                { label: "Enabled push (devices)", n: funnel.pushDevices, color: "var(--live)" },
                { label: "Active this week", n: funnel.activeWeek, color: "var(--violet)" },
              ];
              const max = Math.max(funnel.signedUp, 1);
              return (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {steps.map((s, i) => {
                    const pct = Math.round((s.n / max) * 100);
                    const prev = i > 0 ? steps[i - 1].n : null;
                    const drop = prev != null && prev > 0 ? Math.round(((prev - s.n) / prev) * 100) : null;
                    return (
                      <div key={s.label}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
                          <span style={{ fontWeight: 600 }}>{s.label}</span>
                          <span><b>{s.n}</b> <span style={{ color: "var(--muted)" }}>({pct}%{drop != null && drop > 0 ? `, −${drop}%` : ""})</span></span>
                        </div>
                        <div style={{ height: 8, background: "var(--bg)", borderRadius: 4, overflow: "hidden", border: "1px solid var(--border)" }}>
                          <div style={{ height: "100%", width: `${pct}%`, background: s.color }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </section>

             {/* Enrollment Distribution */}
             <section className="admin-card admin-g-users">
               <h2><Database size={20} color="var(--violet)" /> Enrollment Stats</h2>
               <p className="admin-subtext">Top 5 most popular courses by enrollment.</p>
               <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 12 }}>
                  {popularCourses.length === 0 ? <div className="admin-empty">No data.</div> : 
                     popularCourses.slice(0, 5).map(([code, count]) => {
                        const max = popularCourses[0][1];
                        const pct = Math.round((count / max) * 100);
                        return (
                           <div key={code}>
                              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                                 <span style={{ fontWeight: 600 }}>{code}</span>
                                 <span style={{ color: "var(--muted)" }}>{count} enrolled</span>
                              </div>
                              <div style={{ height: 6, background: "var(--bg)", borderRadius: 4, overflow: "hidden", border: "1px solid var(--border)" }}>
                                 <div style={{ height: "100%", width: `${pct}%`, background: "var(--violet)" }}></div>
                              </div>
                           </div>
                        )
                     })
                  }
               </div>
             </section>

        <section className="admin-card admin-directory-card admin-span-all admin-g-users">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
             <h2><Users size={20} color="var(--green)" /> User Directory</h2>
             <button className="admin-btn outline" onClick={() => {
                const csvRows = [["User ID", "Name", "Email", "Courses"]];
                filteredUsers.forEach(u => {
                   csvRows.push([
                      u.user_id, 
                      u.name || "", 
                      u.email || "", 
                      u.courses ? Object.keys(u.courses).filter(c => !c.startsWith("_")).join(";") : ""
                   ].map(v => `"${v}"`).join(","));
                });
                const blob = new Blob([csvRows.join("\n")], { type: 'text/csv' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'user_export.csv';
                a.click();
             }} style={{ padding: "4px 10px", fontSize: 12 }}>Export Filtered to CSV</button>
          </div>
          <div className="admin-search-box" style={{ marginTop: 12 }}>
            <Search size={16} color="var(--muted)" />
            <input 
              type="text" 
              placeholder="Search users..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
          <div style={{ marginBottom: 12, display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", gap: 6 }}>
              {["All", "A", "B"].map(sec => (
                 <button key={sec} onClick={() => setUserSectionFilter(sec)} className={`admin-btn ${userSectionFilter === sec ? "" : "outline"}`} style={{ padding: "4px 10px", fontSize: 12 }}>
                    {sec === "All" ? "All Sections" : `Section ${sec}`}
                 </button>
              ))}
            </div>
          </div>

          {selectedUserIds.size > 0 && (
             <div style={{ background: "var(--amber-transparent)", padding: "8px 12px", borderRadius: 8, border: "1px solid var(--amber)", marginBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: "var(--amber-text)" }}>{selectedUserIds.size} Users Selected</span>
                <div style={{ display: "flex", gap: 8 }}>
                   <button className="admin-btn danger" onClick={() => {
                      if (!confirm(`Ban ${selectedUserIds.size} selected user${selectedUserIds.size > 1 ? "s" : ""}? Takes effect on next Deploy.`)) return;
                      const next = [...(flags.bannedUsers || [])];
                      selectedUserIds.forEach(id => { if(!next.includes(id)) next.push(id) });
                      setFlags({...flags, bannedUsers: next});
                      setSelectedUserIds(new Set());
                   }} style={{ fontSize: 11, padding: "4px 8px" }}>Ban Selected</button>
                   
                   <button className="admin-btn outline" onClick={() => {
                      let next = [...(flags.bannedUsers || [])];
                      selectedUserIds.forEach(id => { next = next.filter(b => b !== id) });
                      setFlags({...flags, bannedUsers: next});
                      setSelectedUserIds(new Set());
                   }} style={{ fontSize: 11, padding: "4px 8px" }}>Unban Selected</button>

                   <button className="admin-btn outline" onClick={pushSelectedUsers} style={{ fontSize: 11, padding: "4px 8px", borderColor: "var(--live)", color: "var(--live)" }}><BellRing size={12} /> Push Selected</button>

                   <button className="admin-btn outline" onClick={() => setSelectedUserIds(new Set())} style={{ fontSize: 11, padding: "4px 8px" }}>Clear Selection</button>
                </div>
             </div>
          )}

          <div className="admin-user-list">
            {loadingUsers ? (
              <div className="admin-loading">Loading users...</div>
            ) : filteredUsers.length === 0 ? (
              <div className="admin-empty">No users found.</div>
            ) : (
              filteredUsers.map(u => (
                <div key={u.user_id} className="admin-user-row" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", borderBottom: "1px solid var(--border)", background: selectedUserIds.has(u.user_id) ? "var(--bg)" : "transparent" }}>
                  <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
                    <input 
                       type="checkbox" 
                       checked={selectedUserIds.has(u.user_id)}
                       onChange={e => {
                          const next = new Set(selectedUserIds);
                          if(e.target.checked) next.add(u.user_id);
                          else next.delete(u.user_id);
                          setSelectedUserIds(next);
                       }}
                       style={{ width: 16, height: 16, accentColor: "var(--violet)" }}
                    />
                    <Avatar name={u.name} email={u.user_id} />
                    <div className="admin-user-info" onClick={() => setSelectedUser(u)} style={{ cursor: "pointer" }} title="Click to view full details">
                      <div className="admin-user-name" style={{ color: flags.bannedUsers?.includes(u.user_id) ? "var(--danger)" : "inherit" }}>
                         {u.name || "Student"} {flags.bannedUsers?.includes(u.user_id) && "(Banned)"}
                      </div>
                      <div className="admin-user-id">{u.email || u.user_id}</div>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => startImpersonation(u)} className="admin-btn-icon" title="Impersonate User" style={{ background: "transparent", border: "none", cursor: "pointer", padding: 6 }}>
                      <VenetianMask size={20} color="var(--amber)" />
                    </button>
                    <button onClick={() => {
                       const prevBanned = flags.bannedUsers || [];
                       const isBanned = prevBanned.includes(u.user_id);
                       const next = isBanned ? prevBanned.filter(id => id !== u.user_id) : [...prevBanned, u.user_id];
                       setFlags({...flags, bannedUsers: next});
                       logAdminAction(admin_id, isBanned ? "unban_user" : "ban_user", { target_user: u.user_id });
                       removeWithUndo(`${isBanned ? "Unbanned" : "Banned"} ${u.name || "user"} (Deploy to apply)`, () => setFlags(f => ({ ...f, bannedUsers: prevBanned })));
                    }} className="admin-btn-icon" title={flags.bannedUsers?.includes(u.user_id) ? "Unban User" : "Ban User"} style={{ background: "transparent", border: "none", cursor: "pointer", padding: 6 }}>
                      <Ban size={20} color={flags.bannedUsers?.includes(u.user_id) ? "var(--danger)" : "var(--muted)"} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

          {/* Inactive users + re-engagement */}
          <section className="admin-card admin-g-users">
            <h2><Users size={20} color="var(--muted)" /> Inactive Users</h2>
            <p className="admin-subtext">Students not seen recently. Click a name for details, or send a gentle re-engagement push to the whole list.</p>
            <div className="admin-field-row" style={{ alignItems: "flex-end", maxWidth: 440 }}>
              <div className="admin-field">
                <label>Inactive for at least (days)</label>
                <input type="number" min={1} max={120} className="admin-input" value={inactiveDays} onChange={e => setInactiveDays(Math.max(1, Number(e.target.value) || 1))} />
              </div>
              <button className="admin-btn primary" style={{ flex: "0 0 auto", marginBottom: 10 }} onClick={sendReEngagement} disabled={reEngaging}>
                <BellRing size={14} /> {reEngaging ? "Sending…" : `Nudge ${inactiveUsers.length}`}
              </button>
            </div>
            {reEngageMsg && <div style={{ fontSize: 12, color: reEngageMsg.startsWith("Queued") ? "var(--live)" : "var(--danger)", marginBottom: 8 }}>{reEngageMsg}</div>}
            <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 8 }}><b style={{ color: "var(--text)" }}>{inactiveUsers.length}</b> of {allUsers.length} users inactive {inactiveDays}+ days</div>
            <div style={{ maxHeight: 220, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
              {inactiveUsers.slice(0, 50).map(u => (
                <div key={u.user_id} onClick={() => setSelectedUser(u)} style={{ display: "flex", justifyContent: "space-between", padding: "6px 10px", background: "var(--bg)", borderRadius: 8, border: "1px solid var(--border)", fontSize: 12, cursor: "pointer" }}>
                  <span style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.name || "Student"}</span>
                  <span style={{ color: "var(--muted)", whiteSpace: "nowrap" }}>{u.last_seen_at ? new Date(u.last_seen_at).toLocaleDateString() : "never seen"}</span>
                </div>
              ))}
            </div>
          </section>

             {/* Friend Pings & Share Codes */}
             <section className="admin-card admin-g-users">
               <h2><Users size={20} color="var(--green)" /> Social Hygiene</h2>
               <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <span style={{ fontSize: 13, color: "var(--muted)" }}>Pending Friend Pings</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                     <span style={{ fontWeight: 800, fontSize: 16 }}>{friendPingsCount}</span>
                  </div>
               </div>
               
               <h3 style={{ fontSize: 12, textTransform: "uppercase", color: "var(--muted)", margin: "16px 0 8px 0", letterSpacing: "1px" }}>Active Share Codes</h3>
               <div style={{ maxHeight: 150, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
                  {shareCodes.length === 0 ? <div className="admin-empty">No active share codes.</div> : 
                     [...shareCodes].sort((a, b) => {
                        const nameA = allUsers.find(u => u.user_id === a.user_id)?.name;
                        const nameB = allUsers.find(u => u.user_id === b.user_id)?.name;
                        if (nameA && !nameB) return -1;
                        if (!nameA && nameB) return 1;
                        return 0;
                     }).map(sc => {
                        const owner = allUsers.find(u => u.user_id === sc.user_id);
                        return (
                           <div key={sc.code} style={{ display: "flex", justifyContent: "space-between", padding: "6px 12px", background: "var(--bg)", borderRadius: 8, border: "1px solid var(--border)", fontSize: 12 }}>
                              <span style={{ fontWeight: 700, letterSpacing: "1px" }}>{sc.code}</span>
                              <span style={{ color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 120 }}>{owner?.name ? owner.name : sc.user_id}</span>
                           </div>
                        )
                     })
                  }
               </div>
             </section>
             
          
          {/* ── Weekly Presence Heatmap ── */}
          <section className="admin-card admin-span-all admin-g-insights" style={{ gridColumn: "1 / -1" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8, marginBottom: 4 }}>
              <div>
                <h2 style={{ marginBottom: 4 }}><Users size={20} color="var(--violet)" /> Weekly Presence</h2>
                <p className="admin-subtext" style={{ margin: 0 }}>Who used the app and when — based on last-seen heartbeats. Click a day for a full breakdown.</p>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                {weeklyPresenceDay !== null && (
                  <button className="admin-btn outline" style={{ fontSize: 12, padding: "5px 12px" }} onClick={() => { setWeeklyPresenceDay(null); setWeeklyPresenceHourFilter(null); }}>
                    <X size={13} /> Back to week
                  </button>
                )}
                <button className="admin-btn outline" style={{ fontSize: 12, padding: "5px 12px" }} onClick={() => {
                  const rows = [["Day", "Date", "Name", "Time", "Hour", "Section", "Streak"]];
                  weeklyPresence.forEach(day => {
                    day.users.forEach(u => {
                      rows.push([day.label, day.date, u.name, new Date(u.seenTs).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }), u.hour, u.section, streakUserIds.has(u.userId) ? "Yes" : "No"]);
                    });
                  });
                  const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, "'")}"` ).join(",")).join("\n");
                  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
                  a.download = `weekly-presence-${new Date().toISOString().split("T")[0]}.csv`; a.click();
                }}>
                  <FileText size={13} /> Export CSV
                </button>
              </div>
            </div>

            {ghostUsers.length > 0 && (
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 10, background: "rgba(231,76,60,0.07)", border: "1px solid rgba(231,76,60,0.25)", marginBottom: 16, marginTop: 8 }}>
                <AlertTriangle size={15} color="var(--danger)" style={{ flexShrink: 0 }} />
                <span style={{ fontSize: 12, color: "var(--danger)" }}>
                  <b>{ghostUsers.length}</b> user{ghostUsers.length > 1 ? "s" : ""} haven&apos;t been seen in 7+ days — retention risk.{" "}
                  <span style={{ color: "var(--muted)" }}>Last: {ghostUsers.slice(0, 3).map(u => u.name).join(", ")}{ghostUsers.length > 3 ? ` +${ghostUsers.length - 3} more` : ""}.</span>
                </span>
              </div>
            )}

            {statsLoading ? (
              <div style={{ textAlign: "center", padding: "32px 0", color: "var(--muted)", fontSize: 13 }}>Loading presence data…</div>
            ) : weeklyPresenceDay === null ? (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 8, marginTop: 16 }}>
                  {weeklyPresence.map((day, i) => {
                    const maxDay = Math.max(...weeklyPresence.map(d => d.users.length), 1);
                    const isToday = i === 6;
                    const hasOverride = Object.keys(flags.classOverrides || {}).includes(day.isoDate);
                    const secCounts = {};
                    day.users.forEach(u => { secCounts[u.section] = (secCounts[u.section] || 0) + 1; });
                    const topSec = Object.entries(secCounts).sort((a, b) => b[1] - a[1])[0]?.[0];
                    return (
                      <button key={i}
                        onClick={() => { setWeeklyPresenceDay(i); setWeeklyPresenceHourFilter(null); }}
                        style={{ background: isToday ? "rgba(109,91,208,0.10)" : "var(--bg)", border: isToday ? "1.5px solid var(--violet)" : "1px solid var(--border)", borderRadius: 12, padding: "12px 8px", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 6, transition: "box-shadow 0.2s", position: "relative" }}
                        onMouseEnter={e => e.currentTarget.style.boxShadow = "0 0 0 2px var(--violet)"}
                        onMouseLeave={e => e.currentTarget.style.boxShadow = "none"}
                      >
                        {hasOverride && <span title="Has class overrides" style={{ position: "absolute", top: 7, right: 9, width: 7, height: 7, borderRadius: "50%", background: "var(--amber)" }} />}
                        <span style={{ fontSize: 11, fontWeight: isToday ? 800 : 600, color: isToday ? "var(--violet)" : "var(--muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>{day.label}</span>
                        <span style={{ fontSize: 10, color: "var(--muted)" }}>{day.date}</span>
                        <div style={{ width: "100%", height: 80, display: "flex", alignItems: "flex-end" }}>
                          <div style={{ width: "100%", height: day.users.length === 0 ? 4 : `${Math.max(8, Math.round((day.users.length / maxDay) * 80))}px`, background: isToday ? "linear-gradient(180deg, var(--violet) 0%, rgba(109,91,208,0.45) 100%)" : "rgba(109,91,208,0.35)", borderRadius: "4px 4px 0 0", transition: "height 0.4s" }} />
                        </div>
                        <span style={{ fontSize: 15, fontWeight: 800, color: day.users.length === 0 ? "var(--muted)" : "var(--text)", fontFamily: "var(--display)" }}>{day.users.length}</span>
                        {topSec && topSec !== "—" && <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 20, background: "rgba(109,91,208,0.15)", color: "var(--violet)" }}>Sec {topSec}</span>}
                      </button>
                    );
                  })}
                </div>
                <div style={{ display: "flex", gap: 20, marginTop: 16, paddingTop: 14, borderTop: "1px solid var(--border)", flexWrap: "wrap", alignItems: "center" }}>
                  <div style={{ fontSize: 12, color: "var(--muted)" }}>Sessions this week: <b style={{ color: "var(--text)" }}>{weeklyPresence.reduce((a, d) => a + d.users.length, 0)}</b></div>
                  <div style={{ fontSize: 12, color: "var(--muted)" }}>🔥 7-day streak: <b style={{ color: "var(--violet)" }}>{streakUserIds.size}</b></div>
                  <div style={{ fontSize: 12, color: "var(--muted)" }}>👻 Inactive 7d+: <b style={{ color: ghostUsers.length > 0 ? "var(--danger)" : "var(--muted)" }}>{ghostUsers.length}</b></div>
                  <div style={{ fontSize: 11, color: "var(--muted)", marginLeft: "auto", display: "flex", alignItems: "center", gap: 5 }}>
                    <span style={{ display: "inline-block", width: 7, height: 7, borderRadius: "50%", background: "var(--amber)" }} /> override on day
                  </div>
                </div>
              </>
            ) : (() => {
              const day = weeklyPresence[weeklyPresenceDay];
              const maxHour = Math.max(...day.hourBuckets, 1);
              const filtered = weeklyPresenceHourFilter !== null ? day.users.filter(u => u.hour === weeklyPresenceHourFilter) : day.users;
              const sorted = [...filtered].sort((a, b) => weeklyPresenceSort === "name" ? a.name.localeCompare(b.name) : b.seenTs - a.seenTs);
              const secCounts = {};
              day.users.forEach(u => { secCounts[u.section] = (secCounts[u.section] || 0) + 1; });
              return (
                <>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 16, marginBottom: 16, flexWrap: "wrap" }}>
                    <div style={{ fontSize: 18, fontWeight: 800, fontFamily: "var(--display)" }}>{day.label} · {day.date}</div>
                    <div style={{ fontSize: 13, color: "var(--muted)" }}>{day.users.length} session{day.users.length !== 1 ? "s" : ""}</div>
                    {Object.entries(secCounts).filter(([s]) => s !== "—").sort((a, b) => b[1] - a[1]).map(([sec, cnt]) => (
                      <span key={sec} style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20, background: "rgba(109,91,208,0.12)", color: "var(--violet)" }}>Sec {sec}: {cnt}</span>
                    ))}
                    <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
                      <button onClick={() => setWeeklyPresenceSort("time")} className={`admin-btn ${weeklyPresenceSort === "time" ? "" : "outline"}`} style={{ padding: "4px 10px", fontSize: 11 }}>By time</button>
                      <button onClick={() => setWeeklyPresenceSort("name")} className={`admin-btn ${weeklyPresenceSort === "name" ? "" : "outline"}`} style={{ padding: "4px 10px", fontSize: 11 }}>By name</button>
                    </div>
                  </div>

                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 6, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px" }}>Hourly activity — click to filter</div>
                    <div style={{ display: "flex", gap: 2, height: 36, alignItems: "flex-end" }}>
                      {day.hourBuckets.map((count, h) => {
                        const isSelected = weeklyPresenceHourFilter === h;
                        const intensity = count === 0 ? 0 : Math.max(0.12, count / maxHour);
                        return (
                          <button key={h} title={`${h}:00 — ${count} user${count !== 1 ? "s" : ""}`}
                            onClick={() => setWeeklyPresenceHourFilter(isSelected ? null : h)}
                            style={{ flex: 1, height: count === 0 ? 8 : `${Math.max(12, Math.round(intensity * 36))}px`, borderRadius: 3, border: isSelected ? "1.5px solid var(--violet)" : "none", background: count === 0 ? "var(--bg)" : `rgba(109,91,208,${intensity})`, cursor: count > 0 ? "pointer" : "default", transition: "all 0.2s", minWidth: 0 }}
                          />
                        );
                      })}
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
                      {["12am", "3am", "6am", "9am", "12pm", "3pm", "6pm", "9pm", "11pm"].map((l, i) => (
                        <span key={i} style={{ fontSize: 9, color: "var(--muted)" }}>{l}</span>
                      ))}
                    </div>
                    {weeklyPresenceHourFilter !== null && (
                      <div style={{ fontSize: 11, color: "var(--violet)", marginTop: 6 }}>
                        Filtered to {weeklyPresenceHourFilter}:00–{weeklyPresenceHourFilter}:59 ·{" "}
                        <button onClick={() => setWeeklyPresenceHourFilter(null)} style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer", fontSize: 11, padding: 0, textDecoration: "underline" }}>clear</button>
                      </div>
                    )}
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 340, overflowY: "auto" }} className="admin-scroll-hide">
                    {sorted.length === 0 ? (
                      <div className="admin-empty">No users active{weeklyPresenceHourFilter !== null ? ` at ${weeklyPresenceHourFilter}:00` : " this day"}.</div>
                    ) : sorted.map((u, idx) => {
                      const isStreak = streakUserIds.has(u.userId);
                      const initials = u.name.split(" ").filter(Boolean).map(w => w[0]).join("").slice(0, 2).toUpperCase();
                      return (
                        <div key={u.userId + idx}
                          style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderRadius: 10, background: "var(--bg)", border: "1px solid var(--border)", cursor: "pointer", transition: "border-color 0.15s" }}
                          onClick={() => setSelectedUser(allUsers.find(au => au.user_id === u.userId) || null)}
                          onMouseEnter={e => e.currentTarget.style.borderColor = "var(--violet)"}
                          onMouseLeave={e => e.currentTarget.style.borderColor = "var(--border)"}
                        >
                          <div style={{ width: 34, height: 34, borderRadius: "50%", flexShrink: 0, background: isStreak ? "rgba(109,91,208,0.20)" : "var(--card)", border: isStreak ? "2px solid var(--violet)" : "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, color: isStreak ? "var(--violet)" : "var(--muted)" }}>
                            {initials}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 700, fontSize: 13, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                              {u.name}
                              {isStreak && <span title="Active all 7 days" style={{ fontSize: 10, background: "rgba(109,91,208,0.15)", color: "var(--violet)", padding: "1px 7px", borderRadius: 20, fontWeight: 700 }}>🔥 Streak</span>}
                              {u.isNew && <span style={{ fontSize: 10, background: "rgba(31,169,113,0.15)", color: "var(--live)", padding: "1px 7px", borderRadius: 20, fontWeight: 700 }}>New</span>}
                              {u.section !== "—" && <span style={{ fontSize: 10, color: "var(--muted)", padding: "1px 6px", borderRadius: 20, border: "1px solid var(--border)" }}>Sec {u.section}</span>}
                            </div>
                            <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>Click to view profile</div>
                          </div>
                          <div style={{ textAlign: "right", flexShrink: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 700, fontFamily: "var(--display)" }}>
                              {new Date(u.seenTs).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                            </div>
                            <div style={{ fontSize: 10, color: "var(--muted)" }}>{u.hour}:00 slot</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              );
            })()}
          </section>
{/* Analytics Dashboard — real data from Supabase */}
          <section className="admin-card admin-span-all admin-g-insights" style={{ gridColumn: "1 / -1" }}>
             <h2><BarChart2 size={20} color="var(--violet)" /> Analytics & Usage</h2>
             <div style={{ display: "flex", gap: 16, marginTop: 16, flexWrap: "wrap" }}>

                {/* 7-Day Active Users — real last_seen_at buckets */}
                <div style={{ flex: 1, minWidth: 250, background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 12, padding: 16 }}>
                   <div style={{ fontSize: 13, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "1px", marginBottom: 12 }}>7-Day Active Users</div>
                   {(() => {
                      const maxVal = Math.max(...activityChartData, 1);
                      const dayLabels = Array.from({ length: 7 }, (_, i) => {
                        const d = new Date(LOAD_NOW - (6 - i) * 86400000);
                        return d.toLocaleDateString("en-IN", { weekday: "short" });
                      });
                      return (
                        <>
                          <div style={{ height: 100, display: "flex", alignItems: "flex-end", gap: 6 }}>
                            {activityChartData.map((v, i) => (
                              <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", height: "100%", justifyContent: "flex-end", gap: 4 }}>
                                <div title={`${v} users`} style={{ width: "100%", background: i === 6 ? "var(--violet)" : "rgba(109,91,208,0.45)", borderRadius: "4px 4px 0 0", height: `${Math.max(4, (v / maxVal) * 100)}%`, transition: "height 0.4s" }}></div>
                              </div>
                            ))}
                          </div>
                          <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                            {dayLabels.map((l, i) => <div key={i} style={{ flex: 1, fontSize: 9, color: "var(--muted)", textAlign: "center", fontWeight: i === 6 ? 800 : 400 }}>{l}</div>)}
                          </div>
                          <div style={{ marginTop: 10, fontSize: 12, color: "var(--muted)", borderTop: "1px solid var(--border)", paddingTop: 8 }}>
                            Total past 7 days: <strong style={{ color: "var(--text)" }}>{activityChartData.reduce((a, b) => a + b, 0)}</strong> unique sessions
                          </div>
                        </>
                      );
                   })()}
                </div>

                {/* Most-Skipped Classes — from attendance table */}
                <div style={{ flex: 1, minWidth: 250, background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 12, padding: 16 }}>
                   <div style={{ fontSize: 13, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "1px", marginBottom: 12 }}>Most Skipped Classes</div>
                   <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {skipStats.length === 0 ? (
                         <div className="admin-empty" style={{ fontSize: 12 }}>No absence data yet.</div>
                      ) : skipStats.map(([code, count]) => {
                         const maxSkip = skipStats[0][1];
                         return (
                           <div key={code}>
                             <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 3 }}>
                               <span style={{ fontWeight: 600 }}>{code}</span><span style={{ color: "var(--muted)" }}>{count} absences</span>
                             </div>
                             <div style={{ height: 6, background: "var(--card)", borderRadius: 3, overflow: "hidden" }}>
                               <div style={{ width: `${Math.round((count / maxSkip) * 100)}%`, height: "100%", background: "var(--danger)" }}></div>
                             </div>
                           </div>
                         );
                      })}
                   </div>
                </div>

                {/* Peak Hour — computed from last_seen_at timestamps */}
                <div style={{ flex: 1, minWidth: 250, background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 12, padding: 16, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", textAlign: "center" }}>
                   <Clock size={32} color="var(--blue)" style={{ marginBottom: 12 }} />
                   <div style={{ fontSize: 28, fontWeight: 800 }}>
                     {peakHour !== null ? `${peakHour % 12 || 12}:00 ${peakHour < 12 ? "AM" : "PM"}` : "—"}
                   </div>
                   <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 4 }}>Peak Usage Hour (IST)</div>
                   <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>Based on last_seen_at heartbeats</div>
                   {statsLoading && <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 8 }}>Loading...</div>}
                </div>
             </div>
          </section>

          {/* Active-user tiers (DAU/WAU/MAU) */}
          <section className="admin-card admin-g-insights">
            <h2><BarChart2 size={20} color="var(--live)" /> Active Users</h2>
            <p className="admin-subtext">Unique students seen within each rolling window (from last_seen_at).</p>
            <div className="admin-stats-grid">
              {[["DAU", activeTiers.dau, "last 24h"], ["WAU", activeTiers.wau, "last 7 days"], ["MAU", activeTiers.mau, "last 30 days"]].map(([label, val, sub]) => (
                <div className="admin-stat-box" key={label}>
                  <div style={{ fontSize: 30, fontWeight: 800, fontFamily: "var(--display)", color: "var(--text)" }}>{statsLoading ? "…" : val}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "var(--muted)", marginTop: 4 }}>{label}</div>
                  <div style={{ fontSize: 11, color: "var(--muted)" }}>{sub}</div>
                </div>
              ))}
            </div>
            {typeof totalUsers === "number" && totalUsers > 0 && (
              <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 12 }}>
                Stickiness (DAU/MAU): <b style={{ color: "var(--text)" }}>{activeTiers.mau ? Math.round((activeTiers.dau / activeTiers.mau) * 100) : 0}%</b>
                {" · "}MAU reach: <b style={{ color: "var(--text)" }}>{Math.round((activeTiers.mau / totalUsers) * 100)}%</b> of {totalUsers}
              </div>
            )}
          </section>

          {/* Feature adoption */}
          <section className="admin-card admin-g-insights">
            <h2><Flag size={20} color="var(--violet)" /> Feature Adoption</h2>
            <p className="admin-subtext">Signals from live data + which major features are currently enabled.</p>
            <div className="admin-stats-grid">
              <div className="admin-stat-box">
                <div style={{ fontSize: 26, fontWeight: 800, fontFamily: "var(--display)" }}>{typeof totalUsers === "number" && totalUsers ? Math.round((Number(pushSubCount) || 0) / totalUsers * 100) : 0}%</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)", marginTop: 4 }}>Push enabled</div>
                <div style={{ fontSize: 11, color: "var(--muted)" }}>{pushSubCount} devices</div>
              </div>
              <div className="admin-stat-box">
                <div style={{ fontSize: 26, fontWeight: 800, fontFamily: "var(--display)" }}>{shareCodes.length}</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)", marginTop: 4 }}>Active share codes</div>
                <div style={{ fontSize: 11, color: "var(--muted)" }}>social sharing</div>
              </div>
              <div className="admin-stat-box">
                <div style={{ fontSize: 26, fontWeight: 800, fontFamily: "var(--display)" }}>{friendPingsCount}</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)", marginTop: 4 }}>Friend pings</div>
                <div style={{ fontSize: 11, color: "var(--muted)" }}>pending</div>
              </div>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 12 }}>
              {["enableFriends", "enableExams", "enableAttendance", "enableStatus", "enableMeetups", "enableFreeNudge", "enableAwayShare"].filter(k => k in flags).map(k => (
                <span key={k} style={{ fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 20, border: "1px solid var(--border)", background: flags[k] !== false ? "rgba(31,169,113,0.12)" : "var(--bg)", color: flags[k] !== false ? "var(--live)" : "var(--muted)" }}>
                  {k.replace("enable", "")} {flags[k] !== false ? "on" : "off"}
                </span>
              ))}
            </div>
          </section>

          {/* Edge-function / cron health */}
          <section className="admin-card admin-span-all admin-g-insights" style={{ gridColumn: "1 / -1" }}>
            <h2><Terminal size={20} color="var(--live)" /> Edge Function / Cron Health</h2>
            <p className="admin-subtext">Last run of each scheduled job (dispatch, class-reminders, scheduled pushes). Watch for stalled or failing notifiers.</p>
            {cronHealth === null ? (
              <div className="admin-empty">Needs the <code>get_cron_health</code> RPC (migration 20260731120000) deployed.</div>
            ) : cronHealth.length === 0 ? (
              <div className="admin-empty">No cron jobs reported.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {cronHealth.map((j, i) => {
                  const ok = (j.status || "").toLowerCase() === "succeeded";
                  const stale = j.last_run && (LOAD_NOW - new Date(j.last_run).getTime()) > 20 * 60000;
                  const color = !j.last_run ? "var(--muted)" : ok && !stale ? "var(--live)" : "var(--danger)";
                  return (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "8px 12px", background: "var(--bg)", borderRadius: 8, border: `1px solid ${color}` }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 700 }}>{j.jobname} {!j.active && <span style={{ color: "var(--muted)", fontWeight: 500 }}>(paused)</span>}</div>
                        <div style={{ fontSize: 11, color: "var(--muted)", fontFamily: "var(--mono)" }}>{j.schedule}{j.message ? ` — ${String(j.message).slice(0, 80)}` : ""}</div>
                      </div>
                      <div style={{ textAlign: "right", flexShrink: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color }}>{j.status || "never run"}</div>
                        <div style={{ fontSize: 11, color: "var(--muted)" }}>{j.last_run ? new Date(j.last_run).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—"}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Self-test: ping every service in one click */}
          <section className="admin-card admin-g-insights" style={{ display: "flex", flexDirection: "column" }}>
            <h2><Check size={20} color="var(--live)" /> System Self-Test</h2>
            <p className="admin-subtext">One click pings the DB, insights RPCs, cron jobs, the push function and the Sheets feed — a single green/red readout instead of checking each card.</p>
            <button className="admin-btn primary" onClick={runSelfTest} disabled={selfTesting} style={{ alignSelf: "flex-start" }}>
              {selfTesting ? <><RefreshCw size={14} className="spin-icon" /> Running…</> : <><Check size={14} /> Run self-test</>}
            </button>
            {selfTest && (
              <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 6 }}>
                {selfTest.checks.map((c, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "8px 12px", background: "var(--bg)", borderRadius: 8, border: `1px solid ${c.ok ? "var(--live)" : "var(--danger)"}` }}>
                    <span style={{ fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}><span style={{ width: 9, height: 9, borderRadius: "50%", background: c.ok ? "var(--live)" : "var(--danger)" }} />{c.name}</span>
                    <span style={{ fontSize: 12, color: "var(--muted)", textAlign: "right" }}>{c.detail}</span>
                  </div>
                ))}
                <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>
                  {selfTest.checks.filter(c => !c.ok).length === 0 ? "All systems healthy." : `${selfTest.checks.filter(c => !c.ok).length} issue(s) found.`} · {new Date(selfTest.at).toLocaleTimeString()}
                </div>
              </div>
            )}
          </section>

          {/* Admin action leaderboard */}
          <section className="admin-card admin-g-insights" style={{ display: "flex", flexDirection: "column" }}>
            <h2><ShieldAlert size={20} color="var(--violet)" /> Admin Activity (7 days)</h2>
            <p className="admin-subtext">Who's been operating the panel this week — accountability across the admin roles.</p>
            {adminLeaderboard.length === 0 ? (
              <div className="admin-empty">No admin actions logged in the last 7 days.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {adminLeaderboard.map((a, i) => {
                  const name = allUsers.find(u => u.user_id === a.id)?.name || (a.id === admin_id ? "You" : a.id.slice(0, 10));
                  const top = Object.entries(a.actions).sort((x, y) => y[1] - x[1]).slice(0, 3).map(([k, v]) => `${k.replace(/_/g, " ")} ×${v}`).join(", ");
                  return (
                    <div key={a.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "8px 12px", background: "var(--bg)", borderRadius: 8, border: "1px solid var(--border)" }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 700 }}>{i + 1}. {name}</div>
                        <div style={{ fontSize: 11, color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{top}</div>
                      </div>
                      <div style={{ textAlign: "right", flexShrink: 0 }}>
                        <div style={{ fontSize: 16, fontWeight: 800, fontFamily: "var(--display)" }}>{a.count}</div>
                        <div style={{ fontSize: 10, color: "var(--muted)" }}>{new Date(a.last).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Sentry deep link */}
          <section className="admin-card admin-g-insights">
            <h2><AlertTriangle size={20} color="var(--amber)" /> Error Monitoring</h2>
            <p className="admin-subtext">Client + edge errors are captured in Sentry. Open the dashboard for the live issue feed.</p>
            <a className="admin-btn outline" href="https://sentry.io/organizations/flames-corp/issues/?project=termflow" target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}>
              <Terminal size={14} /> Open Sentry Issues
            </a>
          </section>

             {/* API Health Check — live pings */}
             <section className="admin-card admin-g-insights">
               <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                 <h2><Terminal size={20} color="var(--live)" /> API Health Check</h2>
                 <button onClick={checkApiHealth} disabled={healthChecking} className="admin-btn outline" style={{ padding: "4px 10px", fontSize: 12 }}>
                   <RefreshCw size={13} className={healthChecking ? "spin-icon" : ""} /> {healthChecking ? "Checking…" : "Run Check"}
                 </button>
               </div>
               <p className="admin-subtext">Click "Run Check" to probe all services live.</p>
               <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 12 }}>
                  {[
                    { key: "supabase", label: "Supabase Database", icon: <Database size={14} /> },
                    { key: "push",     label: "Push Notification Gateway", icon: <BellRing size={14} /> },
                    { key: "sheets",   label: "Google Sheets Live Feed", icon: <FileText size={14} /> },
                  ].map(({ key, label, icon }) => {
                    const s = healthStatus[key];
                    const _isOk  = s && s !== "error" && s !== "timeout";
                    const isErr = s === "error" || s === "timeout";
                    const bg  = !s ? "var(--bg)" : isErr ? "rgba(231,76,60,0.08)" : "rgba(46,204,113,0.08)";
                    const tag = !s ? (healthChecking ? "Checking…" : "Not checked") :
                                isErr ? (s === "timeout" ? "Timeout" : "Error") :
                                key === "supabase" ? s : "Operational";
                    const tagColor = !s ? "var(--muted)" : isErr ? "var(--danger)" : "var(--green)";
                    return (
                      <div key={key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", background: bg, borderRadius: 8, border: `1px solid ${!s ? "var(--border)" : isErr ? "var(--danger)" : "var(--green)"}`, transition: "all 0.3s" }}>
                        <span style={{ fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}>{icon} {label}</span>
                        <span style={{ fontSize: 11, fontWeight: 700, color: tagColor, padding: "2px 8px", borderRadius: 10, background: `${tagColor}22` }}>{tag}</span>
                      </div>
                    );
                  })}
               </div>
             </section>

        {/* Feedback Section */}
        <section className="admin-card admin-g-users">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h2><Terminal size={20} color="var(--green)" /> Feedback & Bug Reports</h2>
            <div style={{ display: "flex", gap: 6 }}>
               <button onClick={() => setFeedbackFilter("all")} className={`admin-btn ${feedbackFilter === "all" ? "" : "outline"}`} style={{ padding: "4px 8px", fontSize: 12 }}>All</button>
               <button onClick={() => setFeedbackFilter("pending")} className={`admin-btn ${feedbackFilter === "pending" ? "" : "outline"}`} style={{ padding: "4px 8px", fontSize: 12 }}>Pending Only</button>
            </div>
          </div>
          <div style={{ maxHeight: 300, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8, marginTop: 16 }}>
            {feedbackList.filter(f => feedbackFilter === "all" || f.status === "pending").length === 0 ? <div className="admin-empty">No feedback found.</div> : 
             feedbackList.filter(f => feedbackFilter === "all" || f.status === "pending").map(f => {
               const fUser = allUsers.find(u => u.user_id === f.user_id);
               return (
               <div key={f.id} style={{ padding: "12px", background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 8 }}>
                 <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                   <span style={{ fontSize: 12, color: "var(--muted)" }}>{new Date(f.created_at).toLocaleString()} • {fUser ? fUser.name : f.user_id}</span>
                   <span style={{ fontSize: 12, fontWeight: 700, color: f.status === "resolved" ? "var(--green)" : "var(--amber)" }}>{f.status.toUpperCase()}</span>
                 </div>
                 <div style={{ fontSize: 14, color: "var(--text)" }}>{f.message}</div>
                 <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap", alignItems: "center" }}>
                   {f.status === "pending" && (
                     <button onClick={() => markFeedbackResolved(f.id)} className="admin-btn outline" style={{ padding: "4px 10px", fontSize: 12, color: "var(--green)", borderColor: "var(--green)" }}>Mark Resolved</button>
                   )}
                   {f.user_id && (
                     <button onClick={async () => {
                       const msg = prompt(`Reply to ${fUser?.name || "user"} via push:`);
                       if (!msg) return;
                       const res = await pushToUserIds([f.user_id], { title: "Reply from TermFlow admin", body: msg.trim() });
                       if (res?.ok) { await logAdminAction(admin_id, "feedback_reply", { feedback: f.id }); alert("Reply push queued."); }
                       else alert("Failed: " + (res?.data?.error || "error"));
                     }} className="admin-btn outline" style={{ padding: "4px 10px", fontSize: 12 }}><BellRing size={12} /> Reply</button>
                   )}
                   <button onClick={() => { setWnTitle(f.message.slice(0, 58)); setWnDesc(f.message); setWnEmoji("✨"); setActiveTab("broadcast"); window.scrollTo({ top: 0, behavior: "smooth" }); }} className="admin-btn outline" style={{ padding: "4px 10px", fontSize: 12 }} title="Prefill a What's New entry from this feedback"><Sparkles size={12} /> To What&rsquo;s New</button>
                   <span style={{ width: 1, height: 18, background: "var(--border)" }} />
                   {["bug", "idea", "dup", "wontfix"].map(t => {
                     const on = (flags.feedbackTags?.[f.id] || []).includes(t);
                     return (
                       <button key={t} onClick={() => {
                         const cur = flags.feedbackTags?.[f.id] || [];
                         const next = on ? cur.filter(x => x !== t) : [...cur, t];
                         setFlags({ ...flags, feedbackTags: { ...(flags.feedbackTags || {}), [f.id]: next } });
                       }} style={{ padding: "2px 9px", fontSize: 11, fontWeight: 600, borderRadius: 20, border: "1px solid var(--border)", background: on ? "var(--violet)" : "transparent", color: on ? "#fff" : "var(--muted)", cursor: "pointer" }}>{t}</button>
                     );
                   })}
                 </div>
               </div>
             )})}
          </div>
        </section>

          {/* Maintenance scheduler */}
          <section className="admin-card admin-g-system">
            <h2><CloudOff size={20} color="var(--danger)" /> Maintenance Window</h2>
            <p className="admin-subtext">Schedule an automatic maintenance lockout (non-admins see the "Under Maintenance" screen while the window is active). Leave blank for none. Deploy Config to apply.</p>
            <div className="admin-field-row" style={{ maxWidth: 520 }}>
              <div className="admin-field">
                <label>Start</label>
                <input type="datetime-local" className="admin-input" value={flags.maintenanceWindow?.start || ""} onChange={e => setFlags({ ...flags, maintenanceWindow: { ...(flags.maintenanceWindow || {}), start: e.target.value } })} />
              </div>
              <div className="admin-field">
                <label>End</label>
                <input type="datetime-local" className="admin-input" value={flags.maintenanceWindow?.end || ""} onChange={e => setFlags({ ...flags, maintenanceWindow: { ...(flags.maintenanceWindow || {}), end: e.target.value } })} />
              </div>
            </div>
            {(flags.maintenanceWindow?.start || flags.maintenanceWindow?.end) && (
              <button className="admin-btn outline" style={{ marginTop: 4 }} onClick={() => { if (!confirm("Clear the scheduled maintenance window?")) return; const n = { ...flags }; delete n.maintenanceWindow; setFlags(n); }}>Clear window</button>
            )}
          </section>

          {/* Admin roles */}
          <section className="admin-card admin-g-system">
            <h2><ShieldAlert size={20} color="var(--violet)" /> Admin Roles</h2>
            <p className="admin-subtext">Grant Monitor (read-only) or Superadmin access by user ID. You can also set a role from any user's detail panel.</p>
            <div className="admin-field-row" style={{ alignItems: "flex-end" }}>
              <div className="admin-field" style={{ flex: 2 }}>
                <label>User ID</label>
                <input className="admin-input" value={roleUserId} onChange={e => setRoleUserId(e.target.value)} placeholder="user_xxx" />
              </div>
              <div className="admin-field" style={{ flex: 1 }}>
                <label>Role</label>
                <select className="admin-input" value={roleValue} onChange={e => setRoleValue(e.target.value)}>
                  <option value="monitor">Monitor</option>
                  <option value="superadmin">Superadmin</option>
                </select>
              </div>
              <button className="admin-btn primary" style={{ flex: "0 0 auto", marginBottom: 10 }} onClick={saveAdminRole}>Grant</button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
              {Object.keys(flags.adminRoles || {}).length === 0 ? (
                <div className="admin-empty">No admin roles assigned.</div>
              ) : Object.entries(flags.adminRoles).map(([id, role]) => {
                const u = allUsers.find(x => x.user_id === id);
                return (
                  <div key={id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: "var(--bg)", borderRadius: 8, border: "1px solid var(--border)" }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{u?.name || id}</div>
                      <div style={{ fontSize: 11, color: "var(--muted)", fontFamily: "var(--mono)" }}>{id}</div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 10, background: "rgba(109,91,208,0.12)", color: "var(--violet)" }}>{role}</span>
                      <button onClick={() => removeAdminRole(id)} className="admin-btn danger" style={{ padding: "4px 8px" }}><Trash2 size={14} /></button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Config backup & restore */}
          <section className="admin-card admin-g-system">
            <h2><Database size={20} color="var(--blue)" /> Config Backup &amp; Restore</h2>
            <p className="admin-subtext">Download the live config as JSON, or import a backup (loads into the editor — Review &amp; Deploy to apply). Rollback to a recent deploy lives in the save bar below.</p>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button className="admin-btn outline" onClick={_exportConfigJSON}><FileText size={15} /> Export JSON</button>
              <button className="admin-btn outline" onClick={() => configFileRef.current?.click()}><FileText size={15} /> Import JSON</button>
              <input ref={configFileRef} type="file" accept="application/json,.json" onChange={handleImportConfig} style={{ display: "none" }} />
            </div>
          </section>

          {/* Data export center */}
          <section className="admin-card admin-g-system">
            <h2><FileText size={20} color="var(--blue)" /> Data Export</h2>
            <p className="admin-subtext">Download the currently loaded admin data as CSV for reporting or backup.</p>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button className="admin-btn outline" onClick={() => exportCsv("users.csv", ["user_id", "name", "last_seen_at", "courses"], allUsers.map(u => [u.user_id, u.name, u.last_seen_at || "", Object.keys(u.courses || {}).filter(c => !c.startsWith("_")).join(";")]))} disabled={allUsers.length === 0}>Users ({allUsers.length})</button>
              <button className="admin-btn outline" onClick={() => exportCsv("feedback.csv", ["created_at", "status", "user_id", "message"], feedbackList.map(f => [f.created_at, f.status, f.user_id || "", f.message]))} disabled={feedbackList.length === 0}>Feedback ({feedbackList.length})</button>
              <button className="admin-btn outline" onClick={() => exportCsv("audit_logs.csv", ["created_at", "action", "admin_id", "details"], auditLogs.map(l => [l.created_at, l.action, l.admin_id, JSON.stringify(l.details || {})]))} disabled={auditLogs.length === 0}>Audit logs ({auditLogs.length})</button>
            </div>
          </section>

          {/* Scheduled config deploys */}
          <section className="admin-card admin-g-system">
            <h2><Clock size={20} color="var(--amber)" /> Scheduled Deploys</h2>
            <p className="admin-subtext">Queue the current pending config to auto-publish at a future time (requires the apply-scheduled-config cron). For an immediate change, use Deploy Config in the save bar instead.</p>
            <div className="admin-field-row" style={{ alignItems: "flex-end", maxWidth: 480 }}>
              <div className="admin-field"><label>Deploy at</label><input type="datetime-local" className="admin-input" value={scheduleDeployAt} onChange={e => setScheduleDeployAt(e.target.value)} /></div>
              <button className="admin-btn primary" style={{ flex: "0 0 auto", marginBottom: 10 }} onClick={queueConfigDeploy}>Schedule deploy</button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {(flags.scheduledConfigDeploys || []).length === 0 ? (
                <div className="admin-empty">No scheduled deploys.</div>
              ) : (flags.scheduledConfigDeploys || []).map(e => (
                <div key={e.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: "var(--bg)", borderRadius: 8, border: "1px solid var(--border)" }}>
                  <div style={{ fontSize: 13 }}>
                    <b>{new Date(e.at).toLocaleString()}</b>
                    <div style={{ fontSize: 11, color: "var(--muted)" }}>by {allUsers.find(u => u.user_id === e.author)?.name || "admin"}</div>
                  </div>
                  <button onClick={() => removeScheduledDeploy(e.id)} className="admin-btn outline" style={{ padding: "4px 8px", borderColor: "var(--danger)", color: "var(--danger)" }}><Trash2 size={14} /></button>
                </div>
              ))}
            </div>
          </section>

<section className="admin-card admin-g-system">
            <h2><Flag size={20} color="var(--violet)" /> Feature Flags</h2>
            <div className="admin-flag-list">
              {/* Curated toggles (default ON when unset) + any other real boolean
                  flags. Internal data keys (classOverrides, configHistory,
                  messMenuOverrides…) and Danger-Zone toggles are excluded. */}
              {FEATURE_FLAGS.map(({ key, label }) => (
                <label key={key} className="admin-flag-item">
                  <input
                    type="checkbox"
                    checked={flags[key] !== false}
                    onChange={e => setFlags({ ...flags, [key]: e.target.checked })}
                  />
                  <span>{label} <span style={{ color: "var(--muted)", fontWeight: 500, fontSize: 12 }}>({key})</span></span>
                </label>
              ))}
              {Object.keys(flags)
                .filter(k => typeof flags[k] === "boolean" && !FEATURE_FLAG_KEYS.has(k) && k !== "maintenanceMode" && k !== "dispatchEnabled")
                .map(key => (
                  <label key={key} className="admin-flag-item">
                    <input type="checkbox" checked={!!flags[key]} onChange={e => setFlags({ ...flags, [key]: e.target.checked })} />
                    <span>{key}</span>
                  </label>
                ))}
            </div>
            
            <div className="admin-field" style={{ marginTop: 16 }}>
              <label style={{ display: "block", marginBottom: 8, fontSize: 12, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "1px" }}>TermFlow Wrapped Release</label>
              {(() => {
                const WRAPPED_MIN_DATE = "2026-08-27"; // hard floor — mirrored in App.jsx gating
                const todayStr = new Date().toISOString().split("T")[0];
                const rel = flags.wrappedReleaseDate || "";
                const effective = rel && rel < WRAPPED_MIN_DATE ? WRAPPED_MIN_DATE : rel;
                const status = !rel
                  ? "Not scheduled — students can't see Wrapped yet."
                  : todayStr >= effective
                    ? `🟢 LIVE for the cohort since ${effective}.`
                    : `Scheduled — goes live on ${effective}.`;
                return (
                  <>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      <input
                        type="date"
                        className="admin-input"
                        min={WRAPPED_MIN_DATE}
                        value={rel}
                        onChange={e => setFlags({ ...flags, wrappedReleaseDate: e.target.value || null })}
                        style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg)" }}
                      />
                      <button
                        type="button"
                        className="admin-btn"
                        onClick={() => setFlags({ ...flags, wrappedReleaseDate: todayStr > WRAPPED_MIN_DATE ? todayStr : WRAPPED_MIN_DATE })}
                        title="Release immediately (or on 27 Aug 2026 if that hasn't arrived yet)"
                      >
                        Push now
                      </button>
                      {rel && (
                        <button type="button" className="admin-btn" onClick={() => setFlags({ ...flags, wrappedReleaseDate: null })}>
                          Unschedule
                        </button>
                      )}
                    </div>
                    <div className="admin-subtext" style={{ marginTop: 6 }}>
                      {status} Earliest allowed release is 27 Aug 2026 (dates before it are clamped). Hidden from everyone — including admins — until this date arrives; there's no QA bypass, so preview it by scheduling a date and unscheduling after. Remember to hit <b>Deploy Config to Cloud</b>.
                    </div>
                  </>
                );
              })()}
            </div>

            <div className="admin-field" style={{ marginTop: 16 }}>
              <label style={{ display: "block", marginBottom: 8, fontSize: 12, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "1px" }}>Hero Backdrop Strategy</label>
              <select 
                className="admin-input" 
                value={flags.heroBackdrop || "swap"} 
                onChange={e => setFlags({ ...flags, heroBackdrop: e.target.value })}
                style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg)", width: "100%" }}
              >
                <option value="none">None (Remove Background)</option>
                <option value="swap">Swap Alt Days (Default)</option>
                <option value="v2">Static (V2 Image)</option>
                <option value="v3">Static (V3 Image)</option>
              </select>
            </div>
          </section>

             {/* A/B Testing — managed from flags.abTests */}

<section className="admin-card admin-g-broadcast">
            <h2><Megaphone size={20} color="var(--amber)" /> All Announcements</h2>
            <div className="admin-subtext" style={{ marginBottom: 16 }}>Live feed of all schedule changes (including admin-only data quality issues).</div>
            
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {allChanges.length === 0 ? (
                <div style={{ padding: "20px", textAlign: "center", color: "var(--muted)", background: "rgba(0,0,0,0.02)", borderRadius: 8 }}>No announcements found.</div>
              ) : (
                allChanges.slice(0, showAllAdminNotifs ? undefined : 3).map(c => (
                  <div key={c.id} style={{ 
                    padding: "10px 14px", 
                    background: "rgba(0,0,0,0.02)", 
                    borderRadius: 8, 
                    borderLeft: `3px solid ${c.admin_only ? "var(--amber)" : "var(--violet)"}`,
                    borderStyle: c.admin_only ? "dashed" : "solid",
                    borderTop: "1px solid var(--border)",
                    borderRight: "1px solid var(--border)",
                    borderBottom: "1px solid var(--border)"
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", lineHeight: 1.4 }}>{c.text}</div>
                        <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4, display: "flex", gap: 8 }}>
                          <span>{new Date(c.ts).toLocaleString()}</span>
                          {c.admin_only && <span style={{ color: "var(--amber)", fontWeight: 700 }}>ADMIN ONLY</span>}
                          {c.code && <span>Course: {c.code}</span>}
                          <span>Type: {c.kind}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
              
              {allChanges.length > 3 && (
                <button 
                  onClick={() => setShowAllAdminNotifs(true)}
                  style={{
                    padding: "8px",
                    background: "transparent",
                    border: "1px dashed var(--border)",
                    borderRadius: 8,
                    cursor: "pointer",
                    color: "var(--muted)",
                    fontWeight: 600,
                    marginTop: 4,
                    transition: "all 0.2s"
                  }}
                  onMouseOver={(e) => { e.currentTarget.style.background = "var(--surface)"; e.currentTarget.style.color = "var(--text)"; }}
                  onMouseOut={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--muted)"; }}
                >
                  View More ({allChanges.length - 3} remaining)
                </button>
              )}
            </div>
          </section>

          {showAllAdminNotifs && (
            <div className="assign-modal-overlay" onClick={() => setShowAllAdminNotifs(false)}>
              <div className="assign-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 600, maxHeight: "90vh", display: "flex", flexDirection: "column" }}>
                <div className="assign-modal-head">
                  <h2><Megaphone size={20} color="var(--amber)" style={{ verticalAlign: "middle", marginRight: 8, marginTop: -3 }} /> All Announcements</h2>
                  <button className="assign-modal-close" onClick={() => setShowAllAdminNotifs(false)}><X size={16} /></button>
                </div>
                <div className="assign-modal-body" style={{ overflowY: "auto", flex: 1, padding: "24px 32px", gap: 12 }}>
                  {allChanges.map(c => (
                    <div key={c.id} style={{ 
                      padding: "12px 16px", 
                      background: "rgba(0,0,0,0.02)", 
                      borderRadius: 10, 
                      borderLeft: `3px solid ${c.admin_only ? "var(--amber)" : "var(--violet)"}`,
                      borderStyle: c.admin_only ? "dashed" : "solid",
                      borderTop: "1px solid var(--border)",
                      borderRight: "1px solid var(--border)",
                      borderBottom: "1px solid var(--border)"
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text)", lineHeight: 1.4 }}>{c.text}</div>
                          <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 6, display: "flex", gap: 8, flexWrap: "wrap" }}>
                            <span>{new Date(c.ts).toLocaleString()}</span>
                            {c.admin_only && <span style={{ color: "var(--amber)", fontWeight: 700 }}>ADMIN ONLY</span>}
                            {c.code && <span>Course: {c.code}</span>}
                            <span>Type: {c.kind}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          <section className="admin-card admin-g-system">
               <h2><Flag size={20} color="var(--blue)" /> A/B Testing</h2>
               <p className="admin-subtext">Rollout experiments stored in flags. Deploy config to apply changes.</p>

               {/* Add new experiment */}
               <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
                 <div className="admin-field" style={{ flex: 2, minWidth: 140 }}>
                   <label>Experiment Name</label>
                   <input className="admin-input" value={abTestName} onChange={e => setAbTestName(e.target.value)} placeholder="e.g. new_home_v4" />
                 </div>
                 <div className="admin-field" style={{ flex: 1, minWidth: 80 }}>
                   <label>Rollout %</label>
                   <input type="number" min={0} max={100} className="admin-input" value={abTestRollout} onChange={e => setAbTestRollout(Number(e.target.value))} />
                 </div>
                 <button className="admin-btn primary" style={{ marginBottom: 10 }} onClick={() => {
                   const key = abTestName.trim().toLowerCase().replace(/\s+/g, "_");
                   if (!key) return alert("Enter an experiment name.");
                   setFlags({ ...flags, abTests: { ...(flags.abTests || {}), [key]: { name: abTestName.trim(), rollout: abTestRollout, active: true } } });
                   setAbTestName(""); setAbTestRollout(50);
                 }}>Add</button>
               </div>

               {/* Existing experiments */}
               <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 8 }}>
                 {Object.keys(flags.abTests || {}).length === 0 ? (
                   <div className="admin-empty">No experiments. Add one above.</div>
                 ) : Object.entries(flags.abTests || {}).map(([key, exp]) => (
                   <div key={key} style={{ padding: 12, background: "var(--bg)", borderRadius: 8, border: "1px solid var(--border)" }}>
                     <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                       <div>
                         <span style={{ fontSize: 13, fontWeight: 700 }}>{exp.name || key}</span>
                         <span style={{ fontSize: 11, color: "var(--muted)", marginLeft: 8 }}>({key})</span>
                       </div>
                       <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                         <input type="number" min={0} max={100} value={exp.rollout} onChange={e => setFlags({ ...flags, abTests: { ...flags.abTests, [key]: { ...exp, rollout: Number(e.target.value) } } })} style={{ width: 52, padding: "2px 6px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)", fontSize: 12, textAlign: "center" }} />
                         <span style={{ fontSize: 11, color: "var(--muted)" }}>%</span>
                         <button onClick={() => {
                           const next = { ...flags.abTests }; delete next[key];
                           setFlags({ ...flags, abTests: next });
                         }} style={{ background: "transparent", border: "none", cursor: "pointer", padding: 2 }}><Trash2 size={14} color="var(--danger)" /></button>
                       </div>
                     </div>
                     <div style={{ height: 6, background: "var(--card)", borderRadius: 3, overflow: "hidden", border: "1px solid var(--border)" }}>
                       <div style={{ width: `${Math.min(100, Math.max(0, exp.rollout))}%`, height: "100%", background: "var(--blue)", transition: "width 0.3s" }}></div>
                     </div>
                   </div>
                 ))}
               </div>
             </section>


          {/* Time Machine */}
          <section className="admin-card admin-span-all admin-g-system" style={{ gridColumn: "1 / -1" }}>
            <h2><Clock size={20} color="var(--amber)" /> Time Machine</h2>
            <p className="admin-subtext">Override the application's current time to test the timeline, agenda, and UI states.</p>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 12, alignItems: "center" }}>
              <input type="datetime-local" className="admin-input" style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border)" }}
                 value={timeOverride || ""} onChange={e => setTimeOverride(e.target.value)} />
              {timeOverride && (
                <button className="admin-btn outline" onClick={() => setTimeOverride(null)}>Reset to Real Time</button>
              )}
              <button className="admin-btn outline" onClick={() => setTimeOverride(nextOccurrence(8, 15))}>Preview Independence Day</button>
              <button className="admin-btn outline" onClick={() => setTimeOverride(nextOccurrence(1, 26))}>Preview Republic Day</button>
            </div>
            {timeOverride && (
               <div style={{ marginTop: 12, padding: "8px 12px", background: "rgba(245, 158, 11, 0.1)", border: "1px solid var(--amber)", color: "var(--amber)", borderRadius: 8, fontSize: 13, fontWeight: 600 }}>
                 ⚠️ The application is currently running in simulated time.
               </div>
            )}
          </section>

          {/* Live Sync Logs */}
          <section className="admin-card admin-span-all admin-g-insights" style={{ gridColumn: "1 / -1" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <h2 style={{ margin: 0, padding: 0 }}><Terminal size={20} color="var(--violet)" /> Live Sync Logs</h2>
                <p className="admin-subtext" style={{ margin: 0 }}>Real-time status of the connection to the Google Apps Script live feed.</p>
              </div>
              {syncLogs.length > 5 && (
                <button className="admin-btn outline" onClick={() => setShowAllLogs(!showAllLogs)} style={{ padding: "6px 12px", fontSize: 12, flex: "none" }}>
                  {showAllLogs ? "Show Less" : "View All Logs"}
                </button>
              )}
            </div>
            <div style={{ background: "rgba(0,0,0,0.8)", color: "#e2e8f0", borderRadius: 8, padding: 16, marginTop: 16, maxHeight: showAllLogs ? 500 : 200, overflowY: "auto", fontFamily: "monospace", fontSize: 13, border: "1px solid var(--border)", boxShadow: "inset 0 2px 10px rgba(0,0,0,0.2)" }}>
              {displayedLogs.length === 0 ? (
                <div style={{ color: "var(--muted)", fontStyle: "italic" }}>No sync logs yet. Press "Force Sync" above to test connection.</div>
              ) : (
                displayedLogs.map((log, i) => (
                  <div key={i} style={{ display: "flex", gap: 12, marginBottom: 8, paddingBottom: 8, borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                    <span style={{ color: "var(--muted)", whiteSpace: "nowrap" }}>{new Date(log.ts).toLocaleTimeString()}</span>
                    <span style={{ color: log.status === "error" ? "var(--danger)" : "var(--green)", fontWeight: 700, width: 60 }}>[{log.status.toUpperCase()}]</span>
                    <span style={{ wordBreak: "break-word", color: log.status === "error" ? "var(--danger)" : "#e2e8f0" }}>{log.message}</span>
                  </div>
                ))
              )}
            </div>
          </section>

          {/* Audit Logs */}
          <section className="admin-card admin-span-all admin-g-insights" style={{ gridColumn: "1 / -1" }}>
            <h2><Terminal size={20} color="var(--violet)" /> Admin Audit Logs</h2>
            <p className="admin-subtext">Administrative actions performed by all admins (last 200).</p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 4 }}>
              <select className="admin-input" value={auditActionFilter} onChange={e => setAuditActionFilter(e.target.value)} style={{ flex: "0 0 auto" }}>
                <option value="all">All actions</option>
                {[...new Set(auditLogs.map(l => l.action))].sort().map(a => <option key={a} value={a}>{a.replace(/_/g, " ")}</option>)}
              </select>
              <input className="admin-input" value={auditSearch} onChange={e => setAuditSearch(e.target.value)} placeholder="Search action / admin / details" style={{ flex: "1 1 200px" }} />
              <button className="admin-btn outline" onClick={() => {
                const rows = filteredAuditLogs.map(l => [l.created_at, l.action, l.admin_id, JSON.stringify(l.details || {})]);
                exportCsv("admin_audit_logs.csv", ["created_at", "action", "admin_id", "details"], rows);
              }} style={{ flex: "0 0 auto" }}><FileText size={14} /> Export CSV</button>
            </div>
            <div style={{ padding: 16, marginTop: 12 }}>
              {filteredAuditLogs.length === 0 ? (
                <div className="admin-empty">No matching audit logs.</div>
              ) : (
                <div style={{ position: "relative", borderLeft: "2px solid var(--border)", paddingLeft: 24, marginLeft: 12, display: "flex", flexDirection: "column", gap: 24 }}>
                  {filteredAuditLogs.slice(0, 60).map((log) => {
                     let Icon = FileText;
                     let color = "var(--text)";
                     if (log.action.includes("save") || log.action.includes("refresh")) { Icon = Save; color = "var(--blue)"; }
                     else if (log.action.includes("cancel") || log.action.includes("override") || log.action.includes("edit")) { Icon = AlertTriangle; color = "var(--amber)"; }
                     else if (log.action.includes("ban") || log.action.includes("delete")) { Icon = Trash2; color = "var(--danger)"; }
                     
                     return (
                        <div key={log.id} style={{ position: "relative" }}>
                           <div style={{ position: "absolute", left: -41, top: 0, width: 32, height: 32, borderRadius: 16, background: "var(--bg)", border: `2px solid ${color}`, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2 }}>
                              <Icon size={16} color={color} />
                           </div>
                           <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
                              <div style={{ flex: 1, minWidth: 200 }}>
                                 <div style={{ fontWeight: 800, color, fontSize: 14, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 4 }}>{log.action.replace(/_/g, ' ')}</div>
                                 <div style={{ fontSize: 13, color: "var(--muted)" }}>Admin ID: {log.admin_id}</div>
                                 {Object.keys(log.details || {}).length > 0 && (
                                   <pre style={{ margin: "8px 0 0 0", background: "rgba(0,0,0,0.02)", padding: "8px 12px", borderRadius: 8, fontSize: 12, border: "1px solid var(--border)", overflowX: "auto", maxWidth: "100%", color: "var(--text)" }}>
                                      {JSON.stringify(log.details, null, 2)}
                                   </pre>
                                 )}
                              </div>
                              <span style={{ fontSize: 12, color: "var(--muted)", whiteSpace: "nowrap", fontWeight: 600 }}>{new Date(log.created_at).toLocaleString()}</span>
                           </div>
                        </div>
                     );
                  })}
                </div>
              )}
            </div>
          </section>

          {/* Config drift — what live config layers on top of the bundled snapshot */}
          <section className="admin-card admin-g-system" style={{ display: "flex", flexDirection: "column" }}>
            <h2><Database size={20} color="var(--blue)" /> Config Drift</h2>
            <p className="admin-subtext">How far the live cloud config has drifted from the timetable baked into the app at build time. High counts mean students are downloading a lot of overrides — consider a snapshot rebuild.</p>
            <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 12 }}>
              Snapshot baked {snapshotMeta.ts ? new Date(snapshotMeta.ts).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "—"} · {snapshotMeta.classes || "?"} classes
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: 10 }}>
              {[
                { label: "Class overrides", n: configDrift.overrideClasses, sub: `${configDrift.overrideDays} day(s)` },
                { label: "Announcements", n: configDrift.announcements, sub: "scheduled" },
                { label: "Quick links", n: configDrift.quickLinks, sub: "active" },
              ].map(s => (
                <div key={s.label} style={{ background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 10, padding: "12px 14px" }}>
                  <div style={{ fontSize: 24, fontWeight: 800, fontFamily: "var(--display)", color: s.n > 0 ? "var(--text)" : "var(--muted)" }}>{s.n}</div>
                  <div style={{ fontSize: 12, fontWeight: 700 }}>{s.label}</div>
                  <div style={{ fontSize: 11, color: "var(--muted)" }}>{s.sub}</div>
                </div>
              ))}
            </div>
            <div style={{ fontSize: 12, marginTop: 12, color: configDrift.total > 0 ? "var(--amber)" : "var(--live)", display: "flex", alignItems: "center", gap: 6 }}>
              {configDrift.total > 0
                ? <><AlertTriangle size={14} /> Live config adds {configDrift.total} item(s) on top of the bundle.</>
                : <><Check size={14} /> Live config matches the bundled snapshot.</>}
            </div>
          </section>

          {/* Health alerts — admin-only push when a job stalls or the feed dies */}
          <section className="admin-card admin-g-system" style={{ display: "flex", flexDirection: "column" }}>
            <h2><BellRing size={20} color="var(--amber)" /> Health Alerts</h2>
            <p className="admin-subtext">The <code>health-monitor</code> cron checks every 15 min for stalled/failed jobs and a dead Sheets feed, then pushes an alert — to admins on this list only, never to students. Deploy Config to save the recipient list.</p>
            {(() => {
              const recipients = flags.alertRecipients || [];
              const meIncluded = recipients.includes(admin_id);
              return (
                <>
                  <label className="admin-flag-item" style={{ marginBottom: 10 }}>
                    <input type="checkbox" checked={meIncluded} onChange={e => {
                      const next = e.target.checked ? [...new Set([...recipients, admin_id])] : recipients.filter(id => id !== admin_id);
                      setFlags({ ...flags, alertRecipients: next });
                    }} />
                    <span>Send health alerts to me</span>
                  </label>
                  {recipients.length === 0 ? (
                    <div className="admin-empty">No recipients — alerts are off. (Admins with a role still receive them.)</div>
                  ) : (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {recipients.map(id => {
                        const name = allUsers.find(u => u.user_id === id)?.name || (id === admin_id ? "You" : id.slice(0, 10));
                        return (
                          <span key={id} style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 20, padding: "3px 4px 3px 10px", fontSize: 12 }}>
                            {name}
                            <button type="button" onClick={() => setFlags({ ...flags, alertRecipients: recipients.filter(x => x !== id) })} style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--muted)", display: "flex" }} aria-label="Remove recipient"><X size={12} /></button>
                          </span>
                        );
                      })}
                    </div>
                  )}
                  <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 10 }}>Requires the <code>health-monitor</code> edge function + cron deployed. Alerts land in your inbox and as a push.</div>
                </>
              );
            })()}
          </section>

          {/* Bundled Snapshot + Danger Zone — one row at the bottom */}
          <div className="admin-grid admin-span-all admin-g-system">

            <section className="admin-card">
              <h2><Database size={20} color="var(--violet)" /> Bundled Snapshot</h2>
              <p className="admin-subtext">
                Fallback timetable baked into the app at build time. Regenerated automatically from the live sheet on every deploy.
              </p>
              <div className="admin-danger-row">
                <div>
                  <strong style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                    {snapshotMeta.status === "success" ? (
                      <><Check size={15} color="var(--live, #2ecc71)" /> Automation passed</>
                    ) : (
                      <><AlertTriangle size={15} color="var(--danger, #e74c3c)" /> Automation failed</>
                    )}
                  </strong>
                  <span className="admin-subtext" style={{ margin: 0 }}>
                    {snapshotMeta.status === "success" ? (
                      <>Generated {new Date(snapshotMeta.ts).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })} · {snapshotMeta.classes} classes · {snapshotMeta.courses} courses · term {snapshotMeta.termStart} → {snapshotMeta.termEnd}</>
                    ) : (
                      <>
                        {snapshotMeta.error || "Feed unreachable at build time"} — serving snapshot from{" "}
                        {snapshotMeta.lastSuccessTs ? new Date(snapshotMeta.lastSuccessTs).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "an older build"}
                      </>
                    )}
                  </span>
                </div>
                <button className="admin-btn outline" onClick={triggerSnapshotRebuild} disabled={rebuilding}>
                  <RefreshCw size={14} className={rebuilding ? "spin-icon" : ""} /> Rebuild
                </button>
              </div>
              {rebuildMsg && (
                <span className={`admin-save-msg ${rebuildMsg.startsWith("Failed") ? "error" : "success"}`} style={{ display: "block", marginTop: 8 }}>
                  {rebuildMsg}
                </span>
              )}
            </section>

            <section className="admin-card admin-g-system">
              <h2><Terminal size={20} color="var(--violet)" /> Feature Toggles</h2>
              <p className="admin-subtext">Remote kill switches. If a toggle is on, the feature is active for all users.</p>
              
              <div className="admin-danger-row" style={{ border: "none", padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
                <div>
                  <strong style={{ display: "block", marginBottom: 4 }}>Social Feed & TermFlow</strong>
                  <span className="admin-subtext" style={{ margin: 0 }}>Enable or disable user statuses and feeds.</span>
                </div>
                <label className="admin-toggle">
                  <input type="checkbox" checked={flags.features?.social !== false} onChange={e => setFlags({ ...flags, features: { ...(flags.features || {}), social: e.target.checked } })} />
                  <span className="slider"></span>
                </label>
              </div>

              <div className="admin-danger-row" style={{ border: "none", padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
                <div>
                  <strong style={{ display: "block", marginBottom: 4 }}>Group Chats</strong>
                  <span className="admin-subtext" style={{ margin: 0 }}>Enable or disable group messaging.</span>
                </div>
                <label className="admin-toggle">
                  <input type="checkbox" checked={flags.features?.chat !== false} onChange={e => setFlags({ ...flags, features: { ...(flags.features || {}), chat: e.target.checked } })} />
                  <span className="slider"></span>
                </label>
              </div>

              <div className="admin-danger-row" style={{ border: "none", padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
                <div>
                  <strong style={{ display: "block", marginBottom: 4 }}>Expense Splitting</strong>
                  <span className="admin-subtext" style={{ margin: 0 }}>Enable or disable the group expense splitter.</span>
                </div>
                <label className="admin-toggle">
                  <input type="checkbox" checked={flags.features?.splits !== false} onChange={e => setFlags({ ...flags, features: { ...(flags.features || {}), splits: e.target.checked } })} />
                  <span className="slider"></span>
                </label>
              </div>

              <div className="admin-danger-row" style={{ border: "none", padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
                <div>
                  <strong style={{ display: "block", marginBottom: 4 }}>Group Polls</strong>
                  <span className="admin-subtext" style={{ margin: 0 }}>Enable or disable poll creation in groups.</span>
                </div>
                <label className="admin-toggle">
                  <input type="checkbox" checked={flags.features?.polls !== false} onChange={e => setFlags({ ...flags, features: { ...(flags.features || {}), polls: e.target.checked } })} />
                  <span className="slider"></span>
                </label>
              </div>

              <div className="admin-danger-row" style={{ border: "none", padding: "10px 0" }}>
                <div>
                  <strong style={{ display: "block", marginBottom: 4 }}>Independence/Republic Day Theme</strong>
                  <span className="admin-subtext" style={{ margin: 0 }}>Tricolor accent + greeting banner on 15 Aug and 26 Jan.</span>
                </div>
                <label className="admin-toggle">
                  <input type="checkbox" checked={flags.features?.specialDayTheme !== false} onChange={e => setFlags({ ...flags, features: { ...(flags.features || {}), specialDayTheme: e.target.checked } })} />
                  <span className="slider"></span>
                </label>
              </div>
            </section>

            <section className="admin-card danger-zone">
              <h2><AlertTriangle size={20} color="var(--danger, #e74c3c)" /> Danger Zone</h2>

              <div className="admin-danger-row">
                <div>
                  <strong style={{ display: "block", marginBottom: 4 }}>Maintenance Mode</strong>
                  <span className="admin-subtext" style={{ margin: 0 }}>Locks out all non-admin users immediately.</span>
                </div>
                <label className="admin-toggle">
                  <input type="checkbox" checked={!!flags.maintenanceMode} onChange={e => setFlags({ ...flags, maintenanceMode: e.target.checked })} />
                  <span className="slider"></span>
                </label>
              </div>

              <div className="admin-danger-row">
                <div>
                  <strong style={{ display: "block", marginBottom: 4 }}>Push Dispatcher</strong>
                  <span className="admin-subtext" style={{ margin: 0 }}>
                    ON: the notifications system delivers push. OFF: pauses all outgoing push within a minute (the in-app inbox still updates; queued events resume when re-enabled). Kill-switch if the new push system misbehaves — flip OFF, then redeploy the legacy functions to fully fall back.
                  </span>
                </div>
                <label className="admin-toggle">
                  <input type="checkbox" checked={flags.dispatchEnabled !== false} onChange={e => setFlags({ ...flags, dispatchEnabled: e.target.checked })} />
                  <span className="slider"></span>
                </label>
              </div>

              <div className="admin-danger-row">
                <div>
                  <strong style={{ display: "block", marginBottom: 4 }}>Force Global Refresh</strong>
                  <span className="admin-subtext" style={{ margin: 0 }}>Force all clients to re-sync from cloud.</span>
                </div>
                <button className="admin-btn outline" onClick={forceRefresh}>
                  <RefreshCw size={14} /> Force Sync
                </button>
              </div>
            </section>

          </div>

          <section className="admin-card admin-span-all admin-g-moderation" style={{ gridColumn: "1 / -1" }}>
            <h2><Shield size={20} color="var(--violet)" /> UGC Moderation (TermFlow)</h2>
            <p className="admin-subtext">View and manage live user statuses. Active statuses are visible on user cards.</p>
            <div className="admin-user-list" style={{ maxHeight: 400, overflowY: "auto", border: "1px solid var(--border)", borderRadius: 12 }}>
              {(() => {
                const activeStatusUsers = allUsers.filter(u => u.courses?._status?.until && new Date(u.courses._status.until).getTime() > LOAD_NOW);
                return activeStatusUsers.length === 0 ? (
                 <div className="admin-empty">No active user statuses found.</div>
              ) : (
                 activeStatusUsers.map(u => (
                   <div key={u.user_id} className="admin-user-row" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", borderBottom: "1px solid var(--border)" }}>
                     <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                       <Avatar name={u.name} email={u.user_id} />
                       <div>
                         <div style={{ fontSize: 14, fontWeight: 600 }}>{u.name}</div>
                         <div style={{ fontSize: 13, color: "var(--text)" }}>
                           <span style={{ marginRight: 6 }}>{u.courses._status.emoji}</span>
                           {u.courses._status.text}
                         </div>
                         <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
                           Expires: {new Date(u.courses._status.until).toLocaleString()}
                         </div>
                       </div>
                     </div>
                     <button onClick={async () => {
                        if (confirm(`Clear status for ${u.name}?`)) {
                           const updated = { ...u.courses };
                           delete updated._status;
                           await supabase.from("profiles").update({ courses: updated }).eq("user_id", u.user_id);
                           await logAdminAction(admin_id, "clear_user_status", { target_user: u.user_id });
                           setAllUsers(allUsers.map(usr => usr.user_id === u.user_id ? { ...usr, courses: updated } : usr));
                        }
                     }} className="admin-btn outline" style={{ color: "var(--danger)", borderColor: "var(--danger)", fontSize: 12, padding: "6px 12px" }}>
                       Clear Status
                     </button>
                   </div>
                 ))
                );
              })()}
            </div>
          </section>

          <section className="admin-card admin-span-all admin-g-moderation" style={{ gridColumn: "1 / -1" }}>
            <h2><Terminal size={20} color="var(--live)" /> Admin Audit Logs</h2>
            <p className="admin-subtext">Recent actions performed by administrators across the dashboard.</p>
            <div className="admin-table-wrapper" style={{ maxHeight: 400 }}>
              {auditLogs.length === 0 ? (
                 <div className="admin-empty">No audit logs found.</div>
              ) : (
                 <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                   <thead style={{ background: "var(--card)", position: "sticky", top: 0, borderBottom: "1px solid var(--border)" }}>
                     <tr>
                       <th style={{ textAlign: "left", padding: "10px 16px", color: "var(--muted)", fontWeight: 600 }}>Timestamp</th>
                       <th style={{ textAlign: "left", padding: "10px 16px", color: "var(--muted)", fontWeight: 600 }}>Admin ID</th>
                       <th style={{ textAlign: "left", padding: "10px 16px", color: "var(--muted)", fontWeight: 600 }}>Action</th>
                       <th style={{ textAlign: "left", padding: "10px 16px", color: "var(--muted)", fontWeight: 600 }}>Details</th>
                     </tr>
                   </thead>
                   <tbody>
                     {auditLogs.map((log, i) => (
                       <tr key={log.id || i} style={{ borderBottom: "1px solid var(--border)", background: i % 2 === 0 ? "transparent" : "var(--card)" }}>
                         <td style={{ padding: "10px 16px", whiteSpace: "nowrap", color: "var(--muted)", fontSize: 12 }}>{new Date(log.created_at).toLocaleString()}</td>
                         <td style={{ padding: "10px 16px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 120 }}>{log.admin_id}</td>
                         <td style={{ padding: "10px 16px", fontWeight: 600 }}>{log.action}</td>
                         <td style={{ padding: "10px 16px" }}>
                           <pre style={{ margin: 0, fontSize: 11, background: "var(--bg)", padding: 6, borderRadius: 6, overflowX: "auto", color: "var(--text)" }}>
                             {JSON.stringify(log.details, null, 2)}
                           </pre>
                         </td>
                       </tr>
                     ))}
                   </tbody>
                 </table>
              )}
            </div>
          </section>

          <section className="admin-card admin-span-all admin-g-database" style={{ gridColumn: "1 / -1" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
              <div>
                <h2><Database size={20} color="var(--blue)" /> Database Explorer</h2>
                <p className="admin-subtext" style={{ margin: 0 }}>Raw read-only view of database tables (showing top 50 most recent rows).</p>
              </div>
              <select className="admin-input" value={dbTable} onChange={e => setDbTable(e.target.value)} style={{ padding: "6px 12px", width: 200 }}>
                <option value="profiles">profiles</option>
                <option value="groups">groups</option>
                <option value="group_members">group_members</option>
                <option value="meetups">meetups</option>
                <option value="polls">polls</option>
                <option value="split_groups">split_groups</option>
                <option value="feedback">feedback</option>
                <option value="share_codes">share_codes</option>
              </select>
            </div>
            
            <div className="admin-table-wrapper" style={{ minHeight: 200 }}>
              {dbLoading ? (
                <div className="admin-empty">Loading {dbTable} data...</div>
              ) : dbError ? (
                <div className="admin-empty" style={{ color: "var(--danger)" }}>{dbError}</div>
              ) : dbRows.length === 0 ? (
                <div className="admin-empty">No rows found in {dbTable}.</div>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, textAlign: "left" }}>
                  <thead style={{ background: "var(--card)" }}>
                    <tr>
                      {Object.keys(dbRows[0]).map(k => (
                        <th key={k} style={{ padding: "10px 16px", color: "var(--muted)", fontWeight: 600, borderBottom: "1px solid var(--border)", whiteSpace: "nowrap" }}>{k}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {dbRows.map((row, i) => (
                      <tr key={i} style={{ borderBottom: "1px solid var(--border)", background: i % 2 === 0 ? "transparent" : "var(--card)" }}>
                        {Object.values(row).map((v, j) => (
                          <td key={j} style={{ padding: "10px 16px", whiteSpace: "nowrap", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis" }} title={typeof v === "object" ? JSON.stringify(v) : String(v)}>
                            {typeof v === "object" ? JSON.stringify(v) : String(v)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </section>

      </div>

      <div className="admin-save-footer" style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        {changesCount > 0 && (
          <button className="admin-btn" onClick={async () => {
            setReviewDrift(null);
            setReviewOpen(true);
            // Passive drift check: did someone deploy since we loaded?
            if (loadedUpdatedAt) {
              const { data: cur } = await supabase.from("system_config").select("updated_at").eq("id", "global").single();
              if (cur?.updated_at && cur.updated_at !== loadedUpdatedAt) setReviewDrift({ when: cur.updated_at });
            }
          }} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <FileText size={16} /> Review {changesCount} change{changesCount > 1 ? "s" : ""}
          </button>
        )}
        <button className="admin-save-btn" onClick={saveConfig} disabled={saving} style={{ position: "relative" }}>
          <Save size={18} /> {saving ? "Saving..." : "Deploy Config to Cloud"}
          {changesCount > 0 && (
             <div style={{ position: "absolute", top: -8, right: -8, background: "var(--danger)", color: "#fff", fontSize: 10, fontWeight: "bold", padding: "2px 6px", borderRadius: 10 }}>
               {changesCount} changed
             </div>
          )}
        </button>
        {saveMsg && (
          <span className={`admin-save-msg ${saveMsg.includes("Failed") || saveMsg.includes("Error") || saveMsg.includes("⚠") ? "error" : "success"}`}>
            {saveMsg.includes("Successfully") && <Check size={16} />}
            {saveMsg}
            {forceDeployReady && (
              <button
                onClick={() => { setForceDeployReady(false); setSaveMsg(""); saveConfig({ force: true }); }}
                style={{
                  marginLeft: 10, padding: "3px 10px", borderRadius: 6, border: "none",
                  background: "#fff", color: "#b45309", fontWeight: 700, fontSize: 12,
                  cursor: "pointer", whiteSpace: "nowrap"
                }}
              >
                Force Deploy
              </button>
            )}
          </span>
        )}
        {activeOverrideCount > 0 && (
          <span style={{ fontSize: 12, color: "var(--orange)", display: "flex", alignItems: "center", gap: 4 }}>
            <AlertTriangle size={14} /> {activeOverrideCount} active overrides
          </span>
        )}
        {staleConfigCount > 0 && (
          <button className="admin-btn outline" onClick={purgeStaleConfig} title="Remove past-dated class overrides, expired announcements and quick links from the config students download" style={{ padding: "9px 16px" }}>
            <Trash2 size={15} /> Purge expired ({staleConfigCount})
          </button>
        )}
        {originalFlags && (
          <button className="admin-btn outline" onClick={() => {
             if (confirm("Revert all unsaved changes back to the currently deployed config?")) {
                setFlags(originalFlags);
             }
          }} style={{ padding: "9px 16px" }}>
            <RefreshCw size={15} /> Revert Changes
          </button>
        )}
        {flags.configHistory && flags.configHistory.length > 0 && (
           <button className="admin-btn outline" onClick={() => {
              const last = flags.configHistory[0];
              if (confirm(`Undo the last deploy and restore the config from ${new Date(last.timestamp).toLocaleString()}? Review & Deploy to apply.`)) {
                 setFlags({ ...stripHistoryKeys(last.flags), configHistory: flags.configHistory });
              }
           }} style={{ padding: "9px 16px" }} title={`Restore the config from ${new Date(flags.configHistory[0].timestamp).toLocaleString()}`}>
              <RefreshCw size={15} /> Undo last deploy
           </button>
        )}
        {flags.configHistory && flags.configHistory.length > 0 && (
           <div style={{ position: "relative", display: "inline-block" }}>
              <select className="admin-input" onChange={e => {
                 if(!e.target.value) return;
                 const selectedHistory = flags.configHistory[parseInt(e.target.value)];
                 if(confirm(`Restore configuration saved on ${new Date(selectedHistory.timestamp).toLocaleString()}?`)) {
                    setFlags({ ...stripHistoryKeys(selectedHistory.flags), configHistory: flags.configHistory });
                 }
                 e.target.value = ""; // reset
              }} style={{ padding: "9px 16px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg)", width: 220 }}>
                 <option value="">Restore Past Version...</option>
                 {flags.configHistory.map((h, i) => (
                    <option key={h.timestamp} value={i}>{new Date(h.timestamp).toLocaleString()} by {h.author || "Admin"}</option>
                 ))}
              </select>
           </div>
        )}
      </div>

      {/* Pre-deploy review modal */}
      {reviewOpen && (() => {
        const changes = summarizeConfigChanges(originalFlags, flags);
        return (
          <>
            <div className="notif-backdrop" onClick={() => setReviewOpen(false)} style={{ zIndex: 10000 }} />
            <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", background: "var(--card)", padding: 24, borderRadius: 16, width: "92%", maxWidth: 520, maxHeight: "85vh", overflowY: "auto", zIndex: 10001, border: "1px solid var(--border)", boxShadow: "0 10px 40px rgba(0,0,0,0.2)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                <h2 style={{ margin: 0, fontSize: 18, display: "flex", gap: 8, alignItems: "center" }}>
                  <FileText size={18} color="var(--violet)" /> Review changes
                </h2>
                <button onClick={() => setReviewOpen(false)} style={{ background: "transparent", border: "none", color: "var(--muted)", cursor: "pointer" }} aria-label="Close"><XCircle size={18} /></button>
              </div>
              <div className="admin-subtext" style={{ marginBottom: 14 }}>
                Local edits vs the config you loaded. Nothing is live until you deploy.
              </div>

              {reviewDrift && (
                <div style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "10px 14px", marginBottom: 14, background: "rgba(245,158,11,0.1)", border: "1px solid var(--amber)", borderRadius: 10 }}>
                  <AlertTriangle size={16} color="var(--amber)" style={{ flex: "0 0 auto", marginTop: 1 }} />
                  <span style={{ fontSize: 12.5, color: "var(--text)" }}>
                    Another admin deployed at {new Date(reviewDrift.when).toLocaleTimeString()}. Deploying now is blocked to protect their changes — <strong>refresh the dashboard</strong> and re-apply your edits.
                  </span>
                </div>
              )}

              {changes.length === 0 ? (
                <div style={{ padding: 20, textAlign: "center", color: "var(--muted)", background: "var(--bg)", borderRadius: 10, border: "1px dashed var(--border)" }}>
                  No pending changes — everything matches the cloud config.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {changes.map(c => (
                    <div key={c.key} style={{ padding: "10px 14px", background: "var(--bg)", borderRadius: 10, border: "1px solid var(--border)", borderLeft: "3px solid var(--violet)" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 13.5, fontWeight: 700, color: "var(--text)" }}>{c.label}</span>
                        <span style={{ fontSize: 12, color: "var(--muted)", fontVariantNumeric: "tabular-nums" }}>{c.summary}</span>
                      </div>
                      {c.details.length > 0 && (
                        <ul style={{ margin: "6px 0 0", paddingLeft: 16, display: "flex", flexDirection: "column", gap: 2 }}>
                          {c.details.map((d, i) => (
                            <li key={i} style={{ fontSize: 12, color: d.startsWith("+") ? "var(--live)" : d.startsWith("−") ? "var(--danger)" : "var(--muted)", listStyle: "none", marginLeft: -16 }}>{d}</li>
                          ))}
                          {c.extra > 0 && <li style={{ fontSize: 12, color: "var(--muted)", listStyle: "none", marginLeft: -16 }}>…and {c.extra} more</li>}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <div style={{ display: "flex", gap: 10, marginTop: 16, justifyContent: "flex-end" }}>
                <button className="admin-btn" onClick={() => setReviewOpen(false)}>Keep editing</button>
                {changes.length > 0 && (
                  <button className="admin-btn primary" disabled={saving || !!reviewDrift} onClick={async () => { await saveConfig(); setReviewOpen(false); }} title={reviewDrift ? "Refresh first — another admin deployed since you loaded" : undefined}>
                    <Save size={15} /> {saving ? "Deploying…" : "Looks good — Deploy"}
                  </button>
                )}
              </div>
            </div>
          </>
        );
      })()}

      {/* User X-Ray Modal */}
      {selectedUser && (
        <>
          <div className="notif-backdrop" onClick={() => setSelectedUser(null)} style={{ zIndex: 10000, backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)", background: "rgba(0,0,0,0.2)" }} />
          <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", background: "var(--card)", padding: 24, borderRadius: 16, width: "90%", maxWidth: 500, maxHeight: "85vh", overflowY: "auto", zIndex: 10001, border: "1px solid var(--border)", boxShadow: "0 10px 40px rgba(0,0,0,0.2)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h2 style={{ margin: 0, fontSize: 18, display: "flex", gap: 8, alignItems: "center" }}><Users size={18} color="var(--violet)" /> User Information</h2>
              <button onClick={() => setSelectedUser(null)} style={{ background: "transparent", border: "none", color: "var(--muted)", cursor: "pointer" }}><XCircle size={18} /></button>
            </div>
            
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
                 <div style={{ flex: 1, minWidth: 0 }}>
                    <strong style={{ color: "var(--muted)", fontSize: 12, display: "block", textTransform: "uppercase" }}>Name</strong>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{selectedUser.name}</div>
                 </div>
                 {selectedUser.email && (
                 <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <strong style={{ color: "var(--muted)", fontSize: 12, display: "block", textTransform: "uppercase" }}>Email</strong>
                    <div style={{ fontSize: 13 }}>{selectedUser.email}</div>
                 </div>
                 )}
              </div>
              
              <div style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
                 <div style={{ flex: 1, minWidth: 0 }}>
                    <strong style={{ color: "var(--muted)", fontSize: 12, display: "block", textTransform: "uppercase" }}>User ID</strong>
                    <div style={{ fontSize: 13, wordBreak: "break-all", color: "var(--text)" }}>{selectedUser.user_id}</div>
                 </div>
                 <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <strong style={{ color: "var(--muted)", fontSize: 12, display: "block", textTransform: "uppercase" }}>Last Active</strong>
                    <div style={{ fontSize: 13, whiteSpace: "nowrap" }}>
                      {selectedUser.last_seen_at ? new Date(selectedUser.last_seen_at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "Never"}
                    </div>
                 </div>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
                 <div style={{ flex: 1, minWidth: 0 }}>
                    <strong style={{ color: "var(--muted)", fontSize: 12, display: "block", textTransform: "uppercase" }}>Section</strong>
                    <div style={{ fontSize: 13 }}>
                      {(() => { const keys = Object.keys(selectedUser.courses || {}); if (keys.some(c => c.endsWith("_A"))) return "A"; if (keys.some(c => c.endsWith("_B"))) return "B"; return "—"; })()}
                    </div>
                 </div>
                 <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <strong style={{ color: "var(--muted)", fontSize: 12, display: "block", textTransform: "uppercase" }}>Push</strong>
                    <div style={{ fontSize: 13 }}>
                      {(pushSubscribersList || []).includes(selectedUser.user_id) ? <span style={{ color: "var(--live)" }}>Subscribed</span> : <span style={{ color: "var(--muted)" }}>Not subscribed</span>}
                    </div>
                 </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 4 }}>
                 <strong style={{ color: "var(--muted)", fontSize: 12, textTransform: "uppercase" }}>Role:</strong>
                 <select className="admin-input" value={flags.adminRoles?.[selectedUser.user_id] || "user"} onChange={e => {
                    const role = e.target.value;
                    const nextRoles = { ...(flags.adminRoles || {}) };
                    if (role === "user") delete nextRoles[selectedUser.user_id];
                    else nextRoles[selectedUser.user_id] = role;
                    setFlags({...flags, adminRoles: nextRoles});
                 }} style={{ padding: "4px 8px", fontSize: 12, flex: 1 }}>
                    <option value="user">Standard User</option>
                    <option value="monitor">Monitor (Read-only Admin)</option>
                    <option value="superadmin">Superadmin</option>
                 </select>
              </div>
              <div>
                <strong style={{ color: "var(--muted)", fontSize: 12, display: "block", textTransform: "uppercase", marginBottom: 4 }}>Enrolled Subjects</strong>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {selectedUser.courses ? Object.keys(selectedUser.courses).filter(c => !c.startsWith("_")).map(c => (
                    <span key={c} style={{ background: "var(--bg)", padding: "2px 8px", borderRadius: 4, fontSize: 12, border: "1px solid var(--border)", color: "var(--text)" }}>{c}</span>
                  )) : <span style={{ fontSize: 12, color: "var(--muted)" }}>No subjects enrolled.</span>}
                </div>
              </div>
              
              <div>
                 <strong style={{ color: "var(--muted)", fontSize: 12, display: "block", textTransform: "uppercase", marginBottom: 4 }}>Admin Notes</strong>
                 <textarea 
                    className="admin-input" 
                    placeholder="Private notes about this user..."
                    value={flags.adminNotes?.[selectedUser.user_id] || ""}
                    onChange={e => {
                       const val = e.target.value;
                       setFlags({
                          ...flags, 
                          adminNotes: { ...(flags.adminNotes || {}), [selectedUser.user_id]: val }
                       });
                    }}
                    style={{ width: "100%", minHeight: 60, padding: 8, fontSize: 12 }}
                 />
              </div>

              <div>
                 <strong style={{ color: "var(--muted)", fontSize: 12, display: "block", textTransform: "uppercase", marginBottom: 4 }}>Recent Activity</strong>
                 <div style={{ maxHeight: 120, overflowY: "auto", fontSize: 11, background: "var(--bg)", padding: 8, borderRadius: 8, border: "1px solid var(--border)" }}>
                    {auditLogs.filter(l => l.details?.target_user === selectedUser.user_id).length > 0 ? (
                       auditLogs.filter(l => l.details?.target_user === selectedUser.user_id).map(l => (
                          <div key={l.id} style={{ marginBottom: 4, borderBottom: "1px solid var(--border)", paddingBottom: 4 }}>
                             <span style={{ color: "var(--muted)" }}>{new Date(l.created_at).toLocaleDateString()}</span> - {l.action}
                          </div>
                       ))
                    ) : (
                       <div style={{ color: "var(--muted)" }}>No recent admin actions recorded.</div>
                    )}
                 </div>
              </div>

              <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--border)", display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button onClick={() => { setViewAsUser(selectedUser); setSelectedUser(null); }} className="admin-btn outline" style={{ flex: "1 1 140px", justifyContent: "center", display: "flex", alignItems: "center", gap: 8 }}>
                  <VenetianMask size={16} /> View as
                </button>
                <button onClick={async () => {
                   const msg = prompt(`Send a direct push notification to ${selectedUser.name}:`);
                   if (!msg) return;
                   const res = await pushToUserIds([selectedUser.user_id], { title: "Message from Admin", body: msg.trim() });
                   if (res?.ok) { await logAdminAction(admin_id, "direct_push", { target_user: selectedUser.user_id }); alert("Push delivered."); }
                   else alert("Failed to send push.");
                }} className="admin-btn outline" style={{ flex: "1 1 140px", justifyContent: "center", display: "flex", alignItems: "center", gap: 8 }}>
                  <BellRing size={16} /> Direct Push
                </button>
                {selectedUser.courses?._status && new Date(selectedUser.courses._status.until).getTime() > LOAD_NOW && (
                  <button onClick={async () => {
                     if (confirm(`Clear active status for ${selectedUser.name}?`)) {
                        const updated = { ...selectedUser.courses };
                        delete updated._status;
                        await supabase.from("profiles").update({ courses: updated }).eq("user_id", selectedUser.user_id);
                        await logAdminAction(admin_id, "clear_user_status", { target_user: selectedUser.user_id });
                        setAllUsers(allUsers.map(u => u.user_id === selectedUser.user_id ? { ...u, courses: updated } : u));
                        setSelectedUser({ ...selectedUser, courses: updated });
                     }
                  }} className="admin-btn outline" style={{ flex: "1 1 140px", justifyContent: "center", display: "flex", alignItems: "center", gap: 8, color: "var(--amber)", borderColor: "var(--amber)" }}>
                    <Shield size={16} /> Clear Status
                  </button>
                )}
                <button onClick={async () => {
                  if (flags.adminRoles && flags.adminRoles[admin_id] === "monitor") return alert("You don't have permission to reset user setups.");
                  if (typedConfirm("RESET", `Reset ${selectedUser.name || "this user"}'s setup? They will have to onboard again.`)) {
                    await supabase.from("profiles").update({ courses: null }).eq("user_id", selectedUser.user_id);
                    await logAdminAction(admin_id, "reset_user_setup", { target_user: selectedUser.user_id });
                    setAllUsers(allUsers.map(u => u.user_id === selectedUser.user_id ? { ...u, courses: null } : u));
                    setSelectedUser(null);
                    alert("User setup cleared.");
                  }
                }} className="admin-btn outline" style={{ color: "var(--danger)", borderColor: "var(--danger)", width: "100%", justifyContent: "center", display: "flex", alignItems: "center", gap: 8 }}>
                  <Trash2 size={16} /> Reset Setup
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* View-as (read-only impersonation) — renders a user's day + enabled features as they'd see them */}
      {viewAsUser && (() => {
        const courseKeys = Object.keys(viewAsUser.courses || {}).filter(c => !c.startsWith("_"));
        // Build per-course section map: { SCM: "A", MPB: "B", WAI: "All" }
        const courseSectionMap = {};
        courseKeys.forEach(k => {
          const base = k.replace(/_[AB]$/, "");
          const rawVal = viewAsUser.courses[k];
          const sec = k.endsWith("_A") ? "A" : k.endsWith("_B") ? "B" : (rawVal === "A" || rawVal === "B" ? rawVal : "All");
          courseSectionMap[base] = sec;
        });
        const baseCodes = new Set(Object.keys(courseSectionMap));

        // Schedule for selected date
        const overridesForDate = flags.classOverrides?.[viewAsDate] || {};
        const userClasses = liveSchedule
          .filter(c => c.date === viewAsDate && c.type !== "break")
          .filter(c => baseCodes.has(c.code))
          .filter(c => {
            const userSec = courseSectionMap[c.code];
            return !c.section || c.section === "All" || c.section === "Single" || !userSec || userSec === "All" || c.section === userSec;
          })
          .map(c => {
            const ov = lookupOverride(overridesForDate, c);
            return { ...c, cancelled: ov?.type === "cancelled", room: ov?.room || c.room, start: ov?.start || c.start, end: ov?.end || c.end };
          })
          .sort((a, b) => (a.start || "").localeCompare(b.start || ""));

        // Clash detector: find pairs with overlapping times
        const toMin = t => { if (!t) return 0; const [h, m] = t.split(":").map(Number); return h * 60 + m; };
        const clashingIndices = new Set();
        for (let i = 0; i < userClasses.length; i++) {
          for (let j = i + 1; j < userClasses.length; j++) {
            const a = userClasses[i], b = userClasses[j];
            if (!a.cancelled && !b.cancelled && toMin(a.start) < toMin(b.end) && toMin(b.start) < toMin(a.end)) {
              clashingIndices.add(i); clashingIndices.add(j);
            }
          }
        }

        // Upcoming exams (next 30 days from today)
        const todayISO = new Date().toISOString().split("T")[0];
        const cutoff = new Date(); cutoff.setDate(cutoff.getDate() + 30);
        const cutoffISO = cutoff.toISOString().split("T")[0];
        const upcomingExams = liveSchedule
          .filter(c => c.type === "exam" && c.date >= todayISO && c.date <= cutoffISO)
          .filter(c => !c.code || baseCodes.has(c.code))
          .sort((a, b) => a.date.localeCompare(b.date))
          .slice(0, 6);

        // Dropped courses
        const droppedCodes = viewAsUser.courses?._droppedCodes || [];

        // Profile completeness
        const hasPush = (pushSubscribersList || []).includes(viewAsUser.user_id);
        const hasName = !!(viewAsUser.name && viewAsUser.name !== "Student");
        const hasAvatar = !!viewAsUser.courses?._imageUrl;
        const hasSetup = courseKeys.length > 0;
        const completenessItems = [
          { label: "Setup done", ok: hasSetup },
          { label: "Name set", ok: hasName },
          { label: "Avatar", ok: hasAvatar },
          { label: "Push on", ok: hasPush },
        ];
        const completenessScore = completenessItems.filter(x => x.ok).length;

        // Last setup change
        const lastChange = viewAsUser.updated_at
          ? new Date(viewAsUser.updated_at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
          : null;

        const featureState = FEATURE_FLAGS.map(f => ({ label: f.label, on: flags[f.key] !== false }));
        const SEC_COLOR = { A: "var(--blue)", B: "var(--violet)", All: "var(--muted)", Single: "var(--muted)" };
        const todayStr = new Date().toISOString().split("T")[0];

        return (
          <>
            <div className="notif-backdrop" onClick={() => setViewAsUser(null)} style={{ zIndex: 10000 }} />
            <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", background: "var(--card)", padding: 24, borderRadius: 16, width: "90%", maxWidth: 480, maxHeight: "88vh", overflowY: "auto", zIndex: 10001, border: "1px solid var(--border)", boxShadow: "0 10px 40px rgba(0,0,0,0.25)" }}>

              {/* Header */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                <h2 style={{ margin: 0, fontSize: 18, display: "flex", gap: 8, alignItems: "center" }}><VenetianMask size={18} color="var(--violet)" /> Viewing as {viewAsUser.name || "user"}</h2>
                <button onClick={() => setViewAsUser(null)} style={{ background: "transparent", border: "none", color: "var(--muted)", cursor: "pointer" }}><XCircle size={18} /></button>
              </div>
              <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 16, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                <span>Read-only preview</span>
                <span>·</span>
                <span>{baseCodes.size} subject(s)</span>
                {lastChange && <><span>·</span><span title="Last setup change">Updated {lastChange}</span></>}
              </div>

              {/* Profile completeness */}
              <div style={{ marginBottom: 16, padding: "10px 14px", background: "var(--bg)", borderRadius: 10, border: "1px solid var(--border)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>Profile completeness</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: completenessScore === completenessItems.length ? "var(--live)" : "var(--orange)" }}>{completenessScore}/{completenessItems.length}</span>
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {completenessItems.map(item => (
                    <span key={item.label} style={{ fontSize: 11, padding: "2px 8px", borderRadius: 20, border: "1px solid var(--border)", background: item.ok ? "rgba(31,169,113,0.1)" : "rgba(220,53,69,0.08)", color: item.ok ? "var(--live)" : "var(--danger)" }}>
                      {item.ok ? "✓" : "✕"} {item.label}
                    </span>
                  ))}
                </div>
              </div>

              {/* Enrolled subjects with section badges */}
              <strong style={{ color: "var(--muted)", fontSize: 12, display: "block", textTransform: "uppercase", marginBottom: 8 }}>Enrolled subjects</strong>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
                {Object.entries(courseSectionMap).map(([code, sec]) => (
                  <span key={code} style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, padding: "3px 8px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg)" }}>
                    {code}
                    <span style={{ fontSize: 10, fontWeight: 700, color: SEC_COLOR[sec] || "var(--muted)", background: "var(--card)", borderRadius: 4, padding: "1px 5px", border: `1px solid ${SEC_COLOR[sec] || "var(--border)"}` }}>{sec}</span>
                  </span>
                ))}
                {baseCodes.size === 0 && <span style={{ fontSize: 12, color: "var(--muted)" }}>No subjects enrolled.</span>}
              </div>

              {/* Dropped courses */}
              {droppedCodes.length > 0 && (
                <>
                  <strong style={{ color: "var(--muted)", fontSize: 12, display: "block", textTransform: "uppercase", marginBottom: 6 }}>Dropped courses</strong>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
                    {droppedCodes.map(code => (
                      <span key={code} style={{ fontSize: 12, padding: "3px 8px", borderRadius: 6, border: "1px solid var(--danger)", background: "rgba(220,53,69,0.07)", color: "var(--danger)", textDecoration: "line-through" }}>{code}</span>
                    ))}
                  </div>
                </>
              )}

              {/* Schedule with date picker */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8, gap: 8, flexWrap: "wrap" }}>
                <strong style={{ color: "var(--muted)", fontSize: 12, textTransform: "uppercase", display: "flex", alignItems: "center", gap: 8 }}>
                  Schedule
                  {clashingIndices.size > 0 && (
                    <span style={{ fontSize: 10, background: "rgba(220,53,69,0.12)", color: "var(--danger)", padding: "2px 7px", borderRadius: 10, fontWeight: 700 }}>
                      ⚠ {Math.floor(clashingIndices.size / 2)} clash{Math.floor(clashingIndices.size / 2) > 1 ? "es" : ""}
                    </span>
                  )}
                </strong>
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <button onClick={() => { const d = new Date(viewAsDate); d.setDate(d.getDate() - 1); setViewAsDate(d.toISOString().split("T")[0]); }} style={{ background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 6, padding: "3px 9px", cursor: "pointer", color: "var(--text)", fontSize: 15, lineHeight: 1 }}>‹</button>
                  <input type="date" value={viewAsDate} onChange={e => setViewAsDate(e.target.value)} style={{ padding: "3px 8px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)", fontSize: 12, cursor: "pointer" }} />
                  <button onClick={() => { const d = new Date(viewAsDate); d.setDate(d.getDate() + 1); setViewAsDate(d.toISOString().split("T")[0]); }} style={{ background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 6, padding: "3px 9px", cursor: "pointer", color: "var(--text)", fontSize: 15, lineHeight: 1 }}>›</button>
                  {viewAsDate !== todayStr && (
                    <button onClick={() => setViewAsDate(todayStr)} style={{ background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 6, padding: "3px 8px", cursor: "pointer", color: "var(--muted)", fontSize: 11 }}>Today</button>
                  )}
                </div>
              </div>
              {userClasses.length === 0 ? (
                <div className="admin-empty" style={{ marginBottom: 16 }}>No classes on {viewAsDate} for this student.</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 16 }}>
                  {userClasses.map((c, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 8, padding: "8px 12px", background: clashingIndices.has(i) ? "rgba(220,53,69,0.06)" : "var(--bg)", borderRadius: 8, border: `1px solid ${clashingIndices.has(i) ? "var(--danger)" : "var(--border)"}`, opacity: c.cancelled ? 0.55 : 1 }}>
                      <span style={{ fontWeight: 600, fontSize: 13, textDecoration: c.cancelled ? "line-through" : "none", display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap" }}>
                        {c.code}
                        {c.section && c.section !== "All" && c.section !== "Single" && (
                          <span style={{ fontSize: 10, fontWeight: 700, color: SEC_COLOR[c.section] || "var(--muted)", background: "var(--card)", borderRadius: 4, padding: "1px 4px", border: `1px solid ${SEC_COLOR[c.section] || "var(--border)"}` }}>{c.section}</span>
                        )}
                        {c.room && <span style={{ fontWeight: 400, color: "var(--muted)", fontSize: 12 }}>· {c.room}</span>}
                        {clashingIndices.has(i) && <span style={{ fontSize: 10, color: "var(--danger)", fontWeight: 700 }}>⚠ clash</span>}
                      </span>
                      <span style={{ fontSize: 12, color: c.cancelled ? "var(--danger)" : "var(--muted)", whiteSpace: "nowrap" }}>{c.cancelled ? "Cancelled" : `${c.start || "?"}–${c.end || "?"}`}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Upcoming exams */}
              {upcomingExams.length > 0 && (
                <>
                  <strong style={{ color: "var(--muted)", fontSize: 12, display: "block", textTransform: "uppercase", marginBottom: 6 }}>Upcoming exams (next 30 days)</strong>
                  <div style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: 16 }}>
                    {upcomingExams.map((c, i) => (
                      <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 8, padding: "6px 12px", background: "var(--bg)", borderRadius: 8, border: "1px solid var(--border)" }}>
                        <span style={{ fontWeight: 600, fontSize: 12 }}>{c.name || c.code || "Exam"}</span>
                        <span style={{ fontSize: 11, color: "var(--muted)", whiteSpace: "nowrap" }}>{c.date}{c.start ? ` · ${c.start}` : ""}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* Features */}
              <strong style={{ color: "var(--muted)", fontSize: 12, display: "block", textTransform: "uppercase", marginBottom: 8 }}>Features they can see</strong>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {featureState.map(f => (
                  <span key={f.label} style={{ fontSize: 12, padding: "3px 10px", borderRadius: 20, border: "1px solid var(--border)", background: f.on ? "rgba(31,169,113,0.12)" : "var(--bg)", color: f.on ? "var(--live)" : "var(--muted)" }}>
                    {f.on ? "✓" : "✕"} {f.label}
                  </span>
                ))}
              </div>
            </div>
          </>
        );
      })()}

      {/* Live Editor Modal — uses controlled React state, no document.getElementById */}
      {liveEditorModal && (
        <>
          <div className="notif-backdrop" onClick={() => setLiveEditorModal(null)} style={{ zIndex: 10000 }} />
          <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", background: "var(--card)", padding: 24, borderRadius: 16, width: "90%", maxWidth: 400, maxHeight: "85vh", overflowY: "auto", zIndex: 10001, border: "1px solid var(--border)", boxShadow: "0 10px 40px rgba(0,0,0,0.2)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h2 style={{ margin: 0, fontSize: 18, display: "flex", gap: 8, alignItems: "center" }}><CalendarDays size={18} color="var(--blue)" /> Edit Class</h2>
              <button onClick={() => setLiveEditorModal(null)} style={{ background: "transparent", border: "none", color: "var(--muted)", cursor: "pointer" }}><XCircle size={18} /></button>
            </div>

            <div style={{ marginBottom: 16 }}>
              {modalIsNew ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <div className="admin-field">
                    <label>Course Code</label>
                    <input type="text" className="admin-input" value={modalCode} onChange={e => setModalCode(e.target.value)} placeholder="e.g. WAI" />
                  </div>
                  <div className="admin-field">
                    <label>Title</label>
                    <input type="text" className="admin-input" value={modalName} onChange={e => setModalName(e.target.value)} placeholder="e.g. WAI End Term" />
                  </div>
                </div>
              ) : (
                <>
                  <div style={{ fontWeight: 700, color: "var(--text)" }}>{liveEditorModal.code} — {liveEditorModal.name || "Class"}</div>
                  <div style={{ color: "var(--muted)", fontSize: 13 }}>{liveEditorModal.date} | {liveEditorModal.start} – {liveEditorModal.end} | Section {liveEditorModal.section}</div>
                </>
              )}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {/* Section selector — pill buttons */}
              <div className="admin-field">
                <label>Apply to Section</label>
                <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                  {[["A", "Section A"], ["B", "Section B"], ["All", "Both"]].map(([val, label]) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setModalSection(val)}
                      style={{
                        flex: 1,
                        padding: "8px 0",
                        borderRadius: 8,
                        border: `2px solid ${modalSection === val ? "var(--blue)" : "var(--border)"}`,
                        background: modalSection === val ? "color-mix(in srgb, var(--blue) 12%, transparent)" : "var(--bg)",
                        color: modalSection === val ? "var(--blue)" : "var(--muted)",
                        fontWeight: modalSection === val ? 700 : 500,
                        fontSize: 13,
                        cursor: "pointer",
                        transition: "all 0.15s",
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Cancel button */}
              <button onClick={() => {
                const ident = classIdent(liveEditorModal);
                const overrideKey = makeOverrideKey(ident, modalSection);
                const nextOverrides = { ...(flags.classOverrides || {}) };
                nextOverrides[liveEditorModal.date] = { ...(nextOverrides[liveEditorModal.date] || {}) };
                // "All Sections" must supersede any per-section override, otherwise the
                // section-specific key shadows the bare-code key in the reader/preview.
                if (modalSection === "All") {
                  delete nextOverrides[liveEditorModal.date][`${ident}_A`];
                  delete nextOverrides[liveEditorModal.date][`${ident}_B`];
                }
                nextOverrides[liveEditorModal.date][overrideKey] = { type: "cancelled", name: `Cancelled: ${liveEditorModal.name || ident}`, modifiedAt: new Date().toISOString(), modifiedBy: admin_id };
                setFlags({ ...flags, classOverrides: nextOverrides });
                logAdminAction(admin_id, "cancel_class", { date: liveEditorModal.date, class: overrideKey });
                setLiveEditorModal(null);
              }} className="admin-btn outline" style={{ color: "var(--danger)", borderColor: "var(--danger)" }}>
                <Ban size={16} /> Cancel Class
              </button>

              {/* Mark as Exam toggle */}
              {(() => {
                const ident = classIdent(liveEditorModal);
                const overrideKey = makeOverrideKey(ident, modalSection);
                const existing = flags.classOverrides?.[liveEditorModal.date]?.[overrideKey];
                const isExamOverride = existing?.type === "exam";
                return (
                  <button onClick={() => {
                    const nextOverrides = { ...(flags.classOverrides || {}) };
                    nextOverrides[liveEditorModal.date] = { ...(nextOverrides[liveEditorModal.date] || {}) };
                    if (isExamOverride) {
                      // Remove only the exam type flag, keep other overrides intact
                      const rest = { ...existing };
                      delete rest.type;
                      if (Object.keys(rest).length === 0) {
                        delete nextOverrides[liveEditorModal.date][overrideKey];
                        if (Object.keys(nextOverrides[liveEditorModal.date]).length === 0) delete nextOverrides[liveEditorModal.date];
                      } else {
                        nextOverrides[liveEditorModal.date][overrideKey] = rest;
                      }
                      logAdminAction(admin_id, "clear_exam_flag", { date: liveEditorModal.date, class: overrideKey });
                    } else {
                      // "All Sections" must supersede any per-section override.
                      if (modalSection === "All") {
                        delete nextOverrides[liveEditorModal.date][`${ident}_A`];
                        delete nextOverrides[liveEditorModal.date][`${ident}_B`];
                      }
                      nextOverrides[liveEditorModal.date][overrideKey] = { ...existing, type: "exam" };
                      logAdminAction(admin_id, "mark_as_exam", { date: liveEditorModal.date, class: overrideKey });
                    }
                    setFlags({ ...flags, classOverrides: nextOverrides });
                    setLiveEditorModal(null);
                  }} className="admin-btn outline" style={{ color: isExamOverride ? "var(--warning)" : "var(--violet)", borderColor: isExamOverride ? "var(--warning)" : "var(--violet)" }}>
                    <GraduationCap size={16} /> {isExamOverride ? "Remove Exam Flag" : "Mark as Exam"}
                  </button>
                );
              })()}

              {/* Time range */}
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <div className="admin-field" style={{ flex: 1 }}>
                  <label>New Start</label>
                  <input type="time" className="admin-input" value={modalStart} onChange={e => setModalStart(e.target.value)} />
                </div>
                <span style={{ color: "var(--muted)", marginTop: 22 }}>–</span>
                <div className="admin-field" style={{ flex: 1 }}>
                  <label>New End</label>
                  <input type="time" className="admin-input" value={modalEnd} onChange={e => setModalEnd(e.target.value)} />
                </div>
              </div>

              {/* Room + Save */}
              <div className="admin-field">
                <label>New Room</label>
                <div style={{ display: "flex", gap: 8 }}>
                  <input type="text" placeholder="e.g. C-104" className="admin-input" style={{ flex: 1 }} value={modalRoom} onChange={e => setModalRoom(e.target.value)} />
                  <button onClick={() => {
                    // New classes use the typed code; existing rows use their
                    // identity (code, or name for code-less exam entries).
                    const codeToUse = modalIsNew ? modalCode : classIdent(liveEditorModal);
                    if (modalIsNew && !codeToUse) return alert("Course Code is required.");
                    else {
                      const originalSection = liveEditorModal.section === "Single" ? "All" : (liveEditorModal.section || "All");
                      const sectionChanged = modalSection !== originalSection;
                      if (!modalRoom && !modalStart && !modalEnd && !sectionChanged) return alert("Enter at least one change (section, room, start, or end time).");
                    }
                    const overrideKey = makeOverrideKey(codeToUse, modalSection);
                    const nextOverrides = { ...(flags.classOverrides || {}) };
                    nextOverrides[liveEditorModal.date] = { ...(nextOverrides[liveEditorModal.date] || {}) };
                    // "All Sections" must supersede any per-section override, otherwise the
                    // section-specific key shadows the bare-code key in the reader/preview.
                    if (modalSection === "All" && !modalIsNew) {
                      delete nextOverrides[liveEditorModal.date][`${codeToUse}_A`];
                      delete nextOverrides[liveEditorModal.date][`${codeToUse}_B`];
                    }
                    const existing = nextOverrides[liveEditorModal.date][overrideKey] || {};
                    const changes = { ...existing };
                    if (modalRoom)  changes.room  = modalRoom;
                    if (modalStart) changes.start = modalStart;
                    if (modalEnd)   changes.end   = modalEnd;
                    if (modalIsNew) {
                      changes.name = modalName;
                      changes.type = "class"; // base type, can be marked as exam later
                    }
                    changes.modifiedAt = new Date().toISOString();
                    changes.modifiedBy = admin_id;
                    nextOverrides[liveEditorModal.date][overrideKey] = changes;
                    setFlags({ ...flags, classOverrides: nextOverrides });
                    logAdminAction(admin_id, "edit_class", { date: liveEditorModal.date, class: overrideKey, room: modalRoom, start: modalStart, end: modalEnd, name: modalName });
                    setLiveEditorModal(null);
                  }} className="admin-btn primary">Save</button>
                </div>
              </div>

              {/* Remove existing override */}
              {lookupOverride(flags.classOverrides?.[liveEditorModal.date], liveEditorModal) && (
                <button onClick={() => {
                  const ident = classIdent(liveEditorModal);
                  const nextOverrides = { ...(flags.classOverrides || {}) };
                  nextOverrides[liveEditorModal.date] = { ...nextOverrides[liveEditorModal.date] };
                  delete nextOverrides[liveEditorModal.date][ident];
                  delete nextOverrides[liveEditorModal.date][`${ident}_${liveEditorModal.section}`];
                  if (Object.keys(nextOverrides[liveEditorModal.date]).length === 0) delete nextOverrides[liveEditorModal.date];
                  setFlags({ ...flags, classOverrides: nextOverrides });
                  logAdminAction(admin_id, "clear_override", { date: liveEditorModal.date, class: ident });
                  setLiveEditorModal(null);
                }} className="admin-btn outline" style={{ marginTop: 4 }}>
                  <Trash2 size={16} /> Remove Override
                </button>
              )}
            </div>
          </div>
        </>
      )}

      {activeUsersListModalOpen && (
        <AdminModal title={`Active Users Today (${activeUsers})`} onClose={() => setActiveUsersListModalOpen(false)} width={640}>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
            <select value={activeUsersSort} onChange={e => setActiveUsersSort(e.target.value)} className="admin-input" style={{ width: "auto", fontSize: 12.5, padding: "6px 10px" }}>
              <option value="recent">Sort: Most recent</option>
              <option value="oldest">Sort: Oldest first</option>
              <option value="name">Sort: Name (A-Z)</option>
            </select>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {allUsers
              .filter(u => u.last_seen_at && new Date(u.last_seen_at).getTime() >= new Date().setHours(0,0,0,0))
              .sort((a, b) => {
                if (activeUsersSort === "name") return (a.name || "").localeCompare(b.name || "");
                const ta = new Date(a.last_seen_at).getTime();
                const tb = new Date(b.last_seen_at).getTime();
                return activeUsersSort === "oldest" ? ta - tb : tb - ta;
              })
              .map(u => (
              <div key={u.user_id} style={{ background: "var(--card)", padding: "12px", borderRadius: 8, border: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }} onClick={() => { setSelectedUser(u); setActiveUsersListModalOpen(false); }}>
                <div style={{ fontWeight: 600 }}>{u.name}</div>
                <div style={{ fontSize: 12, color: "var(--muted)" }}>{new Date(u.last_seen_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
              </div>
            ))}
          </div>
        </AdminModal>
      )}

      {pushSubscribersModalOpen && (
        <AdminModal title={`Push Subscribers (${pushSubCount})`} onClose={() => setPushSubscribersModalOpen(false)} width={500}>
          {pushSubscribersList.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {allUsers.filter(u => pushSubscribersList.includes(u.user_id)).map(u => (
                <div key={u.user_id} style={{ background: "var(--card)", padding: "12px", borderRadius: 8, border: "1px solid var(--border)", cursor: "pointer" }} onClick={() => { setSelectedUser(u); setPushSubscribersModalOpen(false); }}>
                  <div style={{ fontWeight: 600 }}>{u.name}</div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ color: "var(--muted)", textAlign: "center", padding: 24, background: "var(--card)", borderRadius: 12 }}>
              <p style={{ margin: 0 }}>The push subscriber list requires a database update.</p>
              <p style={{ fontSize: 13, marginTop: 8 }}>Run the updated <code>get_admin_stats</code> SQL migration in Supabase to fetch user IDs securely.</p>
            </div>
          )}
        </AdminModal>
      )}

      <AdminCommandPalette 
         isOpen={isCommandPaletteOpen}
         onClose={() => setIsCommandPaletteOpen(false)}
         allUsers={allUsers}
         flags={flags}
         auditLogs={auditLogs}
         onUserSelect={(u) => {
            setSelectedUser(u);
            setIsCommandPaletteOpen(false);
         }}
         onFlagSelect={(fKey) => {
            if (typeof flags[fKey] === 'boolean') {
               setFlags({ ...flags, [fKey]: !flags[fKey] });
            }
            setIsCommandPaletteOpen(false);
         }}
      />
    </div>
  );
}
