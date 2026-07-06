// Stable subject → color assignment from a curated 10-hue palette.
//
// Enrolled courses are registered first (sorted), so a user's own subjects
// always get maximally distinct hues; remaining term courses fill in after.
// Unregistered codes fall back to a deterministic hash so nothing renders
// unstyled before registration happens.
//
// Consumers render the returned hue as a `subj-N` class; the palette itself
// lives in styles.css as `--subj*` CSS variables on `.subj-0` … `.subj-9`.

export const SUBJECT_HUES = 10;

const assigned = new Map();

export function assignSubjectColors(enrolledCodes = [], allCodes = []) {
  assigned.clear();
  const ordered = [
    ...[...new Set(enrolledCodes)].filter(Boolean).sort(),
    ...[...new Set(allCodes)].filter(Boolean).sort(),
  ];
  let next = 0;
  for (const code of ordered) {
    if (!assigned.has(code)) assigned.set(code, next++ % SUBJECT_HUES);
  }
}

export function subjectHue(code) {
  if (!code) return 0;
  const hit = assigned.get(code);
  if (hit !== undefined) return hit;
  return Array.from(code).reduce((h, c) => h + c.charCodeAt(0), 0) % SUBJECT_HUES;
}

// Convenience for className strings: subjectClass("ABC") → "subj-3"
export function subjectClass(code) {
  return `subj-${subjectHue(code)}`;
}
