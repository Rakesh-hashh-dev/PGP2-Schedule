import { useState, useEffect, useRef } from "react";
import { getNotifPrefs, setNotifPrefs } from "../lib/profile.js";

const DISMISSED_KEY = "pgp2.notif-dismissed-keys";
const MUTED_KEY = "pgp2.notif-muted-courses";
const SNOOZED_KEY = "pgp2.notif-snoozed";

function loadSet(key) { try { return new Set(JSON.parse(localStorage.getItem(key) || "[]")); } catch { return new Set(); } }
function saveSet(key, set) { try { localStorage.setItem(key, JSON.stringify([...set])); } catch { } }
function loadMap(key) { try { return JSON.parse(localStorage.getItem(key) || "{}"); } catch { return {}; } }
function saveMap(key, map) { try { localStorage.setItem(key, JSON.stringify(map)); } catch { } }

function loadSnoozed() {
  const map = loadMap(SNOOZED_KEY);
  let pruned = false;
  for (const k of Object.keys(map)) {
    if (!(map[k] > Date.now())) { delete map[k]; pruned = true; }
  }
  if (pruned) saveMap(SNOOZED_KEY, map);
  return map;
}

export function snoozeWakeTime(change) {
  if (!change?.date) return Date.now() + 12 * 60 * 60 * 1000;
  const target = new Date(change.date + "T06:00:00").getTime() - 24 * 60 * 60 * 1000;
  return Math.max(target, Date.now() + 60 * 60 * 1000);
}

export function useNotificationState(userId) {
  const [dismissed, setDismissed] = useState(() => loadSet(DISMISSED_KEY));
  const [mutedCourses, setMutedCourses] = useState(() => loadSet(MUTED_KEY));
  const [snoozed, setSnoozed] = useState(loadSnoozed); // key -> wake-at ms
  const [undo, setUndo] = useState(null); // { kind, keys, key, prevWake, label }
  const undoTimer = useRef(null);

  useEffect(() => () => clearTimeout(undoTimer.current), []);

  // Sync from cloud on mount
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    getNotifPrefs(userId).then(cloud => {
      if (cancelled || !cloud) return;
      if (cloud.dismissedKeys?.length) {
        setDismissed(prev => {
          const merged = new Set([...prev, ...cloud.dismissedKeys]);
          saveSet(DISMISSED_KEY, merged);
          return merged;
        });
      }
      if (cloud.mutedCourses?.length) {
        setMutedCourses(prev => {
          const merged = new Set([...prev, ...cloud.mutedCourses]);
          saveSet(MUTED_KEY, merged);
          return merged;
        });
      }
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [userId]);

  // Sync across tabs
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === DISMISSED_KEY) setDismissed(loadSet(DISMISSED_KEY));
      if (e.key === MUTED_KEY) setMutedCourses(loadSet(MUTED_KEY));
      if (e.key === SNOOZED_KEY) setSnoozed(loadSnoozed());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  function dismissKeys(keys, label) {
    const next = new Set([...dismissed, ...keys]);
    setDismissed(next);
    saveSet(DISMISSED_KEY, next);
    setNotifPrefs(userId, { dismissedKeys: [...next] });
    clearTimeout(undoTimer.current);
    setUndo({ kind: "dismiss", keys, label });
    undoTimer.current = setTimeout(() => setUndo(null), 5000);
  }

  function undoLast() {
    if (!undo) return;
    if (undo.kind === "snooze") {
      const next = { ...snoozed };
      if (undo.prevWake) next[undo.key] = undo.prevWake; else delete next[undo.key];
      setSnoozed(next);
      saveMap(SNOOZED_KEY, next);
    } else {
      const next = new Set(dismissed);
      undo.keys.forEach(k => next.delete(k));
      setDismissed(next);
      saveSet(DISMISSED_KEY, next);
      setNotifPrefs(userId, { dismissedKeys: [...next] });
    }
    setUndo(null);
    clearTimeout(undoTimer.current);
  }

  function toggleMute(code) {
    if (!code) return;
    const next = new Set(mutedCourses);
    if (next.has(code)) next.delete(code); else next.add(code);
    setMutedCourses(next);
    saveSet(MUTED_KEY, next);
    setNotifPrefs(userId, { mutedCourses: [...next] });
  }

  function snoozeItem(key, change) {
    const prevWake = snoozed[key];
    const next = { ...snoozed, [key]: snoozeWakeTime(change) };
    setSnoozed(next);
    saveMap(SNOOZED_KEY, next);
    clearTimeout(undoTimer.current);
    setUndo({ kind: "snooze", key, prevWake, label: change?.text || "Snoozed until closer to the date" });
    undoTimer.current = setTimeout(() => setUndo(null), 5000);
  }

  return {
    dismissed,
    mutedCourses,
    snoozed,
    undo,
    dismissKeys,
    undoLast,
    toggleMute,
    snoozeItem
  };
}
