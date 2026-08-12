// Shared between Timeline / WeekAgenda / CompareView so the flag+tricolor
// treatment for 15 Aug / 26 Jan stays in one place instead of three.
export const NATIONAL_HOLIDAYS = new Set(["Independence Day", "Republic Day"]);

export function isNationalHoliday(c) {
  return c?.type === "holiday" && NATIONAL_HOLIDAYS.has(c.name);
}
