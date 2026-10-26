import { rememberSplitInvite, pendingSplitInvite, clearSplitInvite } from "./lib/splitInvite.js";
import { MORE_VIEWS, viewTitle } from "./lib/navItems.js";
import { memoryEvent } from "./lib/companionMemory.js";
import { useState, useEffect, useLayoutEffect, useCallback, useMemo, useRef, Suspense, lazy, startTransition } from "react";
import { createPortal } from "react-dom";
import { setNavView, useNavView, URL_VIEWS, urlWithView, scrollViewToTop } from "./lib/navView.js";
import { useBackClose } from "./lib/backClose.js";
import { useDialog, dialogProps } from "./hooks/useDialog.js";
import { announce } from "./lib/announce.js";
import BnavLens from "./components/BnavLens.jsx";
import SbFloatTip from "./components/SbFloatTip.jsx";
import { startPetMotionWatcher } from "./lib/petMotion.js";
import { Search, RefreshCw, Calendar, Clock, Sunrise, LogOut, Settings2, Bell, ClipboardList, GraduationCap, MoreHorizontal, Users, Megaphone, Shield, ShieldAlert, User, CloudOff, MessageSquare, X, SlidersHorizontal, BookOpenCheck, Sparkles, Wand2, BellRing, CalendarDays, ExternalLink, Download, Share, WifiOff, Zap, PanelBottom, PanelTop, PanelsTopLeft, Check, ChevronDown, Sun, Moon, Monitor, CalendarOff, CalendarRange, UtensilsCrossed, Package, Camera, Loader2, Wallet, Radio, History, PawPrint, LayoutDashboard } from "lucide-react";
import { useUser, useClerk } from "@clerk/clerk-react";
import Hero from "./components/Hero.jsx";
import DayGreeting from "./components/DayGreeting.jsx";
import SemSummary from "./components/SemSummary.jsx";
import Timeline from "./components/Timeline.jsx";
import WeekAgenda from "./components/WeekAgenda.jsx";
import ClassPrepSheet from "./components/ClassPrepSheet.jsx";
import TodayCommandCenter from "./components/TodayCommandCenter.jsx";
import TodayDashboard from "./components/TodayDashboard.jsx";
import { DashboardCustomize, ScheduleStatus } from "./components/DashboardExtras.jsx";
import { DEFAULT_DASHBOARD, dashboardCardVisible, readDashboardPrefs, saveDashboardPrefs } from "./lib/dashboardPrefs.js";
import ScheduleModal from "./components/ScheduleModal.jsx";
import { pushSessionFromParams } from "./lib/pushDeepLink.js";
import WeekGlance from "./components/WeekGlance.jsx";
import SubjectFilter from "./components/SubjectFilter.jsx";
import Login from "./components/Login.jsx";
import Onboarding from "./components/Onboarding.jsx";
import WeatherWidget from "./components/WeatherWidget.jsx";
import TomorrowSummary from "./components/TomorrowSummary.jsx";
import FreeDayIllustration from "./components/FreeDayIllustration.jsx";
import MessCard from "./components/MessCard.jsx";
import PetCameo from "./components/PetCameo.jsx";
import XpToast from "./components/XpToast.jsx";
import GlanceView from "./components/GlanceView.jsx";
import "./styles/wrapped.css"; // Wrapped entry-banner styles must exist on Today before the lazy view loads
import "./styles/pet.css"; // Pet toast & cameo styles must exist before the lazy view loads
import { MessMenuStandalone } from "./components/MessMenuModal.jsx";
import { setMessMenuOverrides } from "./data/messMenu.js";
import { fetchMessMenu } from "./lib/messFeed.js";
import { getSnapshot, fetchSchedule, sha256hex } from "./lib/sheet.js";
import { taughtSectionsByCode, provisionalSectionCodes, applyRosterAllocation, manualSectionCodes, unscheduledCodes } from "./lib/sections.js";
import { feedbackFlashAudience } from "./lib/feedbackFlash.js";
import { applyClassOverrides } from "./lib/overrides.js";
import { safeUrl } from "./lib/safeUrl.js";
import { toMin, fmtTime12, ymd, clsDate, prettyDate, timeAgo, getSpecialDay } from "./lib/datetime.js";
import { fetchConsensusWeather } from "./lib/weather.js";
import {
  swUpdateIsStale, clearSwSeen,
  LAST_USER_KEY, VIEW_KEY, PENDING_INVITE_KEY, USER_SCOPED_KEYS,
  readSetup, saveSetup, SETUP_KEY,
  NOTIF_KEY, loadLastSeen, READ_PINGS_KEY,
  READ_CHANGES_KEY, loadClearedGroups,
} from "./lib/appStorage.js";
import TermFlowLoader from "./components/TermFlowLoader.jsx";
import IndiaFlagIcon from "./components/IndiaFlagIcon.jsx";
import DesktopSidebar from "./components/DesktopSidebar.jsx";
import NavIcon from "./components/mobile/NavIcon.jsx";
import { ARCHIVED_TERMS } from "./data/archive/index.js";

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
const PetPage = lazy(() => import("./components/PetPage.jsx"));
const StudentPlanner = lazy(() => import("./components/StudentPlanner.jsx"));
const CourseHub = lazy(() => import("./components/CourseHub.jsx"));
const CalendarExportModal = lazy(() => import("./components/CalendarExportModal.jsx"));
// Fetch a destination only when someone aims at its navigation row. This
// removes the first-visit loader for common pages without loading every page
// during startup.
const viewPreloaders = {
  attendance: () => import("./components/AttendancePanel.jsx"),
  exams: () => import("./components/ExamsPanel.jsx"),
  assignments: () => import("./components/AssignmentsPanel.jsx"),
  fullSchedule: () => import("./components/FullSchedulePage.jsx"),
  courseHub: () => import("./components/CourseHub.jsx"),
  planner: () => import("./components/StudentPlanner.jsx"),
  notifications: () => import("./components/NotificationsPage.jsx"),
  friends: () => import("./components/FriendsPanel.jsx"),
  board: () => import("./components/BoardPage.jsx"),
  split: () => import("./components/SplitPage.jsx"),
  leave: () => import("./components/StudentPlanner.jsx"),
  wrapped: () => import("./components/WrappedView.jsx"),
  admin: () => import("./components/AdminDashboard.jsx"),
  pet: () => import("./components/PetPage.jsx"),
};
const preloadView = (view) => { viewPreloaders[view]?.().catch(() => {}); };
import DeadlineStrip from "./components/DeadlineStrip.jsx";
import CancellationAlert from "./components/CancellationAlert.jsx";
import ProvisionalSectionNotice from "./components/ProvisionalSectionNotice.jsx";
import { loadMyAway, isAwayNow, fmtAwayEnd } from "./lib/status.js";
import { loadAttendance, saveAttendance, sessionKey, syncAttendanceFromCloud, pushMark, courseSkipStats } from "./lib/attendance.js";
import { recordFeatureUse } from "./lib/featureUsage.js";
import { usePet } from "./hooks/usePet.js";
import { EXAM_HORIZON_DAYS, isAdopted } from "./lib/pet.js";
import { assignmentDueToday } from "./lib/insights.js";
import { syncProfileFromCloud, pushProfile, stampProfileEmail } from "./lib/profile.js";
import { syncMigrationMap } from "./lib/migrationMap.js";
import { useMigration } from "./lib/useMigration.js";
import MigrationBanner from "./components/MigrationBanner.jsx";
import { CalendarEventBadgeSVG } from "./components/CalendarSVGs.jsx";
import { decodeSchedule, saveFriend, loadFriends, loadGroups, syncFriendsAndGroupsFromCloud, pushFriendsToCloud, deleteFriendPing, removeFriendByCloudId, sendFriendPing, hasPendingFriendRequest, getOrCreateShareCode } from "./lib/friends.js";
import { supabase } from "./lib/supabase.js";
import { fetchNotifications, subscribeToNotifications, markNotificationRead } from "./lib/notifications.js";
import { assignSubjectColors, subjectClass } from "./lib/subjectColors.js";
import { haptic } from "./lib/haptics.js";
import { useSidebar } from "./hooks/useSidebar.js";
import { useMobileUiVersion } from "./hooks/useMobileUiVersion.js";
import { useNotifications, buildNotificationHandlers } from "./hooks/useNotifications.js";
import MarkPrompt from "./components/MarkPrompt.jsx";
import { WhatsNewPill, WhatsNewModal } from "./components/WhatsNew.jsx";
import { resizeImage } from "./lib/board.js";
import MobileUiVersionMenu from "./components/mobile/MobileUiVersionMenu.jsx";
import MobileV2TabBar from "./components/mobile/MobileV2TabBar.jsx";
import MobileV2Switcher from "./components/mobile/MobileV2Switcher.jsx";
import MobileV2MorePage from "./components/mobile/MobileV2MorePage.jsx";
import MobileV2Breadcrumbs from "./components/mobile/MobileV2Breadcrumbs.jsx";
import "./styles/mobile-v2.css";
import "./styles/tablet-layout.css";
import "./styles/tomorrow-timeline.css";

const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent || "");

// Views that live behind the sidebar's collapsed Tools accordion / the
// mobile overflow menu's Tools section — candidates for the "Recent" row.
// Mobile overflow-sheet Tools section (and its "Recent" shortcut). The desktop
// sidebar moved to lib/navItems.js and regrouped — Full timetable is a Schedule
// view there — so these two deliberately keep the older mobile grouping until
// the sheet is migrated onto the same config.
const TOOLS_VIEWS = ["fullSchedule", "courseHub", "planner", "split", "wrapped", "pet"];
const TOOLS_VIEW_META = {
  courseHub:    { icon: BookOpenCheck, label: "Courses" },
  planner:      { icon: LayoutDashboard, label: "Personal planner" },
  fullSchedule: { icon: CalendarRange, label: "Full timetable" },
  split:        { icon: Wallet,        label: "Split" },
  wrapped:      { icon: Sparkles,      label: "Term Wrapped" },
  pet:          { icon: PawPrint,      label: "Companion" },
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

// Mobile tab / dock button. Reads the nav store rather than App's `view`, so
// it highlights on the tap itself while the page renders in a transition.
function NavButton({ nav, className, children, onClick, ...rest }) {
  const on = useNavView() === nav;
  return (
    <button className={`${className}${on ? " on" : ""}`} aria-current={on ? "page" : undefined}
      onClick={(e) => { if (on) scrollViewToTop(); onClick?.(e); }} {...rest}>
      {children}
    </button>
  );
}

function AppCore({ isSignedIn, isLoaded, signOut, userId, user }) {
  const userEmail = user?.primaryEmailAddress?.emailAddress?.toLowerCase();
  const isAdmin = userEmail && ADMIN_EMAILS.includes(userEmail);
  // Defaults on: it is never persisted, so a false start only creates a window
  // where an admin looks like a normal user and gets bounced out of the admin
  // view before Clerk has resolved who they are.
  const [adminMode, setAdminMode] = useState(true);
  useEffect(() => { if (isAdmin) setAdminMode(true); }, [isAdmin]);
  // `user` is undefined until Clerk loads and null when there is definitively
  // no user, so `isAdmin` reads false for the first few renders of every
  // refresh. Anything that revokes admin access has to wait for this.
  const identityResolved = isLoaded && (!isSignedIn || user !== undefined);
  const [dashboardPrefs, setDashboardPrefs] = useState(readDashboardPrefs);
  const [classPrepSession, setClassPrepSession] = useState(null);
  const todayFocusMode = dashboardPrefs.focusMode;
  const setTodayFocusMode = useCallback((focusMode) => setDashboardPrefs((prefs) => ({ ...prefs, focusMode })), []);
  const closePrepSheet = useCallback(() => setClassPrepSession(null), []);
  useEffect(() => { saveDashboardPrefs(dashboardPrefs); }, [dashboardPrefs]);

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
      setDashboardPrefs(DEFAULT_DASHBOARD);
      setClassPrepSession(null);
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

  const showAdminUI = isAdmin && adminMode;
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
  // One-time nudge pointing students at a term's Wrapped recap once it archives.
  const [seenWrappedNudges, setSeenWrappedNudges] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem("pgp2.seen-wrapped-nudge") || "[]")); } catch { return new Set(); }
  });
  function dismissWrappedNudge(termNumber) {
    setSeenWrappedNudges(prev => {
      const next = new Set(prev);
      next.add(termNumber);
      try { localStorage.setItem("pgp2.seen-wrapped-nudge", JSON.stringify([...next])); } catch { }
      return next;
    });
  }
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
  const [view, setViewState] = useState(() => {
    let v = "today";
    try {
      // A ?view= URL (refresh, shared link, new tab) wins over the last view.
      const fromUrl = new URLSearchParams(window.location.search).get("view");
      if (fromUrl && URL_VIEWS.has(fromUrl)) v = fromUrl;
      else {
        v = localStorage.getItem(VIEW_KEY) || "today";
        if (v === "courses") v = "exams"; // retired view → its new home
        if (v === "insights") v = "today"; // retired view
        if (v === "glance") v = "today"; // peek surface, never sticky
      }
      if (v === "leave") v = "planner"; // leave planning now lives inside Planner
    } catch { }
    setNavView(v);
    return v;
  });
  const [plannerSection, setPlannerSection] = useState(() => {
    try {
      if (new URLSearchParams(window.location.search).get("view") === "leave") return "leave";
      return localStorage.getItem(VIEW_KEY) === "leave" || localStorage.getItem("pgp2.planner-section") === "leave" ? "leave" : "schedule";
    } catch { return "schedule"; }
  });
  useEffect(() => {
    try { localStorage.setItem("pgp2.planner-section", plannerSection); } catch { /* optional UI preference */ }
  }, [plannerSection]);
  // The course open in Course Hub. It lives in the URL (?course=) and on the
  // history entry too, so back, refresh and shared links reopen that course.
  const [courseHubCode, setCourseHubCode] = useState(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      return params.get("view") === "courseHub" ? params.get("course") : null;
    } catch { return null; }
  });
  const courseHubCodeRef = useRef(courseHubCode);
  const [assignmentOpenTarget, setAssignmentOpenTarget] = useState(null);
  useEffect(() => { if (view !== "courseHub") setCourseHubCode(null); }, [view]);
  useEffect(() => { if (view !== "assignments") setAssignmentOpenTarget(null); }, [view]);
  const currentViewRef = useRef(view);
  // True for the rest of the event that called setView: nav handlers follow
  // setView(x) with setCompareTarget(null), and that clear has to land in the
  // same transition — urgently, it would first commit the OLD page without
  // compare (a flash of e.g. the full Social page) before the new view.
  const navInFlightRef = useRef(false);
  useEffect(() => { startPetMotionWatcher(); }, []);
  // Scroll position the next committed view should open at: 0 for a new page,
  // the saved offset when back/forward returns to one.
  const pendingScrollRef = useRef(null);
  // Set by setView: once the new page commits, focus moves to it so screen
  // readers announce the page and keyboard users continue from its top.
  const focusPageRef = useRef(false);
  const setView = useCallback((nextView, { fromHistory = false, scrollY = 0 } = {}) => {
    const requested = typeof nextView === "function"
      ? nextView(currentViewRef.current)
      : nextView;
    const target = requested === "leave" ? "planner" : requested;
    if (requested === "leave") setPlannerSection("leave");
    const previous = currentViewRef.current;
    if (!target || target === previous) return;

    // Each view change is a history entry, so the device/browser back button
    // retraces the views visited instead of closing the app. A change that
    // came from back/forward itself must not push again. The page being left
    // keeps its scroll offset on its own entry, for when back returns to it.
    //
    // Navigating from inside a popup (command palette, compare, a sheet's
    // link) takes over the popup's entry rather than stacking on it: the
    // popup is closing anyway, and a leftover entry would make a later back
    // press land on it and do nothing.
    if (!fromHistory) {
      try {
        if (window.history.state?.tfPopup) {
          window.history.replaceState({ tfView: target }, "", urlWithView(target));
        } else {
          window.history.replaceState({ ...window.history.state, tfScroll: window.scrollY }, "");
          window.history.pushState({ tfView: target }, "", urlWithView(target));
        }
      } catch { }
    }
    pendingScrollRef.current = fromHistory ? scrollY : 0;
    focusPageRef.current = true;
    currentViewRef.current = target;
    // The highlight moves now; the page renders as an interruptible
    // transition. (This used to be startViewTransition + flushSync, which
    // froze the screen for the whole render — 100ms+ on Today, far more on
    // Full timetable — before the crossfade could even start.) The keyed
    // .tf-page-stage plays the enter animation once the new page commits.
    setNavView(target);
    startTransition(() => setViewState(target));
    navInFlightRef.current = true;
    queueMicrotask(() => { navInFlightRef.current = false; });
  }, []);
  useLayoutEffect(() => {
    if (focusPageRef.current) {
      focusPageRef.current = false;
      document.querySelector(".tf-page-stage")?.focus({ preventScroll: true });
    }
    const y = pendingScrollRef.current;
    if (y == null) return;
    pendingScrollRef.current = null;
    window.scrollTo(0, y);
    // Lazy sections may still be filling in the page; settle once they have.
    if (y > 0) requestAnimationFrame(() => requestAnimationFrame(() => window.scrollTo(0, y)));
  }, [view]);
  useEffect(() => {
    courseHubCodeRef.current = courseHubCode;
    if (view !== "courseHub") return;
    try {
      window.history.replaceState(
        { ...window.history.state, tfCourse: courseHubCode || undefined },
        "",
        urlWithView("courseHub", { course: courseHubCode }),
      );
    } catch { }
  }, [view, courseHubCode]);
  // Picking a course inside Course Hub is a step of its own: back returns to
  // the course list (at its old scroll), as does the in-page "All courses".
  const selectHubCourse = useCallback((code) => {
    if (code) {
      try {
        window.history.replaceState({ ...window.history.state, tfScroll: window.scrollY }, "");
        window.history.pushState({ tfView: "courseHub", tfCourse: code, tfCourseDrill: true }, "", urlWithView("courseHub", { course: code }));
      } catch { }
      setCourseHubCode(code);
      window.scrollTo(0, 0);
    } else if (window.history.state?.tfCourseDrill) {
      window.history.back(); // popstate restores the list and its scroll
    } else {
      setCourseHubCode(null); // opened straight into a course: nothing to go back to
    }
  }, []);
  // Glance is a shortcut peek, not a destination — don't make it the view the
  // app re-opens on next launch.
  useEffect(() => { if (view !== "glance") { try { localStorage.setItem(VIEW_KEY, view); } catch { } } }, [view]);
  useEffect(() => { if (view === "notifications") recordFeatureUse(userId, "announcements_view"); }, [view, userId]);
  // Which term's schedule is being browsed — defaults to the live term; can be
  // switched to an archived term for read-only browsing (see `activeTerm` etc.
  // below, derived once `sd`/TERM are known).
  const TERM_KEY = "pgp2.selected-term";
  const TERM_LIVE_KEY = "pgp2.selected-term-live"; // live term at time of selection
  const [selectedTerm, setSelectedTerm] = useState(() => {
    try {
      // A stored selection is only honored if (a) the live term hasn't rolled
      // over since it was made, and (b) it names a currently-archived term.
      // Otherwise fall back to null → the live term. This keeps the live term
      // the default and stops a returning user whose old selection pointed at
      // the previous (then-live) term from landing on that term's archive.
      const storedLive = localStorage.getItem(TERM_LIVE_KEY);
      if (storedLive !== (TERM?.number ?? null)) return null;
      const stored = localStorage.getItem(TERM_KEY);
      if (!stored || stored === TERM?.number) return null;
      return ARCHIVED_TERMS.some(t => t.number === stored) ? stored : null;
    } catch { return null; }
  });
  useEffect(() => {
    try {
      localStorage.setItem(TERM_LIVE_KEY, TERM?.number ?? "");
      if (selectedTerm) localStorage.setItem(TERM_KEY, selectedTerm);
      else localStorage.removeItem(TERM_KEY);
    } catch { }
  }, [selectedTerm]);
  useEffect(() => {
    // Without the guard this fires on first paint of a refresh, sending the
    // admin back to Today and overwriting the stored view before Clerk has
    // even reported who is signed in.
    if (!identityResolved) return;
    if (!showAdminUI) {
      if (view === "admin") setView("today");
      setTimeOverride(null);
    }
  }, [view, showAdminUI, identityResolved, setView]);
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
  // Enrollment snapshots for archived terms, keyed by term number (e.g. { "IV": { CODE: section, ... } }).
  // Populated from the cloud profile's `_archivedCourses`; unused until a term switch happens.
  const [archivedCourses, setArchivedCourses] = useState({});
  const [setup, setSetup] = useState(() => readSetup());
  // Set when Onboarding is forced open because the live term rolled over and
  // last term's course picks are now stale (see enrollmentStale below) — lets
  // Onboarding show "Term rolled over" copy instead of the generic first-time
  // setup screen.
  const [reonboardFromTerm, setReonboardFromTerm] = useState(null);
  const [cloudEnrolledTerm, setCloudEnrolledTerm] = useState(null);
  const [allocationApplied, setAllocationApplied] = useState(false);
  const [prefillPicked, setPrefillPicked] = useState(null);
  const [showSetupEdit, setShowSetupEdit] = useState(false);
  // Edit-enrollment is a live-only action — guarded below (after isArchivedView
  // is known) via openEditSetup(), used at every "Edit setup" entry point instead
  // of calling setShowSetupEdit(true) directly.
  const [syncedAt, setSyncedAt] = useState(new Date());
  const notifOpenedAt = useRef(0);
  const notifLastTriggerRef = useRef(null);
  const [, setLastSeenTs] = useState(() => loadLastSeen());
  const {
    notifOpen, setNotifOpen, notifFilter, setNotifFilter,
    readPingIds, setReadPingIds, readChangeKeys, setReadChangeKeys,
    seenRecvGroupIds, setSeenRecvGroupIds, pings, setPings, alerts, setAlerts,
  } = useNotifications();
  useEffect(() => {
    if (!notifOpen) return undefined;
    notifLastTriggerRef.current?.closest(".notif-wrap")?.querySelector(".notif-panel-close")?.focus();
    const onEscape = (event) => {
      if (event.key !== "Escape") return;
      setNotifOpen(false);
      notifLastTriggerRef.current?.focus();
    };
    document.addEventListener("keydown", onEscape);
    return () => document.removeEventListener("keydown", onEscape);
  }, [notifOpen, setNotifOpen]);
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
  // Pet companion. Local copy paints immediately; the hook reconciles with the
  // `pet_state` row and merges anything earned offline. See lib/pet.js.
  const { pet: myPet, actions: petActions, moment: petMoment, gained: petGained, memory: companionMemory, XP: petXP, keyFor: petKeyFor } = usePet(userId, { xpRate: sysConfig?.flags?.greetingPets?.xpRate });
  const [syncing, setSyncing] = useState(false);
  const [overflowOpen, setOverflowOpen] = useState(false);
  const { mobileUiVersion, setMobileUiVersion, supportsV2: compactViewport, v2Active } = useMobileUiVersion();
  const [mobileV2MoreOpen, setMobileV2MoreOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [greetingPetsEnabled, setGreetingPetsEnabled] = useState(() => {
    try { return localStorage.getItem("pgp2.greeting-pets-enabled") !== "false"; } catch { return true; }
  });
  const toggleGreetingPets = () => setGreetingPetsEnabled(value => {
    const next = !value;
    try { localStorage.setItem("pgp2.greeting-pets-enabled", String(next)); } catch { /* blocked storage */ }
    return next;
  });
  const [sbProfileOpen, setSbProfileOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [filterModalOpen, setFilterModalOpen] = useState(false);
  const [calendarModalOpen, setCalendarModalOpen] = useState(false);
  const [calendarModalConfig, setCalendarModalConfig] = useState(null);
  const openCalendarExport = useCallback((config = null) => {
    setCalendarModalConfig(config);
    setCalendarModalOpen(true);
  }, []);
  const [weather, setWeather] = useState(null);
  const [cloudChecked, setCloudChecked] = useState(false);
  const [clearedGroupIds, setClearedGroupIds] = useState(() => loadClearedGroups());
  const [friends, setFriends] = useState(() => loadFriends());
  const [groups, setGroups] = useState(() => loadGroups());
  const [compareTarget, setCompareTargetState] = useState(null); // { mode, friendData?, groupData? }
  const setCompareTarget = useCallback((next) => {
    if (navInFlightRef.current) startTransition(() => setCompareTargetState(next));
    else setCompareTargetState(next);
  }, []);
  // Back/forward: restore the view stored on that history entry. The launch
  // entry is tagged with the starting view so backing out of the first page
  // lands there before the app closes.
  useEffect(() => {
    try {
      // Scroll is restored per view by setView, not by the browser.
      window.history.scrollRestoration = "manual";
      const view = currentViewRef.current;
      const course = view === "courseHub" ? courseHubCodeRef.current : null;
      window.history.replaceState({ ...window.history.state, tfView: view }, "", urlWithView(view, { course }));
    } catch { }
    const onPop = (e) => {
      const v = e.state?.tfView;
      if (!v) return;
      const course = v === "courseHub" ? e.state.tfCourse ?? null : null;
      if (v === currentViewRef.current) {
        // Course Hub list <-> course. Any other same-view pop is a popup
        // closing (see lib/backClose.js): leave compare and scroll be.
        if (v === "courseHub" && course !== courseHubCodeRef.current) {
          setCourseHubCode(course);
          const y = e.state.tfScroll || 0;
          requestAnimationFrame(() => requestAnimationFrame(() => window.scrollTo(0, y)));
        }
        return;
      }
      if (v === "courseHub") setCourseHubCode(course);
      setView(v, { fromHistory: true, scrollY: e.state?.tfScroll || 0 });
      setCompareTarget(null);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [setView, setCompareTarget]);
  // Comparing with a friend/group fills the page like a page of its own, so
  // back closes it and returns to Social (it rides the popup history stack).
  useBackClose(() => setCompareTarget(null), !!compareTarget);
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
  useEffect(() => { if (typeof friendToast === "string") announce(friendToast); }, [friendToast]);
  // XP toast queue: each item is { id, xp, label, firstOfDay }. The head of the
  // queue is shown; when it calls onDone the head is shifted off and the next
  // item (if any) mounts. This keeps toasts sequential even when several
  // attendance rows are marked quickly.
  const [xpToastQueue, setXpToastQueue] = useState([]);
  if (import.meta.env.DEV && typeof window !== "undefined") {
    window.__triggerXpToast = (xp = 32, label = "attendance", firstOfDay = true) => {
      setXpToastQueue(q => [...q, { id: Date.now(), xp, label, firstOfDay }]);
    };
  }
  // A companion unlocked while the student was here (level OR devotion) joins
  // the same queue, so it waits its turn behind the XP pill that earned it.
  useEffect(() => {
    if (!petGained.length) return;
    const key = petGained[0];
    petActions.dismissGained();
    // Same switches as enableCompanion (declared further down this component).
    const pets = sysConfig?.flags?.greetingPets;
    if (pets?.enabled === false || pets?.companion === false || !greetingPetsEnabled || myPet?.companionEnabled === false) return;
    setXpToastQueue(q => [...q, { id: `unlock:${key}`, unlock: key }]);
  }, [petGained, petActions, sysConfig?.flags?.greetingPets, greetingPetsEnabled, myPet?.companionEnabled]);
  const [pendingInvite, setPendingInvite] = useState(null);
  const [pendingGroupInvite, setPendingGroupInvite] = useState(null);
  const [jumpToDate, setJumpToDate] = useState(null);
  const [jumpToSession, setJumpToSession] = useState(null); // { date, code, start } — highlights the specific class row

  // Bumped when "Notification settings" is chosen from the menu → auto-opens the
  // prefs dropdown on the Announcements page.
  const [notifPrefsSignal, setNotifPrefsSignal] = useState(0);
  const [, setSeenRecvCount] = useState(() => {
    try { return parseInt(localStorage.getItem("pgp2.recv-groups-count") || "0", 10); } catch { return 0; }
  });
  // Tablet landscape tier (768–1200px landscape): sidebar is forced to the collapsed icon
  // rail — there isn't room for the expanded 256px panel next to content and the week rail,
  // so the user's stored expand/collapse preference only applies on desktop displays (above 1200px).
  // Portrait tablets (768–1200px) get the single-column mobile view with header/tabs,
  // matching the orientation-aware breakpoints in styles.css.
  const checkIsTabletLandscape = () => {
    if (typeof window === "undefined") return false;
    const isLandscape = window.matchMedia("(orientation: landscape)").matches || window.innerWidth > window.innerHeight;
    const w = window.innerWidth;
    return isLandscape && w >= 768 && w <= 1200;
  };
  const [isTablet, setIsTablet] = useState(checkIsTabletLandscape);
  useEffect(() => {
    const update = () => setIsTablet(checkIsTabletLandscape());
    update();
    const mq = window.matchMedia("(min-width: 768px) and (max-width: 1200px) and (orientation: landscape)");
    try { mq.addEventListener("change", update); } catch { mq.addListener?.(update); }
    window.addEventListener("resize", update, { passive: true });
    window.addEventListener("orientationchange", update, { passive: true });
    return () => {
      try { mq.removeEventListener("change", update); } catch { mq.removeListener?.(update); }
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
    };
  }, []);
  useEffect(() => {
    if (isTablet || !v2Active) setMobileV2MoreOpen(false);
  }, [isTablet, v2Active]);
  const {
    sidebarCollapsed, sbCollapsed, toggleSidebar, tabletSidebarOpen, closeTabletSidebar,
    sbStyle, setSidebarStyle,
    theme, pickTheme,
    showSbTip, hideSbTip,
    mobileNavMode, pickNavMode, showBottomNav, showTopTabs,
    bnavRef,
    navMenuOpen, setNavMenuOpen,
    themeMenuOpen, setThemeMenuOpen,
    toolsSecOpen, setToolsSecOpen,
    sbToolsOpen, setSbToolsOpen,
    prefsSecOpen, setPrefsSecOpen,
    aboutSecOpen, setAboutSecOpen,
    adminSecOpen, setAdminSecOpen,
    showRightScroll, setShowRightScroll,
    showLeftScroll, setShowLeftScroll,
  } = useSidebar({ isTablet, v2Active });

  const previousSidebarView = useRef(view);
  useEffect(() => {
    if (previousSidebarView.current !== view) closeTabletSidebar();
    previousSidebarView.current = view;
  }, [view, closeTabletSidebar]);

  const tabsRef = useRef(null);
  const [termMenuOpen, setTermMenuOpen] = useState(false);
  const [desktopTermMenuOpen, setDesktopTermMenuOpen] = useState(false);
  const [termPickerPos, setTermPickerPos] = useState(null);
  const termPickerTriggerRef = useRef(null);
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
  // Sidebar "More" group stays open when the active page lives inside it, so the
  // user never loses their place; collapsed sidebar always shows the icons.
  const viewIsTool = MORE_VIEWS.includes(view);
  const showSbTools = sbCollapsed || sbToolsOpen || viewIsTool;
  const [messMenuOpen, setMessMenuOpen] = useState(false);
  // Split deep-link: a group id from a notification URL (?view=split&g=…)
  const [splitDeepLink, setSplitDeepLink] = useState(null);
  // Split invite: a group id to join from a shared link (?view=split&join=…)
  const [splitJoinLink, setSplitJoinLink] = useState(null);
  const [showFriendsAgenda, setShowFriendsAgenda] = useState(false);
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
  // Popups owned by App: the back button closes them before leaving the view.
  // (Popup components register themselves — see lib/backClose.js.)
  useBackClose(() => setNotifOpen(false), notifOpen);
  useBackClose(() => setProfileOpen(false), profileOpen);
  useBackClose(() => setSbProfileOpen(false), sbProfileOpen);
  useBackClose(() => setOverflowOpen(false), overflowOpen);
  useBackClose(() => setMobileV2MoreOpen(false), mobileV2MoreOpen);
  useBackClose(() => setDesktopTermMenuOpen(false), desktopTermMenuOpen);
  useBackClose(() => setHelpModalOpen(false), helpModalOpen);
  useBackClose(() => setFilterModalOpen(false), filterModalOpen);
  useBackClose(closeTabletSidebar, tabletSidebarOpen);
  // Keyboard: Escape closes, focus returns to the opener. Menus are non-modal
  // (the profile menu opens on hover), full sheets trap focus.
  const profileMenuRef = useDialog(profileOpen, () => setProfileOpen(false), { modal: false });
  const sbProfileMenuRef = useDialog(sbProfileOpen, () => setSbProfileOpen(false), { modal: false });
  const overflowMenuRef = useDialog(overflowOpen, () => setOverflowOpen(false), { modal: false });
  const termMenuRef = useDialog(desktopTermMenuOpen, () => setDesktopTermMenuOpen(false), { modal: false });
  const helpDialogRef = useDialog(helpModalOpen, () => setHelpModalOpen(false));
  const filterDialogRef = useDialog(filterModalOpen, () => setFilterModalOpen(false));
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
    const captureFromUrl = (event) => {
      const params = new URLSearchParams(window.location.search);
      const code = params.get("f");
      const groupToken = params.get("group_invite");
      // ?view= now mirrors the current view on every entry, so on back/forward
      // it's the popstate handler's job, and a URL naming the view already
      // shown (focus, visibility, launch) is not a deep link to act on.
      const rawView = event?.type === "popstate" ? null : params.get("view");
      const wanted = rawView && URL_VIEWS.has(rawView) ? rawView : null;
      const session = pushSessionFromParams(params);
      const newView = wanted && wanted !== currentViewRef.current && !(wanted === "leave" && currentViewRef.current === "planner");
      if (!code && !groupToken && !newView && !session && !(wanted === "split" && (params.get("g") || params.get("join")))) return;

      // Strip the consumed params, preserving anything else on the URL. Done
      // before any setView so the entry it pushes (and the one back returns
      // to) carries a clean URL — otherwise back would replay the deep link.
      const rest = new URLSearchParams(window.location.search);
      rest.delete("f");
      rest.delete("group_invite");
      if (!wanted) rest.delete("view");
      rest.delete("g");
      rest.delete("join");
      if (wanted === "fullSchedule") {
        rest.delete("date"); rest.delete("code"); rest.delete("start");
      }
      const qs = rest.toString();
      window.history.replaceState(window.history.state, "", window.location.pathname + (qs ? `?${qs}` : ""));

      if (code) {
        try { localStorage.setItem(PENDING_INVITE_KEY, code); } catch { }
        setPendingInvite(code);
      }
      if (groupToken) {
        try { localStorage.setItem("pgp2.pending-group-invite", groupToken); } catch { }
        setPendingGroupInvite(groupToken);
        setView("friends");
      }
      if (wanted) setView(wanted);
      if (session) setJumpToSession(session);
      if (wanted === "split") {
        const g = params.get("g");
        if (g) setSplitDeepLink(g);
        const join = params.get("join");
        if (join && rememberSplitInvite(join)) setSplitJoinLink(join);
      }
    };

    // Seed from a code stashed on a previous load (survives the OAuth redirect).
    try {
      const stashed = localStorage.getItem(PENDING_INVITE_KEY);
      if (stashed) setPendingInvite(stashed);
      const groupStashed = localStorage.getItem("pgp2.pending-group-invite");
      if (groupStashed) { setPendingGroupInvite(groupStashed); setView("friends"); }
      const splitStashed = pendingSplitInvite();
      if (splitStashed) { setSplitJoinLink(splitStashed); setView("split"); }
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
  }, [setView]);

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
        if (p?.archivedCourses) setArchivedCourses(p.archivedCourses);
        // Which term these courses were picked in (stamped on every
        // pushProfile). Whether that makes them stale is decided by the effect
        // next to `TERM` below, NOT here: this sync is keyed on sign-in, so
        // TERM in this closure is from the first render — undefined on any
        // device without a cached feed — and comparing against it wiped every
        // fresh login's current courses and forced a re-onboard.
        setCloudEnrolledTerm(p?.enrolledTerm ?? null);
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
    
    const legendData = getSnapshot()?.LEGEND || {};
    const currentMs = Date.now();
    const ONE_HOUR = 60 * 60 * 1000;

    for (const config of flashes) {
      if (!config.enabled || !config.deadline) continue;

      const matchedSubjectCode = feedbackFlashAudience(config, enrolled);
      if (!matchedSubjectCode) continue;

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
    let alive = true;
    fetchConsensusWeather()
      .then((data) => {
        if (alive && data) setWeather(data);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
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
        // A failed fetch resolves with the bundled snapshot. Keep whatever we
        // already have instead — it is never worse, and it stops a flaky feed
        // from downgrading live data (STUDENTS included) mid-session.
        const failed = data._meta?.status === "error";
        setScheduleData(prev => (failed && prev ? prev : data));
        if (!failed) setSyncedAt(new Date());
        if (data._meta) setSyncLogs(prev => [{ ...data._meta, trigger: "Automatic refresh" }, ...prev].slice(0, 1000));
      }).catch(e => {
        if (!alive) return;
        setSyncLogs(prev => [{ ts: Date.now(), status: "error", source: "App refresh", step: "Automatic refresh", trigger: "Automatic refresh", message: e.message || "Unexpected error" }, ...prev].slice(0, 1000));
      });
    };
    load();
    const id = setInterval(load, 10 * 60 * 1000);
    return () => { alive = false; clearInterval(id); };
  }, [isSignedIn]);

  useEffect(() => {
    let t = null;
    const update = () => setRealNow(new Date());

    const startTimer = () => {
      if (t) clearInterval(t);
      update();
      t = setInterval(update, 60000);
    };

    const handleVisibility = () => {
      if (document.hidden) {
        if (t) { clearInterval(t); t = null; }
      } else {
        startTimer();
      }
    };

    if (!document.hidden) startTimer();
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      if (t) clearInterval(t);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
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
        if (elapsed > 5 * 60 * 1000) handleSync("Tab return");
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

  // Auto-sync section allocations from the live sheet.
  // Adds new courses from the sheet's STUDENTS roster that the user wasn't
  // enrolled in yet (e.g. WAI added after initial onboarding), and corrects the
  // section of courses they already hold — see the section-drift note below.
  useEffect(() => {
    const students = scheduleData?.STUDENTS;
    const email = user?.primaryEmailAddress?.emailAddress?.toLowerCase();

    if (students && email && enrolled && setup && userId) {
      (async () => {
        const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(email));
        const hash = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
        const allocation = students[hash];
        const droppedCodes = setup?.droppedCodes || [];
        const manualSections = setup?.manualSections || [];
        if (allocation) {
          const { courses: nextEnrolled, added, changed } = applyRosterAllocation(enrolled, allocation, {
            droppedCodes,
            manualSections,
            taught: taughtSectionsByCode(scheduleData?.CLASSES),
          });
          if (changed) {
            setEnrolled(nextEnrolled);
            // Only a genuinely new course touches the subject filter — a section
            // correction must not silently un-hide subjects the student filtered out.
            if (added) setMine(new Set(Object.keys(nextEnrolled)));
            const newSetup = { ...setup, courses: nextEnrolled };
            setSetup(newSetup);
            saveSetup(newSetup);
            pushProfile(userId, nextEnrolled, user?.firstName || user?.username || "Student", undefined, user?.imageUrl, droppedCodes, manualSections);
          }
        }
      })();
    }
  }, [scheduleData, user, enrolled, setup, userId]);

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
    // A bundled STUDENTS map ships with the snapshot so onboarding still works
    // when the feed is down; only a totally absent map is worth waiting for.
    if (!scheduleData.STUDENTS) return;

    let cancelled = false;
    sha256hex(email.trim().toLowerCase()).then((hash) => {
      if (cancelled) return;
      const allocation = scheduleData.STUDENTS?.[hash];
      if (!allocation || Object.keys(allocation).length === 0) {
        // Not in the map. If that map is the bundled snapshot it may simply
        // predate this student, so hold out for the live feed rather than
        // concluding they have no allocation and dropping them into a manual pick.
        if (scheduleData._source === "live") setAllocationApplied(true);
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

  // True while a new user's allocation is still unresolved — either the live
  // feed hasn't landed, or it has but the bundled map didn't list them yet.
  // Drives the "Fetching timetable allocation…" notice in Onboarding, and the
  // retry below.
  const waitingForAllocation =
    cloudChecked && !setup && !readSetup() && !allocationApplied && scheduleData?._source !== "live";

  // The 10-minute background poll is far too slow to sit through on the
  // onboarding screen, and the Apps Script feed fails often enough that the
  // first attempt regularly misses. Retry on a short backoff for as long as the
  // allocation is unresolved; the poll above remains the long-run safety net.
  useEffect(() => {
    if (!isSignedIn || !waitingForAllocation) return;
    const DELAYS = [15000, 30000, 60000, 120000];
    let alive = true;
    let attempt = 0;
    let timer;
    function scheduleRetry() {
      if (!alive || attempt >= DELAYS.length) return;
      timer = window.setTimeout(runRetry, DELAYS[attempt++]);
    }
    function runRetry() {
      fetchSchedule()
        .then(data => {
          if (!alive) return;
          if (data?._source === "live") setScheduleData(data);
          else scheduleRetry();
        })
        .catch(() => { if (alive) scheduleRetry(); });
    }
    scheduleRetry();
    return () => { alive = false; window.clearTimeout(timer); };
  }, [isSignedIn, waitingForAllocation]);

  // Apply Admin Overrides (Term data & Cancellations)
  const sd = useMemo(() => {
    if (!scheduleData) return null;
    let data = { ...scheduleData };
    if (sysConfig?.flags) {

      if (sysConfig.flags.classOverrides) {
        data.CLASSES = applyClassOverrides(scheduleData.CLASSES, sysConfig.flags.classOverrides);
      }
    }
    return data;
  }, [scheduleData, sysConfig]);

  const { TERM, LEGEND, CLASSES, CHANGES } = sd || { TERM: null, LEGEND: {}, CLASSES: [], CHANGES: [] };

  // Term rollover: a profile's courses are only valid for the term they were
  // picked in. Once BOTH the live term and the cloud profile's term are known
  // and differ, those picks are stale — already archived server-side (see
  // profile.js pushProfile) — so send the student back to onboarding for the
  // new term. Layout effect so last term's schedule never paints.
  const staleEnrollmentHandled = useRef(false);
  useLayoutEffect(() => {
    if (staleEnrollmentHandled.current) return;
    if (!TERM?.number || !cloudEnrolledTerm || cloudEnrolledTerm === TERM.number) return;
    staleEnrollmentHandled.current = true;
    // Drop the cached copy too: the sheet auto-fill skips anyone with a stored
    // setup, which left re-onboarding students with zero subjects picked.
    try { localStorage.removeItem(SETUP_KEY); } catch { }
    setSetup(null);
    setEnrolled({});
    setMine(new Set());
    setReonboardFromTerm(cloudEnrolledTerm);
    setAllocationApplied(false); // re-arm the auto-fill for the new term's allocation
  }, [TERM?.number, cloudEnrolledTerm]);

  // Term switcher: when browsing an archived term, shadow the live TERM/LEGEND/
  // CLASSES/CHANGES with the archived entry's data for everything render-facing.
  // Live-only actions (attendance marking, push, admin config, live feed sync)
  // keep using the real TERM/CLASSES/sd — see `isArchivedView` gating below.
  const archivedEntry = (TERM && selectedTerm != null && selectedTerm !== TERM.number)
    ? ARCHIVED_TERMS.find(t => t.number === selectedTerm) || null
    : null;
  const [archivedClassesMap, setArchivedClassesMap] = useState({});

  useEffect(() => {
    if (archivedEntry && !archivedClassesMap[archivedEntry.number] && archivedEntry.loadClasses) {
      archivedEntry.loadClasses().then((cls) => {
        setArchivedClassesMap((prev) => ({ ...prev, [archivedEntry.number]: cls }));
      });
    }
    // Also load previous term classes if user has saved courses for it (for Wrapped comparison)
    const prevTerm = ARCHIVED_TERMS.find((t) => archivedCourses[t.number] && !archivedClassesMap[t.number]);
    if (prevTerm && prevTerm.loadClasses) {
      prevTerm.loadClasses().then((cls) => {
        setArchivedClassesMap((prev) => ({ ...prev, [prevTerm.number]: cls }));
      });
    }
  }, [archivedEntry, archivedClassesMap, archivedCourses]);

  const activeTerm = archivedEntry ? archivedEntry.TERM : TERM;
  const activeLegend = archivedEntry ? archivedEntry.LEGEND : LEGEND;
  const activeClasses = archivedEntry ? (archivedClassesMap[archivedEntry.number] || archivedEntry.CLASSES || []) : CLASSES;
  const activeChanges = archivedEntry ? [] : CHANGES;
  const isArchivedView = !!archivedEntry;
  // Enrollment source for the term currently being browsed: live `enrolled`
  // normally, or the frozen per-term snapshot when browsing an archived term.
  // Filtered to the selected term's legend so a term shows only ITS subjects —
  // stale codes left in a profile from a previous term (before re-onboarding)
  // never leak into Attendance / Exams / Wrapped / Full Schedule.
  const activeEnrolled = useMemo(() => {
    const base = isArchivedView ? (archivedCourses[activeTerm?.number] || {}) : (enrolled || {});
    const leg = activeLegend || {};
    const out = {};
    for (const code of Object.keys(base)) if (leg[code]) out[code] = base[code];
    return out;
  }, [isArchivedView, archivedCourses, activeTerm, enrolled, activeLegend]);
  const activeMine = useMemo(() => new Set(Object.keys(activeEnrolled)), [activeEnrolled]);
  // Editing enrollment only makes sense for the live term — a no-op while
  // browsing an archived term (every "Edit setup" entry point routes through this).
  const openEditSetup = useCallback(() => { if (!isArchivedView) setShowSetupEdit(true); }, [isArchivedView]);

  const sectionsByCode = useMemo(() => (sd ? taughtSectionsByCode(sd.CLASSES) : {}), [sd]);

  // Courses whose allocated section isn't one the course actually teaches — the
  // roster script reports a not-yet-allocated course as "Single", which matches
  // no row of an A/B timetable. See lib/sections.js for the full reasoning; this
  // is what keeps ECOM's 111 students from seeing zero classes.
  const provisionalSections = useMemo(
    () => provisionalSectionCodes(enrolled, sectionsByCode),
    [enrolled, sectionsByCode]
  );

  // Enrolled courses with no sessions in the timetable at all (e.g. a legend
  // entry published before its schedule). Only meaningful once live data has
  // landed — the bundled snapshot lagging the sheet is not evidence of a gap.
  const unscheduledCourses = useMemo(
    () => (sd?._source === "live" ? unscheduledCodes(enrolled, sectionsByCode) : []),
    [sd?._source, enrolled, sectionsByCode]
  );

  const visible = useMemo(() => {
    if (!enrolled || !mine) return [];
    const seen = new Set();
    return CLASSES.filter((c) => {
      if (c.type === "class") {
        const sec = enrolled[c.code];
        // Provisional courses fall through to every section: showing both A and
        // B is noisy, but it is the only honest option while the real section is
        // unknown, and far better than the course vanishing.
        return sec !== undefined && (c.section === sec || c.section === "Single" || c.section === "All" || provisionalSections.has(c.code)) && mine.has(c.code);
      }
      if (c.type === "cancelled" && c.code) {
        const sec = enrolled[c.code];
        return sec !== undefined && mine.has(c.code) && (c.section === sec || c.section === "Single" || c.section === "All" || provisionalSections.has(c.code));
      }
      // Exams: the feed leaves `code` blank; try to infer the course code from
      // the entry name (e.g. "SAPM MID Term Exam" → "SAPM") and gate on enrollment.
      // If the name doesn't start with a recognisable enrolled code, show the
      // event to everyone (Term Registration, holidays, breaks, etc.).
      if (c.type === "exam" || (c.type === "cancelled" && !c.code)) {
        const key = c.date + c.slot + c.name;
        if (seen.has(key)) return false;
        const code = c.code || (c.name || "").match(/^([A-Za-z]{2,8})\b/)?.[1]?.toUpperCase();
        if (code && Object.keys(LEGEND || {}).includes(code)) {
          if (!mine.has(code)) return false;
        }
        seen.add(key); return true;
      }
      const key = c.date + (c.slot || c.start || "") + (c.code || "") + c.name;
      if (seen.has(key)) return false; seen.add(key); return true;
    });
  }, [CLASSES, enrolled, mine, LEGEND, provisionalSections]);

  const enrolledLegend = useMemo(() => {
    const out = {};
    if (enrolled) Object.keys(enrolled).forEach((c) => { if (LEGEND[c]) out[c] = LEGEND[c]; });
    return out;
  }, [enrolled, LEGEND]);

  // Archived-aware counterparts of enrolled/mine/enrolledLegend, used by the
  // components that support browsing an archived term (Attendance, Exams,
  // Wrapped, Full Schedule) — falls back to the live values when not archived.
  const activeEnrolledLegend = useMemo(() => {
    if (!isArchivedView) return enrolledLegend;
    const out = {};
    Object.keys(activeEnrolled || {}).forEach((c) => { if (activeLegend[c]) out[c] = activeLegend[c]; });
    return out;
  }, [isArchivedView, activeEnrolled, activeLegend, enrolledLegend]);

  // Same filtering as `visible` above, but against the archived term's data —
  // only needed for WrappedView while browsing an archived term.
  const activeVisible = useMemo(() => {
    if (!isArchivedView) return visible;
    if (!activeEnrolled || !activeMine) return [];
    const seen = new Set();
    return activeClasses.filter((c) => {
      if (c.type === "class") {
        const sec = activeEnrolled[c.code];
        return sec !== undefined && (c.section === sec || c.section === "Single" || c.section === "All") && activeMine.has(c.code);
      }
      if (c.type === "exam") {
        const key = c.date + c.slot + c.name;
        if (seen.has(key)) return false;
        const code = c.code || (c.name || "").match(/^([A-Za-z]{2,8})\b/)?.[1]?.toUpperCase();
        if (code && Object.keys(activeLegend || {}).includes(code)) {
          if (!activeMine.has(code)) return false;
        }
        seen.add(key); return true;
      }
      const key = c.date + (c.slot || c.start || "") + (c.code || "") + c.name;
      if (seen.has(key)) return false; seen.add(key); return true;
    });
  }, [isArchivedView, activeClasses, activeEnrolled, activeMine, activeLegend, visible]);

  // Prior-term input for Wrapped comparisons. Only use a saved enrollment
  // snapshot; without it, comparing against the whole cohort timetable would
  // produce a misleading personal recap.
  const previousWrappedInput = useMemo(() => {
    let previous = null;
    if (isArchivedView) {
      const index = ARCHIVED_TERMS.findIndex((term) => term.number === activeTerm?.number);
      if (index > 0) previous = ARCHIVED_TERMS[index - 1];
    } else {
      const eligible = ARCHIVED_TERMS.filter((term) => !activeTerm?.start || term.TERM?.end < activeTerm.start);
      previous = eligible[eligible.length - 1] || null;
    }
    if (!previous) return null;
    const previousClasses = archivedClassesMap[previous.number] || previous.CLASSES;
    if (!previousClasses || !Array.isArray(previousClasses)) return null;
    const previousEnrolled = archivedCourses[previous.number];
    if (!previousEnrolled || Object.keys(previousEnrolled).length === 0) return null;
    const previousMine = new Set(Object.keys(previousEnrolled));
    const seen = new Set();
    const previousVisible = previousClasses.filter((c) => {
      if (c.type === "class") {
        const section = previousEnrolled[c.code];
        return section !== undefined && (c.section === section || c.section === "Single" || c.section === "All") && previousMine.has(c.code);
      }
      if (c.type === "exam") {
        const key = c.date + c.slot + c.name;
        if (seen.has(key)) return false;
        const code = c.code || (c.name || "").match(/^([A-Za-z]{2,8})\b/)?.[1]?.toUpperCase();
        if (code && Object.keys(previous.LEGEND || {}).includes(code) && !previousMine.has(code)) return false;
        seen.add(key);
        return true;
      }
      return false;
    });
    const previousLegend = {};
    previousMine.forEach((code) => { if (previous.LEGEND[code]) previousLegend[code] = previous.LEGEND[code]; });
    const currentEnd = activeTerm?.end ? new Date(`${activeTerm.end}T23:59:00`) : null;
    const compareAtSamePoint = Boolean(!isArchivedView && activeTerm?.start && previous.TERM?.start && currentEnd && now < currentEnd);
    let previousNow = new Date(`${previous.TERM.end}T23:59:00`);
    if (compareAtSamePoint) {
      const currentStart = new Date(`${activeTerm.start}T00:00:00`);
      const previousStart = new Date(`${previous.TERM.start}T00:00:00`);
      previousNow = new Date(Math.min(previousNow.getTime(), previousStart.getTime() + Math.max(0, now.getTime() - currentStart.getTime())));
    }
    return {
      visible: previousVisible,
      legend: previousLegend,
      termLabel: `Term ${previous.number}${compareAtSamePoint ? " at the same point" : ""}`,
      now: previousNow,
    };
  }, [isArchivedView, activeTerm?.number, activeTerm?.start, activeTerm?.end, archivedCourses, now]);

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

  // One small award per local day the app is opened. The ledger key IS the day,
  // so this stays idempotent across reloads, tabs and a midnight rollover
  // without tracking any streak state of its own.
  useEffect(() => {
    if (!userId) return;
    petActions.awardXp(petKeyFor.streak(todayISO), petXP.streak);
  }, [userId, todayISO, petActions, petKeyFor, petXP]);
  const tomorrowISO = ymd(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1));

  // The "Term N Wrapped is ready" nudge runs on the term's first day only and
  // drops at that midnight — the comparison below is `todayISO <= this`, and
  // todayISO rolls over at local midnight, so returning TERM.start keeps the
  // nudge up for all of day one and gone on day two. After that the recap
  // stays reachable via the term switcher + the live-term Wrapped empty-state
  // shortcut, so the banner doesn't linger all term.
  const wrappedNudgeUntil = useMemo(() => (TERM?.start ? ymd(new Date(`${TERM.start}T00:00:00`)) : null), []);

  // TermFlow Wrapped release gate: shown automatically in the last week of Term V
  // (e.g. 14 Dec 2026 – 20 Dec 2026), or when explicitly pushed by an admin.
  // Earliest floor is 14 Dec 2026 so prior terms' stored release flags do not leak into Term V.
  const isTermVLastWeek = useMemo(() => {
    const curTerm = (activeTerm?.number === "V" ? activeTerm : null) || (TERM?.number === "V" ? TERM : null);
    if (!curTerm?.end) return false;
    const [eY, eM, eD] = curTerm.end.split("-").map(Number);
    // Last week runs from 6 days before the term end date through the end date (14 Dec – 20 Dec 2026)
    const lastWeekStartDate = new Date(eY, eM - 1, eD - 6);
    const lastWeekStartISO = ymd(lastWeekStartDate);
    return todayISO >= lastWeekStartISO && todayISO <= curTerm.end;
  }, [activeTerm, TERM, todayISO]);

  const WRAPPED_MIN_DATE = "2026-12-14";
  const wrappedRelease = sysConfig?.flags?.wrappedReleaseDate;
  const wrappedActive = isTermVLastWeek || (!!wrappedRelease && todayISO >= wrappedRelease && todayISO >= WRAPPED_MIN_DATE);

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

  const nextClassAfterTomorrow = useMemo(() => {
    return visible
      .filter((c) => (c.type === "class" || c.type === "exam") && c.date > tomorrowISO)
      .sort((a, b) => (a.date === b.date ? toMin(a.start) - toMin(b.start) : a.date.localeCompare(b.date)))[0] || null;
  }, [visible, tomorrowISO]);

  // What the timetable is doing, reduced to the handful of facts the pet's mood
  // cares about (see `moodFor`). Rebuilt on every clock tick, which is what
  // makes "restless" arrive on time — it is three property reads, not a scan.
  // Whether an exam falls inside the pet's horizon. Split out from petContext
  // so it only rescans the term when the schedule changes, not on every tick.
  const examSoon = useMemo(() => {
    const horizon = new Date(now);
    horizon.setDate(horizon.getDate() + EXAM_HORIZON_DAYS);
    const until = ymd(horizon);
    return visible.some(c => c.type === "exam" && c.date >= todayISO && c.date <= until);
  }, [visible, todayISO, now]);

  // An assignment due today and not yet ticked off. Re-read when the day turns
  // or the ledger gains a `due:` key (completing a task awards one), not per tick.
  const deadlineDueToday = useMemo(
    () => assignmentDueToday(todayISO, myPet?.awarded ?? {}),
    [todayISO, myPet?.awarded],
  );

  // Dates with a scheduled class, so the pet's attendance streak skips weekends
  // and holidays. Rebuilt only when the schedule changes.
  const classDays = useMemo(
    () => new Set(visible.filter(c => c.type === "class").map(c => c.date)),
    [visible],
  );

  const petContext = useMemo(() => ({
    inClass: Boolean(current),
    minsToClass: next?.s ? (next.s - now) / 60000 : null,
    classesToday: todayList.filter(c => c.type === "class" || c.type === "exam").length,
    examSoon,
    deadlineDueToday,
    classDays,
    moment: petMoment?.moment,
    momentUntil: petMoment?.momentUntil,
  }), [current, next, now, todayList, examSoon, deadlineDueToday, classDays, petMoment]);

  // Remember an observed class even when the companion page is not open.
  const classMemoryPetKey = current && greetingPetsEnabled && myPet?.companionEnabled !== false
    && sysConfig?.flags?.greetingPets?.enabled !== false && sysConfig?.flags?.greetingPets?.companion !== false ? myPet?.petKey : null;
  const memoryReady = companionMemory.ready;
  const recordCompanionVisit = companionMemory.record;
  useEffect(() => {
    if (memoryReady && classMemoryPetKey) recordCompanionVisit(memoryEvent("visit", { petKey: classMemoryPetKey, petName: myPet?.name, context: "class" }, new Date()));
  }, [memoryReady, classMemoryPetKey, myPet?.name, recordCompanionVisit]);

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
    // Sections the student deliberately set *against* the roster, so the sync
    // above leaves them alone. Deviating from an allocation the sheet already
    // publishes is a real choice; picking a section for a course the sheet has
    // no allocation for yet is only a guess, so it stays sheet-owned and gets
    // corrected the moment the admin fills the course tab's Section column.
    // Recomputed from scratch each time: re-aligning with the sheet clears it.
    const manualSections = manualSectionCodes(courses, (await buildAllocationFromSheet()) || {});
    const s = { courses, droppedCodes, manualSections };
    saveSetup(s);
    const trimmed = (enteredName || "").trim();
    // If the user typed a name (they had none from Clerk), persist it to Clerk so
    // it flows everywhere, and use it directly for this push (user.firstName won't
    // update synchronously). Otherwise fall back to whatever Clerk already has.
    if (trimmed && user && !user.firstName) {
      try { await user.update({ firstName: trimmed }); } catch { /* non-blocking */ }
    }
    const name = trimmed || user?.firstName || user?.username || "Student";
    pushProfile(userId, courses, name, undefined, user?.imageUrl, droppedCodes, manualSections);
    setEnrolled(courses);
    setMine(new Set(Object.keys(courses)));
    setSetup(s);
    setShowSetupEdit(false);
    setReonboardFromTerm(null);
    setCloudEnrolledTerm(TERM?.number ?? null);
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
    // Signed out keeps the full brand title (search results, link previews);
    // signed in names the page, which also labels back-history entries.
    const page = isSignedIn ? viewTitle(view, view === "courseHub" ? courseHubCode : null) : "TermFlow | IIM Sambalpur | PGP2";
    document.title = total > 0 ? `(${total}) ${page}` : page;
  }, [unreadChangeCount, unreadFriendCount, unreadAlertCount, isSignedIn, view, courseHubCode]);
  useEffect(() => {
    const total = unreadChangeCount + unreadFriendCount + unreadAlertCount;
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

  const {
    markGroupsSeen, markPingRead, markAlertRead, markChangeRead, markChangesRead,
    markAllChangesRead, markAllRead, removePingEverywhere, clearAllFriendNotifs,
    handleOpenNotif, handleViewAllNotifs,
  } = buildNotificationHandlers(
    { notifOpen, setNotifOpen, readPingIds, setReadPingIds, readChangeKeys, setReadChangeKeys,
      seenRecvGroupIds, setSeenRecvGroupIds, pings, setPings, setAlerts },
    { userId, enrolled, changes: CHANGES, userName: user?.firstName || user?.username || "Student",
      userImageUrl: user?.imageUrl,
      filteredChanges, friendNotifItems, newRecvGroups, allRecvGroups,
      receivedGroupCount, unreadAlertCount, isAdmin, changeKey,
      setClearedGroupIds, setSeenRecvCount, setLastSeenTs, notifOpenedAt, setView }
  );

  function flashFriendToast(msg) {
    setFriendToast(msg);
    setTimeout(() => setFriendToast(null), 4000);
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

  // Presence heartbeat — records durable per-day activity and keeps
  // profiles.last_seen_at current. The five-minute cadence makes "last seen"
  // useful without writing on every render; a visible tab also crosses
  // midnight correctly. The direct profile update is a rollout fallback until
  // record_presence_heartbeat() has been deployed.
  useEffect(() => {
    if (!userId) return;
    const storageKey = `pgp2.last-heartbeat.${userId}`;
    let beatInFlight = false;
    const beat = async () => {
      if (beatInFlight || document.visibilityState === "hidden") return;
      try {
        const now = Date.now();
        const last = Number(localStorage.getItem(storageKey) || 0);
        const lastDay = last ? new Date(last).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }) : "";
        const today = new Date(now).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
        if (now - last < 5 * 60 * 1000 && lastDay === today) return;

        beatInFlight = true;
        const { error: historyError } = await supabase.rpc("record_presence_heartbeat");
        if (historyError) {
          const { error: fallbackError } = await supabase
            .from("profiles")
            .update({ last_seen_at: new Date(now).toISOString() })
            .eq("user_id", userId);
          if (fallbackError) return;
        }
        localStorage.setItem(storageKey, String(now));
      } catch { /* best effort */ }
      finally { beatInFlight = false; }
    };
    beat();
    const onVisible = () => { if (document.visibilityState === "visible") beat(); };
    const timer = setInterval(beat, 5 * 60 * 1000);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
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
    if (status !== null) recordFeatureUse(userId, "attendance_mark");
    // Marking a class is the pet's main XP source — deliberately, so progress
    // tracks something the student was going to do anyway rather than tapping.
    // Keyed by session, so un-marking and re-marking (or a cloud re-sync
    // replaying the same rows) can never pay out twice.
    if (status !== null) {
      const attKey = petKeyFor.attendance(key);
      const isNew = petActions.awardXp(attKey, petXP.attendance, now);
      if (isNew && enableCompanion && isAdopted(myPet)) {
        // Detect first earn of the day by checking if there are any attendance
        // entries for today already in the ledger (excluding the one we just added).
        const todayPfx = `att:`;
        const todayStr = ymd(now);
        const todayCount = Object.entries(myPet?.awarded ?? {}).filter(
          ([k, v]) => k.startsWith(todayPfx) && v[0] === todayStr
        ).length;
        setXpToastQueue(q => [...q, { id: attKey, xp: petXP.attendance, label: "attendance", firstOfDay: todayCount === 0 }]);
      }
    }
  }

  const handleSync = async (eventOrTrigger) => {
    const trigger = typeof eventOrTrigger === "string" ? eventOrTrigger : "Manual refresh";
    haptic([10]);
    setSyncing(true);
    try {
      const data = await fetchSchedule(true);
      const failed = data._meta?.status === "error";
      if (!failed) {
        setScheduleData(data);
        setSyncedAt(new Date());
      }
      setRealNow(new Date());
      if (data._meta) setSyncLogs(prev => [{ ...data._meta, trigger }, ...prev].slice(0, 1000));
      haptic(failed ? [50, 100, 50] : [10, 40, 10]);
    } catch (e) {
      haptic([50, 100, 50]);
      setSyncLogs(prev => [{ ts: Date.now(), status: "error", source: "App refresh", step: trigger, trigger, message: e.message || "Unexpected error" }, ...prev].slice(0, 1000));
    } finally {
      setSyncing(false);
    }
  };

  const mostRecentArchivedTerm = ARCHIVED_TERMS.length > 0 ? ARCHIVED_TERMS[ARCHIVED_TERMS.length - 1] : null;

  function fmtTermDate(val) {
    if (!val) return "";
    // Try ISO (YYYY-MM-DD) with midnight anchor first, then raw parse
    let d = new Date(String(val).trim() + "T00:00");
    if (isNaN(d)) d = new Date(String(val).trim());
    return isNaN(d) ? "" : d.toLocaleDateString([], { day: "numeric", month: "short" });
  }
  function pickTerm(num, live) {
    setSelectedTerm(num);
    flashFriendToast(live ? `Now viewing Term ${num} · Live` : `Now viewing Term ${num} · Archive (read-only)`);
  }
  const termDateRange = activeTerm ? [fmtTermDate(activeTerm.start), fmtTermDate(activeTerm.end)].filter(Boolean).join(" – ") : "";
  const termLabel = activeTerm?.number ? `Term ${activeTerm.number}${isArchivedView ? " · Archive" : ""}${termDateRange ? ` · ${termDateRange}` : ""}` : termDateRange;
  const termSwitcherEl = ARCHIVED_TERMS.length > 0 ? (
    <div className="term-picker">
      <button
        className="term-picker-trigger"
        aria-expanded={desktopTermMenuOpen}
        ref={termPickerTriggerRef}
        onClick={() => {
          if (!desktopTermMenuOpen) {
            const r = termPickerTriggerRef.current?.getBoundingClientRect();
            if (r) setTermPickerPos({ top: r.bottom + 6, left: r.left, minWidth: r.width });
          }
          setDesktopTermMenuOpen(o => !o);
        }}
      >
        {isArchivedView ? <History size={13} /> : <Radio size={13} className="over-term-live-icon" />}
        Term {selectedTerm ?? TERM?.number}
        <span className="over-term-badge">{isArchivedView ? "Archive" : "Live"}</span>
        <ChevronDown size={12} className={`over-caret${desktopTermMenuOpen ? " open" : ""}`} />
      </button>
      {desktopTermMenuOpen && termPickerPos && createPortal(
        <>
          <div className="notif-backdrop" onClick={() => setDesktopTermMenuOpen(false)} />
          <div ref={termMenuRef} className="over-menu term-picker-menu" role="group" aria-label="Choose term" style={{ position: "fixed", top: termPickerPos.top, left: termPickerPos.left, minWidth: Math.max(200, termPickerPos.minWidth) }}>
            <button className="over-term-row" onClick={() => { pickTerm(TERM?.number ?? "", true); setDesktopTermMenuOpen(false); }}>
              <span className="over-term-row-top">
                <Radio size={14} className="over-term-live-icon" /> Term {TERM?.number}
                {!isArchivedView && <Check size={14} className="over-check" />}
              </span>
              <span className="over-term-hint">Live</span>
            </button>
            {ARCHIVED_TERMS.map((t) => (
              <button key={t.number} className="over-term-row" onClick={() => { pickTerm(t.number, false); setDesktopTermMenuOpen(false); }}>
                <span className="over-term-row-top">
                  <History size={14} /> Term {t.number}
                  {selectedTerm === t.number && <Check size={14} className="over-check" />}
                </span>
                <span className="over-term-hint">View</span>
              </button>
            ))}
          </div>
        </>,
        document.body
      )}
    </div>
  ) : null;
  const termProgressPct = useMemo(() => {
    if (isArchivedView) return 100; // archived terms are always complete
    if (!activeTerm?.start || !activeTerm?.end) return null;
    const [sY, sM, sD] = activeTerm.start.split("-").map(Number);
    const [eY, eM, eD] = activeTerm.end.split("-").map(Number);
    const start = new Date(sY, sM - 1, sD).getTime();
    const end = new Date(eY, eM - 1, eD).getTime();
    if (!(end > start)) return null;
    return Math.min(100, Math.max(0, Math.round(((now.getTime() - start) / (end - start)) * 100)));
  }, [activeTerm?.start, activeTerm?.end, now, isArchivedView]);
  const termWeekInfo = useMemo(() => {
    if (!activeTerm?.start || !activeTerm?.end) return null;
    const [sY, sM, sD] = activeTerm.start.split("-").map(Number);
    const [eY, eM, eD] = activeTerm.end.split("-").map(Number);
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
  if (!setup) return <Onboarding legend={LEGEND} sectionsByCode={sectionsByCode} onDone={handleOnboardingDone} termLabel={termLabel} onPullFromSheet={buildAllocationFromSheet} prefill={prefillPicked} cloudChecked={cloudChecked} waitingForAllocation={waitingForAllocation} needsName={needsName} reonboardFromTerm={reonboardFromTerm} newTermLabel={TERM?.number} liveTerm={TERM?.number} priorTerm={mostRecentArchivedTerm?.number} priorLegend={mostRecentArchivedTerm?.LEGEND} priorPicked={mostRecentArchivedTerm ? archivedCourses[mostRecentArchivedTerm.number] : null} />;
  if (showSetupEdit) return <Onboarding legend={LEGEND} sectionsByCode={sectionsByCode} onDone={handleOnboardingDone} initialPicked={enrolled} onCancel={() => setShowSetupEdit(false)} termLabel={termLabel} onPullFromSheet={buildAllocationFromSheet} needsName={needsName} liveTerm={TERM?.number} priorTerm={mostRecentArchivedTerm?.number} priorLegend={mostRecentArchivedTerm?.LEGEND} priorPicked={mostRecentArchivedTerm ? archivedCourses[mostRecentArchivedTerm.number] : null} />;

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
  const enableFriends = sysConfig?.flags?.enableFriends !== false;
  const enableAttendance = sysConfig?.flags?.enableAttendance !== false;
  const enableStatus = sysConfig?.flags?.enableStatus !== false;
  const enableMeetups = sysConfig?.flags?.enableMeetups !== false;
  const enableFreeNudge = sysConfig?.flags?.enableFreeNudge !== false;
  const enableAwayShare = sysConfig?.flags?.enableAwayShare !== false;
  // The companion feature (adoption, the pet page, XP, friends' pets) rides
  // three switches: the admin's pet kill switch, a separate admin switch for
  // the companion layer specifically, and the student's own opt-out. Someone
  // who turned pets off shouldn't meet them again on other people's cards.
  // `companion` absent ⇒ on, so a prod config saved before this shipped keeps
  // working without a migration.
  // ...and ANDed with the per-student switch an admin can flip from the Users
  // inspector, which is server-owned (pinned by the pet_state trigger) so it
  // can't be undone client-side.
  const enableCompanion = sysConfig?.flags?.greetingPets?.enabled !== false
    && sysConfig?.flags?.greetingPets?.companion !== false
    && greetingPetsEnabled
    && myPet?.companionEnabled !== false;

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

  // Quick links (admin flags.quickLinks) — date-windowed links for the sidebar.
  // safeUrl drops any link whose scheme isn't http/https/mailto, so a planted
  // `javascript:` url can't reach an href in the sidebar or the mobile chips.
  const activeQuickLinks = (sysConfig?.flags?.quickLinks || [])
    .filter(q => q?.title && q.url && q.start && q.end && todayISO >= q.start && todayISO <= q.end)
    .map(q => ({ ...q, url: safeUrl(q.url) }))
    .filter(q => q.url);

  const mobileV2Title = mobileV2MoreOpen ? "More"
    : view === "today" || view === "tomorrow" ? "TermFlow"
      : view === "week" || view === "fullSchedule" ? "Schedule"
        : view === "assignments" || view === "exams" ? "Tasks"
        : view === "attendance" ? "Attendance"
          : view === "planner" ? "Personal planner"
            : view === "courseHub" ? "Courses"
            : view === "notifications" ? "Announcements"
              : view === "friends" ? "Social"
                : view === "board" ? "Campus Board"
                  : view === "split" ? "Split expenses"
                    : view === "leave" ? "Leave planner"
                      : view === "pet" ? "Companion"
                        : view === "wrapped" ? "Term Wrapped"
                          : view === "admin" ? "Admin tools"
                            : "TermFlow";

  const openMobileV2More = () => {
    setMobileV2MoreOpen(true);
    setOverflowOpen(false);
    setNotifOpen(false);
    setCompareTarget(null);
    window.scrollTo({ top: 0, behavior: "instant" });
  };
  const v2Navigation = v2Active && !mobileV2MoreOpen && !compareTarget
    ? { isTablet, onOpenMore: openMobileV2More } : undefined;

  const navigateMobileV2 = (nextView) => {
    setMobileV2MoreOpen(false);
    setOverflowOpen(false);
    setNotifOpen(false);
    setCompareTarget(null);
    setView(nextView);
    if (nextView === "friends") {
      markGroupsSeen();
      markBadgeSeen("social");
    }
    if (nextView === "board" || nextView === "split" || nextView === "pet") markBadgeSeen(nextView);
  };

  // What's New feature announcements (admin flags.whatsNew, newest first)
  const whatsNewItems = (sysConfig?.flags?.whatsNew || []).filter(w => w?.id && w.title);
  const unseenWhatsNew = whatsNewItems.filter(w => !seenWhatsNewIds.has(w.id));

  const renderNotificationBell = (variant = "topbar") => (
    <div className="tb-wrap notif-wrap">
      <button className={variant === "sidebar" ? "sb-util-btn" : "sync"} onClick={e => { notifLastTriggerRef.current = e.currentTarget; handleOpenNotif(); }} aria-label={hasUnread ? `Notifications, ${unreadTotal} unread` : "Notifications"} aria-expanded={notifOpen}>
        <Bell size={variant === "sidebar" ? 16 : 15} />
        {hasUnread && <span className="notif-badge">{unreadTotal > 9 ? "9+" : unreadTotal}</span>}
      </button>
      <span className="tooltip" role="tooltip">Notifications</span>
      {notifOpen && (
        <>
          <div className="notif-backdrop" onClick={() => setNotifOpen(false)} />
          <div className="notif-panel" role="dialog" aria-labelledby={`notif-panel-title-${variant}`}>
            <div className="notif-panel-top">
              <div className="notif-panel-heading">
                <div>
                  <span className="notif-panel-eyebrow">Your updates</span>
                  <h2 id={`notif-panel-title-${variant}`}>Notifications</h2>
                </div>
                <button className="notif-panel-close" type="button" aria-label="Close notifications" onClick={() => { setNotifOpen(false); notifLastTriggerRef.current?.focus(); }}><X size={17} /></button>
              </div>
              <p className="notif-panel-status">{hasUnread ? `${unreadTotal} unread notification${unreadTotal === 1 ? "" : "s"}` : "You're all caught up"}</p>
              <div className="notif-panel-controls">
                <div className="bell-chips" role="group" aria-label="Filter notifications">
                  {[["all", "All"], ["social", "Social"], ["classes", "Classes"]].map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      aria-pressed={notifFilter === id}
                      className={`bell-chip${notifFilter === id ? " on" : ""}`}
                      onClick={() => setNotifFilter(id)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {hasUnread && <button className="rc-mark-all" onClick={markAllRead}>Mark all read</button>}
              </div>
            </div>
            <div className="notif-panel-feed">
            {(() => {
              const showSocial = notifFilter !== "classes";
              const showClasses = notifFilter !== "social";
              const socialEmpty = friendNotifItems.length === 0;
              const classesEmpty = alertItems.length === 0 && filteredChanges.length === 0;
              if ((!showSocial || socialEmpty) && (!showClasses || classesEmpty)) {
                return <div className="notif-empty"><Bell size={23} strokeWidth={1.7} /><strong>{notifFilter === "social" ? "No social updates" : notifFilter === "classes" ? "No class updates" : "Nothing here yet"}</strong><span>{notifFilter === "social" ? "Friend activity will appear here." : notifFilter === "classes" ? "Class alerts and timetable changes will appear here." : "New activity will appear here when it arrives."}</span></div>;
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
                            onKeyDown={e => { if (item.kind !== "friend_request" && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); markPingRead(item.pingId); } }}
                            role={item.kind !== "friend_request" ? "button" : undefined}
                            tabIndex={item.kind !== "friend_request" ? 0 : undefined}
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
                        <button className="np-link" onClick={() => { setNotifOpen(false); setView("friends"); }}>Go to Social</button>
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
                          <li key={a.id} className={`rc-item rc-item-clickable${a.read_at ? " rc-item-read" : ""}`} role="button" tabIndex={0} onClick={() => markAlertRead(a.id)} onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); markAlertRead(a.id); } }}>
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
            {notifFilter !== "social" && <div className="notif-panel-footer"><button type="button" onClick={handleViewAllNotifs}>Open announcements <ExternalLink size={14} /></button></div>}
          </div>
        </>
      )}
    </div>
  );

  const renderSbAvatarWrap = () => (
    <div className="sb-avatar-wrap" onMouseEnter={(e) => showSbTip(e, "Profile", true)} onMouseLeave={hideSbTip}>
      <button className="sb-avatar-btn" onClick={(e) => { e.stopPropagation(); setSbProfileOpen(o => !o); hideSbTip(); }} aria-label="Profile" aria-expanded={sbProfileOpen}>
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
      <div ref={sbProfileMenuRef} className={`sb-profile-pop ${sbProfileOpen ? "sb-open" : ""}`} role="group" aria-label="Profile and settings">
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
          <span className="sb-pop-version">v{__APP_VERSION__.split("+")[0].replace(/\.0$/, "")}</span>
        </div>
        <div className="sb-pop-sep" />
        <div className="sb-pop-style">
          <span className="sb-pop-style-label">Sidebar</span>
          <div className="sb-pop-seg">
            <button className={sbStyle === "classic" ? "on" : ""} onClick={() => setSidebarStyle("classic")}>Classic</button>
            <button className={sbStyle === "aurora" ? "on" : ""} onClick={() => setSidebarStyle("aurora")}>Aurora</button>
          </div>
        </div>
        {isTablet && (
          <>
            <div className="sb-pop-sep" />
            <div className="sb-pop-style">
              <span className="sb-pop-style-label">Interface</span>
              <div className="sb-pop-seg" role="radiogroup" aria-label="Tablet interface">
                <button type="button" role="radio" aria-checked={mobileUiVersion === "v1"} className={mobileUiVersion === "v1" ? "on" : ""} onClick={() => setMobileUiVersion("v1")}>V1</button>
                <button type="button" role="radio" aria-checked={mobileUiVersion === "v2"} className={mobileUiVersion === "v2" ? "on" : ""} onClick={() => setMobileUiVersion("v2")}>V2</button>
              </div>
            </div>
          </>
        )}
        <div className="sb-pop-sep" />
        <button className="sb-pop-pref" onClick={toggleGreetingPets} aria-pressed={greetingPetsEnabled}>
          Your Pet <strong>{greetingPetsEnabled ? "On" : "Off"}</strong>
        </button>
        <button className="sb-pop-signout" onClick={() => signOut()}>
          <LogOut size={14} /> Sign out
        </button>
      </div>
    </div>
  );

  const renderSbUtilStrip = () => (
    <div className="sb-util-strip">
      {renderNotificationBell("sidebar")}
      <button className="sb-util-btn" onMouseEnter={e => showSbTip(e, "Add to Calendar", true)} onMouseLeave={hideSbTip} onClick={() => { openCalendarExport(); hideSbTip(); }} aria-label="Add to Calendar">
        <CalendarEventBadgeSVG size={16} />
      </button>
      <button className="sb-util-btn" onMouseEnter={e => showSbTip(e, "Edit setup", true)} onMouseLeave={hideSbTip} onClick={() => { openEditSetup(); hideSbTip(); }} aria-label="Edit setup">
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

  // Optional Today cards share one renderer so visibility and ordering apply
  // to the real content. Notices and attendance prompts stay above this stack.
  const todayTimeline = (
    todayList.length === 0 && tomorrowList.length === 0
      ? premiumMode && syncing
        ? (
          <ul className="rail">
            <li className="row premium-skeleton" style={{ height: "80px", marginBottom: "12px", border: "none" }} />
            <li className="row premium-skeleton" style={{ height: "80px", marginBottom: "12px", border: "none", opacity: 0.7 }} />
            <li className="row premium-skeleton" style={{ height: "80px", marginBottom: "12px", border: "none", opacity: 0.4 }} />
          </ul>
        )
        : <div className="tmrw-summary-card tmrw-free-card theme-clear" style={{ margin: "0 12px 20px" }}>
            <div className="tmrw-free-head">
              <span className="tmrw-free-kicker-pill">
                <span className="tmrw-free-kicker-dot" />
                Today · Free Day
              </span>
              {weather?.today && dashboardCardVisible(dashboardPrefs, "weather") && (
                <span className="tmrw-free-wx-pill">
                  <span>{weather.today.min}°–{weather.today.max}°C</span>
                </span>
              )}
            </div>
            <div className="tmrw-free-scene" aria-hidden="true">
              <FreeDayIllustration kind="clear" isNight={now.getHours() >= 19 || now.getHours() < 6} />
            </div>
            <div className="tmrw-free-text">
              <div className="tmrw-free-title">No classes today!</div>
              <div className="tmrw-free-sub">Enjoy your free time.</div>
            </div>
            {/* The companion has a mood for exactly this day — "relaxed"
                before three, "cozy" after — and nowhere to show it until now. */}
            {enableCompanion && (
              <PetCameo
                pet={myPet}
                now={now}
                petContext={petContext}
                petSettings={sysConfig?.flags?.greetingPets}
                size={52}
                className="tmrw-free-pet"
              />
            )}
          </div>
      : <>
            <Timeline list={todayList} current={current} now={now} dateLabel={prettyDate(todayISO)} attendance={attendance} markAttendance={markAttendance} skipInfo={skipInfo} syncStatus={<span className="live"><span className="pulse" /> {scheduleData?._source === "live" ? `Live · synced ${syncedAgo === 0 ? "just now" : `${syncedAgo}m ago`}` : "Saved schedule"}</span>} onRefresh={handleSync} isSyncing={syncing} premiumMode={premiumMode} onOpenSession={setClassPrepSession} focusMode={todayFocusMode} />
          </>
  );
  const todayCards = view === "today" && !compareTarget ? {
    upcoming: <Hero current={current} next={next} now={now} todayISO={todayISO} tomorrowISO={tomorrowISO} premiumMode={premiumMode} onMarkAttendance={markAttendance} attendance={attendance} sysConfig={sysConfig} onTap={() => setView("fullSchedule")} todayList={todayList} />,
    summary: <div className={`dashboard-widgets dashboard-widgets-today${dashboardPrefs.density === "compact" ? " is-compact" : ""}`}><div className="dashboard-widget-summary"><SemSummary enrolled={enrolled} legend={LEGEND} attendance={attendance} visible={visible} todayISO={todayISO} now={now} classes={CLASSES} onAttendanceClick={enableAttendance ? () => setView("attendance") : undefined} onExamsClick={enableExams ? () => setView("exams") : undefined} onSessionsClick={() => setView("fullSchedule")} /></div></div>,
    timeline: todayTimeline,
    mess: <MessCard now={now} userId={userId} friends={enableStatus ? friends : []} />,
    todayCommand: !isArchivedView ? (
      <TodayCommandCenter
        key={todayISO}
        todayList={todayList}
        tomorrowList={tomorrowList}
        attendance={attendance}
        now={now}
        todayISO={todayISO}
        termNumber={activeTerm?.number}
        changeCount={todayChangeCount}
        onNavigate={(target) => { setView(target); setCompareTarget(null); }}
        onOpenSession={setClassPrepSession}
        onOpenCourse={(code) => { setCourseHubCode(code); setView("courseHub"); setCompareTarget(null); }}
        onMarkAttendance={markAttendance}
        focusMode={todayFocusMode}
        onFocusModeChange={setTodayFocusMode}
        onRemove={() => {
          setTodayFocusMode(false);
          setDashboardPrefs(currentPrefs => ({
            ...currentPrefs,
            visible: { ...currentPrefs.visible, todayCommand: false },
          }));
        }}
      />
    ) : null,
    deadlines: <DeadlineStrip visible={visible} legend={enrolledLegend} now={now} onOpenAssignments={() => { setView("assignments"); setCompareTarget(null); }} onOpenExams={enableExams ? () => { setView("exams"); setCompareTarget(null); } : undefined} />,
  } : {};

  return (
    <div className={`app-shell${v2Active ? " mobile-ui-v2" : " mobile-ui-v1"}`}>
      {/* Skip link: first tab stop, jumps past the sidebar/top bar. Focus is
          moved by hand so the URL hash (used by back-button history) stays. */}
      <a
        className="skip-link"
        href="#main-content"
        onClick={(e) => { e.preventDefault(); document.getElementById("main-content")?.focus(); }}
      >
        Skip to content
      </a>
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
        <div className="app-toast">
          <Users size={15} aria-hidden="true" /> {friendToast}
        </div>
      )}

      {/* ── XP gain toast (pet earns XP from attendance / assignments) ── */}
      {xpToastQueue.length > 0 && (
        <XpToast
          key={xpToastQueue[0].id}
          pet={myPet}
          petContext={petContext}
          petSettings={sysConfig?.flags?.greetingPets}
          xp={xpToastQueue[0].xp}
          label={xpToastQueue[0].label}
          firstOfDay={xpToastQueue[0].firstOfDay}
          unlock={xpToastQueue[0].unlock}
          onDone={() => setXpToastQueue(q => q.slice(1))}
        />
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
      {/* Current-class sidebar card is parked with SidebarClassStatus for now. */}
      <DesktopSidebar
        sbCollapsed={sbCollapsed} sbStyle={sbStyle} specialDay={specialDay} termLabel={termLabel}
        termProgressPct={termProgressPct} termWeekInfo={termWeekInfo} termSwitcherEl={termSwitcherEl}
        isOffline={isOffline} setCmdOpen={setCmdOpen} isMac={isMac} view={view} showSbTip={showSbTip}
        hideSbTip={hideSbTip} setView={setView} preloadView={preloadView} setCompareTarget={setCompareTarget}
        enableAttendance={enableAttendance} enableExams={enableExams} unreadChangeCount={unreadChangeCount}
        enableFriends={enableFriends} markGroupsSeen={markGroupsSeen} markBadgeSeen={markBadgeSeen}
        showBadge={showBadge} unreadFriendCount={unreadFriendCount} showSbTools={showSbTools}
        wrappedActive={wrappedActive} companionEnabled={enableCompanion}
        setSbToolsOpen={setSbToolsOpen}
        setMessMenuOpen={setMessMenuOpen} activeQuickLinks={activeQuickLinks} showAdminUI={showAdminUI}
        renderSbUtilStrip={renderSbUtilStrip} renderSbAvatarWrap={renderSbAvatarWrap} syncing={syncing}
        syncedAgo={syncedAgo} isTablet={isTablet} sidebarCollapsed={sidebarCollapsed} toggleSidebar={toggleSidebar}
        tabletControls={v2Active && isTablet} tabletSidebarOpen={tabletSidebarOpen} onCloseTabletSidebar={closeTabletSidebar}
      />

      <SbFloatTip />

      <div className="app">
        <header className="bar">
          <div className="brand">
            <div className="logo"><img src="/termflow-icon.svg" alt="TermFlow" width={22} height={22} /></div>
            <div>
              <div className="brand-name">
                <span className="mobile-v1-only">TermFlow</span>
                <span className="mobile-v2-only">{mobileV2Title}</span>
              </div>
              <div className="brand-sub">
                <span className="mobile-v1-only">IIM Sambalpur · {termLabel}</span>
                <span className="mobile-v2-only">{mobileV2MoreOpen ? "Your campus, tools and settings" : termLabel}</span>
              </div>
            </div>
          </div>
          <div className="bar-right" role="toolbar" aria-label="App actions">
            <div className="tb-wrap desktop-only">
              <button className="sync" onClick={openEditSetup} aria-label="Edit setup"><Settings2 size={15} /></button>
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
                  <div ref={profileMenuRef} className="over-menu" role="group" aria-label="Profile and settings">
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
                    <div className="over-version">v{__APP_VERSION__.split("+")[0].replace(/\.0$/, "")}</div>
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
                  <div ref={overflowMenuRef} className={`over-menu${v2Active ? " mobile-v2-quick-menu" : ""}`} role="group" aria-label="More options">
                    <MobileUiVersionMenu
                      version={mobileUiVersion}
                      onVersionChange={(next) => {
                        setMobileUiVersion(next);
                        setMobileV2MoreOpen(false);
                        setOverflowOpen(false);
                      }}
                      theme={theme}
                      onThemeChange={pickTheme}
                      showAppearance={v2Active}
                    />
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
                    <button onClick={() => { openEditSetup(); setOverflowOpen(false); }}>
                      <Settings2 size={14} /> Edit setup
                    </button>

                    {/* ── Term (Live / Archive) ── */}
                    {ARCHIVED_TERMS.length > 0 && (
                      <>
                        <div className="over-sep" />
                        <button aria-expanded={termMenuOpen} onClick={() => setTermMenuOpen(o => !o)}>
                          {isArchivedView ? <History size={14} /> : <Radio size={14} className="over-term-live-icon" />}
                          Term {selectedTerm ?? TERM?.number}
                          <span className="over-term-badge">{isArchivedView ? "Archive" : "Live"}</span>
                          <ChevronDown size={13} className={`over-caret${termMenuOpen ? " open" : ""}`} />
                        </button>
                        {termMenuOpen && (
                          <div className="over-sub">
                            <button className="over-term-row" onClick={() => { pickTerm(TERM?.number ?? "", true); setTermMenuOpen(false); }}>
                              <span className="over-term-row-top">
                                <Radio size={14} className="over-term-live-icon" /> Term {TERM?.number}
                                {!isArchivedView && <Check size={14} className="over-check" />}
                              </span>
                              <span className="over-term-hint">Live</span>
                            </button>
                            {ARCHIVED_TERMS.map((t) => (
                              <button key={t.number} className="over-term-row" onClick={() => { pickTerm(t.number, false); setTermMenuOpen(false); }}>
                                <span className="over-term-row-top">
                                  <History size={14} /> Term {t.number}
                                  {selectedTerm === t.number && <Check size={14} className="over-check" />}
                                </span>
                                <span className="over-term-hint">View</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </>
                    )}

                    {/* ── Recent (Tools views visited recently, only while Tools itself
                         is collapsed — avoids showing the same item twice) ── */}
                    {!toolsSecOpen && recentToolViews.filter(v => v !== view && TOOLS_VIEWS.includes(v) && (v !== "pet" || enableCompanion) && (v !== "wrapped" || wrappedActive)).length > 0 && (
                      <>
                        <div className="over-sep" />
                        <div className="over-section-label">Recent</div>
                        {recentToolViews.filter(v => v !== view && TOOLS_VIEWS.includes(v) && (v !== "pet" || enableCompanion) && (v !== "wrapped" || wrappedActive)).map(v => {
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
                        <button onClick={() => { setView("courseHub"); setCompareTarget(null); setOverflowOpen(false); }}>
                          <BookOpenCheck size={14} /> Courses
                        </button>
                        <button onClick={() => { setView("planner"); setCompareTarget(null); setOverflowOpen(false); }}>
                          <LayoutDashboard size={14} /> Personal planner
                        </button>
                        <button onClick={() => { setMessMenuOpen(true); setOverflowOpen(false); }}>
                          <UtensilsCrossed size={14} /> Mess menu
                        </button>
                        <button onClick={() => { setView("split"); setCompareTarget(null); setOverflowOpen(false); }}>
                          <Wallet size={14} /> Split
                        </button>
                        {enableCompanion && (
                          <button onClick={() => { setView("pet"); setCompareTarget(null); setOverflowOpen(false); }}>
                            <PawPrint size={14} /> Companion
                          </button>
                        )}
                        <button onClick={() => { setView("board"); setCompareTarget(null); setOverflowOpen(false); }}>
                          <Package size={14} /> Campus Board
                        </button>
                        {wrappedActive && (
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
                        <button onClick={toggleGreetingPets} aria-pressed={greetingPetsEnabled}>
                          Your Pet {greetingPetsEnabled ? "on" : "off"}
                        </button>
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
                              <button onClick={() => { setView("admin"); setCompareTarget(null); setOverflowOpen(false); }} style={{ color: "var(--live-text)" }}>
                                <Shield size={14} color="var(--live-text)" /> Admin Dashboard
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

        <div data-view={compareTarget ? "compare" : view} className={`desk-layout${view === "today" && todayFocusMode ? " today-focus-mode" : ""}`} style={view === "friends" || view === "admin" || view === "wrapped" || view === "planner" || view === "courseHub" || view === "fullSchedule" || (view === "today" && (!dashboardPrefs.weekPanel || todayFocusMode)) ? { gridTemplateColumns: "minmax(0, 1fr)" } : {}}>
          <main className="main-col">
            {v2Active && !mobileV2MoreOpen && (
              <MobileV2Switcher view={view} examsEnabled={enableExams} onNavigate={navigateMobileV2} />
            )}
            {v2Navigation && view !== "courseHub" && view !== "split" && (
              <MobileV2Breadcrumbs view={view} {...v2Navigation} />
            )}
            {showTopTabs && (
            <div className="tabs-wrapper">
              <nav className={`tabs${showLeftScroll ? " tabs-scrolled" : ""}${showRightScroll ? " tabs-overflow-right" : ""}`} ref={tabsRef} onScroll={handleTabsScroll}>
                <NavButton nav="today" className="tab" aria-label="Today" onClick={() => { setView("today"); setCompareTarget(null); }}>
                  <Clock size={15} /> <span className="tab-label">Today</span>
                </NavButton>
                <NavButton nav="tomorrow" className="tab" aria-label="Tomorrow" onClick={() => { setView("tomorrow"); setCompareTarget(null); }}>
                  <Sunrise size={15} /> <span className="tab-label">Tomorrow</span>
                </NavButton>
                <NavButton nav="week" className="tab tab-week" aria-label="Week" onClick={() => { setView("week"); setCompareTarget(null); }}>
                  <Calendar size={15} /> <span className="tab-label">Week</span>
                </NavButton>
                {enableAttendance && (
                  <NavButton nav="attendance" className="tab" aria-label="Attendance" onClick={() => { setView("attendance"); setCompareTarget(null); }}>
                    <ClipboardList size={15} /> <span className="tab-label">Attendance</span>
                  </NavButton>
                )}
                {enableExams && (
                  <NavButton nav="exams" className="tab" aria-label="Exams" onClick={() => { setView("exams"); setCompareTarget(null); }}>
                    <GraduationCap size={15} /> <span className="tab-label">Exams</span>
                  </NavButton>
                )}
                <NavButton nav="notifications" className="tab" aria-label={unreadChangeCount > 0 ? `Announcements, ${unreadChangeCount} unread` : "Announcements"} onClick={() => { setView("notifications"); setCompareTarget(null); }}>
                  <Megaphone size={15} /> <span className="tab-label">Announcements</span>
                  {unreadChangeCount > 0 && <span className="nav-badge">{unreadChangeCount}</span>}
                </NavButton>
                <NavButton nav="assignments" className="tab" aria-label="Assignments" onClick={() => { setView("assignments"); setCompareTarget(null); }}>
                  <BookOpenCheck size={15} /> <span className="tab-label">Assignments</span>
                </NavButton>
                {enableFriends && (
                  <NavButton nav="friends" className="tab" aria-label={unreadFriendCount > 0 ? `Social, ${unreadFriendCount} unread` : "Social"} onClick={() => { setView("friends"); setCompareTarget(null); markGroupsSeen(); markBadgeSeen("social"); }}>
                    <Users size={15} /> <span className="tab-label">Social</span> {showBadge("social") && <span className="beta-badge tab-label">Beta</span>}
                    {unreadFriendCount > 0 && <span className="nav-badge">{unreadFriendCount}</span>}
                  </NavButton>
                )}
              </nav>
            </div>
            )}



            {view !== "split" && view !== "attendance" && view !== "notifications" && view !== "exams" && view !== "friends" && view !== "fullSchedule" && view !== "assignments" && view !== "courseHub" && view !== "leave" && view !== "glance" && view !== "wrapped" && view !== "board" && !compareTarget && (
              <>
                {unseenWhatsNew.length > 0 && (
                  <WhatsNewPill item={unseenWhatsNew[0]} count={unseenWhatsNew.length} onOpen={() => setWhatsNewOpen(true)} />
                )}
                {mostRecentArchivedTerm && todayISO >= (TERM?.start || "9999") && (!wrappedNudgeUntil || todayISO <= wrappedNudgeUntil) && !seenWrappedNudges.has(mostRecentArchivedTerm.number) && (
                  <WhatsNewPill
                    item={{ emoji: "🎓", title: `Your Term ${mostRecentArchivedTerm.number} Wrapped is ready` }}
                    onOpen={() => {
                      setSelectedTerm(mostRecentArchivedTerm.number);
                      setView("wrapped");
                      setCompareTarget(null);
                      dismissWrappedNudge(mostRecentArchivedTerm.number);
                    }}
                  />
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
                {view === "today" && <DayGreeting now={now} name={user?.firstName || user?.username} petSettings={sysConfig?.flags?.greetingPets} userPetsEnabled={greetingPetsEnabled} pet={myPet} petActions={petActions} petContext={petContext} companionEnabled={enableCompanion} onOpenPet={() => setView("pet")} />}
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
                    {view === "today" && <DashboardCustomize prefs={dashboardPrefs} onChange={setDashboardPrefs} compact={compactViewport} />}
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
                    {(view !== "today" || dashboardCardVisible(dashboardPrefs, "weather")) && <WeatherWidget now={now} weather={weather} />}
                  </div>
                </div>
                {(view === "today" || view === "tomorrow" || view === "week") && <ScheduleStatus
                  source={scheduleData?._source}
                  isOffline={isOffline}
                  syncing={syncing}
                  syncedAt={syncedAt}
                  error={syncLogs[0]?.status === "error" ? syncLogs[0].message : null}
                  onRetry={handleSync}
                />}
              </>
            )}
            {view !== "split" && view !== "attendance" && view !== "notifications" && view !== "exams" && view !== "friends" && view !== "fullSchedule" && view !== "assignments" && view !== "courseHub" && view !== "leave" && view !== "glance" && view !== "wrapped" && view !== "board" && view !== "admin" && view !== "planner" && view !== "pet" && !compareTarget && view !== "tomorrow" && view !== "today" && (
              view === "week"
                ? <div className="hide-mobile"><Hero current={current} next={next} now={now} todayISO={todayISO} tomorrowISO={tomorrowISO} premiumMode={premiumMode} onMarkAttendance={markAttendance} attendance={attendance} sysConfig={sysConfig} onTap={() => setView("fullSchedule")} todayList={todayList} /></div>
                : <Hero current={current} next={next} now={now} todayISO={todayISO} tomorrowISO={tomorrowISO} premiumMode={premiumMode} onMarkAttendance={markAttendance} attendance={attendance} sysConfig={sysConfig} onTap={() => setView("fullSchedule")} todayList={todayList} />
            )}
            {view === "week" && !compareTarget && (
              <div className="mobile-only">
                <WeekGlance visible={visible} now={now} offset={weekOffset} todayISO={todayISO} collapsible />
              </div>
            )}
            {(view === "today" || view === "tomorrow") && !compareTarget &&
              (provisionalSections.size > 0 || unscheduledCourses.length > 0) && (
              <ProvisionalSectionNotice
                codes={[...provisionalSections]}
                unscheduled={unscheduledCourses}
                legend={enrolledLegend}
                sectionsByCode={sectionsByCode}
              />
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
                  <span>Back on {fmtAwayEnd(myAway.to)} · friends can see this too</span>
                </span>
                <span className="away-banner-go">Manage →</span>
              </button>
            )}
            {view === "today" && !compareTarget && !isArchivedView && isTermVLastWeek && (
              <button type="button" className="wrapped-banner" onClick={() => { setView("wrapped"); setCompareTarget(null); }}>
                <Sparkles size={18} />
                <span>
                  <strong>Your Term, Wrapped</strong>
                  <span>Your semester in numbers — see your recap</span>
                </span>
                <span className="wrapped-banner-go">Open →</span>
              </button>
            )}
            {view === "today" && !compareTarget && (
              <MarkPrompt list={todayList} now={now} attendance={attendance} markAttendance={markAttendance} />
            )}
            {view === "week" && !compareTarget && (
              <div className={`dashboard-widgets${view === "today" ? " dashboard-widgets-today" : ""}${dashboardPrefs.density === "compact" ? " is-compact" : ""}`}>
                <div className="dashboard-widget-summary"><SemSummary enrolled={enrolled} legend={LEGEND} attendance={attendance} visible={visible} todayISO={todayISO} now={now} classes={CLASSES} onAttendanceClick={enableAttendance ? () => setView("attendance") : undefined} onExamsClick={enableExams ? () => setView("exams") : undefined} onSessionsClick={() => setView("fullSchedule")} /></div>
              </div>
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
                tomorrowISO={tomorrowISO}
                nextClass={nextClassAfterTomorrow}
                onOpenMess={() => setMessMenuOpen(true)}
                onOpenAssignments={() => { setView("assignments"); setCompareTarget(null); }}
                onViewFullSchedule={(targetDate) => {
                  if (targetDate) setJumpToDate(targetDate);
                  setView("fullSchedule");
                  setCompareTarget(null);
                }}
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
                aria-label={`${current ? "Now" : "Up next"}: ${(current || next).name} at ${fmtTime12((current || next).start)}. Go to Today.`}
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
                <span className="now-banner-time">{fmtTime12((current || next).start)}{current ? `–${fmtTime12(current.end)}` : ""}</span>
                <span className="now-banner-go">Today →</span>
              </button>
            )}
            <div
              key={`${view}:${compareTarget ? "compare" : "primary"}`}
              className={`${view === "week" ? "pane-today hide-mobile" : "pane-today"} tf-page-stage`}
              data-page={view}
              id="main-content"
              tabIndex={-1}
              role="region"
              aria-label={compareTarget ? "Compare schedules" : viewTitle(view).replace(/ · TermFlow$/, "")}
            >
              <Suspense fallback={<div className="loading-screen" style={{ minHeight: "300px" }} role="status" aria-live="polite"><TermFlowLoader size={48} /><span className="tf-section-loading">Opening your page…</span></div>}>
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
                          : [...(g.memberIds || []).map(id => friends.find(f => f.id === id)?.cloudId).filter(Boolean),
                              ...(g.inviteMembers || []).map(m => m.userId)];
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
                      groupInviteToken={pendingGroupInvite}
                      onGroupInviteConsumed={() => { setPendingGroupInvite(null); try { localStorage.removeItem("pgp2.pending-group-invite"); } catch { } }}
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
                      petsEnabled={enableCompanion}
                      onOpenLeave={() => { setView("leave"); setCompareTarget(null); }}
                      onCompare={(f) => setCompareTarget({ mode: "friend", friendData: f })}
                      onGroupCompare={async (g) => {
                        let members;
                        if (g.isReceived && g.cloudMemberIds) {
                          const ids = g.cloudMemberIds.filter(cid => cid !== userId);
                          const { data } = ids.length ? await supabase.from("profiles").select("user_id, courses").in("user_id", ids) : { data: [] };
                          members = (data || []).map(p => ({ name: friends.find(f => f.cloudId === p.user_id)?.name || p.courses?._name || g.ownerName || "Member", courses: p.courses || {} }));
                        } else {
                          members = (g.memberIds || []).map(id => friends.find(f => f.id === id)).filter(Boolean).map(f => ({ name: f.name, courses: f.courses }));
                          const inviteIds = (g.inviteMembers || []).map(m => m.userId);
                          if (inviteIds.length) {
                            const { data } = await supabase.from("profiles").select("user_id, courses").in("user_id", inviteIds);
                            members.push(...(data || []).map(p => ({ name: g.inviteMembers.find(m => m.userId === p.user_id)?.name || "Member", courses: p.courses || {} })));
                          }
                        }
                        setCompareTarget({ mode: "group", groupData: { name: g.name, members }, group: g });
                      }}
                      meetupsEnabled={enableMeetups}
                      nudgeEnabled={enableFreeNudge}
                      awayEnabled={enableAwayShare}
                      planDraft={planDraft}
                      onPlanDraftConsumed={() => setPlanDraft(null)}
                    />
                    : view === "courseHub"
                      ? <CourseHub
                          v2Navigation={v2Navigation}
                          key={userId || "guest"}
                          allClasses={activeClasses}
                          enrolled={activeEnrolled}
                          legend={activeEnrolledLegend}
                          attendance={attendance}
                          now={now}
                          termNumber={activeTerm?.number}
                          userId={userId}
                          isOffline={isOffline}
                          isArchived={isArchivedView}
                          selectedCode={courseHubCode}
                          onSelectCode={selectHubCourse}
                          onOpenSchedule={(item) => { setJumpToSession({ date: item.date, code: item.code, start: item.start }); setView("fullSchedule"); }}
                          onNavigate={(nextView) => { setView(nextView); setCompareTarget(null); }}
                          onOpenTask={isArchivedView ? undefined : (code, task) => { setAssignmentOpenTarget({ code, task }); setView("assignments"); }}
                        />
                    : view === "planner"
                      ? <StudentPlanner
                          section={plannerSection}
                          onSectionChange={setPlannerSection}
                          leavePlanner={<LeavePlanner
                            allClasses={CLASSES}
                            enrolled={enrolled}
                            legend={enrolledLegend}
                            attendance={attendance}
                            now={now}
                            termStart={TERM?.start}
                            termEnd={TERM?.end}
                            onOpenAttendance={enableAttendance ? () => { setView("attendance"); setCompareTarget(null); } : undefined}
                            userId={userId}
                            awayEnabled={enableAwayShare}
                            onAwayChange={setMyAway}
                          />}
                          visible={activeVisible}
                          today={activeVisible.filter(c => c.date === todayISO).sort((a, b) => toMin(a.start) - toMin(b.start))}
                          tomorrow={activeVisible.filter(c => c.date === tomorrowISO).sort((a, b) => toMin(a.start) - toMin(b.start))}
                          now={now}
                          attendance={attendance}
                          enrolled={activeEnrolled}
                          legend={activeEnrolledLegend}
                          changes={activeChanges.filter(c => !c.code || activeMine.has(c.code))}
                          readChangeKeys={readChangeKeys}
                          changeKeyOf={changeKey}
                          isOffline={isOffline}
                          syncing={syncing}
                          syncedAgo={syncedAgo}
                          onSync={handleSync}
                          onNavigate={(nextView) => { setView(nextView); setCompareTarget(null); }}
                          onOpenChange={(c) => { setJumpToSession({ date: c.date, code: c.code, start: c.start }); setView("fullSchedule"); }}
                        />
                    : view === "exams"
                      ? <ExamsPanel
                        allClasses={activeClasses}
                        enrolled={activeEnrolled}
                        legend={activeEnrolledLegend}
                        allCodes={Object.keys(activeLegend)}
                        now={now}
                        termNumber={activeTerm?.number}
                        termStart={activeTerm?.start}
                        termEnd={activeTerm?.end}
                        attendance={attendance}
                        onOpenCalendarExport={isArchivedView ? undefined : openCalendarExport}
                        onOpenCourse={(code) => { setCourseHubCode(code); setView("courseHub"); }}
                      />
                      : view === "attendance"
                        ? <AttendancePanel
                          allClasses={activeClasses}
                          now={now}
                          attendance={attendance}
                          enrolled={activeEnrolled}
                          legend={activeEnrolledLegend}
                          markAttendance={isArchivedView ? undefined : markAttendance}
                          weather={weather}
                          termNumber={activeTerm?.number}
                          onOpenCourse={(code) => { setCourseHubCode(code); setView("courseHub"); }}
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
                              onOpenCalendarExport={isArchivedView ? undefined : openCalendarExport}
                            />
                          : view === "admin" && isAdmin
                            ? <AdminDashboard user={user} startImpersonation={startImpersonation} syncLogs={syncLogs} timeOverride={timeOverride} setTimeOverride={setTimeOverride} allChanges={CHANGES} onConfigSaved={flags => setSysConfig(current => ({ ...(current || {}), flags }))} />
                            : view === "fullSchedule"
                              ? <FullSchedulePage allClasses={activeClasses} enrolled={activeEnrolled} legend={activeEnrolledLegend} termLabel={termLabel} onBack={() => setView("today")} jumpToDate={jumpToDate} setJumpToDate={setJumpToDate} jumpToSession={jumpToSession} setJumpToSession={setJumpToSession} onOpenCalendarExport={isArchivedView ? undefined : openCalendarExport} onOpenCourse={(code) => { setCourseHubCode(code); setView("courseHub"); }} />
                              : view === "assignments"
                                ? <AssignmentsPanel
                                    enrolled={enrolled}
                                    legend={enrolledLegend}
                                    userId={userId}
                                    openTarget={assignmentOpenTarget}
                                    onOpenTargetConsumed={() => setAssignmentOpenTarget(null)}
                                    onOpenCourse={(code) => { setCourseHubCode(code); setView("courseHub"); }}
                                    onTaskCompleted={taskId => {
                                      const dueKey = petKeyFor.deadline(taskId);
                                      const isNew = petActions.awardXp(dueKey, petXP.deadline);
                                      if (isNew && enableCompanion && isAdopted(myPet)) {
                                        setXpToastQueue(q => [...q, { id: dueKey, xp: petXP.deadline, label: "assignment", firstOfDay: false }]);
                                      }
                                    }}
                                  />
                              : view === "pet" && enableCompanion
                                ? <PetPage
                                    pet={myPet}
                                    companionMemory={companionMemory}
                                    petActions={petActions}
                                    petContext={petContext}
                                    petSettings={sysConfig?.flags?.greetingPets}
                                    now={now}
                                    onBack={() => { setView("today"); setCompareTarget(null); }}
                                  />
                              : view === "board"
                                ? <BoardPage
                                    userId={userId}
                                    userName={user?.firstName || user?.username || "Student"}
                                    isAdmin={isAdmin}
                                  />
                              : view === "split"
                                ? <SplitPage
                                    v2Navigation={v2Navigation}
                                    userId={userId}
                                    userName={user?.firstName || user?.username || "Student"}
                                    friends={friends}
                                    initialGroupId={splitDeepLink}
                                    initialJoinId={splitJoinLink}
                                    onConsumeDeepLink={() => { setSplitDeepLink(null); setSplitJoinLink(null); clearSplitInvite(); }}
                                  />
                              : view === "wrapped"
                                ? <WrappedView
                                    visible={activeVisible}
                                    legend={activeEnrolledLegend}
                                    attendance={attendance}
                                    now={now}
                                    termLabel={termLabel}
                                    userName={user?.firstName || user?.username || "Student"}
                                    isArchived={isArchivedView}
                                    previousTerm={previousWrappedInput}
                                    previousTermNumber={!isArchivedView ? mostRecentArchivedTerm?.number : null}
                                    onViewPrevious={!isArchivedView && mostRecentArchivedTerm ? () => { setSelectedTerm(mostRecentArchivedTerm.number); setCompareTarget(null); } : null}
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
                                  : tomorrowList.length === 0
                                    ? null
                                    : <Timeline list={tomorrowList} current={null} now={now} showNowLine={false} label="Tomorrow" attendance={attendance} markAttendance={markAttendance} skipInfo={skipInfo} syncStatus={<span className="live"><span className="pulse" /> {scheduleData?._source === "live" ? `Live · synced ${syncedAgo === 0 ? "just now" : `${syncedAgo}m ago`}` : "Saved schedule"}</span>} onRefresh={handleSync} isSyncing={syncing} premiumMode={premiumMode} onOpenSession={setClassPrepSession} />
                              : view === "today"
                                ? <TodayDashboard prefs={dashboardPrefs} cards={todayCards} onExitFocus={() => setTodayFocusMode(false)} />
                                : todayTimeline}
              </Suspense>
              {view === "tomorrow" && !compareTarget && (
                <DeadlineStrip
                  visible={visible}
                  legend={enrolledLegend}
                  now={now}
                  onOpenAssignments={() => { setView("assignments"); setCompareTarget(null); }}
                  onOpenExams={enableExams ? () => { setView("exams"); setCompareTarget(null); } : undefined}
                />
              )}
            </div>
          </main>
          <aside className={view !== "week" ? "side-col hide-mobile" : "side-col side-col-week"} style={view === "friends" || view === "admin" || view === "wrapped" || view === "planner" || view === "courseHub" || view === "fullSchedule" || (view === "today" && (!dashboardPrefs.weekPanel || todayFocusMode)) ? { display: "none" } : {}}>
            <WeekAgenda visible={visible} now={now} offset={weekOffset} setOffset={setWeekOffset} todayISO={todayISO} onViewFullSchedule={(iso) => { setJumpToDate(iso); setView("fullSchedule"); }} onOpenSession={setClassPrepSession} />
          </aside>

          {classPrepSession && <ClassPrepSheet session={classPrepSession} termNumber={activeTerm?.number} attendance={attendance} onClose={closePrepSheet} onOpenCourse={(code) => { closePrepSheet(); setCourseHubCode(code); setView("courseHub"); }} onOpenTask={(code, task) => { closePrepSheet(); setAssignmentOpenTarget({ code, task }); setView("assignments"); }} onOpenSchedule={(session) => { closePrepSheet(); setJumpToSession({ date: session.date, code: session.code, start: session.start }); setView("fullSchedule"); }} />}

          {/* Floating Schedule button & Modal for wide-content views —
              the docked agenda is hidden there so the wide content gets the full
              row; desktop only (.fr-agenda-fab is display:none below 900px) */}
          {(view === "friends" || view === "admin" || view === "wrapped" || view === "planner" || view === "courseHub") && (
            <>
              <button className="fr-agenda-fab" onClick={() => setShowFriendsAgenda(true)} title="View Schedule">
                <Calendar size={22} />
              </button>
              {showFriendsAgenda && (
                <ScheduleModal
                  visible={visible}
                  now={now}
                  offset={weekOffset}
                  setOffset={setWeekOffset}
                  todayISO={todayISO}
                  onClose={() => setShowFriendsAgenda(false)}
                  onViewFullSchedule={(iso) => { setShowFriendsAgenda(false); setJumpToDate(iso); setView("fullSchedule"); }}
                />
              )}
            </>
          )}
        </div>

        {v2Active && mobileV2MoreOpen && (
          <MobileV2MorePage
            user={user}
            unreadCount={unreadTotal}
            enableFriends={enableFriends}
            enableCompanion={enableCompanion}
            wrappedActive={wrappedActive}
            showAdmin={showAdminUI}
            onNavigate={navigateMobileV2}
            onOpenMess={() => { setMobileV2MoreOpen(false); setMessMenuOpen(true); }}
            onOpenCalendar={() => { setMobileV2MoreOpen(false); openCalendarExport(); }}
            onFilter={() => { setMobileV2MoreOpen(false); setFilterModalOpen(true); }}
            onEditSetup={() => { setMobileV2MoreOpen(false); openEditSetup(); }}
            onWhatsNew={() => { setMobileV2MoreOpen(false); setWhatsNewOpen(true); }}
            onFeedback={() => { setMobileV2MoreOpen(false); setFeedbackOpen(true); }}
            onOpenGuide={() => { setMobileV2MoreOpen(false); setHelpModalOpen(true); }}
            onSignOut={signOut}
          />
        )}

        <footer className="foot">
          <span className="foot-credit">Auto-syncs from the live timetable sheet every few minutes</span>
          <span className="foot-credit">Built with <span className="foot-heart">♥</span> by <a href="https://www.linkedin.com/in/rakesh-kumar-behera-rk821604/" target="_blank" rel="noopener noreferrer" className="foot-credit-name">Rakesh</a></span>
        </footer>

        {/* Global Help Modal */}
        {helpModalOpen && (
          <div className="fs-modal-overlay" onClick={() => setHelpModalOpen(false)}>
            <div className="fs-modal-content" ref={helpDialogRef} {...dialogProps(null, { labelledBy: "help-modal-title" })} onClick={e => e.stopPropagation()}>

              <div className="fs-modal-header">
                <h3 id="help-modal-title"><BookOpenCheck size={20} color="var(--violet)" aria-hidden="true" /> App Guide</h3>
                <button type="button" className="fs-modal-close" aria-label="Close app guide" onClick={() => setHelpModalOpen(false)}><X size={18}/></button>
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
                    <h3><CalendarEventBadgeSVG size={16} /> Add to Calendar (iOS &amp; Android)</h3>
                    <p>Sync all your classes and exams into Apple Calendar (iOS) or Google Calendar (Android) with custom alarms and reminders in just one tap.</p>
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
            onOpenCalendarExport={openCalendarExport}
          />
        </Suspense>

        {calendarModalOpen && (
          <Suspense fallback={null}>
            <CalendarExportModal
              isOpen={calendarModalOpen}
              userId={userId}
              onClose={() => setCalendarModalOpen(false)}
              allClasses={CLASSES}
              enrolled={enrolled}
              legend={LEGEND}
              termLabel={termLabel}
              initialSelectedCodes={calendarModalConfig?.initialSelectedCodes}
              initialIncludeExams={calendarModalConfig?.initialIncludeExams ?? true}
            />
          </Suspense>
        )}

        {filterModalOpen && (
          <div className="filter-modal-overlay" onClick={() => setFilterModalOpen(false)}>
            <div className="filter-modal-sheet" ref={filterDialogRef} {...dialogProps(null, { labelledBy: "subject-filter-title" })} onClick={e => e.stopPropagation()}>
              <div className="filter-modal-header">
                <h3 id="subject-filter-title">Filter Subjects</h3>
                <button type="button" aria-label="Close subject filter" onClick={() => setFilterModalOpen(false)}><X size={18} /></button>
              </div>
              <div className="filter-modal-scroll">
                 <SubjectFilter legend={enrolledLegend} mine={mine} setMine={setMine} forceOpen={true} onEditSetup={() => { openEditSetup(); setFilterModalOpen(false); }} />
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
            className="bnav"
            aria-label="Main navigation"
          >
            <BnavLens />
            <NavButton nav="today" className="bnav-btn" aria-label="Today" onClick={() => { setView("today"); setCompareTarget(null); }}>
              <span className="bnav-icon"><NavIcon kind="today" /></span>
            </NavButton>
            <NavButton nav="tomorrow" className="bnav-btn" aria-label="Tomorrow" onClick={() => { setView("tomorrow"); setCompareTarget(null); }}>
              <span className="bnav-icon"><NavIcon kind="tomorrow" /></span>
            </NavButton>
            <NavButton nav="week" className="bnav-btn" aria-label="Week" onClick={() => { setView("week"); setCompareTarget(null); }}>
              <span className="bnav-icon"><NavIcon kind="schedule" /></span>
            </NavButton>
            {enableAttendance && (
              <NavButton nav="attendance" className="bnav-btn" aria-label="Attendance" onClick={() => { setView("attendance"); setCompareTarget(null); }}>
                <span className="bnav-icon"><NavIcon kind="attendance" /></span>
              </NavButton>
            )}
            {enableExams && (
              <NavButton nav="exams" className="bnav-btn" aria-label="Exams" onClick={() => { setView("exams"); setCompareTarget(null); }}>
                <span className="bnav-icon"><NavIcon kind="exams" /></span>
              </NavButton>
            )}
            {enableFriends && (
              <NavButton nav="friends" className="bnav-btn" aria-label="Social" onClick={() => { setView("friends"); setCompareTarget(null); markGroupsSeen(); }}>
                <span className="bnav-icon">
                  <NavIcon kind="social" />
                  {unreadFriendCount > 0 && <span className="bnav-dot" />}
                </span>
              </NavButton>
            )}
            <NavButton nav="planner" className="bnav-btn" aria-label="Planner" onClick={() => { setView("planner"); setCompareTarget(null); }}>
              <span className="bnav-icon"><NavIcon kind="planner" /></span>
            </NavButton>
          </nav>
        )}
        {v2Active && (
          <MobileV2TabBar
            view={view}
            moreOpen={mobileV2MoreOpen}
            attendanceEnabled={enableAttendance}
            unreadCount={unreadTotal}
            onNavigate={navigateMobileV2}
            onOpenMore={openMobileV2More}
          />
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
  // user={null}, not undefined: the dev harness has no user and never will,
  // which is what tells AppCore identity is already resolved.
  return <AppCore isSignedIn={true} isLoaded={true} signOut={() => { }} userId={null} user={null} />;
}
