// Add new entries here (in order) each time a term is archived at rollover.
// Metadata and legend are kept lightweight so term switching and rollover checks
// don't bundle hundreds of kilobytes of archived classes into the main entry chunk.
export const ARCHIVED_TERMS = [
  {
    number: "IV",
    TERM: { start: "2026-06-15", end: "2026-09-04", number: "IV" },
    LEGEND: {
      BM: { name: "Brand Management", credits: "3", area: "MKTG" },
      CS: { name: "Corporate Strategy", credits: "3", area: "STM" },
      SAPM: { name: "Security Analysis and Portfolio Management", credits: "3", area: "F&A" },
      DVB: { name: "Data Visualization and Business Storytelling", credits: "3", area: "ISM" },
      PM: { name: "Project Management", credits: "3", area: "OPS" },
      PMA: { name: "Product Management and Analytics", credits: "3", area: "MKTG" },
      FPWM: { name: "Financial Planning and Wealth Management", credits: "3", area: "F&A" },
      IBS: { name: "International Business", credits: "3", area: "STM" },
      AMR: { name: "Advance Marketing Research", credits: "3", area: "MKTG" },
      TCBA: { name: "Tech Consulting and Business Analysis", credits: "3", area: "ISM" },
      BAMD: { name: "Business Analytics for Managerial Decisions", credits: "3", area: "ISM" },
      MPB: { name: "Managing Platform Business", credits: "1.5", area: "STM" },
      GPP: { name: "Game People Play", credits: "1.5", area: "OB&HR" },
      SCM: { name: "Supply Chain Management", credits: "3", area: "OPS" },
      BBM: { name: "Business to Business Marketing", credits: "3", area: "MKTG" },
      OFD: { name: "Options Futures and Derivatives", credits: "3", area: "F&A" },
      WAI: { name: "Working with AI", credits: "1.5", area: "ISM" },
      PP: { name: "Pricing & Policy", credits: "1.5", area: "MKTG" },
      DPM: { name: "Digital Product Management", credits: "3", area: "ISM" },
      IB: { name: "Investment Banking", credits: "1.5", area: "F&A" },
      ADE: { name: "Agile in Digital Environment", credits: "1.5", area: "ISM" },
      AIB: { name: "AI for Business", credits: "1.5", area: "ISM" },
    },
    loadClasses: () => import("./term4.js").then((m) => m.CLASSES),
  },
];
