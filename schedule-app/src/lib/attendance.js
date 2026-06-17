const KEY = "pgp2.attendance";

export function sessionKey(c) {
  return `${c.date}_${c.start}_${c.code}_${c.section}`;
}

export function loadAttendance() {
  try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; }
}

export function saveAttendance(data) {
  try { localStorage.setItem(KEY, JSON.stringify(data)); } catch {}
}
