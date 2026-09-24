import { useState, useEffect, useRef } from "react";
import "../styles/admin.css";
import "../styles/assignments.css";
import "../styles/cmdk.css";
import { Users, Megaphone, Flag, Save, Trash2, ShieldAlert, Check, Search, RefreshCw, AlertTriangle, CalendarDays, XCircle, VenetianMask, Ban, Terminal, Clock, Database, FileText, X, BellRing, Sparkles, Pencil, BarChart2, GraduationCap, PartyPopper, Briefcase, MessageSquare, CloudOff, Shield, Smartphone, Copy, Activity, ChevronRight, Clock3, Download, Filter, Eye, ListFilter, PawPrint, Shirt } from "lucide-react";
import { supabase } from "../lib/supabase";
import { logAdminAction } from "../lib/adminAudit.js";
import { listAdminRoles, setAdminRole, removeAdminRole, myAdminRole, READ_ONLY_MESSAGE } from "../lib/adminRoles.js";
import { safeUrl } from "../lib/safeUrl.js";
import { isPushCronStale, pushCronIssues } from "../lib/pushCronHealth.js";
import { LEGEND } from "../data/schedule.js";
import snapshotMeta from "../data/snapshot-meta.json";
import { getSnapshot } from "../lib/sheet.js";
import { MESS_MENU_FEED_URL } from "../lib/messFeed.js";
import { classIdent, makeOverrideKey, lookupOverride, parseOverrideKey } from "../lib/overrides.js";
import { ymd } from "../lib/datetime.js";
import AdminCommandPalette from "./AdminCommandPalette";
import FeedbackFlashToast from "./FeedbackFlashToast.jsx";
import { WhatsNewPill, WhatsNewModal } from "./WhatsNew.jsx";
import { PETS, getPetByKey } from "./greetingPets.jsx";
import PetHat from "./PetHat.jsx";
import { HATS, COATS, NECKWEAR, hatRequirement } from "../lib/pet.js";

// Render-stable "now" captured at module load — used for relative-time math in
// render (inactivity windows, cron staleness) without an impure Date.now() call.
const LOAD_NOW = Date.now();
const LOAD_TODAY_START = new Date(LOAD_NOW).setHours(0, 0, 0, 0);

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

const DATABASE_TABLES = [
  { id: "profiles", label: "Profiles", description: "Student profile and setup records" },
  { id: "groups", label: "Groups", description: "Student-created groups" },
  { id: "group_members", label: "Group members", description: "Membership links for groups" },
  { id: "meetups", label: "Meetups", description: "Shared meetup plans" },
  { id: "polls", label: "Polls", description: "Group and cohort polls" },
  { id: "split_groups", label: "Split groups", description: "Expense-splitting groups" },
  { id: "feedback", label: "Feedback", description: "Student feedback submissions" },
  { id: "share_codes", label: "Share codes", description: "Schedule sharing codes" },
];

// Approximate native lock-screen preview. The OS decides final layout/truncation.
function PushPreview({ title, body, url, when }) {
  const t = title?.trim();
  const b = body?.trim();
  const destination = url?.trim() || "/";
  return (
    <div className="push-preview" aria-label="Push notification preview">
      <div className="push-preview-label"><span>Recipient preview</span><small>Native layout varies by device</small></div>
      <div className="push-preview-note">
        <div className="push-preview-content">
          <div className="push-preview-head">
            <img className="push-preview-icon" src="/icon-192.png" alt="" />
            <span className="push-preview-app">TermFlow</span>
            <span className="push-preview-time">{when || "now"}</span>
          </div>
          <div className={`push-preview-title ${t ? "" : "is-placeholder"}`}>{t || "Notification title"}</div>
          <div className={`push-preview-text ${b ? "" : "is-placeholder"}`}>{b || "Your message shows here as you type it."}</div>
        </div>
      </div>
      <div className="push-preview-destination">Tap opens: <strong>{destination === "/" ? "TermFlow home" : destination}</strong></div>
    </div>
  );
}


function Avatar({ name, email }) {
  const init = name ? name[0] : (email ? email[0] : "?");
  return <div className="admin-avatar">{init.toUpperCase()}</div>;
}

function userSection(user) {
  const keys = Object.keys(user?.courses || {});
  if (keys.some(code => code.endsWith("_A"))) return "A";
  if (keys.some(code => code.endsWith("_B"))) return "B";
  return "—";
}

function userCourseCount(user) {
  return Object.keys(user?.courses || {}).filter(code => !code.startsWith("_")).length;
}

function relativeUserActivity(value) {
  if (!value) return "Never active";
  const elapsed = Math.max(0, LOAD_NOW - new Date(value).getTime());
  const minutes = Math.floor(elapsed / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(value).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function AdminActionBadge({ mode }) {
  const labels = {
    staged: "Staged",
    live: "Live now",
    scheduled: "Scheduled",
    readonly: "Read only",
    mixed: "Mixed",
  };
  return <span className={`admin-action-badge is-${mode}`}>{labels[mode] || mode}</span>;
}

const IST_DATE_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Kolkata",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function istDateKey(value) {
  const parts = IST_DATE_FORMATTER.formatToParts(new Date(value));
  const part = type => parts.find(item => item.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

// Shared centered-overlay modal shell — backdrop click / X both close, body
// scrolls with a hidden scrollbar track. Width is per-modal (list modals want
// more room than a short confirm), everything else (positioning, max-height,
// close affordance) stays identical so a future fix only has to land once.
function AdminModal({ title, onClose, width = 640, subtitle, children }) {
  return (
    <div className="admin-modal-overlay" onClick={onClose}>
      <div className="admin-modal-card admin-scroll-hide" style={{ maxWidth: width }} onClick={e => e.stopPropagation()}>
        <div className="admin-modal-header">
          <div>
            <h3 className="admin-modal-title">{title}</h3>
            {subtitle && <p className="admin-modal-subtitle">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="admin-modal-close-btn" aria-label="Close modal"><X size={18} /></button>
        </div>
        <div className="admin-modal-body">
          {children}
        </div>
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
// `adminRoles` is stripped too, for a different reason: it moved out of this
// blob to public.admins because it was world-readable there. Old snapshots
// still carry a copy, and restoring one would republish the roster publicly and
// resurrect roles the database no longer honours. Any future key added to
// `flags` that is bookkeeping rather than config belongs in this list.
function stripHistoryKeys(flags) {
  if (!flags) return flags;
  const { configHistory: _h, scheduledConfigDeploys: _q, adminRoles: _r, ...rest } = flags;
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
  greetingPets: "Greeting companions",
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

export default function AdminDashboard({ user, startImpersonation, syncLogs = [], timeOverride, setTimeOverride, allChanges = [], onConfigSaved }) {
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
  // Which tab was open last, so a refresh lands where the admin left off.
  const ADMIN_TAB_KEY = "pgp2.admin-tab-v2";
  const ADMIN_TABS = ["overview", "broadcast", "schedule", "users", "insights", "moderation", "database", "system"];
  const [activeTab, setActiveTab] = useState(() => {
    try {
      const stored = localStorage.getItem(ADMIN_TAB_KEY);
      return ADMIN_TABS.includes(stored) ? stored : "overview";
    } catch { return "overview"; }
  });
  useEffect(() => { try { localStorage.setItem(ADMIN_TAB_KEY, activeTab); } catch { } }, [activeTab]);
  const [previewTheme, setPreviewTheme] = useState("dark"); // announcement banner preview

  const [flags, setFlags] = useState({
    enableFriends: true,
    enableExams: true,
    enableAttendance: true,
    maintenanceMode: false,
    bannedUsers: [],
    classOverrides: {},
    abTests: {},
    dispatchEnabled: true,
    greetingPets: { enabled: true, petKey: "cat", motion: true, companion: true, xpRate: 1, signatures: true, wardrobe: true, hatsOff: [] }
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
  const [adminConfirm, setAdminConfirm] = useState(null);
  const [adminConfirmValue, setAdminConfirmValue] = useState("");
  const [adminConfirmBusy, setAdminConfirmBusy] = useState(false);
  // Set when the live config's updated_at no longer matches what we loaded —
  // i.e. another admin deployed since. Surfaces the concurrency guard (P2)
  // proactively in the review modal instead of only at deploy time.
  const [reviewDrift, setReviewDrift] = useState(null); // null | { when }

  const [allUsers, setAllUsers] = useState([]);
  const [presenceHistory, setPresenceHistory] = useState([]);
  const [presenceHistoryAvailable, setPresenceHistoryAvailable] = useState(false);
  const [presenceAsOf, setPresenceAsOf] = useState(LOAD_NOW);
  const [searchQuery, setSearchQuery] = useState("");
  const [loadingUsers, setLoadingUsers] = useState(true);

  // New states
  const [feedbackList, setFeedbackList] = useState([]);
  const [feedbackFilter, setFeedbackFilter] = useState("pending");
  const [auditLogs, setAuditLogs] = useState([]);
  const [announcementTarget, setAnnouncementTarget] = useState("global");
  const [selectedUser, setSelectedUser] = useState(null);
  const [petLevelDraft, setPetLevelDraft] = useState(1);
  const [petLevelBusy, setPetLevelBusy] = useState(false);
  const [petLevelMessage, setPetLevelMessage] = useState("");
  const [petXpDraft, setPetXpDraft] = useState(100);
  // The inspector's live view of the selected student's companion. pet_state is
  // self-only under RLS, so this can only come from the definer-side RPC —
  // without it every button in that panel is fire-and-forget.
  const [petState, setPetState] = useState(null);
  const [petStateNonce, setPetStateNonce] = useState(0);
  const [petUnlockDraft, setPetUnlockDraft] = useState(PETS[0]?.key || "cat");

  // Reload whenever the inspector opens a different student, or after any
  // mutation bumps the nonce — so the panel always shows what actually landed
  // rather than what was requested.
  useEffect(() => {
    const uid = selectedUser?.user_id;
    if (!uid) return undefined;
    let alive = true;
    supabase.rpc("admin_get_pet_state", { p_user_id: uid }).then(({ data, error }) => {
      if (!alive) return;
      setPetState(error ? null : (Array.isArray(data) ? data[0] ?? null : data ?? null));
    });
    return () => { alive = false; };
  }, [selectedUser?.user_id, petStateNonce]);
  // Cohort-wide companion controls, kept separate from the per-user ones so a
  // busy/failed bulk run can never be mistaken for the single-student panel.
  const [petBulkDraft, setPetBulkDraft] = useState(100);
  const [petBulkLevelDraft, setPetBulkLevelDraft] = useState(1);
  const [petBulkBusy, setPetBulkBusy] = useState(false);
  const [petBulkMessage, setPetBulkMessage] = useState("");

  const [activeUsersListModalOpen, setActiveUsersListModalOpen] = useState(false);
  const [activeUsersSort, setActiveUsersSort] = useState("recent"); // "recent" | "oldest" | "name"
  const [activeUsersSearch, setActiveUsersSearch] = useState("");
  const [activeUsersSection, setActiveUsersSection] = useState("all"); // "all" | "A" | "B"
  const [activeUsersPushOnly, setActiveUsersPushOnly] = useState(false);
  const [activeCopiedToast, setActiveCopiedToast] = useState("");
  const [pushSubscribersModalOpen, setPushSubscribersModalOpen] = useState(false);
  const [pushSubscribersList, setPushSubscribersList] = useState([]);

  // New states for added features
  const [pushSubCount, setPushSubCount] = useState("...");
  const [skipStats, setSkipStats] = useState([]);
  const [friendPingsCount, setFriendPingsCount] = useState("...");
  const [shareCodes, setShareCodes] = useState([]);
  const [userSectionFilter, setUserSectionFilter] = useState("All");
  const [userStatusFilter, setUserStatusFilter] = useState("all");
  const [userSort, setUserSort] = useState("recent");

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
  // Which flash has its course picker expanded. Only consulted below 640px —
  // on a wider screen CSS keeps every panel open and hides the toggle.
  const [openCourseTargets, setOpenCourseTargets] = useState(null);
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
  const selectBroadcastChannel = (channel) => setOpenBcast({
    announcements: channel === "announcements",
    push: channel === "push",
    social: channel === "social",
  });
  const toggleBroadcastChannel = (channel) => setOpenBcast(current => ({
    announcements: channel === "announcements" && !current.announcements,
    push: channel === "push" && !current.push,
    social: channel === "social" && !current.social,
  }));
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
  const [scheduleView] = useState(getSnapshot);
  const liveSchedule = scheduleView.CLASSES || [];
  const [liveEditorDate, setLiveEditorDate] = useState(ymd(new Date()));
  const [liveEditorModal, setLiveEditorModal] = useState(null);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);

  // Database Data Explorer State
  const [dbTable, setDbTable] = useState("profiles");
  const [dbRows, setDbRows] = useState([]);
  const [dbLoading, setDbLoading] = useState(false);
  const [dbError, setDbError] = useState("");
  const [dbSearch, setDbSearch] = useState("");
  const [dbColumn, setDbColumn] = useState("all");
  const [dbRefreshKey, setDbRefreshKey] = useState(0);
  const [dbLoadedAt, setDbLoadedAt] = useState(null);
  const [dbSelectedRow, setDbSelectedRow] = useState(null);
  const [dbCopyStatus, setDbCopyStatus] = useState("");
  const [moderationSearch, setModerationSearch] = useState("");
  const [moderationSort, setModerationSort] = useState("expiry");
  const [moderationScope, setModerationScope] = useState("all");
  const [moderationBusyId, setModerationBusyId] = useState(null);
  const [moderationMessage, setModerationMessage] = useState("");
  const [auditExpandedId, setAuditExpandedId] = useState(null);

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
  const [healthStatus, setHealthStatus] = useState({ supabase: null, sheets: null, mess: null, push: null });
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
  const [modalNewType, setModalNewType] = useState("class"); // "class" | "exam" — type for a newly added entry

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

  // ── Admin roles ──
  // Roles moved off flags.adminRoles (world-readable, client-enforced) onto
  // public.admins, which students cannot read and Postgres actually enforces.
  // These two pieces of state are UX only: they decide what to disable, never
  // what is allowed. can_write_config() is the real gate, so a stale value here
  // costs an admin a confusing error, not unauthorised access.
  const [adminRoster, setAdminRoster] = useState([]);
  const [myRole, setMyRole] = useState(null);
  const isReadOnlyAdmin = myRole === "monitor";

  async function fetchAdminRoles() {
    const [roster, mine] = await Promise.all([listAdminRoles(), myAdminRole()]);
    return { roster, mine };
  }
  async function refreshAdminRoles() {
    try {
      const { roster, mine } = await fetchAdminRoles();
      setAdminRoster(roster);
      setMyRole(mine);
    } catch (e) {
      console.warn("Could not load admin roles:", e.message);
    }
  }
  useEffect(() => {
    let alive = true;
    fetchAdminRoles()
      .then(({ roster, mine }) => { if (!alive) return; setAdminRoster(roster); setMyRole(mine); })
      .catch((e) => console.warn("Could not load admin roles:", e.message));
    return () => { alive = false; };
  }, []);

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
      setDbLoading(true); setDbError(""); setDbSelectedRow(null);
      supabase.from(dbTable).select("*").limit(50).then(({ data, error }) => {
        if (!isMounted) return;
        if (error) setDbError(error.message);
        else { setDbRows(data || []); setDbLoadedAt(new Date()); }
        setDbLoading(false);
      });
      return () => { isMounted = false; };
    }
  }, [activeTab, dbTable, dbRefreshKey]);

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
          const historyNow = Date.now();
          setPresenceAsOf(historyNow);
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
              last_seen_at: d.last_seen_at,
              updated_at: d.updated_at,
            };
          });
          setAllUsers(usersWithNames);

          const todayKey = istDateKey(historyNow);

          // Snapshot fallback for deployments where the durable-history RPC
          // has not landed yet. A successful RPC below replaces these values.
          const dau = prodRows.filter(d => d.last_seen_at && istDateKey(d.last_seen_at) === todayKey).length;
          setActiveUsers(dau);

          // Rolling active-user tiers (last 1 / 7 / 30 days) for retention at a glance
          const nowTs = Date.now();
          const within = days => prodRows.filter(d => d.last_seen_at && (nowTs - new Date(d.last_seen_at).getTime()) <= days * 86400000).length;
          setActiveTiers({ dau, wau: within(7), mau: within(30) });

          // Build 7-day calendar bar chart and peak hour using prod users only
          const fallbackDayKeys = Array.from({ length: 7 }, (_, i) => istDateKey(historyNow - (6 - i) * 86400000));
          const counts = Array(7).fill(0);
          const hourCounts = Array(24).fill(0);
          prodRows.forEach(row => {
             if (!row.last_seen_at) return;
             const rowDate = new Date(row.last_seen_at);
             const hour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", hour: "2-digit", hour12: false }).format(rowDate)) % 24;
             hourCounts[hour]++;
             const dayIndex = fallbackDayKeys.indexOf(istDateKey(rowDate));
             if (dayIndex >= 0) counts[dayIndex]++;
          });
          setActivityChartData(counts);
          setPeakHour(hourCounts.indexOf(Math.max(...hourCounts, 0)));

          const { data: history, error: historyError } = await supabase
            .rpc("admin_get_presence_history", { p_days: 30 });
          if (!historyError && Array.isArray(history)) {
            const prodIds = new Set(prodRows.map(row => row.user_id));
            const cleanHistory = history.filter(row => prodIds.has(row.user_id));
            setPresenceHistory(cleanHistory);
            setPresenceHistoryAvailable(true);

            const dayKeys = Array.from({ length: 7 }, (_, i) => istDateKey(historyNow - (6 - i) * 86400000));
            const durableCounts = dayKeys.map(key => cleanHistory.filter(row => row.activity_date === key).length);
            const durableHours = Array(24).fill(0);
            cleanHistory.forEach(row => {
              Object.entries(row.hourly_heartbeats || {}).forEach(([hour, count]) => {
                const hourNumber = Number(hour);
                if (count > 0 && hourNumber >= 0 && hourNumber < 24) durableHours[hourNumber]++;
              });
            });
            const durableToday = new Set(cleanHistory.filter(row => row.activity_date === todayKey).map(row => row.user_id)).size;
            const lastSevenKeys = new Set(dayKeys);
            const durableWeek = new Set(cleanHistory.filter(row => lastSevenKeys.has(row.activity_date)).map(row => row.user_id)).size;
            const durableMonth = new Set(cleanHistory.map(row => row.user_id)).size;
            setActiveUsers(durableToday);
            setActiveTiers({ dau: durableToday, wau: durableWeek, mau: durableMonth });
            setActivityChartData(durableCounts);
            setPeakHour(durableHours.some(Boolean) ? durableHours.indexOf(Math.max(...durableHours)) : null);
          } else {
            setPresenceHistory([]);
            setPresenceHistoryAvailable(false);
          }

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

  async function openReviewChanges() {
    setReviewDrift(null);
    setReviewOpen(true);
    if (!loadedUpdatedAt) return;
    const { data: cur } = await supabase.from("system_config").select("updated_at").eq("id", "global").single();
    if (cur?.updated_at && cur.updated_at !== loadedUpdatedAt) setReviewDrift({ when: cur.updated_at });
  }

  function requestAdminConfirmation(config) {
    setAdminConfirmValue("");
    setAdminConfirm(config);
  }

  async function runAdminConfirmation() {
    if (!adminConfirm?.onConfirm) return;
    if (adminConfirm.requireText && adminConfirmValue.trim().toUpperCase() !== adminConfirm.requireText.toUpperCase()) return;
    setAdminConfirmBusy(true);
    try {
      await adminConfirm.onConfirm();
      setAdminConfirm(null);
      setAdminConfirmValue("");
    } finally {
      setAdminConfirmBusy(false);
    }
  }

  function requestDiscardChanges() {
    requestAdminConfirmation({
      title: "Discard staged changes?",
      description: `${changesCount} staged change${changesCount === 1 ? "" : "s"} will be reset to the currently deployed configuration.`,
      impact: "Students are not affected because these edits are not live yet.",
      confirmLabel: "Discard changes",
      tone: "danger",
      onConfirm: () => setFlags(originalFlags),
    });
  }

  async function saveConfig({ force = false } = {}) {
    // Courtesy check only — RLS refuses a monitor's UPDATE regardless, which
    // surfaces below as a 0-row write rather than an error.
    if (isReadOnlyAdmin) return alert(READ_ONLY_MESSAGE);
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
        // A zero-row UPDATE has two very different causes now that RLS gates
        // writes by role: someone else deployed (the row moved on), or the
        // policy refused us (the row did not move at all). Telling them apart
        // matters — offering Force Deploy to a monitor sends them round a loop
        // that can never succeed.
        const { data: cur } = await supabase
          .from("system_config").select("updated_at").eq("id", "global").single();
        const rowUnchanged = cur?.updated_at && cur.updated_at === loadedUpdatedAt;
        if (rowUnchanged) {
          setSaveMsg(`⚠ ${READ_ONLY_MESSAGE}`);
          setForceDeployReady(false);
          refreshAdminRoles(); // our cached role was evidently wrong
        } else {
          const when = cur?.updated_at ? new Date(cur.updated_at).toLocaleTimeString() : "just now";
          if (cur?.updated_at) setLoadedUpdatedAt(cur.updated_at); // sync so force-deploy works
          setSaveMsg(`⚠ Another deploy happened at ${when}. Force deploy to overwrite.`);
          setForceDeployReady(true);
        }
      } else if (error) {
        setSaveMsg("Failed: " + error.message);
      } else {
        setForceDeployReady(false);
        setOriginalFlags(newFlags);
        setLoadedUpdatedAt(nextUpdatedAt);
        onConfigSaved?.(newFlags);
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

  // Shared push sender. Pass a targetUserId to deliver only to that user's devices
  // (used by "Send test to me"); omit it to broadcast to everyone.
  async function postPush({ targetUserId } = {}) {
    const sessionToken = await window.Clerk?.session?.getToken();
    if (!sessionToken) { setPushResult("Your admin session is unavailable. Refresh and sign in again."); return; }
    setPushSending(true);
    setPushResult("");
    try {
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-push`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${sessionToken}`,
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
    // 3. Check both scheduled push stages, including jobs that are missing.
    try {
      const { data, error } = await supabase.rpc("get_cron_health");
      if (error) checks.push({ name: "Cron jobs", ok: false, detail: error.message });
      else {
        const issues = pushCronIssues(data, nowMs());
        checks.push({ name: "Push cron jobs", ok: issues.length === 0, detail: issues.length ? issues.join("; ") : "cron submitted requests; HTTP delivery must be checked separately" });
      }
    } catch (e) { checks.push({ name: "Cron jobs", ok: false, detail: e.message }); }
    // 4. Probe each stage without the push secret. A deployed function answers
    // 401; a missing function answers 404. No notification is queued or sent.
    for (const fn of ["class-reminders", "dispatch", "send-push"]) {
      try {
        const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${fn}`, {
          method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}` },
          body: JSON.stringify({ __healthcheck: true }),
        });
        checks.push({ name: `${fn} fn`, ok: resp.status === 401, detail: `HTTP ${resp.status}${resp.status === 404 ? " — function missing" : ""}` });
      } catch (e) { checks.push({ name: `${fn} fn`, ok: false, detail: e.message }); }
    }
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

  // ── Weekly Presence: durable per-user, per-day IST activity ────────────────
  // Index 0 = 6 days ago, index 6 = today. Before the migration is deployed,
  // this falls back to the old single-last-seen snapshot without pretending it
  // is historical data.
  const weeklyPresence = (() => {
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(presenceAsOf - (6 - i) * 86400000);
      return {
        label: d.toLocaleDateString("en-IN", { weekday: "short", timeZone: "Asia/Kolkata" }),
        date: d.toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" }),
        isoDate: istDateKey(d),
        users: [],
        hourBuckets: Array(24).fill(0),
      };
    });

    const usersById = new Map(allUsers.map(user => [user.user_id, user]));
    if (presenceHistoryAvailable) {
      presenceHistory.forEach(record => {
        const day = days.find(item => item.isoDate === record.activity_date);
        const u = usersById.get(record.user_id);
        if (!day || !u) return;
        const seenDate = new Date(record.last_seen_at);
        const firstSeenDate = new Date(record.first_seen_at);
        const recordedHours = Object.entries(record.hourly_heartbeats || {})
          .filter(([, count]) => Number(count) > 0)
          .map(([hour]) => Number(hour))
          .filter(hour => hour >= 0 && hour < 24);
        const hours = recordedHours.length ? recordedHours : [Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", hour: "2-digit", hour12: false }).format(seenDate)) % 24];
        const section = userSection(u);
        const isNew = u.updated_at
          ? Math.abs(new Date(u.updated_at).getTime() - firstSeenDate.getTime()) <= 86400000
          : false;
        day.users.push({
          name: u.name || "Student",
          hour: hours[hours.length - 1],
          hours,
          userId: u.user_id,
          section,
          isNew,
          firstSeenTs: firstSeenDate.getTime(),
          seenTs: seenDate.getTime(),
          heartbeatCount: Number(record.heartbeat_count) || 1,
        });
        hours.forEach(hour => { day.hourBuckets[hour]++; });
      });
      return days;
    }

    allUsers.forEach(u => {
      if (!u.last_seen_at) return;
      const seenDate = new Date(u.last_seen_at);
      const dayIdx = days.findIndex(d => d.isoDate === istDateKey(seenDate));
      if (dayIdx === -1) return;
      const hour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", hour: "2-digit", hour12: false }).format(seenDate)) % 24;
      // Derive section from the first non-underscore course key
      const courseKeys = Object.keys(u.courses || {}).filter(c => !c.startsWith("_"));
      const section = courseKeys.length > 0
        ? (courseKeys.find(c => /_[ABC]$/.test(c))?.match(/_([ABC])$/)?.[1] || "—")
        : "—";
      // Mark as "new" if they signed up (updated_at) within 24h of the day
      const isNew = u.updated_at
        ? Math.abs(new Date(u.updated_at).getTime() - seenDate.getTime()) <= 86400000
        : false;
      days[dayIdx].users.push({
        name: u.name || "Student",
        hour,
        hours: [hour],
        userId: u.user_id,
        section,
        isNew,
        seenTs: seenDate.getTime(),
        firstSeenTs: seenDate.getTime(),
        heartbeatCount: 1,
      });
      days[dayIdx].hourBuckets[hour]++;
    });

    return days;
  })();

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
  const systemOverview = (() => {
    const maintenance = flags.maintenanceMode ? "Live lockout" : flags.maintenanceWindow?.start || flags.maintenanceWindow?.end ? "Window scheduled" : "Open";
    const staleJobs = cronHealth ? pushCronIssues(cronHealth, LOAD_NOW).length : 0;
    const items = [
      ...(changesCount ? [{ id: "changes", tone: "watch", title: `${changesCount} staged change${changesCount === 1 ? "" : "s"}`, detail: "Review and deploy when the configuration is ready.", action: "Review changes", onClick: () => setReviewOpen(true) }] : []),
      ...(staleJobs ? [{ id: "jobs", tone: "risk", title: `${staleJobs} automation job${staleJobs === 1 ? " needs" : "s need"} attention`, detail: "Open Insights for the latest cron and service health.", action: "Open health", onClick: () => setActiveTab("insights") }] : []),
      ...(flags.maintenanceMode ? [{ id: "maintenance", tone: "risk", title: "Maintenance lockout is live", detail: "Non-admin students cannot access TermFlow until it is turned off and deployed.", action: "Review lockout", onClick: () => window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" }) }] : []),
    ];
    return { maintenance, staleJobs, items: items.slice(0, 3) };
  })();
  const broadcastOverview = (() => {
    const today = new Date(LOAD_NOW).toISOString().slice(0, 10);
    const activeBanners = (flags.scheduledAnnouncements || []).filter(item => item.start <= today && today <= item.end).length;
    const scheduledItems = (flags.scheduledAnnouncements || []).filter(item => item.start > today).length + (flags.scheduledPushes || []).length + (flags.quickLinks || []).filter(item => item.start > today).length;
    return { activeBanners, scheduledItems, subscribers: Number(pushSubCount) || 0 };
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
  // Roles write straight through to public.admins now, so they take effect
  // immediately instead of being staged until the next config Deploy. That is
  // the point: a role that only applies after a deploy is a role that does not
  // apply during the window you most need it to.
  async function saveAdminRole() {
    const id = roleUserId.trim();
    if (!id) return alert("Enter a user ID.");
    try {
      await setAdminRole(id, roleValue);
      setRoleUserId("");
      await refreshAdminRoles();
    } catch (e) {
      alert(`Could not set role: ${e.message}`);
    }
  }
  async function revokeAdminRole(id) {
    try {
      await removeAdminRole(id);
      await refreshAdminRoles();
    } catch (e) {
      // The last-superadmin guard lands here, and its message is the useful one.
      alert(`Could not remove role: ${e.message}`);
    }
  }
  function requestRevokeAdminRole(id) {
    requestAdminConfirmation({
      title: "Remove admin access?",
      description: `${id} will lose access to protected admin operations.`,
      impact: "This applies immediately and is recorded in the admin audit trail.",
      confirmLabel: "Remove access",
      requireText: "REMOVE",
      tone: "danger",
      onConfirm: () => revokeAdminRole(id),
    });
  }

  // ── Push to an explicit set of user IDs (bulk "Push Selected" + re-engagement) ──
  async function pushToUserIds(ids, { title, body, url = "/?view=today", confirmMsg } = {}) {
    if (!ids || ids.length === 0) return alert("No users to push to.");
    const sessionToken = await window.Clerk?.session?.getToken();
    if (!sessionToken) return { ok: false, data: { error: "Your admin session is unavailable. Refresh and sign in again." } };
    if (confirmMsg && !confirm(confirmMsg)) return;
    const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-push`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${sessionToken}` },
      body: JSON.stringify({ title, body, url, target_user_ids: ids }),
    });
    const data = await resp.json().catch(() => ({}));
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
  const activeStatusUsers = allUsers.filter(u => u.courses?._status?.until && new Date(u.courses._status.until).getTime() > LOAD_NOW);
  const normalizedModerationSearch = moderationSearch.trim().toLowerCase();
  const filteredStatusUsers = activeStatusUsers.filter(u => {
    const until = new Date(u.courses?._status?.until).getTime();
    const expiresSoon = Number.isFinite(until) && until - LOAD_NOW <= 60 * 60000;
    if (moderationScope === "soon" && !expiresSoon) return false;
    if (moderationScope === "later" && expiresSoon) return false;
    if (!normalizedModerationSearch) return true;
    const status = u.courses?._status || {};
    return `${u.name || ""} ${u.email || ""} ${status.text || ""} ${status.emoji || ""}`.toLowerCase().includes(normalizedModerationSearch);
  });
  const moderationExpiringSoon = activeStatusUsers.filter(u => {
    const until = new Date(u.courses?._status?.until).getTime();
    return Number.isFinite(until) && until - LOAD_NOW <= 60 * 60000;
  });
  const visibleStatusUsers = [...filteredStatusUsers].sort((a, b) => {
    if (moderationSort === "name") return (a.name || "").localeCompare(b.name || "");
    if (moderationSort === "recent") return new Date(b.courses?._status?.until || 0) - new Date(a.courses?._status?.until || 0);
    return new Date(a.courses?._status?.until || 0) - new Date(b.courses?._status?.until || 0);
  });
  const pendingFeedbackCount = feedbackList.filter(item => item.status === "pending").length;
  function goToAdminTab(tab) {
    setActiveTab(tab);
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
  }
  const adminOverviewTasks = [
    ...(changesCount ? [{ id: "staged", tone: "watch", title: `${changesCount} staged change${changesCount === 1 ? "" : "s"} need review`, detail: "Nothing is live until the configuration is deployed.", action: "Review", mode: "staged", onClick: openReviewChanges }] : []),
    ...(scheduleConflicts.length ? [{ id: "conflicts", tone: "risk", title: `${scheduleConflicts.length} schedule conflict${scheduleConflicts.length === 1 ? "" : "s"} detected`, detail: "Check room and time collisions before publishing schedule changes.", action: "Open schedule", mode: "readonly", onClick: () => goToAdminTab("schedule") }] : []),
    ...(systemOverview.staleJobs ? [{ id: "jobs", tone: "risk", title: `${systemOverview.staleJobs} automation job${systemOverview.staleJobs === 1 ? " needs" : "s need"} attention`, detail: "Review the latest cron and edge-function health report.", action: "Open health", mode: "live", onClick: () => goToAdminTab("insights") }] : []),
    ...(moderationExpiringSoon.length ? [{ id: "moderation", tone: "watch", title: `${moderationExpiringSoon.length} visible status${moderationExpiringSoon.length === 1 ? "" : "es"} expire within an hour`, detail: "Review student-facing statuses while they are still active.", action: "Moderate", mode: "live", onClick: () => goToAdminTab("moderation") }] : []),
    ...(pendingFeedbackCount ? [{ id: "feedback", tone: "info", title: `${pendingFeedbackCount} feedback item${pendingFeedbackCount === 1 ? "" : "s"} awaiting review`, detail: "Triage student feedback and route useful ideas into announcements.", action: "Review feedback", mode: "live", onClick: () => goToAdminTab("users") }] : []),
    ...(ghostUsers.length ? [{ id: "inactive", tone: "info", title: `${ghostUsers.length} student${ghostUsers.length === 1 ? " has" : "s have"} been inactive for 7+ days`, detail: "Review engagement before deciding whether outreach is needed.", action: "Review users", mode: "readonly", onClick: () => goToAdminTab("users") }] : []),
  ];
  const insightIssues = [
    ...(moderationExpiringSoon.length ? [{ id: "statuses", tone: "watch", title: `${moderationExpiringSoon.length} status${moderationExpiringSoon.length === 1 ? "" : "es"} expire within an hour`, detail: "Review the live-status queue before they disappear.", action: "Review statuses", tab: "moderation" }] : []),
    ...(ghostUsers.length ? [{ id: "inactive", tone: "watch", title: `${ghostUsers.length} students have been inactive for 7+ days`, detail: "Use the engagement controls to decide whether outreach is warranted.", action: "Review users", tab: "users" }] : []),
    ...(cronHealth && pushCronIssues(cronHealth, LOAD_NOW).length ? [{ id: "cron", tone: "risk", title: "Push delivery needs attention", detail: pushCronIssues(cronHealth, LOAD_NOW).join("; "), action: "Open health", tab: "insights" }] : []),
  ].slice(0, 3);
  const insightsSessions = activityChartData.reduce((sum, value) => sum + value, 0);
  const insightsWeeklyReach = typeof totalUsers === "number" && totalUsers ? Math.round((activeTiers.wau / totalUsers) * 100) : 0;
  const insightsPushReadiness = typeof totalUsers === "number" && totalUsers ? Math.round((Number(pushSubCount) / totalUsers) * 100) : 0;
  const insightsAbsences = skipStats.reduce((sum, [, count]) => sum + Number(count || 0), 0);
  const insightsEnabledFeatures = FEATURE_FLAGS.filter(feature => flags[feature.key] !== false).length;
  const presenceSeenThisWeek = new Set(weeklyPresence.flatMap(day => day.users.map(user => user.userId))).size;
  const presenceActivityDays = weeklyPresence.reduce((sum, day) => sum + day.users.length, 0);
  const presencePeakDay = weeklyPresence.reduce((peak, day) => day.users.length > peak.users.length ? day : peak, weeklyPresence[0]);
  const dbColumns = [...new Set(dbRows.flatMap(row => Object.keys(row)))];
  const filteredDbRows = dbRows.filter(row => {
    const term = dbSearch.trim().toLowerCase();
    if (!term) return true;
    const values = dbColumn === "all" ? Object.values(row) : [row[dbColumn]];
    return values.some(value => (typeof value === "object" ? JSON.stringify(value) : String(value ?? "")).toLowerCase().includes(term));
  });
  const selectedDbTable = DATABASE_TABLES.find(table => table.id === dbTable) || DATABASE_TABLES[0];
  async function copyDatabaseRow() {
    if (!dbSelectedRow) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(dbSelectedRow, null, 2));
      setDbCopyStatus("Copied");
      setTimeout(() => setDbCopyStatus(""), 1600);
    } catch {
      setDbCopyStatus("Copy failed");
    }
  }
  const scheduleToday = ymd(new Date(LOAD_NOW));
  const scheduleOverrideCount = Object.values(flags.classOverrides || {}).reduce((sum, day) => sum + Object.keys(day || {}).length, 0);
  const upcomingOverrideCount = Object.entries(flags.classOverrides || {}).reduce((sum, [date, day]) => sum + (date >= scheduleToday ? Object.keys(day || {}).length : 0), 0);
  const selectedDayClasses = liveSchedule.filter(c => c.date === liveEditorDate && c.type !== "break").length;
  const selectedDayOverrides = Object.keys(flags.classOverrides?.[liveEditorDate] || {}).length;
  const selectedDayLabel = new Date(`${liveEditorDate}T12:00:00`).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  async function clearUserStatus(target) {
    if (!confirm(`Clear status for ${target.name || "this student"}?`)) return;
    setModerationBusyId(target.user_id);
    setModerationMessage("");
    const updated = { ...target.courses };
    delete updated._status;
    const { error } = await supabase.from("profiles").update({ courses: updated }).eq("user_id", target.user_id);
    if (error) setModerationMessage(`Could not clear status: ${error.message}`);
    else {
      await logAdminAction(admin_id, "clear_user_status", { target_user: target.user_id });
      setAllUsers(users => users.map(item => item.user_id === target.user_id ? { ...item, courses: updated } : item));
      setModerationMessage(`Status cleared for ${target.name || "student"}.`);
    }
    setModerationBusyId(null);
  }
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
    await saveConfig();
    await logAdminAction(admin_id, "force_refresh", {});
    setSaveMsg("Refresh signal sent. Users will sync on their next navigation.");
  }

  function requestForceRefresh() {
    requestAdminConfirmation({
      title: "Force every active client to sync?",
      description: "This publishes the current configuration and asks all active TermFlow clients to refresh on their next navigation.",
      impact: "This action is live and affects the whole cohort.",
      confirmLabel: "Force global sync",
      requireText: "REFRESH",
      tone: "danger",
      onConfirm: forceRefresh,
    });
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

  const pushSubscriberIds = new Set(pushSubscribersList || []);
  const userOpsStats = {
    total: allUsers.length,
    activeWeek: allUsers.filter(u => u.last_seen_at && LOAD_NOW - new Date(u.last_seen_at).getTime() <= 7 * 86400000).length,
    needsSetup: allUsers.filter(u => userCourseCount(u) === 0).length,
    atRisk: allUsers.filter(u => !u.last_seen_at || LOAD_NOW - new Date(u.last_seen_at).getTime() > 7 * 86400000).length,
    neverSeen: allUsers.filter(u => !u.last_seen_at).length,
    banned: allUsers.filter(u => flags.bannedUsers?.includes(u.user_id)).length,
  };

  const filteredUsers = allUsers.filter(u => {
    const needle = searchQuery.trim().toLowerCase();
    const matchesSearch = !needle || u.name?.toLowerCase().includes(needle) ||
                          u.email?.toLowerCase().includes(needle) ||
                          u.user_id?.toLowerCase().includes(needle);
    let matchesSection = true;
    if (userSectionFilter !== "All") {
       matchesSection = Object.keys(u.courses || {}).some(c => c.endsWith(`_${userSectionFilter}`));
    }
    const seenAge = u.last_seen_at ? LOAD_NOW - new Date(u.last_seen_at).getTime() : Infinity;
    const matchesStatus = userStatusFilter === "all"
      || (userStatusFilter === "today" && u.last_seen_at && new Date(u.last_seen_at).getTime() >= LOAD_TODAY_START)
      || (userStatusFilter === "active7" && seenAge <= 7 * 86400000)
      || (userStatusFilter === "attention" && seenAge > 7 * 86400000)
      || (userStatusFilter === "inactive7" && u.last_seen_at && seenAge > 7 * 86400000)
      || (userStatusFilter === "never" && !u.last_seen_at)
      || (userStatusFilter === "setup" && userCourseCount(u) === 0)
      || (userStatusFilter === "push" && pushSubscriberIds.has(u.user_id))
      || (userStatusFilter === "banned" && flags.bannedUsers?.includes(u.user_id));
    return matchesSearch && matchesSection && matchesStatus;
  }).sort((a, b) => {
    if (userSort === "name") return (a.name || "").localeCompare(b.name || "");
    if (userSort === "courses") return userCourseCount(b) - userCourseCount(a) || (a.name || "").localeCompare(b.name || "");
    const aSeen = a.last_seen_at ? new Date(a.last_seen_at).getTime() : 0;
    const bSeen = b.last_seen_at ? new Date(b.last_seen_at).getTime() : 0;
    return userSort === "oldest" ? aSeen - bSeen : bSeen - aSeen;
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
    const next = { supabase: null, sheets: null, mess: null, push: null };

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

    // 4. Mess-menu Apps Script — validate both reachability and its menu payload.
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 6000);
      const resp = await fetch(MESS_MENU_FEED_URL, { signal: ctrl.signal, redirect: "follow" });
      const data = resp.ok ? await resp.json() : null;
      clearTimeout(timer);
      next.mess = resp.ok && !data?.error && data?.menu && Object.keys(data.menu).length ? "ok" : "error";
    } catch (e) {
      next.mess = e.name === "AbortError" ? "timeout" : "error";
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
    setModalNewType(c.type === "exam" ? "exam" : c.type === "event" ? "event" : c.type === "placement" ? "placement" : "class");
  };

  return (
    <div className={`admin-page ${isModernUi ? "modern-ui" : ""} ${changesCount > 0 ? "has-pending-changes" : ""}`}>

      {/* ── Undo toast for destructive one-click actions ── */}
      {undoToast && (
        <div style={{ position: "fixed", left: "50%", bottom: 28, transform: "translateX(-50%)", zIndex: 1000, display: "flex", alignItems: "center", gap: 16, padding: "12px 18px", background: "var(--text)", color: "var(--bg)", borderRadius: 12, boxShadow: "0 8px 30px rgba(0,0,0,0.25)", fontSize: 14, fontWeight: 600, maxWidth: "90vw" }}>
          <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{undoToast.label}</span>
          <button onClick={runUndo} style={{ background: "transparent", border: "none", color: "var(--live)", fontWeight: 800, cursor: "pointer", fontSize: 14, padding: "2px 6px", flex: "0 0 auto" }}>Undo</button>
        </div>
      )}

      {/* ── Revamped Hero Command Center Banner ── */}
      <section className="admin-hero-banner">
        {/* Ambient background glow elements */}
        <div className="admin-hero-glow-violet" />
        <div className="admin-hero-glow-emerald" />

        {/* Top Header Row: Admin Profile on Left, Pill in Center, Presence/Unsaved on Right */}
        <div className="admin-hero-top-row">
          {/* Admin Profile Pill */}
          {user && (
            <div className="admin-hero-profile-pill">
              <div className="admin-hero-profile-avatar-wrap">
                {user?.imageUrl ? (
                  <img src={user.imageUrl} alt={user?.fullName || "Admin"} className="admin-hero-profile-img" />
                ) : (
                  <div className="admin-hero-profile-fallback">
                    {(`${user?.firstName?.[0] || ""}${user?.lastName?.[0] || ""}` || user?.fullName?.[0] || "A").toUpperCase()}
                  </div>
                )}
                <span className="admin-hero-online-dot" />
              </div>
              <span className="admin-hero-profile-name">{user?.fullName || user?.firstName || "Admin"}</span>
            </div>
          )}

          {/* Center Pill: Admin Control Center + Quick Operations */}
          <div className="admin-hero-control-pill">
            <ShieldAlert size={20} className="admin-hero-shield-icon" />
            <h1 className="admin-hero-control-title">Admin Control Center</h1>
            <div className="admin-hero-pill-actions">
              <button
                onClick={fetchDashboardData}
                disabled={statsLoading}
                className="admin-hero-action-btn"
                title="Refresh dashboard data"
              >
                <RefreshCw size={15} className={statsLoading ? "spin-icon" : ""} />
              </button>
              <button
                onClick={() => setIsCommandPaletteOpen(true)}
                className="admin-hero-action-btn"
                title="Open Command Palette (⌘⇧K / Ctrl+Shift+K)"
              >
                <Search size={15} />
              </button>
              <button
                onClick={() => setIsModernUi(!isModernUi)}
                className="admin-hero-action-btn"
                title={isModernUi ? "Switch to Legacy Mobile UI" : "Switch to Modern Mobile UI"}
                style={{ opacity: isModernUi ? 1 : 0.45 }}
              >
                <Smartphone size={15} />
              </button>
            </div>
          </div>

          {/* Right Status Pill: Unsaved changes or presence */}
          <div className="admin-hero-status-area">
            {changesCount > 0 ? (
              <div className="admin-hero-unsaved-pill">
                <span className="admin-hero-unsaved-dot" />
                <span>{changesCount} unsaved change{changesCount !== 1 ? "s" : ""}</span>
              </div>
            ) : presentAdmins.length > 0 ? (
              <div className="admin-hero-presence-pill" title={presentAdmins.map(a => a.name).join(", ")}>
                <span className="admin-hero-presence-dot" />
                <span>{presentAdmins.length === 1 ? "You're the only admin here" : `${presentAdmins.length} admins online`}</span>
              </div>
            ) : null}
          </div>
        </div>

        {/* Subtitle */}
        <p className="admin-hero-tagline">Global settings, feature flags, and user management for TermFlow PGP2.</p>

        {/* 4 KPI Stat Cards */}
        <div className="admin-hero-stats-row">
          {/* Total Users */}
          <div className="admin-kpi-card accent-green" title="Total registered students (excluding dev/admin accounts)">
            <div className="admin-kpi-header">
              <span className="admin-kpi-label">TOTAL USERS</span>
              <div className="admin-kpi-icon-wrap green"><Users size={14} /></div>
            </div>
            <div className="admin-kpi-value">{statsLoading ? "..." : totalUsers}</div>
            <div className="admin-kpi-sub">Registered students</div>
          </div>

          {/* Active Today */}
          <div
            className="admin-kpi-card accent-violet clickable"
            title="Unique students who opened TermFlow since 12:00 AM IST (click to inspect)"
            onClick={() => setActiveUsersListModalOpen(true)}
          >
            <div className="admin-kpi-header">
              <span className="admin-kpi-label">ACTIVE TODAY</span>
              <div className="admin-kpi-icon-wrap violet"><Activity size={14} /></div>
            </div>
            <div className="admin-kpi-value interactive">{statsLoading ? "..." : activeUsers}</div>
            <div className="admin-kpi-sub">
              <span>12:00 AM–11:59 PM IST</span>
              <span className="admin-kpi-action-hint">↗ View</span>
            </div>
          </div>

          {/* DB Storage Used */}
          <div className="admin-kpi-card accent-amber" title="PostgreSQL database size (Free tier limit is 500MB)">
            <div className="admin-kpi-header">
              <span className="admin-kpi-label">DB STORAGE USED</span>
              <div className="admin-kpi-icon-wrap amber"><Database size={14} /></div>
            </div>
            <div className="admin-kpi-value">{statsLoading ? "..." : dbSize}</div>
            <div className="admin-kpi-sub">Free tier limit: 500 MB</div>
          </div>

          {/* Push Subscribers */}
          <div
            className="admin-kpi-card accent-blue clickable"
            title="Total devices enrolled for FCM web push notifications (click to view)"
            onClick={() => setPushSubscribersModalOpen(true)}
          >
            <div className="admin-kpi-header">
              <span className="admin-kpi-label">PUSH SUBSCRIBERS</span>
              <div className="admin-kpi-icon-wrap blue"><BellRing size={14} /></div>
            </div>
            <div className="admin-kpi-value interactive">{statsLoading ? "..." : pushSubCount}</div>
            <div className="admin-kpi-sub">
              <span>FCM active devices</span>
              <span className="admin-kpi-action-hint">↗ View</span>
            </div>
          </div>
        </div>

        {/* Keyboard Shortcuts Drawer */}
        <div className="admin-hero-shortcuts-wrap">
          <details className="admin-hero-shortcuts-details">
            <summary className="admin-hero-shortcuts-summary">
              <span>▶ Keyboard Shortcuts</span>
            </summary>
            <div className="admin-hero-shortcuts-panel">
              <div className="admin-hero-shortcut-item">
                <span>Open Command Palette</span>
                <kbd>Cmd/Ctrl + Shift + K</kbd>
              </div>
            </div>
          </details>
        </div>
      </section>

      {/* ── Tab nav: task-oriented admin workspaces ── */}
      <nav className="admin-tabs" role="tablist" aria-label="Admin sections">
        {[
          { id: "overview", label: "Overview", Icon: Activity },
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
            onClick={() => goToAdminTab(id)}
          >
            <Icon size={16} />
            <span className="admin-tab-label">{label}</span>
            {isNew && (
              <span className="admin-tab-badge-new">NEW</span>
            )}
          </button>
        ))}
      </nav>

      {/* ── Card flow: 2-col masonry ≥1200px, single column below ── */}
      <div className="admin-masonry" data-active-tab={activeTab}>

        <section className="admin-overview-command admin-span-all admin-g-overview">
          <div className="admin-overview-head">
            <div>
              <span className="admin-overview-eyebrow">Today&apos;s operations</span>
              <h2>What needs your attention</h2>
              <p>Live health, staged work, and student-impacting tasks in one place.</p>
            </div>
            <span className={`admin-overview-health ${adminOverviewTasks.some(task => task.tone === "risk") ? "is-watch" : ""}`}>
              <i aria-hidden="true" />
              {adminOverviewTasks.length ? `${adminOverviewTasks.length} item${adminOverviewTasks.length === 1 ? "" : "s"} to review` : "All clear"}
            </span>
          </div>
          <div className="admin-overview-metrics">
            <button type="button" onClick={changesCount ? openReviewChanges : undefined} disabled={!changesCount}>
              <span>Staged changes</span><strong>{changesCount}</strong><small>{changesCount ? "Review before deployment" : "Cloud config is current"}</small>
            </button>
            <button type="button" onClick={() => goToAdminTab("schedule")}>
              <span>Schedule conflicts</span><strong>{scheduleConflicts.length}</strong><small>{scheduleConflicts.length ? "Room or time collisions" : "No collisions detected"}</small>
            </button>
            <button type="button" onClick={() => goToAdminTab("users")}>
              <span>Pending feedback</span><strong>{pendingFeedbackCount}</strong><small>{pendingFeedbackCount ? "Waiting for triage" : "Feedback queue is clear"}</small>
            </button>
            <button type="button" onClick={() => goToAdminTab("insights")}>
              <span>Active today</span><strong>{statsLoading ? "…" : activeUsers}</strong><small>Unique students since midnight IST</small>
            </button>
          </div>
        </section>

        <section className="admin-card admin-span-all admin-g-overview admin-overview-queue">
          <div className="admin-overview-section-head"><div><span>Priority queue</span><h2>Next best actions</h2></div><small>Ordered by potential student impact</small></div>
          {adminOverviewTasks.length ? (
            <div className="admin-overview-task-list">
              {adminOverviewTasks.map(task => (
                <article className={`admin-overview-task is-${task.tone}`} key={task.id}>
                  <i aria-hidden="true" />
                  <div><div className="admin-overview-task-title"><strong>{task.title}</strong><AdminActionBadge mode={task.mode} /></div><p>{task.detail}</p></div>
                  <button type="button" className="admin-btn outline" onClick={task.onClick}>{task.action}<ChevronRight size={14} /></button>
                </article>
              ))}
            </div>
          ) : (
            <div className="admin-overview-empty"><Check size={20} /><div><strong>Nothing urgent right now</strong><p>There are no staged changes, conflicts, failing jobs, or pending review items.</p></div></div>
          )}
        </section>

        <section className="admin-card admin-g-overview admin-overview-launches">
          <div className="admin-overview-section-head"><div><span>Workspaces</span><h2>Quick operations</h2></div></div>
          <div className="admin-overview-launch-grid">
            <button type="button" onClick={() => goToAdminTab("broadcast")}><Megaphone size={18} /><span><strong>Broadcast</strong><small>Messages and push</small></span><AdminActionBadge mode="mixed" /></button>
            <button type="button" onClick={() => goToAdminTab("schedule")}><CalendarDays size={18} /><span><strong>Schedule</strong><small>Overrides and conflicts</small></span><AdminActionBadge mode="staged" /></button>
            <button type="button" onClick={() => goToAdminTab("users")}><Users size={18} /><span><strong>People</strong><small>Students and feedback</small></span><AdminActionBadge mode="mixed" /></button>
            <button type="button" onClick={() => goToAdminTab("system")}><ShieldAlert size={18} /><span><strong>Platform</strong><small>Config and safeguards</small></span><AdminActionBadge mode="staged" /></button>
          </div>
        </section>

        <section className="admin-card admin-g-overview admin-overview-agenda">
          <div className="admin-overview-section-head"><div><span>Coming up</span><h2>Scheduled activity</h2></div><button type="button" onClick={() => goToAdminTab("broadcast")}>Open planner</button></div>
          <div className="admin-overview-compact-list">
            {broadcastAgenda.slice(0, 5).map((item, index) => <div key={`${item.kind}-${item.sort}-${index}`}><i style={{ background: item.color }} /><span><strong>{item.label}</strong><small>{item.kind} · {item.when}</small></span></div>)}
            {broadcastAgenda.length === 0 && <p className="admin-overview-list-empty">No broadcasts, links, or deployments are scheduled.</p>}
          </div>
        </section>

        <section className="admin-card admin-span-all admin-g-overview admin-overview-activity">
          <div className="admin-overview-section-head"><div><span>Accountability</span><h2>Recent admin activity</h2></div><button type="button" onClick={() => goToAdminTab("insights")}>Full audit trail</button></div>
          <div className="admin-overview-activity-grid">
            {auditLogs.slice(0, 5).map(log => <div key={log.id || `${log.created_at}-${log.action}`}><span className="admin-overview-activity-icon"><Shield size={14} /></span><span><strong>{String(log.action || "Admin action").replaceAll("_", " ")}</strong><small>{log.admin_id || "Admin"} · {log.created_at ? new Date(log.created_at).toLocaleString("en-IN") : "Time unavailable"}</small></span></div>)}
            {auditLogs.length === 0 && <p className="admin-overview-list-empty">No recent admin actions are available.</p>}
          </div>
        </section>



          {/* ── Live Schedule Command Centre ── */}
          <section className="admin-card admin-span-all admin-g-schedule scc-shell" style={{ gridColumn: "1 / -1" }}>
            {/* Header */}
            <div className="scc-head">
              <div className="scc-head-copy">
                <span className="scc-eyebrow"><CalendarDays size={14} /> Schedule workspace</span>
                <h2>Schedule Command Centre</h2>
                <p>Review a day, adjust individual classes, and prepare changes for deployment.</p>
              </div>
              <div className="scc-head-actions">
                <button className="admin-btn primary scc-head-btn"
                  onClick={() => openLiveEditorModal({ date: liveEditorDate, code: "", name: "", type: "class", section: "All" }, true)}>
                  <CalendarDays size={15} /> Add class
                </button>
                <button className="admin-btn outline scc-head-btn scc-head-btn--danger"
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
                  <XCircle size={15} /> Cancel day
                </button>
              </div>
            </div>

            <div className="scc-summary" aria-label="Selected schedule day summary">
              <div className="scc-summary-date"><span>Selected day</span><strong>{selectedDayLabel}</strong><small>{scheduleView._source === "live" ? "Cached live feed" : "Bundled schedule snapshot"}</small></div>
              <div><span>Classes</span><strong>{selectedDayClasses}</strong><small>listed for this date</small></div>
              <div><span>Overrides</span><strong>{selectedDayOverrides}</strong><small>on this date</small></div>
            </div>

            {/* Week View Ribbon */}
            {(() => {
              const today = ymd(new Date());
              const selectedDate = new Date(`${liveEditorDate}T12:00:00`);
              const mondayOffset = (selectedDate.getDay() + 6) % 7;
              const weekDays = Array.from({ length: 7 }, (_, i) => {
                const d = new Date(selectedDate); d.setDate(d.getDate() - mondayOffset + i);
                const iso = ymd(d);
                const count = liveSchedule.filter(c => c.date === iso && c.type !== "break").length;
                const hasOverride = !!(flags.classOverrides?.[iso] && Object.keys(flags.classOverrides[iso]).length > 0);
                return { iso, label: d.toLocaleDateString("en-IN", { weekday: "short" }), num: d.getDate(), count, hasOverride, isToday: iso === today };
              });
              return (
                <div className="scc-week-wrap">
                  <div className="scc-week-heading"><span>Week of {weekDays[0].iso === today ? "today" : new Date(`${weekDays[0].iso}T12:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span><button type="button" onClick={() => setLiveEditorDate(today)}>Jump to today <ChevronRight size={13} /></button></div>
                  <div className="scc-week-ribbon" role="group" aria-label="Choose schedule date">
                  {weekDays.map(d => (
                    <button key={d.iso} type="button" aria-pressed={liveEditorDate === d.iso} aria-label={`${d.label} ${d.iso}, ${d.count} classes${d.hasOverride ? ", overrides present" : ""}`}
                      onClick={() => setLiveEditorDate(d.iso)}
                      className={`scc-day${liveEditorDate === d.iso ? " is-active" : ""}${d.isToday ? " is-today" : ""}`}>
                      <div className="scc-day-label">{d.label}</div>
                      <div className="scc-day-num">{d.num}</div>
                      <div className="scc-day-count">{d.count > 0 ? `${d.count} classes` : "No classes"}</div>
                      {d.hasOverride && <span className="scc-day-override" title="Has overrides" />}
                      {d.isToday && <div className="scc-day-today" />}
                    </button>
                  ))}
                  </div>
                </div>
              );
            })()}

            {/* Day toolbar: date picker + section filter */}
            <div className="scc-toolbar">
              <div className="scc-datenav">
                <button aria-label="Previous day" onClick={() => { const d = new Date(liveEditorDate); d.setDate(d.getDate() - 1); setLiveEditorDate(ymd(d)); }}
                  className="scc-datenav-step">‹</button>
                <input type="date" className="admin-input scc-dateinput" aria-label="Editor date" value={liveEditorDate} onChange={e => { if (e.target.value) setLiveEditorDate(e.target.value); }} />
                <button aria-label="Next day" onClick={() => { const d = new Date(liveEditorDate); d.setDate(d.getDate() + 1); setLiveEditorDate(ymd(d)); }}
                  className="scc-datenav-step">›</button>
              </div>
              <div className="scc-sections" role="group" aria-label="Section filter">
                {["All", "A", "B"].map(s => (
                  <button key={s} onClick={() => setCmdSection(s)}
                    className={`scc-section-btn${cmdSection === s ? " is-active" : ""}`} aria-pressed={cmdSection === s}>
                    {s === "All" ? "All Sections" : `Sec ${s}`}
                  </button>
                ))}
              </div>
            </div>

            {/* Undo stack bar */}
            {cmdUndoStack.length > 0 && (
              <div className="scc-undo">
                <span className="scc-undo-label">Staged: <b>{cmdUndoStack[0].label}</b></span>
                <div className="scc-undo-actions">
                  <button onClick={() => {
                    setFlags(f => ({ ...f, classOverrides: cmdUndoStack[0].prevOverrides }));
                    setCmdUndoStack(s => s.slice(1));
                  }} className="scc-undo-btn">↩ Undo</button>
                  {cmdUndoStack.length > 1 && <span className="scc-undo-more">(+{cmdUndoStack.length - 1} more)</span>}
                  <button onClick={() => setCmdUndoStack([])} className="scc-undo-clear">Clear all</button>
                </div>
              </div>
            )}

            <div className="scc-list-head"><div><span className="scc-eyebrow">Day plan</span><h3>Classes for {selectedDayLabel}</h3></div><p>Drag a card onto another to swap times, or use Edit to change a class.</p></div>

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

              if (displayClasses.length === 0) return <div className="scc-empty"><CalendarDays size={22} /><strong>No classes listed</strong><span>{cmdSection !== "All" ? `Nothing is listed for Section ${cmdSection} on this date.` : "Choose another day or add a class."}</span>{cmdSection !== "All" && <button type="button" className="admin-btn outline" onClick={() => setCmdSection("All")}>Show all sections</button>}</div>;

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
                    const isEvent = override?.type === "event" || (!override?.type && c.type === "event");
                    const isPlacement = override?.type === "placement" || (!override?.type && c.type === "placement");
                    const hasRoomChange = !!override?.room;
                    const hasTimeChange = !!override?.start || !!override?.end;
                    const isModified = hasRoomChange || hasTimeChange || isExam || isEvent || isPlacement;
                    const isGuest = (c.session || "").toLowerCase().includes("guest");
                    const displayRoom = override?.room || c.room;
                    const displayStart = override?.start || c.start;
                    const displayEnd = override?.end || c.end;
                    const ident = classIdent(c);
                    const isBeingDragged = draggedIdx === idx;
                    const isQuickRoomOpen = cmdQuickRoom?.date === liveEditorDate && cmdQuickRoom?.classKey === ident + "_" + c.section;

                    return (
                      <div key={idx} className={`scc-class-card${isCancelled ? " is-cancelled" : ""}${isEvent ? " is-event" : ""}${isExam ? " is-exam" : ""}${isModified ? " is-modified" : ""}${isGuest ? " is-guest" : ""}${isBeingDragged ? " is-dragging" : ""}`}
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
                          const srcOvr = lookupOverride(overridesForDate, src);
                          const srcStart = srcOvr?.start || src.start; const srcEnd = srcOvr?.end || src.end;
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
                        >
                        {/* Card main row */}
                        <div className="sched-class-row">
                          {/* Drag handle */}
                          <div className="sched-class-handle" title="Drag to swap time slot">⇅</div>
                          {/* Class info */}
                          <div className="sched-class-info">
                            <div className="sched-class-title" style={{ textDecoration: isCancelled ? "line-through" : "none" }}>
                              {c.code ? `${c.code} — ` : ""}{c.name || LEGEND[c.code]?.name || "Class"}
                              {isCancelled && <span style={{ fontSize: 10, fontWeight: 800, background: "var(--danger)", color: "#fff", padding: "1px 7px", borderRadius: 4 }}>CANCELLED</span>}
                              {isEvent && !isCancelled && (
                                <span style={{
                                  fontSize: 10,
                                  fontWeight: 800,
                                  background: "linear-gradient(135deg, #10B981, #059669)",
                                  color: "#fff",
                                  padding: "1px 8px",
                                  borderRadius: 4,
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 3,
                                  boxShadow: "0 1px 4px rgba(16,185,129,0.3)"
                                }}>
                                  <PartyPopper size={11} /> CELEBRATION
                                </span>
                              )}
                              {isPlacement && !isCancelled && (
                                <span style={{
                                  fontSize: 10,
                                  fontWeight: 800,
                                  background: "linear-gradient(135deg, #2563EB, #1D4ED8)",
                                  color: "#fff",
                                  padding: "1px 8px",
                                  borderRadius: 4,
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 3,
                                  boxShadow: "0 1px 4px rgba(37,99,235,0.3)"
                                }}>
                                  <Briefcase size={11} /> PLACEMENT
                                </span>
                              )}
                              {isExam && !isCancelled && !isEvent && !isPlacement && <span style={{ fontSize: 10, fontWeight: 800, background: "var(--violet)", color: "#fff", padding: "1px 7px", borderRadius: 4 }}>EXAM</span>}
                              {isModified && !isCancelled && !isExam && !isEvent && !isPlacement && <span style={{ fontSize: 10, fontWeight: 800, background: "var(--amber)", color: "#000", padding: "1px 7px", borderRadius: 4 }}>OVERRIDDEN</span>}
                              {isGuest && <span style={{ fontSize: 10, fontWeight: 800, background: "var(--violet)", color: "#fff", padding: "1px 7px", borderRadius: 4 }}>GUEST</span>}
                            </div>
                            <div className="sched-class-meta" style={{ textDecoration: isCancelled ? "line-through" : "none" }}>
                              {displayStart}–{displayEnd} · Sec: {c.section === "Single" ? "All" : c.section} · Room: {displayRoom || "TBD"}
                            </div>
                          </div>
                          {/* Action buttons */}
                          <div className="sched-class-actions">
                            {isCancelled ? (
                              <button title="Restore class" onClick={() => {
                                const prev = flags.classOverrides;
                                restoreClass(liveEditorDate, ident, c.section);
                                setCmdUndoStack(s => [{ label: `Restored: ${c.code} on ${liveEditorDate}`, prevOverrides: prev }, ...s.slice(0, 9)]);
                              }} className="sched-class-btn" style={{ color: "var(--live)" }}>
                                <RefreshCw size={12} /> Restore
                              </button>
                            ) : (
                              <button title="Quick cancel this class" onClick={() => {
                                if (!window.confirm(`Cancel ${c.code} on ${liveEditorDate}?`)) return;
                                const prev = flags.classOverrides;
                                cancelClass(liveEditorDate, ident, c.section);
                                setCmdUndoStack(s => [{ label: `Cancelled: ${c.code} on ${liveEditorDate}`, prevOverrides: prev }, ...s.slice(0, 9)]);
                              }} className="sched-class-btn" style={{ borderColor: "var(--danger)", color: "var(--danger)" }}>
                                <XCircle size={12} /> Cancel
                              </button>
                            )}
                            <button title="Quick room change" onClick={() => {
                              setCmdQuickRoom(isQuickRoomOpen ? null : { date: liveEditorDate, classKey: ident + "_" + c.section });
                              setCmdQuickRoomValue(displayRoom || "");
                            }} className="sched-class-btn" style={{ borderColor: isQuickRoomOpen ? "var(--blue)" : "var(--border)", background: isQuickRoomOpen ? "rgba(59,130,246,0.10)" : "var(--bg)", color: isQuickRoomOpen ? "var(--blue)" : "var(--muted)" }}>
                              📍 Room
                            </button>
                            <button title="Full edit (timing, name, section, exam)" onClick={() => openLiveEditorModal(c)} className="sched-class-btn">
                              <Pencil size={12} /> Edit
                            </button>
                          </div>
                        </div>
                        {/* Quick room inline input */}
                        {isQuickRoomOpen && (
                          <div className="sched-quickroom">
                            <input autoFocus type="text" placeholder="New room (e.g. C-104)" className="admin-input"
                              value={cmdQuickRoomValue} onChange={e => setCmdQuickRoomValue(e.target.value)}
                              onKeyDown={e => { if (e.key === "Enter") document.getElementById("cmd-quick-room-save-" + idx)?.click(); if (e.key === "Escape") setCmdQuickRoom(null); }}
                              style={{ padding: "6px 10px", fontSize: 13 }} />
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
          <section className="admin-card admin-span-all admin-g-schedule schedule-ops-overview" style={{ gridColumn: "1 / -1" }}>
            <div className="schedule-ops-head"><div><span className="schedule-ops-eyebrow">Change control</span><h2><Shield size={20} color="var(--blue)" /> Schedule operations</h2><p className="admin-subtext">See what is staged before deployment and start the most common interventions from one place.</p></div><div className="schedule-ops-live"><span /> Staged locally</div></div>
            <div className="schedule-ops-metrics">
              <div><strong>{scheduleOverrideCount}</strong><span>total overrides</span></div>
              <div><strong>{upcomingOverrideCount}</strong><span>upcoming changes</span></div>
              <div className={scheduleConflicts.length ? "has-warning" : ""}><strong>{scheduleConflicts.length}</strong><span>room/time conflicts</span></div>
              <div><strong>{liveSchedule.filter(c => c.date >= scheduleToday && c.type !== "break").length}</strong><span>classes remaining</span></div>
            </div>
            <div className="schedule-ops-actions">
              <button type="button" className="admin-btn outline" onClick={() => { setHolidayStart(scheduleToday); setHolidayEnd(scheduleToday); }}><XCircle size={14} /> Prepare day-off</button>
              <button type="button" className="admin-btn outline" onClick={() => setRoomOverrideDate(scheduleToday)}><Pencil size={14} /> Edit today&apos;s class</button>
              <button type="button" className="admin-btn outline" onClick={() => setOvrFilterType("all")}><ListFilter size={14} /> Review overrides</button>
            </div>
          </section>
          {/* Holiday / Day-off bulk cancel */}
          <section className="admin-card admin-span-all admin-g-schedule schedule-action-card schedule-action-card--holiday" style={{ gridColumn: "1 / -1" }}>
            <h2><XCircle size={20} color="var(--danger)" /> Holiday / Day-off</h2>
            <p className="admin-subtext">Cancel every class across a date range in one action (e.g. a festival break). Stages overrides — Review &amp; Deploy Config to apply.</p>
            <div className="admin-field-row sched-range-row">
              <div className="admin-field"><label>From</label><input type="date" className="admin-input" value={holidayStart} onChange={e => setHolidayStart(e.target.value)} /></div>
              <div className="admin-field"><label>To</label><input type="date" className="admin-input" value={holidayEnd} onChange={e => setHolidayEnd(e.target.value)} /></div>
              <button className="admin-btn danger sched-range-btn" onClick={applyHolidayCancel}><XCircle size={15} /> Cancel All</button>
            </div>
            {holidayStart && holidayEnd && holidayEnd >= holidayStart && (
              <div className="sched-range-note">{liveSchedule.filter(c => c.date >= holidayStart && c.date <= holidayEnd && c.type !== "break").length} class(es) will be cancelled in this range.</div>
            )}
          </section>

          {/* Bulk room relocation */}
          <section className="admin-card admin-span-all admin-g-schedule schedule-action-card schedule-action-card--relocation" style={{ gridColumn: "1 / -1" }}>
            <h2><CalendarDays size={20} color="var(--blue)" /> Room Relocation</h2>
            <p className="admin-subtext">Move every class from one room to another across a date range (e.g. "all A01 classes → A04 until 2 Aug"). Stages room overrides — Review &amp; Deploy to apply.</p>
            <details className="sched-paste">
              <summary className="sched-paste-summary">📋 Paste from email / notice</summary>
              <div className="sched-paste-body">
                <textarea className="admin-input sched-paste-input" rows={3} value={relocEmail} onChange={e => setRelocEmail(e.target.value)} placeholder="e.g. Kindly note that room A01 will be shifted to A04 from 5 Aug to 12 Aug 2026." aria-label="Paste a room-change notice" />
                <button className="admin-btn outline sched-paste-btn" onClick={parseRelocationEmail}><Search size={14} /> Parse &amp; pre-fill</button>
              </div>
            </details>
            <div className="admin-field-row sched-range-row">
              <div className="admin-field"><label>From room</label><input className="admin-input" value={relocFrom} onChange={e => setRelocFrom(e.target.value)} placeholder="A01" /></div>
              <div className="admin-field"><label>To room</label><input className="admin-input" value={relocTo} onChange={e => setRelocTo(e.target.value)} placeholder="A04" /></div>
              <div className="admin-field"><label>From date</label><input type="date" className="admin-input" value={relocStart} onChange={e => setRelocStart(e.target.value)} /></div>
              <div className="admin-field"><label>To date</label><input type="date" className="admin-input" value={relocEnd} onChange={e => setRelocEnd(e.target.value)} /></div>
              <button className="admin-btn primary sched-range-btn" onClick={applyRoomRelocation}><CalendarDays size={15} /> Relocate</button>
            </div>
            {relocFrom.trim() && relocStart && relocEnd && relocEnd >= relocStart && (
              <div className="sched-range-note">{liveSchedule.filter(c => c.date >= relocStart && c.date <= relocEnd && c.type !== "break" && (c.room || "").toLowerCase() === relocFrom.trim().toLowerCase()).length} class(es) in {relocFrom.trim()} will move.</div>
            )}
          </section>

          {/* Room / time conflict detector */}
          <section className="admin-card admin-span-all admin-g-schedule schedule-conflicts-card" style={{ gridColumn: "1 / -1" }}>
            <h2><AlertTriangle size={20} color="var(--amber)" /> Room &amp; Time Conflicts</h2>
            <p className="admin-subtext">Same room booked for different classes at the same date &amp; time in the bundled schedule.</p>
            {scheduleConflicts.length === 0 ? (
              <div className="admin-empty">No conflicts detected.</div>
            ) : (
              <div className="sched-conflict-list">
                {scheduleConflicts.map((c, i) => (
                  <div key={i} className="sched-conflict-row">
                    <span className="sched-conflict-where"><b>{c.room}</b> @ {c.start} · {c.date}</span>
                    <span className="sched-conflict-codes">{c.codes.join(" vs ")}</span>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Class Editor */}
          <section className="admin-card admin-span-all admin-g-schedule schedule-action-card schedule-action-card--editor" style={{ gridColumn: "1 / -1" }}>
            <h2><CalendarDays size={20} color="var(--blue)" /> Class Editor</h2>
            <p className="admin-subtext">Globally change the classroom or timings for a specific class on a given date.</p>
            <div className="admin-field-row sched-editor-row" style={{ marginTop: 10 }}>
              <div className="admin-field sched-ed-wide">
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
            <div className="admin-field-row sched-editor-row">
              <div className="admin-field">
                <label>New Start <span className="admin-optional">(optional)</span></label>
                <input type="time" className="admin-input" value={roomOverrideStart} onChange={e => setRoomOverrideStart(e.target.value)} />
              </div>
              <div className="admin-field">
                <label>New End <span className="admin-optional">(optional)</span></label>
                <input type="time" className="admin-input" value={roomOverrideEnd} onChange={e => setRoomOverrideEnd(e.target.value)} />
              </div>
              <div className="admin-field sched-ed-wide">
                <label>New Classroom <span className="admin-optional">(optional)</span></label>
                <input type="text" placeholder="e.g. C-104" className="admin-input" value={roomOverrideRoom} onChange={e => setRoomOverrideRoom(e.target.value)} />
              </div>
            </div>
            <div className="sched-editor-actions">
               <button className="admin-btn blue" onClick={handleAddRoomOverride}><CalendarDays size={15} /> Save Change</button>
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
                 }} className="admin-btn outline" style={{ borderColor: "var(--danger)", color: "var(--danger)" }}>Remove Override</button>
               )}
            </div>
          </section>

          {/* Bulk Overrides & Copy */}
          <section className="admin-card admin-span-all admin-g-schedule schedule-bulk-tools" style={{ gridColumn: "1 / -1" }}>
             <div>
                <h2><CalendarDays size={20} color="var(--violet)" /> Copy Overrides</h2>
                <p className="admin-subtext">Duplicate all overrides (cancellations/rooms) from one day to another.</p>
                <div className="admin-field-row sched-editor-row" style={{ marginTop: 12 }}>
                   <div className="admin-field">
                      <label>Source Date</label>
                      <input type="date" className="admin-input" value={copySourceDate} onChange={e => setCopySourceDate(e.target.value)} />
                   </div>
                   <div className="admin-field">
                      <label>Target Date</label>
                      <input type="date" className="admin-input" value={copyTargetDate} onChange={e => setCopyTargetDate(e.target.value)} />
                   </div>
                </div>
                <button className="admin-btn outline sched-bulk-btn" onClick={() => {
                   if(!copySourceDate || !copyTargetDate) return alert("Select both dates.");
                   if(!flags.classOverrides?.[copySourceDate]) return alert("No overrides found on source date.");
                   if(!window.confirm(`Copy all overrides from ${copySourceDate} to ${copyTargetDate}?`)) return;
                   
                   const next = {...flags.classOverrides};
                   next[copyTargetDate] = JSON.parse(JSON.stringify(next[copySourceDate]));
                   setFlags({...flags, classOverrides: next});
                   setCopySourceDate(""); setCopyTargetDate("");
                }} >Copy to Target Date</button>
             </div>
             <div>
                <h2><FileText size={20} color="var(--blue)" /> Bulk CSV Importer</h2>
                <p className="admin-subtext">Format: Date,Code,Section,Room,Start,End,Cancel(true/false)</p>
                <textarea className="admin-textarea sched-csv-input" value={bulkCsv} onChange={e => setBulkCsv(e.target.value)} placeholder="2026-07-20,BM,A,C-104,10:00,11:30,false&#10;2026-07-21,QM,B,,,,true" rows={4} aria-label="Bulk override CSV"></textarea>
                <div className="sched-bulk-actions">
                <button className="admin-btn outline" onClick={() => {
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
                <button className="admin-btn outline" onClick={previewCsvImport}>Preview (dry run)</button>
                </div>
                {csvPreview && (
                   <div className="sched-csv-preview">
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
                let nCancelled = 0, nRoom = 0, nTime = 0, nExam = 0, nEvent = 0, nPlacement = 0, nCustom = 0;
                Object.values(flags.classOverrides).forEach(day => Object.values(day).forEach(ovr => {
                  if (ovr.type === "cancelled") nCancelled++;
                  else if (ovr.type === "exam") nExam++;
                  else if (ovr.type === "event") nEvent++;
                  else if (ovr.type === "placement") nPlacement++;
                  else if (ovr.type === "class") nCustom++;
                  else { if (ovr.room) nRoom++; if (ovr.start || ovr.end) nTime++; }
                }));
                const total = nCancelled + nRoom + nTime + nExam + nEvent + nPlacement + nCustom;
                return (
                  <div className="aco-filters">
                    {[
                      { label: `${total} Total`, color: "var(--text)", bg: "var(--bg)", filter: "all" },
                      { label: `${nCancelled} Cancelled`, color: "var(--danger)", bg: "rgba(231,76,60,0.06)", filter: "cancelled" },
                      { label: `${nRoom} Room`, color: "var(--blue)", bg: "rgba(59,130,246,0.06)", filter: "room" },
                      { label: `${nTime} Time`, color: "var(--amber)", bg: "rgba(245,158,11,0.06)", filter: "time" },
                      { label: `${nExam} Exam`, color: "var(--violet)", bg: "rgba(109,91,208,0.08)", filter: "exam" },
                      { label: `${nEvent} Event`, color: "var(--live, #10B981)", bg: "rgba(16,185,129,0.08)", filter: "event" },
                      { label: `${nPlacement} Placement`, color: "#2563EB", bg: "rgba(37,99,235,0.08)", filter: "placement" },
                      { label: `${nCustom} Custom`, color: "var(--live)", bg: "rgba(31,169,113,0.06)", filter: "custom" },
                    ].map(chip => (
                      <button key={chip.filter} onClick={() => setOvrFilterType(chip.filter)} className="aco-chip" aria-pressed={ovrFilterType === chip.filter}
                        style={{ borderColor: ovrFilterType === chip.filter ? chip.color : "var(--border)", background: ovrFilterType === chip.filter ? chip.bg : "transparent", color: ovrFilterType === chip.filter ? chip.color : "var(--muted)" }}>
                        {chip.label}
                      </button>
                    ))}
                    <input type="text" placeholder="Search code or room…" value={ovrSearch} onChange={e => setOvrSearch(e.target.value)} aria-label="Search overrides"
                      className="admin-input aco-search" />
                  </div>
                );
              })()}

              {/* Stale overrides alert */}
              {staleOverrideDates.length > 0 && (
                <div className="aco-stale">
                  <span><AlertTriangle size={15} color="var(--amber)" style={{ verticalAlign: "middle", marginRight: 6 }} />{staleOverrideDates.length} override date(s) are in the past — students still download them.</span>
                  <button className="admin-btn outline" onClick={purgeStaleOverrides} style={{ borderColor: "var(--amber)", color: "var(--amber)" }}><Trash2 size={14} /> Purge expired</button>
                </div>
              )}

              {/* Override rows */}
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {Object.entries(flags.classOverrides).flatMap(([date, classes]) =>
                  Object.entries(classes).map(([code, override]) => {
                    const isCancelled = override.type === "cancelled";
                    const isExam = override.type === "exam";
                    const isEvent = override.type === "event";
                    const isPlacement = override.type === "placement";
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
                      || (ovrFilterType === "event" && isEvent)
                      || (ovrFilterType === "placement" && isPlacement)
                      || (ovrFilterType === "custom" && isCustom)
                      || (ovrFilterType === "room" && hasRoom && !isCancelled && !isExam && !isEvent)
                      || (ovrFilterType === "time" && hasTime && !isCancelled && !isExam && !isEvent);
                    const matchesSearch = !ovrSearch || displayCode.toLowerCase().includes(ovrSearch.toLowerCase()) || (override.room || "").toLowerCase().includes(ovrSearch.toLowerCase());
                    if (!matchesType || !matchesSearch) return null;

                    // Type badge
                    const typeBadge = isCancelled ? { label: "CANCELLED", color: "var(--danger)", bg: "rgba(231,76,60,0.10)" }
                      : isEvent ? { label: "🎉 EVENT", color: "var(--live, #10B981)", bg: "rgba(16,185,129,0.14)" }
                      : isPlacement ? { label: "💼 PLACEMENT", color: "#2563EB", bg: "rgba(37,99,235,0.14)" }
                      : isExam ? { label: "EXAM", color: "var(--violet)", bg: "rgba(109,91,208,0.10)" }
                      : isCustom ? { label: "CUSTOM CLASS", color: "var(--live)", bg: "rgba(31,169,113,0.10)" }
                      : hasRoom && hasTime ? { label: `ROOM+TIME`, color: "var(--amber)", bg: "rgba(245,158,11,0.10)" }
                      : hasRoom ? { label: `ROOM: ${override.room}`, color: "var(--blue)", bg: "rgba(59,130,246,0.10)" }
                      : { label: `TIME: ${override.start || "?"}–${override.end || "?"}`, color: "var(--amber)", bg: "rgba(245,158,11,0.10)" };

                    return (
                      <div key={rowKey} className={`aco-row${isEditing ? " is-editing" : ""}`}>
                        {/* Main row */}
                        <div className="aco-row-main">
                          {/* Type badge */}
                          <span className="aco-badge" style={{ background: typeBadge.bg, color: typeBadge.color }}>{typeBadge.label}</span>
                          {/* Info */}
                          <div className="aco-info">
                            <div className="aco-title">
                              {new Date(date + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" })} — {displayCode}
                            </div>
                            {override.modifiedAt && (
                              <div className="aco-meta">
                                Modified {new Date(override.modifiedAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                                {override.modifiedBy ? ` · ${allUsers.find(u => u.user_id === override.modifiedBy)?.name || "admin"}` : ""}
                              </div>
                            )}
                          </div>
                          {/* Actions */}
                          <div className="aco-actions">
                            {isCancelled && (
                              <button title="Restore class" onClick={() => {
                                const prev = flags.classOverrides;
                                const next = { ...flags.classOverrides };
                                const forDate = { ...next[date] };
                                delete forDate[code];
                                if (Object.keys(forDate).length === 0) delete next[date]; else next[date] = forDate;
                                setFlags({ ...flags, classOverrides: next });
                                removeWithUndo(`Override removed — ${displayCode}`, () => setFlags(f => ({ ...f, classOverrides: prev })));
                              }} className="aco-btn" style={{ borderColor: "var(--live)", color: "var(--live)" }}>
                                <RefreshCw size={12} /> Restore
                              </button>
                            )}
                            {!isCancelled && (
                              <button title="Edit inline" onClick={() => {
                                if (isEditing) { setOvrEditKey(null); return; }
                                setOvrEditKey(rowKey);
                                setOvrEditValues({ room: override.room || "", start: override.start || "", end: override.end || "" });
                              }} className="aco-btn" style={{ borderColor: isEditing ? "var(--blue)" : "var(--border)", color: isEditing ? "var(--blue)" : "var(--muted)" }}>
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
                            }} className="aco-del" aria-label="Delete override">
                              <Trash2 size={15} color="var(--danger)" />
                            </button>
                          </div>
                        </div>
                        {/* Inline edit form */}
                        {isEditing && (
                          <div className="aco-edit">
                            <div className="admin-field aco-edit-field aco-edit-field--wide">
                              <label>Room</label>
                              <input type="text" placeholder="e.g. C-104" className="admin-input" value={ovrEditValues.room} onChange={e => setOvrEditValues(v => ({ ...v, room: e.target.value }))} />
                            </div>
                            <div className="admin-field aco-edit-field">
                              <label>New Start</label>
                              <input type="time" className="admin-input" value={ovrEditValues.start} onChange={e => setOvrEditValues(v => ({ ...v, start: e.target.value }))} />
                            </div>
                            <div className="admin-field aco-edit-field">
                              <label>New End</label>
                              <input type="time" className="admin-input" value={ovrEditValues.end} onChange={e => setOvrEditValues(v => ({ ...v, end: e.target.value }))} />
                            </div>
                            <button className="admin-btn primary aco-edit-btn"
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
                            <button className="admin-btn outline aco-edit-btn" onClick={() => setOvrEditKey(null)}>Cancel</button>
                          </div>
                        )}
                      </div>
                    );
                  }).filter(Boolean)
                )}
              </div>
            </section>
          )}
        <section className="admin-card admin-span-all admin-g-broadcast broadcast-command-deck" style={{ gridColumn: "1 / -1" }}>
          <div className="broadcast-command-head">
            <div><span className="broadcast-eyebrow">Audience communications</span><h2><Megaphone size={20} /> Broadcast</h2><p className="admin-subtext">Choose how students should see your message, then compose it below.</p></div>
            <button type="button" className="admin-btn outline" onClick={fetchDashboardData} disabled={statsLoading}><RefreshCw size={14} className={statsLoading ? "spin-icon" : ""} /> Refresh data</button>
          </div>
          <div className="broadcast-command-metrics">
            <div><span>Visible banners</span><strong>{broadcastOverview.activeBanners}</strong><small>shown in the app now</small></div>
            <div><span>Scheduled items</span><strong>{broadcastOverview.scheduledItems}</strong><small>future banners, pushes and links</small></div>
            <div><span>Push devices</span><strong>{broadcastOverview.subscribers}</strong><small>subscribed devices</small></div>
          </div>
          <div className="broadcast-section-heading"><div><strong>Start a message</strong><span>Select a channel to open its composer</span></div><a href="#broadcast-activity">View schedule &amp; results <ChevronRight size={14} /></a></div>
          <div className="broadcast-channel-guide" role="group" aria-label="Broadcast channel">
            <button type="button" className={openBcast.announcements ? "is-selected" : ""} aria-pressed={openBcast.announcements} onClick={() => selectBroadcastChannel("announcements")}><Megaphone size={18} /><span><strong>Banner</strong><small>Date-bound notice in the app</small><em>Saved with deploy</em></span><ChevronRight size={16} /></button>
            <button type="button" className={openBcast.push ? "is-selected" : ""} aria-pressed={openBcast.push} onClick={() => selectBroadcastChannel("push")}><BellRing size={18} /><span><strong>Web push</strong><small>Alert subscribed devices</small><em>Send now or schedule</em></span><ChevronRight size={16} /></button>
            <button type="button" className={openBcast.social ? "is-selected" : ""} aria-pressed={openBcast.social} onClick={() => selectBroadcastChannel("social")}><Sparkles size={18} /><span><strong>Social flash</strong><small>Brief alert to active users</small><em>Send live</em></span><ChevronRight size={16} /></button>
          </div>
        </section>

                {/* ── 1. Broadcast Studio (Announcements + Push + Social Flash + Quiet Hours) ── */}
        <section className="admin-card admin-span-all admin-g-broadcast broadcast-studio-card" style={{ gridColumn: "1 / -1" }}>
          <div className="bcast-studio-head">
            <div>
              <span className="broadcast-eyebrow">Composer</span>
              <h2 style={{ marginBottom: 4 }}>Create your message</h2>
              <p className="admin-subtext" style={{ margin: 0 }}>Review the audience and delivery timing before you send.</p>
            </div>
            <div className="broadcast-studio-note">
              {(openBcast.announcements || openBcast.push || openBcast.social) && <AdminActionBadge mode={openBcast.announcements || (openBcast.push && pushScheduleDate && pushScheduleTime) ? "staged" : "live"} />}
              {openBcast.announcements ? "Save changes, then deploy" : openBcast.push ? (Boolean(pushScheduleDate) !== Boolean(pushScheduleTime) ? "Complete date and time" : pushScheduleDate ? "Scheduled push requires deploy" : "Immediate sends queue for delivery") : openBcast.social ? "Sends to active sessions" : "Select a channel above"}
            </div>
          </div>

          <div className="bcast-acc-stack">
                        {/* ── Accordion 1: In-App Scheduled Announcements ── */}
            <div className="bcast-acc" style={{ borderColor: openBcast.announcements ? "var(--amber)" : "var(--border)" }}>
              <div
                className="bcast-acc-head"
                role="button"
                tabIndex={0}
                aria-expanded={openBcast.announcements}
                onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleBroadcastChannel("announcements"); } }}
                onClick={() => toggleBroadcastChannel("announcements")}
                style={{ background: openBcast.announcements ? "rgba(245,158,11,0.06)" : "transparent" }}>
                <div className="bcast-acc-title">
                  <Megaphone size={17} color="var(--amber)" />
                  <span className="bcast-acc-name">In-App Banner Announcements</span>
                  {(flags.scheduledAnnouncements || []).length > 0 && (
                    <span className="bcast-acc-badge" style={{ background: "rgba(245,158,11,0.15)", color: "var(--amber)" }}>
                      {flags.scheduledAnnouncements.length} active
                    </span>
                  )}
                </div>
                <span className="bcast-acc-toggle">{openBcast.announcements ? "▲" : "▼"}<em>{openBcast.announcements ? "Collapse" : "Expand"}</em></span>
              </div>

              {openBcast.announcements && (
                <div className="bcast-acc-body">
                  
                  {/* Template presets library */}
                  {(flags.announcementTemplates || []).length > 0 && (
                    <div className="bcast-chip-row">
                      <span className="bcast-chip-row-label">Templates:</span>
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
                    <div className="bcast-field-head">
                      <label className="bcast-field-label">Schedule &amp; Dates</label>
                      <div className="bcast-preset-row">
                        {[
                          { label: "Today", days: 0 },
                          { label: "Next 3 Days", days: 3 },
                          { label: "This Week", days: 7 },
                          { label: "2 Weeks", days: 14 },
                          { label: "Term End", termEnd: snapshotMeta.termEnd },
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
                            className="bcast-preset-chip">
                            {p.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="bcast-control-row">
                      <input type="date" value={announcementStart} onChange={e => setAnnouncementStart(e.target.value)} className="admin-input bcast-control bcast-control--date" title="Start Date" aria-label="Announcement start date" />
                      <input type="date" value={announcementEnd} onChange={e => setAnnouncementEnd(e.target.value)} className="admin-input bcast-control bcast-control--date" title="End Date (Inclusive)" aria-label="Announcement end date" />
                      <select className="admin-input bcast-control bcast-control--audience" value={announcementTarget} onChange={e => setAnnouncementTarget(e.target.value)} aria-label="Announcement audience">
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
                      <select className="admin-input bcast-control bcast-control--severity" value={announcementSeverity} onChange={e => setAnnouncementSeverity(e.target.value)} title="Banner severity / colour" aria-label="Banner severity">
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
                    <div className="bcast-field-head">
                      <label className="bcast-field-label">Announcement Message</label>
                      <div className="bcast-icon-row">
                        <span className="bcast-icon-row-label">Add icon:</span>
                        {["⚡", "📢", "🚨", "🎉", "🎓", "ℹ️", "🗓️", "🔔"].map(em => (
                          <button key={em} type="button" onClick={() => setAnnouncement(prev => prev ? `${em} ${prev}` : `${em} `)}
                            className="bcast-icon-btn" aria-label={`Prefix message with ${em}`}>
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
                      <div className="bcast-field-head">
                        <span className="bcast-field-label">Student In-App Live Preview</span>
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
                          <div className="bcast-preview-stage" style={{ background: previewTheme === "dark" ? "#101216" : "#F3F1EA" }}>
                            <div className="bcast-preview-banner" style={{ background: bg, color: fg }}>
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
                  <div className="bcast-actions">
                    <button className="admin-btn primary" onClick={() => {
                      if (!announcement.trim() || !announcementStart || !announcementEnd) return alert("Please fill message and start/end dates.");
                      const newItem = { id: Date.now().toString(), message: announcement.trim(), target: announcementTarget, start: announcementStart, end: announcementEnd, severity: announcementSeverity };
                      setFlags({...flags, scheduledAnnouncements: [...(flags.scheduledAnnouncements || []), newItem]});
                      setAnnouncement(""); setAnnouncementStart(""); setAnnouncementEnd(""); setAnnouncementSeverity("info");
                    }}>
                      <Megaphone size={14} /> Add Scheduled Announcement
                    </button>
                    <input className="admin-input bcast-tpl-input" value={tplLabel} onChange={e => setTplLabel(e.target.value)} placeholder="Template name (e.g. Exam)" aria-label="Template name" />
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
                        <div className="bcast-list-toolbar">
                          <div className="bcast-filter-row">
                            {[
                              { id: "all", label: `All (${items.length})` },
                              { id: "active", label: `🟢 Live Now (${nActive})` },
                              { id: "upcoming", label: `🟣 Upcoming (${nUpcoming})` },
                              { id: "expired", label: `🔴 Expired (${nExpired})` },
                            ].map(f => (
                              <button key={f.id} type="button" onClick={() => setAnnFilter(f.id)}
                                className="bcast-filter-chip" aria-pressed={annFilter === f.id}
                                style={{ border: annFilter === f.id ? "1.5px solid var(--blue)" : "1px solid var(--border)", background: annFilter === f.id ? "rgba(59,130,246,0.10)" : "var(--card)", color: annFilter === f.id ? "var(--blue)" : "var(--muted)", fontWeight: annFilter === f.id ? 700 : 500 }}>
                                {f.label}
                              </button>
                            ))}
                          </div>
                          <div className="bcast-search-row">
                            <input type="text" placeholder="Search banners…" value={annSearch} onChange={e => setAnnSearch(e.target.value)} aria-label="Search banners"
                              className="admin-input bcast-search-input" />
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
                                  <div className="bcast-item-head">
                                    <div className="bcast-item-meta">
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
                                    <div className="bcast-item-actions">
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
                                      <div className="bcast-control-row">
                                        <input type="date" value={editAnnStart} onChange={e => setEditAnnStart(e.target.value)} className="admin-input bcast-control bcast-control--date" aria-label="Start date" />
                                        <input type="date" value={editAnnEnd} onChange={e => setEditAnnEnd(e.target.value)} className="admin-input bcast-control bcast-control--date" aria-label="End date" />
                                        <select className="admin-input bcast-control bcast-control--audience" value={editAnnTarget} onChange={e => setEditAnnTarget(e.target.value)} aria-label="Audience">
                                          <option value="global">🌐 Global</option>
                                          <option value="section_A">🅰️ Section A</option>
                                          <option value="section_B">🅱️ Section B</option>
                                          <option value="has_friends">👥 Social</option>
                                          {Object.keys(LEGEND || {}).map(c => <option key={c} value={`subject_${c}`}>{c}</option>)}
                                        </select>
                                        <select className="admin-input bcast-control bcast-control--severity" value={editAnnSeverity} onChange={e => setEditAnnSeverity(e.target.value)} aria-label="Severity">
                                          <option value="info">🟣 Info</option>
                                          <option value="warning">🟡 Warning</option>
                                          <option value="urgent">🔴 Urgent</option>
                                          <option value="celebration">🟢 Celebration</option>
                                          <option value="exam">🎓 Exam</option>
                                        </select>
                                      </div>
                                      <textarea className="admin-textarea" rows={2} value={editAnnMsg} onChange={e => setEditAnnMsg(e.target.value)} />
                                      <div className="bcast-actions">
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
            <div className="bcast-acc" style={{ borderColor: openBcast.push ? "var(--live)" : "var(--border)" }}>
              <div
                className="bcast-acc-head"
                role="button"
                tabIndex={0}
                aria-expanded={openBcast.push}
                onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleBroadcastChannel("push"); } }}
                onClick={() => toggleBroadcastChannel("push")}
                style={{ background: openBcast.push ? "rgba(31,169,113,0.06)" : "transparent" }}>
                <div className="bcast-acc-title">
                  <BellRing size={17} color="var(--live)" />
                  <span className="bcast-acc-name">Web Push Notifications</span>
                  {(flags.scheduledPushes || []).length > 0 && (
                    <span className="bcast-acc-badge" style={{ background: "rgba(31,169,113,0.15)", color: "var(--live)" }}>
                      {flags.scheduledPushes.length} queued
                    </span>
                  )}
                </div>
                <span className="bcast-acc-toggle">{openBcast.push ? "▲" : "▼"}<em>{openBcast.push ? "Collapse" : "Expand"}</em></span>
              </div>

              {openBcast.push && (
                <div className="bcast-acc-body">
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

                  <div className="broadcast-delivery-summary" aria-live="polite">
                    <div><span>Audience</span><strong>{pushTarget === "all" ? "Everyone" : `${audienceIds(pushTarget)?.length ?? 0} matching students`}</strong><small>{pushTarget === "all" ? `${broadcastOverview.subscribers} push-ready devices` : "In-app entry and push when subscribed"}</small></div>
                    <div><span>Timing</span><strong>{pushScheduleDate && pushScheduleTime ? `${pushScheduleDate} at ${pushScheduleTime}` : pushScheduleDate || pushScheduleTime ? "Finish date and time" : "Send now"}</strong><small>{pushScheduleDate && pushScheduleTime ? "Queued with next deploy" : pushScheduleDate || pushScheduleTime ? "Both fields are needed to schedule" : "Usually arrives within a minute"}</small></div>
                    <div><span>Action</span><strong>{pushScheduleDate && pushScheduleTime ? "Stage scheduled push" : "Send live push"}</strong><small>{pushScheduleDate && pushScheduleTime ? "Save and deploy changes to activate" : "Affects real recipients"}</small></div>
                  </div>

                  <PushPreview title={pushTitle} body={pushBody} url={pushUrl} when={pushScheduleDate && pushScheduleTime ? `${pushScheduleDate} · ${pushScheduleTime}` : "now"} />

                  <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                    <button className="admin-btn primary" onClick={() => {
                      if (pushScheduleDate && pushScheduleTime) {
                        if (pushTarget !== "all") return alert("Scheduled pushes currently go to everyone. For a targeted push, clear the schedule and send now.");
                        if (!pushTitle.trim() || !pushBody.trim()) return alert("Fill in title and message.");
                        if (new Date(`${pushScheduleDate}T${pushScheduleTime}:00`).getTime() <= Date.now()) return alert("Choose a future date and time for a scheduled push.");
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
                    }} disabled={pushSending || Boolean(pushScheduleDate) !== Boolean(pushScheduleTime)}>
                      <BellRing size={14} /> {pushSending ? "Sending..." : (pushScheduleDate && pushScheduleTime ? "Queue Push Notification" : pushTarget !== "all" ? "Send to Audience" : "Send to All Subscribers")}
                    </button>
                    <button className="admin-btn outline" onClick={sendTestPushToMe} disabled={pushSending} title="Delivers only to your own subscribed devices — arrives within ~1 min">
                      <BellRing size={14} /> Send test to me
                    </button>
                    {pushResult && (
                      <span className="admin-subtext" role="status" style={{ margin: 0, color: pushResult.startsWith("Sent") || pushResult.startsWith("Push scheduled") || pushResult.startsWith("Test") ? "var(--live)" : "var(--danger)" }}>{pushResult}</span>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* ── Accordion 3: Social Flash Notifications ── */}
            <div className="bcast-acc" style={{ borderColor: openBcast.social ? "var(--violet)" : "var(--border)" }}>
              <div
                className="bcast-acc-head"
                role="button"
                tabIndex={0}
                aria-expanded={openBcast.social}
                onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleBroadcastChannel("social"); } }}
                onClick={() => toggleBroadcastChannel("social")}
                style={{ background: openBcast.social ? "rgba(139,92,246,0.06)" : "transparent" }}>
                <div className="bcast-acc-title">
                  <Sparkles size={17} color="var(--violet)" />
                  <span className="bcast-acc-name">Social Flash Toast Notifications</span>
                  <span className="bcast-acc-badge is-realtime">REALTIME</span>
                </div>
                <span className="bcast-acc-toggle">{openBcast.social ? "▲" : "▼"}<em>{openBcast.social ? "Collapse" : "Expand"}</em></span>
              </div>

              {openBcast.social && (
                <div className="bcast-acc-body">
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
                    <div className="bcast-field-head">
                      <span className="bcast-field-label">Live Toast Preview ({socialFlashDuration / 1000}s)</span>
                      <button type="button" onClick={testSocialFlashLocal} className="admin-btn outline bcast-test-btn" style={{ color: "var(--violet)", borderColor: "rgba(139,92,246,0.3)" }}>
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

                  <div className="bcast-actions">
                    <button
                      type="button"
                      className="admin-btn primary bcast-flash-send"
                      disabled={socialFlashSending}
                      onClick={triggerSocialFlashBroadcast}
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
          <div className="bcast-quiet-row">
            <div className="bcast-quiet-controls">
              <label className="admin-flag-item" style={{ margin: 0, fontSize: 13 }}>
                <input type="checkbox" checked={!!quietHours.enabled} onChange={e => setFlags({ ...flags, quietHours: { ...quietHours, enabled: e.target.checked } })} />
                <span style={{ fontWeight: 600 }}>Quiet Hours Guard (IST)</span>
              </label>
              <div className="bcast-quiet-times" style={{ opacity: quietHours.enabled ? 1 : 0.45 }}>
                <input type="time" className="admin-input" aria-label="Quiet hours start" value={quietHours.start || "23:00"} disabled={!quietHours.enabled} onChange={e => setFlags({ ...flags, quietHours: { ...quietHours, start: e.target.value } })} />
                <span>to</span>
                <input type="time" className="admin-input" aria-label="Quiet hours end" value={quietHours.end || "07:00"} disabled={!quietHours.enabled} onChange={e => setFlags({ ...flags, quietHours: { ...quietHours, end: e.target.value } })} />
              </div>
            </div>
            {quietHours.enabled && (() => { const q = inQuietHours(flashNow); return (
              <div className="bcast-quiet-status" style={{ color: q ? "var(--danger)" : "var(--live)" }}>
                <span style={{ background: q ? "var(--danger)" : "var(--live)" }} />
                {q ? "Within quiet hours (warning active)" : "Outside quiet hours (normal)"}
              </div>
            ); })()}
          </div>
        </section>

        {/* ── 2. Mission Control (Timeline Agenda + Delivery Stats + Queued Pushes) ── */}
        <section id="broadcast-activity" className="admin-card admin-span-all admin-g-broadcast" style={{ gridColumn: "1 / -1" }}>
          <h2><Clock size={20} color="var(--live)" /> Broadcast Mission Control</h2>
          <p className="admin-subtext">Unified schedule of upcoming pushes, active banners, and recent broadcast delivery performance.</p>

          {/* Scheduled Timeline Agenda */}
          <div style={{ marginTop: 12, marginBottom: 16 }}>
            <div className="bmc-section-label">Scheduled Timeline Agenda</div>
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
                      {newDay && <div className="bmc-day-head">{day ? new Date(day).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" }) : "Undated"}</div>}
                      <div className={`bmc-agenda-row${sameSlot ? " is-collision" : ""}`} title={sameSlot ? "Fires in the same slot as the item above — possible collision" : ""}>
                        <span className="bmc-agenda-dot" style={{ background: it.color }} />
                        <span className="bmc-agenda-kind" style={{ color: it.color }}>{it.kind}</span>
                        <span className="bmc-agenda-label">{it.label}</span>
                        <span className="bmc-agenda-when">{it.when}{it.end ? ` → ${it.end}` : ""}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Collapsible Queued Pushes */}
          {flags.scheduledPushes && flags.scheduledPushes.length > 0 && (
            <details className="bmc-details" style={{ marginBottom: 12 }}>
              <summary className="bmc-summary">
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
          <details className="bmc-details" open>
            <summary className="bmc-summary">
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
                      <div key={s.dedup_key} className="bmc-stat-card">
                        <div className="bmc-stat-head">
                          <span className="bmc-stat-title">{s.title || "(no title)"}</span>
                          <span className="bmc-stat-date">{new Date(s.sent_at).toLocaleDateString()}</span>
                        </div>
                        <div className="bmc-stat-nums">
                          <span><b>{s.total}</b> sent</span>
                          <span style={{ color: "var(--blue)" }}><b>{s.delivered}</b> delivered ({dPct}%)</span>
                          <span style={{ color: "var(--live)" }}><b>{s.opened}</b> opened ({oPct}%)</span>
                        </div>
                        <div className="bmc-stat-bar">
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
          <div className="bcast-studio-head">
            <div>
              <h2 style={{ marginBottom: 4 }}><Sparkles size={20} color="var(--violet)" /> App Content Hub</h2>
              <p className="admin-subtext" style={{ margin: 0 }}>Publish in-app feature notes, dynamic sidebar links, and client update prompts.</p>
            </div>
            <div className="bcast-tabs" role="group" aria-label="Content sections">
              <button
                type="button"
                className="bcast-tab"
                aria-pressed={openContent.whatsNew}
                onClick={() => setOpenContent(o => ({ ...o, whatsNew: !o.whatsNew }))}
                style={{
                  border: openContent.whatsNew ? "1.5px solid var(--violet)" : "1px solid var(--border)",
                  background: openContent.whatsNew ? "rgba(109,91,208,0.12)" : "var(--bg)",
                  color: openContent.whatsNew ? "var(--violet)" : "var(--muted)",
                }}>
                <Sparkles size={14} /> What&rsquo;s New {(flags.whatsNew || []).length > 0 ? `(${flags.whatsNew.length})` : ""}
              </button>
              <button
                type="button"
                className="bcast-tab"
                aria-pressed={openContent.quickLinks}
                onClick={() => setOpenContent(o => ({ ...o, quickLinks: !o.quickLinks }))}
                style={{
                  border: openContent.quickLinks ? "1.5px solid var(--blue)" : "1px solid var(--border)",
                  background: openContent.quickLinks ? "rgba(59,130,246,0.12)" : "var(--bg)",
                  color: openContent.quickLinks ? "var(--blue)" : "var(--muted)",
                }}>
                <Flag size={14} /> Quick Links {(flags.quickLinks || []).length > 0 ? `(${flags.quickLinks.length})` : ""}
              </button>
              <button
                type="button"
                className="bcast-tab"
                aria-pressed={openContent.updatePrompt}
                onClick={() => setOpenContent(o => ({ ...o, updatePrompt: !o.updatePrompt }))}
                style={{
                  border: openContent.updatePrompt ? "1.5px solid var(--live)" : "1px solid var(--border)",
                  background: openContent.updatePrompt ? "rgba(31,169,113,0.12)" : "var(--bg)",
                  color: openContent.updatePrompt ? "var(--live)" : "var(--muted)",
                }}>
                <RefreshCw size={14} /> Update Prompt
              </button>
            </div>
          </div>

          <div className="bcast-acc-stack">
            {/* ── Content Section 1: What's New ── */}
            <div className="bcast-acc" style={{ borderColor: openContent.whatsNew ? "var(--violet)" : "var(--border)" }}>
              <div
                className="bcast-acc-head"
                role="button"
                tabIndex={0}
                aria-expanded={openContent.whatsNew}
                onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpenContent(o => ({ ...o, whatsNew: !o.whatsNew })); } }}
                onClick={() => setOpenContent(o => ({ ...o, whatsNew: !o.whatsNew }))}
                style={{ background: openContent.whatsNew ? "rgba(109,91,208,0.06)" : "transparent" }}>
                <div className="bcast-acc-title">
                  <Sparkles size={17} color="var(--violet)" />
                  <span className="bcast-acc-name">What&rsquo;s New (Feature Updates)</span>
                  {(flags.whatsNew || []).length > 0 && (
                    <span className="bcast-acc-badge" style={{ background: "rgba(109,91,208,0.15)", color: "var(--violet)" }}>
                      {flags.whatsNew.length} entries
                    </span>
                  )}
                </div>
                <span className="bcast-acc-toggle">{openContent.whatsNew ? "▲" : "▼"}<em>{openContent.whatsNew ? "Collapse" : "Expand"}</em></span>
              </div>

              {openContent.whatsNew && (
                <div className="bcast-acc-body">
                  <div className="admin-field-row content-emoji-row">
                    <div className="admin-field content-emoji-field">
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
            <div className="bcast-acc" style={{ borderColor: openContent.quickLinks ? "var(--blue)" : "var(--border)" }}>
              <div
                className="bcast-acc-head"
                role="button"
                tabIndex={0}
                aria-expanded={openContent.quickLinks}
                onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpenContent(o => ({ ...o, quickLinks: !o.quickLinks })); } }}
                onClick={() => setOpenContent(o => ({ ...o, quickLinks: !o.quickLinks }))}
                style={{ background: openContent.quickLinks ? "rgba(59,130,246,0.06)" : "transparent" }}>
                <div className="bcast-acc-title">
                  <Flag size={17} color="var(--blue)" />
                  <span className="bcast-acc-name">Dynamic Quick Links</span>
                  {(flags.quickLinks || []).length > 0 && (
                    <span className="bcast-acc-badge" style={{ background: "rgba(59,130,246,0.15)", color: "var(--blue)" }}>
                      {flags.quickLinks.length} active
                    </span>
                  )}
                </div>
                <span className="bcast-acc-toggle">{openContent.quickLinks ? "▲" : "▼"}<em>{openContent.quickLinks ? "Collapse" : "Expand"}</em></span>
              </div>

              {openContent.quickLinks && (
                <div className="bcast-acc-body">
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <input type="text" placeholder="Link Title (e.g. Exam Portal)" value={qlTitle} onChange={e => setQlTitle(e.target.value)} className="admin-input" style={{ flex: 1, padding: "8px", minWidth: 150 }} />
                    <input type="url" placeholder="https://..." value={qlUrl} onChange={e => setQlUrl(e.target.value)} className="admin-input" style={{ flex: 2, padding: "8px", minWidth: 200 }} />
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <input type="date" value={qlStart} onChange={e => setQlStart(e.target.value)} className="admin-input" style={{ flex: "1 1 130px", padding: "8px" }} title="Start Date" />
                    <input type="date" value={qlEnd} onChange={e => setQlEnd(e.target.value)} className="admin-input" style={{ flex: "1 1 130px", padding: "8px" }} title="End Date (Inclusive)" />
                    <button className="admin-btn primary" style={{ flex: "1 1 130px" }} onClick={() => {
                      if (!qlTitle || !qlUrl || !qlStart || !qlEnd) return alert("Fill all fields.");
                      const safe = safeUrl(qlUrl);
                      if (!safe) return alert("That URL isn't allowed — links must start with http://, https:// or mailto:.");
                      const newItem = { id: Date.now().toString(), title: qlTitle, url: safe, start: qlStart, end: qlEnd };
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
            <div className="bcast-acc" style={{ borderColor: openContent.updatePrompt ? "var(--live)" : "var(--border)" }}>
              <div
                className="bcast-acc-head"
                role="button"
                tabIndex={0}
                aria-expanded={openContent.updatePrompt}
                onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpenContent(o => ({ ...o, updatePrompt: !o.updatePrompt })); } }}
                onClick={() => setOpenContent(o => ({ ...o, updatePrompt: !o.updatePrompt }))}
                style={{ background: openContent.updatePrompt ? "rgba(31,169,113,0.06)" : "transparent" }}>
                <div className="bcast-acc-title">
                  <RefreshCw size={17} color="var(--live)" />
                  <span className="bcast-acc-name">Update Prompt Text</span>
                </div>
                <span className="bcast-acc-toggle">{openContent.updatePrompt ? "▲" : "▼"}<em>{openContent.updatePrompt ? "Collapse" : "Expand"}</em></span>
              </div>

              {openContent.updatePrompt && (
                <div className="bcast-acc-body">
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

                  {/* Target Courses Selector — a wrap of pills on a wide screen,
                      a collapsed dropdown on a phone (28 courses is 28 rows there). */}
                  {(() => {
                    const picked = ff.subjects || [];
                    const isOpen = openCourseTargets === ff.id;
                    const summary = picked.length === 0 ? "All courses / Everyone" : `${picked.length} selected`;
                    return (
                  <div className="admin-field bcast-course-field">
                    <div className="bcast-field-head">
                      <label>Target Courses <span className="admin-optional">({picked.length === 0 ? "All Courses / Everyone" : `${picked.length} selected`})</span></label>
                      <div className="bcast-course-bulk">
                        <button type="button" onClick={() => {
                          setFeedbackFlashes(feedbackFlashes.map(f => f.id === ff.id ? { ...f, subjects: Object.keys(LEGEND) } : f));
                        }} className="bcast-course-link is-primary">
                          Select All
                        </button>
                        <span aria-hidden="true">|</span>
                        <button type="button" onClick={() => {
                          setFeedbackFlashes(feedbackFlashes.map(f => f.id === ff.id ? { ...f, subjects: [] } : f));
                        }} className="bcast-course-link">
                          Clear All (Everyone)
                        </button>
                      </div>
                    </div>

                    <button
                      type="button"
                      className="bcast-course-toggle"
                      aria-expanded={isOpen}
                      onClick={() => setOpenCourseTargets(isOpen ? null : ff.id)}
                    >
                      <span>{summary}</span>
                      <ChevronRight size={16} className={isOpen ? "is-open" : ""} />
                    </button>

                    <div className={`bcast-course-grid${isOpen ? " is-open" : ""}`}>
                      {Object.keys(LEGEND).map(code => {
                        const isSelected = picked.includes(code);
                        return (
                          <button
                            key={code}
                            type="button"
                            onClick={() => {
                              const newSubjects = isSelected ? picked.filter(c => c !== code) : [...picked, code];
                              setFeedbackFlashes(feedbackFlashes.map(f => f.id === ff.id ? { ...f, subjects: newSubjects } : f));
                            }}
                            className={`bcast-course-chip${isSelected ? " is-selected" : ""}`}
                            aria-pressed={isSelected}
                            title={LEGEND[code].name}
                          >
                            {code}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                    );
                  })()}
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
          <section className="admin-users-overview admin-span-all admin-g-users">
            <div className="admin-users-overview-head">
              <div>
                <span className="admin-users-kicker"><Users size={14} /> User operations</span>
                <h2>Understand the cohort. Act on the exceptions.</h2>
                <p>One place to monitor adoption, find a student, and take a safe account action.</p>
              </div>
              <button type="button" className="admin-btn outline" onClick={fetchDashboardData} disabled={statsLoading}>
                <RefreshCw size={14} className={statsLoading ? "spin-icon" : ""} /> Refresh users
              </button>
            </div>
            <div className="admin-users-metrics">
              {[
                { id: "all", label: "Registered", value: userOpsStats.total, note: "Production profiles", tone: "violet", Icon: Users },
                { id: "active7", label: "Active in 7 days", value: userOpsStats.activeWeek, note: userOpsStats.total ? `${Math.round((userOpsStats.activeWeek / userOpsStats.total) * 100)}% of users` : "No users yet", tone: "green", Icon: Activity },
                { id: "setup", label: "Need setup", value: userOpsStats.needsSetup, note: "No courses selected", tone: "amber", Icon: GraduationCap },
                { id: "attention", label: "Need attention", value: userOpsStats.atRisk, note: `${userOpsStats.neverSeen} never active`, tone: "coral", Icon: AlertTriangle },
              ].map(({ id, label, value, note, tone, Icon }) => (
                <button type="button" className={`admin-users-metric is-${tone}`} key={id} onClick={() => { setUserStatusFilter(id); document.getElementById("admin-user-directory")?.scrollIntoView({ behavior: "smooth", block: "start" }); }}>
                  <span className="admin-users-metric-icon"><Icon size={17} /></span>
                  <span><small>{label}</small><strong>{statsLoading ? "…" : value}</strong><em>{note}</em></span>
                  <ChevronRight size={15} className="admin-users-metric-arrow" />
                </button>
              ))}
            </div>
            <div className="admin-users-attention">
              <span><BellRing size={14} /> Push reach <strong>{pushSubscriberIds.size}</strong></span>
              <button type="button" onClick={() => { setUserStatusFilter("never"); document.getElementById("admin-user-directory")?.scrollIntoView({ behavior: "smooth", block: "start" }); }}>{userOpsStats.neverSeen} never active</button>
              <button type="button" onClick={() => { setUserStatusFilter("banned"); document.getElementById("admin-user-directory")?.scrollIntoView({ behavior: "smooth", block: "start" }); }}>{userOpsStats.banned} banned</button>
              <span className="admin-users-attention-note">Metrics use the latest profile heartbeat and saved enrollment.</span>
            </div>
          </section>

          {/* Onboarding funnel */}
          <section className="admin-card admin-g-users admin-users-funnel" style={{ display: "flex", flexDirection: "column" }}>
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
                <div className="funnel-list">
                  {steps.map((s, i) => {
                    const pct = Math.round((s.n / max) * 100);
                    const prev = i > 0 ? steps[i - 1].n : null;
                    const drop = prev != null && prev > 0 ? Math.round(((prev - s.n) / prev) * 100) : null;
                    return (
                      <div key={s.label}>
                        <div className="funnel-head">
                          <span className="funnel-label">{s.label}</span>
                          <span className="funnel-value"><b>{s.n}</b> <span>({pct}%{drop != null && drop > 0 ? `, −${drop}%` : ""})</span></span>
                        </div>
                        <div className="funnel-track">
                          <div className="funnel-fill" style={{ width: `${pct}%`, background: s.color }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </section>

             {/* Enrollment Distribution */}
             <section className="admin-card admin-g-users admin-users-enrollment">
               <h2><Database size={20} color="var(--violet)" /> Enrollment Stats</h2>
               <p className="admin-subtext">Top 5 most popular courses by enrollment.</p>
               <div className="funnel-list enroll-list">
                  {popularCourses.length === 0 ? <div className="admin-empty">No data.</div> : 
                     popularCourses.slice(0, 5).map(([code, count]) => {
                        const max = popularCourses[0][1];
                        const pct = Math.round((count / max) * 100);
                        return (
                           <div key={code}>
                              <div className="funnel-head">
                                 <span className="funnel-label" title={LEGEND?.[code]?.name || code}>{code}</span>
                                 <span className="funnel-value"><span>{count} enrolled</span></span>
                              </div>
                              <div className="funnel-track">
                                 <div className="funnel-fill" style={{ width: `${pct}%`, background: "var(--violet)" }}></div>
                              </div>
                           </div>
                        )
                     })
                  }
               </div>
             </section>

        <section id="admin-user-directory" className="admin-card admin-directory-card admin-span-all admin-g-users admin-users-directory">
          <header className="admin-users-directory-head">
            <div>
              <span className="admin-users-kicker"><Search size={13} /> Directory</span>
              <h2>User Directory</h2>
              <p>Search by name, email, or ID. Filters can be combined.</p>
            </div>
            <button className="admin-btn outline" onClick={() => exportCsv(
              "termflow-users-filtered.csv",
              ["User ID", "Name", "Email", "Section", "Courses", "Last active", "Push", "Banned"],
              filteredUsers.map(u => [u.user_id, u.name || "", u.email || "", userSection(u), Object.keys(u.courses || {}).filter(c => !c.startsWith("_")).join(";"), u.last_seen_at || "", pushSubscriberIds.has(u.user_id) ? "Yes" : "No", flags.bannedUsers?.includes(u.user_id) ? "Yes" : "No"]),
            )} disabled={filteredUsers.length === 0}><Download size={14} /> Export {filteredUsers.length}</button>
          </header>

          <div className="admin-users-toolbar">
            <label className="admin-users-search">
              <Search size={16} aria-hidden="true" />
              <input type="search" placeholder="Search name, email, or user ID" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
              {searchQuery && <button type="button" onClick={() => setSearchQuery("")} aria-label="Clear search"><X size={14} /></button>}
            </label>
            <label className="admin-users-select"><Filter size={14} /><span>Section</span><select value={userSectionFilter} onChange={e => setUserSectionFilter(e.target.value)}><option value="All">All</option><option value="A">A</option><option value="B">B</option></select></label>
            <label className="admin-users-select"><Clock3 size={14} /><span>Sort</span><select value={userSort} onChange={e => setUserSort(e.target.value)}><option value="recent">Recently active</option><option value="oldest">Least recently active</option><option value="name">Name A–Z</option><option value="courses">Most courses</option></select></label>
          </div>

          <div className="admin-users-segments" role="group" aria-label="Filter users by status">
            {[
              ["all", "All", userOpsStats.total], ["today", "Active today", activeUsers], ["active7", "Active 7d", userOpsStats.activeWeek],
              ["inactive7", "Inactive 7d+", Math.max(0, userOpsStats.atRisk - userOpsStats.neverSeen)], ["never", "Never active", userOpsStats.neverSeen],
              ["setup", "Needs setup", userOpsStats.needsSetup], ["push", "Push enabled", pushSubscriberIds.size], ["banned", "Banned", userOpsStats.banned],
            ].map(([id, label, count]) => <button type="button" className={userStatusFilter === id ? "is-active" : ""} aria-pressed={userStatusFilter === id} onClick={() => setUserStatusFilter(id)} key={id}>{label}<span>{count}</span></button>)}
          </div>

          <div className="admin-users-results-bar">
            <label>
              <input type="checkbox" aria-label="Select all filtered users" checked={filteredUsers.length > 0 && filteredUsers.every(u => selectedUserIds.has(u.user_id))} onChange={e => {
                const next = new Set(selectedUserIds);
                filteredUsers.forEach(u => e.target.checked ? next.add(u.user_id) : next.delete(u.user_id));
                setSelectedUserIds(next);
              }} />
              <span>Select visible</span>
            </label>
            <span><strong>{filteredUsers.length}</strong> of {allUsers.length} users</span>
          </div>

          {selectedUserIds.size > 0 && (
             <div className="admin-users-bulkbar">
                <span><Check size={14} /> {selectedUserIds.size} selected</span>
                <div>
                   <button className="admin-btn danger" onClick={() => {
                      if (!confirm(`Ban ${selectedUserIds.size} selected user${selectedUserIds.size > 1 ? "s" : ""}? Takes effect on next Deploy.`)) return;
                      const next = [...(flags.bannedUsers || [])];
                      selectedUserIds.forEach(id => { if(!next.includes(id)) next.push(id) });
                      setFlags({...flags, bannedUsers: next});
                      setSelectedUserIds(new Set());
                   }}><Ban size={13} /> Ban</button>
                   
                   <button className="admin-btn outline" onClick={() => {
                      let next = [...(flags.bannedUsers || [])];
                      selectedUserIds.forEach(id => { next = next.filter(b => b !== id) });
                      setFlags({...flags, bannedUsers: next});
                      setSelectedUserIds(new Set());
                   }}>Unban</button>

                   <button className="admin-btn outline" onClick={pushSelectedUsers}><BellRing size={12} /> Push</button>

                   <button className="admin-btn outline" onClick={() => setSelectedUserIds(new Set())}>Clear</button>
                </div>
             </div>
          )}

          <div className="admin-users-table" role="table" aria-label="Users">
            <div className="admin-users-table-head" role="row">
              <span>User</span><span>Status</span><span>Enrollment</span><span>Push</span><span>Actions</span>
            </div>
            {loadingUsers ? (
              <div className="admin-loading">Loading users...</div>
            ) : filteredUsers.length === 0 ? (
              <div className="admin-empty">No users found.</div>
            ) : (
              filteredUsers.map(u => {
                const banned = flags.bannedUsers?.includes(u.user_id);
                const pushEnabled = pushSubscriberIds.has(u.user_id);
                const courseCount = userCourseCount(u);
                const seenAge = u.last_seen_at ? LOAD_NOW - new Date(u.last_seen_at).getTime() : Infinity;
                const activityTone = !u.last_seen_at ? "never" : seenAge <= 86400000 ? "today" : seenAge <= 7 * 86400000 ? "week" : "inactive";
                return (
                <div key={u.user_id} className={`admin-users-table-row${selectedUserIds.has(u.user_id) ? " is-selected" : ""}`} role="row">
                  <div className="admin-users-person" role="cell">
                    <input
                       type="checkbox" 
                       aria-label={`Select ${u.name || "user"}`}
                       checked={selectedUserIds.has(u.user_id)}
                       onChange={e => {
                          const next = new Set(selectedUserIds);
                          if(e.target.checked) next.add(u.user_id);
                          else next.delete(u.user_id);
                          setSelectedUserIds(next);
                       }}
                    />
                    <Avatar name={u.name} email={u.user_id} />
                    <button type="button" className="admin-users-person-copy" onClick={() => setSelectedUser(u)} title="Open user details">
                      <strong>{u.name || "Student"}{banned && <span className="admin-users-banned">Banned</span>}</strong>
                      <span>{u.email || u.user_id}</span>
                    </button>
                  </div>
                  <div className="admin-users-activity" role="cell"><span className={`is-${activityTone}`} /> <div><strong>{relativeUserActivity(u.last_seen_at)}</strong><small>{u.last_seen_at ? `${new Date(u.last_seen_at).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" })} IST` : "No heartbeat recorded"}</small></div></div>
                  <div className="admin-users-enrollment-cell" role="cell"><strong>{userSection(u) === "—" ? "No section" : `Section ${userSection(u)}`}</strong><span>{courseCount} course{courseCount === 1 ? "" : "s"}</span></div>
                  <div className="admin-users-push-cell" role="cell"><span className={pushEnabled ? "is-on" : ""}><BellRing size={12} /> {pushEnabled ? "Enabled" : "Off"}</span></div>
                  <div className="admin-users-row-actions" role="cell">
                    <button onClick={() => setSelectedUser(u)} className="admin-btn-icon" title="Open user details" aria-label={`Open ${u.name || "user"} details`}><ChevronRight size={18} /></button>
                    <button onClick={() => startImpersonation(u)} className="admin-btn-icon" title="Impersonate user" aria-label={`Impersonate ${u.name || "user"}`}>
                      <VenetianMask size={18} />
                    </button>
                    <button onClick={() => {
                       const prevBanned = flags.bannedUsers || [];
                       const isBanned = prevBanned.includes(u.user_id);
                       const next = isBanned ? prevBanned.filter(id => id !== u.user_id) : [...prevBanned, u.user_id];
                       setFlags({...flags, bannedUsers: next});
                       logAdminAction(admin_id, isBanned ? "unban_user" : "ban_user", { target_user: u.user_id });
                       removeWithUndo(`${isBanned ? "Unbanned" : "Banned"} ${u.name || "user"} (Deploy to apply)`, () => setFlags(f => ({ ...f, bannedUsers: prevBanned })));
                    }} className={`admin-btn-icon${banned ? " is-danger" : ""}`} title={banned ? "Unban user" : "Ban user"} aria-label={`${banned ? "Unban" : "Ban"} ${u.name || "user"}`}>
                      <Ban size={18} />
                    </button>
                  </div>
                </div>
              )})
            )}
          </div>
        </section>

          {/* Inactive users + re-engagement */}
          <section className="admin-card admin-g-users admin-users-inactive">
            <h2><Users size={20} color="var(--muted)" /> Inactive Users</h2>
            <p className="admin-subtext">Students not seen recently. Click a name for details, or send a gentle re-engagement push to the whole list.</p>
            <div className="admin-field-row admin-inline-form inactive-form">
              <div className="admin-field">
                <label>Inactive for at least (days)</label>
                <input type="number" min={1} max={120} className="admin-input" value={inactiveDays} onChange={e => setInactiveDays(Math.max(1, Number(e.target.value) || 1))} />
              </div>
              <button className="admin-btn primary admin-inline-form-btn" onClick={sendReEngagement} disabled={reEngaging}>
                <BellRing size={14} /> {reEngaging ? "Sending…" : `Nudge ${inactiveUsers.length}`}
              </button>
            </div>
            {reEngageMsg && <div className="inactive-msg" style={{ color: reEngageMsg.startsWith("Queued") ? "var(--live)" : "var(--danger)" }}>{reEngageMsg}</div>}
            <div className="inactive-count"><b>{inactiveUsers.length}</b> of {allUsers.length} users inactive {inactiveDays}+ days</div>
            <div className="inactive-list">
              {inactiveUsers.slice(0, 50).map(u => (
                <button type="button" key={u.user_id} onClick={() => setSelectedUser(u)} className="inactive-row">
                  <span className="inactive-name">{u.name || "Student"}</span>
                  <span className="inactive-seen">{u.last_seen_at ? new Date(u.last_seen_at).toLocaleDateString() : "never seen"}</span>
                </button>
              ))}
            </div>
          </section>

             {/* Friend Pings & Share Codes */}
             <section className="admin-card admin-g-users admin-users-social">
               <h2><Users size={20} color="var(--green)" /> Social Hygiene</h2>
               <div className="social-stat">
                  <span className="social-stat-label">Pending Friend Pings</span>
                  <span className="social-stat-value">{friendPingsCount}</span>
               </div>

               <h3 className="social-subhead">Active Share Codes</h3>
               <div className="social-code-list">
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
                           <div key={sc.code} className="social-code-row">
                              <span className="social-code">{sc.code}</span>
                              <span className="social-code-owner">{owner?.name ? owner.name : sc.user_id}</span>
                           </div>
                        )
                     })
                  }
               </div>
             </section>
             
          
          {/* ── Weekly Presence Heatmap ── */}
          <section className="admin-card admin-span-all admin-g-insights weekly-presence-workspace" style={{ gridColumn: "1 / -1" }}>
            <div className="presence-head">
              <div><span className="insights-eyebrow"><Users size={13} /> Cohort heartbeat</span><h2>Weekly Presence</h2><p>Durable daily activity in IST. A student stays counted on every day they opened TermFlow.</p></div>
              <div className="presence-head-actions">
                {weeklyPresenceDay !== null && <button className="admin-btn outline" onClick={() => { setWeeklyPresenceDay(null); setWeeklyPresenceHourFilter(null); }}><X size={13} /> Back to week</button>}
                <button className="admin-btn outline" onClick={() => {
                  const rows = [["Day", "Date", "Name", "First seen (IST)", "Last seen (IST)", "Heartbeat check-ins", "Active hours", "Section"]];
                  weeklyPresence.forEach(day => day.users.forEach(u => rows.push([
                    day.label,
                    day.isoDate,
                    u.name,
                    new Date(u.firstSeenTs).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" }),
                    new Date(u.seenTs).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" }),
                    u.heartbeatCount,
                    u.hours.map(hour => `${String(hour).padStart(2, "0")}:00`).join(";"),
                    u.section,
                  ])));
                  const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, "'")}"`).join(",")).join("\n");
                  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
                  a.download = `weekly-presence-${new Date().toISOString().split("T")[0]}.csv`; a.click();
                }}><Download size={13} /> Export CSV</button>
              </div>
            </div>

            <div className="presence-kpis">
              <div><span>Unique users · 7d</span><strong>{presenceSeenThisWeek}</strong><small>{typeof totalUsers === "number" && totalUsers ? `${Math.round((presenceSeenThisWeek / totalUsers) * 100)}% reach · ${presenceActivityDays} user-days` : `${presenceActivityDays} user-days`}</small></div>
              <div><span>Active today</span><strong>{weeklyPresence[6]?.users.length || 0}</strong><small>12:00 AM–11:59 PM IST</small></div>
              <div><span>Busiest day</span><strong>{presencePeakDay?.users.length ? presencePeakDay.label : "—"}</strong><small>{presencePeakDay?.users.length || 0} student{presencePeakDay?.users.length === 1 ? "" : "s"} seen</small></div>
              <div className={ghostUsers.length ? "is-risk" : ""}><span>Inactive 7d+</span><strong>{ghostUsers.length}</strong><small>{ghostUsers.length ? "retention follow-up" : "no known risk"}</small></div>
            </div>

            {ghostUsers.length > 0 && <div className="presence-risk"><span><AlertTriangle size={16} /></span><div><strong>{ghostUsers.length} user{ghostUsers.length === 1 ? "" : "s"} haven&apos;t been seen in over seven days</strong><small>{ghostUsers.slice(0, 3).map(u => u.name).join(", ")}{ghostUsers.length > 3 ? ` and ${ghostUsers.length - 3} more` : ""}</small></div><button type="button" className="admin-btn outline" onClick={() => { setActiveTab("users"); window.scrollTo({ top: 0, behavior: "smooth" }); }}>Review users <ChevronRight size={14} /></button></div>}

            {statsLoading ? <div className="presence-loading"><RefreshCw size={20} className="spin-icon" /><strong>Loading presence data</strong><span>Reading the latest available heartbeats…</span></div> : weeklyPresenceDay === null ? (
              <div className="presence-week-view">
                <div className="presence-week-head"><div><span>Seven-day distribution</span><strong>Select a day for details</strong></div><span className="presence-legend"><i /> Schedule override</span></div>
                <div className="presence-day-grid">
                  {weeklyPresence.map((day, i) => {
                    const maxDay = Math.max(...weeklyPresence.map(item => item.users.length), 1);
                    const isToday = i === 6;
                    const hasOverride = Object.keys(flags.classOverrides || {}).includes(day.isoDate);
                    const secCounts = {};
                    day.users.forEach(u => { secCounts[u.section] = (secCounts[u.section] || 0) + 1; });
                    const topSec = Object.entries(secCounts).filter(([section]) => section !== "—").sort((a, b) => b[1] - a[1])[0]?.[0];
                    return <button type="button" key={day.isoDate} className={`presence-day ${isToday ? "is-today" : ""}`} onClick={() => { setWeeklyPresenceDay(i); setWeeklyPresenceHourFilter(null); }} aria-label={`${day.label} ${day.date}, ${day.users.length} students seen`}>
                      <div className="presence-day-title"><span>{day.label}</span>{hasOverride && <i title="Has class overrides" />}</div>
                      <small>{day.date}</small>
                      <div className="presence-day-chart"><i style={{ height: day.users.length === 0 ? 4 : `${Math.max(8, Math.round((day.users.length / maxDay) * 88))}px` }} /></div>
                      <strong>{day.users.length}</strong>
                      <span className="presence-day-foot">{topSec ? `Section ${topSec} leads` : day.users.length ? "No section signal" : "No activity"}</span>
                    </button>;
                  })}
                </div>
                <p className="presence-method-note"><Activity size={13} /> {presenceHistoryAvailable ? "Daily counts are stored permanently and no longer shrink when a student returns on a later day. History before this rollout is limited to each profile’s last available heartbeat." : "Durable history is not deployed yet, so this is the legacy latest-heartbeat snapshot and older bars can still shrink."}</p>
              </div>
            ) : (() => {
              const day = weeklyPresence[weeklyPresenceDay];
              const maxHour = Math.max(...day.hourBuckets, 1);
              const filtered = weeklyPresenceHourFilter !== null ? day.users.filter(u => u.hours.includes(weeklyPresenceHourFilter)) : day.users;
              const sorted = [...filtered].sort((a, b) => weeklyPresenceSort === "name" ? a.name.localeCompare(b.name) : b.seenTs - a.seenTs);
              const secCounts = {};
              day.users.forEach(u => { secCounts[u.section] = (secCounts[u.section] || 0) + 1; });
              return <div className="presence-day-view">
                <div className="presence-detail-head"><div><span>Selected day · IST</span><h3>{day.label} · {day.date}</h3><small>{day.users.length} unique student{day.users.length === 1 ? "" : "s"} active from 12:00 AM to 11:59 PM</small></div><div className="presence-section-chips">{Object.entries(secCounts).filter(([section]) => section !== "—").sort((a, b) => b[1] - a[1]).map(([section, count]) => <span key={section}>Sec {section} <strong>{count}</strong></span>)}</div><div className="presence-sort" role="group" aria-label="Sort presence list"><button type="button" className={weeklyPresenceSort === "time" ? "active" : ""} onClick={() => setWeeklyPresenceSort("time")}>Recent first</button><button type="button" className={weeklyPresenceSort === "name" ? "active" : ""} onClick={() => setWeeklyPresenceSort("name")}>Name</button></div></div>
                <div className="presence-hour-panel">
                  <div className="presence-hour-head"><div><span>Unique users by hour · IST</span><strong>{weeklyPresenceHourFilter !== null ? `${weeklyPresenceHourFilter}:00–${weeklyPresenceHourFilter}:59` : "All hours"}</strong></div>{weeklyPresenceHourFilter !== null && <button type="button" onClick={() => setWeeklyPresenceHourFilter(null)}>Clear hour</button>}</div>
                  <div className="presence-hour-chart">{day.hourBuckets.map((count, hour) => { const isSelected = weeklyPresenceHourFilter === hour; const intensity = count === 0 ? 0 : Math.max(.14, count / maxHour); return <button type="button" key={hour} className={isSelected ? "active" : ""} disabled={count === 0} title={`${hour}:00 — ${count} student${count === 1 ? "" : "s"}`} onClick={() => setWeeklyPresenceHourFilter(isSelected ? null : hour)} aria-label={`Filter to ${hour}:00, ${count} students`}><i style={{ height: count === 0 ? 5 : `${Math.max(10, Math.round(intensity * 44))}px`, opacity: count === 0 ? .25 : Math.max(.35, intensity) }} /></button>; })}</div>
                  <div className="presence-hour-axis">{["12am", "3am", "6am", "9am", "12pm", "3pm", "6pm", "9pm", "11pm"].map(label => <span key={label}>{label}</span>)}</div>
                </div>
                <div className="presence-user-list admin-scroll-hide">
                  {sorted.length === 0 ? <div className="presence-list-empty"><Search size={18} /><strong>No activity in this hour</strong><button type="button" onClick={() => setWeeklyPresenceHourFilter(null)}>Show the full day</button></div> : sorted.map((u, index) => {
                    const initials = u.name.split(" ").filter(Boolean).map(word => word[0]).join("").slice(0, 2).toUpperCase();
                    const targetUser = allUsers.find(profile => profile.user_id === u.userId) || null;
                    return <article key={u.userId + index} className="presence-user-row" role="button" tabIndex={0} onClick={() => setSelectedUser(targetUser)} onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelectedUser(targetUser); } }}>
                      <span className="presence-avatar">{initials}</span>
                      <div className="presence-user-copy"><strong>{u.name}</strong><span>{u.isNew && <i className="is-new">New</i>}{u.section !== "—" && <i>Section {u.section}</i>}</span></div>
                      <div className="presence-user-time"><strong>Last {new Date(u.seenTs).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" })}</strong><span>First {new Date(u.firstSeenTs).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" })} · {u.heartbeatCount} check-in{u.heartbeatCount === 1 ? "" : "s"}</span></div>
                      <button type="button" className="admin-btn outline" onClick={event => { event.stopPropagation(); setSelectedUser(targetUser); }}><Eye size={14} /> Inspect</button>
                    </article>;
                  })}
                </div>
              </div>;
            })()}
          </section>
          {/* Analytics Dashboard — real data from Supabase */}
          <section className="admin-card admin-span-all admin-g-insights insights-overview" style={{ gridColumn: "1 / -1" }}>
             <div className="insights-hero">
               <div><span className="insights-eyebrow"><BarChart2 size={13} /> Behaviour signal</span><h2>Usage overview</h2><p>A quick read on engagement, attendance friction, and when students rely on TermFlow.</p></div>
               <div className="insights-hero-total"><span>Seven-day activity</span><strong>{insightsSessions}</strong><small>recorded user sessions</small></div>
             </div>
             <div className="insights-overview-grid">

                {/* 7-Day Active Users — real last_seen_at buckets */}
                <div className="insight-panel insight-panel--activity">
                   <div className="insight-panel-head"><div><span className="insight-panel-label">Daily activity</span><strong>Last seven days</strong></div><Activity size={16} /></div>
                   {(() => {
                      const maxVal = Math.max(...activityChartData, 1);
                      const dayLabels = Array.from({ length: 7 }, (_, i) => {
                        const d = new Date(LOAD_NOW - (6 - i) * 86400000);
                        return d.toLocaleDateString("en-IN", { weekday: "short" });
                      });
                      return (
                        <>
                          <div className="insights-bar-chart" aria-label="Active users for the last seven days">
                            {activityChartData.map((v, i) => (
                              <div key={i} className="insights-bar-slot"><span>{v}</span><i className={i === 6 ? "is-today" : ""} title={`${v} users`} style={{ height: `${Math.max(4, (v / maxVal) * 100)}%` }} /></div>
                            ))}
                          </div>
                          <div className="insights-bar-labels">
                            {dayLabels.map((label, i) => <span key={i} className={i === 6 ? "is-today" : ""}>{label}</span>)}
                          </div>
                          <div className="insight-panel-foot">
                            <span>Today <strong>{activityChartData[6] || 0}</strong></span><span>7-day total <strong>{activityChartData.reduce((a, b) => a + b, 0)}</strong></span>
                          </div>
                        </>
                      );
                   })()}
                </div>

                {/* Most-Skipped Classes — from attendance table */}
                <div className="insight-panel insight-panel--attendance">
                   <div className="insight-panel-head"><div><span className="insight-panel-label">Attendance watchlist</span><strong>Most recorded absences</strong></div><AlertTriangle size={16} /></div>
                   <div className="insights-watchlist">
                      {skipStats.length === 0 ? (
                         <div className="insights-mini-empty">No absence data yet.</div>
                      ) : skipStats.map(([code, count]) => {
                         const maxSkip = skipStats[0][1];
                         return (
                           <div className="insights-watch-row" key={code}>
                             <div><strong>{code}</strong><span>{count} absence{Number(count) === 1 ? "" : "s"}</span></div>
                             <div className="insights-watch-track"><i style={{ width: `${Math.round((count / maxSkip) * 100)}%` }} /></div>
                           </div>
                         );
                      })}
                   </div>
                </div>

                {/* Peak Hour — computed from last_seen_at timestamps */}
                <div className="insight-panel insight-panel--peak">
                   <span className="insights-peak-icon"><Clock size={20} /></span>
                   <span className="insight-panel-label">Peak usage · IST</span>
                   <strong>
                     {peakHour !== null ? `${peakHour % 12 || 12}:00 ${peakHour < 12 ? "AM" : "PM"}` : "—"}
                   </strong>
                   <small>{statsLoading ? "Refreshing signal…" : "Based on recent heartbeats"}</small>
                </div>
             </div>
          </section>

          <section className="admin-card admin-span-all admin-g-insights insights-brief" style={{ gridColumn: "1 / -1" }}>
            <div className="insights-section-head">
              <div>
                <span className="insights-eyebrow"><Activity size={13} /> Start here</span>
                <h2>Operations brief</h2>
                <p className="admin-subtext">The few signals worth acting on now, separated from the full reporting detail below.</p>
              </div>
              <button type="button" className="admin-btn outline insights-refresh" onClick={fetchDashboardData} disabled={statsLoading}>
                <RefreshCw size={14} className={statsLoading ? "spin-icon" : ""} /> {statsLoading ? "Refreshing…" : "Refresh signals"}
              </button>
            </div>
            <div className="insights-brief-grid">
              <div className="insights-scorecard">
                <div className="insights-scorecard-head"><span>Weekly reach</span><Activity size={15} /></div>
                <strong>{insightsWeeklyReach}%</strong>
                <small>{activeTiers.wau} of {typeof totalUsers === "number" ? totalUsers : "—"} students seen in the last 7 days</small>
                <div className="insights-progress"><i style={{ width: `${Math.min(100, insightsWeeklyReach)}%` }} /></div>
              </div>
              <div className="insights-scorecard">
                <div className="insights-scorecard-head"><span>Push readiness</span><BellRing size={15} /></div>
                <strong>{insightsPushReadiness}%</strong>
                <small>{pushSubCount} subscribed device{Number(pushSubCount) === 1 ? "" : "s"} available for urgent updates</small>
                <div className="insights-progress is-blue"><i style={{ width: `${Math.min(100, insightsPushReadiness)}%` }} /></div>
              </div>
              <div className="insights-scorecard">
                <div className="insights-scorecard-head"><span>Attendance watch</span><AlertTriangle size={15} /></div>
                <strong>{insightsAbsences}</strong>
                <small>recorded absences across the top {skipStats.length || 0} course{skipStats.length === 1 ? "" : "s"}</small>
                <div className="insights-scorecard-foot">{skipStats[0]?.[0] ? `${skipStats[0][0]} currently leads the watchlist` : "No absence signal yet"}</div>
              </div>
            </div>
            <div className="insights-attention" aria-live="polite">
              <div className="insights-attention-head"><strong>Attention queue</strong><span>{insightIssues.length ? `${insightIssues.length} item${insightIssues.length === 1 ? "" : "s"}` : "Clear"}</span></div>
              {insightIssues.length ? insightIssues.map(issue => <div className={`insights-attention-row is-${issue.tone}`} key={issue.id}>
                <span className="insights-attention-dot" aria-hidden="true" />
                <div><strong>{issue.title}</strong><small>{issue.detail}</small></div>
                <button type="button" className="admin-btn outline" onClick={() => { setActiveTab(issue.tab); window.scrollTo({ top: 0, behavior: "smooth" }); }}>{issue.action}<ChevronRight size={14} /></button>
              </div>) : <div className="insights-clear-state"><Check size={17} /> Nothing requiring immediate action from the available signals.</div>}
            </div>
          </section>

          {/* Active-user tiers (DAU/WAU/MAU) */}
          <section className="admin-card admin-g-insights insights-metric-card insights-engagement-card">
            <div className="insights-card-head"><span><BarChart2 size={17} /></span><div><h2>Active users</h2><p>Unique students by rolling window</p></div></div>
            <div className="insights-tier-grid">
              {[["DAU", activeTiers.dau, "last 24h"], ["WAU", activeTiers.wau, "last 7 days"], ["MAU", activeTiers.mau, "last 30 days"]].map(([label, val, sub]) => (
                <div key={label}>
                  <span>{label}</span><strong>{statsLoading ? "…" : val}</strong><small>{sub}</small>
                </div>
              ))}
            </div>
            {typeof totalUsers === "number" && totalUsers > 0 && (
              <div className="insights-ratio-row"><div><span>Stickiness</span><strong>{activeTiers.mau ? Math.round((activeTiers.dau / activeTiers.mau) * 100) : 0}%</strong><small>DAU / MAU</small></div><div><span>Monthly reach</span><strong>{Math.round((activeTiers.mau / totalUsers) * 100)}%</strong><small>of {totalUsers} profiles</small></div></div>
            )}
          </section>

          {/* Feature adoption */}
          <section className="admin-card admin-g-insights insights-metric-card insights-adoption-card">
            <div className="insights-card-head"><span><Flag size={17} /></span><div><h2>Feature adoption</h2><p>Live usage and availability signals</p></div><strong className="insights-enabled-count">{insightsEnabledFeatures}/{FEATURE_FLAGS.length} on</strong></div>
            <div className="insights-adoption-grid">
              <div><span>Push enabled</span><strong>{insightsPushReadiness}%</strong><small>{pushSubCount} devices</small></div>
              <div><span>Share codes</span><strong>{shareCodes.length}</strong><small>active links</small></div>
              <div><span>Friend pings</span><strong>{friendPingsCount}</strong><small>pending</small></div>
            </div>
            <div className="insights-feature-list">
              {FEATURE_FLAGS.map(feature => <span key={feature.key} className={flags[feature.key] !== false ? "is-on" : "is-off"}><i />{feature.label}<small>{flags[feature.key] !== false ? "On" : "Off"}</small></span>)}
            </div>
          </section>

          {/* Edge-function / cron health */}
          <section className="admin-card admin-span-all admin-g-insights insights-service-health" style={{ gridColumn: "1 / -1" }}>
            <div className="insights-section-head"><div><span className="insights-eyebrow"><Terminal size={13} /> Scheduled infrastructure</span><h2>Edge function and cron health</h2><p className="admin-subtext">Last reported run for dispatch, class reminders, and scheduled pushes.</p></div><span className={`insights-health-summary ${cronHealth && pushCronIssues(cronHealth, LOAD_NOW).length ? "has-issues" : ""}`}><i />{cronHealth === null ? "Unavailable" : cronHealth.length ? `${cronHealth.length} jobs monitored` : "No jobs"}</span></div>
            {cronHealth && pushCronIssues(cronHealth, LOAD_NOW).length > 0 && <p className="admin-subtext" role="alert">{pushCronIssues(cronHealth, LOAD_NOW).join("; ")}. Check the two scheduled functions and their cron jobs.</p>}
            {cronHealth === null ? (
              <div className="insights-service-empty"><AlertTriangle size={19} /><div><strong>Health RPC unavailable</strong><span>Deploy migration <code>20260731120000</code> to enable cron monitoring.</span></div></div>
            ) : cronHealth.length === 0 ? (
              <div className="insights-service-empty"><Terminal size={19} /><div><strong>No cron jobs reported</strong><span>The health endpoint returned an empty result.</span></div></div>
            ) : (
              <div className="insights-service-list">
                {cronHealth.map((j, i) => {
                  const ok = (j.status || "").toLowerCase() === "succeeded";
                  const stale = isPushCronStale(j, LOAD_NOW);
                  return (
                    <div key={i} className={`insights-service-row ${!j.last_run ? "is-unknown" : ok && j.active && !stale ? "is-healthy" : "is-unhealthy"}`}>
                      <span className="insights-service-dot" /><div><strong>{j.jobname}</strong><span><code>{j.schedule}</code>{j.message ? ` · ${String(j.message).slice(0, 80)}` : ""}</span></div>{!j.active && <span className="insights-paused">Paused</span>}<div className="insights-service-time"><strong>{stale ? "Stale" : j.status || "Never run"}</strong><span>{j.last_run ? new Date(j.last_run).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "No run recorded"}</span></div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Self-test: ping every service in one click */}
          <section className="admin-card admin-g-insights insights-diagnostic-card insights-self-test">
            <div className="insights-card-head"><span><Check size={17} /></span><div><h2>System self-test</h2><p>Seven service checks</p></div>{selfTest && <span className={`insights-test-result ${selfTest.checks.some(check => !check.ok) ? "has-issues" : ""}`}>{selfTest.checks.filter(check => check.ok).length}/{selfTest.checks.length} passed</span>}</div>
            <p className="admin-subtext">Check the database, required push cron jobs and functions, Insights RPCs, and schedule feed. A successful cron run only submits an HTTP request; inspect pg_net responses for 401 errors. This test does not send a notification.</p>
            <button className="admin-btn primary insights-run-test" onClick={runSelfTest} disabled={selfTesting}>
              {selfTesting ? <><RefreshCw size={14} className="spin-icon" /> Running…</> : <><Check size={14} /> Run self-test</>}
            </button>
            {selfTest && (
              <div className="insights-test-list">
                {selfTest.checks.map((c, i) => (
                  <div key={i} className={c.ok ? "is-ok" : "is-error"}><span><i />{c.name}</span><small>{c.detail}</small></div>
                ))}
                <small className="insights-test-time">Completed {new Date(selfTest.at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</small>
              </div>
            )}
          </section>

          {/* Admin action leaderboard */}
          <section className="admin-card admin-g-insights insights-diagnostic-card insights-admin-activity">
            <div className="insights-card-head"><span><ShieldAlert size={17} /></span><div><h2>Admin activity</h2><p>Last seven days</p></div><strong className="insights-enabled-count">{adminLeaderboard.reduce((sum, admin) => sum + admin.count, 0)} actions</strong></div>
            <p className="admin-subtext">Accountability across the admin team, ranked by recorded operations.</p>
            {adminLeaderboard.length === 0 ? (
              <div className="insights-mini-empty">No admin actions logged in the last seven days.</div>
            ) : (
              <div className="insights-leaderboard">
                {adminLeaderboard.map((a, i) => {
                  const name = allUsers.find(u => u.user_id === a.id)?.name || (a.id === admin_id ? "You" : a.id.slice(0, 10));
                  const top = Object.entries(a.actions).sort((x, y) => y[1] - x[1]).slice(0, 3).map(([k, v]) => `${k.replace(/_/g, " ")} ×${v}`).join(", ");
                  return (
                    <div key={a.id}><span className="insights-rank">{i + 1}</span><div><strong>{name}</strong><small>{top}</small></div><div><strong>{a.count}</strong><small>{new Date(a.last).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</small></div></div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Sentry deep link */}
          <section className="admin-card admin-g-insights insights-diagnostic-card insights-sentry-card">
            <div className="insights-card-head"><span><AlertTriangle size={17} /></span><div><h2>Error monitoring</h2><p>Sentry issue feed</p></div></div>
            <div className="insights-monitor-visual"><span><Activity size={18} /></span><div><strong>Client and edge errors</strong><small>Open the external dashboard for live traces, frequency, and affected releases.</small></div></div>
            <a className="admin-btn outline" href="https://sentry.io/organizations/flames-corp/issues/?project=termflow" target="_blank" rel="noopener noreferrer"><Terminal size={14} /> Open Sentry issues <ChevronRight size={14} /></a>
          </section>

             {/* API Health Check — live pings */}
             <section className="admin-card admin-g-insights insights-diagnostic-card insights-api-card">
               <div className="insights-card-head">
                 <span><Terminal size={17} /></span><div><h2>API health</h2><p>Live endpoint probes</p></div>
                 <button onClick={checkApiHealth} disabled={healthChecking} className="admin-btn outline insights-api-run">
                   <RefreshCw size={13} className={healthChecking ? "spin-icon" : ""} /> {healthChecking ? "Checking…" : "Run Check"}
                 </button>
               </div>
               <div className="insights-api-list">
                  {[
                    { key: "supabase", label: "Supabase Database", icon: <Database size={14} /> },
                    { key: "push",     label: "Push Notification Gateway", icon: <BellRing size={14} /> },
                    { key: "sheets",   label: "Schedule Google Apps Script", icon: <FileText size={14} /> },
                    { key: "mess",     label: "Mess Menu Google Apps Script", icon: <CalendarDays size={14} /> },
                  ].map(({ key, label, icon }) => {
                    const s = healthStatus[key];
                    const isErr = s === "error" || s === "timeout";
                    const tag = !s ? (healthChecking ? "Checking…" : "Not checked") :
                                isErr ? (s === "timeout" ? "Timeout" : "Error") :
                                key === "supabase" ? s : "Operational";
                    return (
                      <div key={key} className={!s ? "" : isErr ? "is-error" : "is-ok"}><span>{icon}<strong>{label}</strong></span><small>{tag}</small></div>
                    );
                  })}
               </div>
             </section>

        {/* Feedback Section */}
        <section className="admin-card admin-g-users admin-users-feedback">
          <div className="fb-head">
            <h2><Terminal size={20} color="var(--green)" /> Feedback & Bug Reports</h2>
            <div className="fb-filters">
               <button onClick={() => setFeedbackFilter("all")} className={`admin-btn fb-filter ${feedbackFilter === "all" ? "" : "outline"}`} aria-pressed={feedbackFilter === "all"}>All</button>
               <button onClick={() => setFeedbackFilter("pending")} className={`admin-btn fb-filter ${feedbackFilter === "pending" ? "" : "outline"}`} aria-pressed={feedbackFilter === "pending"}>Pending Only</button>
            </div>
          </div>
          <div className="fb-list">
            {feedbackList.filter(f => feedbackFilter === "all" || f.status === "pending").length === 0 ? <div className="admin-empty">No feedback found.</div> : 
             feedbackList.filter(f => feedbackFilter === "all" || f.status === "pending").map(f => {
               const fUser = allUsers.find(u => u.user_id === f.user_id);
               return (
               <div key={f.id} className="fb-item">
                 <div className="fb-item-head">
                   <span className="fb-item-meta">{new Date(f.created_at).toLocaleString()} • {fUser ? fUser.name : f.user_id}</span>
                   <span className="fb-item-status" style={{ color: f.status === "resolved" ? "var(--green)" : "var(--amber)" }}>{f.status.toUpperCase()}</span>
                 </div>
                 <div className="fb-item-body">{f.message}</div>
                 <div className="fb-item-actions">
                   {f.status === "pending" && (
                     <button onClick={() => markFeedbackResolved(f.id)} className="admin-btn outline fb-action" style={{ color: "var(--green)", borderColor: "var(--green)" }}>Mark Resolved</button>
                   )}
                   {f.user_id && (
                     <button onClick={async () => {
                       const msg = prompt(`Reply to ${fUser?.name || "user"} via push:`);
                       if (!msg) return;
                       const res = await pushToUserIds([f.user_id], { title: "Reply from TermFlow admin", body: msg.trim() });
                       if (res?.ok) { await logAdminAction(admin_id, "feedback_reply", { feedback: f.id }); alert("Reply push queued."); }
                       else alert("Failed: " + (res?.data?.error || "error"));
                     }} className="admin-btn outline fb-action"><BellRing size={12} /> Reply</button>
                   )}
                   <button onClick={() => { setWnTitle(f.message.slice(0, 58)); setWnDesc(f.message); setWnEmoji("✨"); setActiveTab("broadcast"); window.scrollTo({ top: 0, behavior: "smooth" }); }} className="admin-btn outline fb-action" title="Prefill a What's New entry from this feedback"><Sparkles size={12} /> To What&rsquo;s New</button>
                 </div>
                 <div className="fb-item-tags">
                   {["bug", "idea", "dup", "wontfix"].map(t => {
                     const on = (flags.feedbackTags?.[f.id] || []).includes(t);
                     return (
                       <button key={t} onClick={() => {
                         const cur = flags.feedbackTags?.[f.id] || [];
                         const next = on ? cur.filter(x => x !== t) : [...cur, t];
                         setFlags({ ...flags, feedbackTags: { ...(flags.feedbackTags || {}), [f.id]: next } });
                       }} className="fb-tag" aria-pressed={on} style={{ background: on ? "var(--violet)" : "transparent", color: on ? "#fff" : "var(--muted)" }}>{t}</button>
                     );
                   })}
                 </div>
               </div>
             )})}
          </div>
        </section>

          <section className="admin-card admin-span-all admin-g-system system-ops-console" style={{ gridColumn: "1 / -1" }}>
            <div className="system-ops-head"><div><span className="system-ops-eyebrow">Platform operations</span><h2><ShieldAlert size={20} color="var(--violet)" /> System command centre</h2><p className="admin-subtext">A practical read of what is live, what is staged, and the safest next move.</p></div><div className={`system-ops-status ${systemOverview.items.some(item => item.tone === "risk") ? "is-watch" : ""}`}><span /> {systemOverview.items.some(item => item.tone === "risk") ? "Attention needed" : "Controls ready"}</div></div>
            <div className="system-ops-metrics"><div><strong>{changesCount}</strong><span>staged changes</span></div><div><strong>{configDrift.total}</strong><span>config drift items</span></div><div><strong>{(flags.scheduledConfigDeploys || []).length}</strong><span>scheduled deploys</span></div><div className={snapshotMeta.status === "success" ? "is-healthy" : "is-risk"}><strong>{snapshotMeta.status === "success" ? "OK" : "!"}</strong><span>snapshot automation</span></div></div>
            <div className="system-state-strip"><span><Shield size={15} /> Access <strong>{systemOverview.maintenance}</strong></span><span><Activity size={15} /> Automation <strong>{systemOverview.staleJobs ? `${systemOverview.staleJobs} issue${systemOverview.staleJobs === 1 ? "" : "s"}` : "healthy from last check"}</strong></span><span><Users size={15} /> Presence <strong>{presentAdmins.length || 1} admin{presentAdmins.length === 1 ? "" : "s"} online</strong></span></div>
            {systemOverview.items.length > 0 && <div className="system-attention-queue">{systemOverview.items.map(item => <div className={`system-attention-row is-${item.tone}`} key={item.id}><span aria-hidden="true" /><div><strong>{item.title}</strong><small>{item.detail}</small></div><button type="button" className="admin-btn outline" onClick={item.onClick}>{item.action}<ChevronRight size={14} /></button></div>)}</div>}
            <div className="system-ops-actions"><button type="button" className="admin-btn outline" onClick={checkApiHealth} disabled={healthChecking}><Activity size={14} /> {healthChecking ? "Checking…" : "Check services"}</button><button type="button" className="admin-btn outline" onClick={requestForceRefresh}><RefreshCw size={14} /> Force client sync</button><button type="button" className="admin-btn outline" onClick={_exportConfigJSON}><Download size={14} /> Export config</button><button type="button" className="admin-btn outline" onClick={openReviewChanges}><FileText size={14} /> Review staged changes</button></div>
          </section>
          {/* Maintenance scheduler */}
          <section className="admin-card admin-g-system system-control-card system-maintenance-card">
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
          <section className="admin-card admin-g-system system-control-card system-roles-card">
            <h2><ShieldAlert size={20} color="var(--violet)" /> Admin Roles <AdminActionBadge mode="live" /></h2>
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
              {adminRoster.length === 0 ? (
                <div className="admin-empty">No admin roles assigned.</div>
              ) : adminRoster.map(({ user_id: id, role }) => {
                const u = allUsers.find(x => x.user_id === id);
                return (
                  <div key={id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: "var(--bg)", borderRadius: 8, border: "1px solid var(--border)" }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{u?.name || id}</div>
                      <div style={{ fontSize: 11, color: "var(--muted)", fontFamily: "var(--mono)" }}>{id}</div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 10, background: "rgba(109,91,208,0.12)", color: "var(--violet)" }}>{role}</span>
                      <button onClick={() => requestRevokeAdminRole(id)} className="admin-btn danger" style={{ padding: "4px 8px" }} aria-label={`Remove admin access for ${u?.name || id}`}><Trash2 size={14} /></button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Config backup & restore */}
          <section className="admin-card admin-g-system system-control-card system-backup-card">
            <h2><Database size={20} color="var(--blue)" /> Config Backup &amp; Restore</h2>
            <p className="admin-subtext">Download the live config as JSON, or import a backup (loads into the editor — Review &amp; Deploy to apply). Rollback to a recent deploy lives in the save bar below.</p>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button className="admin-btn outline" onClick={_exportConfigJSON}><FileText size={15} /> Export JSON</button>
              <button className="admin-btn outline" onClick={() => configFileRef.current?.click()}><FileText size={15} /> Import JSON</button>
              <input ref={configFileRef} type="file" accept="application/json,.json" onChange={handleImportConfig} style={{ display: "none" }} />
            </div>
          </section>

          {/* Data export center */}
          <section className="admin-card admin-g-system system-control-card system-export-card">
            <h2><FileText size={20} color="var(--blue)" /> Data Export</h2>
            <p className="admin-subtext">Download the currently loaded admin data as CSV for reporting or backup.</p>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button className="admin-btn outline" onClick={() => exportCsv("users.csv", ["user_id", "name", "last_seen_at", "courses"], allUsers.map(u => [u.user_id, u.name, u.last_seen_at || "", Object.keys(u.courses || {}).filter(c => !c.startsWith("_")).join(";")]))} disabled={allUsers.length === 0}>Users ({allUsers.length})</button>
              <button className="admin-btn outline" onClick={() => exportCsv("feedback.csv", ["created_at", "status", "user_id", "message"], feedbackList.map(f => [f.created_at, f.status, f.user_id || "", f.message]))} disabled={feedbackList.length === 0}>Feedback ({feedbackList.length})</button>
              <button className="admin-btn outline" onClick={() => exportCsv("audit_logs.csv", ["created_at", "action", "admin_id", "details"], auditLogs.map(l => [l.created_at, l.action, l.admin_id, JSON.stringify(l.details || {})]))} disabled={auditLogs.length === 0}>Audit logs ({auditLogs.length})</button>
            </div>
          </section>

          {/* Scheduled config deploys */}
          <section className="admin-card admin-g-system system-control-card system-deploy-card">
            <h2><Clock size={20} color="var(--amber)" /> Scheduled Deploys <AdminActionBadge mode="scheduled" /></h2>
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

          <section className="admin-card admin-g-system system-control-card system-flags-card">
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
          </section>

          <section className="admin-card admin-span-all admin-g-system system-control-card system-companion-card" style={{ gridColumn: "1 / -1" }}>
            <div className="system-companion-head">
              <div>
                <span className="system-companion-eyebrow">Student experience</span>
                <h2><PawPrint size={20} color="var(--violet)" /> Companion Settings</h2>
                <p className="admin-subtext">Manage greeting pets, adoption, progression, motion, wardrobe availability, and cohort-wide companion XP from one place.</p>
              </div>
              <span className="system-companion-badge"><Sparkles size={14} /> Pet controls</span>
            </div>

            {(() => {
              const greetingPets = {
                enabled: true,
                petKey: "cat",
                motion: true,
                // Both absent in any config saved before the companion shipped,
                // so the defaults here ARE the back-compat story — no migration.
                companion: true,
                xpRate: 1,
                // Absent in every config written before signature motion and
                // the wardrobe shipped. Defaulting them ON is the back-compat
                // story — the same call made for `companion` above.
                signatures: true,
                wardrobe: true,
                hatsOff: [],
                ...(flags.greetingPets || {}),
              };
              const updateGreetingPets = patch => {
                const next = { ...greetingPets, ...patch };
                delete next.mode; // Drop the retired daily/featured rotation setting on the next save.
                setFlags({ ...flags, greetingPets: next });
              };
              // getPetByKey (not a raw find) so a config still carrying the
              // legacy "turtle" key previews the rover the admin actually picked.
              const previewPet = getPetByKey(greetingPets.petKey);
              const PreviewPet = previewPet.Svg;
              return (
                <div className="admin-field system-companion-config">
                  <div className="system-companion-layout">
                    <div className="system-companion-panel system-companion-greeting">
                      <span className="system-companion-panel-kicker">Greeting</span>
                      <label className="system-companion-toggle">
                        <input type="checkbox" checked={greetingPets.enabled} onChange={e => updateGreetingPets({ enabled: e.target.checked })} />
                        <Sparkles size={15} color="var(--violet)" /> Greeting companion
                      </label>
                      <p className="admin-subtext">Choose the companion shown beside the Today greeting until a student adopts their own. Deploy Config to publish this cohort-wide.</p>
                      <div className="system-companion-preview" data-disabled={!greetingPets.enabled}>
                        <span className="dg-pet" data-pet={previewPet.key} data-motion={greetingPets.motion ? "on" : "off"} aria-hidden="true" style={{ width: 44, height: 44 }}>
                          <PreviewPet />
                        </span>
                        <div style={{ minWidth: 0 }}>
                          <strong>{greetingPets.enabled ? "Student greeting preview" : "Companions are hidden"}</strong>
                          <small>
                            {previewPet.label} is the cohort greeting pet. {greetingPets.motion ? "Motion on." : "Motion off."}
                          </small>
                        </div>
                      </div>
                      <div className="system-companion-fields" data-disabled={!greetingPets.enabled}>
                        <label className="admin-field">
                          <span>Greeting pet</span>
                          <select className="admin-input" disabled={!greetingPets.enabled} value={previewPet.key} onChange={e => updateGreetingPets({ petKey: e.target.value })}>
                            {PETS.map(pet => <option key={pet.key} value={pet.key}>{pet.label}</option>)}
                          </select>
                        </label>
                        <label className="system-companion-check">
                          <input type="checkbox" disabled={!greetingPets.enabled} checked={greetingPets.motion} onChange={e => updateGreetingPets({ motion: e.target.checked })} /> Motion
                        </label>
                      </div>
                    </div>

                    {/* Companion layer — adoption, the pet page, XP and friends'
                        pets. Separate from the switch above so the decorative
                        greeting pet can stay while the game is turned off. */}
                    <div className="system-companion-panel system-companion-progression" data-disabled={!greetingPets.enabled}>
                      <span className="system-companion-panel-kicker">Progression</span>
                      <label className="system-companion-toggle" style={{ cursor: greetingPets.enabled ? "pointer" : "not-allowed" }}>
                        <input type="checkbox" disabled={!greetingPets.enabled} checked={greetingPets.companion !== false} onChange={e => updateGreetingPets({ companion: e.target.checked })} />
                        <PawPrint size={15} color="var(--violet)" /> Adoptable companion
                      </label>
                      <p className="admin-subtext">
                        Lets students adopt and name a pet that levels up from marked classes and cleared deadlines, unlocks the Companion page, and shows friends&apos; pets on their cards. Turn off to leave only the decorative greeting pet.
                      </p>
                      <label className="admin-field system-companion-rate">
                        <span>XP rate</span>
                        <select
                          className="admin-input"
                          disabled={!greetingPets.enabled || greetingPets.companion === false}
                          value={String(greetingPets.xpRate ?? 1)}
                          onChange={e => updateGreetingPets({ xpRate: Number(e.target.value) })}
                        >
                          <option value="0.5">0.5× — slower</option>
                          <option value="1">1× — normal</option>
                          <option value="1.5">1.5×</option>
                          <option value="2">2× — double</option>
                          <option value="3">3× — max</option>
                        </select>
                      </label>
                      <p className="admin-subtext system-companion-note">
                        Applies to new XP only. Banked XP keeps its value; the rate is safely clamped to 0.25&times;&ndash;3&times;.
                      </p>
                    </div>
                  </div>

                  {/* Presentation controls. Nothing here touches progression:
                      withdrawing a wearable hides it, it does not un-earn it,
                      and turning it back on returns every student to the hat
                      they had chosen. */}
                  <div className="system-companion-panel system-companion-appearance" data-disabled={!greetingPets.enabled || greetingPets.companion === false}>
                    <span className="system-companion-panel-kicker">Appearance &amp; motion</span>
                    <label className="system-companion-toggle">
                      <input
                        type="checkbox"
                        disabled={!greetingPets.enabled}
                        checked={greetingPets.signatures !== false}
                        onChange={e => updateGreetingPets({ signatures: e.target.checked })}
                      />
                      <Sparkles size={15} color="var(--violet)" /> Signature micro-motion
                    </label>
                    <p className="admin-subtext" style={{ margin: "6px 0 12px" }}>
                      The one small loop each companion has of its own — the dog pants, the panda chews, the robot&apos;s status light blinks. Off leaves the shared idle, the moods and the reactions running. Readers who have asked their device for reduced motion never see any of it either way.
                    </p>

                    <label className="system-companion-toggle">
                      <input
                        type="checkbox"
                        disabled={!greetingPets.enabled || greetingPets.companion === false}
                        checked={greetingPets.wardrobe !== false}
                        onChange={e => updateGreetingPets({ wardrobe: e.target.checked })}
                      />
                      <Shirt size={15} color="var(--violet)" /> Wardrobe
                    </label>
                    <p className="admin-subtext" style={{ margin: "6px 0 10px" }}>
                      {HATS.length} hats, {COATS.length} coats and {NECKWEAR.length} collars. Hats and collars are mostly earned by level; the coats and the last of the hats come from devotion, past level 12. Off hides the whole section — every hat, collar and coat on every pet.
                    </p>

                    {greetingPets.wardrobe !== false && (() => {
                      const hatsOff = greetingPets.hatsOff || [];
                      const toggleHat = key => updateGreetingPets({
                        hatsOff: hatsOff.includes(key) ? hatsOff.filter(k => k !== key) : [...hatsOff, key],
                      });
                      return (
                        <div style={{ opacity: greetingPets.enabled && greetingPets.companion !== false ? 1 : 0.55 }}>
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(84px, 1fr))", gap: 7 }}>
                            {HATS.map(h => {
                              const withdrawn = hatsOff.includes(h.key);
                              return (
                                <button
                                  key={h.key}
                                  type="button"
                                  disabled={!greetingPets.enabled || greetingPets.companion === false}
                                  aria-pressed={!withdrawn}
                                  title={withdrawn ? `${h.label} — withdrawn` : `${h.label} — ${hatRequirement(h.key)}`}
                                  onClick={() => toggleHat(h.key)}
                                  style={{
                                    display: "grid", justifyItems: "center", gap: 2, padding: "7px 4px 5px",
                                    border: `1px solid ${withdrawn ? "var(--border)" : "var(--violet)"}`,
                                    borderRadius: 10,
                                    background: withdrawn ? "var(--bg)" : "color-mix(in srgb, var(--violet) 12%, var(--bg))",
                                    color: "var(--text)", font: "inherit", cursor: "pointer",
                                    opacity: withdrawn ? 0.5 : 1,
                                  }}
                                >
                                  <span className="dg-pet" style={{ display: "inline-grid", position: "relative", width: 34, height: 34 }} data-motion="off" aria-hidden="true">
                                    <PetHat hat={h.key} />
                                  </span>
                                  <span style={{ fontSize: 9.5, fontWeight: 700, lineHeight: 1.2, textAlign: "center" }}>{h.label}</span>
                                  <span style={{ fontSize: 8.5, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".3px" }}>
                                    {withdrawn ? "withdrawn" : hatRequirement(h.key)}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                          <p className="admin-subtext" style={{ margin: "9px 0 0" }}>
                            Tap to withdraw one. A withdrawn wearable disappears from the wardrobe and stops being drawn — but it is <strong>not</strong> un-earned: anyone already wearing it keeps the choice, and turning it back on puts it straight back on their pet. {hatsOff.length > 0 && `${hatsOff.length} withdrawn.`}
                          </p>
                        </div>
                      );
                    })()}

                    <p className="admin-subtext" style={{ margin: "10px 0 0" }}>
                      To give one student a wearable early, raise their companion&apos;s level in the student inspector — hats are earned from level, so there is no separate grant to make.
                    </p>
                  </div>
                </div>
              );
            })()}

            {/* Cohort-wide companion XP. These take effect immediately on every
                adopted pet — they are RPC calls, not flags, so there is no
                Deploy step to undo them. Hence the explicit counts and the
                typed confirmation on the destructive one. */}
            <div className="admin-field system-companion-bulk">
              <span className="system-companion-panel-kicker">Immediate cohort action</span>
              <h3><Activity size={17} /> Companion XP — all students</h3>
              <p className="admin-subtext" style={{ margin: "0 0 10px" }}>
                Applies to every student who has adopted a companion. Adjustments sit
                beside earned XP rather than replacing it, so classes, deadlines and
                streaks are never deleted and any change here can be undone with
                &ldquo;Reset adjustments&rdquo;. Totals floor at zero.
              </p>

              <div className="admin-field-row" style={{ alignItems: "flex-end", maxWidth: 460 }}>
                <label className="admin-field" style={{ flex: "1 1 110px", margin: 0 }}>
                  <span>XP amount</span>
                  <input
                    className="admin-input"
                    type="number"
                    min="1"
                    step="10"
                    value={petBulkDraft}
                    disabled={petBulkBusy}
                    onChange={e => setPetBulkDraft(Math.max(1, Number(e.target.value) || 0))}
                  />
                </label>
                {[["Add to all", 1], ["Remove from all", -1]].map(([label, sign]) => (
                  <button
                    key={label}
                    type="button"
                    className="admin-btn outline"
                    disabled={petBulkBusy || petBulkDraft < 1}
                    onClick={async () => {
                      const delta = sign * petBulkDraft;
                      if (!confirm(`${sign > 0 ? "Add" : "Remove"} ${petBulkDraft} XP ${sign > 0 ? "to" : "from"} EVERY student with a companion?\n\nThis takes effect immediately. Earned history is kept, and this can be undone by applying the opposite amount.`)) return;
                      setPetBulkBusy(true); setPetBulkMessage("");
                      const { data, error } = await supabase.rpc("admin_bulk_adjust_pet_xp", { p_delta: delta });
                      setPetBulkBusy(false);
                      if (error) { setPetBulkMessage(`Could not update companions: ${error.message}`); return; }
                      setPetBulkMessage(`${sign > 0 ? "Added" : "Removed"} ${petBulkDraft} XP ${sign > 0 ? "to" : "from"} ${data} companion${data === 1 ? "" : "s"}.`);
                      await logAdminAction(admin_id, "bulk_adjust_pet_xp", { delta, affected: data });
                    }}
                  >
                    {petBulkBusy ? "Working…" : label}
                  </button>
                ))}
              </div>

              <div className="admin-field-row" style={{ alignItems: "flex-end", maxWidth: 460, marginTop: 10 }}>
                <label className="admin-field" style={{ flex: "1 1 110px", margin: 0 }}>
                  <span>Set everyone to</span>
                  <select
                    className="admin-input"
                    value={petBulkLevelDraft}
                    disabled={petBulkBusy}
                    onChange={e => setPetBulkLevelDraft(Number(e.target.value))}
                  >
                    {Array.from({ length: 12 }, (_, index) => index + 1).map(level => <option key={level} value={level}>Level {level}</option>)}
                  </select>
                </label>
                <button
                  type="button"
                  className="admin-btn outline"
                  disabled={petBulkBusy}
                  onClick={async () => {
                    // The only cohort action that can take progress away from
                    // students who earned it, so it asks for the level typed back.
                    const typed = prompt(`Set EVERY companion to exactly Level ${petBulkLevelDraft}?\n\nStudents who earned beyond this will be reduced to match — it flattens the leaderboard. Earned history is kept and "Reset adjustments" undoes it.\n\nType ${petBulkLevelDraft} to confirm:`);
                    if (typed === null) return;
                    if (typed.trim() !== String(petBulkLevelDraft)) { setPetBulkMessage("Cancelled — confirmation did not match."); return; }
                    setPetBulkBusy(true); setPetBulkMessage("");
                    const { data, error } = await supabase.rpc("admin_bulk_set_pet_level", { p_level: petBulkLevelDraft });
                    setPetBulkBusy(false);
                    if (error) { setPetBulkMessage(`Could not update companions: ${error.message}`); return; }
                    setPetBulkMessage(`Set ${data} companion${data === 1 ? "" : "s"} to Level ${petBulkLevelDraft}.`);
                    await logAdminAction(admin_id, "bulk_set_pet_level", { level: petBulkLevelDraft, affected: data });
                  }}
                >
                  Set all to level
                </button>
                <button
                  type="button"
                  className="admin-btn outline"
                  disabled={petBulkBusy}
                  onClick={async () => {
                    if (!confirm("Reset every admin adjustment?\n\nAll companions fall back to purely earned XP. Grants and reductions are cleared; nothing students earned is affected.")) return;
                    setPetBulkBusy(true); setPetBulkMessage("");
                    const { data, error } = await supabase.rpc("admin_bulk_reset_pet_adjustments");
                    setPetBulkBusy(false);
                    if (error) { setPetBulkMessage(`Could not reset companions: ${error.message}`); return; }
                    setPetBulkMessage(data === 0 ? "No companions had adjustments to reset." : `Reset adjustments on ${data} companion${data === 1 ? "" : "s"}.`);
                    await logAdminAction(admin_id, "bulk_reset_pet_adjustments", { affected: data });
                  }}
                >
                  Reset adjustments
                </button>
              </div>
              {petBulkMessage && <p className="admin-subtext" style={{ margin: "9px 0 0", color: petBulkMessage.startsWith("Could not") ? "var(--danger)" : "var(--live)" }}>{petBulkMessage}</p>}
            </div>
          </section>

          <section className="admin-card admin-g-system system-control-card system-experience-card">
            <h2><Sparkles size={20} color="var(--blue)" /> Release &amp; Presentation</h2>
            <div className="admin-field" style={{ marginTop: 16 }}>
              <label style={{ display: "block", marginBottom: 8, fontSize: 12, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "1px" }}>TermFlow Wrapped Release</label>
              {(() => {
                const WRAPPED_MIN_DATE = "2026-12-14"; // hard floor (last week of Term V) — mirrored in App.jsx gating
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
                        title="Release immediately (or on 14 Dec 2026 if that hasn't arrived yet)"
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
                      {status} Earliest allowed release is 14 Dec 2026 (dates before it are clamped). Automatically unlocked in the last week of Term V (14–20 Dec 2026). Remember to hit <b>Deploy Config to Cloud</b>.
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

<section className="admin-card admin-span-all admin-g-broadcast" style={{ gridColumn: "1 / -1" }}>
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

          <section className="admin-card admin-g-system system-control-card system-experiments-card">
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
          <section className="admin-card admin-span-all admin-g-system system-time-machine" style={{ gridColumn: "1 / -1" }}>
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
          <section className="admin-card admin-span-all admin-g-insights insights-sync-log" style={{ gridColumn: "1 / -1" }}>
            <div className="insights-sync-head">
              <div><span className="insights-eyebrow"><Terminal size={13} /> Session activity</span><h2>Schedule sync logs</h2><p>Refresh attempts in this browser session only. These are not logs from other users or the server.</p></div>
              <div className="insights-sync-meta"><span><i className={syncLogs[0]?.status === "error" ? "is-error" : ""} />{syncLogs.length ? `${syncLogs.length} events captured` : "Awaiting first event"}</span>
              {syncLogs.length > 5 && (
                <button className="admin-btn outline" onClick={() => setShowAllLogs(!showAllLogs)}>
                  {showAllLogs ? "Show less" : "View all logs"}
                </button>
              )}
              </div>
            </div>
            <div className={`insights-sync-console ${showAllLogs ? "is-expanded" : ""}`}>
              {displayedLogs.length === 0 ? (
                <div className="insights-sync-empty"><Activity size={18} /><span>No schedule refreshes recorded in this session yet. Use the app's Refresh button to test the feed.</span></div>
              ) : (
                displayedLogs.map((log, i) => (
                  <div key={i} className={log.status === "error" ? "is-error" : ""}>
                    <time dateTime={new Date(log.ts).toISOString()} title={new Date(log.ts).toLocaleString("en-IN")}>{new Date(log.ts).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</time>
                    <strong><i />{log.status.toUpperCase()}</strong>
                    <div className="insights-sync-detail">
                      <span className="insights-sync-context">{log.source || "Source unavailable (earlier event)"} · {log.trigger || "Refresh"}{log.step ? ` · ${log.step}` : ""}</span>
                      <span className="insights-sync-message">{log.message}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          {/* Audit Logs */}
          <section className="admin-card admin-span-all admin-g-moderation admin-audit-trail" style={{ gridColumn: "1 / -1" }}>
            <div className="audit-head">
              <div><span className="moderation-eyebrow"><Terminal size={13} /> Accountability</span><h2>Admin audit trail</h2><p className="admin-subtext">A searchable record of the last 200 administrative actions.</p></div>
              <button className="admin-btn outline audit-export" onClick={() => {
                const rows = filteredAuditLogs.map(l => [l.created_at, l.action, l.admin_id, JSON.stringify(l.details || {})]);
                exportCsv("admin_audit_logs.csv", ["created_at", "action", "admin_id", "details"], rows);
              }}><Download size={14} /> Export CSV</button>
            </div>
            <div className="audit-metrics">
              <div><span>Recorded</span><strong>{auditLogs.length}</strong><small>recent actions</small></div>
              <div><span>Action types</span><strong>{new Set(auditLogs.map(log => log.action)).size}</strong><small>distinct operations</small></div>
              <div><span>Administrators</span><strong>{new Set(auditLogs.map(log => log.admin_id)).size}</strong><small>active identities</small></div>
            </div>
            <div className="audit-toolbar">
              <label className="admin-search-control"><Search size={15} /><input value={auditSearch} onChange={e => setAuditSearch(e.target.value)} placeholder="Search action, admin or details" aria-label="Search audit logs" />{auditSearch && <button type="button" onClick={() => setAuditSearch("")} aria-label="Clear audit search"><X size={14} /></button>}</label>
              <label className="admin-select-control"><Filter size={15} /><select value={auditActionFilter} onChange={e => setAuditActionFilter(e.target.value)} aria-label="Filter audit action"><option value="all">All actions</option>{[...new Set(auditLogs.map(l => l.action))].sort().map(a => <option key={a} value={a}>{a.replace(/_/g, " ")}</option>)}</select></label>
              <span className="audit-result-count"><strong>{filteredAuditLogs.length}</strong> matched</span>
            </div>
            <div className="audit-list">
              {filteredAuditLogs.length === 0 ? <div className="moderation-empty"><span><Search size={20} /></span><strong>No matching activity</strong><p>Try a broader search or reset the action filter.</p><button type="button" className="admin-btn outline" onClick={() => { setAuditSearch(""); setAuditActionFilter("all"); }}>Clear filters</button></div> : filteredAuditLogs.slice(0, 60).map((log) => {
                let Icon = FileText;
                let tone = "neutral";
                if (log.action.includes("save") || log.action.includes("refresh")) { Icon = Save; tone = "info"; }
                else if (log.action.includes("cancel") || log.action.includes("override") || log.action.includes("edit")) { Icon = AlertTriangle; tone = "watch"; }
                else if (log.action.includes("ban") || log.action.includes("delete") || log.action.includes("clear")) { Icon = Trash2; tone = "risk"; }
                const hasDetails = Object.keys(log.details || {}).length > 0;
                const isExpanded = auditExpandedId === log.id;
                return <article key={log.id} className={`audit-row is-${tone} ${isExpanded ? "is-expanded" : ""}`}>
                  <span className="audit-icon"><Icon size={15} /></span>
                  <div className="audit-row-main"><strong>{log.action.replace(/_/g, " ")}</strong><span>Admin · {log.admin_id}</span></div>
                  <time dateTime={log.created_at}>{new Date(log.created_at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</time>
                  {hasDetails ? <button type="button" className="audit-detail-toggle" onClick={() => setAuditExpandedId(isExpanded ? null : log.id)} aria-expanded={isExpanded}><span>{isExpanded ? "Hide" : "Details"}</span><ChevronRight size={15} /></button> : <span className="audit-no-details">No details</span>}
                  {isExpanded && <pre>{JSON.stringify(log.details, null, 2)}</pre>}
                </article>;
              })}
            </div>
            {filteredAuditLogs.length > 60 && <p className="audit-limit-note">Showing the first 60 matching records. Export CSV for the complete filtered result.</p>}
          </section>

          {/* Config drift — what live config layers on top of the bundled snapshot */}
          <section className="admin-card admin-g-system system-control-card system-drift-card" style={{ display: "flex", flexDirection: "column" }}>
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
          <section className="admin-card admin-g-system system-control-card system-alerts-card" style={{ display: "flex", flexDirection: "column" }}>
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

            <section className="admin-card system-control-card system-snapshot-card">
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

            <section className="admin-card danger-zone system-danger-card">
              <h2><AlertTriangle size={20} color="var(--danger, #e74c3c)" /> Danger Zone</h2>

              <div className="admin-danger-row">
                <div>
                  <strong style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 4 }}>Maintenance Mode <AdminActionBadge mode="staged" /></strong>
                  <span className="admin-subtext" style={{ margin: 0 }}>Once deployed, locks out all non-admin users immediately.</span>
                </div>
                <label className="admin-toggle">
                  <input type="checkbox" checked={!!flags.maintenanceMode} onChange={e => setFlags({ ...flags, maintenanceMode: e.target.checked })} />
                  <span className="slider"></span>
                </label>
              </div>

              <div className="admin-danger-row">
                <div>
                  <strong style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 4 }}>Push Dispatcher <AdminActionBadge mode="staged" /></strong>
                  <span className="admin-subtext" style={{ margin: 0 }}>
                    After deployment, ON delivers push and OFF pauses outgoing push within a minute (the in-app inbox still updates; queued events resume when re-enabled). Kill-switch if the new push system misbehaves — flip OFF, deploy, then redeploy the legacy functions to fully fall back.
                  </span>
                </div>
                <label className="admin-toggle">
                  <input type="checkbox" checked={flags.dispatchEnabled !== false} onChange={e => setFlags({ ...flags, dispatchEnabled: e.target.checked })} />
                  <span className="slider"></span>
                </label>
              </div>

              <div className="admin-danger-row">
                <div>
                  <strong style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 4 }}>Force Global Refresh <AdminActionBadge mode="live" /></strong>
                  <span className="admin-subtext" style={{ margin: 0 }}>Force all clients to re-sync from cloud.</span>
                </div>
                <button className="admin-btn outline" onClick={requestForceRefresh}>
                  <RefreshCw size={14} /> Force Sync
                </button>
              </div>
            </section>

          </div>

          <section className="admin-card admin-span-all admin-g-moderation moderation-workspace" style={{ gridColumn: "1 / -1" }}>
            <div className="moderation-hero">
              <div><span className="moderation-eyebrow"><Shield size={13} /> Student-facing content</span><h2>Live status moderation</h2><p>Review what is visible across student cards and remove inappropriate or outdated statuses.</p></div>
              <div className="moderation-live-pill"><i /> {activeStatusUsers.length} visible now</div>
            </div>
            <div className="moderation-summary-grid" role="group" aria-label="Filter statuses by urgency">
              <button type="button" className={moderationScope === "all" ? "active" : ""} onClick={() => setModerationScope("all")}><span>Active now</span><strong>{activeStatusUsers.length}</strong><small>all visible statuses</small><ChevronRight size={16} /></button>
              <button type="button" className={`${moderationExpiringSoon.length ? "is-watch" : ""} ${moderationScope === "soon" ? "active" : ""}`} onClick={() => setModerationScope("soon")}><span>Ending within 1h</span><strong>{moderationExpiringSoon.length}</strong><small>prioritise review</small><ChevronRight size={16} /></button>
              <button type="button" className={moderationScope === "later" ? "active" : ""} onClick={() => setModerationScope("later")}><span>Ending later</span><strong>{activeStatusUsers.length - moderationExpiringSoon.length}</strong><small>more than 1h left</small><ChevronRight size={16} /></button>
              <div><span>Latest expiry</span><strong>{activeStatusUsers.length ? new Date(Math.max(...activeStatusUsers.map(u => new Date(u.courses?._status?.until || 0).getTime()))).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "—"}</strong><small>furthest scheduled</small></div>
            </div>
            <div className="moderation-queue-head"><div><span>Review queue</span><strong>{visibleStatusUsers.length} status{visibleStatusUsers.length === 1 ? "" : "es"}</strong></div><small>Clearing is immediate and recorded in the audit trail.</small></div>
            <div className="admin-workspace-toolbar moderation-toolbar">
              <label className="admin-search-control"><Search size={15} /><input value={moderationSearch} onChange={e => setModerationSearch(e.target.value)} placeholder="Search student or status…" aria-label="Search active statuses" />{moderationSearch && <button type="button" onClick={() => setModerationSearch("")} aria-label="Clear moderation search"><X size={14} /></button>}</label>
              <label className="admin-select-control"><ListFilter size={15} /><select value={moderationSort} onChange={e => setModerationSort(e.target.value)} aria-label="Sort active statuses"><option value="expiry">Expires soonest</option><option value="recent">Expires latest</option><option value="name">Student name</option></select></label>
            </div>
            {moderationMessage && <div className={`admin-inline-notice moderation-notice ${moderationMessage.startsWith("Could not") ? "is-error" : ""}`}>{moderationMessage.startsWith("Could not") ? <AlertTriangle size={15} /> : <Check size={15} />}{moderationMessage}</div>}
            <div className="moderation-list">
              {visibleStatusUsers.length === 0 ? <div className="moderation-empty"><span>{activeStatusUsers.length ? <Search size={20} /> : <Shield size={20} />}</span><strong>{activeStatusUsers.length ? "No statuses match" : "Everything is clear"}</strong><p>{activeStatusUsers.length ? "Try another search or urgency filter." : "There are no student statuses requiring moderation right now."}</p>{activeStatusUsers.length && <button type="button" className="admin-btn outline" onClick={() => { setModerationSearch(""); setModerationScope("all"); }}>Clear filters</button>}</div> : visibleStatusUsers.map(u => {
                const status = u.courses._status;
                const expiresAt = new Date(status.until);
                const minutesLeft = Math.max(0, Math.ceil((expiresAt.getTime() - LOAD_NOW) / 60000));
                const expiresSoon = minutesLeft <= 60;
                return <article key={u.user_id} className={`moderation-row ${expiresSoon ? "is-expiring" : ""}`} role="button" tabIndex={0} onClick={() => setSelectedUser(u)} onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSelectedUser(u); } }}>
                  <div className="moderation-person"><Avatar name={u.name} email={u.email || u.user_id} /><span className={`moderation-urgency-dot ${expiresSoon ? "is-expiring" : ""}`} title={expiresSoon ? "Expires within one hour" : "Active"} /></div>
                  <div className="moderation-status"><div className="moderation-identity"><strong>{u.name || "Unnamed student"}</strong><small>{u.email || u.user_id}</small></div><blockquote><span>{status.emoji || "💬"}</span>{status.text || "No status message"}</blockquote></div>
                  <div className={`moderation-expiry ${expiresSoon ? "is-expiring" : ""}`}><Clock3 size={14} /><div><span>{expiresSoon ? `${minutesLeft} min left` : "Scheduled expiry"}</span><strong>{expiresAt.toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</strong></div></div>
                  <div className="moderation-actions"><button type="button" onClick={e => { e.stopPropagation(); setSelectedUser(u); }} className="admin-btn outline moderation-inspect"><Eye size={14} /> Inspect</button><button type="button" onClick={e => { e.stopPropagation(); clearUserStatus(u); }} disabled={moderationBusyId === u.user_id} className="admin-btn outline moderation-clear"><Trash2 size={14} /> {moderationBusyId === u.user_id ? "Clearing…" : "Remove status"}</button></div>
                </article>;
              })}
            </div>
          </section>

          <section className="admin-card admin-span-all admin-g-database database-workspace" style={{ gridColumn: "1 / -1" }}>
            <div className="database-hero">
              <div className="database-hero-copy">
                <span className="database-eyebrow"><Activity size={13} /> Data operations</span>
                <h2><Database size={22} /> Database explorer</h2>
                <p>Inspect the latest records across TermFlow's operational datasets.</p>
                <span className="database-readonly"><Shield size={13} /> Read-only · capped at 50 rows</span>
              </div>
              <button type="button" className="admin-btn database-refresh" onClick={() => setDbRefreshKey(key => key + 1)} disabled={dbLoading}>
                <RefreshCw size={15} className={dbLoading ? "spin-icon" : ""} /> {dbLoading ? "Refreshing…" : "Refresh data"}
              </button>
            </div>

            <div className="database-metrics" aria-label="Current dataset summary">
              <div><span>Dataset</span><strong>{selectedDbTable.label}</strong></div>
              <div><span>Loaded rows</span><strong>{dbLoading ? "—" : dbRows.length}</strong></div>
              <div><span>Columns</span><strong>{dbLoading ? "—" : dbColumns.length}</strong></div>
              <div><span>Last synced</span><strong>{dbLoadedAt ? dbLoadedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "Waiting"}</strong></div>
            </div>

            <div className="database-layout">
              <nav className="database-datasets" aria-label="Database tables">
                <div className="database-section-label"><Database size={13} /> Datasets <span>{DATABASE_TABLES.length}</span></div>
                <div className="database-table-picker">
                  {DATABASE_TABLES.map(table => (
                    <button
                      type="button"
                      key={table.id}
                      className={dbTable === table.id ? "active" : ""}
                      aria-current={dbTable === table.id ? "page" : undefined}
                      onClick={() => { setDbTable(table.id); setDbSearch(""); setDbColumn("all"); setDbCopyStatus(""); }}
                    >
                      <span className="database-picker-icon"><FileText size={15} /></span>
                      <span className="database-picker-copy"><strong>{table.label}</strong><small>{table.description}</small></span>
                      <ChevronRight size={15} className="database-picker-arrow" />
                    </button>
                  ))}
                </div>
              </nav>

              <div className="database-main">
                <div className="database-context">
                  <div><span className="database-context-label">Active dataset</span><strong>{selectedDbTable.label}</strong><small>{selectedDbTable.description}</small></div>
                  <span className={`database-live-state ${dbError ? "is-error" : dbLoading ? "is-loading" : ""}`}><i />{dbError ? "Unavailable" : dbLoading ? "Loading" : "Live snapshot"}</span>
                </div>

                {!dbLoading && !dbError && dbRows.length > 0 && (
                  <div className="admin-workspace-toolbar database-filters">
                    <label className="admin-search-control"><Search size={16} /><input value={dbSearch} onChange={e => setDbSearch(e.target.value)} placeholder={`Search ${selectedDbTable.label.toLowerCase()}…`} aria-label="Search loaded database rows" />{dbSearch && <button type="button" onClick={() => setDbSearch("")} aria-label="Clear database search"><X size={14} /></button>}</label>
                    <label className="admin-select-control"><ListFilter size={15} /><select value={dbColumn} onChange={e => setDbColumn(e.target.value)} aria-label="Choose database column"><option value="all">All columns</option>{dbColumns.map(column => <option key={column} value={column}>{column}</option>)}</select></label>
                    <span className="database-result-count"><strong>{filteredDbRows.length}</strong> of {dbRows.length} rows</span>
                  </div>
                )}

                <div className="database-grid">
                  <div className="admin-table-wrapper database-table-shell">
                    {dbLoading ? <div className="database-state"><RefreshCw size={22} className="spin-icon" /><strong>Loading {selectedDbTable.label.toLowerCase()}</strong><span>Fetching the latest available records…</span></div> : dbError ? <div className="database-state database-error"><AlertTriangle size={22} /><strong>Could not load this dataset</strong><span>{dbError}</span><button type="button" className="admin-btn outline" onClick={() => setDbRefreshKey(key => key + 1)}>Try again</button></div> : dbRows.length === 0 ? <div className="database-state"><Database size={22} /><strong>No records found</strong><span>{selectedDbTable.label} is currently empty.</span></div> : filteredDbRows.length === 0 ? <div className="database-state"><Search size={22} /><strong>No matching rows</strong><span>Try another search term or switch the selected column.</span><button type="button" className="admin-btn outline" onClick={() => { setDbSearch(""); setDbColumn("all"); }}>Clear filters</button></div> : (
                      <table className="database-table">
                        <thead><tr><th className="database-row-number">#</th>{dbColumns.map(column => <th key={column}>{column}</th>)}<th className="database-inspect-col">Action</th></tr></thead>
                        <tbody>{filteredDbRows.map((row, i) => (
                          <tr
                            key={row.id || row.user_id || row.group_id || i}
                            className={dbSelectedRow === row ? "is-selected" : ""}
                            onClick={() => { setDbSelectedRow(row); setDbCopyStatus(""); }}
                            onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setDbSelectedRow(row); setDbCopyStatus(""); } }}
                            tabIndex={0}
                            aria-label={`Inspect row ${i + 1}`}
                          >
                            <td className="database-row-number">{i + 1}</td>
                            {dbColumns.map(column => { const value = row[column]; const text = typeof value === "object" && value !== null ? JSON.stringify(value) : String(value ?? "—"); return <td key={column} title={text}><span className={`database-cell ${value === null || value === undefined ? "is-null" : typeof value === "boolean" ? `is-boolean is-${value}` : typeof value === "object" ? "is-object" : ""}`}>{typeof value === "boolean" ? (value ? "True" : "False") : text}</span></td>; })}
                            <td><button type="button" className="database-inspect" onClick={e => { e.stopPropagation(); setDbSelectedRow(row); setDbCopyStatus(""); }}><Eye size={14} /> Inspect</button></td>
                          </tr>
                        ))}</tbody>
                      </table>
                    )}
                  </div>

                  <aside className={`database-inspector ${dbSelectedRow ? "has-selection" : ""}`} aria-live="polite">
                    <div className="database-inspector-head">
                      <div><span>Row inspector</span>{dbSelectedRow && <small>{Object.keys(dbSelectedRow).length} fields</small>}</div>
                      {dbSelectedRow && <div className="database-inspector-actions"><button type="button" onClick={copyDatabaseRow} aria-label="Copy row JSON">{dbCopyStatus === "Copied" ? <Check size={15} /> : <Copy size={15} />}<span>{dbCopyStatus || "Copy JSON"}</span></button><button type="button" onClick={() => { setDbSelectedRow(null); setDbCopyStatus(""); }} aria-label="Close row inspector"><X size={15} /></button></div>}
                    </div>
                    {dbSelectedRow ? <div className="database-field-list">{Object.entries(dbSelectedRow).map(([key, value]) => { const text = typeof value === "object" && value !== null ? JSON.stringify(value, null, 2) : String(value ?? "null"); return <div className="database-field" key={key}><span>{key}</span><code className={value === null || value === undefined ? "is-null" : ""}>{text}</code></div>; })}</div> : <div className="database-inspector-empty"><span><Eye size={20} /></span><strong>Select a row</strong><p>Click anywhere on a row or use its Inspect action to see every field here.</p></div>}
                  </aside>
                </div>
              </div>
            </div>
          </section>

      </div>

      {changesCount > 0 && (
        <aside className="admin-change-dock" aria-label="Staged configuration changes">
          <div className="admin-change-dock-copy">
            <AdminActionBadge mode="staged" />
            <span><strong>{changesCount} pending change{changesCount === 1 ? "" : "s"}</strong><small>Not visible to students until deployed</small></span>
          </div>
          <div className="admin-change-dock-actions">
            <button type="button" className="admin-btn" onClick={requestDiscardChanges}>Discard</button>
            <button type="button" className="admin-btn outline" onClick={openReviewChanges}><FileText size={15} /> Review</button>
            <button type="button" className="admin-btn primary" onClick={openReviewChanges} disabled={saving || isReadOnlyAdmin}><Save size={15} /> Deploy safely</button>
          </div>
        </aside>
      )}

      <div className="admin-save-footer" style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        {changesCount > 0 && (
          <button className="admin-btn" onClick={openReviewChanges} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <FileText size={16} /> Review {changesCount} change{changesCount > 1 ? "s" : ""}
          </button>
        )}
        <button className="admin-save-btn" onClick={openReviewChanges} disabled={saving || changesCount === 0 || isReadOnlyAdmin} style={{ position: "relative" }}>
          <Save size={18} /> {saving ? "Saving..." : changesCount ? "Review and Deploy" : "Config is up to date"}
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
          <button className="admin-btn outline" onClick={requestDiscardChanges} disabled={changesCount === 0} style={{ padding: "9px 16px" }}>
            <RefreshCw size={15} /> Revert Changes
          </button>
        )}
        {flags.configHistory && flags.configHistory.length > 0 && (
           <button className="admin-btn outline" onClick={() => {
              const last = flags.configHistory[0];
              requestAdminConfirmation({
                title: "Restore the previous deployment?",
                description: `Load the configuration saved on ${new Date(last.timestamp).toLocaleString()} into the editor.`,
                impact: "This is staged first. Review and deploy to make the restored configuration live.",
                confirmLabel: "Stage previous version",
                tone: "warning",
                onConfirm: () => setFlags({ ...stripHistoryKeys(last.flags), configHistory: flags.configHistory }),
              });
           }} style={{ padding: "9px 16px" }} title={`Restore the config from ${new Date(flags.configHistory[0].timestamp).toLocaleString()}`}>
              <RefreshCw size={15} /> Undo last deploy
           </button>
        )}
        {flags.configHistory && flags.configHistory.length > 0 && (
           <div style={{ position: "relative", display: "inline-block" }}>
              <select className="admin-input" onChange={e => {
                 if(!e.target.value) return;
                 const selectedHistory = flags.configHistory[parseInt(e.target.value)];
                 e.target.value = ""; // reset
                 requestAdminConfirmation({
                   title: "Restore this configuration version?",
                   description: `Load the version saved on ${new Date(selectedHistory.timestamp).toLocaleString()} by ${selectedHistory.author || "Admin"}.`,
                   impact: "This is staged first and will not affect students until you review and deploy it.",
                   confirmLabel: "Stage selected version",
                   tone: "warning",
                   onConfirm: () => setFlags({ ...stripHistoryKeys(selectedHistory.flags), configHistory: flags.configHistory }),
                 });
              }} style={{ padding: "9px 16px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg)", width: 220 }}>
                 <option value="">Restore Past Version...</option>
                 {flags.configHistory.map((h, i) => (
                    <option key={h.timestamp} value={i}>{new Date(h.timestamp).toLocaleString()} by {h.author || "Admin"}</option>
                 ))}
              </select>
           </div>
        )}
      </div>

      {adminConfirm && (
        <AdminModal
          title={adminConfirm.title}
          subtitle={adminConfirm.description}
          onClose={() => { if (!adminConfirmBusy) { setAdminConfirm(null); setAdminConfirmValue(""); } }}
          width={500}
        >
          <div className={`admin-confirm-impact is-${adminConfirm.tone || "warning"}`}>
            <AlertTriangle size={18} />
            <span>{adminConfirm.impact}</span>
          </div>
          {adminConfirm.requireText && (
            <label className="admin-confirm-field">
              <span>Type <strong>{adminConfirm.requireText}</strong> to confirm</span>
              <input autoFocus className="admin-input" value={adminConfirmValue} onChange={event => setAdminConfirmValue(event.target.value)} onKeyDown={event => { if (event.key === "Enter") runAdminConfirmation(); }} />
            </label>
          )}
          <div className="admin-confirm-actions">
            <button type="button" className="admin-btn" disabled={adminConfirmBusy} onClick={() => { setAdminConfirm(null); setAdminConfirmValue(""); }}>Cancel</button>
            <button
              type="button"
              className={`admin-btn ${adminConfirm.tone === "danger" ? "danger" : "primary"}`}
              disabled={adminConfirmBusy || (adminConfirm.requireText && adminConfirmValue.trim().toUpperCase() !== adminConfirm.requireText.toUpperCase())}
              onClick={runAdminConfirmation}
            >
              {adminConfirmBusy ? "Working…" : adminConfirm.confirmLabel || "Continue"}
            </button>
          </div>
        </AdminModal>
      )}

      {/* Pre-deploy review modal */}
      {reviewOpen && (() => {
        const changes = summarizeConfigChanges(originalFlags, flags);
        return (
          <>
            <div className="notif-backdrop" onClick={() => setReviewOpen(false)} style={{ zIndex: 10000 }} />
            <div className="admin-mobile-dialog" style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", background: "var(--card)", padding: 24, borderRadius: 16, width: "92%", maxWidth: 520, maxHeight: "85vh", overflowY: "auto", zIndex: 10001, border: "1px solid var(--border)", boxShadow: "0 10px 40px rgba(0,0,0,0.2)" }}>
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
        <AdminModal title="User profile" subtitle="Account context, access, and recent admin activity." onClose={() => setSelectedUser(null)} width={720}>
          <div className="admin-user-xray">
            <section className="admin-user-xray-hero">
              <Avatar name={selectedUser.name} email={selectedUser.email || selectedUser.user_id} />
              <div>
                <div className="admin-user-xray-name"><h2>{selectedUser.name || "Student"}</h2>{flags.bannedUsers?.includes(selectedUser.user_id) && <span>Banned</span>}</div>
                <p>{selectedUser.email || "No email stored"}</p>
                <div className="admin-user-xray-id"><code>{selectedUser.user_id}</code><button type="button" onClick={() => navigator.clipboard?.writeText(selectedUser.user_id)} title="Copy user ID"><Copy size={13} /></button></div>
              </div>
            </section>

            <section className="admin-user-xray-metrics">
              <div><span>Last seen</span><strong>{relativeUserActivity(selectedUser.last_seen_at)}</strong><small>{selectedUser.last_seen_at ? `${new Date(selectedUser.last_seen_at).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "Asia/Kolkata" })} IST` : "No heartbeat"}</small></div>
              <div><span>Enrollment</span><strong>{userSection(selectedUser) === "—" ? "No section" : `Section ${userSection(selectedUser)}`}</strong><small>{userCourseCount(selectedUser)} courses selected</small></div>
              <div><span>Push</span><strong className={pushSubscriberIds.has(selectedUser.user_id) ? "is-live" : ""}>{pushSubscriberIds.has(selectedUser.user_id) ? "Enabled" : "Off"}</strong><small>Notification access</small></div>
              <div><span>Profile updated</span><strong>{selectedUser.updated_at ? new Date(selectedUser.updated_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "Unknown"}</strong><small>Latest profile save</small></div>
            </section>

            <div className="admin-user-xray-grid">
              <section className="admin-user-xray-section">
                <h3>Access role</h3>
                <p>Applies immediately — role changes no longer wait for a config deploy.</p>
                <select className="admin-input" value={adminRoster.find(r => r.user_id === selectedUser.user_id)?.role || "user"} onChange={async e => {
                    const role = e.target.value;
                    try {
                      if (role === "user") await removeAdminRole(selectedUser.user_id);
                      else await setAdminRole(selectedUser.user_id, role);
                      await refreshAdminRoles();
                    } catch (err) {
                      alert(`Could not change role: ${err.message}`);
                    }
                 }}>
                    <option value="user">Standard User</option>
                    <option value="monitor">Monitor (Read-only Admin)</option>
                    <option value="superadmin">Superadmin</option>
                </select>
              </section>
              <section className="admin-user-xray-section">
                <h3>Enrolled courses</h3>
                <p>The saved course keys currently shaping this user&apos;s schedule.</p>
                <div className="admin-user-xray-courses">
                  {userCourseCount(selectedUser) ? Object.keys(selectedUser.courses || {}).filter(c => !c.startsWith("_")).map(c => <span key={c}>{c}</span>) : <em>No courses selected.</em>}
                </div>
              </section>
            </div>

            <section className="admin-user-xray-section">
                 <h3>Private admin notes</h3>
                 <p>Visible only inside Admin Tools and staged with the rest of the configuration.</p>
                 <textarea className="admin-input"
                    placeholder="Private notes about this user..."
                    value={flags.adminNotes?.[selectedUser.user_id] || ""}
                    onChange={e => {
                       const val = e.target.value;
                       setFlags({
                          ...flags, 
                          adminNotes: { ...(flags.adminNotes || {}), [selectedUser.user_id]: val }
                       });
                    }}
                    rows={3}
                 />
            </section>

            <section className="admin-user-xray-section">
              <h3><PawPrint size={15} /> Companion XP &amp; level</h3>
              <p>
                Adjustments are stored separately from earned XP, so a student&rsquo;s
                classes, deadlines and streaks are never deleted &mdash; a reduction can be
                undone by adding the same amount back. Total XP floors at zero.
              </p>

              {/* Live state. Without this the buttons below were fire-and-forget:
                  no way to see whether a grant landed, or that a reduction is
                  already in place. */}
              {!petState ? (
                <p className="admin-subtext" style={{ margin: "0 0 12px" }}>No companion record for this student yet.</p>
              ) : (
                <div className="admin-field" style={{ margin: "0 0 14px", padding: "10px 12px", border: "1px solid var(--border)", borderRadius: 10 }}>
                  {petState.pet_key ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                      <span className="dg-pet" data-pet={petState.pet_key} data-motion="off" aria-hidden="true" style={{ width: 34, height: 34, flex: "none" }}>
                        {(() => { const P = getPetByKey(petState.pet_key).Svg; return <P />; })()}
                      </span>
                      <div>
                        <strong>{petState.name || getPetByKey(petState.pet_key).label}</strong>
                        <span className="admin-subtext"> &middot; Level {petState.level}</span>
                        <div className="admin-subtext">
                          {petState.earned_xp} earned
                          {petState.granted_xp !== 0 && (
                            <> {petState.granted_xp > 0 ? "+" : "−"}{Math.abs(petState.granted_xp)} adjustment</>
                          )}
                          {" = "}<strong>{petState.total_xp} XP</strong>
                        </div>
                        <div className="admin-subtext">
                          Adopted {petState.adopted_at || "—"}
                          {petState.companion_enabled === false && <> &middot; <strong style={{ color: "var(--danger)" }}>companion switched off</strong></>}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="admin-subtext" style={{ margin: 0 }}>
                      Not adopted{petState.earned_xp > 0 ? ` — but ${petState.earned_xp} XP is banked and will apply the moment they adopt.` : "."}
                    </p>
                  )}
                </div>
              )}

              <div className="admin-field-row" style={{ alignItems: "flex-end", maxWidth: 420 }}>
                <label className="admin-field" style={{ flex: "1 1 110px", margin: 0 }}>
                  <span>XP amount</span>
                  <input
                    className="admin-input"
                    type="number"
                    min="1"
                    step="10"
                    value={petXpDraft}
                    disabled={petLevelBusy}
                    onChange={e => setPetXpDraft(Math.max(1, Number(e.target.value) || 0))}
                  />
                </label>
                {[["Add XP", 1], ["Remove XP", -1]].map(([label, sign]) => (
                  <button
                    key={label}
                    type="button"
                    className="admin-btn outline"
                    disabled={petLevelBusy || petXpDraft < 1}
                    onClick={async () => {
                      const delta = sign * petXpDraft;
                      const who = selectedUser.name || "this student";
                      if (!confirm(`${sign > 0 ? "Add" : "Remove"} ${petXpDraft} XP ${sign > 0 ? "to" : "from"} ${who}? Earned history is kept either way.`)) return;
                      setPetLevelBusy(true); setPetLevelMessage("");
                      const { data, error } = await supabase.rpc("admin_adjust_pet_xp", {
                        p_user_id: selectedUser.user_id,
                        p_delta: delta,
                      });
                      setPetLevelBusy(false);
                      if (error) { setPetLevelMessage(`Could not update companion: ${error.message}`); return; }
                      const result = Array.isArray(data) ? data[0] : data;
                      setPetLevelMessage(`Companion is now Level ${result?.level} (${result?.total_xp} XP).`);
                      await logAdminAction(admin_id, "adjust_pet_xp", {
                        target_user: selectedUser.user_id,
                        delta,
                        resulting_level: result?.level,
                        resulting_xp: result?.total_xp,
                      });
                    }}
                  >
                    {petLevelBusy ? "Working…" : label}
                  </button>
                ))}
              </div>

              <div className="admin-field-row" style={{ alignItems: "flex-end", maxWidth: 420, marginTop: 10 }}>
                <label className="admin-field" style={{ flex: "1 1 110px", margin: 0 }}>
                  <span>Target level</span>
                  <select
                    className="admin-input"
                    value={petLevelDraft}
                    disabled={petLevelBusy}
                    onChange={e => setPetLevelDraft(Number(e.target.value))}
                  >
                    {Array.from({ length: 12 }, (_, index) => index + 1).map(level => <option key={level} value={level}>Level {level}</option>)}
                  </select>
                </label>
                <button
                  type="button"
                  className="admin-btn outline"
                  disabled={petLevelBusy}
                  onClick={async () => {
                    if (!confirm(`Grant ${selectedUser.name || "this student"} at least Level ${petLevelDraft}? Earned progress will not be removed.`)) return;
                    setPetLevelBusy(true); setPetLevelMessage("");
                    const { data, error } = await supabase.rpc("admin_set_pet_level", {
                      p_user_id: selectedUser.user_id,
                      p_level: petLevelDraft,
                    });
                    setPetLevelBusy(false);
                    if (error) {
                      setPetLevelMessage(`Could not update companion: ${error.message}`);
                      return;
                    }
                    const result = Array.isArray(data) ? data[0] : data;
                    const actualLevel = result?.level ?? petLevelDraft;
                    setPetLevelMessage(`Companion is now at least Level ${actualLevel}.`);
                    await logAdminAction(admin_id, "grant_pet_level", {
                      target_user: selectedUser.user_id,
                      requested_level: petLevelDraft,
                      resulting_level: actualLevel,
                    });
                  }}
                >
                  <PawPrint size={14} /> {petLevelBusy ? "Granting…" : "Grant level"}
                </button>
                {/* The destructive sibling: unlike "Grant", this pins the student
                    to exactly the chosen level, so someone who earned beyond it
                    loses that lead. Worded and confirmed accordingly. */}
                <button
                  type="button"
                  className="admin-btn outline"
                  disabled={petLevelBusy}
                  onClick={async () => {
                    const who = selectedUser.name || "this student";
                    if (!confirm(`Set ${who} to exactly Level ${petLevelDraft}?\n\nIf they earned more than this, their progress will be reduced to match. Earned history is kept and this can be undone.`)) return;
                    setPetLevelBusy(true); setPetLevelMessage("");
                    const { data, error } = await supabase.rpc("admin_set_pet_level_exact", {
                      p_user_id: selectedUser.user_id,
                      p_level: petLevelDraft,
                    });
                    setPetLevelBusy(false);
                    if (error) { setPetLevelMessage(`Could not update companion: ${error.message}`); return; }
                    const result = Array.isArray(data) ? data[0] : data;
                    setPetLevelMessage(`Companion set to Level ${result?.level} (${result?.total_xp} XP).`);
                    await logAdminAction(admin_id, "set_pet_level_exact", {
                      target_user: selectedUser.user_id,
                      requested_level: petLevelDraft,
                      resulting_level: result?.level,
                      resulting_xp: result?.total_xp,
                    });
                  }}
                >
                  Set exactly
                </button>
              </div>

              {/* Moderation and recovery. `name` is student-controlled free text
                  that get_friend_pets shows to peers, and nothing filters it —
                  clearing is the only remedy for an abusive one. */}
              <div className="admin-field-row" style={{ alignItems: "flex-end", maxWidth: 560, marginTop: 14, flexWrap: "wrap" }}>
                <button
                  type="button"
                  className="admin-btn outline"
                  disabled={petLevelBusy || !petState?.granted_xp}
                  onClick={async () => {
                    if (!confirm("Clear this student's admin adjustment? Their companion returns to purely earned XP.")) return;
                    setPetLevelBusy(true); setPetLevelMessage("");
                    const { data, error } = await supabase.rpc("admin_reset_pet_adjustment", { p_user_id: selectedUser.user_id });
                    setPetLevelBusy(false); setPetStateNonce(n => n + 1);
                    if (error) { setPetLevelMessage(`Could not reset: ${error.message}`); return; }
                    const r = Array.isArray(data) ? data[0] : data;
                    setPetLevelMessage(`Adjustment cleared — back to Level ${r?.level} (${r?.total_xp} XP).`);
                    await logAdminAction(admin_id, "reset_pet_adjustment", { target_user: selectedUser.user_id, resulting_level: r?.level });
                  }}
                >
                  Reset adjustment
                </button>
                <button
                  type="button"
                  className="admin-btn outline"
                  disabled={petLevelBusy || !petState?.name}
                  onClick={async () => {
                    if (!confirm(`Clear the name "${petState?.name}"? Their companion falls back to its species name and they can rename it themselves.`)) return;
                    setPetLevelBusy(true); setPetLevelMessage("");
                    const { data, error } = await supabase.rpc("admin_clear_pet_name", { p_user_id: selectedUser.user_id });
                    setPetLevelBusy(false); setPetStateNonce(n => n + 1);
                    if (error) { setPetLevelMessage(`Could not clear name: ${error.message}`); return; }
                    setPetLevelMessage(`Cleared the name "${data}".`);
                    await logAdminAction(admin_id, "clear_pet_name", { target_user: selectedUser.user_id, cleared_name: data });
                  }}
                >
                  Clear name
                </button>
                <button
                  type="button"
                  className="admin-btn outline"
                  disabled={petLevelBusy || !petState}
                  onClick={async () => {
                    setPetLevelBusy(true); setPetLevelMessage("");
                    const { error } = await supabase.rpc("admin_reset_pet_care", { p_user_id: selectedUser.user_id });
                    setPetLevelBusy(false); setPetStateNonce(n => n + 1);
                    setPetLevelMessage(error ? `Could not reset care: ${error.message}` : "Today's care budget reset.");
                    if (!error) await logAdminAction(admin_id, "reset_pet_care", { target_user: selectedUser.user_id });
                  }}
                >
                  Reset care budget
                </button>
                <button
                  type="button"
                  className="admin-btn outline"
                  disabled={petLevelBusy || !petState}
                  onClick={async () => {
                    const on = petState?.companion_enabled === false;
                    if (!confirm(on
                      ? "Switch the companion back on for this student?"
                      : "Switch the companion OFF for this student? The greeting pet, the Companion page and their XP all stop showing. Earned XP is kept and this is reversible.")) return;
                    setPetLevelBusy(true); setPetLevelMessage("");
                    const { error } = await supabase.rpc("admin_set_pet_companion", { p_user_id: selectedUser.user_id, p_enabled: on });
                    setPetLevelBusy(false); setPetStateNonce(n => n + 1);
                    setPetLevelMessage(error ? `Could not update: ${error.message}` : `Companion switched ${on ? "on" : "off"} for this student.`);
                    if (!error) await logAdminAction(admin_id, "set_pet_companion", { target_user: selectedUser.user_id, enabled: on });
                  }}
                >
                  {petState?.companion_enabled === false ? "Switch companion on" : "Switch companion off"}
                </button>
              </div>

              <div className="admin-field-row" style={{ alignItems: "flex-end", maxWidth: 560, marginTop: 10, flexWrap: "wrap" }}>
                <label className="admin-field" style={{ flex: "1 1 140px", margin: 0 }}>
                  <span>Unlock companion</span>
                  <select className="admin-input" value={petUnlockDraft} disabled={petLevelBusy} onChange={e => setPetUnlockDraft(e.target.value)}>
                    {PETS.map(pet => <option key={pet.key} value={pet.key}>{pet.label}</option>)}
                  </select>
                </label>
                <button
                  type="button"
                  className="admin-btn outline"
                  disabled={petLevelBusy || !petState}
                  onClick={async () => {
                    setPetLevelBusy(true); setPetLevelMessage("");
                    const { error } = await supabase.rpc("admin_grant_pet_unlock", { p_user_id: selectedUser.user_id, p_pet_key: petUnlockDraft });
                    setPetLevelBusy(false); setPetStateNonce(n => n + 1);
                    setPetLevelMessage(error ? `Could not unlock: ${error.message}` : `Unlocked ${getPetByKey(petUnlockDraft).label}.`);
                    if (!error) await logAdminAction(admin_id, "grant_pet_unlock", { target_user: selectedUser.user_id, pet_key: petUnlockDraft });
                  }}
                >
                  Unlock
                </button>
                {/* Destructive: sends them back to the adoption prompt. Earned XP
                    survives (it lives on the account, not the animal), so this is
                    a fresh start rather than a wipe. */}
                <button
                  type="button"
                  className="admin-btn outline"
                  disabled={petLevelBusy || !petState?.pet_key}
                  onClick={async () => {
                    if (!confirm("Un-adopt this student's companion?\n\nThey go back to the adoption prompt. Earned XP is kept — it lives on the account, not the animal — so re-adopting restores their level.")) return;
                    setPetLevelBusy(true); setPetLevelMessage("");
                    const { data, error } = await supabase.rpc("admin_reset_pet", { p_user_id: selectedUser.user_id });
                    setPetLevelBusy(false); setPetStateNonce(n => n + 1);
                    if (error) { setPetLevelMessage(`Could not un-adopt: ${error.message}`); return; }
                    setPetLevelMessage(`Un-adopted (was ${getPetByKey(data).label}). Earned XP kept.`);
                    await logAdminAction(admin_id, "reset_pet", { target_user: selectedUser.user_id, previous_pet: data });
                  }}
                >
                  Un-adopt
                </button>
              </div>
              {petLevelMessage && <p className="admin-subtext" style={{ margin: "9px 0 0", color: petLevelMessage.startsWith("Could not") ? "var(--danger)" : "var(--live)" }}>{petLevelMessage}</p>}
            </section>

            <section className="admin-user-xray-section">
                 <h3>Recent admin activity</h3>
                 <div className="admin-user-xray-activity">
                    {auditLogs.filter(l => l.details?.target_user === selectedUser.user_id).length > 0 ? (
                       auditLogs.filter(l => l.details?.target_user === selectedUser.user_id).map(l => (
                          <div key={l.id}>
                             <span>{new Date(l.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span><strong>{l.action.replaceAll("_", " ")}</strong>
                          </div>
                       ))
                    ) : (
                       <p>No recent admin actions recorded.</p>
                    )}
                 </div>
            </section>

            <section className="admin-user-xray-actions">
              <div>
                <h3>Account actions</h3><p>Inspect or contact the user without changing their setup.</p>
              </div>
              <div>
                <button onClick={() => { setViewAsUser(selectedUser); setSelectedUser(null); }} className="admin-btn outline">
                  <VenetianMask size={16} /> View as
                </button>
                <button onClick={async () => {
                   const msg = prompt(`Send a direct push notification to ${selectedUser.name}:`);
                   if (!msg) return;
                   const res = await pushToUserIds([selectedUser.user_id], { title: "Message from Admin", body: msg.trim() });
                   if (res?.ok) { await logAdminAction(admin_id, "direct_push", { target_user: selectedUser.user_id }); alert("Push delivered."); }
                   else alert("Failed to send push.");
                }} className="admin-btn outline">
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
                  }} className="admin-btn outline admin-user-xray-clear-status">
                    <Shield size={16} /> Clear Status
                  </button>
                )}
              </div>
            </section>

            <section className="admin-user-xray-danger">
              <div><h3>Reset onboarding</h3><p>Clears the saved course setup. The user must configure TermFlow again.</p></div>
                <button onClick={async () => {
                  if (isReadOnlyAdmin) return alert(READ_ONLY_MESSAGE);
                  if (typedConfirm("RESET", `Reset ${selectedUser.name || "this user"}'s setup? They will have to onboard again.`)) {
                    await supabase.from("profiles").update({ courses: null }).eq("user_id", selectedUser.user_id);
                    await logAdminAction(admin_id, "reset_user_setup", { target_user: selectedUser.user_id });
                    setAllUsers(allUsers.map(u => u.user_id === selectedUser.user_id ? { ...u, courses: null } : u));
                    setSelectedUser(null);
                    alert("User setup cleared.");
                  }
                }} className="admin-btn outline">
                  <Trash2 size={16} /> Reset Setup
                </button>
            </section>
          </div>
        </AdminModal>
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
          <div className="admin-mobile-dialog" style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", background: "var(--card)", padding: 24, borderRadius: 16, width: "90%", maxWidth: 480, maxHeight: "88vh", overflowY: "auto", zIndex: 10001, border: "1px solid var(--border)", boxShadow: "0 10px 40px rgba(0,0,0,0.25)" }}>

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
          <div className="admin-mobile-dialog" style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", background: "var(--card)", padding: 24, borderRadius: 16, width: "90%", maxWidth: 400, maxHeight: "85vh", overflowY: "auto", zIndex: 10001, border: "1px solid var(--border)", boxShadow: "0 10px 40px rgba(0,0,0,0.2)" }}>
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
                  <div className="admin-field">
                    <label>Type</label>
                    <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                      {[["class", "Class"], ["exam", "Exam"], ["event", "🎉 Celebration Event"], ["placement", "💼 Placement"]].map(([val, label]) => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => setModalNewType(val)}
                          style={{
                            flex: 1,
                            padding: "8px 0",
                            borderRadius: 8,
                            border: `2px solid ${modalNewType === val ? "var(--blue)" : "var(--border)"}`,
                            background: modalNewType === val ? "color-mix(in srgb, var(--blue) 12%, transparent)" : "var(--bg)",
                            color: modalNewType === val ? "var(--blue)" : "var(--muted)",
                            fontWeight: modalNewType === val ? 700 : 500,
                            fontSize: 13,
                            cursor: "pointer",
                            transition: "all 0.15s",
                          }}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    <span style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 4, display: "block" }}>Exams don't count toward attendance or “sessions left”.</span>
                  </div>
                </div>
              ) : (
                <>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 6 }}>
                    <div style={{ fontWeight: 700, color: "var(--text)" }}>{liveEditorModal.code ? `${liveEditorModal.code} — ` : "— "}{liveEditorModal.name || "Class"}</div>
                    {(() => {
                      const ident = classIdent(liveEditorModal);
                      const overrideKey = makeOverrideKey(ident, modalSection);
                      const existing = flags.classOverrides?.[liveEditorModal.date]?.[overrideKey];
                      const isEv = existing?.type === "event" || (!existing?.type && liveEditorModal.type === "event");
                      const isPl = existing?.type === "placement" || (!existing?.type && liveEditorModal.type === "placement");
                      if (isPl) {
                        return (
                          <span style={{
                            fontSize: 11,
                            fontWeight: 800,
                            background: "linear-gradient(135deg, #2563EB, #1D4ED8)",
                            color: "#fff",
                            padding: "2px 8px",
                            borderRadius: 6,
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                            boxShadow: "0 1px 6px rgba(37, 99, 235, 0.3)"
                          }}>
                            <Briefcase size={12} /> Placement
                          </span>
                        );
                      }
                      if (!isEv) return null;
                      return (
                        <span style={{
                          fontSize: 11,
                          fontWeight: 800,
                          background: "linear-gradient(135deg, #10B981, #059669)",
                          color: "#fff",
                          padding: "2px 8px",
                          borderRadius: 6,
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                          boxShadow: "0 1px 6px rgba(16, 185, 129, 0.3)"
                        }}>
                          <PartyPopper size={12} /> Celebration
                        </span>
                      );
                    })()}
                  </div>
                  <div style={{ color: "var(--muted)", fontSize: 13 }}>{liveEditorModal.date} | {liveEditorModal.start} – {liveEditorModal.end} | Section {liveEditorModal.section}</div>
                  <div className="admin-field" style={{ marginTop: 12 }}>
                    <label>Class Name</label>
                    <input type="text" className="admin-input" value={modalName} onChange={e => setModalName(e.target.value)} placeholder="e.g. Teachers Day" />
                  </div>
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
              <button type="button" onClick={() => {
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
                  <button type="button" onClick={() => {
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

              {/* Mark as Event (Celebration) toggle */}
              {(() => {
                const ident = classIdent(liveEditorModal);
                const overrideKey = makeOverrideKey(ident, modalSection);
                const existing = flags.classOverrides?.[liveEditorModal.date]?.[overrideKey];
                const isEventOverride = existing?.type === "event" || (!existing?.type && liveEditorModal.type === "event");
                return (
                  <button type="button" onClick={() => {
                    const nextOverrides = { ...(flags.classOverrides || {}) };
                    nextOverrides[liveEditorModal.date] = { ...(nextOverrides[liveEditorModal.date] || {}) };
                    if (isEventOverride) {
                      // Remove only the event type flag, keep other overrides intact
                      const rest = { ...existing };
                      delete rest.type;
                      if (Object.keys(rest).length === 0) {
                        delete nextOverrides[liveEditorModal.date][overrideKey];
                        if (Object.keys(nextOverrides[liveEditorModal.date]).length === 0) delete nextOverrides[liveEditorModal.date];
                      } else {
                        nextOverrides[liveEditorModal.date][overrideKey] = rest;
                      }
                      logAdminAction(admin_id, "clear_event_flag", { date: liveEditorModal.date, class: overrideKey });
                    } else {
                      // "All Sections" must supersede any per-section override.
                      if (modalSection === "All") {
                        delete nextOverrides[liveEditorModal.date][`${ident}_A`];
                        delete nextOverrides[liveEditorModal.date][`${ident}_B`];
                      }
                      nextOverrides[liveEditorModal.date][overrideKey] = { ...existing, type: "event" };
                      logAdminAction(admin_id, "mark_as_event", { date: liveEditorModal.date, class: overrideKey });
                    }
                    setFlags({ ...flags, classOverrides: nextOverrides });
                    setLiveEditorModal(null);
                  }} className={`admin-btn ${isEventOverride ? "" : "outline"}`} style={{
                    color: isEventOverride ? "#fff" : "var(--live, #10B981)",
                    borderColor: "var(--live, #10B981)",
                    background: isEventOverride ? "linear-gradient(135deg, #10B981, #059669)" : "rgba(16, 185, 129, 0.07)",
                    boxShadow: isEventOverride ? "0 2px 10px rgba(16, 185, 129, 0.35)" : "none",
                    fontWeight: isEventOverride ? 700 : 600,
                  }}>
                    <PartyPopper size={16} /> {isEventOverride ? "Remove Celebration Flag" : "Mark as Event (Celebration)"}
                  </button>
                );
              })()}

              {/* Mark as Placement toggle */}
              {(() => {
                const ident = classIdent(liveEditorModal);
                const overrideKey = makeOverrideKey(ident, modalSection);
                const existing = flags.classOverrides?.[liveEditorModal.date]?.[overrideKey];
                const isPlacementOverride = existing?.type === "placement" || (!existing?.type && liveEditorModal.type === "placement");
                return (
                  <button type="button" onClick={() => {
                    const nextOverrides = { ...(flags.classOverrides || {}) };
                    nextOverrides[liveEditorModal.date] = { ...(nextOverrides[liveEditorModal.date] || {}) };
                    if (isPlacementOverride) {
                      // Remove only the placement type flag, keep other overrides intact
                      const rest = { ...existing };
                      delete rest.type;
                      if (Object.keys(rest).length === 0) {
                        delete nextOverrides[liveEditorModal.date][overrideKey];
                        if (Object.keys(nextOverrides[liveEditorModal.date]).length === 0) delete nextOverrides[liveEditorModal.date];
                      } else {
                        nextOverrides[liveEditorModal.date][overrideKey] = rest;
                      }
                      logAdminAction(admin_id, "clear_placement_flag", { date: liveEditorModal.date, class: overrideKey });
                    } else {
                      // "All Sections" must supersede any per-section override.
                      if (modalSection === "All") {
                        delete nextOverrides[liveEditorModal.date][`${ident}_A`];
                        delete nextOverrides[liveEditorModal.date][`${ident}_B`];
                      }
                      nextOverrides[liveEditorModal.date][overrideKey] = { ...existing, type: "placement" };
                      logAdminAction(admin_id, "mark_as_placement", { date: liveEditorModal.date, class: overrideKey });
                    }
                    setFlags({ ...flags, classOverrides: nextOverrides });
                    setLiveEditorModal(null);
                  }} className={`admin-btn ${isPlacementOverride ? "" : "outline"}`} style={{
                    color: isPlacementOverride ? "#fff" : "#2563EB",
                    borderColor: "#2563EB",
                    background: isPlacementOverride ? "linear-gradient(135deg, #2563EB, #1D4ED8)" : "rgba(37, 99, 235, 0.07)",
                    boxShadow: isPlacementOverride ? "0 2px 10px rgba(37, 99, 235, 0.35)" : "none",
                    fontWeight: isPlacementOverride ? 700 : 600,
                  }}>
                    <Briefcase size={16} /> {isPlacementOverride ? "Remove Placement Flag" : "Mark as Placement"}
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
                  <button type="button" onClick={() => {
                    // New classes use the typed code; existing rows use their
                    // identity (code, or name for code-less exam entries).
                    const codeToUse = modalIsNew ? modalCode : classIdent(liveEditorModal);
                    if (modalIsNew && !codeToUse) return alert("Course Code is required.");
                    else {
                      const originalSection = liveEditorModal.section === "Single" ? "All" : (liveEditorModal.section || "All");
                      const sectionChanged = modalSection !== originalSection;
                      const nameChanged = modalName !== (liveEditorModal.name || "");
                      if (!modalRoom && !modalStart && !modalEnd && !sectionChanged && !nameChanged) return alert("Enter at least one change (name, section, room, start, or end time).");
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
                      changes.type = modalNewType; // set at creation; still toggleable later
                    } else if (modalName !== (liveEditorModal.name || "")) {
                      // renaming an existing class (e.g. a custom entry titled "Custom Class")
                      changes.name = modalName;
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
                <button type="button" onClick={() => {
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

      {activeUsersListModalOpen && (() => {
        const todayPresenceIds = new Set((weeklyPresence[6]?.users || []).map(item => item.userId));
        const activeUsersToday = allUsers.filter(u => todayPresenceIds.has(u.user_id));
        const secACount = activeUsersToday.filter(u => Object.keys(u.courses || {}).some(k => k.endsWith("_A"))).length;
        const secBCount = activeUsersToday.filter(u => Object.keys(u.courses || {}).some(k => k.endsWith("_B"))).length;
        const pushActiveCount = activeUsersToday.filter(u => (pushSubscribersList || []).includes(u.user_id)).length;

        const filteredList = activeUsersToday
          .filter(u => {
            if (activeUsersSection !== "all") {
              const keys = Object.keys(u.courses || {});
              const hasSec = keys.some(c => c.endsWith(`_${activeUsersSection}`));
              if (!hasSec) return false;
            }
            if (activeUsersPushOnly) {
              if (!(pushSubscribersList || []).includes(u.user_id)) return false;
            }
            if (activeUsersSearch.trim()) {
              const q = activeUsersSearch.toLowerCase().trim();
              const matchName = (u.name || "").toLowerCase().includes(q);
              const matchEmail = (u.email || "").toLowerCase().includes(q);
              const matchId = (u.user_id || "").toLowerCase().includes(q);
              return matchName || matchEmail || matchId;
            }
            return true;
          })
          .sort((a, b) => {
            if (activeUsersSort === "name") return (a.name || "").localeCompare(b.name || "");
            const ta = new Date(a.last_seen_at).getTime();
            const tb = new Date(b.last_seen_at).getTime();
            return activeUsersSort === "oldest" ? ta - tb : tb - ta;
          });

        function copyActiveUsersRoster() {
          const text = filteredList.map((u, i) => `${i + 1}. ${u.name || "Unknown"} (${u.email || "No email"}) - Last seen: ${new Date(u.last_seen_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST`).join("\n");
          navigator.clipboard?.writeText(text);
          setActiveCopiedToast(`Copied ${filteredList.length} active students to clipboard!`);
          setTimeout(() => setActiveCopiedToast(""), 3000);
        }

        return (
          <AdminModal
            title={
              <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Activity size={20} color="var(--live)" />
                <span>Active Users Today</span>
                <span className="admin-modal-live-pill">
                  <span className="admin-hero-online-dot" style={{ position: "static", display: "inline-block", marginRight: 4 }} />
                  {filteredList.length} / {activeUsersToday.length} Active
                </span>
              </span>
            }
            subtitle="Unique students who opened TermFlow from 12:00 AM to 11:59 PM IST. Last-seen values refresh about every five minutes while the app is visible."
            onClose={() => { setActiveUsersListModalOpen(false); setActiveUsersSearch(""); }}
            width={700}
          >
            {/* Top Metric Strip */}
            <div className="admin-modal-stats">
              <div className="admin-modal-stat-pill">
                <span className="admin-modal-stat-pill-label">Total Active</span>
                <span className="admin-modal-stat-pill-val" style={{ color: "var(--live)" }}>{activeUsersToday.length}</span>
              </div>
              <div className="admin-modal-stat-pill">
                <span className="admin-modal-stat-pill-label">Section A</span>
                <span className="admin-modal-stat-pill-val" style={{ color: "#0D9488" }}>{secACount}</span>
              </div>
              <div className="admin-modal-stat-pill">
                <span className="admin-modal-stat-pill-label">Section B</span>
                <span className="admin-modal-stat-pill-val" style={{ color: "#9333EA" }}>{secBCount}</span>
              </div>
              <div className="admin-modal-stat-pill">
                <span className="admin-modal-stat-pill-label">Push Subscribers</span>
                <span className="admin-modal-stat-pill-val" style={{ color: "var(--blue)" }}>{pushActiveCount}</span>
              </div>
            </div>

            {/* Filter & Action Toolbar */}
            <div className="admin-modal-toolbar">
              <div className="admin-modal-search-wrap">
                <Search size={14} className="search-icon" />
                <input
                  type="text"
                  className="admin-modal-search-input"
                  placeholder="Search by student name, email, or user ID…"
                  value={activeUsersSearch}
                  onChange={e => setActiveUsersSearch(e.target.value)}
                />
                {activeUsersSearch && (
                  <button
                    onClick={() => setActiveUsersSearch("")}
                    style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "var(--muted)", cursor: "pointer", padding: 2, display: "flex" }}
                    title="Clear search"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>

              {/* Section Segmented Filter */}
              <div className="admin-modal-filter-pills">
                {[["all", "All"], ["A", "Sec A"], ["B", "Sec B"]].map(([val, label]) => (
                  <button
                    key={val}
                    className={`admin-modal-filter-btn ${activeUsersSection === val ? "active" : ""}`}
                    onClick={() => setActiveUsersSection(val)}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* Push Subscribers Filter Toggle */}
              <button
                className={`admin-modal-filter-btn ${activeUsersPushOnly ? "active" : ""}`}
                style={{ border: "1px solid var(--border)", borderRadius: 9, padding: "5px 9px", display: "inline-flex", alignItems: "center", gap: 4 }}
                onClick={() => setActiveUsersPushOnly(!activeUsersPushOnly)}
                title="Filter only users with web push enabled"
              >
                <BellRing size={11} color={activeUsersPushOnly ? "var(--blue)" : "var(--muted)"} /> Push Only
              </button>

              {/* Sort Dropdown */}
              <select
                value={activeUsersSort}
                onChange={e => setActiveUsersSort(e.target.value)}
                className="admin-input"
                style={{ width: "auto", fontSize: 12, padding: "6px 8px", borderRadius: 9, minWidth: 130 }}
              >
                <option value="recent">Sort: Most recent</option>
                <option value="oldest">Sort: Oldest first</option>
                <option value="name">Sort: Name (A-Z)</option>
              </select>

              {/* Copy Roster Button */}
              <button
                onClick={copyActiveUsersRoster}
                className="admin-btn outline"
                style={{ padding: "6px 10px", fontSize: 12, borderRadius: 9, gap: 5, marginLeft: "auto" }}
                title="Copy active students list to clipboard"
              >
                <Copy size={13} /> Copy List
              </button>
            </div>

            {/* Copy Toast Notification */}
            {activeCopiedToast && (
              <div style={{ background: "var(--live-dim)", color: "var(--live)", border: "1px solid rgba(31,169,113,0.3)", borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 700, marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
                <Check size={14} /> {activeCopiedToast}
              </div>
            )}

            {/* Active User Cards List */}
            <div className="admin-active-user-list admin-scroll-hide">
              {filteredList.length === 0 ? (
                <div style={{ textAlign: "center", padding: "40px 16px", color: "var(--muted)" }}>
                  <Users size={36} style={{ opacity: 0.3, marginBottom: 8, margin: "0 auto", display: "block" }} />
                  <p style={{ margin: 0, fontWeight: 700, fontSize: 14 }}>No active students match your filters</p>
                  {(activeUsersSearch || activeUsersSection !== "all" || activeUsersPushOnly) && (
                    <button
                      onClick={() => { setActiveUsersSearch(""); setActiveUsersSection("all"); setActiveUsersPushOnly(false); }}
                      className="admin-btn outline"
                      style={{ marginTop: 12, fontSize: 12, padding: "4px 10px" }}
                    >
                      Reset Filters
                    </button>
                  )}
                </div>
              ) : (
                filteredList.map((u, i) => {
                  const sec = (() => {
                    const keys = Object.keys(u.courses || {});
                    if (keys.some(c => c.endsWith("_A"))) return "A";
                    if (keys.some(c => c.endsWith("_B"))) return "B";
                    return null;
                  })();
                  const isPush = (pushSubscribersList || []).includes(u.user_id);
                  const role = adminRoster.find(r => r.user_id === u.user_id)?.role;
                  const courseCount = Object.keys(u.courses || {}).length;
                  const initials = (u.name || "?").split(" ").map(w => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase() || "U";
                  
                  // Relative time calculation
                  const diffMin = Math.floor((Date.now() - new Date(u.last_seen_at).getTime()) / 60000);
                  const relTime = diffMin < 1 ? "Just now" : diffMin < 60 ? `${diffMin}m ago` : `${Math.floor(diffMin / 60)}h ago`;

                  return (
                    <div
                      key={u.user_id || i}
                      className="admin-active-user-row"
                      onClick={() => {
                        setSelectedUser(u);
                        setActiveUsersListModalOpen(false);
                      }}
                      title="Click to view student profile, courses & attendance"
                    >
                      <div className="admin-active-user-left">
                        <div className="admin-active-user-avatar">
                          {initials}
                          <span className="admin-active-user-dot" />
                        </div>
                        <div className="admin-active-user-meta">
                          <div className="admin-active-user-name">{u.name || "Unknown Student"}</div>
                          <div className="admin-active-user-tags">
                            {sec && <span className={`admin-tag-sec ${sec}`}>Sec {sec}</span>}
                            {isPush && <span className="admin-tag-push"><BellRing size={9} /> Push</span>}
                            {role && <span className="admin-profile-role-badge" style={{ fontSize: 9 }}>{role}</span>}
                            {courseCount > 0 && <span className="admin-tag-courses">• {courseCount} subjects</span>}
                            {u.email && <span className="admin-tag-courses" style={{ opacity: 0.7 }}>• {u.email}</span>}
                          </div>
                        </div>
                      </div>

                      <div className="admin-active-user-right">
                        <div className="admin-active-user-time-pill" title={`Last seen at ${new Date(u.last_seen_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST`}>
                          <Clock3 size={12} color="var(--muted)" />
                          <span>{new Date(u.last_seen_at).toLocaleTimeString("en-IN", { hour: '2-digit', minute: '2-digit', timeZone: "Asia/Kolkata" })}</span>
                          <span style={{ opacity: 0.6, fontSize: 10.5 }}>({relTime})</span>
                        </div>
                        <ChevronRight size={15} className="admin-active-user-chevron" />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </AdminModal>
        );
      })()}

      {pushSubscribersModalOpen && (
        <AdminModal
          title={
            <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <BellRing size={18} color="var(--blue)" />
              <span>Push Notification Subscribers ({pushSubCount})</span>
            </span>
          }
          subtitle="Devices currently subscribed to web push broadcasts. Click any user to view details."
          onClose={() => setPushSubscribersModalOpen(false)}
          width={540}
        >
          {pushSubscribersList.length > 0 ? (
            <div className="admin-active-user-list admin-scroll-hide">
              {allUsers.filter(u => pushSubscribersList.includes(u.user_id)).map(u => {
                const initials = (u.name || "?").split(" ").map(w => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase() || "U";
                return (
                  <div
                    key={u.user_id}
                    className="admin-active-user-row"
                    onClick={() => { setSelectedUser(u); setPushSubscribersModalOpen(false); }}
                  >
                    <div className="admin-active-user-left">
                      <div className="admin-active-user-avatar" style={{ background: "linear-gradient(135deg, var(--blue) 0%, #06B6D4 100%)" }}>
                        {initials}
                      </div>
                      <div className="admin-active-user-meta">
                        <div className="admin-active-user-name">{u.name}</div>
                        <div className="admin-active-user-tags">
                          <span className="admin-tag-push"><BellRing size={9} /> Enrolled Device</span>
                          {u.email && <span className="admin-tag-courses">{u.email}</span>}
                        </div>
                      </div>
                    </div>
                    <ChevronRight size={15} className="admin-active-user-chevron" />
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ color: "var(--muted)", textAlign: "center", padding: 28, background: "var(--bg)", borderRadius: 14, border: "1px solid var(--border)" }}>
              <BellRing size={32} style={{ opacity: 0.3, marginBottom: 8, margin: "0 auto", display: "block" }} />
              <p style={{ margin: 0, fontWeight: 600 }}>The push subscriber list requires a database update.</p>
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
