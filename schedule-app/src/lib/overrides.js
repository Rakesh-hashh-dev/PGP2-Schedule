// Shared keying for admin class overrides (flags.classOverrides[date][key]).
//
// A class's identity is its course CODE when it has one. Exam / "END Term"
// rows come from the sheet with an empty code and are distinguished only by
// name, so several can share the same date + section (e.g. SCM and PMA end
// terms both Sec A). Keying purely on code+section made them collide — editing
// one applied to (and badged) all of them. So we fall back to the name when
// there's no code. Code-bearing classes keep the `${code}_${section}` base.
//
// A course can also meet more than once on the same day for the same section
// (double sessions, e.g. BMD Sec A 17:00 and 18:30). Ident+section alone made
// those sessions collide too, so edits are now keyed per SESSION by appending
// the class's ORIGINAL feed start time: `BMD_A@17:00`. Legacy whole-day keys
// (`BMD_A`, `BMD`) still resolve, as a base that a session key layers over.
//
// This module is the single source of truth — admin write, admin read, the
// student-facing apply in App.jsx, and (mirrored) the class-reminders edge
// function must all go through it.

const SLOT_RE = /^(.*)@(\d{1,2}:\d{2})$/;

// Missing visibility keeps the existing behaviour for older cancellations.
export function cancellationVisibility(override) {
  return override?.cancellationVisibility === "hide" ? "hide" : "show";
}

export function cancelOverride(existing = {}, visibility = "show") {
  return {
    ...existing,
    ...(existing.type && existing.type !== "cancelled" ? { cancelledType: existing.type } : {}),
    type: "cancelled",
    cancellationVisibility: visibility === "hide" ? "hide" : "show",
  };
}

export function restoreCancelledOverride(override) {
  const { type, cancellationVisibility: visibility, cancelledType, ...rest } = override;
  void type; void visibility;
  if (cancelledType) rest.type = cancelledType;
  // Older cancellations stored a generated label rather than a class title.
  if (rest.name?.startsWith("Cancelled:")) delete rest.name;
  return Object.keys(rest).some(key => !["modifiedAt", "modifiedBy"].includes(key)) ? rest : null;
}

export function applyClassOverrides(classes, overrides = {}) {
  const updated = classes.map(c => {
    const override = lookupOverride(overrides[c.date], c);
    if (!override) return c;
    const row = { ...c, ...override };
    if (row.type === "cancelled" && override.name?.startsWith("Cancelled:")) row.name = c.name;
    return row;
  });
  return [...updated, ...buildOverrideAdds(overrides, classes)]
    .filter(c => c.type !== "cancelled" || cancellationVisibility(c) !== "hide");
}

// Stable identity for a class row: code if present, else display name.
export function classIdent(c) {
  return (c && (c.code || c.name)) || "";
}

// Storage key for an identity + section (+ optional session start). "All"/
// "Single" use the bare identity so one override covers every section; A/B are
// section-scoped. Section suffix is always the raw "A"/"B" so keys parse
// unambiguously (idents never end in "_A"/"_B"). `start` must be the class's
// ORIGINAL feed start, never an overridden one, or the key drifts on re-edit.
export function makeOverrideKey(ident, section, start) {
  const base = !section || section === "All" || section === "Single" ? ident : `${ident}_${section}`;
  return start ? `${base}@${start}` : base;
}

// Session-scoped key for a feed class row. Rows that were themselves created by
// an override carry `_ovrKey` and are written back under that exact key.
export function classOverrideKey(c) {
  if (c?._ovrKey) return c._ovrKey;
  return makeOverrideKey(classIdent(c), c?.section, c?.start);
}

// Look up a class's override in a single date's override map. A legacy
// whole-day override (section-scoped, else bare "All") is the base; a
// session-scoped override for this exact start time is layered on top.
export function lookupOverride(overridesForDate, c) {
  if (!overridesForDate || !c) return null;
  const ident = classIdent(c);
  const legacy = overridesForDate[`${ident}_${c.section}`] || overridesForDate[ident] || null;
  const slot = c.start
    ? overridesForDate[`${ident}_${c.section}@${c.start}`] || overridesForDate[`${ident}@${c.start}`] || null
    : null;
  if (legacy && slot) return { ...legacy, ...slot };
  return slot || legacy;
}

// Split an override key back into { ident, section, start? }. Only "_A"/"_B"
// suffixes denote a section (matches makeOverrideKey); anything else is a bare
// ident. `start` is present only for session-scoped keys.
export function parseOverrideKey(key) {
  const slot = SLOT_RE.exec(key);
  const base = slot ? slot[1] : key;
  const m = /^(.*)_(A|B)$/.exec(base);
  const out = m ? { ident: m[1], section: m[2] } : { ident: base, section: "All" };
  return slot ? { ...out, start: slot[2] } : out;
}

// Does a feed class row fall under a parsed override key?
export function classMatchesKey(c, { ident, section, start }) {
  return classIdent(c) === ident
    && (c.section === section || section === "All" || c.section === "Single")
    && (!start || c.start === start);
}

// Build the list of brand-new class rows an override map contributes on top of a
// live schedule. An override that matches an existing class is a *modification*
// (merged elsewhere) and produces nothing here. An override with no match is a
// genuinely *added* class ONLY when it carries a `name` (the admin gave it a
// title). A name-less, unmatched override is a field-patch — a room/time edit
// whose target class is no longer in the feed (e.g. a prior term's edits after a
// term swap); resurrecting it as a class would wrongly count toward attendance,
// so it is dropped. A cancelled admin-created class keeps its title and times,
// so it can still be displayed (or restored), unlike an orphan cancellation.
export function buildOverrideAdds(overrides, classes, { includeHidden = false } = {}) {
  const added = [];
  Object.keys(overrides || {}).forEach((date) => {
    Object.keys(overrides[date]).forEach((key) => {
      const ovr = overrides[date][key];
      if (ovr.type === "cancelled" && (!ovr.cancelledType || (!includeHidden && cancellationVisibility(ovr) === "hide"))) return;
      const parsed = parseOverrideKey(key);
      const { ident: code, section } = parsed;
      const exists = classes.some((c) => c.date === date && classMatchesKey(c, parsed));
      if (exists) return;
      if (!ovr.name) return; // field-patch of a class no longer in the feed — don't resurrect
      added.push({
        date,
        code,
        section,
        name: ovr.name || "Custom Added Class",
        room: ovr.room || "",
        start: ovr.start || "",
        end: ovr.end || "",
        type: ovr.type || "class",
        ...(ovr.type === "cancelled" ? { cancellationVisibility: cancellationVisibility(ovr), cancelledType: ovr.cancelledType } : {}),
        ...(includeHidden ? { _ovrKey: key } : {}),
      });
    });
  });
  return added;
}
