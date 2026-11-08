import { useState, useEffect, useRef } from "react";
import { Bell, Sunrise, CalendarX, ArrowRightLeft, Users, Moon, Check, BellRing, Settings2, ChevronDown, Vibrate, Sparkles } from "lucide-react";
import { getFullPrefs, setFullPrefs, showTestNotification } from "../../lib/push.js";
import { hapticsSupported, hapticsEnabled, setHapticsEnabled, haptic } from "../../lib/haptics.js";

const LEAD_OPTIONS = [15, 30, 60];

const TYPES = [
  { key: 'festive_greeting', Icon: Sparkles, label: 'Festive greetings', hint: p => p.push ? 'One Diwali greeting per event; respects quiet hours' : 'No festive greeting pushes' },
  {
    key: "class_reminder",
    Icon: Bell,
    label: "Class reminders",
    hint: (p) =>
      p.push ? `${p.lead ?? 30}m before each of your classes` : "No class reminders",
    hasLead: true,
  },
  {
    key: "class_cancelled",
    Icon: CalendarX,
    label: "Cancellation alerts",
    hint: (p) =>
      p.push ? "Pushed when one of your classes is cancelled" : "No cancellation pushes",
  },
  {
    key: "daily_summary",
    Icon: Sunrise,
    label: "Morning summary",
    hint: (p) =>
      p.push ? `Your day's classes at ${p.time || "07:20"}` : "No morning digest",
    hasTime: true,
  },
  {
    key: "schedule_change",
    Icon: ArrowRightLeft,
    label: "Schedule changes",
    hint: (p) =>
      p.push ? "Pushed when a class is added or moved" : "No change alerts",
  },
  {
    key: "friend_request",
    Icon: Users,
    label: "Friend requests",
    hint: (p) =>
      p.push ? "Pushed when someone sends you a request" : "No social alerts",
  },
];

export function NotificationPrefsPanel({ userId, openSignal }) {
  const [prefs, setPrefs] = useState(null);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testState, setTestState] = useState("idle"); // idle | busy | sent | failed
  const [haptics, setHaptics] = useState(hapticsEnabled); // local device setting
  const testTimer = useRef(null);
  const rootRef = useRef(null);

  // Auto-open + scroll into view when the "Notification settings" menu item is
  // clicked (App bumps openSignal each time). Ignores the initial 0. Deferred to
  // the next frame so the open + scroll happen after paint.
  useEffect(() => {
    if (!openSignal) return;
    const id = requestAnimationFrame(() => {
      setOpen(true);
      rootRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
    return () => cancelAnimationFrame(id);
  }, [openSignal]);

  useEffect(() => {
    let cancelled = false;
    getFullPrefs(userId)
      .then((p) => { if (!cancelled) setPrefs(p); })
      .catch(() => {
        if (!cancelled) setPrefs({
          festive_greeting: { push: true, inapp: true },
          class_reminder:  { push: true,  inapp: true, lead: 30 },
          class_cancelled: { push: true,  inapp: true },
          daily_summary:   { push: false, inapp: false, time: "07:20" },
          schedule_change: { push: true,  inapp: true },
          friend_request:  { push: true,  inapp: true },
          quiet_start: null, quiet_end: null,
        });
      });
    return () => { cancelled = true; clearTimeout(testTimer.current); };
  }, [userId]);

  async function save(next) {
    const prev = prefs;
    setPrefs(next);
    setSaving(true);
    try { await setFullPrefs(userId, next); }
    catch { setPrefs(prev); }
    setSaving(false);
  }

  function setTypePref(key, patch) {
    save({ ...prefs, [key]: { ...prefs[key], ...patch } });
  }

  async function sendTest() {
    if (testState === "busy") return;
    setTestState("busy");
    try { await showTestNotification(); setTestState("sent"); }
    catch { setTestState("failed"); }
    clearTimeout(testTimer.current);
    testTimer.current = setTimeout(() => setTestState("idle"), 5000);
  }

  if (!prefs) return null;

  const hasQuiet = !!(prefs.quiet_start && prefs.quiet_end);

  // Build a compact summary line shown on the collapsed trigger
  const pushOnTypes = TYPES.filter(t => prefs[t.key]?.push !== false);
  const summary = pushOnTypes.length === TYPES.length
    ? "All alerts on"
    : pushOnTypes.length === 0
    ? "All alerts off"
    : `${pushOnTypes.length} of ${TYPES.length} alerts on`;

  return (
    <div ref={rootRef} className={`npp-dropdown${open ? " npp-dropdown-open" : ""}`}>
      {/* Trigger row */}
      <button
        className="npp-trigger"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        aria-label="Notification settings"
      >
        <Settings2 size={13} className="npp-trigger-icon" />
        <span className="npp-trigger-label">Notification settings</span>
        <span className="npp-trigger-summary">{summary}</span>
        <ChevronDown size={13} className={`npp-trigger-chev${open ? " open" : ""}`} />
      </button>

      {/* Expanded panel */}
      {open && (
        <div className="npp-panel">
          {/* Per-type rows */}
          {TYPES.map(({ key, Icon, label, hint, hasLead, hasTime }) => {
            const p = prefs[key] || {};
            return (
              <div key={key} className="reminder-row npp-row">
                <span className="reminder-bar-label">
                  <Icon size={13} />
                  {label}
                </span>

                <div className="reminder-seg" role="radiogroup" aria-label={`${label} push`}>
                  <button
                    className={`reminder-seg-btn${!p.push ? " reminder-seg-active" : ""}`}
                    disabled={saving}
                    onClick={() => setTypePref(key, { push: false })}
                  >
                    Off
                  </button>
                  <button
                    className={`reminder-seg-btn${p.push ? " reminder-seg-active" : ""}`}
                    disabled={saving}
                    onClick={() => setTypePref(key, { push: true })}
                  >
                    On
                  </button>
                </div>

                {hasLead && p.push && (
                  <div className="reminder-seg npp-lead" role="radiogroup" aria-label="Reminder lead time">
                    {LEAD_OPTIONS.map((min) => (
                      <button
                        key={min}
                        className={`reminder-seg-btn${p.lead === min ? " reminder-seg-active" : ""}`}
                        disabled={saving}
                        onClick={() => setTypePref(key, { lead: min })}
                      >
                        {min}m
                      </button>
                    ))}
                  </div>
                )}

                {hasTime && p.push && (
                  <input
                    type="time"
                    className="reminder-time"
                    value={p.time || "07:20"}
                    min="06:30"
                    max="22:00"
                    step={300}
                    disabled={saving}
                    onChange={(e) => { if (e.target.value) setTypePref(key, { time: e.target.value }); }}
                    aria-label="Summary time"
                  />
                )}

                <span className="reminder-bar-hint">{hint(p)}</span>
              </div>
            );
          })}

          {/* Quiet hours */}
          <div className="reminder-row npp-row">
            <span className="reminder-bar-label">
              <Moon size={13} />
              Quiet hours
            </span>
            <div className="reminder-seg" role="radiogroup" aria-label="Quiet hours">
              <button
                className={`reminder-seg-btn${!hasQuiet ? " reminder-seg-active" : ""}`}
                disabled={saving}
                onClick={() => save({ ...prefs, quiet_start: null, quiet_end: null })}
              >
                Off
              </button>
              <button
                className={`reminder-seg-btn${hasQuiet ? " reminder-seg-active" : ""}`}
                disabled={saving}
                onClick={() => { if (!hasQuiet) save({ ...prefs, quiet_start: "22:00", quiet_end: "07:00" }); }}
              >
                On
              </button>
            </div>
            {hasQuiet && (
              <span className="npp-quiet-range">
                <input
                  type="time"
                  className="reminder-time"
                  value={prefs.quiet_start}
                  disabled={saving}
                  onChange={(e) => { if (e.target.value) save({ ...prefs, quiet_start: e.target.value }); }}
                  aria-label="Quiet hours start"
                />
                <span className="npp-quiet-sep">to</span>
                <input
                  type="time"
                  className="reminder-time"
                  value={prefs.quiet_end}
                  disabled={saving}
                  onChange={(e) => { if (e.target.value) save({ ...prefs, quiet_end: e.target.value }); }}
                  aria-label="Quiet hours end"
                />
              </span>
            )}
            <span className="reminder-bar-hint">
              {hasQuiet
                ? `No non-urgent pushes ${prefs.quiet_start}–${prefs.quiet_end} IST`
                : "Pushes may arrive any time"}
            </span>
          </div>

          {/* Haptic feedback — local device setting, not synced (the ring/silent
              switch isn't readable from the web, so this is the manual control) */}
          {hapticsSupported() && (
            <div className="reminder-row npp-row">
              <span className="reminder-bar-label">
                <Vibrate size={13} />
                Haptic feedback
              </span>
              <div className="reminder-seg" role="radiogroup" aria-label="Haptic feedback">
                <button
                  className={`reminder-seg-btn${!haptics ? " reminder-seg-active" : ""}`}
                  onClick={() => { setHaptics(false); setHapticsEnabled(false); }}
                >
                  Off
                </button>
                <button
                  className={`reminder-seg-btn${haptics ? " reminder-seg-active" : ""}`}
                  onClick={() => { setHaptics(true); setHapticsEnabled(true); haptic(10); }}
                >
                  On
                </button>
              </div>
              <span className="reminder-bar-hint">
                Vibrate on taps &amp; actions. Turn off if you keep your phone on silent.
              </span>
            </div>
          )}

          {/* Delivery check */}
          <div className="reminder-row npp-row">
            <span className="reminder-bar-label">
              <BellRing size={13} />
              Device display test
            </span>
            <button
              className={`reminder-test-btn${testState === "sent" ? " reminder-test-sent" : ""}`}
              disabled={testState === "busy"}
              onClick={sendTest}
            >
              {testState === "sent"
                ? <><Check size={12} strokeWidth={3} /> Display requested — check notifications</>
                : testState === "failed" ? "Couldn't show it — try re-enabling push"
                : testState === "busy" ? "Displaying…"
                : "Test notification display"}
            </button>
            <span className="reminder-bar-hint">Checks device display only. Admin Tools → Send test to me checks server delivery.</span>
          </div>
        </div>
      )}
    </div>
  );
}
