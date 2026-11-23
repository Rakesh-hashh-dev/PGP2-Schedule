import { officialCourseCode } from './bidflowPlan.js';
import termflowIcon from '../../public/termflow-icon.svg?raw';


const HTML_ENTITIES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => HTML_ENTITIES[char]);
const creditFormat = value => Number(value).toLocaleString('en-IN', { maximumFractionDigits: 2 });
const AREA_COLORS = ['#bd4a13', '#8a5d00', '#a62965', '#06766c', '#2556ac', '#7143a2'];

function creditRange(min, max) {
  if (min == null || max == null) return '—';
  return min === max ? '= ' + creditFormat(min) : creditFormat(min) + ' – ' + creditFormat(max);
}

function ruleStatus(credits, min, max) {
  if (min == null || max == null) return ['neutral', 'No overall target'];
  if (credits < min) return ['attention', 'Under Minimum (' + (min - credits).toFixed(1) + ' cr short)'];
  if (credits > max) return ['attention', 'Over Maximum (' + (credits - max).toFixed(1) + ' cr over)'];
  return ['ok', '✓ Within range'];
}

function groupByTerm(courses, defaultTerm) {
  const groups = new Map();
  courses.forEach((course, index) => {
    const term = course.term || defaultTerm;
    if (!groups.has(term)) groups.set(term, []);
    groups.get(term).push({ ...course, rank: index + 1 });
  });
  return groups;
}

function courseTable(groups, termOrder, total, backup = false) {
  if (!groups.size) return '<p class="note">No primary electives selected.</p>';
  const orderedTerms = [...new Set([...termOrder, ...groups.keys()])];
  const rows = orderedTerms.filter(term => groups.has(term)).map(term => {
    const courses = groups.get(term);
    const subtotal = courses.reduce((sum, course) => sum + course.credits, 0);
    return `
      <tr class="term"><th scope="rowgroup" colspan="3">${escapeHtml(term)}</th><td>${creditFormat(subtotal)} cr</td></tr>
      ${courses.map(course => `<tr class="course">
        <td>${escapeHtml(course.name || course.code)}<small>#${course.rank}${officialCourseCode(course.code) ? ' · ' + escapeHtml(course.code) : ''}</small></td>
        <td>${escapeHtml(course.area || 'Other')}</td>
        <td>${escapeHtml(course.faculty || '—')}</td>
        <td>${creditFormat(course.credits)}</td>
      </tr>`).join('')}
      ${backup ? '' : `<tr class="subtotal"><th scope="row" colspan="3">${escapeHtml(term)} subtotal</th><td>${creditFormat(subtotal)} credits</td></tr>`}
    `;
  }).join('');
  return `<table class="courses${backup ? ' backups' : ''}">
    <colgroup><col style="width:39%"><col style="width:17%"><col style="width:31%"><col style="width:13%"></colgroup>
    <thead><tr><th scope="col">Course</th><th scope="col">Area</th><th scope="col">Faculty</th><th scope="col">Credits</th></tr></thead>
    <tbody>${rows}
      ${backup ? '' : `<tr class="grand"><th scope="row" colspan="3">Grand total</th><td>${creditFormat(total)} credits</td></tr>`}
    </tbody>
  </table>`;
}

export function generateBidFlowPdfHtml({
  plan = { primary: [], backup: [] },
  courseMap = {},
  cohortName = 'PGP1',
  termName = 'Term IV',
  minCredits = 15,
  maxCredits = 21,
  studentName = '',
  rulesText = '',
  termSummary = [],
} = {}) {
  const resolve = ids => (ids || []).filter(id => Object.hasOwn(courseMap, id)).map(id => courseMap[id]);
  const primary = resolve(plan.primary);
  const backup = resolve(plan.backup);
  const total = primary.reduce((sum, course) => sum + course.credits, 0);
  const areas = new Map();
  for (const course of primary) {
    const area = course.area || 'Other';
    const current = areas.get(area) || { credits: 0, count: 0 };
    areas.set(area, { credits: current.credits + course.credits, count: current.count + 1 });
  }
  const orderedAreas = [...areas].sort((a, b) => b[1].credits - a[1].credits || a[0].localeCompare(b[0]));
  const termOrder = termSummary.map(item => item.term);
  const rules = [...termSummary, { term: 'Total', credits: total, min: minCredits, max: maxCredits }];
  const date = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' });
  const student = String(studentName || '').trim();

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>TermFlow · BidFlow Elective Plan</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 12mm 14mm 13mm;
      background: #faf7f0;
      @top-left { content: "TERMFLOW  /  BIDFLOW"; font: 700 8pt Arial, sans-serif; color: #51318b; letter-spacing: .8pt; }
      @top-right { content: "ELECTIVE PLAN"; font: 700 8pt Arial, sans-serif; color: #625b6b; letter-spacing: .7pt; }
      @bottom-left { content: "TermFlow · IIM Sambalpur"; font: 8pt Arial, sans-serif; color: #625b6b; }
      @bottom-right { content: counter(page) " / " counter(pages); font: 700 8pt Arial, sans-serif; color: #51318b; }
    }
    @page :first {
      @top-left { content: none; }
      @top-right { content: none; }
    }
    * { box-sizing: border-box; }
    html { background: #faf7f0; color-scheme: light; }
    body {
      margin: 0 auto;
      max-width: 182mm;
      color: #282137;
      background: #faf7f0;
      font: 9.6pt/1.34 Arial, sans-serif;
      print-color-adjust: exact;
      -webkit-print-color-adjust: exact;
    }
    .report-head {
      padding: 9pt 0 8pt;
      border-top: 4pt solid #51318b;
      border-bottom: .65pt solid #ded5e6;
      break-inside: avoid;
    }
    .masthead { display: flex; align-items: center; gap: 8pt; }
    .brand-mark { display: block; width: 26pt; height: 26pt; flex: 0 0 26pt; }
    .brand-mark svg { display: block; width: 100%; height: 100%; }
    .brand-name { display: block; margin: 0; color: #341b57; font-size: 13pt; letter-spacing: -.25pt; }
    .brand-context { color: #625b6b; font-size: 8.5pt; }
    .brand-program { margin-left: auto; color: #51318b; font-size: 8.5pt; font-weight: 700; letter-spacing: .7pt; }
    h1 { margin: 9pt 0 3pt; font-size: 26pt; letter-spacing: -.65pt; line-height: 1.08; color: #261740; }
    .meta { margin: 0; color: #554c62; font-size: 9pt; overflow-wrap: anywhere; }
    .summary {
      display: grid;
      grid-template-columns: 1.35fr 1fr 1fr;
      margin: 8pt 0 10pt;
      border: .65pt solid #e0d6e9;
      border-radius: 7pt;
      background: #f1ebf7;
      break-inside: avoid;
    }
    .summary div { padding: 6pt 9pt; }
    .summary div + div { border-left: .65pt solid #e0d6e9; }
    .summary strong { color: #341b57; font-size: 15pt; font-variant-numeric: tabular-nums; }
    .summary span { display: block; color: #554c62; font-size: 8.5pt; }
    h2 { margin: 12pt 0 5pt; font-size: 11pt; color: #362157; break-after: avoid; }
    .area-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6pt; margin-bottom: 11pt; }
    .area { padding: 6pt 7pt; border: .65pt solid #e5dcd2; border-radius: 5pt; background: #fdfaf5; break-inside: avoid; overflow-wrap: anywhere; }
    .area p { display: flex; justify-content: space-between; gap: 5pt; margin: 0 0 3pt; }
    .area span { color: var(--area); font-weight: bold; }
    .area strong { flex-shrink: 0; font-variant-numeric: tabular-nums; }
    .meter { height: 2.5pt; border-radius: 2pt; background: #e8e0d9; overflow: hidden; margin-bottom: 3pt; }
    .meter span { display: block; height: 100%; background: var(--area); }
    small, .note { color: #5d5369; font-size: 8.5pt; }
    table { width: 100%; border-collapse: collapse; table-layout: fixed; overflow-wrap: anywhere; }
    th, td { padding: 3.3pt 6pt; text-align: left; vertical-align: top; border-bottom: .65pt solid #e6dddc; }
    thead { display: table-header-group; background: #392359; color: #fff; }
    thead th { font-size: 8.5pt; letter-spacing: .25pt; }
    tr { break-inside: avoid; }
    .courses tr > :last-child { text-align: right; font-weight: bold; font-variant-numeric: tabular-nums; }
    .course small { display: inline-block; margin-left: 4pt; font-size: 7.5pt; }
    .course:nth-child(even) { background: #fdfaf5; }
    .term { background: #e8ddf4; color: #362157; break-after: avoid; }
    .term th, .subtotal th, .grand th { text-align: left; }
    .subtotal { background: #f1eae5; color: #56473c; font-size: 9pt; }
    .grand { background: #e8ddf4; color: #341b57; }
    .backups .term { background: #eee7de; color: #524436; }
    .rules { margin-bottom: 8pt; }
    .rules th:nth-child(1) { width: 19%; }
    .rules th:nth-child(2) { width: 15%; }
    .rules th:nth-child(3) { width: 15%; }
    .rules tbody tr:last-child { font-weight: bold; background: #f1ebf7; }
    .status-ok { color: #126549; }
    .status-attention { color: #9b290d; }
    .status-neutral { color: #5d5369; }
    .notes { white-space: pre-line; overflow-wrap: anywhere; }
    .footer { margin-top: 11pt; padding-top: 5pt; border-top: .65pt solid #ded5e6; break-inside: avoid; }
  </style>
</head>
<body>
  <header class="report-head">
    <div class="masthead">
      <span class="brand-mark" aria-hidden="true">${termflowIcon}</span>
      <div><strong class="brand-name">TermFlow</strong><span class="brand-context">IIM Sambalpur</span></div>
      <span class="brand-program">BIDFLOW</span>
    </div>
    <h1>MBA Elective Plan</h1>
    <p class="meta">${[student, cohortName, termName, 'Exported ' + date].filter(Boolean).map(escapeHtml).join(' · ')}</p>
  </header>

  <div class="summary" aria-label="Plan summary">
    <div><strong>${creditFormat(total)} cr</strong><span>Primary credits</span></div>
    <div><strong>${primary.length}</strong><span>Primary choices</span></div>
    <div><strong>${backup.length}</strong><span>Backup choices</span></div>
  </div>

  ${orderedAreas.length ? `<h2>Credit breakdown by area</h2>
  <div class="area-grid">${orderedAreas.map(([area, { credits, count }], index) => {
    const pct = total ? Math.round(100 * credits / total) : 0;
    return `<section class="area" style="--area:${AREA_COLORS[index % AREA_COLORS.length]}">
      <p><span>${escapeHtml(area)}</span><strong>${creditFormat(credits)} cr</strong></p>
      <div class="meter" aria-hidden="true"><span style="width:${pct}%"></span></div>
      <small>${count} ${count === 1 ? 'course' : 'courses'} · ${pct}% of total</small>
    </section>`;
  }).join('')}</div>` : ''}

  <h2>Primary electives by term</h2>
  ${courseTable(groupByTerm(primary, termName), termOrder, total)}

  <h2>Credit rule check</h2>
  <table class="rules">
    <thead><tr><th scope="col">Term</th><th scope="col">Credits</th><th scope="col">Rule</th><th scope="col">Status</th></tr></thead>
    <tbody>${rules.map(({ term, credits, min, max }) => {
      const [status, label] = ruleStatus(credits, min, max);
      return `<tr><th scope="row">${escapeHtml(term)}</th><td>${creditFormat(credits)}</td><td>${creditRange(min, max)}</td><td class="status-${status}">${label}</td></tr>`;
    }).join('')}</tbody>
  </table>

  ${backup.length ? `<h2>Backup / Alternate Electives</h2>
  <p class="note">Backup choices are listed separately and excluded from the credit totals.</p>
  ${courseTable(groupByTerm(backup, termName), termOrder, 0, true)}` : ''}

  ${rulesText ? `<h2>Planning notes</h2><p class="notes">${escapeHtml(rulesText)}</p>` : ''}
  <p class="note footer">Student planning copy · Follow the institute’s published instructions for official submissions.</p>
</body>
</html>`;
}

export function exportBidFlowPdf(options) {
  if (typeof document === 'undefined') return;
  const iframe = document.createElement('iframe');
  iframe.title = 'Print elective plan';
  iframe.style.cssText = 'position:fixed;inset:auto 0 0 auto;width:0;height:0;border:0';
  iframe.setAttribute('aria-hidden', 'true');
  iframe.setAttribute('sandbox', 'allow-same-origin allow-modals');
  document.body.appendChild(iframe);

  const html = generateBidFlowPdfHtml(options);
  const frame = iframe.contentWindow;
  const doc = frame?.document;
  if (!doc) {
    iframe.remove();
    const popUp = window.open('', '_blank');
    if (!popUp) return;
    popUp.document.open();
    popUp.document.write(html);
    popUp.document.close();
    popUp.focus();
    popUp.print();
    return;
  }
  doc.open();
  doc.write(html);
  doc.close();
  setTimeout(() => {
    frame.addEventListener?.('afterprint', () => iframe.remove(), { once: true });
    frame.focus();
    frame.print();
  }, 300);
}
