import { XCircle } from "lucide-react";
import "../styles/cancelled-classes.css";

export function CancellationStripe({ compact = false }) {
  return <span className={"cancellation-stripe" + (compact ? " is-compact" : "")}><XCircle size={13} aria-hidden="true" />Cancelled</span>;
}

export function CancelledClassActions({ actions = [] }) {
  if (!actions.length) return null;
  return <div className="cancelled-class-actions" aria-label="Unavailable class actions">
    {actions.map(action => <button key={action} type="button" disabled title="Class cancelled" aria-label={action + " unavailable: class cancelled"}>{action}</button>)}
  </div>;
}
