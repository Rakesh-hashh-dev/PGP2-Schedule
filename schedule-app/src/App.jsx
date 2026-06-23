import { useState, useEffect, useCallback, useMemo, useRef, Suspense, lazy } from "react";
import { createPortal } from "react-dom";
import { Search, RefreshCw, Calendar, Clock, Sunrise, LogOut, Settings2, Bell, ClipboardList, GraduationCap, MoreHorizontal, Users, Sun, Cloud, CloudRain, CloudSnow, CloudLightning, CloudDrizzle, CloudFog, ChevronsLeft, ChevronsRight, ChevronRight, ChevronLeft, Megaphone, BarChart2, Shield, ShieldAlert, User, CloudOff, MessageSquare } from "lucide-react";
import { useUser, useClerk } from "@clerk/clerk-react";
import Hero from "./components/Hero.jsx";
import SemSummary from "./components/SemSummary.jsx";
import Timeline from "./components/Timeline.jsx";
import WeekAgenda from "./components/WeekAgenda.jsx";
import SubjectFilter from "./components/SubjectFilter.jsx";
import Login from "./components/Login.jsx";
import Onboarding from "./components/Onboarding.jsx";
import WeatherWidget from "./components/WeatherWidget.jsx";
import { getSnapshot, fetchSchedule, sha256hex } from "./lib/sheet.js";
import TermFlowLoader from "./components/TermFlowLoader.jsx";

const AttendancePanel = lazy(() => import("./components/AttendancePanel.jsx"));
const FriendsPanel = lazy(() => import("./components/FriendsPanel.jsx"));
const CompareView = lazy(() => import("./components/CompareView.jsx"));
const RecentChanges = lazy(() => import("./components/RecentChanges.jsx"));
const ExamsPanel = lazy(() => import("./components/ExamsPanel.jsx"));
const FeedbackWidget = lazy(() => import("./components/FeedbackWidget.jsx"));
const NotificationsPage = lazy(() => import("./components/NotificationsPage.jsx"));
const FullSchedulePage = lazy(() => import("./components/FullSchedulePage.jsx"));
const AdminDashboard = lazy(() => import("./components/AdminDashboard.jsx"));
const CommandPalette = lazy(() => import("./components/CommandPalette.jsx"));
import { loadAttendance, saveAttendance, sessionKey, syncAttendanceFromCloud, pushMark } from "./lib/attendance.js";
import { syncProfileFromCloud, pushProfile } from "./lib/profile.js";
import { decodeSchedule, saveFriend, loadFriends, loadGroups, friendVisibleClasses, syncFriendsAndGroupsFromCloud, fetchFriendPings, clearFriendPings, pushFriendsToCloud, deleteAllFriendPings, removeFriendByCloudId, deleteFriendPing } from "./lib/friends.js";
import { supabase } from "./lib/supabase.js";

function toMin(t) { const [h, m] = t.split(":").map(Number); return h * 60 + m; }
function ymd(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }
function clsDate(c, which) { const [Y, Mo, D] = c.date.split("-").map(Number); const [h, m] = c[which].split(":").map(Number); return new Date(Y, Mo - 1, D, h, m); }
function prettyDate(iso) { const [Y, M, D] = iso.split("-").map(Number); return new Date(Y, M - 1, D).toLocaleDateString([], { weekday: "long", day: "numeric", month: "short" }); }

function UserAvatar({ user, size = 30 }) {
  const initials = `${user?.firstName?.[0] ?? ""}${user?.lastName?.[0] ?? ""}` || "?";
  if (user?.imageUrl) return <img src={user.imageUrl} alt="" className="user-avatar" style={{ width: size, height: size }} />;
  return <span className="user-avatar user-avatar-initials" style={{ width: size, height: size }}>{initials}</span>;
}

function weatherIcon(code) {
  if (code === 0) return Sun;
  if (code <= 3) return Cloud;
  if (code <= 48) return CloudFog;
  if (code <= 55) return CloudDrizzle;
  if (code <= 67) return CloudRain;
  if (code <= 77) return CloudSnow;
  if (code <= 82) return CloudRain;
  return CloudLightning;
}

const APP_VERSION_KEY = "pgp2.app-version";

// Fetches /sw.js with a cache-busting query param (bypasses SW cache) and
// compares its hash to the stored value. If it changed, a new deploy happened.
// Only stores the hash on first visit — never on detection, so multiple rapid
// deploys while the user is away still produce exactly one banner.
async function checkAppVersion(onUpdateAvailable) {
  try {
    const resp = await fetch(`/sw.js?_=${Date.now()}`, { cache: "no-store" });
    if (!resp.ok) return;
    const text = await resp.text();
    const hash = await sha256hex(text);
    const stored = localStorage.getItem(APP_VERSION_KEY);
    if (!stored) {
      localStorage.setItem(APP_VERSION_KEY, hash); // first visit — seed the value
      return;
    }
    if (stored !== hash) onUpdateAvailable();
    // Don't update stored here — only update it when the user actually refreshes
  } catch {}
}

const LAST_USER_KEY = "pgp2.last-user-id";
const VIEW_KEY = "pgp2.last-view";
const USER_SCOPED_KEYS = [
  "pgp2.friends", "pgp2.groups", "pgp2.my_share_code",
  "pgp2.setup", "pgp2-notif-seen", "pgp2.read-ping-ids", "pgp2.read-change-keys",
  "pgp2.seen-recv-groups", "pgp2.recv-groups-count", "pgp2.sidebar", VIEW_KEY,
];
function clearStaleUserData(newUserId) {
  const lastId = localStorage.getItem(LAST_USER_KEY);
  if (lastId && lastId !== newUserId) {
    USER_SCOPED_KEYS.forEach(k => { try { localStorage.removeItem(k); } catch {} });
  }
  try { localStorage.setItem(LAST_USER_KEY, newUserId); } catch {}
}

const SETUP_KEY = "pgp2.setup";
function readSetup() {
  try {
    const s = JSON.parse(localStorage.getItem(SETUP_KEY));
    if (s && s.courses && !Array.isArray(s.courses) && typeof s.courses === "object") return s;
    return null;
  } catch { return null; }
}
function saveSetup(s) { try { localStorage.setItem(SETUP_KEY, JSON.stringify(s)); } catch (e) { } }

const NOTIF_KEY = "pgp2-notif-seen";
function loadLastSeen() { try { return parseInt(localStorage.getItem(NOTIF_KEY) || "0", 10); } catch { return 0; } }
const READ_PINGS_KEY = "pgp2.read-ping-ids";
function loadReadPingIds() { try { return new Set(JSON.parse(localStorage.getItem(READ_PINGS_KEY) || "[]")); } catch { return new Set(); } }
const READ_CHANGES_KEY = "pgp2.read-change-keys";
function loadReadChangeKeys() { try { return new Set(JSON.parse(localStorage.getItem(READ_CHANGES_KEY) || "[]")); } catch { return new Set(); } }
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
      USER_SCOPED_KEYS.forEach(k => { try { localStorage.removeItem(k); } catch {} });
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
    }
    try { localStorage.setItem(LAST_USER_KEY, userId); } catch {}
  }, [userId]);
  // ──────────────────────────────────────────────────────────────
  const showAdminUI = isAdmin && adminMode;
  const [sysConfig, setSysConfig] = useState(null);

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
    }
    setImpersonatedUser(null);
  };
  // -------------------------------

  const [scheduleData, setScheduleData] = useState(() => isSignedIn ? getSnapshot() : null);
  const [syncLogs, setSyncLogs] = useState([]);
  const [realNow, setRealNow] = useState(new Date());
  const [timeOverride, setTimeOverride] = useState(null);
  const now = timeOverride ? new Date(timeOverride) : realNow;
  const [view, setView] = useState(() => { try { return localStorage.getItem(VIEW_KEY) || "today"; } catch { return "today"; } });
  useEffect(() => { try { localStorage.setItem(VIEW_KEY, view); } catch {} }, [view]);
  useEffect(() => {
    if (!showAdminUI) {
      if (view === "admin") setView("today");
      setTimeOverride(null);
    }
  }, [view, showAdminUI]);
  const [weekOffset, setWeekOffset] = useState(0);
  const [format12, setFormat12] = useState(() => {
    try { return localStorage.getItem("pgp2.format12") !== "false"; } catch { return true; }
  });
  const toggleFormat12 = () => setFormat12(p => {
    try { localStorage.setItem("pgp2.format12", !p ? "true" : "false"); } catch { }
    return !p;
  });
  const [mine, setMine] = useState(() => { const s = readSetup(); return s?.courses ? new Set(Object.keys(s.courses)) : null; });
  const [enrolled, setEnrolled] = useState(() => { const s = readSetup(); return s?.courses ?? null; });
  const [setup, setSetup] = useState(() => readSetup());
  const [allocationApplied, setAllocationApplied] = useState(false);
  const [prefillPicked, setPrefillPicked] = useState(null);
  const [showSetupEdit, setShowSetupEdit] = useState(false);
  const [syncedAt, setSyncedAt] = useState(new Date());
  const [notifOpen, setNotifOpen] = useState(false);
  const notifOpenedAt = useRef(0);
  const [lastSeenTs, setLastSeenTs] = useState(() => loadLastSeen());
  const [readPingIds, setReadPingIds] = useState(() => loadReadPingIds());
  const [readChangeKeys, setReadChangeKeys] = useState(() => loadReadChangeKeys());
  const [swUpdateFn, setSwUpdateFn] = useState(null);
  const [attendance, setAttendance] = useState(() => loadAttendance());
  const [syncing, setSyncing] = useState(false);
  const [overflowOpen, setOverflowOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [weather, setWeather] = useState(null);
  const [cloudChecked, setCloudChecked] = useState(false);
  const [friends, setFriends] = useState(() => loadFriends());
  const [groups, setGroups] = useState(() => loadGroups());
  const [compareTarget, setCompareTarget] = useState(null); // { mode, friendData?, groupData? }
  const [friendToast, setFriendToast] = useState(null);

  // Received groups badge: track how many received groups were seen when Friends tab was last opened
  const [pings, setPings] = useState([]);
  const [seenRecvGroupIds, setSeenRecvGroupIds] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem("pgp2.seen-recv-groups") || "[]")); }
    catch { return new Set(); }
  });
  const [seenRecvCount, setSeenRecvCount] = useState(() => {
    try { return parseInt(localStorage.getItem("pgp2.recv-groups-count") || "0", 10); } catch { return 0; }
  });
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try { return localStorage.getItem("pgp2.sidebar") === "collapsed"; } catch { return false; }
  });
  function toggleSidebar() {
    setSidebarCollapsed(prev => {
      const next = !prev;
      try { localStorage.setItem("pgp2.sidebar", next ? "collapsed" : "expanded"); } catch { }
      return next;
    });
    setSbTip(null);
  }

  const [sbTip, setSbTip] = useState(null);
  function showSbTip(e, label, always = false) {
    if (!sidebarCollapsed && !always) return;
    const r = e.currentTarget.getBoundingClientRect();
    setSbTip({ label, top: r.top + r.height / 2, left: r.right + 10 });
  }
  function hideSbTip() { setSbTip(null); }

  const tabsRef = useRef(null);
  const [showRightScroll, setShowRightScroll] = useState(true);
  const [showLeftScroll, setShowLeftScroll] = useState(false);
  const handleTabsScroll = () => {
    if (!tabsRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = tabsRef.current;
    setShowRightScroll(scrollLeft + clientWidth < scrollWidth - 10);
    setShowLeftScroll(scrollLeft > 10);
  };
  // Scroll the active tab into center once ALL loading guards have passed
  const didScrollInitialTab = useRef(false);
  const tabsReady = isLoaded && isSignedIn && !!scheduleData && !!setup && !showSetupEdit;
  useEffect(() => {
    if (!tabsReady || didScrollInitialTab.current) return;
    didScrollInitialTab.current = true;
    const id = setTimeout(() => {
      const nav = tabsRef.current;
      const activeTab = nav?.querySelector(".tab.on");
      if (nav && activeTab) {
        nav.scrollLeft = activeTab.offsetLeft - nav.offsetWidth / 2 + activeTab.offsetWidth / 2;
        handleTabsScroll();
      }
    }, 100);
    return () => clearTimeout(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabsReady]);

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

  // URL param interception for friend codes
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("f");
    if (code) {
      (async () => {
        const decoded = await decodeSchedule(code);
        if (decoded) {
          const updated = saveFriend(decoded.name, decoded.courses, decoded.id);
          setFriends(updated);
          setFriendToast(`Added ${decoded.name} as a friend!`);
          setTimeout(() => setFriendToast(null), 3000);
        }
        window.history.replaceState({}, "", window.location.pathname);
      })();
    }
  }, []);

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
          setSysConfig(sysConfigRes.data);
        }
        if (p?.courses) {
          setEnrolled(p.courses);
          setMine(new Set(Object.keys(p.courses)));
          setSetup(p);
          
          // Auto-sync notification read state from cloud
          if (p.lastSeenNotif) {
             const localSeen = loadLastSeen();
             if (p.lastSeenNotif > localSeen) {
                setLastSeenTs(p.lastSeenNotif);
                try { localStorage.setItem(NOTIF_KEY, String(p.lastSeenNotif)); } catch { }
             }
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
  }, [userId]);

  // Shared pings refresh — used on mount, polling, and tab-focus
  const refreshPings = useCallback(async (uid) => {
    const data = await fetchFriendPings(uid);
    if (!data.length) return;
    const visiblePings = [];
    for (const p of data) {
      try {
        const meta = JSON.parse(p.from_name);
        if (meta.type === "friend_accepted" && meta.fromCode) {
          const decoded = await decodeSchedule(meta.fromCode);
          if (decoded) {
            const current = loadFriends();
            if (!current.some(f => f.cloudId === decoded.id)) {
              const updated = saveFriend(decoded.name, decoded.courses, decoded.id);
              setFriends(updated);
              pushFriendsToCloud(uid, updated);
            }
          }
          visiblePings.push(p);
        } else if (meta.type === "friend_removed") {
          // Silently remove the sender from this user's friends list
          const current = loadFriends();
          if (current.some(f => f.cloudId === p.from_id)) {
            const updated = removeFriendByCloudId(p.from_id);
            setFriends(updated);
            pushFriendsToCloud(uid, updated);
          }
          deleteFriendPing(p.id);
          // Not added to visiblePings — this is an internal signal
        } else {
          visiblePings.push(p);
        }
      } catch {
        visiblePings.push(p);
      }
    }
    setPings(visiblePings);
  }, []);

  // Initial fetch + 30-second poll (realtime fallback)
  useEffect(() => {
    if (!userId) return;
    refreshPings(userId);
    const id = setInterval(() => refreshPings(userId), 30_000);
    return () => clearInterval(id);
  }, [userId, refreshPings]);

  useEffect(() => {
    fetch("https://api.open-meteo.com/v1/forecast?latitude=21.4669&longitude=83.9812&current=temperature_2m,weather_code&temperature_unit=celsius&timezone=Asia%2FKolkata")
      .then(r => r.json())
      .then(d => setWeather({ temp: Math.round(d.current.temperature_2m), code: d.current.weather_code }))
      .catch(() => { });
  }, []);

  useEffect(() => {
    if (!isSignedIn) return;
    let alive = true;

    // UI unblocks instantly: use local snapshot while live data fetches in background
    setScheduleData(getSnapshot());

    // Background-fetch live data
    const load = () =>
      fetchSchedule().then((data) => {
        if (!alive) return;
        setScheduleData(data);
        setSyncedAt(new Date());
        if (data._meta) setSyncLogs(prev => [data._meta, ...prev].slice(0, 1000));
      }).catch(e => {
        if (!alive) return;
        setSyncLogs(prev => [{ ts: Date.now(), status: "error", message: `Background sync failed: ${e.message || "Network Error"}` }, ...prev].slice(0, 1000));
      });
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
          try { localStorage.setItem("pgp2.groups", JSON.stringify(payload.new.groups)); } catch {}
        }
        if (Array.isArray(payload.new.friends)) {
          setFriends(payload.new.friends);
          try { localStorage.setItem("pgp2.friends", JSON.stringify(payload.new.friends)); } catch {}
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId]);

  // Supabase Realtime: live friend pings (group invites, friend-add notifications)
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`pings-realtime-${userId}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "friend_pings",
        filter: `target_id=eq.${userId}`,
      }, async (payload) => {
        if (!payload.new) return;
        let isInternalSignal = false;
        try {
          const meta = JSON.parse(payload.new.from_name);
          if (meta.type === "friend_accepted" && meta.fromCode) {
            const decoded = await decodeSchedule(meta.fromCode);
            if (decoded) {
              const current = loadFriends();
              if (!current.some(f => f.cloudId === decoded.id)) {
                const updated = saveFriend(decoded.name, decoded.courses, decoded.id);
                setFriends(updated);
                pushFriendsToCloud(userId, updated);
              }
            }
          }
          if (meta.type === "friend_removed") {
            isInternalSignal = true;
            const current = loadFriends();
            if (current.some(f => f.cloudId === payload.new.from_id)) {
              const updated = removeFriendByCloudId(payload.new.from_id);
              setFriends(updated);
              pushFriendsToCloud(userId, updated);
            }
            deleteFriendPing(payload.new.id);
          }
          if (meta.group) {
            // Group invite: re-fetch profile to get the new group immediately
            const result = await syncFriendsAndGroupsFromCloud(userId);
            if (result) {
              setGroups(result.groups);
              setFriends(result.friends);
            }
          }
        } catch {}
        if (!isInternalSignal) {
          setPings(prev => {
            if (prev.some(p => p.id === payload.new.id)) return prev;
            return [payload.new, ...prev];
          });
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId]);

  useEffect(() => {
    // Catch updates that fired before React mounted
    if (window.__swPendingUpdate) {
      setSwUpdateFn(() => window.__swPendingUpdate);
      window.__swPendingUpdate = null;
    }
    const handler = (e) => setSwUpdateFn(() => e.detail.updateSW);
    window.addEventListener("sw-update-available", handler);
    return () => window.removeEventListener("sw-update-available", handler);
  }, []);

  // Version-check fallback: compare /sw.js hash to localStorage so updates are
  // detected even when the SW lifecycle doesn't trigger onNeedRefresh reliably.
  // Use functional updater: if a banner is already showing (prev !== null), do nothing.
  // This means N deploys while the user is away still produce exactly one banner.
  const triggerHardRefresh = () => setSwUpdateFn(prev => {
    if (prev !== null) return prev;
    return async () => {
      try {
        const names = await caches.keys();
        await Promise.all(names.map(n => caches.delete(n)));
      } catch {}
      localStorage.removeItem(APP_VERSION_KEY);
      window.location.reload();
    };
  });

  useEffect(() => {
    if (!isSignedIn) return;
    checkAppVersion(triggerHardRefresh);
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
        if (userId) refreshPings(userId);
        checkAppVersion(triggerHardRefresh);
        const elapsed = Date.now() - syncedAtRef.current.getTime();
        if (elapsed > 5 * 60 * 1000) handleSync();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSignedIn, syncedAt, userId, refreshPings]);

  useEffect(() => {
    const hour = now.getHours();
    let timeTheme = "theme-afternoon";
    if (hour >= 5 && hour < 11) timeTheme = "theme-morning";
    else if (hour >= 11 && hour < 17) timeTheme = "theme-afternoon";
    else if (hour >= 17 && hour < 20) timeTheme = "theme-evening";
    else timeTheme = "theme-night";
    
    document.body.classList.remove("theme-morning", "theme-afternoon", "theme-evening", "theme-night");
    document.body.classList.add(timeTheme);
  }, [now]);

  // Auto-sync section overrides from live sheet
  useEffect(() => {
    const students = scheduleData?.STUDENTS;
    const email = user?.primaryEmailAddress?.emailAddress?.toLowerCase();
    
    if (students && email && enrolled && setup && userId) {
      (async () => {
        const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(email));
        const hash = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
        const overrides = students[hash];
        if (overrides) {
          let changed = false;
          const nextEnrolled = { ...enrolled };
          for (const [code, section] of Object.entries(overrides)) {
            if (nextEnrolled[code] !== section) {
              nextEnrolled[code] = section;
              changed = true;
            }
          }
          if (changed) {
            setEnrolled(nextEnrolled);
            setMine(new Set(Object.keys(nextEnrolled)));
            const newSetup = { ...setup, courses: nextEnrolled };
            setSetup(newSetup);
            pushProfile(userId, nextEnrolled);
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
      // Drop anything that isn't a real, joinable section (e.g. "Audit").
      const courses = {};
      Object.entries(allocation).forEach(([code, section]) => {
        const s = String(section).trim();
        if (s === "A" || s === "B" || s === "Single") courses[code] = s;
      });
      if (Object.keys(courses).length > 0) {
        setPrefillPicked(courses);
      }
      setAllocationApplied(true);
    });
    return () => { cancelled = true; };
  }, [scheduleData, isSignedIn, allocationApplied, cloudChecked, setup, userId, user]);

  // Apply Admin Overrides (Term data & Cancellations)
  const sd = useMemo(() => {
    if (!scheduleData) return null;
    let data = { ...scheduleData };
    if (sysConfig?.flags) {

      if (sysConfig.flags.classOverrides) {
        const overrides = sysConfig.flags.classOverrides;
        data.CLASSES = data.CLASSES.map(c => {
          const classOverride = overrides[c.date]?.[c.code];
          return classOverride ? { ...c, ...classOverride } : c;
        });
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
    Object.keys(m).forEach((k) => { out[k] = [...m[k]].sort(); });
    return out;
  }, [sd]);

  const visible = useMemo(() => {
    if (!enrolled || !mine) return [];
    const seen = new Set();
    return CLASSES.filter((c) => {
      if (c.type === "class") {
        const sec = enrolled[c.code];
        return sec !== undefined && (c.section === sec || c.section === "Single") && mine.has(c.code);
      }
      const key = c.date + c.slot + c.name;
      if (seen.has(key)) return false; seen.add(key); return true;
    });
  }, [CLASSES, enrolled, mine]);

  const enrolledLegend = useMemo(() => {
    const out = {};
    if (enrolled) Object.keys(enrolled).forEach((c) => { if (LEGEND[c]) out[c] = LEGEND[c]; });
    return out;
  }, [enrolled, LEGEND]);

  const todayISO = ymd(now);
  const tomorrowISO = ymd(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1));

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

  function handleOnboardingDone(courses) {
    const s = { courses };
    saveSetup(s);
    pushProfile(userId, courses, user?.firstName || user?.username || "Student");
    setEnrolled(courses);
    setMine(new Set(Object.keys(courses)));
    setSetup(s);
    setShowSetupEdit(false);
  }

  const filteredChanges = useMemo(() => {
    if (!CHANGES || !CHANGES.length) return [];
    if (!mine || mine.size === 0) return CHANGES;

    const myCourseNames = [...mine].map(code => LEGEND[code]?.name).filter(Boolean);
    const allCourseNames = Object.values(LEGEND).map(l => l.name).filter(Boolean);

    return CHANGES.filter(c => {
      if (c.code) return mine.has(c.code);
      const text = c.text || "";
      if (myCourseNames.some(name => text.includes(name))) return true;
      if (allCourseNames.some(name => text.includes(name))) return false;
      return true;
    });
  }, [CHANGES, mine, LEGEND]);

  const newRecvGroups = groups.filter(g => g.isReceived && !seenRecvGroupIds.has(g.id));
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
        } catch {}
        const pingId = p.id || p.from_id;
        return { id: `ping-${pingId}`, pingId, text, ts: p.created_at, kind, name, meta, fromId: p.from_id, isRead: readPingIds.has(pingId) };
      }),
    ...newRecvGroups.map(g => ({ id: `grp-${g.id}`, pingId: `grp-${g.id}`, text: `${g.ownerName} shared "${g.name}" with you`, ts: g.createdAt, kind: "group", name: g.ownerName, isRead: seenRecvGroupIds.has(g.id) })),
  ];
  const unreadFriendCount = friendNotifItems.filter(item => !item.isRead).length;
  const unreadChangeCount = filteredChanges.filter(c => !readChangeKeys.has(changeKey(c))).length;
  const hasUnread = unreadChangeCount > 0 || unreadFriendCount > 0;
  const receivedGroupCount = groups.filter(g => g.isReceived).length;
  const hasNewGroups = receivedGroupCount > seenRecvCount;

  function markGroupsSeen() {
    setSeenRecvCount(receivedGroupCount);
    try { localStorage.setItem("pgp2.recv-groups-count", String(receivedGroupCount)); } catch {}
  }

  function markPingRead(pingId) {
    if (!pingId) return;
    if (pingId.startsWith("grp-")) {
      const groupId = pingId.slice(4);
      if (seenRecvGroupIds.has(groupId)) return;
      setSeenRecvGroupIds(prev => {
        const next = new Set([...prev, groupId]);
        try { localStorage.setItem("pgp2.seen-recv-groups", JSON.stringify([...next])); } catch {}
        return next;
      });
      return;
    }
    if (readPingIds.has(pingId)) return;
    setReadPingIds(prev => {
      const next = new Set([...prev, pingId]);
      try { localStorage.setItem(READ_PINGS_KEY, JSON.stringify([...next])); } catch {}
      return next;
    });
  }

  function markChangeRead(c) {
    const key = changeKey(c);
    if (readChangeKeys.has(key)) return;
    setReadChangeKeys(prev => {
      const next = new Set([...prev, key]);
      try { localStorage.setItem(READ_CHANGES_KEY, JSON.stringify([...next])); } catch {}
      return next;
    });
  }

  function markAllRead() {
    const nextPings = new Set([...readPingIds, ...friendNotifItems.map(i => i.pingId).filter(Boolean)]);
    setReadPingIds(nextPings);
    try { localStorage.setItem(READ_PINGS_KEY, JSON.stringify([...nextPings])); } catch {}

    const nextChanges = new Set([...readChangeKeys, ...filteredChanges.map(changeKey)]);
    setReadChangeKeys(nextChanges);
    try { localStorage.setItem(READ_CHANGES_KEY, JSON.stringify([...nextChanges])); } catch {}

    const newIds = new Set([...seenRecvGroupIds, ...newRecvGroups.map(g => g.id)]);
    setSeenRecvGroupIds(newIds);
    try { localStorage.setItem("pgp2.seen-recv-groups", JSON.stringify([...newIds])); } catch {}
  }

  function handleOpenNotif() {
    if (!notifOpen && filteredChanges.length > 0 && userId && enrolled) {
      const latest = Math.max(...filteredChanges.map(c => new Date(c.ts).getTime()));
      setLastSeenTs(latest);
      try { localStorage.setItem(NOTIF_KEY, String(latest)); } catch {}
      pushProfile(userId, enrolled, user?.firstName || user?.username || "Student", latest);
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

  const markAttendance = async (c, status) => {
    if (premiumMode && navigator.vibrate) navigator.vibrate([10]);
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
    if (premiumMode && navigator.vibrate) navigator.vibrate([10]);
    setSyncing(true);
    try {
      const data = await fetchSchedule(true);
      setScheduleData(data);
      setSyncedAt(new Date());
      setRealNow(new Date());
      if (data._meta) setSyncLogs(prev => [data._meta, ...prev].slice(0, 1000));
      if (premiumMode && navigator.vibrate) navigator.vibrate([10, 40, 10]);
    } catch (e) {
      if (premiumMode && navigator.vibrate) navigator.vibrate([50, 100, 50]);
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

  if (!isLoaded) return (
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
      <p className="loading-sub">Fetching your class schedule</p>
    </main>
  );
  if (!setup) return <Onboarding legend={LEGEND} sectionsByCode={sectionsByCode} onDone={handleOnboardingDone} termLabel={termLabel} onPullFromSheet={buildAllocationFromSheet} prefill={prefillPicked} cloudChecked={cloudChecked} />;
  if (showSetupEdit) return <Onboarding legend={LEGEND} sectionsByCode={sectionsByCode} onDone={handleOnboardingDone} initialPicked={enrolled} onCancel={() => setShowSetupEdit(false)} termLabel={termLabel} onPullFromSheet={buildAllocationFromSheet} />;

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

  if (sysConfig?.flags?.maintenanceMode && !isAdmin) {
    return (
      <main className="login-screen" style={{ flexDirection: "column", gap: 20 }}>
        <CloudOff size={64} color="var(--danger, #e74c3c)" style={{ filter: "drop-shadow(0 4px 12px rgba(231,76,60,0.3))" }} />
        <h1 style={{ fontSize: 24, fontWeight: 800, color: "var(--text)", margin: 0 }}>Under Maintenance</h1>
        <p style={{ color: "var(--muted)", maxWidth: 300, textAlign: "center", lineHeight: 1.5, margin: 0 }}>
          TermFlow is currently undergoing scheduled maintenance. Please check back later.
        </p>
        <button className="cva-btn primary" onClick={() => window.location.reload()} style={{ marginTop: 20, display: "flex", alignItems: "center", gap: 8 }}>
          <RefreshCw size={16} /> Refresh Page
        </button>
      </main>
    );
  }

  const enableExams = sysConfig?.flags?.enableExams !== false;
  const enableFriends = sysConfig?.flags?.enableFriends !== false;
  const enableAttendance = sysConfig?.flags?.enableAttendance !== false;

  let activeGlobalAnnouncement = null;
  if (sysConfig?.announcement) {
    if (typeof sysConfig.announcement === 'string') {
      activeGlobalAnnouncement = sysConfig.announcement;
    } else if (typeof sysConfig.announcement === 'object') {
      const { message, target } = sysConfig.announcement;
      let matches = false;
      if (!target || target === "global") matches = true;
      else if (target === "section_A" && Object.values(setup?.courses || {}).includes("A")) matches = true;
      else if (target === "section_B" && Object.values(setup?.courses || {}).includes("B")) matches = true;
      else if (target === "has_friends" && friends && friends.length > 0) matches = true;
      else if (target?.startsWith("subject_")) {
        const subjectCode = target.replace("subject_", "");
        if (setup?.courses?.[subjectCode]) matches = true;
      }
      
      if (matches) activeGlobalAnnouncement = message;
    }
  }

  return (
    <div className="app-shell">
      {/* ── SW Update Modal ── */}
      {swUpdateFn && (
        <div className="sw-update-overlay">
          <div className="sw-update-modal">
            <div className="sw-update-icon-wrap">
              <RefreshCw size={24} color="#6D5BD0" strokeWidth={2.5} />
            </div>
            <h3 className="sw-update-title">Update Available</h3>
            <p className="sw-update-desc">A new version of TermFlow is ready. Refresh to get the latest features and fixes.</p>
            <div className="sw-update-actions">
              <button className="sw-update-refresh" onClick={() => swUpdateFn(true)}>Refresh Now</button>
              <button className="sw-update-later" onClick={() => setSwUpdateFn(null)}>Later</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Impersonation Banner ── */}
      {impersonatedUser && (
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, background: "var(--amber)", color: "#000", padding: "8px 16px", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "space-between", fontWeight: 700, fontSize: 13, borderBottom: "1px solid rgba(0,0,0,0.1)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}><ShieldAlert size={16} /> Impersonating: {impersonatedUser.name || impersonatedUser.user_id}</div>
          <button onClick={stopImpersonation} style={{ background: "rgba(0,0,0,0.15)", border: "none", padding: "4px 10px", borderRadius: 4, cursor: "pointer", fontWeight: 700, color: "#000", fontSize: 12 }}>Exit</button>
        </div>
      )}

      {/* ── Desktop Sidebar ── */}
      <aside className={`sidebar${sidebarCollapsed ? " collapsed" : ""}`}>
        <div className="sb-brand">
          <div className="logo"><img src="/termflow-icon.svg" alt="TermFlow" width={20} height={20} /></div>
          <div className="sb-brand-text">
            <div className="sb-brand-name">TermFlow</div>
            <div className="sb-brand-sub">
              <div>IIM Sambalpur</div>
              <div className="sb-brand-date">{termLabel}</div>
            </div>
          </div>
        </div>

        <div className="sb-scroll-body">
        <nav className="sb-nav">
          <button className="sb-link" onMouseEnter={e => showSbTip(e, "Search")} onMouseLeave={hideSbTip} onClick={() => { setCmdOpen(true); hideSbTip(); }}>
            <Search size={18} /><span className="sb-link-label">Search</span>
          </button>
          <button className={`sb-link${view === "today" ? " on" : ""}`} onMouseEnter={e => showSbTip(e, "Today")} onMouseLeave={hideSbTip} onClick={() => { setView("today"); setCompareTarget(null); hideSbTip(); }}>
            <Clock size={18} /><span className="sb-link-label">Today</span>
          </button>
          <button className={`sb-link${view === "tomorrow" ? " on" : ""}`} onMouseEnter={e => showSbTip(e, "Tomorrow")} onMouseLeave={hideSbTip} onClick={() => { setView("tomorrow"); setCompareTarget(null); hideSbTip(); }}>
            <Sunrise size={18} /><span className="sb-link-label">Tomorrow</span>
          </button>
          {enableAttendance && (
            <button className={`sb-link${view === "attendance" ? " on" : ""}`} onMouseEnter={e => showSbTip(e, "Attendance")} onMouseLeave={hideSbTip} onClick={() => { setView("attendance"); setCompareTarget(null); hideSbTip(); }}>
              <ClipboardList size={18} /><span className="sb-link-label">Attendance</span>
            </button>
          )}
          {enableExams && (
            <button className={`sb-link${view === "exams" ? " on" : ""}`} onMouseEnter={e => showSbTip(e, "Exams")} onMouseLeave={hideSbTip} onClick={() => { setView("exams"); setCompareTarget(null); hideSbTip(); }}>
              <GraduationCap size={18} /><span className="sb-link-label">Exams</span>
            </button>
          )}
          <button className={`sb-link${view === "notifications" ? " on" : ""}`} onMouseEnter={e => showSbTip(e, "Announcements")} onMouseLeave={hideSbTip} onClick={() => { setView("notifications"); setCompareTarget(null); hideSbTip(); }}>
            <Megaphone size={18} /><span className="sb-link-label">Announcements</span>
          </button>
          {enableFriends && (
            <button className={`sb-link${view === "friends" ? " on" : ""}`} onMouseEnter={e => showSbTip(e, "Friends")} onMouseLeave={hideSbTip} onClick={() => { setView("friends"); setCompareTarget(null); markGroupsSeen(); hideSbTip(); }}>
              <Users size={18} /><span className="sb-link-label">Friends</span> <span className="beta-badge">Beta</span>
              {unreadFriendCount > 0 && <span className="nav-badge">{unreadFriendCount}</span>}
            </button>
          )}
          {showAdminUI && (
            <button className={`sb-link${view === "admin" ? " on" : ""}`} onMouseEnter={e => showSbTip(e, "Admin Tools")} onMouseLeave={hideSbTip} onClick={() => { setView("admin"); setCompareTarget(null); hideSbTip(); }}>
              <Shield size={18} /><span className="sb-link-label" style={{ color: "var(--live)" }}>Admin Tools</span>
            </button>
          )}
        </nav>

        <div className="sb-bottom">
          <div className="sb-sep-line" />
          <div className="sb-util-strip">
            <button className="sb-util-btn" onMouseEnter={e => showSbTip(e, "Edit setup", true)} onMouseLeave={hideSbTip} onClick={() => { setShowSetupEdit(true); hideSbTip(); }} aria-label="Edit setup">
              <Settings2 size={16} />
            </button>
            <button className="sb-util-btn" onMouseEnter={e => showSbTip(e, syncing ? "Syncing…" : "Refresh", true)} onMouseLeave={hideSbTip} onClick={handleSync} aria-label="Refresh">
              <RefreshCw size={16} className={syncing ? "spin-icon" : ""} />
            </button>
            <button className="sb-util-btn sb-util-danger" onMouseEnter={e => showSbTip(e, "Log out", true)} onMouseLeave={hideSbTip} onClick={() => signOut()} aria-label="Log out">
              <LogOut size={16} />
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
            <button className="sb-util-btn sb-util-collapse" onMouseEnter={e => showSbTip(e, sidebarCollapsed ? "Expand" : "Collapse", true)} onMouseLeave={hideSbTip} onClick={toggleSidebar} aria-label="Toggle sidebar">
              {sidebarCollapsed ? <ChevronsRight size={15} /> : <ChevronsLeft size={15} />}
            </button>
          </div>
          <div className="sb-avatar-wrap" onMouseEnter={hideSbTip}>
            <button className="sb-avatar-btn">
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
            <div className="sb-profile-pop">
              <div className="sb-pop-name">
                {user?.fullName || "Student"}
                {showAdminUI && <span className="admin-badge">Admin</span>}
              </div>
              <div className="sb-pop-email">{user?.primaryEmailAddress?.emailAddress || ""}</div>
              <span className="sb-pop-batch">PGP2 · 2025–27</span>
              <div className="sb-pop-sep" />
              <button className="sb-pop-signout" onClick={() => signOut()}>
                <LogOut size={14} /> Sign out
              </button>
            </div>
          </div>
        </div>
        </div>
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
            {/* Desktop-only: full button set */}
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
            {/* Bell — always visible */}
            <div className="tb-wrap notif-wrap">
              <button className="sync" onClick={handleOpenNotif} aria-label="Notifications" aria-expanded={notifOpen}>
                <Bell size={15} />
                {hasUnread && <span className="notif-dot" />}
              </button>
              <span className="tooltip" role="tooltip">Notifications</span>
              {notifOpen && (
                <>
                  <div className="notif-backdrop" onClick={() => setNotifOpen(false)} />
                  <div className="notif-panel">
                    {friendNotifItems.length === 0 && filteredChanges.length === 0 ? (
                      <p className="notif-empty">No new notifications</p>
                    ) : (
                      <>
                        <div className="notif-panel-header">
                          {hasUnread
                            ? <button className="rc-mark-all" onClick={markAllRead}>Mark all read</button>
                            : <span className="rc-all-read">All caught up</span>
                          }
                        </div>
                        {friendNotifItems.length > 0 && (
                          <section className="rc">
                            <div className="rc-head">
                              <span className="rc-title"><Users size={14} /> Friends</span>
                              <button className="rc-view-all" style={{ padding: "2px 8px", fontSize: 12 }} onClick={() => { setNotifOpen(false); setView("friends"); }}>Go to Friends</button>
                            </div>
                            <ul className="rc-list">
                              {friendNotifItems.map(item => (
                                <li key={item.id} className={`rc-item rc-item-clickable${item.isRead ? " rc-item-read" : ""}`} onClick={() => markPingRead(item.pingId)}>
                                  <span className="rc-dot rc-friend" />
                                  <span className="rc-text">{item.text}</span>
                                  {item.isRead && <span className="rc-read-check">✓</span>}
                                </li>
                              ))}
                            </ul>
                          </section>
                        )}
                        {filteredChanges.length > 0 && <RecentChanges changes={filteredChanges} readKeys={readChangeKeys} onMarkRead={markChangeRead} onViewAll={handleViewAllNotifs} />}
                      </>
                    )}
                  </div>
                </>
              )}
            </div>
            {/* Desktop-only: profile avatar */}
            <div className="tb-wrap over-wrap desktop-only">
              <button className="sync profile-avatar-btn" onClick={() => setProfileOpen(o => !o)} aria-label="Profile" aria-expanded={profileOpen}>
                <UserAvatar user={user} size={30} />
              </button>
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
                  </div>
                </>
              )}
            </div>
            {/* Mobile-only: overflow ⋯ */}
            <div className="tb-wrap over-wrap mobile-only">
              <button className="sync" onClick={() => setOverflowOpen(o => !o)} aria-label="More options" aria-expanded={overflowOpen}>
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
                    <div className="over-sep" />
                    <button onClick={() => { setShowSetupEdit(true); setOverflowOpen(false); }}>
                      <Settings2 size={14} /> Edit setup
                    </button>
                    <button onClick={() => { handleSync(); setOverflowOpen(false); }}>
                      <RefreshCw size={14} className={syncing ? "spin-icon" : ""} />
                      {syncing ? "Syncing…" : "Refresh"}
                    </button>
                    <div className="over-sep" />
                    <button onClick={() => { setFeedbackOpen(true); setProfileOpen(false); setOverflowOpen(false); }}>
                      <MessageSquare size={14} /> Submit Feedback
                    </button>
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

        <SubjectFilter legend={enrolledLegend} mine={mine} setMine={setMine} onEditSetup={() => setShowSetupEdit(true)} />

        <div className="desk-layout">
          <main className="main-col">
            <div className="tabs-wrapper">
              <nav className="tabs" ref={tabsRef} onScroll={handleTabsScroll}>
                <button className={`tab ${view === "today" ? "on" : ""}`} onClick={() => { setView("today"); setCompareTarget(null); }}>
                  <Clock size={15} /> Today
                </button>
                <button className={`tab ${view === "tomorrow" ? "on" : ""}`} onClick={() => { setView("tomorrow"); setCompareTarget(null); }}>
                  <Sunrise size={15} /> Tomorrow
                </button>
                <button className={`tab tab-week ${view === "week" ? "on" : ""}`} onClick={() => { setView("week"); setCompareTarget(null); }}>
                  <Calendar size={15} /> Week
                </button>
                {enableAttendance && (
                  <button className={`tab ${view === "attendance" ? "on" : ""}`} onClick={() => { setView("attendance"); setCompareTarget(null); }}>
                    <ClipboardList size={15} /> Attendance
                  </button>
                )}
                {enableExams && (
                  <button className={`tab ${view === "exams" ? "on" : ""}`} onClick={() => { setView("exams"); setCompareTarget(null); }}>
                    <GraduationCap size={15} /> Exams
                  </button>
                )}
                <button className={`tab ${view === "notifications" ? "on" : ""}`} onClick={() => { setView("notifications"); setCompareTarget(null); }}>
                  <Megaphone size={15} /> Announcements
                </button>
                {enableFriends && (
                  <button className={`tab ${view === "friends" ? "on" : ""}`} onClick={() => { setView("friends"); setCompareTarget(null); markGroupsSeen(); }}>
                    <Users size={15} /> Friends <span className="beta-badge">Beta</span>
                    {unreadFriendCount > 0 && <span className="nav-badge">{unreadFriendCount}</span>}
                  </button>
                )}
              </nav>
              {showLeftScroll && (
                <button
                  className="tabs-scroll-btn left mobile-only"
                  onClick={() => tabsRef.current?.scrollBy({ left: -180, behavior: "smooth" })}
                  aria-label="Scroll left"
                >
                  <div className="tsb-icon-wrap">
                    <ChevronLeft size={14} />
                  </div>
                </button>
              )}
              {showRightScroll && (
                <button
                  className="tabs-scroll-btn right mobile-only"
                  onClick={() => tabsRef.current?.scrollBy({ left: 180, behavior: "smooth" })}
                  aria-label="Scroll right"
                >
                  <div className="tsb-icon-wrap">
                    <ChevronRight size={14} />
                  </div>
                </button>
              )}
            </div>

            {view !== "attendance" && view !== "insights" && view !== "notifications" && view !== "exams" && view !== "friends" && view !== "fullSchedule" && !compareTarget && (
              <>
                {activeGlobalAnnouncement && (
                  <div style={{ background: "var(--amber)", color: "#000", padding: "12px 16px", borderRadius: 8, marginBottom: 16, display: "flex", gap: 8, alignItems: "center", fontWeight: 600 }}>
                    <Megaphone size={18} style={{ flexShrink: 0 }} />
                    <span style={{ fontSize: 14 }}>{activeGlobalAnnouncement}</span>
                  </div>
                )}
                <div className="view-date-header">
                  <span className="vdh-label">
                    {view === "notifications" ? `${filteredChanges.length} update${filteredChanges.length !== 1 ? "s" : ""}`
                      : view === "week" ? weekRangeLabel : prettyDate(view === "tomorrow" ? tomorrowISO : todayISO)}
                  </span>
                  <WeatherWidget now={now} weather={weather} />
                </div>
              </>
            )}
            {view !== "attendance" && view !== "insights" && view !== "notifications" && view !== "exams" && view !== "friends" && view !== "fullSchedule" && !compareTarget && view !== "tomorrow" && <Hero current={current} next={next} now={now} todayISO={todayISO} tomorrowISO={tomorrowISO} premiumMode={premiumMode} onMarkAttendance={markAttendance} attendance={attendance} />}
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
            {/* Compact "now" banner on Tomorrow tab so user knows what's happening today */}
            {view === "tomorrow" && (current || next) && (
              <div className="now-banner" onClick={() => setView("today")}>
                <span className="now-banner-dot" />
                <span className="now-banner-label">{current ? "NOW" : "UP NEXT"}</span>
                <span className="now-banner-name">
                  <span className="now-banner-text">{(current || next).name}</span>
                  {(current || next).session && (
                    <span className={`ses ses-${(Array.from((current || next).code).reduce((h, char) => h + char.charCodeAt(0), 0)) % 6}`}>
                      {(current || next).code} {(current || next).session}
                    </span>
                  )}
                </span>
                <span className="now-banner-time">{(current || next).start}{current ? `–${current.end}` : ""}</span>
                <span className="now-banner-go">Today →</span>
              </div>
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
                  />
                  : view === "friends"
                    ? <FriendsPanel
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
                        setCompareTarget({ mode: "group", groupData: { name: g.name, members } });
                      }}
                      notifications={friendNotifItems}
                      onDismissNotifs={() => markAllRead()}
                      onMarkRead={pingId => markPingRead(pingId)}
                      onMarkAllRead={() => markAllRead()}
                      onRemovePing={pingId => setPings(prev => prev.filter(p => p.id !== pingId))}
                      onClearAllPings={() => {
                        deleteAllFriendPings(userId);
                        setPings([]);
                        setReadPingIds(new Set());
                        try { localStorage.removeItem(READ_PINGS_KEY); } catch {}
                        markGroupsSeen();
                      }}
                    />
                    : view === "exams"
                      ? <ExamsPanel
                        allClasses={CLASSES}
                        enrolled={enrolled}
                        legend={enrolledLegend}
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
                          ? <NotificationsPage allChanges={CHANGES} myChanges={filteredChanges} />
                          : view === "admin" && isAdmin
                            ? <AdminDashboard user={user} startImpersonation={startImpersonation} syncLogs={syncLogs} timeOverride={timeOverride} setTimeOverride={setTimeOverride} />
                            : view === "fullSchedule"
                            ? <FullSchedulePage allClasses={CLASSES} enrolled={enrolled} legend={enrolledLegend} termLabel={termLabel} onBack={() => setView("today")} />
                            : todayList.length === 0 && tomorrowList.length === 0
                            ? premiumMode && syncing 
                              ? (
                                <ul className="rail">
                                  <li className="row premium-skeleton" style={{ height: "80px", marginBottom: "12px", border: "none" }} />
                                  <li className="row premium-skeleton" style={{ height: "80px", marginBottom: "12px", border: "none", opacity: 0.7 }} />
                                  <li className="row premium-skeleton" style={{ height: "80px", marginBottom: "12px", border: "none", opacity: 0.4 }} />
                                </ul>
                              )
                              : <div className="cva-card soft"><div className="cva-content"><strong>No classes!</strong><div className="cva-sub">Enjoy your free time.</div></div></div>
                            : view === "tomorrow"
                              ? <Timeline list={tomorrowList} current={null} now={now} showNowLine={false} label="Tomorrow" dateLabel={prettyDate(tomorrowISO)} attendance={attendance} markAttendance={markAttendance} syncStatus={<span className="live"><span className="pulse" /> Live · synced {syncedAgo === 0 ? "just now" : `${syncedAgo}m ago`}</span>} onRefresh={handleSync} isSyncing={syncing} premiumMode={premiumMode} />
                              : <Timeline list={todayList} current={current} now={now} dateLabel={prettyDate(todayISO)} attendance={attendance} markAttendance={markAttendance} syncStatus={<span className="live"><span className="pulse" /> Live · synced {syncedAgo === 0 ? "just now" : `${syncedAgo}m ago`}</span>} onRefresh={handleSync} isSyncing={syncing} premiumMode={premiumMode} />}
              </Suspense>
            </div>
          </main>
          <aside className={view !== "week" ? "side-col hide-mobile" : "side-col"}>
            <WeekAgenda visible={visible} now={now} offset={weekOffset} setOffset={setWeekOffset} todayISO={todayISO} onViewFullSchedule={() => setView("fullSchedule")} />
          </aside>
        </div>

        <footer className="foot">
          <span className="foot-credit">Auto-syncs from the live timetable sheet every few minutes</span>
          <span className="foot-credit">Built with <span className="foot-heart">♥</span> by <a href="https://www.linkedin.com/" target="_blank" rel="noopener noreferrer" className="foot-credit-name">Rakesh</a></span>
        </footer>

        <Suspense fallback={null}>
          <CommandPalette 
            isOpen={cmdOpen} 
            onClose={() => setCmdOpen(false)} 
            onViewChange={(v) => setView(v)} 
            allClasses={CLASSES}
            friends={friends}
          />
        </Suspense>

        {feedbackOpen && (
          <Suspense fallback={null}>
            <FeedbackWidget user={user} onClose={() => setFeedbackOpen(false)} />
          </Suspense>
        )}


        {/* Bottom nav — commented out, restore when needed
      <nav className="bnav" aria-label="Main navigation">
        <button className={`bnav-btn${view === "today" ? " on" : ""}`} onClick={() => setView("today")}>
          <Clock size={20} /><span>Today</span>
        </button>
        <button className={`bnav-btn${view === "tomorrow" ? " on" : ""}`} onClick={() => setView("tomorrow")}>
          <Sunrise size={20} /><span>Tomorrow</span>
        </button>
        <button className={`bnav-btn${view === "week" ? " on" : ""}`} onClick={() => setView("week")}>
          <Calendar size={20} /><span>Week</span>
        </button>
        <button className={`bnav-btn${view === "attendance" ? " on" : ""}`} onClick={() => setView("attendance")}>
          <ClipboardList size={20} /><span>Attendance</span>
        </button>
      </nav>
      */}
      </div>
    </div>
  );
}

export default function App() {
  const { isSignedIn, isLoaded, user } = useUser();
  const { signOut } = useClerk();
  const [domainBlocked, setDomainBlocked] = useState(false);

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !user) return;
    const email = user.primaryEmailAddress?.emailAddress || "";
    if (!email.toLowerCase().endsWith("@iimsambalpur.ac.in")) {
      signOut();
      setDomainBlocked(true);
    }
  }, [isLoaded, isSignedIn, user]);

  if (domainBlocked) return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100dvh", gap: 12, padding: 32, textAlign: "center" }}>
      <ShieldAlert size={44} style={{ color: "#e74c3c" }} />
      <p style={{ margin: 0, fontWeight: 700, fontSize: 17 }}>Access Restricted</p>
      <p style={{ margin: 0, color: "var(--muted, #888)", fontSize: 14, maxWidth: 280 }}>
        Only <strong>@iimsambalpur.ac.in</strong> email addresses can access this app.
      </p>
    </div>
  );

  return <AppCore isSignedIn={isSignedIn} isLoaded={isLoaded} signOut={signOut} userId={user?.id} user={user} />;
}

export function DevApp() {
  return <AppCore isSignedIn={true} isLoaded={true} signOut={() => { }} userId={null} />;
}
