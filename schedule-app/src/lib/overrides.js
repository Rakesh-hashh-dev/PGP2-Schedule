// Shared keying for admin class overrides (flags.classOverrides[date][key]).
//
// A class's identity is its course CODE when it has one. Exam / "END Term"
// rows come from the sheet with an empty code and are distinguished only by
// name, so several can share the same date + section (e.g. SCM and PMA end
// terms both Sec A). Keying purely on code+section made them collide — editing
// one applied to (and badged) all of them. So we fall back to the name when
// there's no code. Normal, code-bearing classes are unaffected: their key is
// byte-identical to the old `${code}_${section}` scheme, which keeps existing
// stored overrides and the class-reminders edge function in sync.
//
// This module is the single source of truth — admin write, admin read, and the
// student-facing apply in App.jsx must all go through it.

// Stable identity for a class row: code if present, else display name.
export function classIdent(c) {
  return (c && (c.code || c.name)) || "";
}

// Storage key for an identity + section. "All"/"Single" use the bare identity
// so one override covers every section; A/B are section-scoped. Section suffix
// is always the raw "A"/"B" so keys parse unambiguously (idents never end in
// "_A"/"_B").
export function makeOverrideKey(ident, section) {
  return !section || section === "All" || section === "Single" ? ident : `${ident}_${section}`;
}

// Look up a class's override in a single date's override map. Tries the
// section-scoped key first, then the bare identity (an "All"-section override).
export function lookupOverride(overridesForDate, c) {
  if (!overridesForDate) return null;
  const ident = classIdent(c);
  return overridesForDate[`${ident}_${c.section}`] || overridesForDate[ident] || null;
}

// Split an override key back into { ident, section }. Only "_A"/"_B" suffixes
// denote a section (matches makeOverrideKey); anything else is a bare ident.
export function parseOverrideKey(key) {
  const m = /^(.*)_(A|B)$/.exec(key);
  return m ? { ident: m[1], section: m[2] } : { ident: key, section: "All" };
}
