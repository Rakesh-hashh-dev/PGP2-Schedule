import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  BellRing,
  Bookmark,
  Check,
  CheckCheck,
  ClipboardPaste,
  Copy,
  ExternalLink,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import { useBackClose } from "../lib/backClose.js";
import { useDialog, dialogProps } from "../hooks/useDialog.js";
import {
  REGISTRO_ATTENDANCE_URL,
  REGISTRO_FEEDBACK_URL,
  buildRegistroBookmarklet,
  matchRegistroSessionsToClasses,
  parseRegistroPaste,
} from "../lib/registroSync.js";
import "../styles/registro-sync.css";

export default function RegistroSyncModal({
  isOpen,
  onClose,
  initialPreview = null,
  onClearInitialPreview,
  registroSync = null,
  attendanceUrl = REGISTRO_ATTENDANCE_URL,
  feedbackUrl = REGISTRO_FEEDBACK_URL,
  allClasses = [],
  enrolled = {},
  legend = {},
  onApplySync,
}) {
  const [tab, setTab] = useState("paste"); // "paste" | "bookmarklet"
  const [pasteText, setPasteText] = useState("");
  const [manualCourseCode, setManualCourseCode] = useState("");
  const [applySessions, setApplySessions] = useState(true);
  const [copiedBookmarklet, setCopiedBookmarklet] = useState(false);
  const [dragHint, setDragHint] = useState(false);
  const [notifPerm, setNotifPerm] = useState(() =>
    typeof window !== "undefined" && "Notification" in window ? Notification.permission : "unsupported"
  );
  const [pasteError, setPasteError] = useState("");
  const bookmarkletLinkRef = useRef(null);

  const appOrigin = typeof window !== "undefined" ? window.location.origin : "https://pgp2.termflow.tech";
  const bookmarkletUrl = useMemo(() => buildRegistroBookmarklet(appOrigin), [appOrigin]);

  const handleClose = () => {
    setDragHint(false);
    setCopiedBookmarklet(false);
    setPasteError("");
    setApplySessions(true);
    onClose?.();
  };

  useBackClose(handleClose, isOpen);
  const dialogRef = useDialog(isOpen, handleClose);

  // Attach javascript: URL cleanly via DOM ref so React never warns on script hrefs
  useEffect(() => {
    const el = bookmarkletLinkRef.current;
    if (!el || tab !== "bookmarklet" || !isOpen) return;
    el.setAttribute("href", bookmarkletUrl);
  }, [bookmarkletUrl, tab, isOpen]);

  const parsedPaste = useMemo(() => {
    if (!pasteText.trim()) return null;
    const parsed = parseRegistroPaste(pasteText, {
      allClasses,
      enrolled,
      legend,
      fallbackCourseCode: manualCourseCode,
    });
    if (parsed?.kind === "sessions" && !parsed.tfCode && manualCourseCode) {
      const tagged = parsed.rawSessions.map((s) => ({
        ...s,
        tfCode: manualCourseCode,
        courseCode: manualCourseCode,
        courseName: legend[manualCourseCode]?.name || manualCourseCode,
        section: enrolled?.[manualCourseCode] || "Single",
      }));
      const matched = matchRegistroSessionsToClasses(tagged, { allClasses, enrolled, legend });
      return {
        ...parsed,
        needsCourseSelection: false,
        tfCode: manualCourseCode,
        sessionUpdates: matched.updates,
        leaveCounts: matched.leaveCounts,
        matchedSessionsCount: matched.matchedCount,
        skippedSessionsCount: matched.skippedCount,
      };
    }
    return parsed;
  }, [pasteText, manualCourseCode, allClasses, enrolled, legend]);

  const activePreview = initialPreview || parsedPaste;
  const courseList = activePreview ? Object.values(activePreview.courses || {}) : [];
  const enrolledOptions = Object.keys(enrolled || {}).sort();

  if (!isOpen) return null;

  async function handleClipboardPaste() {
    setPasteError("");
    try {
      const text = await navigator.clipboard.readText();
      if (!text?.trim()) {
        setPasteError("Clipboard is empty. Copy the Registro table first, then paste here.");
        return;
      }
      setPasteText(text);
    } catch {
      setPasteError("Clipboard read was blocked by your browser — tap the box below and paste directly (Ctrl+V / Cmd+V).");
    }
  }

  function handleCopyBookmarklet() {
    navigator.clipboard?.writeText(bookmarkletUrl).then(() => {
      setCopiedBookmarklet(true);
      setTimeout(() => setCopiedBookmarklet(false), 2500);
    }).catch(() => {});
  }

  async function handleEnableBrowserNotifications() {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    try {
      const res = await Notification.requestPermission();
      setNotifPerm(res);
    } catch {}
  }

  function handleApply() {
    if (!activePreview) return;
    onApplySync?.({
      preview: activePreview,
      applySessions: applySessions && activePreview.matchedSessionsCount > 0,
    });
    setPasteText("");
    setManualCourseCode("");
    handleClose();
  }

  function handleResetPreview() {
    onClearInitialPreview?.();
    setPasteText("");
    setManualCourseCode("");
    setPasteError("");
    setApplySessions(true);
  }

  const pendingFbCount = activePreview?.pendingFeedbackCourses?.length || 0;

  return (
    <div className="reg-modal-backdrop" onClick={handleClose}>
      <div
        ref={dialogRef}
        {...dialogProps("Registro Attendance Sync", true)}
        className="reg-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="reg-modal-head">
          <div className="reg-head-left">
            <div className="reg-glow-wrap" aria-hidden="true">
              <span className="reg-glow-aura" />
              <RefreshCw size={19} />
            </div>
            <div>
              <div className="reg-tag-row">
                <span className="reg-modal-eyebrow">EDTEX Registro</span>
                <span className="reg-security-pill">
                  <ShieldCheck size={11} /> Zero-Password Sync
                </span>
              </div>
              <h2>Sync Attendance &amp; Feedback</h2>
            </div>
          </div>
          <button type="button" className="reg-modal-close" aria-label="Close sync dialog" onClick={handleClose}>
            <X size={17} />
          </button>
        </div>

        {activePreview ? (
          <div className="reg-modal-body">
            <div className="reg-preview-hero">
              <div className="reg-preview-top">
                <div className="reg-preview-pills">
                  <span className="reg-pill">
                    {activePreview.kind === "bookmarklet"
                      ? "1-Click Import"
                      : activePreview.kind === "sessions"
                        ? "Session Log"
                        : "Term Summary"}
                  </span>
                  {activePreview.termName && <span className="reg-pill muted">{activePreview.termName}</span>}
                </div>
                <button type="button" className="reg-link-btn" onClick={handleResetPreview}>
                  Clear &amp; paste different data
                </button>
              </div>
              <div className="reg-preview-metrics">
                <div className="reg-preview-metric">
                  <span>Courses</span>
                  <strong>{courseList.length || (activePreview.tfCode ? 1 : 0)}</strong>
                </div>
                <div className="reg-preview-metric">
                  <span>Dated Sessions</span>
                  <strong>{activePreview.matchedSessionsCount || 0}</strong>
                </div>
                <div className={`reg-preview-metric ${pendingFbCount > 0 ? "warn" : "good"}`}>
                  <span>Feedback</span>
                  <strong>{pendingFbCount > 0 ? `${pendingFbCount} Pending` : "Clear"}</strong>
                </div>
              </div>
            </div>

            {activePreview.needsCourseSelection && (
              <div className="reg-course-picker">
                <label htmlFor="reg-manual-course">
                  Select which course these <strong>{activePreview.rawSessions?.length || 0}</strong> sessions belong to:
                </label>
                <select
                  id="reg-manual-course"
                  value={manualCourseCode}
                  onChange={(e) => setManualCourseCode(e.target.value)}
                >
                  <option value="">Choose a course…</option>
                  {enrolledOptions.map((code) => (
                    <option key={code} value={code}>
                      {code} — {legend[code]?.name || code}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {pendingFbCount > 0 && (
              <div className="reg-fb-warning" role="alert">
                <AlertTriangle size={17} />
                <div>
                  <strong>
                    {pendingFbCount === 1
                      ? "Course feedback pending on Registro"
                      : `${pendingFbCount} course feedbacks pending on Registro`}
                  </strong>
                  <p>
                    Avoid a <strong>1 Grade Drop</strong>: submit feedback for{" "}
                    {activePreview.pendingFeedbackCourses.map((c) => c.code).join(", ")}.
                  </p>
                </div>
                <a href={feedbackUrl || REGISTRO_FEEDBACK_URL} target="_blank" rel="noopener noreferrer" className="reg-fb-link">
                  Submit <ExternalLink size={12} />
                </a>
              </div>
            )}

            {courseList.length > 0 && (
              <div className="reg-course-list" role="region" aria-label="Parsed Registro courses">
                {courseList.map((c) => {
                  const hasAttDrop = c.attGradeDrop === "1";
                  const hasFbPending = c.isFeedbackGiven === false || c.feedbackGradeDrop === "1";
                  return (
                    <div key={`${c.code}-${c.registroCode}`} className="reg-course-row">
                      <div className="reg-course-row-main">
                        <span className="reg-course-badge">{c.code}</span>
                        <div>
                          <strong>{c.name}</strong>
                          <small>
                            {c.present}/{c.attGiven} attended ({c.totalSessions} total)
                            {c.leaves > 0 ? ` · ${c.leaves} leave${c.leaves === 1 ? "" : "s"}` : ""}
                          </small>
                        </div>
                      </div>
                      <div className="reg-course-row-metrics">
                        <strong className={c.pct != null && c.pct < 80 && c.attGiven > 0 ? "bad" : "good"}>
                          {c.pct != null ? `${c.pct}%` : "—"}
                        </strong>
                        {hasAttDrop && <span className="reg-tag bad">Att Grade Drop</span>}
                        {hasFbPending && <span className="reg-tag warn">Feedback Pending</span>}
                        {c.isFeedbackGiven === true && (
                          <span className="reg-tag good">
                            <Check size={10} /> Feedback OK
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {activePreview.matchedSessionsCount > 0 && (
              <label className="reg-checkbox-row">
                <input
                  type="checkbox"
                  checked={applySessions}
                  onChange={(e) => setApplySessions(e.target.checked)}
                />
                <span>
                  Update <strong>{activePreview.matchedSessionsCount}</strong> session mark
                  {activePreview.matchedSessionsCount === 1 ? "" : "s"} in TermFlow&rsquo;s schedule &amp; history
                </span>
              </label>
            )}

            <div className="reg-modal-actions">
              <button type="button" className="reg-btn-secondary" onClick={handleClose}>
                Cancel
              </button>
              <button
                type="button"
                className="reg-btn-primary"
                disabled={activePreview.needsCourseSelection}
                onClick={handleApply}
              >
                <Check size={15} />
                <span>Apply Sync to TermFlow</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="reg-modal-body">
            <div className="reg-tabs" role="tablist" aria-label="Registro sync method">
              <button
                type="button"
                role="tab"
                aria-selected={tab === "paste"}
                className={tab === "paste" ? "active" : ""}
                onClick={() => setTab("paste")}
              >
                <span className="reg-tab-ico"><ClipboardPaste size={15} /></span>
                <span className="reg-tab-copy">
                  <strong>Copy &amp; Paste</strong>
                  <small>Works on mobile &amp; desktop</small>
                </span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={tab === "bookmarklet"}
                className={tab === "bookmarklet" ? "active" : ""}
                onClick={() => setTab("bookmarklet")}
              >
                <span className="reg-tab-ico"><Bookmark size={15} /></span>
                <span className="reg-tab-copy">
                  <strong>1-Click Sync</strong>
                  <small>Desktop browser bookmark</small>
                </span>
              </button>
            </div>

            {tab === "paste" ? (
              <div className="reg-tab-panel">
                <div className="reg-portal-card">
                  <div className="reg-portal-card-copy">
                    <strong>Step 1 · Open Registro Attendance</strong>
                    <span>Sign in on Registro if asked, then copy the term or course table.</span>
                  </div>
                  <a
                    href={attendanceUrl || REGISTRO_ATTENDANCE_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="reg-portal-launch"
                  >
                    <span>Open Registro</span>
                    <ArrowRight size={13} />
                  </a>
                </div>

                <div className="reg-step-chips">
                  <div className="reg-step-chip">
                    <span className="reg-step-num">1</span>
                    <p>Open <strong>Term Summary</strong> or any <strong>Course Log</strong>.</p>
                  </div>
                  <div className="reg-step-chip">
                    <span className="reg-step-num">2</span>
                    <p>Select all rows from <strong>S.No</strong> down and copy.</p>
                  </div>
                  <div className="reg-step-chip">
                    <span className="reg-step-num">3</span>
                    <p>Paste below to preview <strong>% &amp; feedback alerts</strong>.</p>
                  </div>
                </div>

                <div className="reg-paste-surface">
                  <div className="reg-paste-toolbar">
                    <button type="button" className="reg-btn-secondary small" onClick={handleClipboardPaste}>
                      <ClipboardPaste size={13} />
                      <span>Paste from Clipboard</span>
                    </button>
                    {registroSync?.syncedAt && (
                      <span className="reg-last-sync">
                        <RefreshCw size={11} /> Last synced {new Date(registroSync.syncedAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>

                  {pasteError && <p className="reg-error-note">{pasteError}</p>}

                  <textarea
                    className="reg-textarea"
                    rows={5}
                    aria-label="Paste Registro attendance table here"
                    placeholder={"Paste copied table from Registro here...\n\nSupports both:\n• Term Attendance table (S.No | Course Title | Code | Total | Given | Present | Absent | % | Grade Drop | Is Feedback Given...)\n• Course Session Log (S.No | Date | Timeslot | Session Number | Status)"}
                    value={pasteText}
                    onChange={(e) => {
                      setPasteText(e.target.value);
                      setPasteError("");
                    }}
                  />
                </div>

                {pasteText.trim() && !parsedPaste && (
                  <p className="reg-error-note">
                    Could not recognize Registro rows in that text. Select all table rows cleanly from{" "}
                    <code>S.No</code> down to the last row and copy again.
                  </p>
                )}
              </div>
            ) : (
              <div className="reg-tab-panel">
                <div className="reg-bm-stage">
                  <div className="reg-bm-browser-bar" aria-hidden="true">
                    <div className="reg-bm-dots">
                      <span /><span /><span />
                    </div>
                    <span className="reg-bm-drop-hint">Bookmarks Bar · Drag pill up here (Ctrl+Shift+B)</span>
                  </div>

                  <div className="reg-bm-copy">
                    <h3><Sparkles size={14} style={{ verticalAlign: "-2px", marginRight: 5 }} />1-Click Registro Sync</h3>
                    <p>
                      Drag <strong>Sync to TermFlow</strong> onto your bookmarks bar once. Whenever you&rsquo;re on
                      Registro&rsquo;s Attendance page, clicking it pulls all courses, dated session logs, and
                      feedback alerts back here automatically.
                    </p>
                  </div>

                  <div className="reg-bookmarklet-actions">
                    <a
                      ref={bookmarkletLinkRef}
                      className="reg-bookmarklet-pill"
                      draggable="true"
                      onClick={(e) => {
                        e.preventDefault();
                        setDragHint(true);
                      }}
                    >
                      <Bookmark size={14} />
                      <span>Sync to TermFlow</span>
                    </a>
                    <button type="button" className="reg-bm-copy-btn" onClick={handleCopyBookmarklet}>
                      {copiedBookmarklet ? <CheckCheck size={14} /> : <Copy size={14} />}
                      <span>{copiedBookmarklet ? "Copied Code!" : "Copy Bookmarklet Code"}</span>
                    </button>
                  </div>

                  {dragHint && (
                    <p className="reg-hint-note">
                      Drag <strong>Sync to TermFlow</strong> up to your bookmarks bar instead of clicking it here — or
                      use <em>Copy Bookmarklet Code</em> and paste it as a new bookmark&rsquo;s URL.
                    </p>
                  )}
                </div>

                <div className="reg-security-footer">
                  <ShieldCheck size={15} />
                  <span>
                    Zero credentials or tokens leave Registro — only parsed attendance counts and dates are synced.
                  </span>
                </div>

                {notifPerm !== "unsupported" && (
                  <div className={`reg-notif-optin${notifPerm === "granted" ? " enabled" : ""}`}>
                    <BellRing size={15} />
                    <span>
                      {notifPerm === "granted"
                        ? "Desktop alerts active for pending Registro course feedback."
                        : "Enable desktop alerts whenever a synced course is missing feedback."}
                    </span>
                    {notifPerm === "default" && (
                      <button type="button" className="reg-btn-secondary small" onClick={handleEnableBrowserNotifications}>
                        Enable Alerts
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
