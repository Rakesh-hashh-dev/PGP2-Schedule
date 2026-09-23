import { useMemo, useState, useEffect, useRef } from "react";
import { attentionPriority } from "../lib/notificationWorkspace.js";

const BUNDLE_MIN = 3;
const BUNDLE_WINDOW_MS = 15 * 60 * 1000;
const ATTN_MAX = 5;
export const FEED_PAGE_SIZE = 30;

function getDateLabel(iso) {
  const now = new Date();
  const d = new Date(iso);
  const diffDays = Math.floor((now.setHours(0,0,0,0) - d.setHours(0,0,0,0)) / 86400000);
  if (diffDays <= 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return "This Week";
  return "Older";
}

function groupByDate(items) {
  const groups = {};
  const ORDER = ["Today", "Yesterday", "This Week", "Older"];
  for (const it of items) {
    const label = getDateLabel(it.ts);
    if (!groups[label]) groups[label] = [];
    groups[label].push(it);
  }
  return ORDER.filter(l => groups[l]).map(l => ({ label: l, items: groups[l] }));
}

function groupByCourse(items, legend) {
  const byCode = {};
  for (const it of items) {
    const code = it.code || "";
    if (!byCode[code]) byCode[code] = [];
    byCode[code].push(it);
  }
  const codes = Object.keys(byCode).sort((a, b) => {
    const na = legend?.[a]?.name || a || "zzz";
    const nb = legend?.[b]?.name || b || "zzz";
    return na.localeCompare(nb);
  });
  return codes.map(code => ({
    label: legend?.[code]?.name || code || "Other",
    code,
    items: byCode[code].sort((a, b) => new Date(b.ts) - new Date(a.ts)),
  }));
}

function buildFeed(changes) {
  const items = [];
  const used = new Set();
  for (let i = 0; i < changes.length; i++) {
    if (used.has(i)) continue;
    const c = changes[i];
    const runIdx = [i];
    if (c.code) {
      for (let j = i + 1; j < changes.length; j++) {
        if (used.has(j)) continue;
        if (
          changes[j].code === c.code &&
          changes[j].kind === c.kind &&
          Math.abs(new Date(changes[j].ts) - new Date(c.ts)) < BUNDLE_WINDOW_MS
        ) runIdx.push(j);
      }
    }
    if (runIdx.length >= BUNDLE_MIN) {
      runIdx.forEach(k => used.add(k));
      items.push({ type: "bundle", id: "b-" + c.id, kind: c.kind, code: c.code, ts: c.ts, changes: runIdx.map(k => changes[k]) });
    } else {
      items.push({ type: "single", id: c.id, kind: c.kind, code: c.code, ts: c.ts, change: c });
    }
  }
  return items;
}

export function useNotificationFeed({
  allChanges,
  myChanges,
  isAdmin,
  showAll,
  kindFilter,
  groupMode,
  query,
  dismissed,
  mutedCourses,
  snoozed,
  readKeys,
  keyOf,
  legend,
  nowTick
}) {
  const visibleAll = useMemo(() => {
    return isAdmin ? (allChanges || []) : (allChanges || []).filter(c => !c.admin_only);
  }, [allChanges, isAdmin]);

  const changes = useMemo(() => {
    return showAll ? visibleAll : (myChanges || []);
  }, [showAll, visibleAll, myChanges]);

  const [newPillCount, setNewPillCount] = useState(0);
  const prevChangeIdsRef = useRef(null);

  useEffect(() => {
    const ids = new Set(changes.map(keyOf));
    if (prevChangeIdsRef.current) {
      const added = [...ids].filter(id => !prevChangeIdsRef.current.has(id));
      if (added.length > 0 && window.scrollY > 200) {
        setNewPillCount(n => n + added.length);
      }
    }
    prevChangeIdsRef.current = ids;
  }, [changes, keyOf]);

  useEffect(() => {
    if (newPillCount === 0) return;
    const onScroll = () => { if (window.scrollY < 100) setNewPillCount(0); };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [newPillCount]);

  const [visibleCount, setVisibleCount] = useState(FEED_PAGE_SIZE);

  const filterSig = `${kindFilter}|${groupMode}|${query}|${showAll}`;
  const [prevFilterSig, setPrevFilterSig] = useState(filterSig);
  if (filterSig !== prevFilterSig) {
    setPrevFilterSig(filterSig);
    setVisibleCount(FEED_PAGE_SIZE);
  }

  const { visible, kindCounts, weekTotal } = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matchesKind = (k) => kindFilter === "all" ? true
      : kindFilter === "critical" ? (k === "removed" || k === "moved")
      : kindFilter === "update" ? (k === "update" || k === "course")
      : k === kindFilter;
    const passesBaseFilters = (c) =>
      !dismissed.has(keyOf(c)) &&
      !(c.kind === "update" && c.code && mutedCourses.has(c.code)) &&
      (!q || c.text?.toLowerCase().includes(q) || (legend?.[c.code]?.name || c.code || "").toLowerCase().includes(q));

    const kindCounts = { all: 0, critical: 0, added: 0, removed: 0, moved: 0, update: 0 };
    const WEEK_AGO = nowTick - 7 * 24 * 60 * 60 * 1000;
    const weekCounts = { added: 0, removed: 0, moved: 0, update: 0 };

    for (const c of changes) {
      if (!passesBaseFilters(c)) continue;
      kindCounts.all++;
      const bucket = c.kind === "course" ? "update" : c.kind;
      if (kindCounts[bucket] !== undefined) kindCounts[bucket]++;
      if (bucket === "removed" || bucket === "moved") kindCounts.critical++;
      if (bucket !== undefined && weekCounts[bucket] !== undefined && new Date(c.ts).getTime() >= WEEK_AGO) weekCounts[bucket]++;
    }
    const weekTotal = weekCounts.added + weekCounts.removed + weekCounts.moved + weekCounts.update;
    const visible = changes.filter(c => matchesKind(c.kind) && passesBaseFilters(c));

    return { visible, kindCounts, weekTotal };
  }, [changes, query, kindFilter, dismissed, mutedCourses, legend, nowTick, keyOf]);

  const { groups, attnItems, olderHiddenCount } = useMemo(() => {
    const feed = buildFeed(visible);
    const isUnreadItem = (it) =>
      it.type === "bundle" ? it.changes.some(c => !readKeys.has(keyOf(c))) : !readKeys.has(keyOf(it.change));
    const isSnoozed = (it) => {
      const wake = snoozed[it.id];
      return wake && nowTick < wake;
    };

    const priorityOfItem = (it) => {
      const source = it.type === "bundle" ? it.changes[0] : it.change;
      return attentionPriority(source, nowTick);
    };
    const attnItems = feed
      .filter(it => priorityOfItem(it) > 0 && isUnreadItem(it) && !isSnoozed(it))
      .sort((a, b) => priorityOfItem(b) - priorityOfItem(a) || new Date(b.ts) - new Date(a.ts))
      .slice(0, ATTN_MAX);
    const attnIds = new Set(attnItems.map(it => it.id));
    const rest = feed.filter(it => !attnIds.has(it.id));
    
    const groupsAll = groupMode === "course" ? groupByCourse(rest, legend) : groupByDate(rest);
    const totalRows = groupsAll.reduce((n, g) => n + g.items.length, 0);
    
    const groups = [];
    let remaining = visibleCount;
    for (const g of groupsAll) {
      if (remaining <= 0) break;
      groups.push(g.items.length <= remaining ? g : { ...g, items: g.items.slice(0, remaining) });
      remaining -= g.items.length;
    }
    const olderHiddenCount = Math.max(0, totalRows - visibleCount);

    return { groups, attnItems, olderHiddenCount };
  }, [visible, readKeys, keyOf, snoozed, nowTick, groupMode, legend, visibleCount]);

  const unreadCount = changes.filter(c => !readKeys.has(keyOf(c))).length;
  const myCount = (myChanges || []).length;
  const extraCount = Math.max(0, visibleAll.length - myCount);
  const dismissedInScope = changes.filter(c => dismissed.has(keyOf(c))).length;
  
  return {
    changes,
    visibleAll,
    groups,
    attnItems,
    olderHiddenCount,
    visibleCount,
    setVisibleCount,
    kindCounts,
    weekTotal,
    unreadCount,
    extraCount,
    dismissedInScope,
    newPillCount,
    setNewPillCount,
    hasAnyChanges: (allChanges && allChanges.length > 0)
  };
}
