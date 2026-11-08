const FIELDS = ['code','date','section','start','end','room','type','name'];
// Equality of the resulting class, not just its course, avoids suppressing a
// later genuine feed change after an earlier admin notification.
export function scheduleNoticeCovered(coverage, userId, source, overrides = {}) {
  if (!source) return false;
  const ident = source.code || source.name;
  const base = overrides[`${ident}_${source.section}`] || overrides[ident] || {};
  const slot = overrides[`${ident}_${source.section}@${source.start}`] || overrides[`${ident}@${source.start}`] || {};
  const effective = { ...source, ...base, ...slot };
  return coverage.some(record => record.user_id === userId && record.class_date === source.date
    && FIELDS.every(key => (record.effective?.[key] ?? null) === (effective[key] ?? null)));
}
