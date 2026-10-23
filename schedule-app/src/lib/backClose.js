// Lets the device/browser back button close a popup (modal, sheet, menu)
// instead of leaving the page.
//
// Opening a popup pushes a history entry tagged with how many popups are
// open. Back lands on the entry beneath it, and every popup above that depth
// is closed, topmost first. Closing in-app (X, backdrop, Esc) consumes the
// popup's own entry with history.back() so dead entries don't pile up and
// make the next back press do nothing. The entry beneath carries the same
// `tfView`, so App's view handler treats that back as a no-op.
import { useEffect, useLayoutEffect, useRef } from "react";

const stack = []; // open popups, oldest first: { token, close, popped }
let listening = false;

function onPop(event) {
  const depth = event.state?.tfPopupDepth || 0;
  while (stack.length > depth) {
    const top = stack.pop();
    top.popped = true;
    top.close();
  }
}

let seq = 0;

export function useBackClose(onClose, open = true) {
  const closeRef = useRef(onClose);
  useLayoutEffect(() => { closeRef.current = onClose; });

  useEffect(() => {
    if (!open) return undefined;
    if (!listening) {
      window.addEventListener("popstate", onPop);
      listening = true;
    }
    const entry = { token: `p${++seq}`, close: () => closeRef.current?.(), popped: false };
    stack.push(entry);
    try {
      const top = window.history.state;
      const next = { ...top, tfPopupDepth: stack.length, tfPopup: entry.token };
      // A popup that just closed in-app leaves its entry on top until the
      // deferred rewind below runs. Reuse it rather than stacking a new one:
      // covers StrictMode's mount→unmount→mount and close-one-open-another.
      const orphaned = top?.tfPopup && top.tfPopupDepth === stack.length
        && !stack.some(e => e.token === top.tfPopup);
      if (orphaned) window.history.replaceState(next, "");
      else window.history.pushState(next, "", window.location.href);
    } catch { /* history unavailable — popup still works, just not via back */ }

    return () => {
      if (entry.popped) return; // closed by back; its entry is already gone
      const i = stack.indexOf(entry);
      if (i !== -1) stack.splice(i, 1);
      // Rewind only if our entry is still on top once this tick settles — not
      // if another popup took it over, or something navigated past it (a
      // popup action that switches views).
      setTimeout(() => {
        if (window.history.state?.tfPopup === entry.token) window.history.back();
      }, 0);
    };
  }, [open]);
}
