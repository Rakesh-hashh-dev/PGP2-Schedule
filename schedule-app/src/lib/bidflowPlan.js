export const GENERATED_COURSE_PREFIX = 'BF-CAT-';

export function officialCourseCode(code) {
  return code && !code.startsWith(GENERATED_COURSE_PREFIX) ? code : '';
}


const EMPTY_PLAN = { primary: [], backup: [] };
const EMPTY_WORKSPACE = { plan: EMPTY_PLAN, saved: [] };
const ROMAN_TERMS = ['I', 'II', 'III', 'IV', 'V', 'VI'];

export function termKey(term) {
  const value = String(term || '').trim().replace(/^term\s+/i, '').toUpperCase();
  return /^[1-6]$/.test(value) ? ROMAN_TERMS[Number(value) - 1] : value;
}

export function termDisplayLabel(term) {
  const index = ROMAN_TERMS.indexOf(termKey(term));
  return index < 0 ? term : 'Term ' + (index + 1);
}

export function bidflowCourseKey(course, defaultTerm) {
  return JSON.stringify([termKey(course.term || defaultTerm), course.code]);
}

export function bidflowPlanKey(accountId, config) {
  return 'pgp2.bidflow-plan-v2:' + JSON.stringify([accountId, config.cohort.trim().toUpperCase(), termKey(config.term)]);
}

export function loadBidflowWorkspace(key) {
  if (!key) return EMPTY_WORKSPACE;
  try {
    const value = JSON.parse(localStorage.getItem(key) || 'null');
    const saved = Array.isArray(value?.saved) ? value.saved : [];
    return {
      plan: normalizePlan(value?.plan),
      saved: saved.filter(item => typeof item?.id === 'string' && typeof item?.name === 'string')
        .slice(0, 5)
        .map(item => ({ id: item.id, name: item.name, plan: normalizePlan(item.plan) })),
    };
  } catch {
    return EMPTY_WORKSPACE;
  }
}

function normalizePlan(value) {
  const primary = uniqueIds(value?.primary);
  return { primary, backup: uniqueIds(value?.backup).filter(id => !primary.includes(id)) };
}

function uniqueIds(list) {
  return Array.isArray(list) ? [...new Set(list.filter(id => typeof id === 'string' && id))] : [];
}

export function availablePlan(plan, courseMap) {
  return {
    primary: plan.primary.filter(id => Object.hasOwn(courseMap, id)),
    backup: plan.backup.filter(id => Object.hasOwn(courseMap, id)),
  };
}

export function summarizeBidflowPlan(plan, courseMap) {
  const selected = plan.primary.map(id => courseMap[id]).filter(Boolean);
  const tally = field => Object.entries(selected.reduce((result, course) => {
    result[course[field]] = (result[course[field]] || 0) + course.credits;
    return result;
  }, Object.create(null)));
  return {
    credits: selected.reduce((sum, course) => sum + course.credits, 0),
    byTerm: tally('term'),
    byArea: tally('area'),
  };
}

export function timetableHandoff(ids, courseMap, { term, cohort, legend, sectionsByCode, picked }, catalogCohort) {
  if (!termKey(term) || (cohort && cohort.toUpperCase() !== catalogCohort.trim().toUpperCase())) {
    return { eligible: {}, blocked: [], otherTerm: 0, unavailable: true };
  }
  const eligible = [];
  const blocked = [];
  let otherTerm = 0;
  for (const id of ids) {
    const item = courseMap[id];
    if (termKey(item.term) !== termKey(term)) {
      otherTerm++;
      continue;
    }
    const { code, credits } = item;
    const course = officialCourseCode(code) && Object.hasOwn(legend, code) ? legend[code] : null;
    if (!course || Number(course.credits) !== credits) {
      blocked.push(code);
      continue;
    }
    const sections = [...new Set((sectionsByCode?.[code] || []).filter(section => section === 'A' || section === 'B'))];
    const current = picked[code];
    if (sections.length > 1 && !sections.includes(current)) {
      blocked.push(code);
      continue;
    }
    eligible.push([code, sections.includes(current) ? current : sections[0] || 'Single']);
  }
  return { eligible: Object.fromEntries(eligible), blocked, otherTerm, unavailable: false };
}

export function generateBidFlowCsv(plan, courseMap) {
  const rows = [['Preference', 'Type', 'Course Code', 'Course Title', 'Term', 'Area', 'Credits', 'Faculty']];
  for (const [type, ids] of [['Primary', plan.primary], ['Backup', plan.backup]]) {
    ids.forEach((id, index) => {
      const { code, name, term, area, credits, faculty } = courseMap[id];
      rows.push([index + 1, type, officialCourseCode(code), name, term, area, credits, faculty]);
    });
  }
  return rows.map(row => row.map(value => {
    let cell = String(value ?? '');
    if (/^[\s]*[=+\-@]|^[\t\r\n]/.test(cell)) cell = "'" + cell;
    return '"' + cell.replaceAll('"', '""') + '"';
  }).join(',')).join('\r\n');
}

export function bidflowCatalogNotice({ payload: { bidflow }, loaded, error }) {
  if (bidflow.enabled) return null;
  if (bidflow.updatedAt) return 'BidFlow is currently hidden from students.';
  if (!loaded) return 'Checking for electives…';
  if (error) return 'The elective catalog is temporarily unavailable.';
  return 'The elective catalog hasn’t been published yet.';
}

export function creditStatus(total, min, max) {
  if (total < min) return { kind: 'under', label: (min - total).toFixed(1) + ' cr below minimum' };
  if (total > max) return { kind: 'over', label: (total - max).toFixed(1) + ' cr above maximum' };
  return { kind: 'within', label: 'Within range' };
}
