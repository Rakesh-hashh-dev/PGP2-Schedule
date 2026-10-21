import { describe, it, expect, beforeEach } from "vitest";
import { SERVER_LEVEL_CAP, adopt, award, care, emptyPet, levelFor, xpOf } from "./pet.js";
import { PET_KEY, clearPetLocal, dismissRecount, isRecountDismissed, fromRow, loadPet, savePetLocal, toRow } from "./petStorage.js";

// The node test env has no localStorage. A minimal in-memory stand-in is enough
// for the cache half of this module; the network half is exercised against the
// real local Supabase stack, not here.
function stubStorage({ throwOnWrite = false } = {}) {
  const map = new Map();
  globalThis.localStorage = {
    getItem: k => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => {
      if (throwOnWrite) throw new DOMException("QuotaExceededError");
      map.set(k, String(v));
    },
    removeItem: k => map.delete(k),
  };
  return map;
}

const sample = () => {
  let s = adopt(emptyPet(), "fox", "Mochi", new Date("2026-09-04T10:00:00"));
  s = award(s, "att:2026-09-04_10:00_SCM_A", 10, new Date("2026-09-04T10:00:00"));
  s = care(s, "pet", new Date("2026-09-04T11:00:00"));
  return s;
};

beforeEach(() => { stubStorage(); });

describe("local cache", () => {
  it("round-trips a pet through localStorage", () => {
    const s = sample();
    savePetLocal("u1", s);
    expect(loadPet("u1")).toEqual(s);
  });

  it("returns a fresh pet when nothing is stored", () => {
    expect(loadPet("u1")).toEqual(emptyPet());
  });

  it("degrades to a fresh pet on corrupt JSON rather than throwing", () => {
    const map = stubStorage();
    map.set(`${PET_KEY}:u1`, "{not json");
    expect(() => loadPet("u1")).not.toThrow();
    expect(loadPet("u1")).toEqual(emptyPet());
  });

  it("survives blocked storage on write (private mode / quota)", () => {
    stubStorage({ throwOnWrite: true });
    expect(() => savePetLocal("u1", sample())).not.toThrow();
  });

  it("clears without throwing", () => {
    savePetLocal("u1", sample());
    clearPetLocal("u1");
    expect(loadPet("u1")).toEqual(emptyPet());
  });
});

describe("row ⇄ state mapping", () => {
  it("survives a full round-trip through the row shape", () => {
    const s = sample();
    expect(fromRow(toRow("user_A", s))).toEqual(s);
  });

  it("uses exactly the columns the migration defines", () => {
    // Guards against silent drift: renaming a column in the SQL without
    // updating toRow would break persistence with no error anywhere.
    expect(Object.keys(toRow("user_A", sample())).sort()).toEqual([
      "adopted_at", "awarded", "care", "cosmetics",
      "last_seen", "level", "name", "pet_key", "unlocked", "user_id",
    ]);
  });

  it("denormalizes level for the friend projection", () => {
    let s = adopt(emptyPet(), "cat", "Mochi");
    s = award(s, "big", 250);
    expect(toRow("user_A", s).level).toBe(3);
    // ...and never writes an xp column: XP is derived from the ledger + granted_xp.
    expect(toRow("user_A", s)).not.toHaveProperty("xp");
  });

  it("never writes a level above what the cloud check constraint accepts", () => {
    // pet_state.level is `between 1 and 20` in prod.
    const s = award(adopt(emptyPet(), "cat", "Mochi"), "big", 90000);
    expect(toRow("user_A", s).level).toBe(Math.min(SERVER_LEVEL_CAP, levelFor(xpOf(s))));
    expect(toRow("user_A", s).level).toBeLessThanOrEqual(SERVER_LEVEL_CAP);
  });

  it("falls back to the inflated total as the unlock floor until legacy_xp exists", () => {
    const row = { user_id: "u1", pet_key: "cat", base_xp: 500, granted_xp: 0, awarded: { "att:a": ["2026-09-01", 32] } };
    expect(fromRow(row).legacyXp).toBe(532);
    expect(fromRow({ ...row, legacy_xp: 900 }).legacyXp).toBe(900);
    expect(fromRow({ ...row, base_xp: 0 }).legacyXp).toBe(0);
    expect(toRow("u1", fromRow(row))).not.toHaveProperty("legacy_xp");
    expect(toRow("u1", fromRow(row))).not.toHaveProperty("base_xp");
  });

  it("remembers a dismissed recount notice, and survives broken storage", () => {
    stubStorage();
    expect(isRecountDismissed()).toBe(false);
    dismissRecount();
    expect(isRecountDismissed()).toBe(true);
    stubStorage({ throwOnWrite: true });
    expect(() => dismissRecount()).not.toThrow();
  });

  it("sends a null name rather than an empty string", () => {
    expect(toRow("user_A", adopt(emptyPet(), "cat", "")).name).toBeNull();
  });

  it("reads a null/absent row as no pet", () => {
    expect(fromRow(null)).toBeNull();
    expect(fromRow(undefined)).toBeNull();
  });

  it("fills defaults for a sparse row", () => {
    const s = fromRow({ user_id: "u", pet_key: "cat" });
    expect(s.petKey).toBe("cat");
    expect(s.name).toBe("");
    expect(xpOf(s)).toBe(0);
    // Every cosmetic slot defaults to "not wearing one", so a row written
    // before a slot existed reads as bare rather than as invalid.
    expect(s.cosmetics).toEqual({ accessory: true, hat: null, coat: null, neck: null, title: null, buddy: null, habitat: { scene: "garden", light: "auto", decor: ["plant", "cushion"] } });
  });

  it("coerces a bigint last_seen arriving as a string", () => {
    // postgres bigint comes back as a string over PostgREST.
    expect(fromRow({ user_id: "u", pet_key: "cat", last_seen: "1757000000000" }).lastSeen)
      .toBe(1757000000000);
  });
});

describe("granted_xp column mapping", () => {
  it("reads granted_xp from the cloud row", () => {
    const state = fromRow({ user_id: "u1", pet_key: "cat", name: "Mochi", base_xp: 10, granted_xp: 700 });
    expect(state.grantedXp).toBe(700);
    // base_xp is retired: it no longer counts toward XP (it only seeds legacyXp).
    expect(xpOf(state)).toBe(700);
    expect(state.legacyXp).toBe(710);
  });

  it("defaults to 0 when the column is absent", () => {
    expect(fromRow({ user_id: "u1", pet_key: "cat" }).grantedXp).toBe(0);
  });

  // The whole point of the separate column: a client save must not carry it,
  // or an open tab would clobber an admin grant on its next write.
  it("never writes granted_xp back", () => {
    const row = toRow("u1", { ...adopt(emptyPet(), "cat", "Mochi", new Date()), grantedXp: 700 });
    expect(row).not.toHaveProperty("granted_xp");
  });

  it("still reports the granted level so friends see it", () => {
    const row = toRow("u1", { ...adopt(emptyPet(), "cat", "Mochi", new Date()), grantedXp: 700 });
    expect(row.level).toBe(5);
  });
});

describe("cache is namespaced per user", () => {
  // The bug this prevents: a shared browser let the next account merge the
  // previous student's ledger into its own, and syncPetFromCloud writes that
  // union back to the cloud — so the XP transfer would be permanent.
  it("does not hand one user's pet to another", () => {
    stubStorage();
    const a = adopt(emptyPet(), "cat", "Mochi", new Date());
    savePetLocal("userA", a);
    expect(loadPet("userA").name).toBe("Mochi");
    expect(loadPet("userB")).toEqual(emptyPet());
  });

  it("writes to separate keys", () => {
    const map = stubStorage();
    savePetLocal("userA", adopt(emptyPet(), "cat", "A", new Date()));
    savePetLocal("userB", adopt(emptyPet(), "dog", "B", new Date()));
    expect(map.has(`${PET_KEY}:userA`)).toBe(true);
    expect(map.has(`${PET_KEY}:userB`)).toBe(true);
    expect(loadPet("userA").name).toBe("A");
    expect(loadPet("userB").name).toBe("B");
  });

  it("reads and writes nothing when signed out", () => {
    const map = stubStorage();
    savePetLocal(undefined, adopt(emptyPet(), "cat", "Ghost", new Date()));
    expect(map.size).toBe(0);
    expect(loadPet(undefined)).toEqual(emptyPet());
  });
});
