import { escapeICSText, shareOrDownloadICS } from "./calendarExport.js";
const stamp = value => new Date(value).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
// One immutable UID per occurrence; edited times keep that UID and increment SEQUENCE.
export function buildMeetupICS(meetup) {
  if (!meetup?.id || !Number.isFinite(new Date(meetup.starts_at).getTime())) throw new Error("This plan has no valid start time.");
  const end = meetup.ends_at || new Date(new Date(meetup.starts_at).getTime() + 3600000).toISOString();
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//TermFlow//Social Plans//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH", "BEGIN:VEVENT",
    `UID:meetup-${String(meetup.id).replace(/[^a-zA-Z0-9-]/g, "")}@termflow.app`, `SEQUENCE:${Number.isInteger(meetup.version) ? meetup.version : 1}`,
    `DTSTAMP:${stamp(meetup.updated_at || meetup.created_at || meetup.starts_at)}`, `DTSTART:${stamp(meetup.starts_at)}`, `DTEND:${stamp(end)}`,
    `SUMMARY:${escapeICSText(meetup.title || "Social plan")}`, `LOCATION:${escapeICSText(meetup.place || "")}`,
    `STATUS:${meetup.cancelled ? "CANCELLED" : "CONFIRMED"}`, "DESCRIPTION:Exported from TermFlow. Review the plan in TermFlow for updates.", "END:VEVENT", "END:VCALENDAR"];
  // Fold on UTF-8 byte count without splitting surrogate pairs (RFC 5545).
  return lines.map(line => { let result = ""; let width = 0; for (const char of line) { const bytes = new TextEncoder().encode(char).length; if (width + bytes > 75) { result += "\r\n "; width = 1; } result += char; width += bytes; } return result; }).join("\r\n") + "\r\n";
}
export const exportMeetupCalendar = meetup => shareOrDownloadICS(buildMeetupICS(meetup), "termflow-plan.ics", meetup.title || "Social plan");
