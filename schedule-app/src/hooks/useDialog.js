import { useEffect, useRef } from "react";

// Shared modal/sheet keyboard behaviour: moves focus in on open, traps Tab
// inside, closes on Escape, and hands focus back to the opener on close.
// Spread `dialogProps` on the dialog container (not the backdrop).
//
//   const dialogRef = useDialog(open, onClose);
//   <div ref={dialogRef} {...dialogProps("Title")}>…</div>
//
// Only the most recently opened dialog reacts to keys, so nested sheets
// (e.g. a confirm inside a modal) close one layer at a time.
//
// Pass { modal: false } for lightweight popovers/menus (some open on hover):
// Escape still closes and focus still returns to the opener, but focus is not
// pulled in on open and Tab is not trapped.

const FOCUSABLE = 'button, a[href], input, select, textarea, summary, [tabindex]:not([tabindex="-1"])';
const stack = [];

function focusables(node) {
  return [...node.querySelectorAll(FOCUSABLE)].filter(el =>
    !el.disabled && !el.closest("[inert]") && el.getClientRects().length > 0);
}

export function useDialog(open = true, onClose, { modal = true } = {}) {
  const ref = useRef(null);
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; }, [onClose]);

  useEffect(() => {
    if (!open) return undefined;
    const node = ref.current;
    if (!node) return undefined;
    const opener = document.activeElement;
    const entry = { node };
    stack.push(entry);

    // Respect an explicit autoFocus inside the dialog; otherwise focus the
    // container itself so screen readers announce the dialog's name first.
    if (modal && !node.contains(document.activeElement)) {
      const auto = node.querySelector("[autofocus], [data-autofocus]");
      (auto || node).focus({ preventScroll: true });
    }

    const onKey = (event) => {
      if (stack[stack.length - 1] !== entry) return;
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        closeRef.current?.();
      } else if (modal && event.key === "Tab") {
        const items = focusables(node);
        if (!items.length) { event.preventDefault(); node.focus(); return; }
        const first = items[0], last = items[items.length - 1];
        const active = document.activeElement;
        if (event.shiftKey && (active === first || active === node || !node.contains(active))) {
          event.preventDefault(); last.focus();
        } else if (!event.shiftKey && (active === last || !node.contains(active))) {
          event.preventDefault(); first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);

    return () => {
      document.removeEventListener("keydown", onKey);
      const i = stack.indexOf(entry);
      if (i !== -1) stack.splice(i, 1);
      // Only restore if focus was inside the closing dialog (or, for modals,
      // lost to <body>), so we never steal focus from whatever opened next —
      // and a hover-opened popover never yanks focus on mouse-leave.
      const hadFocus = node.contains(document.activeElement);
      requestAnimationFrame(() => {
        const active = document.activeElement;
        const lost = hadFocus || (modal && (!active || active === document.body));
        if (lost && opener?.isConnected && opener !== document.body && opener.focus) opener.focus({ preventScroll: true });
      });
    };
  }, [open, modal]);

  return ref;
}

// Standard ARIA props for a dialog container. Pass a visible heading id via
// `labelledBy`, or a plain-text `label` when there is no heading.
export function dialogProps(label, { labelledBy } = {}) {
  return {
    role: "dialog",
    "aria-modal": "true",
    tabIndex: -1,
    ...(labelledBy ? { "aria-labelledby": labelledBy } : { "aria-label": label }),
  };
}
