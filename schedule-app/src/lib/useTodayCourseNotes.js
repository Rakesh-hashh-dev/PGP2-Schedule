import { useEffect, useState } from "react";
import { COURSE_HUB_KEY, loadCourseHubItems, mergeCourseHubItems, saveCourseHubItems, syncCourseHubItems } from "./courseHubStore.js";

export function useTodayCourseNotes(enabled, userId) {
  const [items, setItems] = useState(loadCourseHubItems);
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const refresh = async () => {
      setItems(loadCourseHubItems());
      if (!userId || !navigator.onLine) return;
      let result;
      try { result = await syncCourseHubItems(userId, loadCourseHubItems(), { readOnly: true }); }
      catch { return; } // Cached notes remain available offline.
      if (cancelled || !result.synced) return;
      const merged = mergeCourseHubItems(loadCourseHubItems(), result.items);
      saveCourseHubItems(merged);
      setItems(merged);
    };
    const local = () => setItems(loadCourseHubItems());
    const storage = event => { if (event.key === COURSE_HUB_KEY || event.key === null) local(); };
    const timer = setTimeout(() => { void refresh(); }, 0);
    window.addEventListener("focus", refresh);
    window.addEventListener("online", refresh);
    window.addEventListener("storage", storage);
    window.addEventListener("course-hub-items-changed", local);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("online", refresh);
      window.removeEventListener("storage", storage);
      window.removeEventListener("course-hub-items-changed", local);
    };
  }, [enabled, userId]);
  return items;
}
