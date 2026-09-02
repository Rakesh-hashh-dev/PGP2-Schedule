// Notification/read-state, extracted from App.jsx.
//
// Split in two because of a temporal-ordering constraint: the read-state
// primitives (readPingIds/readChangeKeys/seenRecvGroupIds/pings/alerts) must
// exist *before* App.jsx computes filteredChanges/friendNotifItems/etc (those
// useMemo's read this state), but the handlers below need those derived
// values as inputs. So `useNotifications()` is the actual hook — call it
// early, in the same spot the original useState calls lived — and
// `buildNotificationHandlers()` is a plain (non-hook) factory called later,
// once the derived values exist, mirroring where the original handler
// functions were defined in App.jsx.
//
// handleAcceptFriendRequest/handleDeclineFriendRequest were considered for
// this module but lean on friends/groups mutation (decodeSchedule, saveFriend,
// sendFriendPing, getOrCreateShareCode, deleteFriendPing) rather than
// notification read-state, so they stay in App.jsx as friends-domain logic.
import { useState } from "react";
import { markNotificationRead, markAllNotificationsRead } from "../lib/notifications.js";
import { pushReadState, pushProfile } from "../lib/profile.js";
import { deleteAllFriendPings } from "../lib/friends.js";
import {
  loadReadPingIds, loadReadChangeKeys,
  READ_PINGS_KEY, READ_CHANGES_KEY, CLEARED_GROUPS_KEY, NOTIF_KEY,
} from "../lib/appStorage.js";

export function useNotifications() {
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifFilter, setNotifFilter] = useState("all"); // all | social | classes
  const [readPingIds, setReadPingIds] = useState(() => loadReadPingIds());
  const [readChangeKeys, setReadChangeKeys] = useState(() => loadReadChangeKeys());
  const [seenRecvGroupIds, setSeenRecvGroupIds] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem("pgp2.seen-recv-groups") || "[]")); }
    catch { return new Set(); }
  });
  const [pings, setPings] = useState([]);
  const [alerts, setAlerts] = useState([]);

  return {
    notifOpen, setNotifOpen,
    notifFilter, setNotifFilter,
    readPingIds, setReadPingIds,
    readChangeKeys, setReadChangeKeys,
    seenRecvGroupIds, setSeenRecvGroupIds,
    pings, setPings,
    alerts, setAlerts,
  };
}

// state: the object returned by useNotifications() above.
// deps: { userId, enrolled, changes, userName, userImageUrl, filteredChanges,
//   friendNotifItems, newRecvGroups, allRecvGroups, receivedGroupCount,
//   unreadAlertCount, isAdmin, changeKey, setClearedGroupIds, setSeenRecvCount,
//   setLastSeenTs, notifOpenedAt, setView }
export function buildNotificationHandlers(state, deps) {
  const {
    notifOpen, setNotifOpen,
    readPingIds, setReadPingIds,
    readChangeKeys, setReadChangeKeys,
    seenRecvGroupIds, setSeenRecvGroupIds,
    pings, setPings,
    setAlerts,
  } = state;
  const {
    userId, enrolled, changes, userName, userImageUrl,
    filteredChanges, friendNotifItems, newRecvGroups, allRecvGroups,
    receivedGroupCount, unreadAlertCount, isAdmin, changeKey,
    setClearedGroupIds, setSeenRecvCount, setLastSeenTs, notifOpenedAt, setView,
  } = deps;

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
    return markChangesRead((changes || []).filter(c => isAdmin || !c.admin_only));
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

  // Drop a ping row everywhere it lives: server table + local list state
  function removePingEverywhere(pingId) {
    markNotificationRead(pingId);
    setPings(prev => prev.filter(p => p.id !== pingId));
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
      pushProfile(userId, enrolled, userName, latest, userImageUrl);
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

  return {
    markGroupsSeen, markPingRead, markAlertRead, markChangeRead, markChangesRead,
    markAllChangesRead, markAllRead, removePingEverywhere, clearAllFriendNotifs,
    handleOpenNotif, handleViewAllNotifs,
  };
}
