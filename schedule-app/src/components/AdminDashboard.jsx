import { useState, useEffect, useRef } from "react";
import "../styles/admin.css";
import "../styles/assignments.css";
import "../styles/cmdk.css";
import { Users, Megaphone, Flag, Save, Trash2, ShieldAlert, Check, Search, RefreshCw, AlertTriangle, CalendarDays, XCircle, VenetianMask, Ban, Terminal, Clock, Database, FileText, X, BellRing, Sparkles, Pencil, BarChart2, UtensilsCrossed, GraduationCap, MessageSquare, CloudOff } from "lucide-react";
import { supabase } from "../lib/supabase";
// NOTE: `xlsx` is ~322 KB. It is only needed when an admin actually uploads a
// mess-menu spreadsheet, so it is dynamically imported inside handleExcelUpload
// rather than statically here — this keeps it out of the dashboard chunk.
import { logAdminAction } from "../lib/adminAudit.js";
import { LEGEND } from "../data/schedule.js";
import { BASE_MENU } from "../data/messMenu.js";
import snapshotMeta from "../data/snapshot-meta.json";
import { getSnapshot } from "../lib/sheet.js";
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
  { key: "enableAds", label: "Campus Board Ads" },
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


// Mess Menu Editor — meal slots as stored in data/messMenu.js
const MESS_MEALS = [
  { key: "breakfast", label: "Breakfast Mains", hint: "Daily items (bread, cornflakes, sprouts, egg, fruits, beverages) are appended automatically." },
  { key: "lunch", label: "Lunch" },
  { key: "snacksW13", label: "Snacks — Week 1 & 3" },
  { key: "snacksW24", label: "Snacks — Week 2 & 4", hint: "Leave empty to serve the Week 1 & 3 snacks on those weeks too." },
  { key: "dinner", label: "Dinner" },
];
// Date#getDay() indices in Monday-first display order
const MESS_DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
const MESS_DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function Avatar({ name, email }) {
  const init = name ? name[0] : (email ? email[0] : "?");
  return <div className="admin-avatar">{init.toUpperCase()}</div>;
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
    enableAds: true,
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
  const [selfTest, setSelfTest] = useState(null); // aggregated self-test result
  const [selfTesting, setSelfTesting] = useState(false);
  const [tplLabel, setTplLabel] = useState(""); // new announcement-template name

  // Software Update Config
  const [updatePromptTitle, setUpdatePromptTitle] = useState("");
  const [updatePromptDesc, setUpdatePromptDesc] = useState("");
  const [updatePromptHighlights, setUpdatePromptHighlights] = useState("");

  // Feedback Flash Config
  const [feedbackFlashes, setFeedbackFlashes] = useState([]);
  const [previewFlashId, setPreviewFlashId] = useState(null);
  // Minute tick so flash status badges/countdowns stay current while the page sits open
  const [flashNow, setFlashNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setFlashNow(Date.now()), 60000);
    return () => clearInterval(t);
  }, []);

  // Live Editor State
  const [liveSchedule] = useState(() => getSnapshot().CLASSES || []);
  const [liveEditorDate, setLiveEditorDate] = useState(new Date().toISOString().split("T")[0]);
  const [liveEditorModal, setLiveEditorModal] = useState(null);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);

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

  // A/B Test editor
  const [abTestName, setAbTestName] = useState("");
  const [abTestRollout, setAbTestRollout] = useState(50);

  // Mess Menu Editor — drafts hold only meals the admin has typed in; anything
  // else falls through to the staged override (flags) or the bundled menu.
  const [messEditDay, setMessEditDay] = useState(() => new Date().getDay());
  const [messDrafts, setMessDrafts] = useState({});

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
          supabase.from("profiles").select("user_id, courses, last_seen_at, updated_at"),
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

  async function saveConfig() {
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
      let error = null, conflicted = false;
      if (loadedUpdatedAt) {
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
        // Fetch who/when so the admin knows what they'd have overwritten.
        const { data: cur } = await supabase
          .from("system_config").select("updated_at").eq("id", "global").single();
        const when = cur?.updated_at ? new Date(cur.updated_at).toLocaleTimeString() : "just now";
        setSaveMsg(`⚠ Another admin deployed at ${when}. Your changes were NOT saved — refresh the dashboard and re-apply.`);
      } else if (error) {
        setSaveMsg("Failed: " + error.message);
      } else {
        // Show success immediately; the audit entry is secondary and now compact
        // (storing the whole flags blob here was slow and bloated admin_audit_logs).
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
      const key = c.section && c.section !== "All" && c.section !== "Single" ? `${c.code}_${c.section}` : c.code;
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
      const key = c.section && c.section !== "All" && c.section !== "Single" ? `${c.code}_${c.section}` : c.code;
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
    setFlags({ ...flags, announcementTemplates: (flags.announcementTemplates || []).filter(t => t.id !== id) });
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
    const messDays = Object.keys(flags.messMenuOverrides || {}).length;
    const announcements = (flags.scheduledAnnouncements || []).length;
    const quickLinks = (flags.quickLinks || []).length;
    const total = overrideClasses + messDays + announcements + quickLinks;
    return { overrideDays, overrideClasses, messDays, announcements, quickLinks, total };
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

  // ── Mess Menu Editor helpers ─────────────────────────────────
  // Textarea value: unsaved draft → staged override → bundled default
  const messMealText = (meal) => {
    if (messDrafts[meal] !== undefined) return messDrafts[meal];
    const staged = flags.messMenuOverrides?.[messEditDay]?.[meal];
    return (staged ?? BASE_MENU[messEditDay][meal] ?? []).join("\n");
  };

  const stageMessMenuEdits = () => {
    const dayOverride = {};
    MESS_MEALS.forEach(({ key }) => {
      const items = messMealText(key).split("\n").map(s => s.trim()).filter(Boolean);
      // Only store meals that differ from the bundled menu
      if (JSON.stringify(items) !== JSON.stringify(BASE_MENU[messEditDay][key] ?? [])) {
        dayOverride[key] = items;
      }
    });
    const next = { ...(flags.messMenuOverrides || {}) };
    if (Object.keys(dayOverride).length === 0) delete next[messEditDay];
    else next[messEditDay] = dayOverride;
    setFlags({ ...flags, messMenuOverrides: next });
    setMessDrafts({});
    logAdminAction(admin_id, "edit_mess_menu", { day: MESS_DAY_NAMES[messEditDay], meals: Object.keys(dayOverride) });
  };

  const resetMessMenuDay = () => {
    if (!window.confirm(`Reset ${MESS_DAY_NAMES[messEditDay]} to the bundled menu (discard the override)?`)) return;
    const next = { ...(flags.messMenuOverrides || {}) };
    delete next[messEditDay];
    setFlags({ ...flags, messMenuOverrides: next });
    setMessDrafts({});
    logAdminAction(admin_id, "reset_mess_menu_day", { day: MESS_DAY_NAMES[messEditDay] });
  };

  const handleExcelUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const XLSX = await import("xlsx");
        const data = new Uint8Array(evt.target.result);
        const workbook = XLSX.read(data, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        
        const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 });
        if (jsonData.length < 20) throw new Error("Excel file doesn't have enough rows.");

        const newOverrides = {};
        const colToDayIndex = { 2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 7: 6, 8: 0 };
        const getCellStr = (row, col) => {
           const val = jsonData[row]?.[col];
           return val ? String(val).trim().replace(/\n/g, "") : "";
        };

        for (let col = 2; col <= 8; col++) {
           const dayIdx = colToDayIndex[col];
           const dayMeals = { breakfast: [], lunch: [], snacksW13: [], snacksW24: [], dinner: [] };

           const bMain = getCellStr(3, col);
           const bExtra = getCellStr(4, col);
           if (bMain) dayMeals.breakfast.push(bMain);
           if (bExtra) dayMeals.breakfast.push(...bExtra.split('+').map(s => s.trim()).filter(Boolean));

           for (let r = 6; r <= 11; r++) {
              const item = getCellStr(r, col);
              if (item) dayMeals.lunch.push(item);
           }

           const sW13 = getCellStr(13, col);
           const sW24 = getCellStr(14, col);
           const sBev = getCellStr(15, col);
           
           if (sW13) dayMeals.snacksW13.push(sW13);
           if (sW13 && sBev) dayMeals.snacksW13.push(sBev);
           if (sW24) {
              dayMeals.snacksW24.push(sW24);
              if (sBev) dayMeals.snacksW24.push(sBev);
           }

           for (let r = 17; r <= 23; r++) {
              const item = getCellStr(r, col);
              if (item) dayMeals.dinner.push(item);
           }
           newOverrides[dayIdx] = dayMeals;
        }

        // Diff vs currently staged/deployed overrides so the admin sees what changes.
        const cur = flags.messMenuOverrides || {};
        const changedDays = [];
        for (let d = 0; d <= 6; d++) {
          if (!(d in newOverrides)) continue;
          if (JSON.stringify(newOverrides[d]) !== JSON.stringify(cur[d] ?? null)) changedDays.push(d);
        }
        const summary = changedDays.length === 0
          ? "No differences vs the current menu."
          : `Changes on: ${changedDays.map(d => MESS_DAY_NAMES[d] || d).join(", ")}`;
        if (!confirm(`Parsed ${file.name}.\n${summary}\n\nStage this menu (${changedDays.length} day(s) changed)? Deploy to apply.`)) {
          e.target.value = null;
          return;
        }
        setFlags({ ...flags, messMenuOverrides: newOverrides });
        setMessDrafts({});
        logAdminAction(admin_id, "upload_mess_menu_excel", { changedDays: changedDays.length });
        alert("Menu staged! Please deploy to cloud to apply.");
      } catch (err) {
        console.error("Excel parse error", err);
        alert("Failed to parse Excel file: " + err.message);
      }
      e.target.value = null;
    };
    reader.readAsArrayBuffer(file);
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
    <div className="admin-page">

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

        <div style={{ display: "flex", gap: 24, justifyContent: "center", flexWrap: "wrap" }}>
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
          { id: "broadcast", label: "Broadcast", Icon: Megaphone },
          { id: "schedule", label: "Schedule", Icon: CalendarDays },
          { id: "users", label: "Users", Icon: Users },
          { id: "insights", label: "Insights", Icon: BarChart2 },
          { id: "system", label: "System", Icon: ShieldAlert },
        ].map(({ id, label, Icon }) => (
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
          </button>
        ))}
      </nav>

      {/* ── Card flow: 2-col masonry ≥1200px, single column below ── */}
      <div className="admin-masonry" data-active-tab={activeTab}>



          {/* Interactive Live Schedule Editor */}
          <section className="admin-card admin-span-all admin-g-schedule" style={{ gridColumn: "1 / -1" }}>
            <h2><CalendarDays size={20} color="var(--blue)" /> Live Schedule Editor</h2>
            <p className="admin-subtext">Click on a class slot to visually change the room or cancel the class.</p>
            <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
              <input type="date" className="admin-input" value={liveEditorDate} onChange={e => setLiveEditorDate(e.target.value)} style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)" }} />
              <button 
                className="admin-btn primary"
                onClick={() => openLiveEditorModal({ date: liveEditorDate, code: "", name: "", type: "class", section: "All" }, true)}
              >
                + Add Class
              </button>
            </div>
            <div style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 16 }}>
              {(() => {
                const baseClasses = liveSchedule.filter(c => c.date === liveEditorDate && c.type !== "break");
                const newClasses = [];
                const overridesForDate = flags.classOverrides?.[liveEditorDate] || {};
                
                Object.keys(overridesForDate).forEach(key => {
                  const codeParts = key.split('_');
                  const code = codeParts[0];
                  const section = codeParts[1] || "All";
                  const exists = baseClasses.some(c => c.code === code && (c.section === section || section === "All" || c.section === "Single"));
                  
                  if (!exists) {
                    const ovr = overridesForDate[key];
                    if (ovr.type !== "cancelled") {
                      newClasses.push({
                        date: liveEditorDate,
                        code: code,
                        section: section,
                        name: ovr.name || "Custom Added Class",
                        room: ovr.room || "",
                        start: ovr.start || "",
                        end: ovr.end || "",
                        type: ovr.type || "class"
                      });
                    }
                  }
                });
                
                // Chronological order — raw data lists Sec A, then Sec B, then
                // Single-section/guest classes, which buries them off-screen
                const displayClasses = [...baseClasses, ...newClasses]
                  .sort((a, b) => (a.start || "").localeCompare(b.start || "") || (a.code || "").localeCompare(b.code || ""));
                
                // --- CONFLICT DETECTOR ---
                const conflicts = [];
                function toMinFP(t) { const [h, m] = t.split(":").map(Number); return h * 60 + (m || 0); }
                
                for (let i = 0; i < displayClasses.length; i++) {
                  for (let j = i + 1; j < displayClasses.length; j++) {
                    const c1 = displayClasses[i];
                    const c2 = displayClasses[j];
                    
                    const ovr1 = overridesForDate[`${c1.code}_${c1.section}`] || overridesForDate[c1.code];
                    const ovr2 = overridesForDate[`${c2.code}_${c2.section}`] || overridesForDate[c2.code];
                    
                    if (ovr1?.type === "cancelled" || ovr2?.type === "cancelled") continue;
                    
                    const room1 = ovr1?.room || c1.room;
                    const room2 = ovr2?.room || c2.room;
                    
                    const start1 = toMinFP(ovr1?.start || c1.start || "00:00");
                    const end1 = toMinFP(ovr1?.end || c1.end || "00:00");
                    const start2 = toMinFP(ovr2?.start || c2.start || "00:00");
                    const end2 = toMinFP(ovr2?.end || c2.end || "00:00");

                    // Overlap logic: start1 < end2 && start2 < end1
                    const isTimeOverlap = start1 < end2 && start2 < end1;
                    
                    if (isTimeOverlap) {
                      if (room1 && room2 && room1.toLowerCase() === room2.toLowerCase() && room1.toLowerCase() !== "tbd") {
                        conflicts.push(`Room Double-Booked: ${room1} (${c1.code} and ${c2.code})`);
                      } else if (c1.section === c2.section || c1.section === "All" || c2.section === "All") {
                        conflicts.push(`Section Overlap: Section ${c1.section === "All" ? c2.section : c1.section} expected in ${c1.code} and ${c2.code} simultaneously.`);
                      }
                    }
                  }
                }
                // -------------------------

                if (displayClasses.length === 0) {
                  return <div className="admin-empty">No classes found for this date.</div>;
                }
                
                const classElements = displayClasses.map((c, i) => {
                  const override = overridesForDate[`${c.code}_${c.section}`] || overridesForDate[c.code] || null;
                  const isCancelled = override?.type === "cancelled";
                  const isGuest = (c.session || "").toLowerCase().includes("guest");
                  const displayRoom = override?.room || c.room;
                  const displayStart = override?.start || c.start;
                  const displayEnd = override?.end || c.end;
                  return (
                    <div key={i} onClick={() => openLiveEditorModal(c)} style={{ minWidth: 200, padding: 12, background: "var(--bg)", border: `1px solid ${isGuest ? "var(--violet)" : "var(--border)"}`, borderRadius: 12, cursor: "pointer", position: "relative", opacity: isCancelled ? 0.6 : 1 }}>
                      <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 4, textDecoration: isCancelled ? "line-through" : "none" }}>
                        {displayStart} - {displayEnd} | Sec: {c.section === "Single" ? "All" : c.section}
                        {isGuest && <span style={{ marginLeft: 6, background: "var(--violet)", color: "#fff", padding: "1px 6px", borderRadius: 4, fontSize: 9.5, fontWeight: 800, letterSpacing: ".03em" }}>GUEST</span>}
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)", marginBottom: 4, textDecoration: isCancelled ? "line-through" : "none" }}>{c.code} - {c.name || "Class"}</div>
                      <div style={{ fontSize: 12, color: "var(--muted)", textDecoration: isCancelled ? "line-through" : "none" }}>Room: {displayRoom || "TBD"}</div>
                      {override && <div style={{ position: "absolute", top: -6, right: -6, background: "var(--amber)", color: "#000", padding: "2px 6px", borderRadius: 4, fontSize: 10, fontWeight: 800 }}>OVERRIDDEN</div>}
                    </div>
                  );
                });
                
                return (
                  <div style={{ display: "flex", flexDirection: "column", gap: 16, width: "100%" }}>
                    {conflicts.length > 0 && (
                       <div style={{ background: "rgba(231, 76, 60, 0.1)", border: "1px solid var(--danger)", padding: 12, borderRadius: 8, color: "var(--danger)" }}>
                         <strong style={{ display: "flex", alignItems: "center", gap: 8 }}><AlertTriangle size={16} /> Conflict Warning</strong>
                         <ul style={{ margin: "8px 0 0 0", paddingLeft: 20, fontSize: 13 }}>
                           {Array.from(new Set(conflicts)).map((c, idx) => <li key={idx}>{c}</li>)}
                         </ul>
                       </div>
                    )}
                    <div style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 8, WebkitOverflowScrolling: "touch" }}>
                       {classElements}
                    </div>
                  </div>
                );
              })()}
            </div>
          </section>

          {/* Class Cancellation Board */}
          <section className="admin-card admin-span-all admin-g-schedule" style={{ gridColumn: "1 / -1" }}>
            <h2><XCircle size={20} color="var(--danger)" /> Class Cancellation Board</h2>
            <p className="admin-subtext">Globally cancel a class for all students on a specific date. Pick a date, then cancel directly from that day's schedule. Changes go live after "Deploy Config to Cloud".</p>
            <div className="admin-field" style={{ maxWidth: 220 }}>
              <label>Date</label>
              <input type="date" className="admin-input" value={overrideDate} onChange={e => setOverrideDate(e.target.value)} />
            </div>
            {overrideDate && (() => {
              const overridesForDate = flags.classOverrides?.[overrideDate] || {};
              const dayClasses = liveSchedule
                .filter(c => c.date === overrideDate && c.type !== "break")
                .sort((a, b) => (a.start || "").localeCompare(b.start || "") || (a.code || "").localeCompare(b.code || ""));
              if (dayClasses.length === 0) {
                return <div className="admin-empty" style={{ padding: "20px 0" }}>No classes scheduled on this date. Use manual entry below if needed.</div>;
              }
              return (
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
                  {dayClasses.map((c, i) => {
                    const sectionKey = `${c.code}_${c.section}`;
                    const isCancelled = overridesForDate[c.code]?.type === "cancelled" || overridesForDate[sectionKey]?.type === "cancelled";
                    return (
                      <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 10, padding: "10px 14px", opacity: isCancelled ? 0.65 : 1 }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)", textDecoration: isCancelled ? "line-through" : "none" }}>
                            {c.code} — {c.name || LEGEND[c.code]?.name || "Class"}
                            {isCancelled && <span style={{ marginLeft: 8, background: "var(--danger)", color: "#fff", padding: "1px 7px", borderRadius: 4, fontSize: 10, fontWeight: 800, letterSpacing: ".04em", textDecoration: "none", display: "inline-block" }}>CANCELLED</span>}
                          </div>
                          <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
                            {c.start} - {c.end} · Sec: {c.section === "Single" ? "All" : c.section} · Room: {c.room || "TBD"}
                          </div>
                        </div>
                        {isCancelled ? (
                          <button className="admin-btn outline" onClick={() => restoreClass(overrideDate, c.code, c.section)} style={{ flex: "0 0 auto", padding: "7px 14px", fontSize: 13 }}>
                            <RefreshCw size={14} /> Restore
                          </button>
                        ) : (
                          <button className="admin-btn outline" onClick={() => cancelClass(overrideDate, c.code, c.section)} style={{ flex: "0 0 auto", padding: "7px 14px", fontSize: 13, borderColor: "var(--danger)", color: "var(--danger)" }}>
                            <XCircle size={14} /> Cancel
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })()}
            
            {overrideDate && (
              <div style={{ marginTop: 12 }}>
                 <button className="admin-btn danger outline" onClick={() => {
                    const dayClasses = liveSchedule.filter(c => c.date === overrideDate && c.type !== "break");
                    if (dayClasses.length === 0) return alert("No classes to cancel on this date.");
                    if (!window.confirm(`Mark all ${dayClasses.length} classes on ${overrideDate} as cancelled (Holiday)?`)) return;
                    
                    const next = {...flags.classOverrides};
                    if (!next[overrideDate]) next[overrideDate] = {};
                    dayClasses.forEach(c => {
                       const sectionKey = c.section === "Single" ? c.code : `${c.code}_${c.section}`;
                       next[overrideDate][sectionKey] = { type: "cancelled" };
                    });
                    setFlags({...flags, classOverrides: next});
                 }} style={{ padding: "8px 16px" }}>
                    <XCircle size={15} /> Mark Entire Day as Holiday (Cancel All)
                 </button>
              </div>
            )}
            
            <details style={{ marginTop: 14 }}>
              <summary style={{ fontSize: 13, color: "var(--muted)", cursor: "pointer", fontWeight: 600 }}>Manual entry (class not listed?)</summary>
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

          {/* Active Overrides List */}
          {flags.classOverrides && Object.keys(flags.classOverrides).length > 0 && (
            <section className="admin-card admin-span-all admin-g-schedule" style={{ gridColumn: "1 / -1" }}>
              <h2>Active Class Overrides</h2>
              {staleOverrideDates.length > 0 && (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", padding: "10px 14px", background: "rgba(245,158,11,0.08)", border: "1px solid var(--amber)", borderRadius: 10, marginTop: 8 }}>
                  <span style={{ fontSize: 13 }}><AlertTriangle size={15} color="var(--amber)" style={{ verticalAlign: "middle", marginRight: 6 }} />{staleOverrideDates.length} override date(s) are in the past and can never apply again — students still download them.</span>
                  <button className="admin-btn outline" onClick={purgeStaleOverrides} style={{ borderColor: "var(--amber)", color: "var(--amber)" }}><Trash2 size={14} /> Purge expired</button>
                </div>
              )}
              <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 8 }}>
                {Object.entries(flags.classOverrides).map(([date, classes]) => 
                  Object.keys(classes).map(code => {
                    const override = classes[code];
                    const isCancelled = override.type === "cancelled";
                    const isRoomChanged = !!override.room;
                    const isTimeChanged = !!override.start || !!override.end;
                    const isModified = isRoomChanged || isTimeChanged;
                    const codeParts = code.split('_');
                    const displayCode = codeParts.length > 1 ? `${codeParts[0]} (Sec ${codeParts[1]})` : code;

                    return (
                      <div key={`${date}-${code}`} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(0,0,0,0.03)", padding: "12px 16px", borderRadius: 8, border: "1px solid var(--border)" }}>
                        <div style={{ minWidth: 0 }}>
                          <span style={{ fontWeight: 600, fontSize: 14 }}>
                            {new Date(date).toLocaleDateString()} — {displayCode}
                            {isCancelled && <span style={{ color: "var(--danger)", marginLeft: 8 }}>(Cancelled)</span>}
                            {isModified && !isCancelled && (
                              <span style={{ color: "var(--blue)", marginLeft: 8 }}>
                                ({[override.room && `Room: ${override.room}`, (override.start || override.end) && `${override.start || "?"} - ${override.end || "?"}`].filter(Boolean).join(" | ")})
                              </span>
                            )}
                          </span>
                          {override.modifiedAt && (
                            <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 3 }}>
                              Modified {new Date(override.modifiedAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}{override.modifiedBy ? ` · ${allUsers.find(u => u.user_id === override.modifiedBy)?.name || "admin"}` : ""}
                            </div>
                          )}
                        </div>
                        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                          {isModified && (
                            <button onClick={() => {
                               setRoomOverrideDate(date);
                               setRoomOverrideClass(codeParts[0]);
                               setRoomOverrideSection(codeParts[1] || "All");
                               setRoomOverrideRoom(override.room || "");
                               setRoomOverrideStart(override.start || "");
                               setRoomOverrideEnd(override.end || "");
                            }} style={{ background: "transparent", border: "none", cursor: "pointer", fontSize: 13, color: "var(--blue)", fontWeight: 600, padding: "4px 8px" }}>
                               Edit
                            </button>
                          )}
                          <button onClick={() => {
                             const prev = flags.classOverrides;
                             const next = {...prev};
                             next[date] = { ...next[date] };
                             delete next[date][code];
                             if (Object.keys(next[date]).length === 0) delete next[date];
                             setFlags({...flags, classOverrides: next});
                             removeWithUndo(`Override removed — ${displayCode}`, () => setFlags(f => ({ ...f, classOverrides: prev })));
                          }} style={{ background: "transparent", border: "none", cursor: "pointer", display: "flex", alignItems: "center", padding: 4 }}>
                             <Trash2 size={16} color="var(--danger)" />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </section>
          )}
        <section className="admin-card admin-g-broadcast" style={{ display: "flex", flexDirection: "column" }}>
          <h2><Megaphone size={20} color="var(--amber)" /> Scheduled Announcements</h2>
          <p className="admin-subtext">Schedule targeted announcements. Active ones will appear as banners to matched users.</p>

          {/* Template library — reusable announcement presets stored in config */}
          {(flags.announcementTemplates || []).length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
              {(flags.announcementTemplates || []).map(t => (
                <span key={t.id} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 20, padding: "4px 6px 4px 12px", fontSize: 12 }}>
                  <button type="button" onClick={() => applyAnnouncementTemplate(t)} title={t.text} style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--text)", fontWeight: 600, padding: 0 }}>{t.label}</button>
                  <button type="button" onClick={() => removeAnnouncementTemplate(t.id)} title="Delete template" style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--danger)", display: "flex", padding: 0 }}><X size={13} /></button>
                </span>
              ))}
            </div>
          )}

          <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
            <input type="date" value={announcementStart} onChange={e => setAnnouncementStart(e.target.value)} className="admin-input" style={{ flex: "1 1 130px", padding: "8px", borderRadius: 8, border: "1px solid var(--border)" }} title="Start Date" />
            <input type="date" value={announcementEnd} onChange={e => setAnnouncementEnd(e.target.value)} className="admin-input" style={{ flex: "1 1 130px", padding: "8px", borderRadius: 8, border: "1px solid var(--border)" }} title="End Date (Inclusive)" />
            <select className="admin-input" value={announcementTarget} onChange={e => setAnnouncementTarget(e.target.value)} style={{ flex: "2 1 200px", padding: "8px", borderRadius: 8, border: "1px solid var(--border)" }}>
              <option value="global">Global</option>
              <option value="section_A">Section A</option>
              <option value="section_B">Section B</option>
              <option value="has_friends">Social Users</option>
              <optgroup label="Subject Wise">
                {Object.entries(LEGEND || {}).map(([code]) => (
                  <option key={code} value={`subject_${code}`}>{code}</option>
                ))}
              </optgroup>
            </select>
            <select className="admin-input" value={announcementSeverity} onChange={e => setAnnouncementSeverity(e.target.value)} style={{ flex: "1 1 120px", padding: "8px", borderRadius: 8, border: "1px solid var(--border)" }} title="Banner severity / colour">
              <option value="info">Info</option>
              <option value="warning">Warning</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>
          {(() => { const n = audienceCount(announcementTarget); return (
            <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
              <Users size={13} /> Audience: {n === null ? "varies per user — can't estimate client-side" : `~${n} user${n === 1 ? "" : "s"}`}
            </div>
          ); })()}
          <textarea
            className="admin-textarea"
            value={announcement}
            onChange={e => setAnnouncement(e.target.value)}
            placeholder="e.g., Exam registration closes tomorrow!"
          />
          {announcement.trim() && (
             <div style={{ marginTop: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                   <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".05em", textTransform: "uppercase", color: "var(--muted)" }}>Student preview</span>
                   <button type="button" onClick={() => setPreviewTheme(previewTheme === "dark" ? "light" : "dark")} style={{ background: "transparent", border: "1px solid var(--border)", borderRadius: 8, padding: "3px 10px", fontSize: 11, fontWeight: 600, color: "var(--text)", cursor: "pointer" }}>
                      {previewTheme === "dark" ? "Dark" : "Light"} mode
                   </button>
                </div>
                {/* Mirrors the real banner in App.jsx (severity-coloured, dismissible) */}
                {(() => {
                  const bg = announcementSeverity === "urgent" ? "var(--danger)" : announcementSeverity === "info" ? "var(--violet)" : "var(--amber)";
                  const fg = announcementSeverity === "warning" ? "#000" : "#fff";
                  return (
                    <div style={{ padding: 16, borderRadius: 12, border: "1px solid var(--border)", background: previewTheme === "dark" ? "#101216" : "#F3F1EA" }}>
                       <div style={{ background: bg, color: fg, padding: "12px 16px", borderRadius: 8, display: "flex", gap: 8, alignItems: "center", fontWeight: 600 }}>
                          <Megaphone size={18} style={{ flexShrink: 0 }} />
                          <span style={{ fontSize: 14, flex: 1 }}>{announcement}</span>
                          <X size={16} style={{ flexShrink: 0 }} />
                       </div>
                    </div>
                  );
                })()}
             </div>
          )}
          <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap", alignItems: "center" }}>
            <button className="admin-btn primary" onClick={() => {
              if (!announcement || !announcementStart || !announcementEnd) return alert("Please fill message and dates.");
              const newItem = { id: Date.now().toString(), message: announcement, target: announcementTarget, start: announcementStart, end: announcementEnd, severity: announcementSeverity };
              setFlags({...flags, scheduledAnnouncements: [...(flags.scheduledAnnouncements || []), newItem]});
              setAnnouncement(""); setAnnouncementStart(""); setAnnouncementEnd(""); setAnnouncementSeverity("info");
            }}>
              Add Scheduled Announcement
            </button>
            <input className="admin-input" value={tplLabel} onChange={e => setTplLabel(e.target.value)} placeholder="Template name" style={{ flex: "1 1 140px", maxWidth: 200 }} />
            <button className="admin-btn outline" onClick={saveAnnouncementTemplate} disabled={!announcement.trim() || !tplLabel.trim()} title="Save the current message + severity as a reusable template"><Save size={14} /> Save as template</button>
          </div>

          {announcementOverlaps.length > 0 && (
            <div style={{ marginTop: 16, padding: "10px 14px", background: "rgba(245,158,11,0.08)", border: "1px solid var(--amber)", borderRadius: 10 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--amber)", display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}><AlertTriangle size={15} /> {announcementOverlaps.length} overlapping announcement(s)</div>
              {announcementOverlaps.map((c, i) => (
                <div key={i} style={{ fontSize: 12, color: "var(--muted)", marginBottom: 2 }}>
                  “{(c.a.message || "").slice(0, 28)}” &amp; “{(c.b.message || "").slice(0, 28)}” both show to {c.a.target === "global" || c.b.target === "global" ? "everyone" : c.a.target} on overlapping dates.
                </div>
              ))}
            </div>
          )}

          <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 8 }}>
            {(flags.scheduledAnnouncements || []).map(a => (
              <div key={a.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: "var(--bg)", borderRadius: 8, border: "1px solid var(--border)" }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{a.message}</div>
                  <div style={{ fontSize: 11, color: "var(--muted)" }}>Target: {a.target} | {a.start} to {a.end}</div>
                </div>
                <button onClick={() => {
                  const prev = flags.scheduledAnnouncements;
                  setFlags({...flags, scheduledAnnouncements: prev.filter(x => x.id !== a.id)});
                  removeWithUndo("Announcement removed", () => setFlags(f => ({ ...f, scheduledAnnouncements: prev })));
                }} className="admin-btn outline" style={{ padding: "4px 8px", borderColor: "var(--danger)", color: "var(--danger)" }}><Trash2 size={14} /></button>
              </div>
            ))}
          </div>
        </section>

          {/* Push Notification Broadcast */}
          <section className="admin-card admin-g-broadcast" style={{ display: "flex", flexDirection: "column" }}>
            <h2><BellRing size={20} color="var(--live)" /> Push Notifications</h2>
            <p className="admin-subtext">Send a push notification to every device that enabled push on the Announcements page. Delivered even when the app is closed.</p>

            {/* Saved templates — reusable presets stored in config */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center", marginBottom: 10 }}>
              {(flags.pushTemplates || []).map(t => (
                <span key={t.id} style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 20, padding: "3px 4px 3px 10px", fontSize: 12 }}>
                  <button type="button" onClick={() => { setPushTitle(t.title || ""); setPushBody(t.body || ""); setPushUrl(t.url || ""); }} style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--text)", fontWeight: 600 }} title="Apply this template">{t.title || "(untitled)"}</button>
                  <button type="button" onClick={() => setFlags({ ...flags, pushTemplates: (flags.pushTemplates || []).filter(x => x.id !== t.id) })} style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--muted)", display: "flex" }} aria-label="Delete template"><X size={12} /></button>
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
                <label>Open URL (optional)</label>
                <input className="admin-input" value={pushUrl} onChange={e => setPushUrl(e.target.value)} placeholder="/?view=today" />
              </div>
            </div>
            <div className="admin-field">
              <label>Message</label>
              <textarea className="admin-textarea" value={pushBody} onChange={e => setPushBody(e.target.value)} placeholder="e.g. Today's 11:30 FIN-201 class moved to Room C-104." rows={2} maxLength={200}></textarea>
            </div>
            <div className="admin-field-row" style={{ marginTop: 8 }}>
               <div className="admin-field">
                 <label>Schedule Date (Optional)</label>
                 <input type="date" className="admin-input" value={pushScheduleDate} onChange={e => setPushScheduleDate(e.target.value)} />
               </div>
               <div className="admin-field">
                 <label>Schedule Time (Optional)</label>
                 <input type="time" className="admin-input" value={pushScheduleTime} onChange={e => setPushScheduleTime(e.target.value)} />
               </div>
            </div>

            <div className="admin-field" style={{ marginTop: 8 }}>
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
                  <span key={sa.id} style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "var(--bg)", border: `1px solid ${pushTarget === sa.target ? "var(--live)" : "var(--border)"}`, borderRadius: 20, padding: "3px 4px 3px 10px", fontSize: 12 }}>
                    <button type="button" onClick={() => setPushTarget(sa.target)} title={sa.target} style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--text)", fontWeight: 600 }}>★ {sa.label}</button>
                    <button type="button" onClick={() => setFlags({ ...flags, savedAudiences: (flags.savedAudiences || []).filter(x => x.id !== sa.id) })} style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--muted)", display: "flex" }} aria-label="Delete saved audience"><X size={12} /></button>
                  </span>
                ))}
                <button type="button" className="admin-btn outline" style={{ fontSize: 11, padding: "4px 10px" }} onClick={saveCurrentAudience} disabled={pushTarget === "all"}>+ Save current audience</button>
              </div>
            </div>

            <PushPreview title={pushTitle} body={pushBody} url={pushUrl} when={pushScheduleDate && pushScheduleTime ? `${pushScheduleDate} · ${pushScheduleTime}` : "now"} />

            <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 12, flexWrap: "wrap" }}>
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

            {flags.scheduledPushes && flags.scheduledPushes.length > 0 && (
               <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 8 }}>
                  <label style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>Queued Pushes</label>
                  {flags.scheduledPushes.map(p => (
                     <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: "var(--bg)", borderRadius: 8, border: "1px solid var(--border)" }}>
                       <div>
                         <div style={{ fontSize: 13, fontWeight: 600 }}>{p.title}</div>
                         <div style={{ fontSize: 11, color: "var(--muted)" }}>Scheduled for {p.date} at {p.time}</div>
                       </div>
                       <button onClick={() => {
                         const prev = flags.scheduledPushes;
                         setFlags({...flags, scheduledPushes: prev.filter(x => x.id !== p.id)});
                         removeWithUndo("Queued push removed", () => setFlags(f => ({ ...f, scheduledPushes: prev })));
                       }} className="admin-btn outline" style={{ padding: "4px 8px", borderColor: "var(--danger)", color: "var(--danger)" }}><Trash2 size={14} /></button>
                     </div>
                  ))}
               </div>
            )}
          </section>

          {/* Push Delivery Analytics */}
          <section className="admin-card admin-g-broadcast" style={{ display: "flex", flexDirection: "column" }}>
            <h2><BarChart2 size={20} color="var(--live)" /> Push Delivery Analytics</h2>
            <p className="admin-subtext">How recent broadcasts actually landed: sent → delivered (push shown) → opened (read).</p>
            {pushStats === null ? (
              <div className="admin-empty">Needs the <code>get_push_broadcast_stats</code> RPC (migration 20260731120000) deployed.</div>
            ) : pushStats.length === 0 ? (
              <div className="admin-empty">No broadcasts sent yet.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {pushStats.slice(0, 8).map(s => {
                  const dPct = s.total ? Math.round((s.delivered / s.total) * 100) : 0;
                  const oPct = s.total ? Math.round((s.opened / s.total) * 100) : 0;
                  return (
                    <div key={s.dedup_key} style={{ padding: "10px 12px", background: "var(--bg)", borderRadius: 10, border: "1px solid var(--border)" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 6 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.title || "(no title)"}</span>
                        <span style={{ fontSize: 11, color: "var(--muted)", whiteSpace: "nowrap" }}>{new Date(s.sent_at).toLocaleDateString()}</span>
                      </div>
                      <div style={{ display: "flex", gap: 16, fontSize: 12 }}>
                        <span title="Users the broadcast was queued for"><b>{s.total}</b> sent</span>
                        <span style={{ color: "var(--blue)" }} title="Push actually delivered to a device"><b>{s.delivered}</b> delivered ({dPct}%)</span>
                        <span style={{ color: "var(--live)" }} title="Marked read in the inbox"><b>{s.opened}</b> opened ({oPct}%)</span>
                      </div>
                      <div style={{ height: 6, background: "var(--card)", borderRadius: 3, overflow: "hidden", border: "1px solid var(--border)", marginTop: 6, position: "relative" }}>
                        <div style={{ position: "absolute", inset: 0, width: `${dPct}%`, background: "var(--blue)", opacity: 0.35 }} />
                        <div style={{ position: "absolute", inset: 0, width: `${oPct}%`, background: "var(--live)" }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Broadcast agenda — every scheduled push/announcement/deploy on one timeline */}
          <section className="admin-card admin-g-broadcast" style={{ display: "flex", flexDirection: "column" }}>
            <h2><Clock size={20} color="var(--live)" /> Scheduled Timeline</h2>
            <p className="admin-subtext">Everything queued to fire — pushes, announcements, config deploys and quick links — in one calendar so you can catch collisions or spam bursts before they hit.</p>
            {broadcastAgenda.length === 0 ? (
              <div className="admin-empty">Nothing scheduled. Queued pushes, announcements &amp; deploys will appear here.</div>
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
          </section>

          {/* Quiet hours guard */}
          <section className="admin-card admin-g-broadcast" style={{ display: "flex", flexDirection: "column" }}>
            <h2><CloudOff size={20} color="var(--violet)" /> Quiet Hours</h2>
            <p className="admin-subtext">Warn before a broadcast fires during a do-not-disturb window (IST), so nobody gets a 2am buzz. Deploy Config to save the window.</p>
            <label className="admin-flag-item" style={{ marginBottom: 10 }}>
              <input type="checkbox" checked={!!quietHours.enabled} onChange={e => setFlags({ ...flags, quietHours: { ...quietHours, enabled: e.target.checked } })} />
              <span>Guard broadcasts during quiet hours</span>
            </label>
            <div className="admin-field-row" style={{ alignItems: "flex-end", opacity: quietHours.enabled ? 1 : 0.5 }}>
              <div className="admin-field"><label>From</label><input type="time" className="admin-input" value={quietHours.start || "23:00"} disabled={!quietHours.enabled} onChange={e => setFlags({ ...flags, quietHours: { ...quietHours, start: e.target.value } })} /></div>
              <div className="admin-field"><label>To</label><input type="time" className="admin-input" value={quietHours.end || "07:00"} disabled={!quietHours.enabled} onChange={e => setFlags({ ...flags, quietHours: { ...quietHours, end: e.target.value } })} /></div>
            </div>
            {quietHours.enabled && (() => { const q = inQuietHours(flashNow); return (
              <div style={{ fontSize: 12, marginTop: 8, color: q ? "var(--danger)" : "var(--muted)", display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: q ? "var(--danger)" : "var(--live)" }} />
                {q ? "Currently within quiet hours — broadcasts will prompt a warning." : "Outside quiet hours — broadcasts send normally."}
              </div>
            ); })()}
          </section>

          {/* What's New — feature updates */}
          <section className="admin-card admin-g-broadcast" style={{ display: "flex", flexDirection: "column" }}>
            <h2><Sparkles size={20} color="var(--violet)" /> What&rsquo;s New (Feature Updates)</h2>
            <p className="admin-subtext">Announce new features. Students see a "NEW" pill on the Today view until they open the What&rsquo;s New list. Publish with Deploy Config to Cloud.</p>
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
              <div style={{ marginTop: 4, marginBottom: 12 }}>
                <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".05em", textTransform: "uppercase", color: "var(--muted)", display: "block", marginBottom: 8 }}>Student preview — click the pill to see the full card</span>
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

            <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
              <button className="admin-btn primary" style={{ alignSelf: "flex-start" }} onClick={() => {
                if (!wnTitle.trim()) return alert("Feature title is required.");
                if (wnEditingId) {
                  // Edit in place — keeps its original date and list position
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
                  // newest first, keep the list short — students only care about recent
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

            <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 8 }}>
              {(flags.whatsNew || []).map(w => (
                <div key={w.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "8px 12px", background: w.id === wnEditingId ? "rgba(109, 91, 208, 0.08)" : "var(--bg)", borderRadius: 8, border: `1px solid ${w.id === wnEditingId ? "var(--violet)" : "var(--border)"}` }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{w.emoji ? `${w.emoji} ` : ""}{w.title}</div>
                    <div style={{ fontSize: 11, color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{w.date}{w.desc ? ` — ${w.desc}` : ""}</div>
                  </div>
                  <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                    <button onClick={() => { setWnEmoji(w.emoji || ""); setWnTitle(w.title || ""); setWnDesc(w.desc || ""); setWnEditingId(w.id); }} className="admin-btn outline" style={{ padding: "4px 8px" }} aria-label="Edit"><Pencil size={14} /></button>
                    <button onClick={() => {
                      setFlags({ ...flags, whatsNew: flags.whatsNew.filter(x => x.id !== w.id) });
                      if (wnEditingId === w.id) { setWnEmoji(""); setWnTitle(""); setWnDesc(""); setWnEditingId(null); }
                    }} className="admin-btn outline" style={{ padding: "4px 8px", borderColor: "var(--danger)", color: "var(--danger)" }} aria-label="Delete"><Trash2 size={14} /></button>
                  </div>
                </div>
              ))}
            </div>
          </section>

        <section className="admin-card admin-g-broadcast" style={{ display: "flex", flexDirection: "column" }}>
          <h2><Flag size={20} color="var(--violet)" /> Dynamic Quick Links</h2>
          <p className="admin-subtext">Push temporary important links to the sidebar (e.g. Exam Portal).</p>
          
          <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
            <input type="text" placeholder="Link Title" value={qlTitle} onChange={e => setQlTitle(e.target.value)} className="admin-input" style={{ flex: 1, padding: "8px", borderRadius: 8, border: "1px solid var(--border)", minWidth: 150 }} />
            <input type="url" placeholder="https://..." value={qlUrl} onChange={e => setQlUrl(e.target.value)} className="admin-input" style={{ flex: 2, padding: "8px", borderRadius: 8, border: "1px solid var(--border)", minWidth: 200 }} />
          </div>
          <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
            <input type="date" value={qlStart} onChange={e => setQlStart(e.target.value)} className="admin-input" style={{ flex: "1 1 130px", padding: "8px", borderRadius: 8, border: "1px solid var(--border)" }} title="Start Date" />
            <input type="date" value={qlEnd} onChange={e => setQlEnd(e.target.value)} className="admin-input" style={{ flex: "1 1 130px", padding: "8px", borderRadius: 8, border: "1px solid var(--border)" }} title="End Date (Inclusive)" />
            <button className="admin-btn primary" style={{ flex: "1 1 130px" }} onClick={() => {
              if (!qlTitle || !qlUrl || !qlStart || !qlEnd) return alert("Fill all fields.");
              const newItem = { id: Date.now().toString(), title: qlTitle, url: qlUrl, start: qlStart, end: qlEnd };
              setFlags({...flags, quickLinks: [...(flags.quickLinks || []), newItem]});
              setQlTitle(""); setQlUrl(""); setQlStart(""); setQlEnd("");
            }}>
              Add Quick Link
            </button>
          </div>

          <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 8 }}>
            {(flags.quickLinks || []).map((ql, idx) => (
              <div key={ql.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: "var(--bg)", borderRadius: 8, border: "1px solid var(--border)" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{ql.title}</div>
                  <div style={{ fontSize: 11, color: "var(--muted)" }}>{ql.url} | {ql.start} to {ql.end}</div>
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
                  }} className="admin-btn outline" style={{ padding: "4px 8px", borderColor: "var(--danger)", color: "var(--danger)" }}><Trash2 size={14} /></button>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Feedback Flash Scheduler */}
        <section className="admin-card admin-g-broadcast">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h2><MessageSquare size={20} color="var(--amber)" /> Feedback Flash Scheduler</h2>
            <button 
              onClick={() => setFeedbackFlashes([...feedbackFlashes, { id: Date.now().toString(), enabled: false, deadline: "", link: "", subjects: [] }])} 
              className="admin-btn outline" style={{ fontSize: 12, padding: "4px 8px" }}
            >
              + Add Flash
            </button>
          </div>
          <p className="admin-sub">
            Each enabled flash nudges targeted users up to 3 times: on announce (first save), 2 hours before and 20 minutes
            before the deadline. Each nudge shows for 1 hour and users can dismiss it once per session.
          </p>

          <div className="admin-form" style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 16 }}>
            {feedbackFlashes.map((ff, index) => {
              const HOUR = 60 * 60 * 1000;
              const now = flashNow;
              const deadlineMs = ff.deadline ? new Date(ff.deadline).getTime() : null;

              const fmtAbs = ms => new Date(ms).toLocaleString([], { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
              const fmtRel = ms => {
                const diff = ms - now;
                const mins = Math.round(Math.abs(diff) / 60000);
                const txt = mins < 60 ? `${mins}m` : mins < 1440 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${Math.floor(mins / 1440)}d ${Math.floor((mins % 1440) / 60)}h`;
                return diff >= 0 ? `in ${txt}` : `${txt} ago`;
              };

              const triggers = deadlineMs ? [
                { key: "announced", name: "Announce", time: ff.announcedAt ? new Date(ff.announcedAt).getTime() : null, pendingNote: "on first save" },
                { key: "2h", name: "2h before", time: deadlineMs - 2 * HOUR },
                { key: "20m", name: "20m before", time: deadlineMs - 20 * 60 * 1000 },
              ] : [];
              const inWindow = t => t != null && now >= t && now <= t + HOUR;

              const status = !ff.enabled
                ? { label: "Draft", color: "var(--muted)", bg: "color-mix(in srgb, var(--muted) 14%, transparent)" }
                : !deadlineMs
                  ? { label: "Needs deadline", color: "var(--amber)", bg: "rgba(234, 179, 8, .14)" }
                  : now > deadlineMs
                    ? { label: "Expired", color: "var(--red)", bg: "rgba(225, 29, 72, .10)" }
                    : triggers.some(t => inWindow(t.time))
                      ? { label: "Live now", color: "var(--live)", bg: "rgba(31, 169, 113, .14)" }
                      : { label: "Scheduled", color: "var(--violet)", bg: "rgba(109, 91, 208, .12)" };

              return (
                <div key={ff.id} style={{ display: "flex", flexDirection: "column", gap: 14, padding: 18, background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 12, position: "relative", opacity: ff.enabled ? 1 : .72 }}>

                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                      <input type="checkbox" checked={ff.enabled} onChange={e => setFeedbackFlashes(feedbackFlashes.map(f => f.id === ff.id ? { ...f, enabled: e.target.checked } : f))} />
                      <span style={{ fontWeight: 600 }}>Flash #{index + 1}</span>
                    </label>
                    <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".04em", color: status.color, background: status.bg, padding: "3px 10px", borderRadius: 20 }}>
                      {status.label}
                    </span>
                    <div style={{ display: "flex", gap: 8, marginLeft: "auto" }}>
                      <button onClick={() => setPreviewFlashId(ff.id)} disabled={!ff.enabled} className="admin-btn" style={{ padding: "4px 8px", fontSize: 12 }}>
                        Preview
                      </button>
                      <button onClick={() => setFeedbackFlashes(feedbackFlashes.filter(f => f.id !== ff.id))} className="admin-btn outline" style={{ padding: "4px 8px", fontSize: 12, color: "var(--red)", borderColor: "var(--red)" }}>
                        Remove
                      </button>
                    </div>
                  </div>

                  {/* At-a-glance summary — visible even when the flash is disabled */}
                  <div style={{ fontSize: 12.5, color: "var(--muted)", lineHeight: 1.5 }}>
                    {deadlineMs ? (
                      <>
                        Deadline <strong style={{ color: "var(--text)" }}>{fmtAbs(deadlineMs)}</strong> ({fmtRel(deadlineMs)})
                        {" · "}{(ff.subjects || []).length ? `Targets ${ff.subjects.join(", ")}` : "All users"}
                        {" · "}{ff.link ? "External form" : "In-app widget"}
                      </>
                    ) : (
                      "No deadline set — this flash will never fire."
                    )}
                  </div>

                  {ff.enabled && (
                    <>
                      {deadlineMs && now > deadlineMs && (
                        <div style={{ fontSize: 12.5, color: "var(--red)", background: "rgba(225, 29, 72, .07)", border: "1px solid rgba(225, 29, 72, .18)", borderRadius: 10, padding: "8px 12px" }}>
                          Deadline has passed — users no longer see this flash. Set a new deadline to reuse it, or remove it to keep the list clean.
                        </div>
                      )}

                      {/* Trigger timeline: when users will actually see this flash */}
                      {deadlineMs && now <= deadlineMs && (
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          {triggers.map(t => {
                            const live = inWindow(t.time);
                            const fired = t.time != null && now > t.time + HOUR;
                            const color = live ? "var(--live)" : fired ? "var(--muted)" : "var(--violet)";
                            return (
                              <div key={t.key} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, fontWeight: 600, color, background: "var(--card)", border: `1px solid ${live ? "rgba(31, 169, 113, .35)" : "var(--border)"}`, borderRadius: 20, padding: "4px 10px" }}>
                                <span style={{ width: 7, height: 7, borderRadius: "50%", background: color, flexShrink: 0 }} />
                                {t.name}: {t.time == null ? t.pendingNote : live ? "live now" : fired ? "shown" : fmtRel(t.time)}
                              </div>
                            );
                          })}
                        </div>
                      )}

                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                        <div className="admin-field">
                          <label>Deadline <span className="admin-optional">(Nudges fire before this)</span></label>
                          <input type="datetime-local" className="admin-input" value={ff.deadline || ""} onChange={e => setFeedbackFlashes(feedbackFlashes.map(f => f.id === ff.id ? { ...f, deadline: e.target.value } : f))} />
                        </div>

                        <div className="admin-field">
                          <label>Form Link <span className="admin-optional">(If blank, opens in-app widget)</span></label>
                          <input type="url" className="admin-input" value={ff.link || ""} onChange={e => setFeedbackFlashes(feedbackFlashes.map(f => f.id === ff.id ? { ...f, link: e.target.value } : f))} placeholder="https://forms.gle/..." />
                        </div>
                      </div>

                      <div className="admin-field">
                        <label>Target Subjects <span className="admin-optional">(Only enrolled users are nudged. None selected = everyone)</span></label>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
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
                                style={{ padding: "4px 10px", fontSize: 12, borderRadius: 20 }}
                                title={LEGEND[code].name}
                              >
                                {code}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              );
            })}

            {feedbackFlashes.length === 0 && (
              <div style={{ padding: 24, textAlign: "center", color: "var(--muted)", background: "var(--bg)", borderRadius: 12, border: "1px dashed var(--border)" }}>
                No feedback flashes scheduled. Add one and users get nudged automatically as its deadline approaches.
              </div>
            )}
            
            <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
              <button onClick={saveConfig} disabled={saving} className="admin-btn primary">
                <Save size={16} /> Save Scheduler Config
              </button>
            </div>

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

          {/* Software Update Prompt Config */}
          <section className="admin-card admin-g-broadcast">
            <h2><RefreshCw size={20} color="var(--violet)" /> Update Prompt Text</h2>
            <p className="admin-subtext">Configure what users see when a new app version is available.</p>
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
          </section>

          {/* Mess Menu Editor */}
          <section className="admin-card admin-span-all admin-g-schedule" style={{ gridColumn: "1 / -1" }}>
            <h2><UtensilsCrossed size={20} color="var(--amber)" /> Mess Menu Editor</h2>
            <p className="admin-subtext">Edit the weekly mess menu shown on the Mess Card — one dish per line. Stage a day, then publish with "Deploy Config to Cloud".</p>

            <div style={{ marginTop: 12, display: "flex", gap: 10, alignItems: "center" }}>
              <label className="admin-btn outline" style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 16px" }}>
                <FileText size={16} /> Upload Excel Menu
                <input type="file" accept=".xlsx, .xls" onChange={handleExcelUpload} style={{ display: "none" }} />
              </label>
              <span style={{ fontSize: 12, color: "var(--muted)" }}>Automatically stages overrides for all 7 days</span>
            </div>

            {/* Day picker (Mon-first) */}
            <div style={{ display: "flex", gap: 8, marginTop: 12, marginBottom: 16, flexWrap: "wrap" }}>
              {MESS_DAY_ORDER.map(d => {
                const isOverridden = !!flags.messMenuOverrides?.[d];
                const on = d === messEditDay;
                return (
                  <button
                    key={d}
                    className={`admin-btn ${on ? "primary" : "outline"}`}
                    onClick={() => {
                      if (d === messEditDay) return;
                      if (Object.keys(messDrafts).length > 0 && !window.confirm("Discard unstaged edits on this day?")) return;
                      setMessDrafts({});
                      setMessEditDay(d);
                    }}
                    style={{ padding: "7px 14px", fontSize: 13, position: "relative" }}
                  >
                    {MESS_DAY_NAMES[d].slice(0, 3)}
                    {isOverridden && <span title="Menu overridden for this day" style={{ position: "absolute", top: -4, right: -4, width: 10, height: 10, borderRadius: "50%", background: "var(--amber)", border: "2px solid var(--card)" }} />}
                  </button>
                );
              })}
            </div>

            {flags.messMenuOverrides?.[messEditDay] && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, fontSize: 13, color: "var(--amber-text, var(--amber))", background: "var(--amber-transparent, rgba(240,180,41,0.1))", border: "1px solid var(--amber)", borderRadius: 8, padding: "8px 12px" }}>
                <AlertTriangle size={14} /> {MESS_DAY_NAMES[messEditDay]} is overridden — meals below show the overridden menu, not the bundled default.
              </div>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16 }}>
              {MESS_MEALS.map(({ key, label, hint }) => (
                <div key={key} className="admin-field" style={{ marginBottom: 0 }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    {label}
                    {flags.messMenuOverrides?.[messEditDay]?.[key] && <span style={{ background: "var(--amber)", color: "#000", padding: "1px 6px", borderRadius: 4, fontSize: 9.5, fontWeight: 800, letterSpacing: ".03em" }}>OVERRIDDEN</span>}
                  </label>
                  <textarea
                    className="admin-textarea"
                    rows={6}
                    value={messMealText(key)}
                    onChange={e => setMessDrafts({ ...messDrafts, [key]: e.target.value })}
                    placeholder="One dish per line"
                    style={{ fontSize: 13, lineHeight: 1.5 }}
                  />
                  {hint && <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>{hint}</div>}
                </div>
              ))}
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 16, flexWrap: "wrap", alignItems: "center" }}>
              <button className="admin-btn primary" onClick={stageMessMenuEdits} style={{ padding: "9px 16px" }}>
                <Check size={15} /> Stage {MESS_DAY_NAMES[messEditDay]}&apos;s Menu
              </button>
              {(flags.messMenuOverrides?.[messEditDay] || Object.keys(messDrafts).length > 0) && (
                <button className="admin-btn outline" onClick={resetMessMenuDay} style={{ padding: "9px 16px", borderColor: "var(--danger)", color: "var(--danger)" }}>
                  <RefreshCw size={15} /> Reset Day to Default
                </button>
              )}
              {Object.keys(messDrafts).length > 0 && (
                <span style={{ fontSize: 12, color: "var(--amber-text, var(--amber))", fontWeight: 600 }}>Unstaged edits — stage them, then deploy config.</span>
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
                   <button className="admin-btn outline" onClick={() => {
                      const next = [...(flags.bannedUsers || [])];
                      selectedUserIds.forEach(id => { if(!next.includes(id)) next.push(id) });
                      setFlags({...flags, bannedUsers: next});
                      setSelectedUserIds(new Set());
                   }} style={{ fontSize: 11, padding: "4px 8px", borderColor: "var(--danger)", color: "var(--danger)" }}>Ban Selected</button>
                   
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
                      <div className="admin-user-id">{u.user_id}</div>
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
                        // eslint-disable-next-line react-hooks/purity
                        const d = new Date(Date.now() - (6 - i) * 86400000);
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
              <button className="admin-btn outline" style={{ marginTop: 4 }} onClick={() => { const n = { ...flags }; delete n.maintenanceWindow; setFlags(n); }}>Clear window</button>
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
                      <button onClick={() => removeAdminRole(id)} className="admin-btn outline" style={{ padding: "4px 8px", borderColor: "var(--danger)", color: "var(--danger)" }}><Trash2 size={14} /></button>
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
                { label: "Mess overrides", n: configDrift.messDays, sub: "day(s)" },
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
                setSaveMsg("Reverted to deployed config.");
                setTimeout(() => setSaveMsg(""), 3000);
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
                 setSaveMsg("Loaded previous deploy. Deploy to apply.");
                 setTimeout(() => setSaveMsg(""), 3000);
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
                    setSaveMsg("Restored from history. Deploy to apply.");
                    setTimeout(() => setSaveMsg(""), 3000);
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
        {saveMsg && (
          <span className={`admin-save-msg ${saveMsg.includes("Failed") || saveMsg.includes("Error") ? "error" : "success"}`}>
            {saveMsg.includes("Successfully") && <Check size={16} />}
            {saveMsg}
          </span>
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
          <div className="notif-backdrop" onClick={() => setSelectedUser(null)} style={{ zIndex: 10000 }} />
          <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", background: "var(--card)", padding: 24, borderRadius: 16, width: "90%", maxWidth: 400, maxHeight: "85vh", overflowY: "auto", zIndex: 10001, border: "1px solid var(--border)", boxShadow: "0 10px 40px rgba(0,0,0,0.2)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h2 style={{ margin: 0, fontSize: 18, display: "flex", gap: 8, alignItems: "center" }}><Users size={18} color="var(--violet)" /> User Information</h2>
              <button onClick={() => setSelectedUser(null)} style={{ background: "transparent", border: "none", color: "var(--muted)", cursor: "pointer" }}><XCircle size={18} /></button>
            </div>
            
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div><strong style={{ color: "var(--muted)", fontSize: 12, display: "block", textTransform: "uppercase" }}>Name</strong>{selectedUser.name}</div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                 <div><strong style={{ color: "var(--muted)", fontSize: 12, display: "block", textTransform: "uppercase" }}>User ID</strong>{selectedUser.user_id}</div>
                 <div style={{ textAlign: "right" }}><strong style={{ color: "var(--muted)", fontSize: 12, display: "block", textTransform: "uppercase" }}>Last Active</strong>{selectedUser.last_seen_at ? new Date(selectedUser.last_seen_at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "Never"}</div>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                 <div><strong style={{ color: "var(--muted)", fontSize: 12, display: "block", textTransform: "uppercase" }}>Section</strong>{(() => { const keys = Object.keys(selectedUser.courses || {}); if (keys.some(c => c.endsWith("_A"))) return "A"; if (keys.some(c => c.endsWith("_B"))) return "B"; return "—"; })()}</div>
                 <div style={{ textAlign: "right" }}><strong style={{ color: "var(--muted)", fontSize: 12, display: "block", textTransform: "uppercase" }}>Push</strong>{(pushSubscribersList || []).includes(selectedUser.user_id) ? <span style={{ color: "var(--live)" }}>Subscribed</span> : <span style={{ color: "var(--muted)" }}>Not subscribed</span>}</div>
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

              <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--border)", display: "flex", gap: 8 }}>
                <button onClick={() => { setViewAsUser(selectedUser); setSelectedUser(null); }} className="admin-btn outline" style={{ flex: 1, justifyContent: "center", display: "flex", alignItems: "center", gap: 8 }}>
                  <VenetianMask size={16} /> View as
                </button>
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
        const section = courseKeys.some(c => c.endsWith("_A")) ? "A" : courseKeys.some(c => c.endsWith("_B")) ? "B" : null;
        const baseCodes = new Set(courseKeys.map(c => c.replace(/_[AB]$/, "")));
        // Today's classes as this user would see them (their section + enrolled codes)
        const today = new Date().toISOString().split("T")[0];
        const overridesToday = flags.classOverrides?.[today] || {};
        const userClasses = liveSchedule
          .filter(c => c.date === today && c.type !== "break")
          .filter(c => baseCodes.has(c.code))
          .filter(c => !c.section || c.section === "All" || c.section === "Single" || !section || c.section === section)
          .map(c => {
            const key = c.section && c.section !== "All" && c.section !== "Single" ? `${c.code}_${c.section}` : c.code;
            const ov = overridesToday[key] || overridesToday[c.code];
            return { ...c, cancelled: ov?.type === "cancelled", room: ov?.room || c.room, start: ov?.start || c.start, end: ov?.end || c.end };
          })
          .sort((a, b) => (a.start || "").localeCompare(b.start || ""));
        const featureState = FEATURE_FLAGS.map(f => ({ label: f.label, on: flags[f.key] !== false }));
        return (
          <>
            <div className="notif-backdrop" onClick={() => setViewAsUser(null)} style={{ zIndex: 10000 }} />
            <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", background: "var(--card)", padding: 24, borderRadius: 16, width: "90%", maxWidth: 440, maxHeight: "85vh", overflowY: "auto", zIndex: 10001, border: "1px solid var(--border)", boxShadow: "0 10px 40px rgba(0,0,0,0.2)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <h2 style={{ margin: 0, fontSize: 18, display: "flex", gap: 8, alignItems: "center" }}><VenetianMask size={18} color="var(--violet)" /> Viewing as {viewAsUser.name || "user"}</h2>
                <button onClick={() => setViewAsUser(null)} style={{ background: "transparent", border: "none", color: "var(--muted)", cursor: "pointer" }}><XCircle size={18} /></button>
              </div>
              <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 16 }}>Read-only preview · Section {section || "—"} · {baseCodes.size} subject(s)</div>

              <strong style={{ color: "var(--muted)", fontSize: 12, display: "block", textTransform: "uppercase", marginBottom: 8 }}>Their schedule today</strong>
              {userClasses.length === 0 ? (
                <div className="admin-empty" style={{ marginBottom: 16 }}>No classes today for this student.</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 16 }}>
                  {userClasses.map((c, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 8, padding: "8px 12px", background: "var(--bg)", borderRadius: 8, border: "1px solid var(--border)", opacity: c.cancelled ? 0.55 : 1 }}>
                      <span style={{ fontWeight: 600, fontSize: 13, textDecoration: c.cancelled ? "line-through" : "none" }}>{c.code} {c.room ? `· ${c.room}` : ""}</span>
                      <span style={{ fontSize: 12, color: "var(--muted)" }}>{c.cancelled ? "Cancelled" : `${c.start || "?"}–${c.end || "?"}`}</span>
                    </div>
                  ))}
                </div>
              )}

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
              {/* Section selector */}
              <div className="admin-field">
                <label>Apply to Section</label>
                <select className="admin-input" value={modalSection} onChange={e => setModalSection(e.target.value)}>
                  <option value="All">All Sections</option>
                  <option value="A">Section A</option>
                  <option value="B">Section B</option>
                </select>
              </div>

              {/* Cancel button */}
              <button onClick={() => {
                const overrideKey = modalSection === "All" ? liveEditorModal.code : `${liveEditorModal.code}_${modalSection}`;
                const nextOverrides = { ...(flags.classOverrides || {}) };
                nextOverrides[liveEditorModal.date] = { ...(nextOverrides[liveEditorModal.date] || {}) };
                nextOverrides[liveEditorModal.date][overrideKey] = { type: "cancelled", name: `Cancelled: ${overrideKey}`, modifiedAt: new Date().toISOString(), modifiedBy: admin_id };
                setFlags({ ...flags, classOverrides: nextOverrides });
                logAdminAction(admin_id, "cancel_class", { date: liveEditorModal.date, class: overrideKey });
                setLiveEditorModal(null);
              }} className="admin-btn outline" style={{ color: "var(--danger)", borderColor: "var(--danger)" }}>
                <Ban size={16} /> Cancel Class
              </button>

              {/* Mark as Exam toggle */}
              {(() => {
                const overrideKey = modalSection === "All" ? liveEditorModal.code : `${liveEditorModal.code}_${modalSection}`;
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
                    const codeToUse = modalIsNew ? modalCode : liveEditorModal.code;
                    if (modalIsNew && !codeToUse) return alert("Course Code is required.");
                    const overrideKey = modalSection === "All" ? codeToUse : `${codeToUse}_${modalSection}`;
                    const nextOverrides = { ...(flags.classOverrides || {}) };
                    nextOverrides[liveEditorModal.date] = { ...(nextOverrides[liveEditorModal.date] || {}) };
                    const existing = nextOverrides[liveEditorModal.date][overrideKey] || {};
                    const changes = { ...existing };
                    if (modalRoom)  changes.room  = modalRoom;
                    if (modalStart) changes.start = modalStart;
                    if (modalEnd)   changes.end   = modalEnd;
                    if (modalIsNew) {
                      changes.name = modalName;
                      changes.type = "class"; // base type, can be marked as exam later
                    } else {
                      if (!modalRoom && !modalStart && !modalEnd) return alert("Enter at least one change (room, start, or end time).");
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
              {(flags.classOverrides?.[liveEditorModal.date]?.[liveEditorModal.code] || flags.classOverrides?.[liveEditorModal.date]?.[`${liveEditorModal.code}_${liveEditorModal.section}`]) && (
                <button onClick={() => {
                  const nextOverrides = { ...(flags.classOverrides || {}) };
                  nextOverrides[liveEditorModal.date] = { ...nextOverrides[liveEditorModal.date] };
                  delete nextOverrides[liveEditorModal.date][liveEditorModal.code];
                  delete nextOverrides[liveEditorModal.date][`${liveEditorModal.code}_${liveEditorModal.section}`];
                  if (Object.keys(nextOverrides[liveEditorModal.date]).length === 0) delete nextOverrides[liveEditorModal.date];
                  setFlags({ ...flags, classOverrides: nextOverrides });
                  logAdminAction(admin_id, "clear_override", { date: liveEditorModal.date, class: liveEditorModal.code });
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
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.6)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={() => setActiveUsersListModalOpen(false)}>
          <div style={{ background: "var(--bg)", width: "90%", maxWidth: 500, borderRadius: 16, padding: 24, maxHeight: "80vh", overflowY: "auto", border: "1px solid var(--border)" }} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ margin: 0 }}>Active Users Today ({activeUsers})</h3>
              <button onClick={() => setActiveUsersListModalOpen(false)} style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer" }}><X size={20} /></button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {allUsers.filter(u => u.last_seen_at && new Date(u.last_seen_at).getTime() >= new Date().setHours(0,0,0,0)).map(u => (
                <div key={u.user_id} style={{ background: "var(--card)", padding: "12px", borderRadius: 8, border: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }} onClick={() => { setSelectedUser(u); setActiveUsersListModalOpen(false); }}>
                  <div style={{ fontWeight: 600 }}>{u.name}</div>
                  <div style={{ fontSize: 12, color: "var(--muted)" }}>{new Date(u.last_seen_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {pushSubscribersModalOpen && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.6)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={() => setPushSubscribersModalOpen(false)}>
          <div style={{ background: "var(--bg)", width: "90%", maxWidth: 500, borderRadius: 16, padding: 24, maxHeight: "80vh", overflowY: "auto", border: "1px solid var(--border)" }} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ margin: 0 }}>Push Subscribers ({pushSubCount})</h3>
              <button onClick={() => setPushSubscribersModalOpen(false)} style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer" }}><X size={20} /></button>
            </div>
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
          </div>
        </div>
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
