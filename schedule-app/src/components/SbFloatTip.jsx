import { createPortal } from "react-dom";
import { useSbFloatTip } from "../lib/sbFloatTip.js";

// Floating label for the collapsed sidebar; state lives in lib/sbFloatTip.js.
export default function SbFloatTip() {
  const t = useSbFloatTip();
  if (!t) return null;
  return createPortal(
    <div className="sb-float-tip" style={{ top: t.top, left: t.left }}>{t.label}</div>,
    document.body
  );
}
