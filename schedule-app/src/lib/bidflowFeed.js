import { GENERATED_COURSE_PREFIX, termKey } from './bidflowPlan.js';

const CODE_HEADERS = ['code', 'course code', 'subject code', 'elective code', 'id'];
const NAME_HEADERS = ['name', 'course name', 'course title', 'course', 'subject', 'subject name', 'subject title', 'elective', 'elective name', 'title'];
const CREDIT_HEADERS = ['credits', 'credit', 'course credits', 'credit points', 'cr'];

function headerKey(value) {
  return String(value ?? '').trim().toLowerCase().replace(/[_\s]+/g, ' ');
}

function findCourseHeader(records) {
  return records.findIndex(record => {
    const columns = new Set(record.map(headerKey));
    return [NAME_HEADERS, CREDIT_HEADERS].every(options => options.some(name => columns.has(name)));
  });
}

function rowsWithCourseHeaders(headers, rows) {
  const keys = headers.map(headerKey);
  const present = keys.filter(Boolean);
  if (new Set(present).size !== present.length) throw new Error('The catalog contains duplicate column names.');
  return rows.map(row => Object.fromEntries(keys.flatMap((key, index) => key ? [[key, row[index] ?? '']] : [])));
}

function hasCourseCodes(headers) {
  return headers.some(label => CODE_HEADERS.includes(headerKey(label)));
}

function generatedCourseCode(name) {
  const normalized = name.normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim();
  const slug = normalized.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 20).toUpperCase();
  let hash = 2166136261;
  for (const char of normalized) hash = Math.imul(hash ^ char.codePointAt(0), 16777619);
  return GENERATED_COURSE_PREFIX + (slug || 'COURSE') + '-' + (hash >>> 0).toString(36).toUpperCase();
}

export const AREA_MAP = {
  // Finance & Accounting
  'finance': 'F&A',
  'finance & accounting': 'F&A',
  'f&a': 'F&A',
  'fa': 'F&A',
  'accounting': 'F&A',
  // Marketing
  'marketing': 'MKTG',
  'mktg': 'MKTG',
  'mkt': 'MKTG',
  // Operations & Quantitative Methods
  'operations': 'OPS',
  'ops': 'OPS',
  'om': 'OPS',
  'operations management': 'OPS',
  'supply chain': 'OPS',
  // Strategy
  'strategy': 'STM',
  'strategic management': 'STM',
  'stm': 'STM',
  // Information Systems & Analytics
  'information systems': 'ISM',
  'ism': 'ISM',
  'it': 'ISM',
  'analytics': 'ISM',
  'digital': 'ISM',
  // OB & HR
  'ob': 'OB&HR',
  'ob&hr': 'OB&HR',
  'ob & hr': 'OB&HR',
  'hr': 'OB&HR',
  'organizational behavior': 'OB&HR',
  'human resources': 'OB&HR',
  // General / Economics / Other
  'economics': 'ECO',
  'eco': 'ECO',
  'gm': 'GM',
  'general management': 'GM',
};

export function normalizeArea(rawArea) {
  if (!rawArea || typeof rawArea !== 'string') return 'Other';
  const clean = rawArea.trim().toLowerCase();
  return Object.hasOwn(AREA_MAP, clean) ? AREA_MAP[clean] : rawArea.trim().toUpperCase() || 'Other';
}

/**
 * Transforms a regular Google Sheets URL (e.g. view/edit link)
 * into a direct CSV export endpoint.
 */
export function normalizeGoogleSheetUrl(url) {
  if (!url || typeof url !== 'string') return '';
  let parsed;
  try { parsed = new URL(url.trim()); } catch { return ''; }
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password) return '';
  if (parsed.hostname !== 'docs.google.com' || !parsed.pathname.startsWith('/spreadsheets/')) return parsed.href;
  if (parsed.searchParams.get('format') === 'csv' || parsed.searchParams.get('output') === 'csv') return parsed.href;

  const sheetId = parsed.pathname.match(/^\/spreadsheets\/d\/([\w-]+)(?:\/|$)/)?.[1];
  if (!sheetId) return '';
  const hash = new URLSearchParams(parsed.hash.slice(1));
  const query = new URLSearchParams({ format: 'csv', gid: hash.get('gid') || parsed.searchParams.get('gid') || '0' });
  if (parsed.searchParams.has('resourcekey')) query.set('resourcekey', parsed.searchParams.get('resourcekey'));
  return 'https://docs.google.com/spreadsheets/d/' + sheetId + '/export?' + query;
}

/**
 * Parses raw tabular row objects into standardized Course entities for BidFlow.
 */
export function normalizeCourses(rawRows, { allowMissingCode = false } = {}) {
  if (!Array.isArray(rawRows) || !rawRows.length) throw new Error('The catalog has no course rows.');
  const courses = [];
  const seenCodes = new Set();
  const errors = [];
  for (const [index, row] of rawRows.entries()) {
    if (!row || typeof row !== 'object' || Array.isArray(row)) {
      errors.push('Row ' + (index + 2) + ' is invalid.');
      continue;
    }
    const fields = Object.fromEntries(Object.entries(row).map(([key, value]) => [headerKey(key), String(value ?? '').trim()]));
    const get = (...keys) => keys.map(key => fields[key]).find(Boolean) || '';
    if (!Object.values(fields).some(Boolean)) continue;
    const name = get(...NAME_HEADERS);
    const code = get(...CODE_HEADERS).toUpperCase() || (allowMissingCode && name ? generatedCourseCode(name) : '');
    const credits = Number(get(...CREDIT_HEADERS).replace(/\s*(?:credits?|cr\.?)$/i, ''));
    const area = normalizeArea(get('area', 'specialization', 'specialisation', 'department', 'dept'));
    const faculty = get('faculty', 'professor', 'instructor', 'prof', 'faculty name');
    const facultyType = get('facultytype', 'faculty type', 'visiting/internal', 'visiting/ internal', 'visiting / internal', 'visiting /internal');
    const term = get('term', 'trimester', 'semester');
    const rawSlots = get('slots', 'capacity', 'max slots', 'seats');
    const slots = rawSlots ? Number(rawSlots) : null;
    const description = get('description', 'desc', 'syllabus', 'remarks');
    const identity = JSON.stringify([termKey(term), code]);
    let issue;
    if (!code || !name) issue = 'requires a course code and name.';
    else if (seenCodes.has(identity)) issue = 'duplicates course code ' + code + '.';
    else if (!Number.isFinite(credits) || credits <= 0) issue = 'requires positive numeric credits.';
    else if (slots !== null && (!Number.isSafeInteger(slots) || slots < 0)) issue = 'requires a whole, nonnegative seat count.';
    if (issue) errors.push('Row ' + (index + 2) + ' ' + issue);
    seenCodes.add(identity);
    courses.push({ code, name, area, credits, faculty, term, slots, description, ...(facultyType && { facultyType }) });
  }
  if (errors.length) throw new Error(errors.slice(0, 5).join(' ') + (errors.length > 5 ? ' ' + (errors.length - 5) + ' more rows need attention.' : ''));
  if (!courses.length) throw new Error('The catalog has no course rows.');
  return courses;
}

function parseDelimitedRecords(csvText, delimiter) {
  const records = [];
  let row = [];
  let cell = '';
  let quoted = false;
  let closedQuote = false;
  const input = String(csvText || '').replace(/^\uFEFF/, '');
  for (let index = 0; index < input.length; index++) {
    const char = input[index];
    if (quoted) {
      if (char !== '"') cell += char;
      else if (input[index + 1] === '"') { cell += '"'; index++; }
      else { quoted = false; closedQuote = true; }
      continue;
    }
    if (char === delimiter || char === '\r' || char === '\n') {
      row.push(cell);
      cell = '';
      closedQuote = false;
      if (char !== delimiter) {
        records.push(row);
        row = [];
        if (char === '\r' && input[index + 1] === '\n') index++;
      }
    } else if (closedQuote && char.trim()) {
      throw new Error('Unexpected text after a quoted CSV field.');
    } else if (char === '"') {
      if (cell.trim()) throw new Error('Unexpected quote in an unquoted CSV field.');
      cell = '';
      quoted = true;
    } else if (!closedQuote) {
      cell += char;
    }
  }
  if (quoted) throw new Error('The CSV contains an unclosed quoted field.');
  row.push(cell);
  records.push(row);
  return records.filter(record => record.some(value => value.trim()));
}

export function parseCSVText(csvText) {
  for (const delimiter of [',', '\t', ';']) {
    let records;
    try {
      records = parseDelimitedRecords(csvText, delimiter);
    } catch (error) {
      if (delimiter === ',') {
        const commaHeader = String(csvText || '').split(/\r?\n/, 10).some(line =>
          findCourseHeader([line.split(',').map(cell => cell.replace(/^"|"$/g, ''))]) >= 0);
        if (commaHeader) throw error;
      }
      continue;
    }
    const headerIndex = findCourseHeader(records);
    if (headerIndex < 0) continue;
    const headers = records[headerIndex];
    const rows = records.slice(headerIndex + 1);
    const overlongIndex = rows.findIndex(record => record.slice(headers.length).some(value => value.trim()));
    if (overlongIndex >= 0) throw new Error('Row ' + (headerIndex + overlongIndex + 2) + ' has too many columns.');
    return normalizeCourses(rowsWithCourseHeaders(headers, rows), { allowMissingCode: !hasCourseCodes(headers) });
  }
  throw new Error('No catalog header found. Include Course Name and Credits columns.');
}

export async function parseExcelBuffer(buffer) {
  const XLSX = await import('xlsx');
  const workbook = XLSX.read(buffer, { type: 'array' });
  const courses = [];
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const records = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', blankrows: false });
    const headerIndex = findCourseHeader(records);
    if (headerIndex < 0) continue;
    const termLabel = sheetName.trim().match(/^(?:term\s*)?([1-6]|I{1,3}|IV|V|VI)$/i)?.[1];
    const sheetTerm = termLabel ? 'Term ' + termLabel.toUpperCase() : '';
    try {
      const headers = records[headerIndex];
      const data = rowsWithCourseHeaders(headers, records.slice(headerIndex + 1));
      if (data.length) {
        const imported = normalizeCourses(data, { allowMissingCode: !hasCourseCodes(headers) });
        courses.push(...imported.map(course => ({ ...course, term: course.term || sheetTerm })));
      }
    } catch (error) {
      throw new Error('Sheet “' + sheetName + '”: ' + error.message, { cause: error });
    }
  }
  if (!courses.length) throw new Error('No electives found. Add rows below Course Name and Credits on at least one worksheet.');
  return normalizeCourses(courses);
}

/**
 * Fetch and parse courses from a live Google Sheet or CSV URL.
 */
export async function fetchLiveSheetCourses(rawUrl) {
  const exportUrl = normalizeGoogleSheetUrl(rawUrl);
  if (!exportUrl) {
    throw new Error('Enter a valid HTTPS Google Sheet or CSV URL.');
  }

  try {
    const response = await fetch(exportUrl, {
      method: 'GET',
      signal: AbortSignal.timeout(15000),
      headers: {
        'Accept': 'text/csv, application/json, text/plain, */*',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch sheet (HTTP ${response.status}). Make sure the Google Sheet is shared as "Anyone with the link can view".`);
    }

    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const json = await response.json();
      const rows = Array.isArray(json) ? json : json?.courses || json?.data;
      return normalizeCourses(rows);
    }

    const text = await response.text();
    return parseCSVText(text);
  } catch (err) {
    console.error('fetchLiveSheetCourses error:', err);
    throw err;
  }
}
