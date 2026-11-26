import { sessionKey, isExamSession } from "./attendance.js";
import { supabase } from "./supabase.js";

export const REGISTRO_ATTENDANCE_URL = "https://registro-iimsambalpur.edtex.in/#/stu/attendance";
export const REGISTRO_FEEDBACK_URL = "https://registro-iimsambalpur.edtex.in/#/stu/course-feedback?tab=all";
export const REGISTRO_SYNC_KEY = "pgp2.registro-sync";
export const PENDING_REGISTRO_SYNC_KEY = "pgp2.pending-registro-sync";
export const REGISTRO_FEEDBACK_DISMISSED_KEY = "pgp2.dismissed-feedback-alerts";

const MONTHS = {
  jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
  jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
};

export function loadRegistroSync() {
  try {
    const raw = JSON.parse(localStorage.getItem(REGISTRO_SYNC_KEY));
    return raw && typeof raw === "object" ? raw : null;
  } catch {
    return null;
  }
}

export function saveRegistroSync(data) {
  try {
    if (!data) localStorage.removeItem(REGISTRO_SYNC_KEY);
    else localStorage.setItem(REGISTRO_SYNC_KEY, JSON.stringify(data));
  } catch {}
}

export async function pushRegistroSync(userId, data) {
  saveRegistroSync(data);
  if (!userId) return;
  try {
    const { data: row } = await supabase.from("profiles").select("courses").eq("user_id", userId).maybeSingle();
    const current = row?.courses || {};
    await supabase.from("profiles").upsert(
      {
        user_id: userId,
        courses: {
          ...current,
          _registro: data,
        },
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );
  } catch {
    /* stays in localStorage; re-syncs cleanly */
  }
}

export function loadDismissedFeedbackAlerts() {
  try {
    const arr = JSON.parse(localStorage.getItem(REGISTRO_FEEDBACK_DISMISSED_KEY) || "[]");
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

export function saveDismissedFeedbackAlerts(keys) {
  try {
    localStorage.setItem(REGISTRO_FEEDBACK_DISMISSED_KEY, JSON.stringify([...keys]));
  } catch {}
}

export function normalizeCourseToken(str) {
  return String(str || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function normalizeCourseTitle(str) {
  return String(str || "")
    .replace(/\([^)]*\)\s*$/, "")
    .replace(/&/g, " and ")
    .replace(/[^a-zA-Z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function stripSectionSuffix(title) {
  const raw = String(title || "").trim();
  const match = raw.match(/^(.*?)\s*\(([A-Za-z0-9]+)\)\s*$/);
  if (!match) return { name: raw, section: "" };
  return { name: match[1].trim(), section: match[2].trim().toUpperCase() };
}

export function resolveTermFlowCourseCode(regCode, regName, legend = {}) {
  const cleanCode = String(regCode || "").trim();
  if (cleanCode && legend[cleanCode]) return cleanCode;

  const normCode = normalizeCourseToken(cleanCode);
  if (normCode) {
    for (const tfCode of Object.keys(legend)) {
      if (normalizeCourseToken(tfCode) === normCode) return tfCode;
    }
  }

  const normTitle = normalizeCourseTitle(regName);
  if (normTitle) {
    for (const [tfCode, info] of Object.entries(legend)) {
      if (normalizeCourseTitle(info?.name) === normTitle) return tfCode;
    }
    // Partial prefix/contains fallback for minor abbreviation differences
    for (const [tfCode, info] of Object.entries(legend)) {
      const targetTitle = normalizeCourseTitle(info?.name);
      if (targetTitle && (targetTitle.includes(normTitle) || normTitle.includes(targetTitle))) {
        return tfCode;
      }
    }
  }

  return cleanCode || normCode || "UNKNOWN";
}

function normalizeRegistroDate(rawDate) {
  const s = String(rawDate || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const dmy = s.match(/^(\d{1,2})[-/\s]([A-Za-z]{3})[-/\s](\d{4})$/);
  if (dmy) {
    const mon = MONTHS[dmy[2].toLowerCase()];
    if (mon) return `${dmy[3]}-${mon}-${dmy[1].padStart(2, "0")}`;
  }
  const num = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (num) return `${num[3]}-${num[2].padStart(2, "0")}-${num[1].padStart(2, "0")}`;
  return null;
}

function normalizeStartTime(slotOrStart) {
  const m = String(slotOrStart || "").trim().match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  return `${m[1].padStart(2, "0")}:${m[2]}`;
}

function normalizeFeedbackFlag(rawValue, feedbackInfo = "") {
  if (rawValue === true) return true;
  if (rawValue === false) return false;
  const s = String(rawValue ?? "").trim().toLowerCase();
  if (s === "no" || s === "false" || s === "pending" || s === "not given" || s === "not provided") return false;
  if (s === "yes" || s === "true" || s === "given" || s === "provided") return true;
  if (/not\s*provided|pending/i.test(String(feedbackInfo || ""))) return false;
  return null;
}

function cleanFeedbackInfo(raw) {
  if (!raw) return "";
  return String(raw)
    .replace(/<br\s*\/?>/gi, " · ")
    .replace(/<[^>]+>/g, "")
    .replace(/\s*·\s*$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function parsePercent(raw) {
  const m = String(raw ?? "").replace(/,/g, "").match(/(-?\d+(?:\.\d+)?)/);
  return m ? parseFloat(m[1]) : null;
}

function parseNumber(raw) {
  const s = String(raw ?? "").trim();
  if (!s || s === "-") return 0;
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

export function normalizeRegistroStatus(raw) {
  const s = String(raw || "").trim().toLowerCase();
  if (!s || s === "-" || s === "unmarked") return null;
  if (s === "present" || s === "p") return "present";
  if (s === "absent" || s === "a") return "absent";
  if (s.includes("medical")) return "medical_leave";
  if (s.includes("special") || s.includes("leave")) return "special_leave";
  return null;
}

export function matchRegistroSessionsToClasses(sessions, { allClasses = [], enrolled = {}, legend = {} } = {}) {
  const updates = {};
  const leaveCounts = {};
  let matchedCount = 0;
  let skippedCount = 0;

  for (const s of sessions || []) {
    const normStatus = normalizeRegistroStatus(s.status);
    if (!normStatus) {
      skippedCount++;
      continue;
    }
    const isoDate = normalizeRegistroDate(s.date);
    const start = normalizeStartTime(s.start || s.timeSlot || s.time_slot);
    if (!isoDate || !start) {
      skippedCount++;
      continue;
    }

    const tfCode = s.tfCode || resolveTermFlowCourseCode(s.courseCode, s.courseName, legend);
    const enrolledSection = enrolled?.[tfCode];

    const candidates = allClasses.filter(
      (c) => c && c.type === "class" && !isExamSession(c) && c.code === tfCode && c.date === isoDate && c.start === start
    );

    const matchedClass =
      candidates.find((c) => enrolledSection && c.section === enrolledSection) ||
      candidates.find((c) => c.section === "Single") ||
      candidates.find((c) => s.section && c.section === s.section) ||
      candidates[0] ||
      null;

    if (normStatus === "medical_leave" || normStatus === "special_leave") {
      leaveCounts[tfCode] = (leaveCounts[tfCode] || 0) + 1;
      matchedCount++;
      continue;
    }

    if (matchedClass) {
      updates[sessionKey(matchedClass)] = normStatus;
      matchedCount++;
    } else if (tfCode && (enrolledSection || s.section)) {
      const sec = enrolledSection || s.section || "Single";
      updates[`${isoDate}_${start}_${tfCode}_${sec}`] = normStatus;
      matchedCount++;
    } else {
      skippedCount++;
    }
  }

  return { updates, leaveCounts, matchedCount, skippedCount };
}

export function parseRegistroPaste(rawText, { allClasses = [], enrolled = {}, legend = {}, fallbackCourseCode = "" } = {}) {
  const text = String(rawText || "").replace(/\r\n?/g, "\n").trim();
  if (!text) return null;

  // Handle Ant Design wrapped header "S.N\no\tCourse Title..."
  const normalizedText = text.replace(/^S\.N\s*\no(?=\t)/gim, "S.No");
  const lines = normalizedText.split("\n").map((l) => l.trimEnd()).filter((l) => l.trim());
  if (!lines.length) return null;

  // Try to extract breadcrumb metadata (e.g. "Attendance / TERM-V / Digital Supply Chain (A)")
  let breadcrumbCourse = null;
  let breadcrumbTerm = "";
  for (const line of lines.slice(0, 6)) {
    const bm = line.match(/Attendance\s*\/\s*(TERM-[IVX]+)\s*\/\s*(.+)$/i);
    if (bm) {
      breadcrumbTerm = bm[1].toUpperCase();
      breadcrumbCourse = stripSectionSuffix(bm[2]);
      break;
    }
  }

  // 1. Check for Course Session-by-Session rows (Date + HH:MM-HH:MM + Status)
  const sessionRows = [];
  for (const line of lines) {
    const cols = line.split("\t").map((c) => c.trim());
    if (cols.length >= 4) {
      const dateCol = cols.find((c) => normalizeRegistroDate(c));
      const slotCol = cols.find((c) => /^\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2}$/.test(c));
      const statusCol = cols[cols.length - 1];
      if (dateCol && slotCol) {
        sessionRows.push({
          date: normalizeRegistroDate(dateCol),
          timeSlot: slotCol,
          status: statusCol,
        });
      }
    } else {
      const m = line.match(/(\d{1,2}[-/\s][A-Za-z]{3}[-/\s]\d{4}|\d{4}-\d{2}-\d{2})\s+(\d{1,2}:\d{2}-\d{1,2}:\d{2})\s+\d+\s+(Present|Absent|Medical Leave|Special Leave|-)/i);
      if (m) {
        sessionRows.push({
          date: normalizeRegistroDate(m[1]),
          timeSlot: m[2],
          status: m[3],
        });
      }
    }
  }

  if (sessionRows.length > 0) {
    const tfCode = fallbackCourseCode ||
      (breadcrumbCourse ? resolveTermFlowCourseCode("", breadcrumbCourse.name, legend) : "");
    const resolvedName = legend[tfCode]?.name || breadcrumbCourse?.name || tfCode;
    const section = enrolled?.[tfCode] || breadcrumbCourse?.section || "Single";
    const taggedSessions = sessionRows.map((s) => ({
      ...s,
      tfCode,
      courseCode: tfCode,
      courseName: resolvedName,
      section,
    }));
    const { updates, leaveCounts, matchedCount, skippedCount } = tfCode
      ? matchRegistroSessionsToClasses(taggedSessions, { allClasses, enrolled, legend })
      : { updates: {}, leaveCounts: {}, matchedCount: 0, skippedCount: taggedSessions.length };

    return {
      kind: "sessions",
      termName: breadcrumbTerm || "",
      needsCourseSelection: !tfCode,
      detectedCourseName: breadcrumbCourse?.name || "",
      detectedSection: breadcrumbCourse?.section || "",
      tfCode,
      rawSessions: taggedSessions,
      courses: {},
      sessionUpdates: updates,
      leaveCounts,
      matchedSessionsCount: matchedCount,
      skippedSessionsCount: skippedCount,
      pendingFeedbackCourses: [],
    };
  }

  // 2. Check for Term Summary Table rows (#/stu/attendance)
  const parsedCourses = {};
  for (const line of lines) {
    // Prefer tab split so empty cells (e.g. Attendance Grade Drop = "") stay aligned!
    let cols = line.split("\t").map((c) => c.trim());
    if (cols.length < 7) {
      // Fallback: try 2+ spaces separator if spaces replaced tabs
      cols = line.split(/\s{2,}/).map((c) => c.trim());
    }
    if (cols.length < 7) continue;

    // Skip header lines
    if (/^s\.?no$/i.test(cols[0]) || /^course\s*title$/i.test(cols[0]) || /^course\s*title$/i.test(cols[1])) {
      continue;
    }

    // Usually Col 0 = S.No, Col 1 = Course Title (Sec), Col 2 = Code, Col 3 = Total, Col 4 = Given,
    // Col 5 = Present, Col 6 = Absent, Col 7 = Attendance %, Col 8 = Att Drop, Col 9 = Is Feedback Given,
    // Col 10 = Feedback Drop, Col 11 = Total Drop
    const offset = /^\d+$/.test(cols[0]) ? 1 : 0;
    const titleRaw = cols[offset];
    const codeRaw = cols[offset + 1];
    if (!titleRaw || !codeRaw) continue;

    const totalSessions = parseNumber(cols[offset + 2]);
    const attGiven = parseNumber(cols[offset + 3]);
    const present = parseNumber(cols[offset + 4]);
    const absent = parseNumber(cols[offset + 5]);
    const pct = parsePercent(cols[offset + 6]);
    const attGradeDrop = cols[offset + 7] ?? "";
    const isFeedbackRaw = cols[offset + 8] ?? "";
    const feedbackGradeDrop = cols[offset + 9] ?? "";
    const totalGradeDrop = cols[offset + 10] ?? "";

    if (pct === null && !/^\d+$/.test(String(cols[offset + 2] || ""))) continue;

    const { name, section } = stripSectionSuffix(titleRaw);
    const tfCode = resolveTermFlowCourseCode(codeRaw, name, legend);
    const isFeedbackGiven = normalizeFeedbackFlag(isFeedbackRaw);

    parsedCourses[tfCode] = {
      code: tfCode,
      registroCode: codeRaw,
      name: name || legend[tfCode]?.name || tfCode,
      section: section || enrolled?.[tfCode] || "",
      termName: breadcrumbTerm || "",
      totalSessions,
      attGiven,
      present,
      absent,
      leaves: 0,
      pct: pct ?? (attGiven > 0 ? Math.round((present / attGiven) * 10000) / 100 : 0),
      attGradeDrop: String(attGradeDrop).trim(),
      isFeedbackGiven,
      feedbackGradeDrop: String(feedbackGradeDrop).trim(),
      totalGradeDrop: String(totalGradeDrop).trim(),
      feedbackInfo: "",
    };
  }

  const courseList = Object.values(parsedCourses);
  if (!courseList.length) return null;

  return {
    kind: "summary",
    termName: breadcrumbTerm || "",
    courses: parsedCourses,
    sessionUpdates: {},
    matchedSessionsCount: 0,
    skippedSessionsCount: 0,
    pendingFeedbackCourses: getPendingFeedbackCourses({ courses: parsedCourses }),
  };
}

export function encodeRegistroSyncPayload(payload) {
  const json = JSON.stringify(payload);
  const bytes = new TextEncoder().encode(json);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function decodeRegistroSyncPayload(encoded) {
  if (!encoded || typeof encoded !== "string") return null;
  try {
    const clean = encoded.trim().replace(/^#?registro-sync=/, "");
    const b64 = clean.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((clean.length + 3) % 4);
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const json = new TextDecoder().decode(bytes);
    const parsed = JSON.parse(json);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

export function parseRegistroBookmarkletPayload(rawPayload, { allClasses = [], enrolled = {}, legend = {} } = {}) {
  const payload = typeof rawPayload === "string" ? decodeRegistroSyncPayload(rawPayload) : rawPayload;
  if (!payload || typeof payload !== "object") return null;

  const termName = payload.tn || payload.termName || "";
  const syncedAt = payload.at || payload.syncedAt || Date.now();
  const rawCourses = payload.c || payload.courses || [];
  const rawSessions = payload.l || payload.sessions || [];

  const courses = {};
  for (const rc of rawCourses) {
    // Support compact array [code, name, sec, total, given, present, absent, pct, attDrop, fbBoolOrStr, fbDrop, totDrop, fbInfo, leaves] or object
    const isArr = Array.isArray(rc);
    const regCode = isArr ? rc[0] : (rc.course_code || rc.code || "");
    const regName = isArr ? rc[1] : (rc.course_name || rc.name || "");
    const section = isArr ? rc[2] : (rc.section_label || rc.section || "");
    const totalSessions = parseNumber(isArr ? rc[3] : (rc.total_no_of_classes ?? rc.totalSessions));
    const attGiven = parseNumber(isArr ? rc[4] : (rc.att_given ?? rc.attGiven));
    const present = parseNumber(isArr ? rc[5] : (rc.present_count ?? rc.present));
    const absent = parseNumber(isArr ? rc[6] : (rc.absent_count ?? rc.absent));
    const pct = isArr ? (typeof rc[7] === "number" ? rc[7] : parsePercent(rc[7])) : (rc.average ?? rc.pct ?? null);
    const attGradeDrop = String(isArr ? (rc[8] ?? "") : (rc.attendance_grade_drop ?? rc.attGradeDrop ?? "")).trim();
    const fbRaw = isArr ? rc[9] : (rc.is_feedback_given ?? rc.isFeedbackGiven);
    const feedbackGradeDrop = String(isArr ? (rc[10] ?? "") : (rc.feedback_grade_drop ?? rc.feedbackGradeDrop ?? "")).trim();
    const totalGradeDrop = String(isArr ? (rc[11] ?? "") : (rc.total_grade_drop ?? rc.totalGradeDrop ?? "")).trim();
    const feedbackInfo = cleanFeedbackInfo(isArr ? rc[12] : (rc.feedback_given_info ?? rc.feedbackInfo));
    const leavesFromSummary = parseNumber(isArr ? rc[13] : (rc.leaves ?? 0));

    const tfCode = resolveTermFlowCourseCode(regCode, regName, legend);
    courses[tfCode] = {
      code: tfCode,
      registroCode: regCode,
      name: regName || legend[tfCode]?.name || tfCode,
      section: section || enrolled?.[tfCode] || "",
      termName,
      totalSessions,
      attGiven,
      present,
      absent,
      leaves: leavesFromSummary,
      pct: pct ?? (attGiven > 0 ? Math.round((present / attGiven) * 10000) / 100 : 0),
      attGradeDrop,
      isFeedbackGiven: normalizeFeedbackFlag(fbRaw, feedbackInfo),
      feedbackGradeDrop,
      totalGradeDrop,
      feedbackInfo,
    };
  }

  const expandedSessions = rawSessions.map((rs) => {
    if (Array.isArray(rs)) {
      return {
        date: rs[0],
        timeSlot: rs[1],
        courseCode: rs[2],
        courseName: rs[3] || "",
        section: rs[4] || "",
        status: rs[5],
      };
    }
    return rs;
  });

  const { updates, leaveCounts, matchedCount, skippedCount } = matchRegistroSessionsToClasses(
    expandedSessions,
    { allClasses, enrolled, legend }
  );

  for (const [code, leaveCount] of Object.entries(leaveCounts)) {
    if (courses[code]) {
      courses[code].leaves = Math.max(courses[code].leaves || 0, leaveCount);
    }
  }

  return {
    kind: "bookmarklet",
    termName,
    syncedAt,
    courses,
    sessionUpdates: updates,
    matchedSessionsCount: matchedCount,
    skippedSessionsCount: skippedCount,
    pendingFeedbackCourses: getPendingFeedbackCourses({ courses }),
  };
}

export function getPendingFeedbackCourses(registroData) {
  const courses = registroData?.courses ? Object.values(registroData.courses) : [];
  return courses.filter((c) => {
    if (!c) return false;
    if (c.isFeedbackGiven === false) return true;
    if (String(c.feedbackGradeDrop || "").trim() === "1") return true;
    if (/not\s*provided|pending/i.test(c.feedbackInfo || "")) return true;
    return false;
  });
}

export function mergeRegistroSyncData(prevData, incomingPreview) {
  const prevCourses = prevData?.courses || {};
  const nextCourses = { ...prevCourses };
  for (const [code, course] of Object.entries(incomingPreview?.courses || {})) {
    nextCourses[code] = {
      ...(prevCourses[code] || {}),
      ...course,
    };
  }
  return {
    syncedAt: incomingPreview?.syncedAt || Date.now(),
    termName: incomingPreview?.termName || prevData?.termName || "",
    courses: nextCourses,
  };
}

export function capturePendingRegistroSyncFromUrl() {
  try {
    const hash = window.location.hash || "";
    const match = hash.match(/registro-sync=([^&]+)/);
    if (!match) return null;
    const encoded = match[1];
    localStorage.setItem(PENDING_REGISTRO_SYNC_KEY, encoded);
    // Remove only registro-sync from hash without touching ?view= or history state
    const cleanHash = hash
      .replace(/([#&])registro-sync=[^&]+&?/, "$1")
      .replace(/[#&]$/, "");
    window.history.replaceState(
      window.history.state,
      "",
      window.location.pathname + window.location.search + cleanHash
    );
    return encoded;
  } catch {
    return null;
  }
}

export function notifyFeedbackPending(pendingCourses = []) {
  if (!pendingCourses.length || typeof window === "undefined" || !("Notification" in window)) return false;
  if (Notification.permission !== "granted") return false;
  try {
    const names = pendingCourses.slice(0, 3).map((c) => c.code || c.name).join(", ");
    const extra = pendingCourses.length > 3 ? ` +${pendingCourses.length - 3} more` : "";
    const title = pendingCourses.length === 1
      ? `Feedback pending: ${pendingCourses[0].name || pendingCourses[0].code}`
      : `${pendingCourses.length} course feedbacks pending on Registro`;
    const body = `Submit feedback for ${names}${extra} on Registro to avoid a 1 Grade Drop.`;
    new Notification(title, { body, tag: "termflow-registro-feedback" });
    return true;
  } catch {
    return false;
  }
}

export function buildRegistroBookmarklet(appOrigin = "https://pgp2.termflow.tech") {
  const safeOrigin = String(appOrigin || "https://pgp2.termflow.tech").replace(/\/+$/, "");
  // Keep plain ASCII ES5-safe code inside the IIFE so all bookmark bars preserve it cleanly.
  const script = `(function(){
var O=${JSON.stringify(safeOrigin)};
function T(m,u){
  var el=document.getElementById('tf-sync-toast');
  if(!el){
    el=document.createElement('div');
    el.id='tf-sync-toast';
    el.style.cssText='position:fixed;bottom:20px;right:20px;z-index:999999;max-width:340px;background:#121527;color:#fff;padding:13px 16px;border-radius:14px;font:600 13px/1.45 system-ui,sans-serif;box-shadow:0 16px 40px rgba(0,0,0,.35);border:1px solid rgba(255,255,255,.16);';
    document.body.appendChild(el);
  }
  el.textContent='';
  var p=document.createElement('div');
  p.textContent=m;
  el.appendChild(p);
  if(u){
    var a=document.createElement('a');
    a.href=u;
    a.target='_blank';
    a.rel='noopener';
    a.textContent='Open TermFlow to finish sync \\u2192';
    a.style.cssText='display:inline-block;margin-top:8px;padding:7px 11px;border-radius:8px;background:#1fa971;color:#fff;text-decoration:none;font-weight:700;font-size:12px;';
    el.appendChild(a);
  }
}
if(location.hostname.indexOf('registro-iimsambalpur.edtex.in')===-1){
  T('Open registro-iimsambalpur.edtex.in/#/stu/attendance first, then click this bookmark.');
  setTimeout(function(){var e=document.getElementById('tf-sync-toast');if(e)e.remove();},5000);
  return;
}
function J(s){
  if(typeof s!=='string'||!/^[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]+$/.test(s))return 0;
  try{var p=JSON.parse(atob(s.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));return !!(p&&(p.student_id||p.auth||p.sub));}catch(e){return 0;}
}
function FT(){
  var st=[localStorage,sessionStorage],i,j,k,v,o;
  for(i=0;i<st.length;i++){
    try{
      for(j=0;j<st[i].length;j++){
        k=st[i].key(j);v=st[i].getItem(k);
        if(J(v))return v;
        if(v&&v[0]==='{'){try{o=JSON.parse(v);for(var pk in o){if(J(o[pk]))return o[pk];}}catch(e){}}
      }
    }catch(e){}
  }
  return null;
}
function S(payload){
  var json=JSON.stringify(payload);
  var b=btoa(unescape(encodeURIComponent(json))).replace(/\\+/g,'-').replace(/\\//g,'_').replace(/=+$/,'');
  var url=O+'/?view=attendance#registro-sync='+b;
  var w=window.open(url,'_blank');
  if(!w){T('Popup blocked by browser. Click below to finish syncing:',url);}
  else{T('Synced '+payload.c.length+' courses to TermFlow!');setTimeout(function(){var e=document.getElementById('tf-sync-toast');if(e)e.remove();},4500);}
}
function SDOM(){
  var rows=document.querySelectorAll('.ant-table-tbody tr');
  var act=document.querySelector('.ant-tabs-tab-active');
  var tn=act?act.innerText.trim():'';
  var c=[],i,td,t;
  for(i=0;i<rows.length;i++){
    td=rows[i].querySelectorAll('td');
    if(td.length<8)continue;
    t=[];for(var j=0;j<td.length;j++)t.push((td[j].innerText||'').trim());
    var off=/^\\d+$/.test(t[0])?1:0;
    var title=t[off]||'',code=t[off+1]||'';
    if(!code)continue;
    var sm=title.match(/^(.*?)\\s*\\(([^)]+)\\)\\s*$/);
    c.push([code,sm?sm[1].trim():title,sm?sm[2].trim():'',t[off+2],t[off+3],t[off+4],t[off+5],t[off+6],t[off+7]||'',t[off+8]||'',t[off+9]||'',t[off+10]||'','',0]);
  }
  if(!c.length){T('Could not find Registro data on this tab. Open #/stu/attendance and try again.');return;}
  S({v:1,s:'d',at:Date.now(),tn:tn,c:c,l:[]});
}
var tk=FT();
if(!tk){T('Reading visible table...');SDOM();return;}
T('TermFlow: Fetching Registro attendance & feedback...');
fetch('/api//stu/get-student-term-wise-attendance',{headers:{token:tk}}).then(function(r){return r.json();}).then(function(res){
  var terms=(res&&res.data&&res.data.data)||[];
  if(!terms.length){SDOM();return;}
  var act=document.querySelector('.ant-tabs-tab-active');
  var actName=act?act.innerText.trim().toUpperCase():'';
  var chosen=null,i;
  if(actName){for(i=0;i<terms.length;i++){if((terms[i].term_name||'').toUpperCase()===actName){chosen=terms[i];break;}}}
  if(!chosen){
    for(i=terms.length-1;i>=0;i--){
      var arr=terms[i].course_wise_attendance||[];
      if(arr.some(function(x){return (x.att_given||0)>0;})){chosen=terms[i];break;}
    }
    if(!chosen)chosen=terms[terms.length-1];
  }
  var cList=chosen.course_wise_attendance||[];
  var secCalls=cList.filter(function(x){return x.section_id;}).map(function(x){
    return fetch('/api//stu/get-student-course-wise-attendance/'+x.section_id,{headers:{token:tk}}).then(function(r){return r.json();}).then(function(sr){return {meta:x,sr:sr};}).catch(function(){return {meta:x,sr:null};});
  });
  return Promise.all(secCalls).then(function(details){
    var outC=[],outL=[];
    for(var k=0;k<details.length;k++){
      var x=details[k].meta,d=(details[k].sr&&details[k].sr.data)||{},lv=d.total_leaves||0;
      outC.push([x.course_code,x.course_name,x.section_label,x.total_no_of_classes,x.att_given,x.present_count,x.absent_count,x.average,x.attendance_grade_drop,x.is_feedback_given,x.feedback_grade_drop,x.total_grade_drop,x.feedback_given_info||'',lv]);
      var sw=d.session_wise_attendance||[];
      for(var m=0;m<sw.length;m++){
        var ss=sw[m];
        if(ss&&ss.attendance_status&&ss.attendance_status!=='-'){
          outL.push([ss.date,ss.time_slot,x.course_code,x.course_name,x.section_label,ss.attendance_status]);
        }
      }
    }
    S({v:1,s:'b',at:Date.now(),tn:chosen.term_name||'',c:outC,l:outL});
  });
}).catch(function(){SDOM();});
})();`.replace(/\n\s*/g, "");
  return `javascript:${script}`;
}
