// Academic area per course code. Rebuilt for Term V (2025-27 batch) from the
// schedule sheet's "Faculty Details" tab (Area column). Update at each term
// rollover — unknown codes fall back to "Other" (see withAreas in lib/sheet.js).
export const AREA = {
  // Finance & Accounting
  BAV: "F&A", FISM: "F&A", FME: "F&A", BOM: "F&A",
  EF: "F&A",     // Entrepreneurship & Finance (sheet: "STM & F&A")
  // Marketing
  FMCG: "MKTG", CBM: "MKTG", DM: "MKTG", SDM: "MKTG", CRM: "MKTG", RMS: "MKTG",
  // Information Systems / Digital
  ECOM: "ISM", MDT: "ISM", AAIM: "ISM",
  // Strategy
  MCBPP: "STM", SLTDM: "STM", BMD: "STM", MST: "STM",
  GTSDM: "STM",  // Game Theory & Strategic Decision Making (sheet area: GMPEE)
  // Operations
  SOM: "OPS", SP: "OPS", AOA: "OPS", SCA: "OPS", LWM: "OPS", DSC: "OPS",
};
