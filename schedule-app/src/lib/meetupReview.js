// Capture the complete reviewed set once when edit/cancellation opens.
// Live subscription updates must never silently advance these versions.
export function reviewedMeetupRows(anchor, rows, now = Date.now()) {
  if (!anchor?.id) return [];
  return rows.filter(row => row.id === anchor.id || (anchor.series_id && row.series_id === anchor.series_id && row.created_by === anchor.created_by && row.series_index >= anchor.series_index && !row.cancelled && new Date(row.starts_at).getTime() > now))
    .map(row => ({ ...row, member_ids: [...(row.member_ids || [])] }));
}
export const meetupVersions = rows => Object.fromEntries(rows.map(row => [row.id, row.version ?? 1]));
