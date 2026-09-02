import { useState, useMemo } from "react";
import "../styles/calendarExport.css";
import {
  Check,
  X,
  Sparkles,
  ChevronDown,
  Layers,
  GraduationCap,
  Copy,
  CheckCheck,
  Download,
  Share2,
} from "lucide-react";
import {
  filterEventsForExport,
  buildICS,
  shareOrDownloadICS,
  downloadICS,
  detectPlatform,
} from "../lib/calendarExport.js";
import { subjectClass } from "../lib/subjectColors.js";
import {
  AppleCalendarSVG,
  GoogleCalendarSVG,
  OutlookCalendarSVG,
  Calendar3DGlowSVG,
  AppleDeviceGuideSVG,
  AndroidDeviceGuideSVG,
  CalendarEventBadgeSVG,
  GlowingAlarmBellSVG,
} from "./CalendarSVGs.jsx";

const AREA_LABELS = {
  "F&A": "Finance",
  "ISM": "ISM",
  "MKTG": "Marketing",
  "OB&HR": "OB & HR",
  "OPS": "Operations",
  "STM": "Strategy",
};

export default function CalendarExportModal({
  isOpen,
  onClose,
  allClasses = [],
  enrolled = {},
  legend = {},
  termLabel = "PGP2",
  initialSelectedCodes = null,
  initialIncludeExams = true,
}) {
  const detectedPlatform = useMemo(() => detectPlatform(), []);
  const enrolledCodes = useMemo(() => Object.keys(enrolled || {}), [enrolled]);

  // Active platform tab: 'apple' | 'google' | 'outlook'
  const [activePlatformTab, setActivePlatformTab] = useState(() => {
    if (detectedPlatform === "ios" || detectedPlatform === "mac") return "apple";
    if (detectedPlatform === "android") return "google";
    return "google";
  });

  const [timeframe, setTimeframe] = useState("upcoming"); // 'upcoming' | 'all'
  const [customCodes, setCustomCodes] = useState(null);
  const [includeExams, setIncludeExams] = useState(initialIncludeExams);
  const [reminderMinutes, setReminderMinutes] = useState(15);
  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [guideOpen, setGuideOpen] = useState(true);

  const selectedCodes = useMemo(() => {
    if (customCodes !== null) return customCodes;
    return new Set(initialSelectedCodes || enrolledCodes);
  }, [customCodes, initialSelectedCodes, enrolledCodes]);

  const toggleCode = (code) => {
    setCustomCodes((prev) => {
      const current = prev !== null ? prev : new Set(initialSelectedCodes || enrolledCodes);
      const next = new Set(current);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };

  const selectAll = () => setCustomCodes(new Set(enrolledCodes));
  const clearAll = () => setCustomCodes(new Set());

  // Filter events based on current user options
  const matchingEvents = useMemo(() => {
    return filterEventsForExport(allClasses, enrolled, {
      selectedCodes: Array.from(selectedCodes),
      includeExams,
      includeClasses: true,
      timeframe,
      legend,
    });
  }, [allClasses, enrolled, selectedCodes, includeExams, timeframe, legend]);

  const classCount = useMemo(
    () => matchingEvents.filter((e) => e.type === "class").length,
    [matchingEvents]
  );
  const examCount = useMemo(
    () => matchingEvents.filter((e) => e.type === "exam").length,
    [matchingEvents]
  );

  // Sample event for the Live Preview Card
  const previewEvent = useMemo(() => {
    return matchingEvents[0] || allClasses.find((c) => c.type === "class") || null;
  }, [matchingEvents, allClasses]);

  const handlePrimaryAdd = async () => {
    if (matchingEvents.length === 0) return;
    setIsExporting(true);
    try {
      const ics = buildICS(matchingEvents, {
        calendarName: `TermFlow ${termLabel} Timetable`,
        reminderMinutes: Number(reminderMinutes),
        termLabel,
        legend,
      });

      const filename = `termflow_${termLabel.toLowerCase().replace(/\s+/g, "_")}_schedule.ics`;
      await shareOrDownloadICS(ics, filename, `TermFlow ${termLabel} Schedule`);
      setExportSuccess(true);
      setTimeout(() => setExportSuccess(false), 3500);
    } catch (err) {
      console.error("Calendar export error:", err);
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownloadFile = () => {
    if (matchingEvents.length === 0) return;
    const ics = buildICS(matchingEvents, {
      calendarName: `TermFlow ${termLabel} Timetable`,
      reminderMinutes: Number(reminderMinutes),
      termLabel,
      legend,
    });
    const filename = `termflow_${termLabel.toLowerCase().replace(/\s+/g, "_")}_schedule.ics`;
    downloadICS(ics, filename);
  };

  const handleCopyInstructions = () => {
    navigator.clipboard.writeText(
      "To import TermFlow timetable into Google Calendar Web:\n1. Download the .ics file from TermFlow.\n2. Open https://calendar.google.com/calendar/r/settings/export\n3. Click 'Import' and upload your downloaded .ics file."
    );
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  if (!isOpen) return null;

  return (
    <div className="cal-modal-backdrop" onClick={onClose}>
      <div className="cal-modal" onClick={(e) => e.stopPropagation()}>
        {/* ── Modal Header with Ambient Glow ── */}
        <div className="cal-modal-header">
          <div className="cal-header-left">
            <div className="cal-glow-icon-wrap">
              <div className="cal-glow-pulse" aria-hidden="true" />
              <Calendar3DGlowSVG size={44} />
            </div>
            <div>
              <div className="cal-header-tag-row">
                <span className="cal-term-tag">{termLabel} · IIM Sambalpur</span>
                {detectedPlatform === "ios" && (
                  <span className="cal-platform-pill">
                    <span className="cal-pill-dot" /> iPhone Detected
                  </span>
                )}
                {detectedPlatform === "android" && (
                  <span className="cal-platform-pill">
                    <span className="cal-pill-dot" /> Android Detected
                  </span>
                )}
              </div>
              <h2 className="cal-modal-title">Sync Timetable to Calendar</h2>
            </div>
          </div>
          <button className="cal-modal-close" onClick={onClose} aria-label="Close modal">
            <X size={16} />
          </button>
        </div>

        {/* ── Platform Switcher Bar ── */}
        <div className="cal-platforms-bar">
          <button
            type="button"
            className={`cal-platform-tab ${activePlatformTab === "apple" ? "on" : ""}`}
            onClick={() => setActivePlatformTab("apple")}
          >
            <AppleCalendarSVG size={22} />
            <div className="cal-platform-tab-text">
              <span className="cal-tab-name">Apple Calendar</span>
              <span className="cal-tab-sub">iPhone / iPad / Mac</span>
            </div>
            {activePlatformTab === "apple" && <span className="cal-tab-active-indicator" />}
          </button>

          <button
            type="button"
            className={`cal-platform-tab ${activePlatformTab === "google" ? "on" : ""}`}
            onClick={() => setActivePlatformTab("google")}
          >
            <GoogleCalendarSVG size={22} />
            <div className="cal-platform-tab-text">
              <span className="cal-tab-name">Google Calendar</span>
              <span className="cal-tab-sub">Android &amp; Google Web</span>
            </div>
            {activePlatformTab === "google" && <span className="cal-tab-active-indicator" />}
          </button>

          <button
            type="button"
            className={`cal-platform-tab ${activePlatformTab === "outlook" ? "on" : ""}`}
            onClick={() => setActivePlatformTab("outlook")}
          >
            <OutlookCalendarSVG size={22} />
            <div className="cal-platform-tab-text">
              <span className="cal-tab-name">Outlook / iCal</span>
              <span className="cal-tab-sub">Universal .ics file</span>
            </div>
            {activePlatformTab === "outlook" && <span className="cal-tab-active-indicator" />}
          </button>
        </div>

        {/* ── Scrollable Body ── */}
        <div className="cal-modal-body">
          {/* 1. Timeframe Selection */}
          <div className="cal-section">
            <div className="cal-section-header">
              <span className="cal-section-label">
                <CalendarEventBadgeSVG size={14} /> Schedule Scope
              </span>
            </div>
            <div className="cal-seg">
              <button
                type="button"
                className={`cal-seg-btn ${timeframe === "upcoming" ? "on" : ""}`}
                onClick={() => setTimeframe("upcoming")}
              >
                <Sparkles size={14} color="#8B5CF6" />
                <span>Upcoming Classes Only</span>
              </button>
              <button
                type="button"
                className={`cal-seg-btn ${timeframe === "all" ? "on" : ""}`}
                onClick={() => setTimeframe("all")}
              >
                <Layers size={14} />
                <span>Entire Term (All)</span>
              </button>
            </div>
          </div>

          {/* 2. Enrolled Subjects Selection */}
          <div className="cal-section">
            <div className="cal-section-header">
              <span className="cal-section-label">
                <Layers size={13} /> Selected Courses ({selectedCodes.size} of {enrolledCodes.length})
              </span>
              <div className="cal-section-actions">
                <button type="button" className="cal-text-btn" onClick={selectAll}>
                  Select all
                </button>
                <button type="button" className="cal-text-btn" onClick={clearAll}>
                  Clear all
                </button>
              </div>
            </div>
            <div className="cal-chips-grid">
              {enrolledCodes.map((code) => {
                const isSelected = selectedCodes.has(code);
                const info = legend[code] || {};
                const section = enrolled[code];
                const area = info.area || "Other";
                return (
                  <button
                    key={code}
                    className={`cal-chip-card ${isSelected ? "on" : ""}`}
                    onClick={() => toggleCode(code)}
                    type="button"
                  >
                    <div className="cal-chip-head">
                      <span className={`cal-chip-badge ${subjectClass(code)}`}>{code}</span>
                      {section && section !== "Single" && (
                        <span className="cal-chip-sec-tag">Sec {section}</span>
                      )}
                      <div className={`cal-chip-checkbox ${isSelected ? "on" : ""}`}>
                        {isSelected && <Check size={11} strokeWidth={3} />}
                      </div>
                    </div>
                    <div className="cal-chip-name">{info.name || code}</div>
                    <div className="cal-chip-meta">
                      <span className="cal-chip-area">{AREA_LABELS[area] || area}</span>
                      {info.credits && <span className="cal-chip-credit">{info.credits} cr</span>}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3. Include Exams & Alarm Reminders */}
          <div className="cal-section">
            <div className="cal-section-header">
              <span className="cal-section-label">
                <GlowingAlarmBellSVG size={14} /> Notification &amp; Exam Settings
              </span>
            </div>

            <div
              className="cal-toggle-row"
              onClick={() => setIncludeExams((prev) => !prev)}
            >
              <div className="cal-toggle-left">
                <div className="cal-toggle-icon-wrap">
                  <GraduationCap size={17} color="#8B5CF6" />
                </div>
                <div>
                  <div className="cal-toggle-title">Include Exams &amp; Quizzes</div>
                  <div className="cal-toggle-desc">
                    Auto-syncs Mid-term, End-term, and Quiz dates with room assignments
                  </div>
                </div>
              </div>
              <div className={`cal-switch ${includeExams ? "on" : ""}`}>
                <div className="cal-switch-thumb" />
              </div>
            </div>

            <div className="cal-alarm-picker-card">
              <div className="cal-alarm-left">
                <GlowingAlarmBellSVG size={16} />
                <span className="cal-alarm-label">Calendar Event Reminder:</span>
              </div>
              <select
                className="cal-select-fancy"
                value={reminderMinutes}
                onChange={(e) => setReminderMinutes(Number(e.target.value))}
              >
                <option value={0}>No notification</option>
                <option value={10}>🔔 10 minutes before</option>
                <option value={15}>🔔 15 minutes before (Recommended)</option>
                <option value={30}>🔔 30 minutes before</option>
                <option value={60}>🔔 1 hour before</option>
              </select>
            </div>
          </div>

          {/* 4. Live Calendar Card Preview */}
          {previewEvent && (
            <div className="cal-preview-section">
              <div className="cal-preview-header">
                <span className="cal-preview-label">
                  <Sparkles size={12} color="#8B5CF6" /> Calendar Event Preview
                </span>
                <span className="cal-preview-count-badge">
                  {classCount} classes {includeExams && examCount > 0 && `· ${examCount} exams`}
                </span>
              </div>
              <div className="cal-preview-card">
                <div className="cal-preview-accent-line" />
                <div className="cal-preview-card-body">
                  <div className="cal-preview-title">
                    [{previewEvent.code || "COURSE"}] {previewEvent.name || "Subject Session"}{" "}
                    {previewEvent.session ? `· Session ${previewEvent.session}` : ""}
                  </div>
                  <div className="cal-preview-details">
                    <span>
                      🕒 {previewEvent.start || "14:30"} – {previewEvent.end || "16:00"} IST
                    </span>
                    <span>📍 {previewEvent.room ? `Room ${previewEvent.room}` : "IIM Sambalpur"}</span>
                    {reminderMinutes > 0 && (
                      <span className="cal-preview-alarm">
                        🔔 Alarm: {reminderMinutes}m before
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 5. Visual Platform Walkthrough */}
          <div className="cal-guide-card">
            <button
              className="cal-guide-toggle"
              onClick={() => setGuideOpen((p) => !p)}
              type="button"
            >
              <div className="cal-guide-toggle-left">
                {activePlatformTab === "apple" ? (
                  <AppleCalendarSVG size={18} />
                ) : activePlatformTab === "google" ? (
                  <GoogleCalendarSVG size={18} />
                ) : (
                  <OutlookCalendarSVG size={18} />
                )}
                <span>
                  {activePlatformTab === "apple"
                    ? "Apple Calendar (iOS / Mac) Import Guide"
                    : activePlatformTab === "google"
                    ? "Google Calendar (Android / Web) Import Guide"
                    : "Outlook & Universal iCal Instructions"}
                </span>
              </div>
              <ChevronDown
                size={14}
                style={{
                  transform: guideOpen ? "rotate(180deg)" : "none",
                  transition: "transform 0.2s ease",
                }}
              />
            </button>

            {guideOpen && (
              <div className="cal-guide-body">
                {activePlatformTab === "apple" ? (
                  <div className="cal-guide-split">
                    <div className="cal-guide-illustration">
                      <AppleDeviceGuideSVG size={72} />
                    </div>
                    <ol className="cal-guide-steps">
                      <li className="cal-guide-step">
                        <span className="cal-step-num">1</span>
                        <div>
                          Tap <strong>"Add to Apple Calendar"</strong> below.
                        </div>
                      </li>
                      <li className="cal-guide-step">
                        <span className="cal-step-num">2</span>
                        <div>
                          iOS Safari / Apple Calendar automatically opens the native import sheet.
                        </div>
                      </li>
                      <li className="cal-guide-step">
                        <span className="cal-step-num">3</span>
                        <div>
                          Tap <strong>"Add All"</strong> in the top right to sync to iCloud / phone calendar.
                        </div>
                      </li>
                    </ol>
                  </div>
                ) : activePlatformTab === "google" ? (
                  <div className="cal-guide-split">
                    <div className="cal-guide-illustration">
                      <AndroidDeviceGuideSVG size={72} />
                    </div>
                    <ol className="cal-guide-steps">
                      <li className="cal-guide-step">
                        <span className="cal-step-num">1</span>
                        <div>
                          Tap <strong>"Add to Google Calendar"</strong> or download the file.
                        </div>
                      </li>
                      <li className="cal-guide-step">
                        <span className="cal-step-num">2</span>
                        <div>
                          On Android, tap the downloaded file to open in <strong>Google Calendar</strong>.
                        </div>
                      </li>
                      <li className="cal-guide-step">
                        <span className="cal-step-num">3</span>
                        <div>
                          Tap <strong>"Add All"</strong> or <strong>"Save"</strong> to populate your schedule.
                        </div>
                      </li>
                    </ol>
                  </div>
                ) : (
                  <ol className="cal-guide-steps">
                    <li className="cal-guide-step">
                      <span className="cal-step-num">1</span>
                      <div>
                        Click <strong>"Download .ics File"</strong> below.
                      </div>
                    </li>
                    <li className="cal-guide-step">
                      <span className="cal-step-num">2</span>
                      <div>
                        Open Microsoft Outlook, Apple Calendar on Mac, or Google Calendar Web.
                      </div>
                    </li>
                    <li className="cal-guide-step">
                      <span className="cal-step-num">3</span>
                      <div>
                        Go to <strong>Settings &gt; Import &amp; Export</strong> and select the downloaded file.
                      </div>
                    </li>
                  </ol>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── Modal Footer with Shimmer Button ── */}
        <div className="cal-modal-footer">
          <button
            className="cal-btn-hero"
            onClick={handlePrimaryAdd}
            disabled={matchingEvents.length === 0 || isExporting}
            type="button"
          >
            {exportSuccess ? (
              <>
                <CheckCheck size={20} color="#34D399" />
                <span>Successfully Synced to Calendar!</span>
              </>
            ) : activePlatformTab === "apple" ? (
              <>
                <AppleCalendarSVG size={22} />
                <span>Add to Apple Calendar</span>
                <span className="cal-btn-badge">{matchingEvents.length} events</span>
              </>
            ) : activePlatformTab === "google" ? (
              <>
                <GoogleCalendarSVG size={22} />
                <span>Add to Google Calendar</span>
                <span className="cal-btn-badge">{matchingEvents.length} events</span>
              </>
            ) : (
              <>
                <OutlookCalendarSVG size={22} />
                <span>Download for Outlook / iCal</span>
                <span className="cal-btn-badge">{matchingEvents.length} events</span>
              </>
            )}
          </button>

          <div className="cal-footer-secondary">
            <button className="cal-btn-sec" onClick={handleDownloadFile} type="button">
              <Download size={15} />
              <span>Download .ics</span>
            </button>
            <button className="cal-btn-sec" onClick={handlePrimaryAdd} type="button">
              <Share2 size={15} />
              <span>Share Sheet</span>
            </button>
            <button className="cal-btn-sec" onClick={handleCopyInstructions} type="button">
              {copiedLink ? <Check size={15} color="#10B981" /> : <Copy size={15} />}
              <span>{copiedLink ? "Copied!" : "Web Guide"}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
