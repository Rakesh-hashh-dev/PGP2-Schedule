import { useCallback, useEffect, useRef, useState } from "react";
import { subscribeMeetups } from "../lib/meetups.js";
import { loadSocialAvailability, subscribeBusyBlocks } from "../lib/socialAvailability.js";

export function useSocialAvailability(userId) {
  const [data, setData] = useState({ owner: null, blocks: [], commitments: [], loaded: false, error: "" });
  const epoch = useRef({ value: 0 });
  const mounted = useRef(false);
  const refresh = useCallback(async () => {
    const request = ++epoch.current.value;
    try {
      const result = await loadSocialAvailability(userId);
      if (mounted.current && request === epoch.current.value) setData({ ...result, owner: userId, loaded: true, error: "" });
    } catch (error) {
      if (mounted.current && request === epoch.current.value) setData({ owner: userId, blocks: [], commitments: [], loaded: false, error: error.message });
    }
  }, [userId]);
  useEffect(() => {
    mounted.current = true;
    const requests = epoch.current;
    const timer = setTimeout(() => void refresh(), 0);
    const stop = subscribeMeetups(userId, refresh);
    const stopBlocks = subscribeBusyBlocks(userId, refresh);
    const visibleRefresh = () => { if (document.visibilityState === "visible") refresh(); };
    const interval = setInterval(visibleRefresh, 30000);
    window.addEventListener("focus", refresh);
    window.addEventListener("online", visibleRefresh);
    document.addEventListener("visibilitychange", visibleRefresh);
    window.addEventListener("pgp2:social-meetup", refresh);
    window.addEventListener("pgp2:social-availability", refresh);
    return () => { mounted.current = false; clearTimeout(timer); clearInterval(interval); stop(); stopBlocks(); ++requests.value; window.removeEventListener("focus", refresh); window.removeEventListener("online", visibleRefresh); document.removeEventListener("visibilitychange", visibleRefresh); window.removeEventListener("pgp2:social-meetup", refresh); window.removeEventListener("pgp2:social-availability", refresh); };
  }, [userId, refresh]);
  return { ...(data.owner === userId ? data : { blocks: [], commitments: [], loaded: false, error: "" }), refresh };
}
