import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useReceipt } from "../../lib/useSplitReceipt.js";
import { useBackClose } from "../../lib/backClose.js";

export function Modal({ title, onClose, children, wide = false }) {
  useBackClose(onClose);
  const ref = useRef(null), close = useRef(onClose);
  useEffect(() => { close.current = onClose; }, [onClose]);
  useEffect(() => {
    const prior = document.activeElement, element = ref.current, overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focus = () => [...element.querySelectorAll('button, input, select, textarea, a[href], summary, [tabindex="0"]')].filter(e => !e.disabled && !e.hidden && e.getBoundingClientRect().height > 0 && (!e.closest("details:not([open])") || e.tagName === "SUMMARY"));
    (element.querySelector('[autofocus]') || focus()[0] || element).focus();
    const key = e => {
      if (e.key === "Escape") { e.preventDefault(); close.current(); }
      if (e.key === "Tab") { const items = focus(), first = items[0], last = items.at(-1); if (!items.length) { e.preventDefault(); return; } if (e.shiftKey && (document.activeElement === first || document.activeElement === element)) { e.preventDefault(); last.focus(); } else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); } }
    };
    const contain = e => { if (!element.contains(e.target)) (focus()[0] || element).focus(); };
    document.addEventListener("focusin", contain);
    element.addEventListener("keydown", key);
    return () => { document.removeEventListener("focusin", contain); element.removeEventListener("keydown", key); document.body.style.overflow = overflow; prior?.focus(); };
  }, []);
  return createPortal(<div className="sp-modal-backdrop sc-scope" onClick={onClose}><section ref={ref} tabIndex={-1} className={`sp-modal sc-dialog ${wide ? "sp-modal-lg" : ""}`} role="dialog" aria-modal="true" aria-label={title} onClick={e => e.stopPropagation()}><div className="sp-modal-head"><h3>{title}</h3><button className="sp-icon-btn" onClick={onClose} aria-label="Close dialog"><X size={18}/></button></div>{children}</section></div>, document.body);
}
export function ReceiptImage({ path }) {
  const url = useReceipt(path);
  return url ? <a className="sc-receipt" href={url} target="_blank" rel="noreferrer"><img src={url} alt="Expense receipt" loading="lazy"/></a> : null;
}
