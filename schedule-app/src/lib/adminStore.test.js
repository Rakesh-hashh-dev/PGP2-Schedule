import { describe, it, expect, vi } from "vitest";

// adminStore imports the Supabase client at module load, and createClient
// throws without VITE_ env vars. The functions under test here are the pure
// ones — merging, flattening, validation — so the client is stubbed out.
vi.mock("./supabase", () => ({ supabase: {} }));

const { mergeDraftIntoFlags, draftEntries, draftKeyFor, staleTemplateSections } =
  await import("./adminStore.js");

describe("mergeDraftIntoFlags", () => {
  const flags = {
    enableFriends: true,
    classOverrides: {
      "2026-09-10": { SCM_A: { type: "cancelled" } },
    },
  };

  it("adds a draft's overrides to the published map", () => {
    const next = mergeDraftIntoFlags(flags, {
      payload: { "2026-09-11": { DSC1_B: { room: "C-204" } } },
    });
    expect(next.classOverrides["2026-09-11"]).toEqual({ DSC1_B: { room: "C-204" } });
    expect(next.classOverrides["2026-09-10"]).toEqual({ SCM_A: { type: "cancelled" } });
  });

  it("merges into an existing date rather than replacing it", () => {
    const next = mergeDraftIntoFlags(flags, {
      payload: { "2026-09-10": { PMA_A: { room: "B-101" } } },
    });
    expect(Object.keys(next.classOverrides["2026-09-10"]).sort()).toEqual(["PMA_A", "SCM_A"]);
  });

  it("lets the draft win for a key that already exists", () => {
    const next = mergeDraftIntoFlags(flags, {
      payload: { "2026-09-10": { SCM_A: { type: "class", room: "A-1" } } },
    });
    expect(next.classOverrides["2026-09-10"].SCM_A).toEqual({ type: "class", room: "A-1" });
  });

  it("does not mutate the flags it was given", () => {
    const before = JSON.stringify(flags);
    mergeDraftIntoFlags(flags, { payload: { "2026-09-12": { X_A: {} } } });
    expect(JSON.stringify(flags)).toBe(before);
  });

  it("preserves unrelated flags", () => {
    const next = mergeDraftIntoFlags(flags, { payload: {} });
    expect(next.enableFriends).toBe(true);
  });

  it("copes with flags that have no overrides yet", () => {
    const next = mergeDraftIntoFlags({}, { payload: { "2026-09-12": { X_A: { room: "R" } } } });
    expect(next.classOverrides["2026-09-12"].X_A.room).toBe("R");
  });

  it("treats a null draft payload as a no-op", () => {
    expect(mergeDraftIntoFlags(flags, null).classOverrides).toEqual(flags.classOverrides);
  });
});

describe("draftEntries", () => {
  it("flattens dates and keys into sorted rows", () => {
    const rows = draftEntries({
      payload: {
        "2026-09-12": { B_A: { room: "R2" } },
        "2026-09-10": { A_A: { room: "R1" } },
      },
    });
    expect(rows.map((r) => r.date)).toEqual(["2026-09-10", "2026-09-12"]);
    expect(rows[0]).toMatchObject({ date: "2026-09-10", key: "A_A", room: "R1" });
  });

  it("returns nothing for an empty or missing draft", () => {
    expect(draftEntries(null)).toEqual([]);
    expect(draftEntries({ payload: {} })).toEqual([]);
  });
});

describe("draftKeyFor", () => {
  // A draft must key classes exactly like the live override map, or publishing
  // it would land the change on a different class than the admin picked.
  it("matches the shared override keying for a section", () => {
    expect(draftKeyFor("SCM", "A")).toBe("SCM_A");
  });
  it("uses the bare identity for All/Single", () => {
    expect(draftKeyFor("SCM", "All")).toBe("SCM");
    expect(draftKeyFor("SCM", "Single")).toBe("SCM");
  });
});

describe("staleTemplateSections", () => {
  // Section structure is hardwired and shifts across term rollovers, so a
  // template authored last term can target sections that no longer exist.
  it("names sections the template wants that no longer exist", () => {
    expect(staleTemplateSections({ sections: ["A", "B"] }, ["A"])).toEqual(["B"]);
  });
  it("is empty when every section is still live", () => {
    expect(staleTemplateSections({ sections: ["A"] }, ["A", "B"])).toEqual([]);
  });
  it("is empty for a template with no sections", () => {
    expect(staleTemplateSections({}, ["A"])).toEqual([]);
    expect(staleTemplateSections(null, ["A"])).toEqual([]);
  });
});
