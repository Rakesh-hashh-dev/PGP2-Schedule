import { useState, useEffect, useLayoutEffect, useCallback, useMemo, useRef, Suspense, lazy } from "react";
import { createPortal } from "react-dom";
import { Search, RefreshCw, Calendar, Clock, Sunrise, LogOut, Settings2, Bell, ClipboardList, GraduationCap, MoreHorizontal, Users, ChevronsLeft, ChevronsRight, Megaphone, Shield, ShieldAlert, User, CloudOff, MessageSquare, X, SlidersHorizontal, BookOpenCheck, Sparkles, Wand2, BellRing, CalendarDays, ExternalLink, Download, Share, WifiOff, Zap, PanelBottom, PanelTop, PanelsTopLeft, Check, ChevronDown, Sun, Moon, Monitor, CalendarOff, CalendarRange, UtensilsCrossed, Package, Camera, Loader2, Wallet } from "lucide-react";
import { useUser, useClerk } from "@clerk/clerk-react";
import Hero from "./components/Hero.jsx";
import SemSummary from "./components/SemSummary.jsx";
import Timeline from "./components/Timeline.jsx";
import WeekAgenda from "./components/WeekAgenda.jsx";
import WeekGlance from "./components/WeekGlance.jsx";
import SubjectFilter from "./components/SubjectFilter.jsx";
import Login from "./components/Login.jsx";
import Onboarding from "./components/Onboarding.jsx";
import WeatherWidget from "./components/WeatherWidget.jsx";
import TomorrowSummary from "./components/TomorrowSummary.jsx";
import MessCard from "./components/MessCard.jsx";
import GlanceView from "./components/GlanceView.jsx";
import "./styles/wrapped.css"; // Wrapped entry-banner styles must exist on Today before the lazy view loads
import { MessMenuStandalone } from "./components/MessMenuModal.jsx";
import { setMessMenuOverrides } from "./data/messMenu.js";
import { fetchMessMenu } from "./lib/messFeed.js";
import { getSnapshot, fetchSchedule, sha256hex } from "./lib/sheet.js";
import { classIdent, lookupOverride, parseOverrideKey } from "./lib/overrides.js";
import { toMin, ymd, clsDate, prettyDate, timeAgo, getSpecialDay } from "./lib/datetime.js";
import {
  swUpdateIsStale, clearSwSeen,
  LAST_USER_KEY, VIEW_KEY, PENDING_INVITE_KEY, USER_SCOPED_KEYS,
  readSetup, saveSetup,
  NOTIF_KEY, loadLastSeen, READ_PINGS_KEY, loadReadPingIds,
  READ_CHANGES_KEY, loadReadChangeKeys, CLEARED_GROUPS_KEY, loadClearedGroups,
} from "./lib/appStorage.js";
import TermFlowLoader from "./components/TermFlowLoader.jsx";
import IndiaFlagIcon from "./components/IndiaFlagIcon.jsx";

const AttendancePanel = lazy(() => import("./components/AttendancePanel.jsx"));
const LeavePlanner = lazy(() => import("./components/LeavePlanner.jsx"));
const FriendsPanel = lazy(() => import("./components/FriendsPanel.jsx"));
const CompareView = lazy(() => import("./components/CompareView.jsx"));
const RecentChanges = lazy(() => import("./components/RecentChanges.jsx"));
const ExamsPanel = lazy(() => import("./components/ExamsPanel.jsx"));
const FeedbackWidget = lazy(() => import("./components/FeedbackWidget.jsx"));
const FeedbackFlashToast = lazy(() => import("./components/FeedbackFlashToast.jsx"));
const SocialFlashToast = lazy(() => import("./components/SocialFlashToast.jsx"));
const NotificationsPage = lazy(() => import("./components/NotificationsPage.jsx"));
const FullSchedulePage = lazy(() => import("./components/FullSchedulePage.jsx"));
const AdminDashboard = lazy(() => import("./components/AdminDashboard.jsx"));
const CommandPalette = lazy(() => import("./components/CommandPalette.jsx"));
const AssignmentsPanel = lazy(() => import("./components/AssignmentsPanel.jsx"));
const WrappedView = lazy(() => import("./components/WrappedView.jsx"));
const BoardPage = lazy(() => import("./components/BoardPage.jsx"));
const SplitPage = lazy(() => import("./components/SplitPage.jsx"));
import DeadlineStrip from "./components/DeadlineStrip.jsx";
import CancellationAlert from "./components/CancellationAlert.jsx";
import { loadMyAway, isAwayNow, fmtAwayEnd } from "./lib/status.js";
import { loadAttendance, saveAttendance, sessionKey, syncAttendanceFromCloud, pushMark, courseSkipStats } from "./lib/attendance.js";
import { syncProfileFromCloud, pushProfile, pushReadState, stampProfileEmail } from "./lib/profile.js";
import { syncMigrationMap } from "./lib/migrationMap.js";
import { useMigration } from "./lib/useMigration.js";
import MigrationBanner from "./components/MigrationBanner.jsx";
import { decodeSchedule, saveFriend, loadFriends, loadGroups, syncFriendsAndGroupsFromCloud, pushFriendsToCloud, deleteAllFriendPings, deleteFriendPing, removeFriendByCloudId, sendFriendPing, hasPendingFriendRequest, getOrCreateShareCode } from "./lib/friends.js";
import { supabase } from "./lib/supabase.js";
import { fetchNotifications, subscribeToNotifications, markNotificationRead, markAllNotificationsRead } from "./lib/notifications.js";
import { assignSubjectColors, subjectClass } from "./lib/subjectColors.js";
import { haptic } from "./lib/haptics.js";
import MarkPrompt from "./components/MarkPrompt.jsx";
import { WhatsNewPill, WhatsNewModal } from "./components/WhatsNew.jsx";
import { resizeImage } from "./lib/board.js";
import { IS_LITE, LITE_VIEWS } from "./lib/edition.js";

const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent || "");

// Views that live behind the sidebar's collapsed Tools accordion / the
// mobile overflow menu's Tools section — candidates for the "Recent" row.
const TOOLS_VIEWS = ["fullSchedule", "split", "leave", "wrapped"];
const TOOLS_VIEW_META = {
  fullSchedule: { icon: CalendarRange, label: "Full timetable" },
  split:        { icon: Wallet,        label: "Split" },
  leave:        { icon: CalendarOff,   label: "Leave planner" },
  wrapped:      { icon: Sparkles,      label: "Term Wrapped" },
};

// Alert type → rc-dot colour, mirroring the Recent-changes kind palette
const ALERT_DOT = {
  class_cancelled: "rc-removed",
  class_reminder: "rc-alert",
  schedule_change: "rc-moved",
  admin_broadcast: "rc-course",
  daily_summary: "rc-update",
};

function UserAvatar({ user, size = 30 }) {
  const initials = `${user?.firstName?.[0] ?? ""}${user?.lastName?.[0] ?? ""}` || "?";
  if (user?.imageUrl) return <img src={user.imageUrl} alt="" className="user-avatar" style={{ width: size, height: size }} />;
  return <span className="user-avatar user-avatar-initials" style={{ width: size, height: size }}>{initials}</span>;
}

async function checkAppVersion(onUpdateAvailable) {
  try {
    const resp = await fetch(`/meta.json?_=${Date.now()}`, { cache: "no-store" });
    if (!resp.ok) return;
    const data = await resp.json();
    if (data.version !== __APP_VERSION__) onUpdateAvailable();
  } catch { }
}

// Phase 3: social events now live in the unified `notifications` store (types
// below) instead of friend_pings. These are routed to the bell's Friends section;
// all other notification types go to the Alerts section.
const SOCIAL_TYPES = new Set(["friend_request", "friend_accepted", "group_invite", "friend_removed"]);
// Map a notifications social row into the legacy "ping" shape the bell already
// renders (it parses from_name as JSON), so the display layer stays untouched.
function socialRowToPing(row) {
  const d = row.data || {};
  const meta = { name: d.from_name || "Someone" };
  if (row.type === "group_invite") meta.group = d.group;
  else { meta.type = row.type; if (d.from_code) meta.fromCode = d.from_code; }
  return { id: row.id, from_id: d.from_id, from_name: JSON.stringify(meta), created_at: row.created_at, read_at: row.read_at };
}
const ADMIN_EMAILS = [
  "mba25rakeshb@iimsambalpur.ac.in",
  "test@iimsambalpur.ac.in"
];

function AppCore({ isSignedIn, isLoaded, signOut, userId, user }) {
  const userEmail = user?.primaryEmailAddress?.emailAddress?.toLowerCase();
  const isAdmin = userEmail && ADMIN_EMAILS.includes(userEmail);
  const [adminMode, setAdminMode] = useState(false);
  useEffect(() => { if (isAdmin) setAdminMode(true); }, [isAdmin]);

  // ── User-switch guard ──────────────────────────────────────────
  // When a different account logs in on the same browser, wipe stale
  // per-user localStorage and reset all user-scoped state.
  const userSwitchHandled = useRef(false);
  useEffect(() => {
    if (!userId || userSwitchHandled.current) return;
    userSwitchHandled.current = true;
    const lastId = localStorage.getItem(LAST_USER_KEY);
    if (lastId && lastId !== userId) {
      USER_SCOPED_KEYS.forEach(k => { try { localStorage.removeItem(k); } catch { } });
      setFriends([]);
      setGroups([]);
      setEnrolled(null);
      setMine(null);
      setSetup(null);
      setPings([]);
      setSeenRecvGroupIds(new Set());
      setSeenRecvCount(0);
      setLastSeenTs(0);
      setReadPingIds(new Set());
      setReadChangeKeys(new Set());
      setAttendance({});
      setCloudChecked(false);
      setClearedGroupIds(new Set());
    }
    try { localStorage.setItem(LAST_USER_KEY, userId); } catch { }
  }, [userId]);
  // ──────────────────────────────────────────────────────────────

  // ── Migration bridge (dev instance only, background) ───────────
  // Record { email → dev_user_id } so no user is orphaned at cutover.
  // Fire-and-forget: never blocks or surfaces to the user. No-op on prod.
  useEffect(() => {
    if (isSignedIn && userId && userEmail) {
      syncMigrationMap(userId, userEmail);
      stampProfileEmail(userId, userEmail);
    }
  }, [isSignedIn, userId, userEmail]);
  // ──────────────────────────────────────────────────────────────

  // ── One-time dev→prod data restore (prod instance only) ────────
  const migrationState = useMigration({ isSignedIn, userId, email: userEmail });

  // Admin tools are full-app only — admins use the full edition to manage config.
  const showAdminUI = !IS_LITE && isAdmin && adminMode;
  const [sysConfig, setSysConfig] = useState(null);
  const [helpModalOpen, setHelpModalOpen] = useState(false);
  const [dismissedAnnouncements, setDismissedAnnouncements] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem("pgp2.dismissed-announcements") || "[]")); } catch { return new Set(); }
  });
  function dismissAnnouncement(id) {
    setDismissedAnnouncements(prev => {
      const next = new Set(prev);
      next.add(id);
      try { localStorage.setItem("pgp2.dismissed-announcements", JSON.stringify([...next])); } catch { }
      return next;
    });
  }
  const [whatsNewOpen, setWhatsNewOpen] = useState(false);
  const [seenWhatsNewIds, setSeenWhatsNewIds] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem("pgp2.seen-whatsnew") || "[]")); } catch { return new Set(); }
  });
  const [feedbackFlashTriggered, setFeedbackFlashTriggered] = useState(false);
  const [feedbackFlashConfig, setFeedbackFlashConfig] = useState(null);
  function closeWhatsNew(items) {
    setWhatsNewOpen(false);
    setSeenWhatsNewIds(prev => {
      const next = new Set(prev);
      (items || []).forEach(it => next.add(it.id));
      try { localStorage.setItem("pgp2.seen-whatsnew", JSON.stringify([...next])); } catch { }
      return next;
    });
  }

  // --- Admin Advanced Features ---
  const [impersonatedUser, setImpersonatedUser] = useState(null);
  const originalStateRef = useRef(null);

  const startImpersonation = async (targetUser) => {
    // Save real state
    originalStateRef.current = { enrolled, mine, setup, attendance };
    setImpersonatedUser(targetUser);

    // Apply mocked profile data
    if (targetUser.courses) {
      setEnrolled(targetUser.courses);
      setMine(new Set(Object.keys(targetUser.courses)));
      setSetup({ courses: targetUser.courses });
    }

    // Fetch and mock attendance
    const { data } = await supabase.from("attendance").select("record").eq("user_id", targetUser.user_id).maybeSingle();
    setAttendance(data?.record || {});
  };

  const stopImpersonation = () => {
    if (originalStateRef.current) {
      setEnrolled(originalStateRef.current.enrolled);
      setMine(originalStateRef.current.mine);
      setSetup(originalStateRef.current.setup);
      setAttendance(originalStateRef.current.attendance);
      originalStateRef.current = null;
    }
    setImpersonatedUser(null);
  };

  const avaInputRef = useRef(null);
  const [isUploadingAva, setIsUploadingAva] = useState(false);

  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    try {
      setIsUploadingAva(true);
      const compressedBlob = await resizeImage(file, 400, 400, 0.8);
      await user.setProfileImage({ file: compressedBlob });
      await user.reload(); // fetch updated user.imageUrl
      if (enrolled) {
        pushProfile(userId, enrolled, user.firstName || user.username || "Student", undefined, user.imageUrl);
      }
    } catch (err) {
      console.error("Avatar upload failed:", err);
      alert("Failed to upload photo. Please try again.");
    } finally {
      setIsUploadingAva(false);
      if (avaInputRef.current) avaInputRef.current.value = "";
    }
  };
  // -------------------------------

  const [scheduleData, setScheduleData] = useState(() => isSignedIn ? getSnapshot() : null);
  // Bumped when the live mess-menu feed applies, to re-render menu consumers.
  const [, setMessMenuRev] = useState(0);
  const [syncLogs, setSyncLogs] = useState([]);
  const [realNow, setRealNow] = useState(new Date());
  const [timeOverride, setTimeOverride] = useState(null);
  // Memoized so `now` keeps a stable identity between renders when neither the
  // override nor the ticking clock changed — otherwise every render produced a
  // fresh Date and churned all the useMemo/useEffect hooks that depend on it.
  const now = useMemo(() => (timeOverride ? new Date(timeOverride) : realNow), [timeOverride, realNow]);
  const [view, setView] = useState(() => {
    try {
      const v = localStorage.getItem(VIEW_KEY) || "today";
      if (v === "courses") return "exams"; // retired view → its new home
      if (v === "insights") return "today"; // retired view
      if (v === "glance") return "today"; // peek surface, never sticky
      // Lite excludes several views — fall back to Today rather than a dead end.
      if (IS_LITE && !LITE_VIEWS.includes(v)) return "today";
      return v;
    } catch { return "today"; }
  });
  // Glance is a shortcut peek, not a destination — don't make it the view the
  // app re-opens on next launch.
  useEffect(() => { if (view !== "glance") { try { localStorage.setItem(VIEW_KEY, view); } catch { } } }, [view]);
  useEffect(() => {
    if (!showAdminUI) {
      if (view === "admin") setView("today");
      setTimeOverride(null);
    }
  }, [view, showAdminUI]);
  // Recently visited Tools-group views — the sidebar's Tools accordion is
  // collapsed by default (see sbToolsOpen below), so a "Full timetable" or
  // "Split" visit is otherwise a click-to-expand away every single time.
  // Tracks the last 2 distinct Tools views, most recent first.
  const [recentToolViews, setRecentToolViews] = useState(() => {
    try { return JSON.parse(localStorage.getItem("pgp2.recent-tools") || "[]"); } catch { return []; }
  });
  useEffect(() => {
    if (!TOOLS_VIEWS.includes(view)) return;
    setRecentToolViews(prev => {
      const next = [view, ...prev.filter(v => v !== view)].slice(0, 2);
      try { localStorage.setItem("pgp2.recent-tools", JSON.stringify(next)); } catch { }
      return next;
    });
  }, [view]);
  const [weekOffset, setWeekOffset] = useState(0);
  const [mine, setMine] = useState(() => { const s = readSetup(); return s?.courses ? new Set(Object.keys(s.courses)) : null; });
  const [enrolled, setEnrolled] = useState(() => { const s = readSetup(); return s?.courses ?? null; });
  const [setup, setSetup] = useState(() => readSetup());
  const [allocationApplied, setAllocationApplied] = useState(false);
  const [prefillPicked, setPrefillPicked] = useState(null);
  const [showSetupEdit, setShowSetupEdit] = useState(false);
  const [syncedAt, setSyncedAt] = useState(new Date());
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifFilter, setNotifFilter] = useState("all"); // all | social | classes
  const notifOpenedAt = useRef(0);
  const [, setLastSeenTs] = useState(() => loadLastSeen());
  const [readPingIds, setReadPingIds] = useState(() => loadReadPingIds());
  const [readChangeKeys, setReadChangeKeys] = useState(() => loadReadChangeKeys());
  const [swUpdateFn, setSwUpdateFn] = useState(null);
  const [socialFlashToast, setSocialFlashToast] = useState(null);
  const [installPromptEvent, setInstallPromptEvent] = useState(null);
  const [showIOSInstallHint, setShowIOSInstallHint] = useState(false);
  const [installBannerClosing, setInstallBannerClosing] = useState(false);
  const [specialDayBannerDismissed, setSpecialDayBannerDismissed] = useState(() => {
    try { return localStorage.getItem("pgp2.specialday-dismissed") === ymd(new Date()); } catch { return false; }
  });
  const [specialDayBannerClosing, setSpecialDayBannerClosing] = useState(false);
  const dismissSpecialDayBanner = () => {
    setSpecialDayBannerClosing(true);
    try { localStorage.setItem("pgp2.specialday-dismissed", ymd(new Date())); } catch { }
    setTimeout(() => { setSpecialDayBannerDismissed(true); setSpecialDayBannerClosing(false); }, 300);
  };

  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);
  const [attendance, setAttendance] = useState(() => loadAttendance());
  const [syncing, setSyncing] = useState(false);
  const [overflowOpen, setOverflowOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [sbProfileOpen, setSbProfileOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [filterModalOpen, setFilterModalOpen] = useState(false);
  const [weather, setWeather] = useState(null);
  const [cloudChecked, setCloudChecked] = useState(false);
  const [clearedGroupIds, setClearedGroupIds] = useState(() => loadClearedGroups());
  const [friends, setFriends] = useState(() => loadFriends());
  const [groups, setGroups] = useState(() => loadGroups());
  const [compareTarget, setCompareTarget] = useState(null); // { mode, friendData?, groupData? }
  // A free slot picked in CompareView, waiting to prefill the meetup modal on
  // the Social page: { title?, date, start, memberCloudIds, groupId?, groupName? }
  // (Lives up here with the other hooks — declaring it below the login/
  // maintenance early returns made the hook order conditional.)
  const [planDraft, setPlanDraft] = useState(null);
  // Leave window booked via LeavePlanner's "Book leave" action — { from, to }
  // or null. Same source of truth friends read (profiles._away); kept here
  // too so the user sees their own on-leave state, not just friends.
  const [myAway, setMyAway] = useState(() => loadMyAway());
  const [friendToast, setFriendToast] = useState(null);
  const [pendingInvite, setPendingInvite] = useState(null);
  const [jumpToDate, setJumpToDate] = useState(null);
  const [jumpToSession, setJumpToSession] = useState(null); // { date, code, start } — highlights the specific class row

  // Received groups badge: track how many received groups were seen when Friends tab was last opened
  const [pings, setPings] = useState([]);
  // Unified notifications feed (class reminders, cancellations, summaries, admin
  // broadcasts) from the `notifications` table — the redesigned event store.
  const [alerts, setAlerts] = useState([]);
  // Bumped when "Notification settings" is chosen from the menu → auto-opens the
  // prefs dropdown on the Announcements page.
  const [notifPrefsSignal, setNotifPrefsSignal] = useState(0);
  const [seenRecvGroupIds, setSeenRecvGroupIds] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem("pgp2.seen-recv-groups") || "[]")); }
    catch { return new Set(); }
  });
  const [, setSeenRecvCount] = useState(() => {
    try { return parseInt(localStorage.getItem("pgp2.recv-groups-count") || "0", 10); } catch { return 0; }
  });
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try { return localStorage.getItem("pgp2.sidebar") === "collapsed"; } catch { return false; }
  });
  // Tablet tier (768–1023px landscape): sidebar is forced to the collapsed icon
  // rail — there isn't room for the expanded panel next to content, so the
  // user's stored expand/collapse preference only applies from 1024px up.
  // Portrait tablets (e.g. iPad portrait) get the mobile view instead, matching
  // the orientation-aware breakpoints in styles.css.
  const [isTablet, setIsTablet] = useState(() =>
    typeof window !== "undefined" && window.matchMedia("(min-width: 768px) and (max-width: 1023px) and (orientation: landscape)").matches
  );
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px) and (max-width: 1023px) and (orientation: landscape)");
    const onChange = (e) => setIsTablet(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  const sbCollapsed = sidebarCollapsed || isTablet;
  function toggleSidebar() {
    setSidebarCollapsed(prev => {
      const next = !prev;
      try { localStorage.setItem("pgp2.sidebar", next ? "collapsed" : "expanded"); } catch { }
      return next;
    });
    setSbTip(null);
  }

  // Sidebar visual style — "classic" (attached dark) or "aurora" (floating glass, animated)
  const [sbStyle, setSbStyle] = useState(() => {
    try { return localStorage.getItem("pgp2.sidebar-style") === "aurora" ? "aurora" : "classic"; } catch { return "classic"; }
  });
  function setSidebarStyle(s) {
    setSbStyle(s);
    try { localStorage.setItem("pgp2.sidebar-style", s); } catch { }
  }

  // Appearance — "light" | "dark" | "system". The pre-paint script in
  // index.html applies the saved value before React mounts; this keeps
  // <html data-theme> and the theme-color meta in sync from then on.
  const [theme, setTheme] = useState(() => {
    try {
      const v = localStorage.getItem("pgp2.theme");
      return v === "light" || v === "dark" || v === "system" ? v : "system";
    } catch { return "system"; }
  });
  function pickTheme(t) {
    setTheme(t);
    try { localStorage.setItem("pgp2.theme", t); } catch { }
  }
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const dark = theme === "dark" || (theme === "system" && mq.matches);
      if (dark) document.documentElement.dataset.theme = "dark";
      else delete document.documentElement.dataset.theme;
      document.querySelector('meta[name="theme-color"]')?.setAttribute("content", dark ? "#101216" : "#15182B");
    };
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [theme]);

  const [sbTip, setSbTip] = useState(null);
  function showSbTip(e, label, always = false) {
    if (!sbCollapsed && !always) return;
    const r = e.currentTarget.getBoundingClientRect();
    setSbTip({ label, top: r.top + r.height / 2, left: r.right + 10 });
  }
  function hideSbTip() { setSbTip(null); }

  const tabsRef = useRef(null);
  // Mobile navigation preference: "bottom" (dock only), "top" (tab strip only), or "both"
  const [mobileNavMode, setMobileNavMode] = useState(() => {
    try {
      const v = localStorage.getItem("pgp2.mobile-nav");
      if (v === "bottom" || v === "top" || v === "both") return v;
      if (localStorage.getItem("pgp2.bottom-nav") === "hidden") return "top";
      return "top";
    } catch { return "top"; }
  });
  function pickNavMode(mode) {
    setMobileNavMode(mode);
    try { localStorage.setItem("pgp2.mobile-nav", mode); } catch { }
  }
  const showBottomNav = mobileNavMode !== "top";
  const showTopTabs = mobileNavMode !== "bottom";

  // ── Liquid-glass dock: sliding lens indicator + scroll recede ──
  const bnavRef = useRef(null);
  const [bnavLens, setBnavLens] = useState(null); // { x, w } px, or null until measured
  const [bnavCompact, setBnavCompact] = useState(false);
  useEffect(() => {
    if (!showBottomNav) return;
    let lastY = window.scrollY;
    let acc = 0;        // accumulated same-direction scroll (hysteresis)
    let compact = false;
    let raf = 0;
    let idleTimer = 0;
    const apply = (v) => { if (compact !== v) { compact = v; setBnavCompact(v); } };
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const y = window.scrollY;
        const dy = y - lastY;
        lastY = y;
        // Ignore micro-jitter from elastic scroll / address-bar resize
        if (Math.abs(dy) < 2) return;
        // Accumulate in one direction; a direction change resets the tally,
        // so only sustained movement flips the state — no mid-scroll bouncing
        acc = (dy > 0) === (acc > 0) ? acc + dy : dy;
        if (acc > 28 && y > 120) apply(true);
        else if (acc < -16 || y <= 120) apply(false);
        // Spring back after ~1s of no scrolling
        clearTimeout(idleTimer);
        idleTimer = setTimeout(() => { acc = 0; apply(false); }, 1000);
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
      clearTimeout(idleTimer);
    };
  }, [showBottomNav]);
  // Re-position the lens under the active button (used after view changes,
  // resizes, and to snap back from a cancelled press)
  const bnavMeasure = useCallback(() => {
    const nav = bnavRef.current;
    if (!nav) return;
    const btn = nav.querySelector(".bnav-btn.on");
    if (btn) setBnavLens({ x: btn.offsetLeft, w: btn.offsetWidth });
    else setBnavLens(null);
  }, []);
  useLayoutEffect(() => {
    if (!showBottomNav) return;
    bnavMeasure();
    window.addEventListener("resize", bnavMeasure);
    return () => window.removeEventListener("resize", bnavMeasure);
  }, [showBottomNav, view, sysConfig, bnavMeasure]);
  // Instagram-dock feel: start the lens glide on touch-down, before the tap's
  // click renders the (possibly heavy) new view — the transform transition
  // runs on the compositor, so it stays smooth even while React is busy
  const onBnavPointerDown = (e) => {
    const btn = e.target.closest?.(".bnav-btn");
    if (btn) {
      setBnavLens({ x: btn.offsetLeft, w: btn.offsetWidth });
      haptic(10);
    }
  };
  // If the press never becomes a click (finger slid off), snap the lens back.
  // click dispatches synchronously after pointerup, so by the time this
  // timeout runs the view has either changed (measure is a no-op visually)
  // or it hasn't (lens returns to the active button).
  const onBnavPointerUp = () => { setTimeout(bnavMeasure, 0); };

  const [navMenuOpen, setNavMenuOpen] = useState(false);
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);
  // Overflow-menu collapsible sections (mobile ⋯ menu)
  const [toolsSecOpen, setToolsSecOpen] = useState(false);
  // Desktop sidebar "Tools" group — collapsed by default so the long tail of
  // occasional-use pages doesn't flatten the whole nav's visual hierarchy.
  const [sbToolsOpen, setSbToolsOpen] = useState(true);
  // "New"/"Beta" nav badges auto-expire once the user has opened that view —
  // they're a "look here" nudge, not a permanent status label.
  const [seenBadges, setSeenBadges] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem("pgp2.seen-badges") || "[]")); }
    catch { return new Set(); }
  });
  const markBadgeSeen = useCallback((key) => {
    setSeenBadges(prev => {
      if (prev.has(key)) return prev;
      const next = new Set(prev); next.add(key);
      try { localStorage.setItem("pgp2.seen-badges", JSON.stringify([...next])); } catch { }
      return next;
    });
  }, []);
  const showBadge = (key) => !seenBadges.has(key);
  // Sidebar Tools group stays open when the active page lives inside it, so the
  // user never loses their place; collapsed sidebar always shows the icons.
  const viewIsTool = TOOLS_VIEWS.includes(view);
  const showSbTools = IS_LITE || sbCollapsed || sbToolsOpen || viewIsTool;
  const [prefsSecOpen, setPrefsSecOpen] = useState(false);
  const [messMenuOpen, setMessMenuOpen] = useState(false);
  const [aboutSecOpen, setAboutSecOpen] = useState(false);
  // Split deep-link: a group id from a notification URL (?view=split&g=…)
  const [splitDeepLink, setSplitDeepLink] = useState(null);
  // Split invite: a group id to join from a shared link (?view=split&join=…)
  const [splitJoinLink, setSplitJoinLink] = useState(null);
  const [adminSecOpen, setAdminSecOpen] = useState(false);
  const [showFriendsAgenda, setShowFriendsAgenda] = useState(false);
  const [showRightScroll, setShowRightScroll] = useState(true);
  const [showLeftScroll, setShowLeftScroll] = useState(false);
  const handleTabsScroll = () => {
    if (!tabsRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = tabsRef.current;
    setShowRightScroll(scrollLeft + clientWidth < scrollWidth - 10);
    // Threshold sits above the strip's left padding (16px): scroll-snap can
    // settle the first tab at scrollLeft ≈ padding rather than 0, which
    // would otherwise leave the left arrow stuck visible at the extreme
    setShowLeftScroll(scrollLeft > 24);
  };
  // Center the active tab whenever the view changes (initial load jumps,
  // later changes glide) — view can change from anywhere (palette, bnav, links)
  const didScrollInitialTab = useRef(false);
  const tabsReady = isLoaded && isSignedIn && !!scheduleData && !!setup && !showSetupEdit;
  useEffect(() => {
    if (!tabsReady) return;
    const id = setTimeout(() => {
      const nav = tabsRef.current;
      const activeTab = nav?.querySelector(".tab.on");
      if (nav && activeTab) {
        const target = activeTab.offsetLeft - nav.offsetWidth / 2 + activeTab.offsetWidth / 2;
        if (didScrollInitialTab.current) nav.scrollTo({ left: target, behavior: "smooth" });
        else nav.scrollLeft = target;
        didScrollInitialTab.current = true;
        handleTabsScroll();
      }
    }, 100);
    return () => clearTimeout(id);

  }, [tabsReady, view]);

  const [cmdOpen, setCmdOpen] = useState(false);
  const premiumMode = true;

  useEffect(() => {
    document.body.classList.add("premium-mode");
  }, []);

  useEffect(() => {
    const handleOpenCmd = () => setCmdOpen(true);
    document.addEventListener("open-command-palette", handleOpenCmd);
    return () => document.removeEventListener("open-command-palette", handleOpenCmd);
  }, []);

  useEffect(() => {
    handleTabsScroll();
    window.addEventListener("resize", handleTabsScroll);
    return () => window.removeEventListener("resize", handleTabsScroll);
  }, []);

  // Invite links (?f=CODE): capture the code from the URL and stash it so it
  // survives the Clerk OAuth redirect (which lands back on the bare origin) and
  // is consumed once we're signed in. This runs while signed out too — the
  // <Login/> gate is a return further down in this same component.
  //
  // We re-check on focus / visibility / popstate as well as on mount, so a link
  // tapped while the app is already open (PWA or an existing tab, where the
  // mount effect never re-runs) still gets picked up.
  useEffect(() => {
    const DEEP_LINK_VIEWS = new Set(
      IS_LITE
        ? LITE_VIEWS
        : [
            "today", "tomorrow", "week", "attendance", "exams", "assignments",
            "notifications", "friends", "leave", "glance", "board", "split",
          ]
    );
    const captureFromUrl = () => {
      const params = new URLSearchParams(window.location.search);
      const code = params.get("f");
      const wanted = params.get("view");
      if (!code && !(wanted && DEEP_LINK_VIEWS.has(wanted))) return;

      if (code) {
        try { localStorage.setItem(PENDING_INVITE_KEY, code); } catch { }
        setPendingInvite(code);
      }
      if (wanted && DEEP_LINK_VIEWS.has(wanted)) setView(wanted);
      if (wanted === "split") {
        const g = params.get("g");
        if (g) setSplitDeepLink(g);
        const join = params.get("join");
        if (join) setSplitJoinLink(join);
      }

      // Strip the consumed params, preserving anything else on the URL.
      const rest = new URLSearchParams(window.location.search);
      rest.delete("f");
      rest.delete("view");
      rest.delete("g");
      rest.delete("join");
      const qs = rest.toString();
      window.history.replaceState({}, "", window.location.pathname + (qs ? `?${qs}` : ""));
    };

    // Seed from a code stashed on a previous load (survives the OAuth redirect).
    try {
      const stashed = localStorage.getItem(PENDING_INVITE_KEY);
      if (stashed) setPendingInvite(stashed);
    } catch { }

    captureFromUrl();
    const onVisible = () => { if (!document.hidden) captureFromUrl(); };
    window.addEventListener("popstate", captureFromUrl);
    window.addEventListener("focus", captureFromUrl);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("popstate", captureFromUrl);
      window.removeEventListener("focus", captureFromUrl);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  // Consume a captured invite once signed in, through the same friend-request
  // flow as manual code entry (request + accept), instead of the old silent
  // one-way local add that the cloud sync immediately clobbered.
  useEffect(() => {
    if (!userId || !pendingInvite) return;
    const code = pendingInvite;
    setPendingInvite(null);
    try { localStorage.removeItem(PENDING_INVITE_KEY); } catch { }
    const inviteToast = (msg) => {
      setFriendToast(msg);
      setTimeout(() => setFriendToast(null), 4000);
    };
    (async () => {
      const decoded = await decodeSchedule(code);
      if (!decoded) { inviteToast("Invite link is invalid or expired."); return; }
      if (decoded.id === userId) { inviteToast("That's your own invite link!"); return; }
      if (decoded.id && loadFriends().some(f => f.cloudId === decoded.id)) {
        inviteToast(`You're already friends with ${decoded.name}.`);
        return;
      }
      if (decoded.id) {
        if (await hasPendingFriendRequest(userId, decoded.id)) {
          inviteToast(`Request already sent to ${decoded.name}.`);
          return;
        }
        const myCode = await getOrCreateShareCode(userId, user?.firstName || user?.username || "Student");
        await sendFriendPing(decoded.id, userId, user?.firstName || user?.username || "Student", { type: "friend_request", fromCode: myCode });
        inviteToast(`Friend request sent to ${decoded.name}!`);
      } else {
        // Offline/legacy code: no request flow possible, add directly
        const updated = saveFriend(decoded.name, decoded.courses, decoded.id);
        setFriends(updated);
        pushFriendsToCloud(userId, updated);
        inviteToast(`Added ${decoded.name} as a friend!`);
      }
      setView("friends");
    })();
    // Runs once per pending invite. The user's name is read as a point-in-time
    // value for the outgoing request — re-running on a name change would resend
    // the friend request, so those fields are intentionally not dependencies.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, pendingInvite]);

  useEffect(() => {
    if (!userId) return;
    let alive = true;
    (async () => {
      const [p, a, fg, sysConfigRes] = await Promise.all([
        syncProfileFromCloud(userId),
        syncAttendanceFromCloud(userId),
        syncFriendsAndGroupsFromCloud(userId),
        supabase.from("system_config").select("*").eq("id", "global").maybeSingle()
      ]);
      if (alive) {
        if (sysConfigRes?.data) {
          // Mess menu now comes from its own live sheet feed (see lib/messFeed.js),
          // not system_config — so we no longer apply messMenuOverrides here.
          setSysConfig(sysConfigRes.data);
        }
        if (p?.courses) {
          setEnrolled(p.courses);
          setMine(new Set(Object.keys(p.courses)));
          setSetup(p);

          if (user?.imageUrl && p.imageUrl !== user.imageUrl) {
            pushProfile(userId, p.courses, user.firstName || user.username || "Student", undefined, user.imageUrl);
          }

          // Auto-sync notification read state from cloud
          if (p.lastSeenNotif) {
            const localSeen = loadLastSeen();
            if (p.lastSeenNotif > localSeen) {
              setLastSeenTs(p.lastSeenNotif);
              try { localStorage.setItem(NOTIF_KEY, String(p.lastSeenNotif)); } catch { }
            }
          }
          if (p.readPingIds?.length) {
            setReadPingIds(prev => {
              const merged = new Set([...prev, ...p.readPingIds]);
              try { localStorage.setItem(READ_PINGS_KEY, JSON.stringify([...merged])); } catch { }
              return merged;
            });
          }
          if (p.seenGroupIds?.length) {
            setSeenRecvGroupIds(prev => {
              const merged = new Set([...prev, ...p.seenGroupIds]);
              try { localStorage.setItem("pgp2.seen-recv-groups", JSON.stringify([...merged])); } catch { }
              return merged;
            });
          }
          if (p.readChangeKeys?.length) {
            setReadChangeKeys(prev => {
              const merged = new Set([...prev, ...p.readChangeKeys]);
              try { localStorage.setItem(READ_CHANGES_KEY, JSON.stringify([...merged])); } catch { }
              return merged;
            });
          }
        }
        setAttendance(a);
        if (fg) {
          setFriends(fg.friends);
          setGroups(fg.groups);
        }
        setCloudChecked(true);
      }
    })();
    return () => { alive = false; };
    // Initial cloud sync, keyed on sign-in. The user.* fields are only read to
    // opportunistically push an updated avatar; re-running the full sync when
    // they change would be wasteful, so they're intentionally omitted.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const checkFeedbackFlashes = useCallback(() => {
    if (!sysConfig?.flags?.feedbackFlashes) return;
    const flashes = sysConfig.flags.feedbackFlashes;
    
    const userEnrolled = Object.keys(enrolled || {});
    const legendData = getSnapshot()?.LEGEND || {};
    const currentMs = Date.now();
    const ONE_HOUR = 60 * 60 * 1000;

    for (const config of flashes) {
      if (!config.enabled || !config.deadline) continue;

      // Subject check
      const targets = config.subjects || [];
      const matchedSubjectCode = targets.length ? targets.find(c => userEnrolled.includes(c)) : null;
      const isTargeted = !targets.length || !!matchedSubjectCode;
      if (!isTargeted) continue;

      const subjectName = matchedSubjectCode && legendData[matchedSubjectCode] 
        ? legendData[matchedSubjectCode].name 
        : null;

      const deadlineMs = new Date(config.deadline).getTime();
      if (currentMs > deadlineMs) continue; // deadline passed
      
      // Compute triggers
      const triggers = [];
      if (config.announcedAt) {
        triggers.push({ id: 'announced', time: new Date(config.announcedAt).getTime() });
      }
      triggers.push({ id: '2h', time: deadlineMs - 2 * ONE_HOUR });
      triggers.push({ id: '20m', time: deadlineMs - 20 * 60 * 1000 });
      
      for (const t of triggers) {
        if (currentMs >= t.time && currentMs <= t.time + ONE_HOUR) {
          const sessionKey = `pgp2.ff.dismissed.${config.id}.${config.deadline}.${t.id}`;
          if (!sessionStorage.getItem(sessionKey)) {
            // Flash found! Return the first active one.
            setFeedbackFlashConfig({ ...config, currentTriggerId: t.id, sessionKey, subjectName });
            setFeedbackFlashTriggered(true);
            return;
          }
        }
      }
    }
  }, [sysConfig, enrolled]);

  useEffect(() => {
    checkFeedbackFlashes();
    const interval = setInterval(checkFeedbackFlashes, 60000); // Check every minute
    return () => clearInterval(interval);
  }, [checkFeedbackFlashes]);

  const handleFeedbackFlashClose = () => {
    if (feedbackFlashConfig?.sessionKey) {
      sessionStorage.setItem(feedbackFlashConfig.sessionKey, 'true');
    }
    setFeedbackFlashTriggered(false);
    setFeedbackFlashConfig(null);
    // Give a short delay for the close animation, then check for the next one immediately
    setTimeout(() => {
      checkFeedbackFlashes();
    }, 500);
  };

  useEffect(() => {
    fetch("https://api.open-meteo.com/v1/forecast?latitude=21.4669&longitude=83.9812&current=temperature_2m,weather_code&daily=temperature_2m_max,temperature_2m_min,weather_code&temperature_unit=celsius&timezone=Asia%2FKolkata&forecast_days=2")
      .then(r => r.json())
      .then(d => setWeather({
        temp: Math.round(d.current.temperature_2m),
        code: d.current.weather_code,
        tomorrow: d.daily ? {
          max: Math.round(d.daily.temperature_2m_max[1]),
          min: Math.round(d.daily.temperature_2m_min[1]),
          code: d.daily.weather_code[1],
        } : null,
      }))
      .catch(() => { });
  }, []);

  useEffect(() => {
    if (!isSignedIn) return;
    let alive = true;

    // UI unblocks instantly: use local snapshot while live data fetches in background
    setScheduleData(getSnapshot());

    // Background-fetch live data
    const load = () => {
      // Mess menu reads the admin's live sheet directly (lib/messFeed.js);
      // on success it merges over the bundled BASE_MENU, else BASE_MENU stays.
      fetchMessMenu().then((menu) => {
        if (!alive || !menu) return;
        setMessMenuOverrides(menu);
        setMessMenuRev(r => r + 1);
      });
      return fetchSchedule().then((data) => {
        if (!alive) return;
        setScheduleData(data);
        setSyncedAt(new Date());
        if (data._meta) setSyncLogs(prev => [data._meta, ...prev].slice(0, 1000));
      }).catch(e => {
        if (!alive) return;
        setSyncLogs(prev => [{ ts: Date.now(), status: "error", message: `Background sync failed: ${e.message || "Network Error"}` }, ...prev].slice(0, 1000));
      });
    };
    load();
    const id = setInterval(load, 10 * 60 * 1000);
    return () => { alive = false; clearInterval(id); };
  }, [isSignedIn]);

  useEffect(() => {
    const t = setInterval(() => setRealNow(new Date()), 20000);
    return () => clearInterval(t);
  }, []);

  // Supabase Realtime: stream groups/friends changes pushed by others (e.g. shared groups)
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`profile-realtime-${userId}`)
      .on("postgres_changes", {
        event: "UPDATE",
        schema: "public",
        table: "profiles",
        filter: `user_id=eq.${userId}`,
      }, (payload) => {
        if (!payload.new) return;
        if (Array.isArray(payload.new.groups)) {
          setGroups(payload.new.groups);
          try { localStorage.setItem("pgp2.groups", JSON.stringify(payload.new.groups)); } catch { }
        }
        if (Array.isArray(payload.new.friends)) {
          setFriends(payload.new.friends);
          try { localStorage.setItem("pgp2.friends", JSON.stringify(payload.new.friends)); } catch { }
        }
        const remotePingIds = payload.new.courses?._readPingIds;
        const remoteGroupIds = payload.new.courses?._seenGroupIds;
        const remoteChangeKeys = payload.new.courses?._readChangeKeys;
        if (Array.isArray(remotePingIds) && remotePingIds.length) {
          setReadPingIds(prev => {
            const merged = new Set([...prev, ...remotePingIds]);
            try { localStorage.setItem(READ_PINGS_KEY, JSON.stringify([...merged])); } catch { }
            return merged;
          });
        }
        if (Array.isArray(remoteGroupIds) && remoteGroupIds.length) {
          setSeenRecvGroupIds(prev => {
            const merged = new Set([...prev, ...remoteGroupIds]);
            try { localStorage.setItem("pgp2.seen-recv-groups", JSON.stringify([...merged])); } catch { }
            return merged;
          });
        }
        if (Array.isArray(remoteChangeKeys) && remoteChangeKeys.length) {
          setReadChangeKeys(prev => {
            const merged = new Set([...prev, ...remoteChangeKeys]);
            try { localStorage.setItem(READ_CHANGES_KEY, JSON.stringify([...merged])); } catch { }
            return merged;
          });
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId]);

  // Phase 3: side-effects a social notification row triggers (the logic that used
  // to live in the friend_pings handlers). Keyed on row.type; idempotent.
  const handleSocialRow = useCallback(async (row) => {
    const d = row.data || {};
    if (row.type === "friend_accepted" && d.from_code) {
      // They accepted — pull their schedule and add them locally.
      const decoded = await decodeSchedule(d.from_code);
      if (decoded) {
        const current = loadFriends();
        if (!current.some(f => f.cloudId === decoded.id)) {
          const updated = saveFriend(decoded.name, decoded.courses, decoded.id);
          setFriends(updated);
          pushFriendsToCloud(userId, updated);
        }
      }
    } else if (row.type === "friend_removed") {
      // Silent control signal — drop the sender from friends, mark it resolved.
      const current = loadFriends();
      if (current.some(f => f.cloudId === d.from_id)) {
        const updated = removeFriendByCloudId(d.from_id);
        setFriends(updated);
        pushFriendsToCloud(userId, updated);
      }
      markNotificationRead(row.id);
    } else if (row.type === "group_invite") {
      // Re-sync so the newly-shared group shows up immediately.
      const result = await syncFriendsAndGroupsFromCloud(userId);
      if (result) { setGroups(result.groups); setFriends(result.friends); }
    }
  }, [userId]);

  // Notifications event store: initial fetch + live stream, split by type — social
  // events drive the bell's Friends section (mapped to the legacy ping shape),
  // everything else drives Alerts. friend_removed is silent (side-effect only).
  const loadNotifications = useCallback(async (uid) => {
    if (!uid) return;
    const rows = await fetchNotifications(uid);
    const social = rows.filter(r => SOCIAL_TYPES.has(r.type));
    setAlerts(rows.filter(r => !SOCIAL_TYPES.has(r.type)));
    for (const r of social) await handleSocialRow(r);
    setPings(social.filter(r => r.type !== "friend_removed").map(socialRowToPing));
  }, [handleSocialRow]);

  useEffect(() => {
    if (!userId) return;
    loadNotifications(userId);
    const unsub = subscribeToNotifications(userId, {
      onInsert: (row) => {
        if (SOCIAL_TYPES.has(row.type)) {
          handleSocialRow(row);
          if (row.type !== "friend_removed") {
            setPings(prev => prev.some(p => p.id === row.id) ? prev : [socialRowToPing(row), ...prev]);

            // Pop up top-right 5-7s flash toast for social events
            const d = row.data || {};
            const fromName = d.from_name || "Someone";
            if (row.type === "friend_request") {
              setSocialFlashToast({
                title: "👥 Friend Request",
                message: `${fromName} sent you a friend request!`,
                iconType: "social",
                duration: 6000
              });
            } else if (row.type === "friend_accepted") {
              setSocialFlashToast({
                title: "👥 Friend Request Accepted",
                message: `${fromName} accepted your friend request!`,
                iconType: "social",
                duration: 6000
              });
            } else if (row.type === "group_invite") {
              setSocialFlashToast({
                title: "👥 Group Invitation",
                message: `${fromName} invited you to ${d.group || "a group"}!`,
                iconType: "social",
                duration: 6000
              });
            }
          }
        } else {
          setAlerts(prev => prev.some(a => a.id === row.id) ? prev : [row, ...prev]);
        }
      },
      onUpdate: (row) => {
        if (SOCIAL_TYPES.has(row.type)) {
          setPings(prev => prev.map(p => p.id === row.id ? { ...p, read_at: row.read_at } : p));
        } else {
          setAlerts(prev => prev.map(a => a.id === row.id ? { ...a, ...row } : a));
        }
      },
    });
    return () => { unsub(); };
  }, [userId, loadNotifications, handleSocialRow]);

  useEffect(() => {
    // Listen for admin broadcast social flash notifications
    const channel = supabase.channel("social-flash-channel");
    channel
      .on("broadcast", { event: "social-flash" }, (payload) => {
        if (payload?.payload) {
          setSocialFlashToast(payload.payload);
        }
      })
      .subscribe();

    const handleLocalTrigger = (e) => {
      if (e.detail) setSocialFlashToast(e.detail);
    };
    window.addEventListener("social-flash-trigger", handleLocalTrigger);

    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener("social-flash-trigger", handleLocalTrigger);
    };
  }, []);

  useEffect(() => {
    // Decide between reloading silently (stale enough) or surfacing the toast.
    const handleUpdate = (fn) => {
      // swSeenRecord() lazily starts the clock the first time an update is seen.
      if (swUpdateIsStale()) {
        clearSwSeen(); // next update cycle starts a fresh clock after reload
        fn(true);
        return;
      }
      // Wrap so the toast's "Refresh" also clears the clock before reloading.
      setSwUpdateFn(() => (reload) => { clearSwSeen(); fn(reload); });
    };

    // Catch updates that fired before React mounted
    if (window.__swPendingUpdate) {
      handleUpdate(window.__swPendingUpdate);
      window.__swPendingUpdate = null;
    }
    const handler = (e) => handleUpdate(e.detail.updateSW);
    window.addEventListener("sw-update-available", handler);
    return () => window.removeEventListener("sw-update-available", handler);
  }, []);

  // Animate the install banner out before unmounting it.
  const closeInstallBanner = () => {
    setInstallBannerClosing(true);
    setTimeout(() => {
      setInstallPromptEvent(null);
      setShowIOSInstallHint(false);
      setInstallBannerClosing(false);
    }, 300);
  };

  useEffect(() => {
    const isStandalone = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
    if (isStandalone) return;

    const DAY = 1000 * 60 * 60 * 24;
    const DISMISS_KEY = "pgp2.install-prompt-dismissed-at";
    // Respect a previous dismissal: an explicit ✕ backs off for 14 days, while
    // simply ignoring it (auto-hide) backs off for a shorter 3 days.
    try {
      const raw = localStorage.getItem(DISMISS_KEY);
      const parsed = raw && raw.startsWith("{") ? JSON.parse(raw) : { at: parseInt(raw || "0", 10), hard: true };
      const cooldown = parsed.hard ? DAY * 14 : DAY * 3;
      if (parsed.at && Date.now() - parsed.at < cooldown) return;
    } catch { }

    const ua = window.navigator.userAgent;
    const isIOS = /iphone|ipad|ipod/i.test(ua);
    const isSafari = /safari/i.test(ua) && !/crios|fxios|edgios/i.test(ua);
    const iosHint = isIOS && isSafari;

    let showTimer, hideTimer;

    const autoHide = () => {
      // Soft dismissal: remembered for 3 days so we don't nag every reload,
      // but re-surface sooner than an explicit dismissal.
      try { localStorage.setItem(DISMISS_KEY, JSON.stringify({ at: Date.now(), hard: false })); } catch { }
      closeInstallBanner();
    };

    const reveal = () => {
      if (window.__pwaInstallPrompt) setInstallPromptEvent(window.__pwaInstallPrompt);
      else if (iosHint) setShowIOSInstallHint(true);
      else return;
      // Don't linger on screen forever — slide away after 15s.
      hideTimer = setTimeout(autoHide, 15000);
    };

    // Let the user settle into the app before pitching an install (8s delay).
    const scheduleReveal = () => { if (!showTimer) showTimer = setTimeout(reveal, 8000); };

    if (window.__pwaInstallPrompt || iosHint) scheduleReveal();
    const onAvailable = () => scheduleReveal();
    const onInstalled = () => { setInstallPromptEvent(null); setShowIOSInstallHint(false); };
    window.addEventListener("pwa-install-available", onAvailable);
    window.addEventListener("pwa-installed", onInstalled);

    return () => {
      clearTimeout(showTimer);
      clearTimeout(hideTimer);
      window.removeEventListener("pwa-install-available", onAvailable);
      window.removeEventListener("pwa-installed", onInstalled);
    };
  }, []);

  const dismissInstallPrompt = () => {
    // Explicit ✕ — a clear "not now", remembered for 14 days.
    try { localStorage.setItem("pgp2.install-prompt-dismissed-at", JSON.stringify({ at: Date.now(), hard: true })); } catch { }
    closeInstallBanner();
  };

  const handleInstallClick = async () => {
    if (!installPromptEvent) return;
    installPromptEvent.prompt();
    await installPromptEvent.userChoice;
    window.__pwaInstallPrompt = null;
    closeInstallBanner();
  };

  // Version-check fallback: compare /sw.js hash to localStorage so updates are
  // detected even when the SW lifecycle doesn't trigger onNeedRefresh reliably.
  // Use functional updater: if a banner is already showing (prev !== null), do nothing.
  // This means N deploys while the user is away still produce exactly one banner.
  const triggerHardRefresh = () => {
    // Hard-reload: nuke caches then reload. Reused for both the silent
    // auto-update and the manual toast path below.
    const hardReload = async () => {
      clearSwSeen();
      try {
        const names = await caches.keys();
        await Promise.all(names.map(n => caches.delete(n)));
      } catch { }
      window.location.reload();
    };
    // Silent auto-update: if this version has been stale for 2–3 days, just
    // reload — don't nag. swSeenRecord() (inside swUpdateIsStale) starts the
    // clock on first sighting so the toast still shows before the deadline.
    if (swUpdateIsStale()) { hardReload(); return; }
    // Functional updater: if a toast is already showing (prev !== null) do
    // nothing, so N deploys while the user is away still produce one toast.
    setSwUpdateFn(prev => (prev !== null ? prev : hardReload));
  };

  useEffect(() => {
    if (!isSignedIn) return;
    checkAppVersion(triggerHardRefresh);
     
  }, [isSignedIn]);

  // Page visibility: re-fetch schedule when user returns to tab after 5+ minutes away,
  // and always re-fetch pings (catches anything missed while tab was hidden)
  useEffect(() => {
    if (!isSignedIn) return;
    const syncedAtRef = { current: syncedAt };
    const updateRef = () => { syncedAtRef.current = syncedAt; };
    updateRef();
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        if (userId) loadNotifications(userId);
        checkAppVersion(triggerHardRefresh);
        const elapsed = Date.now() - syncedAtRef.current.getTime();
        if (elapsed > 5 * 60 * 1000) handleSync();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [isSignedIn, syncedAt, userId, loadNotifications]);

  useEffect(() => {
    const hour = now.getHours();
    let timeTheme;
    if (hour >= 5 && hour < 11) timeTheme = "theme-morning";
    else if (hour >= 11 && hour < 17) timeTheme = "theme-afternoon";
    else if (hour >= 17 && hour < 20) timeTheme = "theme-evening";
    else timeTheme = "theme-night";

    document.body.classList.remove("theme-morning", "theme-afternoon", "theme-evening", "theme-night");
    document.body.classList.add(timeTheme);
  }, [now]);

  // Independence Day (15 Aug) / Republic Day (26 Jan) tricolor accent —
  // admin-toggleable via sysConfig.flags.features.specialDayTheme (default on).
  const enableSpecialDayTheme = sysConfig?.flags?.features?.specialDayTheme !== false;
  const specialDay = enableSpecialDayTheme ? getSpecialDay(now) : null;
  useEffect(() => {
    document.body.classList.toggle("theme-tricolor", !!specialDay);
  }, [specialDay]);

  // Auto-sync section overrides from live sheet.
  // Also adds new courses from the sheet's STUDENTS roster that the user
  // wasn't enrolled in yet (e.g. WAI added after initial onboarding).
  useEffect(() => {
    const students = scheduleData?.STUDENTS;
    const email = user?.primaryEmailAddress?.emailAddress?.toLowerCase();

    if (students && email && enrolled && setup && userId) {
      (async () => {
        const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(email));
        const hash = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
        const overrides = students[hash];
        const droppedCodes = setup?.droppedCodes || [];
        if (overrides) {
          let changed = false;
          const nextEnrolled = { ...enrolled };
          for (const [code, rawSection] of Object.entries(overrides)) {
            // Never resurrect a course the student deliberately dropped via
            // setup-edit — the admin roster sheet isn't updated on drop, so
            // without this it silently reappears on the next feed sync.
            if (!(code in nextEnrolled) && droppedCodes.includes(code)) continue;
            // Normalise whatever value the sheet uses → A | B | Single
            const s = String(rawSection).trim();
            const section = s === "A" || s === "B" ? s : "Single";
            // Only sync from the sheet for courses the student isn't already
            // enrolled in (i.e. new additions from the roster). If the student
            // is already enrolled, their manually-chosen section takes priority —
            // don't let the sheet silently override a deliberate edit-setup change.
            if (!(code in nextEnrolled)) {
              nextEnrolled[code] = section;
              changed = true;
            }
          }
          if (changed) {
            setEnrolled(nextEnrolled);
            setMine(new Set(Object.keys(nextEnrolled)));
            const newSetup = { ...setup, courses: nextEnrolled };
            setSetup(newSetup);
            pushProfile(userId, nextEnrolled, user?.firstName || user?.username || "Student", undefined, user?.imageUrl);
          }
        }
      })();
    }
  }, [scheduleData?.STUDENTS, user, enrolled, setup, userId]);

  // Auto-fill onboarding from the feed's STUDENTS map for brand-new users.
  // Returning users keep their saved setup (localStorage or cloud) — the guards
  // below bail out the moment any existing setup is detected.
  useEffect(() => {
    if (!scheduleData || !isSignedIn || allocationApplied) return;
    // Wait for the cloud profile lookup so we don't race a cloud-restored setup.
    if (userId && !cloudChecked) return;
    if (setup || readSetup()) {
      setAllocationApplied(true);
      return;
    }
    const email = user?.primaryEmailAddress?.emailAddress;
    if (!email) return;
    // STUDENTS only arrives in the live feed — wait for it rather than marking done early.
    if (!scheduleData.STUDENTS) return;

    let cancelled = false;
    sha256hex(email.trim().toLowerCase()).then((hash) => {
      if (cancelled) return;
      const allocation = scheduleData.STUDENTS?.[hash];
      if (!allocation || Object.keys(allocation).length === 0) {
        setAllocationApplied(true);
        return;
      }
      // Build the same shape handleOnboardingDone expects: { code: "A" | "B" | "Single" }
      // Normalise any section value the sheet uses — anything other than A/B maps to Single.
      const courses = {};
      Object.entries(allocation).forEach(([code, rawSection]) => {
        const s = String(rawSection).trim();
        courses[code] = s === "A" || s === "B" ? s : "Single";
      });
      if (Object.keys(courses).length > 0) {
        setPrefillPicked(courses);
      }
      setAllocationApplied(true);
    });
    return () => { cancelled = true; };
  }, [scheduleData, isSignedIn, allocationApplied, cloudChecked, setup, userId, user]);

  // True while cloudChecked but STUDENTS hasn't arrived yet (live feed still in-flight).
  // Used to show a "Fetching timetable allocation…" notice in Onboarding.
  const waitingForAllocation = cloudChecked && !setup && !readSetup() && !scheduleData?.STUDENTS;

  // Apply Admin Overrides (Term data & Cancellations)
  const sd = useMemo(() => {
    if (!scheduleData) return null;
    let data = { ...scheduleData };
    if (sysConfig?.flags) {

      if (sysConfig.flags.classOverrides) {
        const overrides = sysConfig.flags.classOverrides;
        const newClasses = [];
        data.CLASSES = data.CLASSES.map(c => {
          const classOverride = lookupOverride(overrides[c.date], c);
          return classOverride ? { ...c, ...classOverride } : c;
        });

        Object.keys(overrides).forEach(date => {
          Object.keys(overrides[date]).forEach(key => {
            const ovr = overrides[date][key];
            if (ovr.type === "cancelled") return;
            const { ident: code, section } = parseOverrideKey(key);

            const exists = data.CLASSES.some(c => c.date === date && classIdent(c) === code && (c.section === section || section === "All" || c.section === "Single"));
            if (!exists) {
              newClasses.push({
                date: date,
                code: code,
                section: section,
                name: ovr.name || "Custom Added Class",
                room: ovr.room || "",
                start: ovr.start || "",
                end: ovr.end || "",
                type: ovr.type || "class"
              });
            }
          });
        });

        if (newClasses.length > 0) {
          data.CLASSES = [...data.CLASSES, ...newClasses];
        }
      }
    }
    return data;
  }, [scheduleData, sysConfig]);

  const { TERM, LEGEND, CLASSES, CHANGES } = sd || { TERM: null, LEGEND: {}, CLASSES: [], CHANGES: [] };

  const sectionsByCode = useMemo(() => {
    if (!sd) return {};
    const m = {};
    sd.CLASSES.forEach((c) => {
      if (c.type === "class" && c.code) (m[c.code] = m[c.code] || new Set()).add(c.section);
    });
    const out = {};
    Object.keys(m).forEach((k) => {
      // Combined guest sessions are "Single"/"All" entries visible to every
      // section — don't offer them as an enrollment choice for sectioned courses.
      const secs = [...m[k]];
      const real = secs.filter((s) => s !== "Single" && s !== "All");
      out[k] = (real.length ? real : secs).sort();
    });
    return out;
  }, [sd]);

  const visible = useMemo(() => {
    if (!enrolled || !mine) return [];
    const seen = new Set();
    return CLASSES.filter((c) => {
      if (c.type === "class") {
        const sec = enrolled[c.code];
        return sec !== undefined && (c.section === sec || c.section === "Single" || c.section === "All") && mine.has(c.code);
      }
      // Exams: the feed leaves `code` blank; try to infer the course code from
      // the entry name (e.g. "SAPM MID Term Exam" → "SAPM") and gate on enrollment.
      // If the name doesn't start with a recognisable enrolled code, show the
      // event to everyone (Term Registration, holidays, breaks, etc.).
      if (c.type === "exam") {
        const key = c.date + c.slot + c.name;
        if (seen.has(key)) return false;
        const code = c.code || (c.name || "").match(/^([A-Za-z]{2,8})\b/)?.[1]?.toUpperCase();
        if (code && Object.keys(LEGEND || {}).includes(code)) {
          if (!mine.has(code)) return false;
        }
        seen.add(key); return true;
      }
      const key = c.date + c.slot + c.name;
      if (seen.has(key)) return false; seen.add(key); return true;
    });
  }, [CLASSES, enrolled, mine, LEGEND]);

  const enrolledLegend = useMemo(() => {
    const out = {};
    if (enrolled) Object.keys(enrolled).forEach((c) => { if (LEGEND[c]) out[c] = LEGEND[c]; });
    return out;
  }, [enrolled, LEGEND]);

  // Assign stable subject colors before any child renders: enrolled courses
  // first (max hue separation for the user's own subjects), rest of the term
  // legend after.
  useMemo(() => {
    assignSubjectColors(Object.keys(enrolled || {}), Object.keys(LEGEND || {}));
  }, [enrolled, LEGEND]);

  // Per-course skip budget + "what if I skip one more" projection, shown as a
  // hint on today's unmarked class rows (same math as the Attendance panel).
  const skipInfo = useMemo(() => {
    if (!enrolled) return {};
    const out = {};
    for (const [code, section] of Object.entries(enrolled)) {
      const rawCredit = LEGEND[code]?.credits;
      out[code] = courseSkipStats(CLASSES, code, section, attendance, {
        zeroCredit: rawCredit === "0" || rawCredit === 0,
        credits: rawCredit,
      });
    }
    return out;
  }, [CLASSES, enrolled, attendance, LEGEND]);

  const todayISO = ymd(now);
  const tomorrowISO = ymd(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1));

  // TermFlow Wrapped release gate: hidden from EVERYONE — admins included —
  // until the admin explicitly pushes it (Admin Tools → Feature Flags →
  // flags.wrappedReleaseDate), and never before 27 Aug 2026, the hard floor
  // below. No QA bypass: to preview it, an admin sets/pushes a release date
  // like anyone else, then unschedules it afterwards. todayISO honours the
  // admin time-override so a launch can still be rehearsed.
  const WRAPPED_MIN_DATE = "2026-08-27";
  const wrappedRelease = sysConfig?.flags?.wrappedReleaseDate;
  const wrappedActive = !!wrappedRelease && todayISO >= wrappedRelease && todayISO >= WRAPPED_MIN_DATE;

  const weekRangeLabel = useMemo(() => {
    const monday = new Date(now);
    const dow = (monday.getDay() + 6) % 7;
    monday.setDate(monday.getDate() - dow + weekOffset * 7);
    monday.setHours(0, 0, 0, 0);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    return `${monday.toLocaleDateString([], { day: "numeric", month: "short" })} – ${sunday.toLocaleDateString([], { day: "numeric", month: "short" })}`;
  }, [now, weekOffset]);

  const todayList = useMemo(
    () => visible.filter((c) => c.date === todayISO).sort((a, b) => toMin(a.start) - toMin(b.start)),
    [visible, todayISO]
  );

  const tomorrowList = useMemo(
    () => visible.filter((c) => c.date === tomorrowISO).sort((a, b) => toMin(a.start) - toMin(b.start)),
    [visible, tomorrowISO]
  );

  const { current, next } = useMemo(() => {
    const teach = visible
      .filter((c) => c.type === "class" || c.type === "exam")
      .map((c) => ({ ...c, s: clsDate(c, "start"), e: clsDate(c, "end") }))
      .sort((a, b) => a.s - b.s);
    return {
      current: teach.find((c) => c.s <= now && now < c.e) || null,
      next: teach.find((c) => c.s > now) || null,
    };
  }, [visible, now]);

  const syncedAgo = Math.max(0, Math.round((now - syncedAt) / 60000));

  async function buildAllocationFromSheet() {
    const students = scheduleData?.STUDENTS;
    const email = user?.primaryEmailAddress?.emailAddress;
    if (!students || !email) return null;
    const hash = await sha256hex(email.trim().toLowerCase());
    const allocation = students[hash];
    if (!allocation || Object.keys(allocation).length === 0) return null;
    const courses = {};
    Object.entries(allocation).forEach(([code, section]) => {
      const s = String(section).trim();
      if (s === "A" || s === "B" || s === "Single") courses[code] = s;
    });
    return Object.keys(courses).length > 0 ? courses : null;
  }

  async function handleOnboardingDone(courses, enteredName) {
    // Track codes the student deliberately removed here, so the roster
    // auto-sync (below) never silently re-adds them from the admin sheet.
    // Re-picking a dropped code (a swap-back) clears it from the set again.
    const prevCourses = setup?.courses || enrolled || {};
    const prevDropped = setup?.droppedCodes || [];
    const newlyDropped = Object.keys(prevCourses).filter((c) => !(c in courses));
    const droppedCodes = [...new Set([...prevDropped, ...newlyDropped])].filter((c) => !(c in courses));
    const s = { courses, droppedCodes };
    saveSetup(s);
    const trimmed = (enteredName || "").trim();
    // If the user typed a name (they had none from Clerk), persist it to Clerk so
    // it flows everywhere, and use it directly for this push (user.firstName won't
    // update synchronously). Otherwise fall back to whatever Clerk already has.
    if (trimmed && user && !user.firstName) {
      try { await user.update({ firstName: trimmed }); } catch { /* non-blocking */ }
    }
    const name = trimmed || user?.firstName || user?.username || "Student";
    pushProfile(userId, courses, name, undefined, user?.imageUrl, droppedCodes);
    setEnrolled(courses);
    setMine(new Set(Object.keys(courses)));
    setSetup(s);
    setShowSetupEdit(false);
  }

  const filteredChanges = useMemo(() => {
    if (!CHANGES || !CHANGES.length) return [];
    // Strip data-quality gaps (admin_only) from what regular users see
    const userChanges = CHANGES.filter(c => !c.admin_only);
    if (!mine || mine.size === 0) return userChanges;

    const myCourseNames = [...mine].map(code => LEGEND[code]?.name).filter(Boolean);
    const allCourseNames = Object.values(LEGEND).map(l => l.name).filter(Boolean);

    return userChanges.filter(c => {
      if (c.code) return mine.has(c.code);
      const text = c.text || "";
      if (myCourseNames.some(name => text.includes(name))) return true;
      if (allCourseNames.some(name => text.includes(name))) return false;
      return true;
    });
  }, [CHANGES, mine, LEGEND]);

  const newRecvGroups = groups.filter(g => g.isReceived && !seenRecvGroupIds.has(g.id)); // used for badge count only
  const allRecvGroups = groups.filter(g => g.isReceived);
  const TWO_DAYS_AGO = Date.now() - 2 * 24 * 60 * 60 * 1000;
  const changeKey = c => `${c.ts}-${c.code || ""}`;
  const friendNotifItems = [
    ...pings
      .filter(p => new Date(p.created_at).getTime() > TWO_DAYS_AGO)
      .map(p => {
        let name = p.from_name;
        let text = `${name} added you as a friend`;
        let kind = "ping";
        let meta = null;
        try {
          meta = JSON.parse(p.from_name);
          name = meta.name || name;
          if (meta.group) { text = `${name} added you to "${meta.group}"`; kind = "group_invite"; }
          else if (meta.type === "friend_request") { text = `${name} wants to be your friend`; kind = "friend_request"; }
          else if (meta.type === "friend_accepted") { text = `${name} accepted your friend request`; kind = "friend_accepted"; }
          else { text = `${name} added you as a friend`; }
        } catch { }
        const pingId = p.id || p.from_id;
        return { id: `ping-${pingId}`, pingId, text, ts: p.created_at, kind, name, meta, fromId: p.from_id, isRead: readPingIds.has(pingId) || !!p.read_at };
      }),
    ...allRecvGroups
      .filter(g => !clearedGroupIds.has(g.id))
      .map(g => ({ id: `grp-${g.id}`, pingId: `grp-${g.id}`, text: `${g.ownerName} shared "${g.name}" with you`, ts: g.createdAt, kind: "group", name: g.ownerName, isRead: seenRecvGroupIds.has(g.id) })),
  ];
  const unreadFriendCount = friendNotifItems.filter(item => !item.isRead).length;
  const unreadChangeCount = filteredChanges.filter(c => !readChangeKeys.has(changeKey(c))).length;
  // Schedule moves (schedule_change) are shown by the "Changes" section (client
  // CHANGES, same source the Announcements page uses), so keep them OUT of the
  // Alerts section to avoid showing the same event twice in the bell. The rows
  // still exist in `notifications` for opt-in push.
  const alertItems = alerts.filter(a => a.type !== "schedule_change");
  const unreadAlertCount = alertItems.filter(a => !a.read_at).length;
  const unreadTotal = unreadChangeCount + unreadFriendCount + unreadAlertCount;
  const hasUnread = unreadTotal > 0;

  // Surface unread count on the tab title + installed-PWA app icon badge
  useEffect(() => {
    const total = unreadChangeCount + unreadFriendCount + unreadAlertCount;
    document.title = total > 0 ? `(${total}) TermFlow` : "TermFlow | IIM Sambalpur | PGP2";
    if ("setAppBadge" in navigator) {
      if (total > 0) navigator.setAppBadge(total).catch(() => {});
      else navigator.clearAppBadge?.().catch(() => {});
    }
  }, [unreadChangeCount, unreadFriendCount, unreadAlertCount]);

  // Unread changes that specifically name a course happening on tomorrow's list
  const tomorrowChangeCount = useMemo(() => {
    const codes = new Set(tomorrowList.filter(c => c.type === "class").map(c => c.code));
    return filteredChanges.filter(c => c.code && codes.has(c.code) && !readChangeKeys.has(changeKey(c))).length;
  }, [filteredChanges, tomorrowList, readChangeKeys]);

  // Unread changes for a course that still has an unfinished class TODAY. Only
  // counts classes whose end time is in the future, so once the affected class
  // wraps up the banner self-expires.
  const todayChangeCount = useMemo(() => {
    const liveCodes = new Set(
      todayList.filter(c => c.type === "class" && clsDate(c, "end") > now).map(c => c.code)
    );
    return filteredChanges.filter(c => c.code && liveCodes.has(c.code) && !readChangeKeys.has(changeKey(c))).length;
  }, [filteredChanges, todayList, readChangeKeys, now]);
  const receivedGroupCount = groups.filter(g => g.isReceived).length;

  function markGroupsSeen() {
    setSeenRecvCount(receivedGroupCount);
    try { localStorage.setItem("pgp2.recv-groups-count", String(receivedGroupCount)); } catch { }
  }

  function markPingRead(pingId) {
    if (!pingId) return;
    if (pingId.startsWith("grp-")) {
      const groupId = pingId.slice(4);
      if (seenRecvGroupIds.has(groupId)) return;
      const nextGroupIds = new Set([...seenRecvGroupIds, groupId]);
      setSeenRecvGroupIds(nextGroupIds);
      try { localStorage.setItem("pgp2.seen-recv-groups", JSON.stringify([...nextGroupIds])); } catch { }
      pushReadState(userId, readPingIds, nextGroupIds, readChangeKeys);
      return;
    }
    if (readPingIds.has(pingId)) return;
    const nextPingIds = new Set([...readPingIds, pingId]);
    setReadPingIds(nextPingIds);
    try { localStorage.setItem(READ_PINGS_KEY, JSON.stringify([...nextPingIds])); } catch { }
    pushReadState(userId, nextPingIds, seenRecvGroupIds, readChangeKeys);
  }

  // Notifications-table read state lives server-side (read_at). Optimistically
  // flip it locally, then persist — realtime UPDATE reconciles other devices.
  function markAlertRead(id) {
    if (!id) return;
    setAlerts(prev => prev.map(a => a.id === id && !a.read_at ? { ...a, read_at: new Date().toISOString() } : a));
    markNotificationRead(id);
  }

  function markChangeRead(c) {
    const key = changeKey(c);
    if (readChangeKeys.has(key)) return;
    const next = new Set([...readChangeKeys, key]);
    setReadChangeKeys(next);
    try { localStorage.setItem(READ_CHANGES_KEY, JSON.stringify([...next])); } catch { }
    pushReadState(userId, readPingIds, seenRecvGroupIds, next);
  }

  // Batch variant: one state update + one sync push for a whole bundle.
  // Returns the pushReadState promise so callers can show a "synced" indicator.
  function markChangesRead(cs) {
    const fresh = (cs || []).map(changeKey).filter(k => !readChangeKeys.has(k));
    if (!fresh.length) return Promise.resolve();
    const next = new Set([...readChangeKeys, ...fresh]);
    setReadChangeKeys(next);
    try { localStorage.setItem(READ_CHANGES_KEY, JSON.stringify([...next])); } catch { }
    return pushReadState(userId, readPingIds, seenRecvGroupIds, next);
  }

  function markAllChangesRead() {
    return markChangesRead((CHANGES || []).filter(c => isAdmin || !c.admin_only));
  }

  function markAllRead() {
    const nextPings = new Set([...readPingIds, ...friendNotifItems.map(i => i.pingId).filter(Boolean)]);
    setReadPingIds(nextPings);
    try { localStorage.setItem(READ_PINGS_KEY, JSON.stringify([...nextPings])); } catch { }

    const nextChanges = new Set([...readChangeKeys, ...filteredChanges.map(changeKey)]);
    setReadChangeKeys(nextChanges);
    try { localStorage.setItem(READ_CHANGES_KEY, JSON.stringify([...nextChanges])); } catch { }

    const newIds = new Set([...seenRecvGroupIds, ...newRecvGroups.map(g => g.id)]);
    setSeenRecvGroupIds(newIds);
    try { localStorage.setItem("pgp2.seen-recv-groups", JSON.stringify([...newIds])); } catch { }

    // Notifications-table rows: optimistic local flip + one server call.
    if (unreadAlertCount > 0) {
      const now = new Date().toISOString();
      setAlerts(prev => prev.map(a => a.read_at ? a : { ...a, read_at: now }));
      markAllNotificationsRead(userId);
    }

    pushReadState(userId, nextPings, newIds, nextChanges);
  }

  function flashFriendToast(msg) {
    setFriendToast(msg);
    setTimeout(() => setFriendToast(null), 4000);
  }

  // Drop a ping row everywhere it lives: server table + local list state
  function removePingEverywhere(pingId) {
    markNotificationRead(pingId);
    setPings(prev => prev.filter(p => p.id !== pingId));
  }

  async function handleAcceptFriendRequest(item) {
    const senderName = user?.firstName || user?.username || "Student";
    if (!item.meta?.fromCode) { flashFriendToast("Request data missing"); return; }
    const decoded = await decodeSchedule(item.meta.fromCode);
    if (!decoded) { flashFriendToast("Could not fetch friend's schedule"); return; }
    const updated = saveFriend(decoded.name, decoded.courses, decoded.id);
    setFriends(updated);
    pushFriendsToCloud(userId, updated);
    const myCode = await getOrCreateShareCode(userId, senderName);
    if (myCode) await sendFriendPing(item.fromId, userId, senderName, { type: "friend_accepted", fromCode: myCode });
    deleteFriendPing(item.pingId);
    removePingEverywhere(item.pingId);
    flashFriendToast(`You're now friends with ${decoded.name}!`);
  }

  function handleDeclineFriendRequest(item) {
    deleteFriendPing(item.pingId);
    removePingEverywhere(item.pingId);
  }

  function clearAllFriendNotifs() {
    deleteAllFriendPings(userId);          // drain any legacy friend_pings
    pings.forEach(p => markNotificationRead(p.id)); // durably clear social rows
    setPings([]);
    setReadPingIds(new Set());
    try { localStorage.removeItem(READ_PINGS_KEY); } catch { }
    markGroupsSeen();
    setClearedGroupIds(prev => {
      const next = new Set([...prev, ...allRecvGroups.map(g => g.id)]);
      try { localStorage.setItem(CLEARED_GROUPS_KEY, JSON.stringify([...next])); } catch { }
      return next;
    });
  }

  function handleOpenNotif() {
    if (!notifOpen && filteredChanges.length > 0 && userId && enrolled) {
      const latest = Math.max(...filteredChanges.map(c => new Date(c.ts).getTime()));
      setLastSeenTs(latest);
      try { localStorage.setItem(NOTIF_KEY, String(latest)); } catch { }
      pushProfile(userId, enrolled, user?.firstName || user?.username || "Student", latest, user?.imageUrl);
    }
    if (!notifOpen) notifOpenedAt.current = Date.now();
    setNotifOpen(o => !o);
  }

  function handleViewAllNotifs() {
    // Guard against mobile tap-through: if the panel just opened (<350ms ago)
    // the tap-up from the bell press lands on this button — ignore it.
    if (Date.now() - notifOpenedAt.current < 350) return;
    setNotifOpen(false);
    setView("notifications");
  }

  // Presence heartbeat — stamps profiles.last_seen_at (at most once/hour) so
  // the admin "Active Today" stat reflects real usage. No-ops silently if the
  // column doesn't exist yet or the profile row hasn't been created.
  useEffect(() => {
    if (!userId) return;
    const beat = async () => {
      try {
        const last = Number(localStorage.getItem("pgp2.last-heartbeat") || 0);
        if (Date.now() - last < 60 * 60 * 1000) return;
        localStorage.setItem("pgp2.last-heartbeat", String(Date.now()));
        await supabase.from("profiles").update({ last_seen_at: new Date().toISOString() }).eq("user_id", userId);
      } catch { /* best effort */ }
    };
    beat();
    const onVisible = () => { if (document.visibilityState === "visible") beat(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [userId]);

  const markAttendance = async (c, status) => {
    haptic([10]);
    const key = sessionKey(c);
    setAttendance(prev => {
      const next = { ...prev };
      if (status === null) delete next[key]; else next[key] = status;
      saveAttendance(next);
      return next;
    });
    pushMark(userId, key, status);
  }

  const handleSync = async () => {
    haptic([10]);
    setSyncing(true);
    try {
      const data = await fetchSchedule(true);
      setScheduleData(data);
      setSyncedAt(new Date());
      setRealNow(new Date());
      if (data._meta) setSyncLogs(prev => [data._meta, ...prev].slice(0, 1000));
      haptic([10, 40, 10]);
    } catch (e) {
      haptic([50, 100, 50]);
      setSyncLogs(prev => [{ ts: Date.now(), status: "error", message: `Manual sync failed: ${e.message || "Network Error"}` }, ...prev].slice(0, 1000));
    } finally {
      setSyncing(false);
    }
  };

  function fmtTermDate(val) {
    if (!val) return "";
    // Try ISO (YYYY-MM-DD) with midnight anchor first, then raw parse
    let d = new Date(String(val).trim() + "T00:00");
    if (isNaN(d)) d = new Date(String(val).trim());
    return isNaN(d) ? "" : d.toLocaleDateString([], { day: "numeric", month: "short" });
  }
  const termDateRange = TERM ? [fmtTermDate(TERM.start), fmtTermDate(TERM.end)].filter(Boolean).join(" – ") : "";
  const termLabel = TERM?.number ? `Term ${TERM.number}${termDateRange ? ` · ${termDateRange}` : ""}` : termDateRange;
  const termProgressPct = useMemo(() => {
    if (!TERM?.start || !TERM?.end) return null;
    const [sY, sM, sD] = TERM.start.split("-").map(Number);
    const [eY, eM, eD] = TERM.end.split("-").map(Number);
    const start = new Date(sY, sM - 1, sD).getTime();
    const end = new Date(eY, eM - 1, eD).getTime();
    if (!(end > start)) return null;
    return Math.min(100, Math.max(0, Math.round(((now.getTime() - start) / (end - start)) * 100)));
  }, [TERM?.start, TERM?.end, now]);
  const termWeekInfo = useMemo(() => {
    if (!TERM?.start || !TERM?.end) return null;
    const [sY, sM, sD] = TERM.start.split("-").map(Number);
    const [eY, eM, eD] = TERM.end.split("-").map(Number);
    const start = new Date(sY, sM - 1, sD).getTime();
    const end = new Date(eY, eM - 1, eD).getTime();
    if (!(end > start)) return null;
    const DAY = 86400000;
    const totalWeeks = Math.ceil(((end - start) / DAY + 1) / 7);
    const week = Math.min(totalWeeks, Math.max(1, Math.ceil(((now.getTime() - start) / DAY + 1) / 7)));
    const daysLeft = Math.max(0, Math.ceil((end - now.getTime()) / DAY));
    return { week, totalWeeks, daysLeft };
  }, [TERM?.start, TERM?.end, now]);

  // If Clerk hasn't resolved and we aren't optimistically bypassing (no cache), show the splash
  if (!isLoaded && !isSignedIn) return (
    <main className="loading-screen">
      <TermFlowLoader variant="splash" size={96} />
      <p className="loading-label">Starting up…</p>
    </main>
  );
  if (!isSignedIn) return <Login />;
  if (!scheduleData) return (
    <main className="loading-screen">
      <TermFlowLoader size={72} />
      <p className="loading-label">Loading timetable…</p>
      <p className="loading-sub">
        {(() => {
          const h = new Date().getHours();
          return h < 12 ? "Good morning, loading your day…" : h < 16 ? "Good afternoon, loading your day…" : "Good evening, loading your day…";
        })()}
      </p>
    </main>
  );
  const needsName = !(user?.firstName || user?.username);
  if (!setup) return <Onboarding legend={LEGEND} sectionsByCode={sectionsByCode} onDone={handleOnboardingDone} termLabel={termLabel} onPullFromSheet={buildAllocationFromSheet} prefill={prefillPicked} cloudChecked={cloudChecked} waitingForAllocation={waitingForAllocation} needsName={needsName} />;
  if (showSetupEdit) return <Onboarding legend={LEGEND} sectionsByCode={sectionsByCode} onDone={handleOnboardingDone} initialPicked={enrolled} onCancel={() => setShowSetupEdit(false)} termLabel={termLabel} onPullFromSheet={buildAllocationFromSheet} needsName={needsName} />;

  // Banned User Lockout
  if (sysConfig?.flags?.bannedUsers?.includes(userId) && !isAdmin) {
    return (
      <main className="login-screen" style={{ flexDirection: "column", gap: 20 }}>
        <ShieldAlert size={64} color="var(--danger, #e74c3c)" style={{ filter: "drop-shadow(0 4px 12px rgba(231,76,60,0.3))" }} />
        <h1 style={{ fontSize: 24, fontWeight: 800, color: "var(--text)", margin: 0 }}>Account Suspended</h1>
        <p style={{ color: "var(--muted)", maxWidth: 300, textAlign: "center", lineHeight: 1.5, margin: 0 }}>
          Your access to TermFlow has been revoked. Please contact administration.
        </p>
      </main>
    );
  }

  const _mw = sysConfig?.flags?.maintenanceWindow;
  const inMaintenanceWindow = !!(_mw?.start && _mw?.end &&
    Date.now() >= new Date(_mw.start).getTime() && Date.now() <= new Date(_mw.end).getTime());
  if ((sysConfig?.flags?.maintenanceMode || inMaintenanceWindow) && !isAdmin) {
    return (
      <main className="login-screen" style={{ flexDirection: "column", gap: 20 }}>
        <CloudOff size={64} color="var(--danger, #e74c3c)" style={{ filter: "drop-shadow(0 4px 12px rgba(231,76,60,0.3))" }} />
        <h1 style={{ fontSize: 24, fontWeight: 800, color: "var(--text)", margin: 0 }}>Under Maintenance</h1>
        <p style={{ color: "var(--muted)", maxWidth: 300, textAlign: "center", lineHeight: 1.5, margin: 0 }}>
          TermFlow is currently undergoing scheduled maintenance. Please check back later.
        </p>
        <button className="admin-btn primary" onClick={() => window.location.reload()} style={{ marginTop: 20, display: "flex", alignItems: "center", gap: 8 }}>
          <RefreshCw size={16} /> Refresh Page
        </button>
      </main>
    );
  }

  const enableExams = sysConfig?.flags?.enableExams !== false;
  // Lite keeps the friends graph (Compare needs it) but hard-disables the rich
  // social extras — status lines, meetups, free-nudges, away-sharing — which
  // strips them from both the Today view and the (minimal) Compare page.
  const enableFriends = sysConfig?.flags?.enableFriends !== false;
  const enableAttendance = sysConfig?.flags?.enableAttendance !== false;
  const enableStatus = !IS_LITE && sysConfig?.flags?.enableStatus !== false;
  const enableMeetups = !IS_LITE && sysConfig?.flags?.enableMeetups !== false;
  const enableFreeNudge = !IS_LITE && sysConfig?.flags?.enableFreeNudge !== false;
  const enableAwayShare = !IS_LITE && sysConfig?.flags?.enableAwayShare !== false;

  const announcementTargetMatches = (target) => {
    if (!target || target === "global") return true;
    if (target === "section_A") return Object.values(setup?.courses || {}).includes("A");
    if (target === "section_B") return Object.values(setup?.courses || {}).includes("B");
    if (target === "has_friends") return !!(friends && friends.length > 0);
    if (target.startsWith("subject_")) return !!setup?.courses?.[target.replace("subject_", "")];
    return false;
  };

  let activeGlobalAnnouncement = null;
  if (sysConfig?.announcement) {
    if (typeof sysConfig.announcement === 'string') {
      activeGlobalAnnouncement = sysConfig.announcement;
    } else if (typeof sysConfig.announcement === 'object') {
      const { message, target } = sysConfig.announcement;
      if (announcementTargetMatches(target)) activeGlobalAnnouncement = message;
    }
  }

  // Scheduled announcements (admin flags.scheduledAnnouncements) — active while
  // todayISO is inside [start, end], target-filtered, dismissible per device
  const activeScheduledAnnouncements = (sysConfig?.flags?.scheduledAnnouncements || []).filter(a =>
    a?.message && a.start && a.end &&
    todayISO >= a.start && todayISO <= a.end &&
    !dismissedAnnouncements.has(a.id) &&
    announcementTargetMatches(a.target)
  );

  // Quick links (admin flags.quickLinks) — date-windowed links for the sidebar
  const activeQuickLinks = (sysConfig?.flags?.quickLinks || []).filter(q =>
    q?.title && q.url && q.start && q.end && todayISO >= q.start && todayISO <= q.end
  );

  // What's New feature announcements (admin flags.whatsNew, newest first)
  const whatsNewItems = (sysConfig?.flags?.whatsNew || []).filter(w => w?.id && w.title);
  const unseenWhatsNew = whatsNewItems.filter(w => !seenWhatsNewIds.has(w.id));

  const renderNotificationBell = (variant = "topbar") => (
    <div className="tb-wrap notif-wrap">
      <button className={variant === "sidebar" ? "sb-util-btn" : "sync"} onClick={handleOpenNotif} aria-label={hasUnread ? `Notifications, ${unreadTotal} unread` : "Notifications"} aria-expanded={notifOpen}>
        <Bell size={variant === "sidebar" ? 16 : 15} />
        {hasUnread && <span className="notif-badge">{unreadTotal > 9 ? "9+" : unreadTotal}</span>}
      </button>
      <span className="tooltip" role="tooltip">Notifications</span>
      {notifOpen && (
        <>
          <div className="notif-backdrop" onClick={() => setNotifOpen(false)} />
          <div className="notif-panel" role="dialog" aria-label="Notifications">
            <div className="notif-panel-top">
              <div className="bell-chips" role="tablist" aria-label="Filter notifications">
                {[["all", "All"], ["social", "Social"], ["classes", "Classes"]].map(([id, label]) => (
                  <button
                    key={id}
                    role="tab"
                    aria-selected={notifFilter === id}
                    className={`bell-chip${notifFilter === id ? " on" : ""}`}
                    onClick={() => setNotifFilter(id)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {hasUnread
                ? <button className="rc-mark-all" onClick={markAllRead}>Mark all read</button>
                : <span className="rc-all-read">All caught up</span>
              }
            </div>
            {(() => {
              const showSocial = notifFilter !== "classes";
              const showClasses = notifFilter !== "social";
              const socialEmpty = friendNotifItems.length === 0;
              const classesEmpty = alertItems.length === 0 && filteredChanges.length === 0;
              if ((!showSocial || socialEmpty) && (!showClasses || classesEmpty)) {
                return <p className="notif-empty">No new notifications</p>;
              }
              return (
                <>
                  {showSocial && !socialEmpty && (
                    <section className="rc">
                      <div className="rc-head">
                        <span className="rc-title"><Users size={14} /> Friends</span>
                      </div>
                      <div className="np-ping-list">
                        {friendNotifItems.map(item => (
                          <div
                            key={item.id}
                            className={`np-ping${item.isRead ? " np-ping-read" : ""}`}
                            onClick={() => item.kind !== "friend_request" && markPingRead(item.pingId)}
                            style={{ cursor: item.kind !== "friend_request" ? "pointer" : "default" }}
                          >
                            <div className="np-ping-avatar">{(item.name || "?")[0].toUpperCase()}</div>
                            <div className="np-ping-body">
                              <span className="np-ping-text">{item.text}</span>
                              {item.kind === "friend_request" && (
                                <div className="np-ping-actions">
                                  <button className="np-btn-accept" onClick={e => { e.stopPropagation(); handleAcceptFriendRequest(item); }}>
                                    <Check size={13} strokeWidth={2.8} /> Accept
                                  </button>
                                  <button className="np-btn-decline" onClick={e => { e.stopPropagation(); handleDeclineFriendRequest(item); }}>
                                    <X size={13} strokeWidth={2.8} /> Decline
                                  </button>
                                </div>
                              )}
                            </div>
                            <div className="np-ping-side">
                              <span className="np-ping-time">{timeAgo(item.ts)}</span>
                              {item.isRead && <span className="rc-read-check">✓</span>}
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="np-sec-foot">
                        <button className="np-link" onClick={() => { setNotifOpen(false); setView("friends"); }}>{IS_LITE ? "Go to Compare" : "Go to Social"}</button>
                        <button className="np-link np-link-danger" onClick={clearAllFriendNotifs}>Clear all</button>
                      </div>
                    </section>
                  )}
                  {showClasses && alertItems.length > 0 && (
                    <section className="rc">
                      <div className="rc-head">
                        <span className="rc-title"><BellRing size={14} /> Alerts</span>
                      </div>
                      <ul className="rc-list">
                        {alertItems.slice(0, 6).map(a => {
                          const code = a.data?.code;
                          const titleText = code ? a.title.replace(code, "").replace(/\s{2,}/g, " ").trim() : a.title;
                          return (
                          <li key={a.id} className={`rc-item rc-item-clickable${a.read_at ? " rc-item-read" : ""}`} onClick={() => markAlertRead(a.id)}>
                            <span className={`rc-dot ${ALERT_DOT[a.type] || "rc-alert"}`} />
                            <span className="rc-text">
                              <span className="rc-alert-title">
                                {code && <span className={`ses rc-alert-pill ${subjectClass(code)}`}>{code}</span>}
                                {titleText}
                              </span>
                              {a.body && <span className="rc-alert-sub">{a.body.replace(/\n/g, "  ·  ")}</span>}
                            </span>
                            {a.created_at && <span className="rc-time">{timeAgo(a.created_at)}</span>}
                            {a.read_at && <span className="rc-read-check">✓</span>}
                          </li>
                          );
                        })}
                      </ul>
                    </section>
                  )}
                  {showClasses && filteredChanges.length > 0 && <RecentChanges changes={filteredChanges} readKeys={readChangeKeys} onMarkRead={markChangeRead} onViewAll={handleViewAllNotifs} />}
                </>
              );
            })()}
          </div>
        </>
      )}
    </div>
  );

  const renderSbAvatarWrap = () => (
    <div className="sb-avatar-wrap" onMouseEnter={(e) => showSbTip(e, "Profile", true)} onMouseLeave={hideSbTip}>
      <button className="sb-avatar-btn" onClick={(e) => { e.stopPropagation(); setSbProfileOpen(o => !o); hideSbTip(); }} aria-label="Profile">
        <div className="sb-avatar-img">
          {user?.imageUrl ? <img src={user.imageUrl} alt="" /> : (user?.firstName?.[0] || "?")}
        </div>
        <div className="sb-avatar-info">
          <span className="sb-avatar-name">
            {user?.firstName || user?.fullName || "Student"}
            {showAdminUI && <span className="admin-badge">Admin</span>}
          </span>
          <span className="sb-avatar-batch">PGP2 · 2025–27</span>
        </div>
      </button>
      {sbProfileOpen && <div className="notif-backdrop" style={{ zIndex: 299 }} onClick={() => setSbProfileOpen(false)} />}
      <div className={`sb-profile-pop ${sbProfileOpen ? "sb-open" : ""}`}>
        <div className="sb-pop-head">
          <div className={`sb-pop-ava ${isUploadingAva ? "is-uploading" : ""}`} onClick={() => !isUploadingAva && avaInputRef.current?.click()}>
            <input type="file" ref={avaInputRef} accept="image/*" style={{ display: 'none' }} onChange={handleAvatarUpload} />
            {user?.imageUrl ? <img src={user.imageUrl} alt="" /> : (user?.firstName?.[0] || "?")}
            <div className="sb-pop-ava-overlay">
              {isUploadingAva ? <Loader2 size={18} className="spin-icon" /> : <Camera size={18} />}
            </div>
          </div>
          <div className="sb-pop-id">
            <div className="sb-pop-name">
              {user?.fullName || "Student"}
              {showAdminUI && <span className="admin-badge">Admin</span>}
            </div>
            <div className="sb-pop-email">{user?.primaryEmailAddress?.emailAddress || ""}</div>
          </div>
        </div>
        <div className="sb-pop-meta">
          <span className="sb-pop-batch">PGP2 · 2025–27</span>
          {termLabel && <span className="sb-pop-term">{termLabel}</span>}
          <span className="sb-pop-version">v{__APP_VERSION__.split("+")[0]}</span>
        </div>
        <div className="sb-pop-sep" />
        <div className="sb-pop-style">
          <span className="sb-pop-style-label">Sidebar</span>
          <div className="sb-pop-seg">
            <button className={sbStyle === "classic" ? "on" : ""} onClick={() => setSidebarStyle("classic")}>Classic</button>
            <button className={sbStyle === "aurora" ? "on" : ""} onClick={() => setSidebarStyle("aurora")}>Aurora</button>
          </div>
        </div>
        <button className="sb-pop-signout" onClick={() => signOut()}>
          <LogOut size={14} /> Sign out
        </button>
      </div>
    </div>
  );

  const renderSbUtilStrip = () => (
    <div className="sb-util-strip">
      {renderNotificationBell("sidebar")}
      <button className="sb-util-btn" onMouseEnter={e => showSbTip(e, "Edit setup", true)} onMouseLeave={hideSbTip} onClick={() => { setShowSetupEdit(true); hideSbTip(); }} aria-label="Edit setup">
        <Settings2 size={16} />
      </button>
      <button className="sb-util-btn" disabled={isOffline} onMouseEnter={e => showSbTip(e, isOffline ? "Offline" : syncing ? "Syncing…" : "Refresh", true)} onMouseLeave={hideSbTip} onClick={handleSync} aria-label="Refresh" style={{ opacity: isOffline ? 0.3 : 1 }}>
        <RefreshCw size={16} className={syncing ? "spin-icon" : ""} />
      </button>
      {isAdmin && (
        <button
          className={`sb-util-btn${adminMode ? " sb-util-admin-on" : ""}`}
          onMouseEnter={e => showSbTip(e, adminMode ? "Exit Admin" : "Admin Mode", true)}
          onMouseLeave={hideSbTip}
          onClick={() => setAdminMode(!adminMode)}
          aria-label={adminMode ? "Exit Admin" : "Admin Mode"}
        >
          {adminMode ? <Shield size={16} /> : <User size={16} />}
        </button>
      )}
    </div>
  );

  return (
    <div className="app-shell">
      {/* ── Dev→Prod Migration Banner (one-time, self-removing) ── */}
      {migrationState && <MigrationBanner state={migrationState} />}

      {/* ── SW Update Toast (non-blocking) ── */}
      {swUpdateFn && (() => {
        const cfg = sysConfig?.flags?.updatePrompt || {};
        const title = cfg.title || "Update ready";
        const desc = cfg.desc || "A new version is available.";
        return (
          <div className="sw-update-toast" role="status" aria-live="polite">
            <span className="sw-update-toast-sheen" aria-hidden="true" />
            <div className="sw-update-toast-icon">
              <span className="sw-update-toast-ring" aria-hidden="true" />
              <RefreshCw size={16} color="#fff" strokeWidth={2.5} className="sw-update-spin-icon" />
            </div>
            <div className="sw-update-toast-text">
              <span className="sw-update-toast-title">
                {title}
                <span className="sw-update-toast-tag">NEW</span>
              </span>
              <span className="sw-update-toast-desc">{desc}</span>
            </div>
            <button className="sw-update-toast-refresh" onClick={() => swUpdateFn(true)}>
              <RefreshCw size={13} strokeWidth={2.6} aria-hidden="true" />
              <span>Refresh</span>
            </button>
            <button
              className="sw-update-toast-dismiss"
              onClick={() => setSwUpdateFn(null)}
              aria-label="Dismiss update notification"
            >
              <X size={15} strokeWidth={2.5} />
            </button>
          </div>
        );
      })()}

      {/* ── What's New modal ── */}
      {whatsNewOpen && (
        <WhatsNewModal items={whatsNewItems} onClose={() => closeWhatsNew(whatsNewItems)} onOpenGuide={() => { closeWhatsNew(whatsNewItems); setHelpModalOpen(true); }} />
      )}

      {/* ── Friend-added toast (share-link accepts) ── */}
      {friendToast && (
        <div className="app-toast" role="status">
          <Users size={15} /> {friendToast}
        </div>
      )}

      {/* ── Install App banner ── */}
      {(installPromptEvent || showIOSInstallHint) && (
        <div className={`install-banner${installBannerClosing ? " install-banner--closing" : ""}`} role="complementary" aria-label="Install TermFlow app">
          <div className="install-banner-icon">
            <Download size={18} strokeWidth={2.4} />
          </div>
          <div className="install-banner-text">
            <div className="install-banner-title">Install TermFlow</div>
            <div className="install-banner-desc">
              {installPromptEvent
                ? "Add it to your home screen for offline access and faster loading."
                : <>Tap <Share size={12} style={{ verticalAlign: "-2px" }} /> Share, then "Add to Home Screen".</>}
            </div>
            {installPromptEvent && (
              <div className="install-banner-perks">
                <span className="install-banner-perk"><WifiOff size={11} /> Works offline</span>
                <span className="install-banner-perk"><Zap size={11} /> Faster launch</span>
              </div>
            )}
          </div>
          <div className="install-banner-actions">
            {installPromptEvent && (
              <button className="install-banner-btn" onClick={handleInstallClick}>
                <span>Install</span>
              </button>
            )}
            <button className="install-banner-dismiss" onClick={dismissInstallPrompt} aria-label="Dismiss">
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {/* ── Independence/Republic Day greeting banner ── */}
      {specialDay && !specialDayBannerDismissed && (
        <div className={`specialday-banner${specialDayBannerClosing ? " specialday-banner--closing" : ""}`} role="complementary" aria-label={`${specialDay.label} greeting`}>
          <div className="specialday-sparkles" aria-hidden="true">
            {Array.from({ length: 8 }).map((_, i) => <span key={i} className="specialday-sparkle" />)}
          </div>
          <div className="specialday-banner-icon" aria-hidden="true"><IndiaFlagIcon size={22} /></div>
          <div className="specialday-banner-text">
            <div className="specialday-banner-title">Happy {specialDay.label}!</div>
            <div className="specialday-banner-desc">Wishing you a great {specialDay.short} from TermFlow.</div>
          </div>
          <button className="specialday-banner-dismiss" onClick={dismissSpecialDayBanner} aria-label="Dismiss">
            <X size={16} />
          </button>
        </div>
      )}

      {/* ── Impersonation Banner ── */}
      {impersonatedUser && (
        <div className="announcement-banner warning" style={{ position: "absolute", top: 0, left: 0, right: 0, zIndex: 9999, borderBottom: "1px solid rgba(0,0,0,0.1)", borderRadius: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1 }}><ShieldAlert size={16} /> Impersonating: {impersonatedUser.name || impersonatedUser.user_id}</div>
          <button onClick={stopImpersonation} style={{ background: "rgba(0,0,0,0.15)", border: "none", padding: "4px 10px", borderRadius: 4, cursor: "pointer", fontWeight: 700, color: "var(--text)", fontSize: 12 }}>Exit</button>
        </div>
      )}

      {/* ── Desktop Sidebar ── */}
      <aside className={`sidebar${sbCollapsed ? " collapsed" : ""}${sbStyle === "aurora" ? " sb-aurora" : ""}`}>
        {sbStyle === "aurora" && (
          <div className="sb-fx" aria-hidden="true"><i /><i /><span className="sb-grain" /></div>
        )}
        <div className="sb-brand">
          <div className="sb-brand-mark" aria-hidden="true" />
          <div className="logo"><img src="/termflow-icon.svg" alt="TermFlow" width={20} height={20} /></div>
          <div className="sb-brand-text">
            <div className="sb-brand-name">TermFlow {specialDay && <IndiaFlagIcon size={12} className="sb-brand-flag" />}</div>
            <div className="sb-brand-sub">
              <div>IIM Sambalpur</div>
              <div className="sb-brand-date">{termLabel}</div>
            </div>
            {termProgressPct != null && (
              <div className="sb-term-row" aria-hidden="true" title={termWeekInfo ? `${termWeekInfo.daysLeft} days left in term` : undefined}>
                <div className="sb-term-progress">
                  <div className="sb-term-progress-fill" style={{ width: `${termProgressPct}%` }} />
                </div>
                {termWeekInfo && <span className="sb-term-wk">WK {termWeekInfo.week}/{termWeekInfo.totalWeeks}</span>}
              </div>
            )}
          </div>
        </div>

        {isOffline && (
          <div style={{ margin: "0 16px 12px 16px", padding: "6px 8px", background: "rgba(231, 76, 60, 0.1)", border: "1px solid var(--danger)", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: sbCollapsed ? "center" : "flex-start", gap: "8px", color: "var(--danger)", fontSize: "11px", fontWeight: 700 }}>
            <CloudOff size={14} style={{ flexShrink: 0 }} /> {!sbCollapsed && <span>Offline Mode (Cached)</span>}
          </div>
        )}

        <div className="sb-scroll-body">
          <nav className="sb-nav">
            <button className="sb-search-btn" onClick={() => setCmdOpen(true)}>
              <div className="sb-search-left">
                <Search size={16} />
                <span className="sb-search-label">Search</span>
              </div>
              <span className="sb-search-shortcut">{isMac ? "⌘K" : "Ctrl K"}</span>
            </button>

            <div className="sb-nav-label">Schedule</div>
            <button className={`sb-link${view === "today" ? " on" : ""}`} aria-current={view === "today" ? "page" : undefined} onMouseEnter={e => showSbTip(e, "Today")} onMouseLeave={hideSbTip} onClick={() => { setView("today"); setCompareTarget(null); hideSbTip(); }}>
              <Clock size={18} /><span className="sb-link-label">Today</span>
            </button>
            <button className={`sb-link${view === "tomorrow" ? " on" : ""}`} aria-current={view === "tomorrow" ? "page" : undefined} onMouseEnter={e => showSbTip(e, "Tomorrow")} onMouseLeave={hideSbTip} onClick={() => { setView("tomorrow"); setCompareTarget(null); hideSbTip(); }}>
              <Sunrise size={18} /><span className="sb-link-label">Tomorrow</span>
            </button>

            <div className="sb-nav-label">Track</div>
            {enableAttendance && (
              <button className={`sb-link${view === "attendance" ? " on" : ""}`} aria-current={view === "attendance" ? "page" : undefined} onMouseEnter={e => showSbTip(e, "Attendance")} onMouseLeave={hideSbTip} onClick={() => { setView("attendance"); setCompareTarget(null); hideSbTip(); }}>
                <ClipboardList size={18} /><span className="sb-link-label">Attendance</span>
              </button>
            )}
            {enableExams && (
              <button className={`sb-link${view === "exams" ? " on" : ""}`} aria-current={view === "exams" ? "page" : undefined} onMouseEnter={e => showSbTip(e, "Exams")} onMouseLeave={hideSbTip} onClick={() => { setView("exams"); setCompareTarget(null); hideSbTip(); }}>
                <GraduationCap size={18} /><span className="sb-link-label">Exams</span>
              </button>
            )}
            {!IS_LITE && (
              <button className={`sb-link${view === "assignments" ? " on" : ""}`} aria-current={view === "assignments" ? "page" : undefined} onMouseEnter={e => showSbTip(e, "Assignments")} onMouseLeave={hideSbTip} onClick={() => { setView("assignments"); setCompareTarget(null); hideSbTip(); }}>
                <BookOpenCheck size={18} /><span className="sb-link-label">Assignments</span>
              </button>
            )}

            <div className="sb-nav-label">{IS_LITE ? "Compare" : "Campus"}</div>
            {!IS_LITE && (
              <button className={`sb-link${view === "notifications" ? " on" : ""}`} aria-current={view === "notifications" ? "page" : undefined} onMouseEnter={e => showSbTip(e, "Announcements")} onMouseLeave={hideSbTip} onClick={() => { setView("notifications"); setCompareTarget(null); hideSbTip(); }}>
                <Megaphone size={18} /><span className="sb-link-label">Announcements</span>
                {unreadChangeCount > 0 && <span className="nav-badge">{unreadChangeCount > 9 ? "9+" : unreadChangeCount}</span>}
              </button>
            )}
            {enableFriends && (
              <button className={`sb-link${view === "friends" ? " on" : ""}`} aria-current={view === "friends" ? "page" : undefined} onMouseEnter={e => showSbTip(e, IS_LITE ? "Compare" : "Social")} onMouseLeave={hideSbTip} onClick={() => { setView("friends"); setCompareTarget(null); markGroupsSeen(); markBadgeSeen("social"); hideSbTip(); }}>
                <Users size={18} /><span className="sb-link-label">{IS_LITE ? "Compare" : "Social"}</span> {!IS_LITE && showBadge("social") && <span className="beta-badge">Beta</span>}
                {unreadFriendCount > 0 && <span className="nav-badge">{unreadFriendCount > 9 ? "9+" : unreadFriendCount}</span>}
              </button>
            )}
            {!IS_LITE && (
              <button className={`sb-link${view === "board" ? " on" : ""}`} aria-current={view === "board" ? "page" : undefined} onMouseEnter={e => showSbTip(e, "Campus Board")} onMouseLeave={hideSbTip} onClick={() => { setView("board"); setCompareTarget(null); markBadgeSeen("board"); hideSbTip(); }}>
                <Package size={18} /><span className="sb-link-label">Campus Board</span> {showBadge("board") && <span className="beta-badge">New</span>}
              </button>
            )}

            {!showSbTools && recentToolViews.filter(v => v !== view && TOOLS_VIEWS.includes(v) && (v !== "split" || !IS_LITE) && (v !== "wrapped" || (!IS_LITE && wrappedActive))).length > 0 && (
              <>
                <div className="sb-nav-label">Recent</div>
                {recentToolViews.filter(v => v !== view && TOOLS_VIEWS.includes(v) && (v !== "split" || !IS_LITE) && (v !== "wrapped" || (!IS_LITE && wrappedActive))).map(v => {
                  const { icon: Icon, label } = TOOLS_VIEW_META[v];
                  return (
                    <button key={v} className="sb-link" onMouseEnter={e => showSbTip(e, label)} onMouseLeave={hideSbTip} onClick={() => { setView(v); setCompareTarget(null); hideSbTip(); }}>
                      <Icon size={18} /><span className="sb-link-label">{label}</span>
                    </button>
                  );
                })}
              </>
            )}

            {/* Mirrors the mobile ⋯ menu's Tools section — collapsed by default so
                the occasional-use pages don't flatten the nav's visual hierarchy.
                In lite the group is tiny (2 core items) so it renders expanded and
                non-collapsible. */}
            <button type="button" className="sb-tools-head" aria-expanded={showSbTools} onClick={() => { if (!sbCollapsed && !IS_LITE) setSbToolsOpen(o => !o); }}>
              <span className="sb-nav-label">Tools</span>
              {!sbCollapsed && !IS_LITE && <ChevronDown size={13} className={`sb-nav-caret${showSbTools ? " open" : ""}`} />}
            </button>
            {showSbTools && (<>
              <button className={`sb-link${view === "fullSchedule" ? " on" : ""}`} aria-current={view === "fullSchedule" ? "page" : undefined} onMouseEnter={e => showSbTip(e, "Full timetable")} onMouseLeave={hideSbTip} onClick={() => { setView("fullSchedule"); setCompareTarget(null); hideSbTip(); }}>
                <CalendarRange size={18} /><span className="sb-link-label">Full timetable</span>
              </button>
              {!IS_LITE && (
                <button className="sb-link" onMouseEnter={e => showSbTip(e, "Mess menu")} onMouseLeave={hideSbTip} onClick={() => { setMessMenuOpen(true); hideSbTip(); }}>
                  <UtensilsCrossed size={18} /><span className="sb-link-label">Mess menu</span>
                </button>
              )}
              {!IS_LITE && (
                <button className={`sb-link${view === "split" ? " on" : ""}`} aria-current={view === "split" ? "page" : undefined} onMouseEnter={e => showSbTip(e, "Split expenses")} onMouseLeave={hideSbTip} onClick={() => { setView("split"); setCompareTarget(null); markBadgeSeen("split"); hideSbTip(); }}>
                  <Wallet size={18} /><span className="sb-link-label">Split</span> {showBadge("split") && <span className="beta-badge">New</span>}
                </button>
              )}
              <button className={`sb-link${view === "leave" ? " on" : ""}`} aria-current={view === "leave" ? "page" : undefined} onMouseEnter={e => showSbTip(e, "Leave planner")} onMouseLeave={hideSbTip} onClick={() => { setView("leave"); setCompareTarget(null); hideSbTip(); }}>
                <CalendarOff size={18} /><span className="sb-link-label">Leave planner</span>
              </button>
              {!IS_LITE && wrappedActive && (
                <button className={`sb-link${view === "wrapped" ? " on" : ""}`} aria-current={view === "wrapped" ? "page" : undefined} onMouseEnter={e => showSbTip(e, "Term Wrapped")} onMouseLeave={hideSbTip} onClick={() => { setView("wrapped"); setCompareTarget(null); hideSbTip(); }}>
                  <Sparkles size={18} /><span className="sb-link-label">Term Wrapped</span>
                </button>
              )}
            </>)}
          </nav>

          {activeQuickLinks.length > 0 && (
            <div className="sb-quicklinks">
              <div className="sb-quicklinks-label">Quick Links</div>
              {activeQuickLinks.map(ql => (
                <a key={ql.id} className="sb-link sb-quicklink" href={ql.url} target="_blank" rel="noopener noreferrer" onMouseEnter={e => showSbTip(e, ql.title)} onMouseLeave={hideSbTip}>
                  <ExternalLink size={18} /><span className="sb-link-label">{ql.title}</span>
                </a>
              ))}
            </div>
          )}

          {showAdminUI && (
            <>
              <div className="sb-nav-label sb-nav-label-admin">Admin</div>
              <nav className="sb-nav sb-nav-static">
                <button className={`sb-link${view === "admin" ? " on" : ""}`} aria-current={view === "admin" ? "page" : undefined} onMouseEnter={e => showSbTip(e, "Admin Tools")} onMouseLeave={hideSbTip} onClick={() => { setView("admin"); setCompareTarget(null); hideSbTip(); }}>
                  <Shield size={18} /><span className="sb-link-label">Admin Tools</span>
                </button>
              </nav>
            </>
          )}
        </div>

        <div className="sb-bottom">
          <div className="sb-footer-card">
            {sbCollapsed ? (
              <>
                {renderSbUtilStrip()}
                <div className="sb-foot-sep" style={{ margin: "4px 8px" }} />
                {renderSbAvatarWrap()}
              </>
            ) : (
              <>
                {renderSbAvatarWrap()}
                <div className="sb-foot-sep" />
                {renderSbUtilStrip()}
                <div className="sb-sync-note">
                  <span className="sb-sync-dot" style={{ animationDuration: syncing ? "1s" : "3s" }} />
                  {syncing ? "Syncing…" : syncedAgo === 0 ? "Synced just now" : `Synced ${syncedAgo}m ago`}
                </div>
              </>
            )}
          </div>
        </div>

        {!isTablet && (
          <button
            className="sb-edge-handle sb-edge-tab"
            onMouseEnter={e => showSbTip(e, sidebarCollapsed ? "Expand" : "Collapse")}
            onMouseLeave={hideSbTip}
            onClick={() => { toggleSidebar(); hideSbTip(); }}
            aria-label="Toggle sidebar"
            aria-expanded={!sidebarCollapsed}
          >
            {sidebarCollapsed ? <ChevronsRight size={12} /> : <ChevronsLeft size={12} />}
          </button>
        )}
      </aside>

      {sbTip && createPortal(
        <div className="sb-float-tip" style={{ top: sbTip.top, left: sbTip.left }}>
          {sbTip.label}
        </div>,
        document.body
      )}

      <div className="app">
        <header className="bar">
          <div className="brand">
            <div className="logo"><img src="/termflow-icon.svg" alt="TermFlow" width={22} height={22} /></div>
            <div>
              <div className="brand-name">TermFlow</div>
              <div className="brand-sub">IIM Sambalpur · {termLabel}</div>
            </div>
          </div>
          <div className="bar-right" role="toolbar" aria-label="App actions">
            <div className="tb-wrap desktop-only">
              <button className="sync" onClick={() => setShowSetupEdit(true)} aria-label="Edit setup"><Settings2 size={15} /></button>
              <span className="tooltip" role="tooltip">Edit setup</span>
            </div>
            <div className="tb-wrap desktop-only">
              <button className="sync" onClick={handleSync} aria-label={syncing ? "Syncing…" : "Refresh"}>
                <RefreshCw size={15} className={syncing ? "spin-icon" : ""} />
              </button>
              <span className="tooltip" role="tooltip">{syncing ? "Syncing…" : "Refresh"}</span>
            </div>
            {enableAttendance && (
              <div className="tb-wrap desktop-only">
                <button className={`sync${view === "attendance" ? " sync-on" : ""}`} onClick={() => setView("attendance")} aria-label="Attendance" aria-pressed={view === "attendance"}>
                  <ClipboardList size={15} />
                </button>
                <span className="tooltip" role="tooltip">Attendance</span>
              </div>
            )}
            <div className="tb-wrap notif-wrap mobile-only">
              <button className="sync" onClick={() => setCmdOpen(true)} aria-label="Search" title="Search (Cmd+K)">
                <Search size={15} />
              </button>
              <span className="tooltip" role="tooltip">Search (Cmd+K)</span>
            </div>
            {/* Bell — always visible; single notification center */}
            {renderNotificationBell()}
            {/* Desktop-only: profile avatar */}
            <div className="tb-wrap over-wrap desktop-only" onMouseEnter={() => setProfileOpen(true)} onMouseLeave={() => setProfileOpen(false)}>
              <button className="sync profile-avatar-btn" onClick={() => setProfileOpen(o => !o)} aria-label="Profile" aria-expanded={profileOpen}>
                <UserAvatar user={user} size={30} />
              </button>
              <span className="tooltip" role="tooltip">Profile & Settings</span>
              {profileOpen && (
                <>
                  <div className="notif-backdrop" onClick={() => setProfileOpen(false)} />
                  <div className="over-menu">
                    <div className="over-profile">
                      <UserAvatar user={user} size={36} />
                      <div className="over-profile-info">
                        <span className="over-profile-name">{user?.fullName || "—"}</span>
                        <span className="over-profile-email">{user?.primaryEmailAddress?.emailAddress || "—"}</span>
                        <span className="over-profile-batch">PGP2 · 2025–27</span>
                      </div>
                    </div>
                    <div className="over-sep" />
                    <button aria-expanded={themeMenuOpen} onClick={() => setThemeMenuOpen(o => !o)}>
                      {theme === "dark" ? <Moon size={14} /> : theme === "light" ? <Sun size={14} /> : <Monitor size={14} />} Appearance
                      <ChevronDown size={13} className={`over-caret${themeMenuOpen ? " open" : ""}`} />
                    </button>
                    {themeMenuOpen && (
                      <div className="over-sub">
                        <button onClick={() => pickTheme("light")}>
                          <Sun size={14} /> Light
                          {theme === "light" && <Check size={14} className="over-check" />}
                        </button>
                        <button onClick={() => pickTheme("dark")}>
                          <Moon size={14} /> Dark
                          {theme === "dark" && <Check size={14} className="over-check" />}
                        </button>
                        <button onClick={() => pickTheme("system")}>
                          <Monitor size={14} /> System
                          {theme === "system" && <Check size={14} className="over-check" />}
                        </button>
                      </div>
                    )}
                    <div className="over-sep" />
                    <button onClick={() => { setWhatsNewOpen(true); setProfileOpen(false); }}>
                      <Sparkles size={14} /> What&rsquo;s New
                    </button>
                    <button onClick={() => { setFeedbackOpen(true); setProfileOpen(false); setOverflowOpen(false); }}>
                      <MessageSquare size={14} /> Submit Feedback
                    </button>
                    {isAdmin && (
                      <button onClick={() => { setAdminMode(!adminMode); setProfileOpen(false); }}>
                        {adminMode ? <User size={14} /> : <Shield size={14} />}
                        {adminMode ? "Exit Admin Mode" : "Enter Admin Mode"}
                      </button>
                    )}
                    <button className="over-danger" onClick={() => { signOut(); setProfileOpen(false); }}>
                      <LogOut size={14} /> Sign out
                    </button>
                    <div className="over-version">v{__APP_VERSION__.split("+")[0]}</div>
                  </div>
                </>
              )}
            </div>
            {/* Mobile-only: overflow ⋯ */}
            <div className="tb-wrap over-wrap mobile-only">
              <button className="sync" onClick={() => { setOverflowOpen(o => !o); setNavMenuOpen(false); }} aria-label="More options" aria-expanded={overflowOpen}>
                <MoreHorizontal size={15} />
              </button>
              {overflowOpen && (
                <>
                  <div className="notif-backdrop" onClick={() => setOverflowOpen(false)} />
                  <div className="over-menu">
                    <div className="over-profile">
                      <UserAvatar user={user} size={36} />
                      <div className="over-profile-info">
                        <span className="over-profile-name">{user?.fullName || "—"}</span>
                        <span className="over-profile-email">{user?.primaryEmailAddress?.emailAddress || "—"}</span>
                        <span className="over-profile-batch">PGP2 · 2025–27</span>
                      </div>
                    </div>
                    {/* ── Schedule ── */}
                    <div className="over-sep" />
                    <div className="over-section-label">Schedule</div>
                    <button className="mobile-only" onClick={() => { setFilterModalOpen(true); setOverflowOpen(false); }}>
                      <SlidersHorizontal size={14} /> Filter subjects
                    </button>
                    <button onClick={() => { setShowSetupEdit(true); setOverflowOpen(false); }}>
                      <Settings2 size={14} /> Edit setup
                    </button>

                    {/* ── Recent (Tools views visited recently, only while Tools itself
                         is collapsed — avoids showing the same item twice) ── */}
                    {!toolsSecOpen && recentToolViews.filter(v => v !== view && TOOLS_VIEWS.includes(v) && (v !== "split" || !IS_LITE) && (v !== "wrapped" || (!IS_LITE && wrappedActive))).length > 0 && (
                      <>
                        <div className="over-sep" />
                        <div className="over-section-label">Recent</div>
                        {recentToolViews.filter(v => v !== view && TOOLS_VIEWS.includes(v) && (v !== "split" || !IS_LITE) && (v !== "wrapped" || (!IS_LITE && wrappedActive))).map(v => {
                          const { icon: Icon, label } = TOOLS_VIEW_META[v];
                          return (
                            <button key={v} onClick={() => { setView(v); setCompareTarget(null); setOverflowOpen(false); }}>
                              <Icon size={14} /> {label}
                            </button>
                          );
                        })}
                      </>
                    )}

                    {/* ── Tools ── */}
                    <div className="over-sep" />
                    <button className="over-section-toggle" aria-expanded={toolsSecOpen} onClick={() => setToolsSecOpen(o => !o)}>
                      <span className="over-section-label">Tools</span>
                      <ChevronDown size={13} className={`over-caret${toolsSecOpen ? " open" : ""}`} />
                    </button>
                    {toolsSecOpen && (
                      <div className="over-section-body">
                        <button onClick={() => { setView("fullSchedule"); setCompareTarget(null); setOverflowOpen(false); }}>
                          <CalendarRange size={14} /> Full timetable
                        </button>
                        {!IS_LITE && (
                          <button onClick={() => { setMessMenuOpen(true); setOverflowOpen(false); }}>
                            <UtensilsCrossed size={14} /> Mess menu
                          </button>
                        )}
                        {!IS_LITE && (
                          <button onClick={() => { setView("split"); setCompareTarget(null); setOverflowOpen(false); }}>
                            <Wallet size={14} /> Split
                          </button>
                        )}
                        <button onClick={() => { setView("leave"); setCompareTarget(null); setOverflowOpen(false); }}>
                          <CalendarOff size={14} /> Leave planner
                        </button>
                        {!IS_LITE && (
                          <button onClick={() => { setView("board"); setCompareTarget(null); setOverflowOpen(false); }}>
                            <Package size={14} /> Campus Board
                          </button>
                        )}
                        {!IS_LITE && wrappedActive && (
                          <button onClick={() => { setView("wrapped"); setCompareTarget(null); setOverflowOpen(false); }}>
                            <Sparkles size={14} /> Term Wrapped
                          </button>
                        )}
                      </div>
                    )}

                    {/* ── Preferences ── */}
                    <div className="over-sep" />
                    <button className="over-section-toggle" aria-expanded={prefsSecOpen} onClick={() => setPrefsSecOpen(o => !o)}>
                      <span className="over-section-label">Preferences</span>
                      <ChevronDown size={13} className={`over-caret${prefsSecOpen ? " open" : ""}`} />
                    </button>
                    {prefsSecOpen && (
                      <div className="over-section-body">
                        <button aria-expanded={themeMenuOpen} onClick={() => setThemeMenuOpen(o => !o)}>
                          {theme === "dark" ? <Moon size={14} /> : theme === "light" ? <Sun size={14} /> : <Monitor size={14} />} Appearance
                          <ChevronDown size={13} className={`over-caret${themeMenuOpen ? " open" : ""}`} />
                        </button>
                        {themeMenuOpen && (
                          <div className="over-sub">
                            <button onClick={() => pickTheme("light")}>
                              <Sun size={14} /> Light
                              {theme === "light" && <Check size={14} className="over-check" />}
                            </button>
                            <button onClick={() => pickTheme("dark")}>
                              <Moon size={14} /> Dark
                              {theme === "dark" && <Check size={14} className="over-check" />}
                            </button>
                            <button onClick={() => pickTheme("system")}>
                              <Monitor size={14} /> System
                              {theme === "system" && <Check size={14} className="over-check" />}
                            </button>
                          </div>
                        )}
                        <button className="mobile-only" aria-expanded={navMenuOpen} onClick={() => setNavMenuOpen(o => !o)}>
                          <PanelsTopLeft size={14} /> Navigation
                          <ChevronDown size={13} className={`over-caret${navMenuOpen ? " open" : ""}`} />
                        </button>
                        {navMenuOpen && (
                          <div className="over-sub mobile-only">
                            <button onClick={() => { pickNavMode("bottom"); setOverflowOpen(false); setNavMenuOpen(false); }}>
                              <PanelBottom size={14} /> Show bottom nav
                              {mobileNavMode === "bottom" && <Check size={14} className="over-check" />}
                            </button>
                            <button onClick={() => { pickNavMode("top"); setOverflowOpen(false); setNavMenuOpen(false); }}>
                              <PanelTop size={14} /> Show top nav
                              {mobileNavMode === "top" && <Check size={14} className="over-check" />}
                            </button>
                            <button onClick={() => { pickNavMode("both"); setOverflowOpen(false); setNavMenuOpen(false); }}>
                              <PanelsTopLeft size={14} /> Show both
                              {mobileNavMode === "both" && <Check size={14} className="over-check" />}
                            </button>
                          </div>
                        )}
                        <button onClick={() => { setView("notifications"); setCompareTarget(null); setOverflowOpen(false); setNotifPrefsSignal(n => n + 1); }}>
                          <Bell size={14} /> Notification settings
                        </button>
                      </div>
                    )}

                    {/* ── About ── */}
                    <div className="over-sep" />
                    <button className="over-section-toggle" aria-expanded={aboutSecOpen} onClick={() => setAboutSecOpen(o => !o)}>
                      <span className="over-section-label">About</span>
                      <ChevronDown size={13} className={`over-caret${aboutSecOpen ? " open" : ""}`} />
                    </button>
                    {aboutSecOpen && (
                      <div className="over-section-body">
                        <button onClick={() => { setWhatsNewOpen(true); setOverflowOpen(false); }}>
                          <Sparkles size={14} /> What&rsquo;s New
                        </button>
                        <button onClick={() => { setFeedbackOpen(true); setProfileOpen(false); setOverflowOpen(false); }}>
                          <MessageSquare size={14} /> Submit Feedback
                        </button>
                      </div>
                    )}

                    {/* ── Admin (admins only) ── */}
                    {(showAdminUI || isAdmin) && (
                      <>
                        <div className="over-sep" />
                        <button className="over-section-toggle" aria-expanded={adminSecOpen} onClick={() => setAdminSecOpen(o => !o)}>
                          <span className="over-section-label">Admin</span>
                          <ChevronDown size={13} className={`over-caret${adminSecOpen ? " open" : ""}`} />
                        </button>
                        {adminSecOpen && (
                          <div className="over-section-body">
                            {showAdminUI && (
                              <button onClick={() => { setView("admin"); setCompareTarget(null); setOverflowOpen(false); }} style={{ color: "var(--live)" }}>
                                <Shield size={14} color="var(--live)" /> Admin Dashboard
                              </button>
                            )}
                            {isAdmin && (
                              <button onClick={() => { setAdminMode(!adminMode); setOverflowOpen(false); }}>
                                {adminMode ? <User size={14} /> : <Shield size={14} />}
                                {adminMode ? "Exit Admin Mode" : "Enter Admin Mode"}
                              </button>
                            )}
                          </div>
                        )}
                      </>
                    )}

                    <div className="over-sep" />
                    <button className="over-danger" onClick={() => { signOut(); setOverflowOpen(false); }}>
                      <LogOut size={14} /> Sign out
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        <div className="livebar mobile-only">
          <span className="live">
            <span className="pulse" /> Live · synced {syncedAgo === 0 ? "just now" : `${syncedAgo}m ago`}
          </span>
        </div>

        <div className="desk-layout" style={view === "friends" || view === "admin" ? { gridTemplateColumns: "1fr" } : {}}>
          <main className="main-col">
            {showTopTabs && (
            <div className="tabs-wrapper">
              <nav className={`tabs${showLeftScroll ? " tabs-scrolled" : ""}${showRightScroll ? " tabs-overflow-right" : ""}`} ref={tabsRef} onScroll={handleTabsScroll}>
                <button className={`tab ${view === "today" ? "on" : ""}`} aria-label="Today" onClick={() => { setView("today"); setCompareTarget(null); }}>
                  <Clock size={15} /> <span className="tab-label">Today</span>
                </button>
                <button className={`tab ${view === "tomorrow" ? "on" : ""}`} aria-label="Tomorrow" onClick={() => { setView("tomorrow"); setCompareTarget(null); }}>
                  <Sunrise size={15} /> <span className="tab-label">Tomorrow</span>
                </button>
                <button className={`tab tab-week ${view === "week" ? "on" : ""}`} aria-label="Week" onClick={() => { setView("week"); setCompareTarget(null); }}>
                  <Calendar size={15} /> <span className="tab-label">Week</span>
                </button>
                {enableAttendance && (
                  <button className={`tab ${view === "attendance" ? "on" : ""}`} aria-label="Attendance" onClick={() => { setView("attendance"); setCompareTarget(null); }}>
                    <ClipboardList size={15} /> <span className="tab-label">Attendance</span>
                  </button>
                )}
                {enableExams && (
                  <button className={`tab ${view === "exams" ? "on" : ""}`} aria-label="Exams" onClick={() => { setView("exams"); setCompareTarget(null); }}>
                    <GraduationCap size={15} /> <span className="tab-label">Exams</span>
                  </button>
                )}
                {!IS_LITE && (
                  <button className={`tab ${view === "notifications" ? "on" : ""}`} aria-label="Announcements" onClick={() => { setView("notifications"); setCompareTarget(null); }}>
                    <Megaphone size={15} /> <span className="tab-label">Announcements</span>
                    {unreadChangeCount > 0 && <span className="nav-badge">{unreadChangeCount}</span>}
                  </button>
                )}
                {!IS_LITE && (
                  <button className={`tab ${view === "assignments" ? "on" : ""}`} aria-label="Assignments" onClick={() => { setView("assignments"); setCompareTarget(null); }}>
                    <BookOpenCheck size={15} /> <span className="tab-label">Assignments</span>
                  </button>
                )}
                {enableFriends && (
                  <button className={`tab ${view === "friends" ? "on" : ""}`} aria-label={IS_LITE ? "Compare" : "Social"} onClick={() => { setView("friends"); setCompareTarget(null); markGroupsSeen(); markBadgeSeen("social"); }}>
                    <Users size={15} /> <span className="tab-label">{IS_LITE ? "Compare" : "Social"}</span> {!IS_LITE && showBadge("social") && <span className="beta-badge tab-label">Beta</span>}
                    {unreadFriendCount > 0 && <span className="nav-badge">{unreadFriendCount}</span>}
                  </button>
                )}
                {IS_LITE && (
                  <button className={`tab ${view === "fullSchedule" ? "on" : ""}`} aria-label="Full timetable" onClick={() => { setView("fullSchedule"); setCompareTarget(null); }}>
                    <CalendarRange size={15} /> <span className="tab-label">Timetable</span>
                  </button>
                )}
                {IS_LITE && (
                  <button className={`tab ${view === "leave" ? "on" : ""}`} aria-label="Leave planner" onClick={() => { setView("leave"); setCompareTarget(null); }}>
                    <CalendarOff size={15} /> <span className="tab-label">Leave</span>
                  </button>
                )}
              </nav>
            </div>
            )}



            {view !== "split" && view !== "attendance" && view !== "notifications" && view !== "exams" && view !== "friends" && view !== "fullSchedule" && view !== "assignments" && view !== "leave" && view !== "glance" && view !== "wrapped" && view !== "board" && !compareTarget && (
              <>
                {unseenWhatsNew.length > 0 && (
                  <WhatsNewPill item={unseenWhatsNew[0]} count={unseenWhatsNew.length} onOpen={() => setWhatsNewOpen(true)} />
                )}
                {activeGlobalAnnouncement && (
                  <div className="announcement-banner warning">
                    <Megaphone size={18} style={{ flexShrink: 0 }} />
                    <span style={{ fontSize: 14 }}>{activeGlobalAnnouncement}</span>
                  </div>
                )}
                {activeScheduledAnnouncements.map(a => {
                  const bannerClass = a.severity === "urgent" ? "urgent" : a.severity === "info" ? "info" : a.severity === "celebration" ? "celebration" : a.severity === "exam" ? "exam" : "warning";
                  return (
                  <div key={a.id} className={`announcement-banner ${bannerClass}`}>
                    <Megaphone size={18} style={{ flexShrink: 0 }} />
                    <span style={{ fontSize: 14, flex: 1 }}>{a.message}</span>
                    <button onClick={() => dismissAnnouncement(a.id)} aria-label="Dismiss announcement" style={{ background: "none", border: "none", cursor: "pointer", color: "inherit", display: "flex", padding: 2, flexShrink: 0 }}>
                      <X size={16} />
                    </button>
                  </div>
                  );
                })}
                {activeQuickLinks.length > 0 && (
                  <div className="ql-chips mobile-only">
                    {activeQuickLinks.map(ql => (
                      <a key={ql.id} className="ql-chip" href={ql.url} target="_blank" rel="noopener noreferrer">
                        <ExternalLink size={13} /> {ql.title}
                      </a>
                    ))}
                  </div>
                )}
                <div className="view-date-header">
                  <span className="vdh-label">
                    {view === "notifications" ? `${filteredChanges.length} update${filteredChanges.length !== 1 ? "s" : ""}`
                      : view === "week" ? weekRangeLabel : prettyDate(view === "tomorrow" ? tomorrowISO : todayISO)}
                    {view === "week" && weekOffset !== 0 && (
                      <button className="week-back-today" onClick={() => setWeekOffset(0)}>
                        <CalendarDays size={13} /> This week
                      </button>
                    )}
                  </span>
                  <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                      {/* Report Bug button moved to overflow menu */}
                    <button className="desktop-only vdh-filter-btn" onClick={() => setFilterModalOpen(true)}>
                      <SlidersHorizontal size={14} /> Filter subjects
                    </button>
                    <button
                      className="desktop-only vdh-filter-btn"
                      onClick={() => pickTheme(theme === "light" ? "dark" : theme === "dark" ? "system" : "light")}
                      aria-label={`Theme: ${theme} — click to change`}
                      title="Cycle theme: light → dark → system"
                    >
                      {theme === "dark" ? <Moon size={14} /> : theme === "light" ? <Sun size={14} /> : <Monitor size={14} />}
                      {theme === "system" ? "Auto" : theme === "dark" ? "Dark" : "Light"}
                    </button>
                    <WeatherWidget now={now} weather={weather} />
                  </div>
                </div>
              </>
            )}
            {view !== "split" && view !== "attendance" && view !== "notifications" && view !== "exams" && view !== "friends" && view !== "fullSchedule" && view !== "assignments" && view !== "leave" && view !== "glance" && view !== "wrapped" && view !== "board" && view !== "admin" && !compareTarget && view !== "tomorrow" && (
              view === "week"
                ? <div className="hide-mobile"><Hero current={current} next={next} now={now} todayISO={todayISO} tomorrowISO={tomorrowISO} premiumMode={premiumMode} onMarkAttendance={markAttendance} attendance={attendance} sysConfig={sysConfig} onTap={() => setView("fullSchedule")} todayList={todayList} /></div>
                : <Hero current={current} next={next} now={now} todayISO={todayISO} tomorrowISO={tomorrowISO} premiumMode={premiumMode} onMarkAttendance={markAttendance} attendance={attendance} sysConfig={sysConfig} onTap={() => setView("fullSchedule")} todayList={todayList} />
            )}
            {view === "week" && !compareTarget && (
              <div className="mobile-only">
                <WeekGlance visible={visible} now={now} offset={weekOffset} todayISO={todayISO} collapsible />
              </div>
            )}
            {(view === "today" || view === "tomorrow") && !compareTarget && (
              <CancellationAlert
                allClasses={CLASSES}
                enrolled={enrolled}
                mine={mine}
                legend={enrolledLegend}
                now={now}
                onOpen={(d) => { setJumpToSession({ date: d.date, code: d.code, start: d.time }); setView("fullSchedule"); }}
              />
            )}
            {(view === "today" || view === "tomorrow") && !compareTarget && isAwayNow(myAway, now) && (
              <button type="button" className="away-banner" onClick={() => { setView("leave"); setCompareTarget(null); }}>
                <CalendarOff size={16} />
                <span>
                  <strong>You&rsquo;re on leave</strong>
                  <span>Back on {fmtAwayEnd(myAway.to)}{IS_LITE ? "" : " · friends can see this too"}</span>
                </span>
                <span className="away-banner-go">Manage →</span>
              </button>
            )}
            {view === "today" && !compareTarget && !IS_LITE && wrappedActive && (
              <button type="button" className="wrapped-banner" onClick={() => { setView("wrapped"); setCompareTarget(null); }}>
                <Sparkles size={18} />
                <span>
                  <strong>Your Term, Wrapped</strong>
                  <span>Your semester in numbers — see your recap</span>
                </span>
                <span className="wrapped-banner-go">Open →</span>
              </button>
            )}
            {(view === "today" || view === "week") && !compareTarget && (
              <SemSummary
                enrolled={enrolled}
                legend={LEGEND}
                attendance={attendance}
                visible={visible}
                todayISO={todayISO}
                now={now}
                classes={CLASSES}
                onAttendanceClick={enableAttendance ? () => setView("attendance") : undefined}
                onExamsClick={enableExams ? () => setView("exams") : undefined}
                onSessionsClick={() => setView("fullSchedule")}
              />
            )}
            {view === "today" && !compareTarget && todayChangeCount > 0 && (
              <div className="tmrw-summary">
                <button type="button" className="tmrw-summary-changes" onClick={() => { setView("notifications"); setCompareTarget(null); }}>
                  <Bell size={13} />
                  {todayChangeCount} schedule update{todayChangeCount > 1 ? "s" : ""} for today's classes
                </button>
              </div>
            )}
            {view === "tomorrow" && (
              <TomorrowSummary
                list={tomorrowList}
                weather={weather}
                changeCount={tomorrowChangeCount}
                onViewChanges={() => { setView("notifications"); setCompareTarget(null); }}
              />
            )}
            {/* Compact "now" banner on Tomorrow tab so user knows what's happening today.
                `next` is the next class on ANY future date, so once today's classes are
                done it can point at tomorrow's (or a later day's) class — only show it
                here when it's actually still today's. */}
            {view === "tomorrow" && (current || (next && next.date === todayISO)) && (
              <button
                type="button"
                className={`now-banner${current ? "" : " is-next"}`}
                onClick={() => setView("today")}
                aria-label={`${current ? "Now" : "Up next"}: ${(current || next).name} at ${(current || next).start}. Go to Today.`}
              >
                <span className="now-banner-dot" />
                <span className="now-banner-label">{current ? "NOW" : "UP NEXT"}</span>
                <span className="now-banner-name">
                  <span className="now-banner-text">{(current || next).name}</span>
                  {(current || next).session && (
                    <span className={`ses ${subjectClass((current || next).code)}`}>
                      {(current || next).code} {(current || next).session}
                    </span>
                  )}
                </span>
                <span className="now-banner-time">{(current || next).start}{current ? `–${current.end}` : ""}</span>
                <span className="now-banner-go">Today →</span>
              </button>
            )}
            <div className={view === "week" ? "pane-today hide-mobile" : "pane-today"}>
              <Suspense fallback={<div className="loading-screen" style={{ minHeight: "300px" }}><TermFlowLoader size={48} /></div>}>
                {compareTarget
                  ? <CompareView
                    mode={compareTarget.mode}
                    friendData={compareTarget.friendData}
                    groupData={compareTarget.groupData}
                    myClasses={visible}
                    mine={mine}
                    allClasses={CLASSES}
                    enrolled={enrolled}
                    legend={enrolledLegend}
                    now={now}
                    onExit={() => setCompareTarget(null)}
                    onPlanSlot={enableMeetups ? (slot) => {
                      // Resolve invitee cloud ids from the compare target, then
                      // land on Social with the meetup modal prefilled
                      let memberCloudIds = [];
                      let groupId = null, groupName = null;
                      if (compareTarget.mode === "friend") {
                        if (compareTarget.friendData?.cloudId) memberCloudIds = [compareTarget.friendData.cloudId];
                      } else if (compareTarget.group) {
                        const g = compareTarget.group;
                        groupId = g.id; groupName = g.name;
                        memberCloudIds = g.isReceived
                          ? (g.cloudMemberIds || []).filter(cid => cid !== userId)
                          : (g.memberIds || []).map(id => friends.find(f => f.id === id)?.cloudId).filter(Boolean);
                      }
                      setPlanDraft({
                        date: slot.date || todayISO,
                        start: slot.start,
                        memberCloudIds,
                        groupId, groupName,
                      });
                      setCompareTarget(null);
                      setView("friends");
                    } : undefined}
                  />
                  : view === "friends"
                    ? <FriendsPanel
                      lite={IS_LITE}
                      userId={user?.id}
                      userName={user?.firstName || user?.username || "Student"}
                      enrolled={enrolled}
                      legend={LEGEND}
                      friends={friends}
                      setFriends={setFriends}
                      groups={groups}
                      setGroups={setGroups}
                      myClasses={visible}
                      allClasses={CLASSES}
                      now={now}
                      friendNotifItems={friendNotifItems}
                      onAcceptFriend={handleAcceptFriendRequest}
                      onDeclineFriend={handleDeclineFriendRequest}
                      statusEnabled={enableStatus}
                      onOpenLeave={() => { setView("leave"); setCompareTarget(null); }}
                      onCompare={(f) => setCompareTarget({ mode: "friend", friendData: f })}
                      onGroupCompare={(g) => {
                        let members;
                        if (g.isReceived && g.cloudMemberIds) {
                          members = g.cloudMemberIds
                            .filter(cid => cid !== userId)
                            .map(cid => friends.find(f => f.cloudId === cid))
                            .filter(Boolean)
                            .map(f => ({ name: f.name, courses: f.courses }));
                        } else {
                          members = (g.memberIds || []).map(id => friends.find(f => f.id === id)).filter(Boolean).map(f => ({ name: f.name, courses: f.courses }));
                        }
                        setCompareTarget({ mode: "group", groupData: { name: g.name, members }, group: g });
                      }}
                      meetupsEnabled={enableMeetups}
                      nudgeEnabled={enableFreeNudge}
                      awayEnabled={enableAwayShare}
                      planDraft={planDraft}
                      onPlanDraftConsumed={() => setPlanDraft(null)}
                    />
                    : view === "exams"
                      ? <ExamsPanel
                        allClasses={CLASSES}
                        enrolled={enrolled}
                        legend={enrolledLegend}
                        allCodes={Object.keys(LEGEND)}
                        now={now}
                        termNumber={TERM?.number}
                        termStart={TERM?.start}
                        termEnd={TERM?.end}
                        attendance={attendance}
                      />
                      : view === "attendance"
                        ? <AttendancePanel
                          allClasses={CLASSES}
                          now={now}
                          attendance={attendance}
                          enrolled={enrolled}
                          legend={enrolledLegend}
                          markAttendance={markAttendance}
                          weather={weather}
                          termNumber={TERM?.number}
                        />
                        : view === "notifications"
                          ? <NotificationsPage
                              allChanges={CHANGES}
                              myChanges={filteredChanges}
                              isAdmin={isAdmin}
                              userId={userId}
                              userName={user?.firstName || user?.username || "Student"}
                              legend={LEGEND}
                              readChangeKeys={readChangeKeys}
                              changeKeyOf={changeKey}
                              onMarkReadMany={markChangesRead}
                              onMarkAllRead={markAllChangesRead}
                              onOpenDate={(c) => { setJumpToSession({ date: c.date, code: c.code, start: c.start }); setView("fullSchedule"); }}
                              openPrefsSignal={notifPrefsSignal}
                            />
                          : view === "admin" && isAdmin
                            ? <AdminDashboard user={user} startImpersonation={startImpersonation} syncLogs={syncLogs} timeOverride={timeOverride} setTimeOverride={setTimeOverride} allChanges={CHANGES} />
                            : view === "fullSchedule"
                              ? <FullSchedulePage allClasses={CLASSES} enrolled={enrolled} legend={enrolledLegend} termLabel={termLabel} onBack={() => setView("today")} jumpToDate={jumpToDate} setJumpToDate={setJumpToDate} jumpToSession={jumpToSession} setJumpToSession={setJumpToSession} />
                              : view === "leave"
                                ? <LeavePlanner
                                    allClasses={CLASSES}
                                    enrolled={enrolled}
                                    legend={enrolledLegend}
                                    attendance={attendance}
                                    now={now}
                                    termStart={TERM?.start}
                                    termEnd={TERM?.end}
                                    onBack={() => { setView("today"); setCompareTarget(null); }}
                                    onOpenAttendance={enableAttendance ? () => { setView("attendance"); setCompareTarget(null); } : undefined}
                                    userId={userId}
                                    awayEnabled={enableAwayShare}
                                    onAwayChange={setMyAway}
                                  />
                              : view === "assignments"
                                ? <AssignmentsPanel enrolled={enrolled} legend={enrolledLegend} userId={userId} />
                              : view === "board"
                                ? <BoardPage
                                    userId={userId}
                                    userName={user?.firstName || user?.username || "Student"}
                                    isAdmin={isAdmin}
                                  />
                              : view === "split"
                                ? <SplitPage
                                    userId={userId}
                                    userName={user?.firstName || user?.username || "Student"}
                                    friends={friends}
                                    initialGroupId={splitDeepLink}
                                    initialJoinId={splitJoinLink}
                                    onConsumeDeepLink={() => { setSplitDeepLink(null); setSplitJoinLink(null); }}
                                  />
                              : view === "wrapped"
                                ? <WrappedView
                                    visible={visible}
                                    legend={enrolledLegend}
                                    attendance={attendance}
                                    now={now}
                                    termLabel={termLabel}
                                    userName={user?.firstName || user?.username || "Student"}
                                    onBack={() => { setView("today"); setCompareTarget(null); }}
                                  />
                              : view === "glance"
                                ? <GlanceView
                                    current={current}
                                    next={next}
                                    todayList={todayList}
                                    now={now}
                                    todayISO={todayISO}
                                    tomorrowISO={tomorrowISO}
                                    visible={visible}
                                    legend={enrolledLegend}
                                    onNavigate={(v) => { setView(v); setCompareTarget(null); }}
                                  />
                              : view === "tomorrow"
                                ? tomorrowList.length === 0 && premiumMode && syncing
                                  ? (
                                    <ul className="rail">
                                      <li className="row premium-skeleton" style={{ height: "80px", marginBottom: "12px", border: "none" }} />
                                      <li className="row premium-skeleton" style={{ height: "80px", marginBottom: "12px", border: "none", opacity: 0.7 }} />
                                    </ul>
                                  )
                                  : <Timeline list={tomorrowList} current={null} now={now} showNowLine={false} label="Tomorrow" dateLabel={prettyDate(tomorrowISO)} attendance={attendance} markAttendance={markAttendance} skipInfo={skipInfo} syncStatus={<span className="live"><span className="pulse" /> Live · synced {syncedAgo === 0 ? "just now" : `${syncedAgo}m ago`}</span>} onRefresh={handleSync} isSyncing={syncing} premiumMode={premiumMode} />
                              : todayList.length === 0 && tomorrowList.length === 0
                                ? premiumMode && syncing
                                  ? (
                                    <ul className="rail">
                                      <li className="row premium-skeleton" style={{ height: "80px", marginBottom: "12px", border: "none" }} />
                                      <li className="row premium-skeleton" style={{ height: "80px", marginBottom: "12px", border: "none", opacity: 0.7 }} />
                                      <li className="row premium-skeleton" style={{ height: "80px", marginBottom: "12px", border: "none", opacity: 0.4 }} />
                                    </ul>
                                  )
                                  : <div className="tmrw-summary-card tmrw-free-card" style={{ margin: "0 12px 20px" }}>
                                      <div className="tmrw-free-scene" aria-hidden="true">
                                        <div className="tmrw-free-sky sky-day sky-clear">
                                          <span className="tmrw-free-sun" />
                                          <span className="tmrw-free-cloud c1" />
                                          <span className="tmrw-free-cloud c2" />
                                          <span className="tmrw-free-spark s1" />
                                          <span className="tmrw-free-spark s2" />
                                          <span className="tmrw-free-spark s3" />
                                        </div>
                                      </div>
                                      <div className="tmrw-free-text">
                                        <div className="tmrw-free-title">No classes today!</div>
                                        <div className="tmrw-free-sub">Enjoy your free time.</div>
                                      </div>
                                    </div>
                                : <>
                                      <MarkPrompt list={todayList} now={now} attendance={attendance} markAttendance={markAttendance} />
                                      <Timeline list={todayList} current={current} now={now} dateLabel={prettyDate(todayISO)} attendance={attendance} markAttendance={markAttendance} skipInfo={skipInfo} syncStatus={<span className="live"><span className="pulse" /> Live · synced {syncedAgo === 0 ? "just now" : `${syncedAgo}m ago`}</span>} onRefresh={handleSync} isSyncing={syncing} premiumMode={premiumMode} />
                                    </>}
              </Suspense>
              {view === "today" && !compareTarget && !IS_LITE && <MessCard now={now} userId={userId} friends={enableStatus ? friends : []} />}
              {view === "tomorrow" && !compareTarget && !IS_LITE && (
                <div className="dl-section-wrap">
                  <DeadlineStrip
                    visible={visible}
                    legend={enrolledLegend}
                    now={now}
                    onOpenAssignments={() => { setView("assignments"); setCompareTarget(null); }}
                    onOpenExams={enableExams ? () => { setView("exams"); setCompareTarget(null); } : undefined}
                  />
                </div>
              )}
            </div>
          </main>
          <aside className={view !== "week" ? "side-col hide-mobile" : "side-col side-col-week"} style={view === "friends" || view === "admin" ? { display: "none" } : {}}>
            <WeekAgenda visible={visible} now={now} offset={weekOffset} setOffset={setWeekOffset} todayISO={todayISO} onViewFullSchedule={(iso) => { setJumpToDate(iso); setView("fullSchedule"); }} />
          </aside>

          {/* Floating Schedule button & Modal for the Friends and Admin views —
              the docked agenda is hidden there so the wide content gets the full
              row; desktop only (.fr-agenda-fab is display:none below 900px) */}
          {(view === "friends" || view === "admin" || view === "week") && (
            <>
              <button className={`fr-agenda-fab${view === "week" ? " week-fab" : ""}`} onClick={() => setShowFriendsAgenda(true)} title="View Schedule">
                <Calendar size={22} />
              </button>
              {showFriendsAgenda && (
                <div className="fs-modal-overlay hide-mobile" onClick={() => setShowFriendsAgenda(false)}>
                  <div className="fs-modal-content" style={{ width: 'min(760px, 92vw)', maxWidth: '92vw', padding: 0 }} onClick={e => e.stopPropagation()}>
                    <div className="fs-modal-header" style={{ padding: "16px 20px" }}>
                      <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, margin: 0, fontSize: 16 }}>
                        <Calendar size={18} color="var(--violet)" /> Schedule
                      </h3>
                      <button className="fs-modal-close" onClick={() => setShowFriendsAgenda(false)}><X size={18}/></button>
                    </div>
                    <div className="fs-modal-body" style={{ padding: "16px 20px", maxHeight: '82vh', overflowY: 'auto' }}>
                      <WeekAgenda visible={visible} now={now} offset={weekOffset} setOffset={setWeekOffset} todayISO={todayISO} onViewFullSchedule={(iso) => { setShowFriendsAgenda(false); setJumpToDate(iso); setView("fullSchedule"); }} />
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <footer className="foot">
          <span className="foot-credit">Auto-syncs from the live timetable sheet every few minutes</span>
          <span className="foot-credit">Built with <span className="foot-heart">♥</span> by <a href="https://www.linkedin.com/in/rakesh-kumar-behera-rk821604/" target="_blank" rel="noopener noreferrer" className="foot-credit-name">Rakesh</a></span>
        </footer>

        {/* Global Help Modal */}
        {helpModalOpen && (
          <div className="fs-modal-overlay" onClick={() => setHelpModalOpen(false)}>
            <div className="fs-modal-content" onClick={e => e.stopPropagation()}>
              
              <div className="fs-modal-header">
                <h3><BookOpenCheck size={20} color="var(--violet)" /> App Guide</h3>
                <button className="fs-modal-close" onClick={() => setHelpModalOpen(false)}><X size={18}/></button>
              </div>

              <div className="fs-modal-body">
                <div className="fs-help-hero">
                  <Sparkles size={32} color="var(--violet)" />
                  <h2>Welcome to your PGP2 Schedule</h2>
                  <p>Getting the hang of a new term can be chaotic. We built this app to make tracking your days, managing your time, and coordinating with friends as effortless as possible.</p>
                </div>
                
                <div className="fs-help-section">
                  <div className="fs-help-card">
                    <h3><Wand2 size={16} color="var(--violet)" /> Dashboard & Auto-Setup</h3>
                    <p>Automatically builds your schedule based on your enrolled electives. Tap the <Settings2 size={12} style={{ verticalAlign: "-1px" }} aria-hidden="true" /> gear icon anytime to drop or swap subjects. The dashboard always shows your Current and Next classes.</p>
                  </div>
                  <div className="fs-help-card">
                    <h3><BellRing size={16} color="var(--violet)" /> Live Updates</h3>
                    <p>Alerts you about room changes, cancellations, or reschedules. Tap the bell icon in the top right. It filters out the noise so you only see updates for your classes.</p>
                  </div>
                  <div className="fs-help-card">
                    <h3><CalendarDays size={16} color="var(--violet)" /> Full Schedule</h3>
                    <p>Click "View Full Schedule" on the dashboard to see every upcoming class for the entire term laid out cleanly.</p>
                  </div>
                  <div className="fs-help-card">
                    <h3><Users size={16} color="var(--violet)" /> Friend Sync</h3>
                    <p>Head to the Social tab, add your squad, and compare schedules side-by-side to find overlapping free slots. You can even form custom Groups!</p>
                  </div>
                  <div className="fs-help-card">
                    <h3><ClipboardList size={16} color="var(--violet)" /> Attendance Tracking</h3>
                    <p>Switch to the Attendance tab to log your presence or absences. It calculates your percentage automatically.</p>
                  </div>
                  <div className="fs-help-card">
                    <h3><GraduationCap size={16} color="var(--violet)" /> Assignments & Exams</h3>
                    <p>Use the Exams and Assignments tabs to see upcoming deadlines and midterms, filtered specifically for your enrolled subjects.</p>
                  </div>
                  <div className="fs-help-card">
                    <h3><Search size={16} color="var(--violet)" /> Quick Search</h3>
                    <p>Press <code>Ctrl+K</code> (or Cmd+K) anywhere in the app to open the Command Palette and instantly jump to any class or friend.</p>
                  </div>
                </div>

                <div className="fs-help-tip">
                  <strong><Zap size={12} style={{ verticalAlign: "-1px" }} aria-hidden="true" /> Pro Tip:</strong> You don't need to open your browser every time! Install this app directly to your phone's home screen for quick access. Just tap "Share" (iOS) or open the browser menu (Android) and select "Add to Home Screen".
                </div>
              </div>

            </div>
          </div>
        )}

        <Suspense fallback={null}>
          <CommandPalette
            isOpen={cmdOpen}
            onClose={() => setCmdOpen(false)}
            onViewChange={(v) => setView(v)}
            allClasses={CLASSES}
            friends={friends}
          />
        </Suspense>

        {filterModalOpen && (
          <div className="filter-modal-overlay" onClick={() => setFilterModalOpen(false)}>
            <div className="filter-modal-sheet" onClick={e => e.stopPropagation()}>
              <div className="filter-modal-header">
                <h3>Filter Subjects</h3>
                <button onClick={() => setFilterModalOpen(false)}><X size={18} /></button>
              </div>
              <div className="filter-modal-scroll">
                 <SubjectFilter legend={enrolledLegend} mine={mine} setMine={setMine} forceOpen={true} onEditSetup={() => { setShowSetupEdit(true); setFilterModalOpen(false); }} />
              </div>
            </div>
          </div>
        )}

        {feedbackOpen && (
          <Suspense fallback={null}>
            <FeedbackWidget user={user} onClose={() => setFeedbackOpen(false)} />
          </Suspense>
        )}

        {messMenuOpen && <MessMenuStandalone now={now} userId={userId} onClose={() => setMessMenuOpen(false)} />}

        {feedbackFlashTriggered && feedbackFlashConfig && (
          <Suspense fallback={null}>
            <FeedbackFlashToast 
              config={feedbackFlashConfig} 
              onClose={handleFeedbackFlashClose}
              onOpenFeedback={() => {
                handleFeedbackFlashClose();
                setFeedbackOpen(true);
              }}
            />
          </Suspense>
        )}

        {socialFlashToast && (
          <Suspense fallback={null}>
            <SocialFlashToast
              config={socialFlashToast}
              onClose={() => setSocialFlashToast(null)}
            />
          </Suspense>
        )}


        {/* ── Bottom nav (mobile) — floating glass dock, all views listed ── */}
        {showBottomNav && (
          <nav
            ref={bnavRef}
            className={`bnav${bnavCompact ? " bnav-compact" : ""}`}
            aria-label="Main navigation"
            onPointerDown={onBnavPointerDown}
            onPointerUp={onBnavPointerUp}
            onPointerCancel={onBnavPointerUp}
          >
            {bnavLens && (
              <span
                className="bnav-lens"
                aria-hidden="true"
                style={{ transform: `translateX(${bnavLens.x}px)`, width: bnavLens.w }}
              />
            )}
            <button className={`bnav-btn${view === "today" ? " on" : ""}`} aria-label="Today" aria-current={view === "today" ? "page" : undefined} onClick={() => { setView("today"); setCompareTarget(null); }}>
              <span className="bnav-icon"><Clock size={19} /></span>
            </button>
            <button className={`bnav-btn${view === "tomorrow" ? " on" : ""}`} aria-label="Tomorrow" aria-current={view === "tomorrow" ? "page" : undefined} onClick={() => { setView("tomorrow"); setCompareTarget(null); }}>
              <span className="bnav-icon"><Sunrise size={19} /></span>
            </button>
            <button className={`bnav-btn${view === "week" ? " on" : ""}`} aria-label="Week" aria-current={view === "week" ? "page" : undefined} onClick={() => { setView("week"); setCompareTarget(null); }}>
              <span className="bnav-icon"><Calendar size={19} /></span>
            </button>
            {enableAttendance && (
              <button className={`bnav-btn${view === "attendance" ? " on" : ""}`} aria-label="Attendance" aria-current={view === "attendance" ? "page" : undefined} onClick={() => { setView("attendance"); setCompareTarget(null); }}>
                <span className="bnav-icon"><ClipboardList size={19} /></span>
              </button>
            )}
            {enableExams && (
              <button className={`bnav-btn${view === "exams" ? " on" : ""}`} aria-label="Exams" aria-current={view === "exams" ? "page" : undefined} onClick={() => { setView("exams"); setCompareTarget(null); }}>
                <span className="bnav-icon"><GraduationCap size={19} /></span>
              </button>
            )}
            {!IS_LITE && (
              <button className={`bnav-btn${view === "notifications" ? " on" : ""}`} aria-label="Announcements" aria-current={view === "notifications" ? "page" : undefined} onClick={() => { setView("notifications"); setCompareTarget(null); }}>
                <span className="bnav-icon">
                  <Megaphone size={19} />
                  {unreadChangeCount > 0 && <span className="bnav-dot" />}
                </span>
              </button>
            )}
            {!IS_LITE && (
              <button className={`bnav-btn${view === "assignments" ? " on" : ""}`} aria-label="Assignments" aria-current={view === "assignments" ? "page" : undefined} onClick={() => { setView("assignments"); setCompareTarget(null); }}>
                <span className="bnav-icon"><BookOpenCheck size={19} /></span>
              </button>
            )}
            {enableFriends && (
              <button className={`bnav-btn${view === "friends" ? " on" : ""}`} aria-label={IS_LITE ? "Compare" : "Social"} aria-current={view === "friends" ? "page" : undefined} onClick={() => { setView("friends"); setCompareTarget(null); markGroupsSeen(); }}>
                <span className="bnav-icon">
                  <Users size={19} />
                  {unreadFriendCount > 0 && <span className="bnav-dot" />}
                </span>
              </button>
            )}
            {IS_LITE && (
              <button className={`bnav-btn${view === "leave" ? " on" : ""}`} aria-label="Leave planner" aria-current={view === "leave" ? "page" : undefined} onClick={() => { setView("leave"); setCompareTarget(null); }}>
                <span className="bnav-icon"><CalendarOff size={19} /></span>
              </button>
            )}
          </nav>
        )}
      </div>
    </div>
  );
}

const DOMAIN_BLOCKED_KEY = "pgp2.domain-blocked";

export default function App() {
  const { isSignedIn, isLoaded, user } = useUser();
  const { signOut } = useClerk();

  // Offline-First LCP Optimization: If we have a cached schedule, optimistically
  // assume the user is signed in to render the UI instantly. If Clerk finishes
  // verifying and they are actually signed out, it will correctly flip to <Login />.
  const hasCache = !!localStorage.getItem("pgp2-feed-cache");
  const optimisticSignIn = !isLoaded && hasCache;
  const effectiveIsSignedIn = isLoaded ? isSignedIn : optimisticSignIn;

  // Read flag set before the signOut redirect, then clear it immediately
  const [domainBlocked, setDomainBlocked] = useState(() => {
    const was = sessionStorage.getItem(DOMAIN_BLOCKED_KEY) === "1";
    if (was) sessionStorage.removeItem(DOMAIN_BLOCKED_KEY);
    return was;
  });

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !user) return;
    const email = user.primaryEmailAddress?.emailAddress || "";
    if (!email.toLowerCase().endsWith("@iimsambalpur.ac.in")) {
      // Persist flag before signOut() triggers a redirect that wipes React state
      sessionStorage.setItem(DOMAIN_BLOCKED_KEY, "1");
      signOut();
    }
  }, [isLoaded, isSignedIn, user, signOut]);

  if (domainBlocked) return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100dvh", gap: 16, padding: 32, textAlign: "center" }}>
      <ShieldAlert size={48} style={{ color: "#e74c3c" }} />
      <p style={{ margin: 0, fontWeight: 700, fontSize: 18 }}>Access Restricted</p>
      <p style={{ margin: 0, color: "var(--muted, #888)", fontSize: 14, maxWidth: 300, lineHeight: 1.6 }}>
        This app is only available to <strong>@iimsambalpur.ac.in</strong> email addresses.
      </p>
      <button
        onClick={() => setDomainBlocked(false)}
        style={{ marginTop: 8, padding: "9px 20px", borderRadius: 8, border: "1.5px solid var(--border, #ddd)", background: "none", cursor: "pointer", fontSize: 14, fontWeight: 600 }}
      >
        Sign in with a different account
      </button>
    </div>
  );

  return <AppCore isSignedIn={effectiveIsSignedIn} isLoaded={isLoaded} signOut={signOut} userId={user?.id} user={user} />;
}

export function DevApp() {
  return <AppCore isSignedIn={true} isLoaded={true} signOut={() => { }} userId={null} />;
}
