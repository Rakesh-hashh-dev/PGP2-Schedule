import { useState, useEffect, useRef } from "react";
import { Bell, Sunrise, CalendarX, BellRing, Check } from "lucide-react";
import { getReminderPrefs, setReminderPrefs, showTestNotification } from "../../lib/push.js";

const LEAD_OPTIONS = [15, 30, 60];

export function ReminderBar({ userId }) {
  const [prefs, setPrefs] = useState(null); // { enabled, leadMinutes }
  const [saving, setSaving] = useState(false);
  const [testState, setTestState] = useState("idle"); // idle | busy | sent | failed
  const testTimer = useRef(null);

  useEffect(() => {
    let cancelled = false;
    getReminderPrefs(userId).then(p => { if (!cancelled) setPrefs(p); }).catch(() => {
      if (!cancelled) setPrefs({ enabled: true, leadMinutes: 30, cancellationAlerts: true });
    });
    return () => { cancelled = true; clearTimeout(testTimer.current); };
  }, [userId]);

  async function sendTest() {
    if (testState === "busy") return;
    setTestState("busy");
    try {
      await showTestNotification();
      setTestState("sent");
    } catch {
      setTestState("failed");
    }
    clearTimeout(testTimer.current);
    testTimer.current = setTimeout(() => setTestState("idle"), 5000);
  }

  if (!prefs) return null;

  async function save(next) {
    const prev = prefs;
    setPrefs(next);
    setSaving(true);
    try {
      await setReminderPrefs(userId, next);
    } catch (e) {
      setPrefs(prev);
      alert(e.message || "Could not save reminder settings.");
    }
    setSaving(false);
  }

  return (
    <div className="reminder-bar">
      <div className="reminder-row">
        <span className="reminder-bar-label">
          <Bell size={13} /> Class reminders
        </span>
        <div className="reminder-seg" role="radiogroup" aria-label="Class reminder lead time">
          <button
            className={`reminder-seg-btn${!prefs.enabled ? " reminder-seg-active" : ""}`}
            disabled={saving}
            onClick={() => save({ ...prefs, enabled: false })}
          >
            Off
          </button>
          {LEAD_OPTIONS.map(min => (
            <button
              key={min}
              className={`reminder-seg-btn${prefs.enabled && prefs.leadMinutes === min ? " reminder-seg-active" : ""}`}
              disabled={saving}
              onClick={() => save({ ...prefs, enabled: true, leadMinutes: min })}
            >
              {min}m
            </button>
          ))}
        </div>
        <span className="reminder-bar-hint">
          {prefs.enabled ? `Notified ${prefs.leadMinutes} min before each of your classes` : "No class reminders"}
        </span>
      </div>
      <div className="reminder-row">
        <span className="reminder-bar-label">
          <Sunrise size={13} /> Morning summary
        </span>
        <div className="reminder-seg" role="radiogroup" aria-label="Morning summary">
          <button
            className={`reminder-seg-btn${!prefs.dailySummary ? " reminder-seg-active" : ""}`}
            disabled={saving}
            onClick={() => save({ ...prefs, dailySummary: false })}
          >
            Off
          </button>
          <button
            className={`reminder-seg-btn${prefs.dailySummary ? " reminder-seg-active" : ""}`}
            disabled={saving}
            onClick={() => save({ ...prefs, dailySummary: true })}
          >
            On
          </button>
        </div>
        {prefs.dailySummary && (
          <input
            type="time"
            className="reminder-time"
            value={prefs.summaryTime}
            min="06:30"
            max="22:00"
            step={300}
            disabled={saving}
            onChange={e => {
              const t = e.target.value;
              if (t) save({ ...prefs, summaryTime: t });
            }}
            aria-label="Summary time"
          />
        )}
        <span className="reminder-bar-hint">
          {prefs.dailySummary ? `Your day's classes, every morning at ${prefs.summaryTime}` : "No morning digest"}
        </span>
      </div>
      <div className="reminder-row">
        <span className="reminder-bar-label">
          <CalendarX size={13} /> Cancellation alerts
        </span>
        <div className="reminder-seg" role="radiogroup" aria-label="Cancellation alerts">
          <button
            className={`reminder-seg-btn${!prefs.cancellationAlerts ? " reminder-seg-active" : ""}`}
            disabled={saving}
            onClick={() => save({ ...prefs, cancellationAlerts: false })}
          >
            Off
          </button>
          <button
            className={`reminder-seg-btn${prefs.cancellationAlerts ? " reminder-seg-active" : ""}`}
            disabled={saving}
            onClick={() => save({ ...prefs, cancellationAlerts: true })}
          >
            On
          </button>
        </div>
        <span className="reminder-bar-hint">
          {prefs.cancellationAlerts ? "Pushed when one of your classes is cancelled" : "No cancellation pushes"}
        </span>
      </div>
      <div className="reminder-row">
        <span className="reminder-bar-label">
          <BellRing size={13} /> Device display test
        </span>
        <button
          className={`reminder-test-btn${testState === "sent" ? " reminder-test-sent" : ""}`}
          disabled={testState === "busy"}
          onClick={sendTest}
        >
          {testState === "sent" ? <><Check size={12} strokeWidth={3} /> Display requested — check notifications</>
            : testState === "failed" ? "Couldn't show it — try re-enabling push"
            : testState === "busy" ? "Displaying…"
            : "Test notification display"}
        </button>
        <span className="reminder-bar-hint">Checks device display only. Admin Tools → Send test to me checks server delivery.</span>
      </div>
    </div>
  );
}
