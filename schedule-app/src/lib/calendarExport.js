/**
 * Calendar Export Utilities for TermFlow (PGP2 Schedule)
 * Supports RFC 5545 iCalendar (.ics) generation, iOS Apple Calendar,
 * Android Google Calendar, Web Share API, and web calendar links.
 */

import { toMin, ymd } from "./datetime.js";

/**
 * Formats date and time strings into RFC 5545 local datetime string format.
 * @param {string} dateStr - 'YYYY-MM-DD'
 * @param {string} timeStr - 'HH:MM'
 * @returns {string} 'YYYYMMDDTHHMMSS'
 */
export function formatICSDateTime(dateStr, timeStr) {
  if (!dateStr || !timeStr) return "";
  if (dateStr.length === 10 && timeStr.length === 5) {
    return `${dateStr.slice(0, 4)}${dateStr.slice(5, 7)}${dateStr.slice(8, 10)}T${timeStr.slice(0, 2)}${timeStr.slice(3, 5)}00`;
  }
  const cleanDate = dateStr.replace(/-/g, "");
  const cleanTime = timeStr.replace(/:/g, "").padEnd(4, "0") + "00";
  return `${cleanDate}T${cleanTime}`;
}

/**
 * Formats a Date object into UTC timestamp format for DTSTAMP / CREATED.
 * @param {Date} date
 * @returns {string} 'YYYYMMDDTHHMMSSZ'
 */
export function formatUTCDateTime(date = new Date()) {
  const pad = (n) => String(n).padStart(2, "0");
  return (
    date.getUTCFullYear() +
    pad(date.getUTCMonth() + 1) +
    pad(date.getUTCDate()) +
    "T" +
    pad(date.getUTCHours()) +
    pad(date.getUTCMinutes()) +
    pad(date.getUTCSeconds()) +
    "Z"
  );
}

/**
 * Escapes characters per RFC 5545 spec (commas, semicolons, backslashes, newlines).
 * @param {string} str
 * @returns {string}
 */
export function escapeICSText(str) {
  if (!str) return "";
  const s = String(str);
  // Fast path: skip regex replacements if string contains no special characters
  if (!/[\\;,\r\n]/.test(s)) return s;
  return s
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r\n|\r|\n/g, "\\n");
}

/**
 * Standard VTIMEZONE component for Asia/Kolkata (Indian Standard Time, UTC+05:30).
 */
export const VTIMEZONE_ASIA_KOLKATA = [
  "BEGIN:VTIMEZONE",
  "TZID:Asia/Kolkata",
  "TZURL:http://tzurl.org/zoneinfo-outlook/Asia/Kolkata",
  "X-LIC-LOCATION:Asia/Kolkata",
  "BEGIN:STANDARD",
  "TZOFFSETFROM:+0530",
  "TZOFFSETTO:+0530",
  "TZNAME:IST",
  "DTSTART:19700101T000000",
  "END:STANDARD",
  "END:VTIMEZONE",
].join("\r\n");

/**
 * Maps alarm offset in minutes to RFC 5545 duration string.
 * e.g., 15 -> "-PT15M", 60 -> "-PT1H"
 * @param {number} minutes
 * @returns {string}
 */
export function formatAlarmTrigger(minutes) {
  if (!minutes || minutes <= 0) return "-PT15M";
  if (minutes % 60 === 0) {
    return `-PT${minutes / 60}H`;
  }
  return `-PT${minutes}M`;
}

/**
 * Generates an RFC 5545 VALARM component for an event reminder.
 * @param {number} reminderMinutes
 * @param {string} summary
 * @returns {string}
 */
export function buildAlarmComponent(reminderMinutes, summary = "Class Reminder") {
  if (!reminderMinutes || reminderMinutes <= 0) return "";
  const trigger = formatAlarmTrigger(reminderMinutes);
  return [
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    `DESCRIPTION:${escapeICSText(summary)}`,
    `TRIGGER:${trigger}`,
    "END:VALARM",
  ].join("\r\n");
}

/**
 * Builds an RFC 5545 VEVENT string from a class/exam event object.
 * @param {Object} event
 * @param {Object} options - { reminderMinutes, termLabel, legend }
 * @returns {string}
 */
export function buildVEvent(event, options = {}) {
  const { reminderMinutes = 15, termLabel = "PGP2", legend = {} } = options;
  const nowStamp = formatUTCDateTime();
  const dtStart = formatICSDateTime(event.date, event.start);
  const dtEnd = formatICSDateTime(event.date, event.end);

  if (!dtStart || !dtEnd) return "";

  const isExam = event.type === "exam";
  const courseCode = event.code || "";
  const courseInfo = legend[courseCode] || {};
  const courseFullName = event.name || courseInfo.name || (isExam ? "Exam" : "Class");
  
  // Clean event summary title
  let summary;
  if (isExam) {
    summary = courseCode ? `[${courseCode}] ${courseFullName}` : courseFullName;
  } else if (courseCode) {
    const sessionPart = event.session ? ` · S${event.session}` : "";
    summary = `[${courseCode}] ${courseFullName}${sessionPart}`;
  } else {
    summary = courseFullName;
  }

  // Location
  const room = (event.room || "").trim();
  const location = room ? `${room}, IIM Sambalpur` : "IIM Sambalpur";

  // Description / Notes
  const descLines = [];
  if (courseCode) descLines.push(`Course: ${courseFullName} (${courseCode})`);
  else descLines.push(`Event: ${courseFullName}`);
  
  if (event.session) descLines.push(`Session: ${event.session}`);
  if (event.faculty) descLines.push(`Faculty: ${event.faculty.replace(/\s+/g, " ").trim()}`);
  if (event.section && event.section !== "Single" && event.section !== "All") {
    descLines.push(`Section: ${event.section}`);
  }
  if (room) descLines.push(`Room: ${room}`);
  descLines.push(`Batch: ${termLabel} · IIM Sambalpur`);
  descLines.push(`Synced via TermFlow`);

  const description = descLines.join("\n");

  // Unique deterministic UID
  const cleanCode = (courseCode || "EVENT").replace(/[^A-Za-z0-9]/g, "");
  const uid = `${event.date}-${event.start.replace(":", "")}-${cleanCode}-${event.session || "0"}-termflow@iimsambalpur.ac.in`;

  const lines = [
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${nowStamp}`,
    `DTSTART;TZID=Asia/Kolkata:${dtStart}`,
    `DTEND;TZID=Asia/Kolkata:${dtEnd}`,
    `SUMMARY:${escapeICSText(summary)}`,
    `DESCRIPTION:${escapeICSText(description)}`,
    `LOCATION:${escapeICSText(location)}`,
    "STATUS:CONFIRMED",
    "TRANSP:OPAQUE",
  ];

  if (reminderMinutes && reminderMinutes > 0) {
    const alarm = buildAlarmComponent(reminderMinutes, summary);
    if (alarm) lines.push(alarm);
  }

  lines.push("END:VEVENT");
  return lines.join("\r\n");
}

/**
 * Builds a complete RFC 5545 iCalendar (.ics) string for a list of events.
 * @param {Array<Object>} events
 * @param {Object} options - { calendarName, reminderMinutes, termLabel, legend }
 * @returns {string}
 */
export function buildICS(events = [], options = {}) {
  const calName = options.calendarName || `TermFlow Schedule (${options.termLabel || "PGP2"})`;
  
  const header = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//TermFlow//PGP2 Schedule Calendar Sync//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeICSText(calName)}`,
    "X-WR-TIMEZONE:Asia/Kolkata",
    VTIMEZONE_ASIA_KOLKATA,
  ].join("\r\n");

  const vevents = events
    .map((ev) => buildVEvent(ev, options))
    .filter(Boolean)
    .join("\r\n");

  const footer = "END:VCALENDAR";

  return `${header}\r\n${vevents}\r\n${footer}\r\n`;
}

/**
 * Filters all classes/exams to match user enrollment and export criteria.
 * @param {Array<Object>} allClasses
 * @param {Object} enrolled - { [code]: section }
 * @param {Object} options - { selectedCodes, includeExams, includeClasses, timeframe, startDate, endDate, legend }
 * @returns {Array<Object>}
 */
export function filterEventsForExport(allClasses = [], enrolled = {}, options = {}) {
  const {
    selectedCodes = null, // Set or Array of codes. If null, use all enrolled codes.
    includeExams = true,
    includeClasses = true,
    timeframe = "upcoming", // 'upcoming' | 'all' | 'custom'
    startDate = null, // 'YYYY-MM-DD'
    endDate = null,   // 'YYYY-MM-DD'
    legend = {},
  } = options;

  const todayISO = ymd(new Date());
  const activeCodes = selectedCodes ? new Set(selectedCodes) : new Set(Object.keys(enrolled || {}));
  const enrolledSections = enrolled || {};

  const seen = new Set();

  return allClasses.filter((c) => {
    // 1. Timeframe filter
    if (timeframe === "upcoming" && c.date < todayISO) return false;
    if (startDate && c.date < startDate) return false;
    if (endDate && c.date > endDate) return false;

    // 2. Class Type filtering
    if (c.type === "class") {
      if (!includeClasses) return false;
      if (!activeCodes.has(c.code)) return false;
      
      const enrolledSec = enrolledSections[c.code];
      if (enrolledSec === undefined) return false;
      if (c.section !== enrolledSec && c.section !== "Single" && c.section !== "All") {
        return false;
      }
      return true;
    }

    if (c.type === "exam") {
      if (!includeExams) return false;

      // Unique deduplication for exams
      const key = `${c.date}-${c.start}-${c.name}`;
      if (seen.has(key)) return false;
      seen.add(key);

      // Infer subject code from exam name or code
      const code = c.code || (c.name || "").match(/^([A-Za-z]{2,8})\b/)?.[1]?.toUpperCase();
      if (code && Object.keys(legend || {}).includes(code)) {
        if (!activeCodes.has(code)) return false;
      }
      return true;
    }

    return false;
  }).sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return toMin(a.start) - toMin(b.start);
  });
}

/**
 * Initiates a browser file download of the .ics content.
 * @param {string} icsContent
 * @param {string} filename
 */
export function downloadICS(icsContent, filename = "termflow_schedule.ics") {
  const blob = new Blob([icsContent], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/**
 * Checks if the browser supports sharing files via Web Share API.
 * @returns {boolean}
 */
export function canShareICSFile() {
  if (typeof navigator === "undefined" || !navigator.share || !navigator.canShare) {
    return false;
  }
  try {
    const testFile = new File(["test"], "test.ics", { type: "text/calendar" });
    return navigator.canShare({ files: [testFile] });
  } catch {
    return false;
  }
}

/**
 * Shares the .ics file using the native iOS / Android share sheet when available,
 * or falls back to downloading the file directly.
 * @param {string} icsContent
 * @param {string} filename
 * @param {string} title
 * @returns {Promise<{ shared: boolean, downloaded: boolean, aborted?: boolean }>}
 */
export async function shareOrDownloadICS(icsContent, filename = "termflow_schedule.ics", title = "TermFlow Timetable") {
  const blob = new Blob([icsContent], { type: "text/calendar;charset=utf-8" });
  
  if (canShareICSFile()) {
    try {
      const file = new File([blob], filename, { type: "text/calendar" });
      await navigator.share({
        title: title,
        text: "Add TermFlow schedule to your Calendar",
        files: [file],
      });
      return { shared: true, downloaded: false };
    } catch (err) {
      if (err.name === "AbortError") {
        return { shared: false, downloaded: false, aborted: true };
      }
      console.warn("Share failed, falling back to download:", err);
    }
  }

  // Fallback to direct file download
  downloadICS(icsContent, filename);
  return { shared: false, downloaded: true };
}

/**
 * Generates a Google Calendar Web URL for adding a single event.
 * @param {Object} event
 * @param {Object} options
 * @returns {string}
 */
export function createGoogleCalendarUrl(event, options = {}) {
  const { termLabel = "PGP2", legend = {} } = options;
  const dtStart = formatICSDateTime(event.date, event.start);
  const dtEnd = formatICSDateTime(event.date, event.end);

  const isExam = event.type === "exam";
  const courseCode = event.code || "";
  const courseInfo = legend[courseCode] || {};
  const courseFullName = event.name || courseInfo.name || (isExam ? "Exam" : "Class");

  let summary;
  if (isExam) {
    summary = courseCode ? `[${courseCode}] ${courseFullName}` : courseFullName;
  } else if (courseCode) {
    const sessionPart = event.session ? ` · Session ${event.session}` : "";
    summary = `[${courseCode}] ${courseFullName}${sessionPart}`;
  } else {
    summary = courseFullName;
  }

  const room = (event.room || "").trim();
  const location = room ? `${room}, IIM Sambalpur` : "IIM Sambalpur";

  const descLines = [];
  if (courseCode) descLines.push(`Course: ${courseFullName} (${courseCode})`);
  if (event.session) descLines.push(`Session: ${event.session}`);
  if (event.faculty) descLines.push(`Faculty: ${event.faculty}`);
  if (event.section && event.section !== "Single" && event.section !== "All") {
    descLines.push(`Section: ${event.section}`);
  }
  if (room) descLines.push(`Room: ${room}`);
  descLines.push(`Batch: ${termLabel} · IIM Sambalpur`);
  descLines.push(`Added via TermFlow`);

  const details = descLines.join("\n");

  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: summary,
    dates: `${dtStart}/${dtEnd}`,
    ctz: "Asia/Kolkata",
    details: details,
    location: location,
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/**
 * Detects the user device platform for customized guidance.
 * @returns {'ios' | 'android' | 'mac' | 'windows' | 'other'}
 */
export function detectPlatform() {
  if (typeof navigator === "undefined") return "other";
  const ua = navigator.userAgent || "";
  const platform = navigator.platform || "";

  if (/iPad|iPhone|iPod/.test(ua) || (platform === "MacIntel" && navigator.maxTouchPoints > 1)) {
    return "ios";
  }
  if (/Android/i.test(ua)) {
    return "android";
  }
  if (/Mac/i.test(platform)) {
    return "mac";
  }
  if (/Win/i.test(platform)) {
    return "windows";
  }
  return "other";
}
