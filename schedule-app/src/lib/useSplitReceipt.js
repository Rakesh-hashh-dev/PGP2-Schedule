import { useEffect, useState } from "react";
import { receiptImageUrl } from "./expenses.js";
export function useReceipt(path) {
  const [, redraw] = useState(0);
  useEffect(() => {
    const changed = e => { if (e.detail === path) redraw(n => n + 1); };
    window.addEventListener("split-receipt-ready", changed);
    const timer = setInterval(() => { if (path) redraw(n => n + 1); }, 840000);
    return () => { window.removeEventListener("split-receipt-ready", changed); clearInterval(timer); };
  }, [path]);
  return receiptImageUrl(path);
}
