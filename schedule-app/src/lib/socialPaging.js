// Deterministic ordered pages; callers supply the same owner-scoped query and
// a unique final sort key on every page. Never return a truncated success.
export async function fetchAllSocialRows(query, message, pageSize = 200, maxRows = 10000) {
  const rows = [];
  for (let offset = 0; offset < maxRows; offset += pageSize) {
    const { data, error } = await query().range(offset, offset + pageSize - 1);
    if (error || !Array.isArray(data)) throw new Error(message);
    rows.push(...data);
    if (data.length < pageSize) return rows;
  }
  throw new Error(`${message} Too many records to verify completely. Narrow the plan list before continuing.`);
}
