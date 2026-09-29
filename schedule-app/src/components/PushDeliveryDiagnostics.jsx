import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import "../styles/push-delivery-diagnostics.css";

const REASONS = [
  ["no_subscription", "No subscribed device"],
  ["preference_off", "Push turned off in preferences"],
  ["quiet_hours", "Quiet hours at last attempt"],
  ["expired", "Expired before delivery"],
  ["endpoint_rejected", "Device endpoint expired or rejected"],
  ["provider_error", "Push provider error"],
];

export default function PushDeliveryDiagnostics({ broadcasts = [] }) {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const refresh = async () => {
    setLoading(true);
    const { data, error: rpcError } = await supabase.rpc("get_push_delivery_diagnostics");
    if (rpcError) {
      setError("Delivery reasons are unavailable. Apply the diagnostics migration, then refresh.");
      setRows(null);
    } else {
      setRows(data || []);
      setError("");
    }
    setLoading(false);
  };

  useEffect(() => {
    let active = true;
    supabase.rpc("get_push_delivery_diagnostics").then(({ data, error: rpcError }) => {
      if (!active) return;
      if (rpcError) setError("Delivery reasons are unavailable. Apply the diagnostics migration, then refresh.");
      else setRows(data || []);
    });
    return () => { active = false; };
  }, []);

  const byKey = new Map((rows || []).map(row => [row.dedup_key, row]));
  return (
    <section className="push-diagnostics" aria-label="Push delivery reasons">
      <div className="push-diagnostics-head">
        <div>
          <strong>Delivery reasons</strong>
          <p>Recipient counts for recent broadcasts. Reasons update as the dispatcher retries; older broadcasts may have no recorded reason.</p>
        </div>
        <button type="button" onClick={refresh} disabled={loading}>{loading ? "Refreshing…" : "Refresh"}</button>
      </div>
      {error && <p role="status" className="push-diagnostics-empty">{error}</p>}
      {!error && rows === null && <p className="push-diagnostics-empty">Loading delivery reasons…</p>}
      {!error && rows && broadcasts.length === 0 && <p className="push-diagnostics-empty">No broadcasts to diagnose yet.</p>}
      {!error && rows && broadcasts.slice(0, 6).map(broadcast => {
        const row = byKey.get(broadcast.dedup_key);
        if (!row) return null;
        const undelivered = Number(row.total) - Number(row.delivered);
        const reasons = REASONS.filter(([key]) => Number(row[key]) > 0);
        return (
          <details className="push-diagnostics-item" key={broadcast.dedup_key}>
            <summary><span>{broadcast.title || "(no title)"}</span><strong>{undelivered} without confirmed push delivery</strong></summary>
            <div className="push-diagnostics-list">
              {reasons.map(([key, label]) => <div key={key}><span>{label}</span><strong>{row[key]}</strong></div>)}
              {Number(row.pending_or_unknown) > 0 && <div><span>Pending or reason unavailable</span><strong>{row.pending_or_unknown}</strong></div>}
              {undelivered === 0 && <p>All recipients have a confirmed push handoff.</p>}
            </div>
          </details>
        );
      })}
      {!error && rows && <p className="push-diagnostics-note">“Delivered” means the push service accepted the message; it does not confirm the device displayed it. In-app inbox delivery is separate. A quiet-hours reason describes the last dispatch attempt, and can change after retry.</p>}
    </section>
  );
}
