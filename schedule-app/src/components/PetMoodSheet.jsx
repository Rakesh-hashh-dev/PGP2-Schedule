// Dev-only contact sheet: every pet, every mood, at both sizes they ship at.
//
// This exists because the moods are tuned by eye and shipped at 40px. Reading
// a stylesheet tells you `--pet-sat: .9` and `--pet-sat: .93` are different
// numbers; it does not tell you whether anyone can see the difference on a
// greeting row. Two moods quietly collapsing into the same animal is the
// failure mode this feature has, and it is invisible from the code.
//
// Open with `?moodsheet` on the dev server. Never bundled: `main.jsx` guards
// the import behind `import.meta.env.DEV`, so the whole file is tree-shaken
// out of a production build.
import { useState } from "react";
import { PETS } from "./greetingPets.jsx";
import { HATS, MOODS } from "../lib/pet.js";
import { clearMoodStats, readMoodStats } from "../lib/petStats.js";
import PetSleepCue from "./PetSleepCue.jsx";
import PetHat from "./PetHat.jsx";

const BEATS = ["", "bounce", "shake", "perk", "tilt", "stretch", "yawn"];

export default function PetMoodSheet() {
  const [size, setSize] = useState(() => Number(new URLSearchParams(location.search).get("size")) || 40);
  const [beat, setBeat] = useState("");
  const [motion, setMotion] = useState(true);
  const [accessory, setAccessory] = useState(true);
  const [only, setOnly] = useState("");
  // Seeded from the query string (`?moodsheet&hat=crown&size=116`) so a run can
  // be reproduced, linked, or screenshotted without clicking anything.
  const [hat, setHat] = useState(() => new URLSearchParams(location.search).get("hat") || "");
  const [stats, setStats] = useState(() => readMoodStats());

  const pets = only ? PETS.filter(p => p.key === only) : PETS;

  return (
    <main style={S.page}>
      <header style={S.head}>
        <h1 style={S.h1}>Pet mood sheet</h1>
        <p style={S.sub}>
          {pets.length} pets × {MOODS.length} moods. Look across a row: any two cells
          you cannot tell apart are two moods that are not doing their job.
        </p>
        <div style={S.controls}>
          <label style={S.ctl}>Size
            <select value={size} onChange={e => setSize(Number(e.target.value))}>
              <option value={40}>40px · greeting</option>
              <option value={64}>64px</option>
              <option value={116}>116px · hero</option>
            </select>
          </label>
          <label style={S.ctl}>Beat
            <select value={beat} onChange={e => setBeat(e.target.value)}>
              {BEATS.map(b => <option key={b} value={b}>{b || "— none —"}</option>)}
            </select>
          </label>
          <label style={S.ctl}>Hat
            <select value={hat} onChange={e => setHat(e.target.value)}>
              <option value="">— none —</option>
              {HATS.map(h => <option key={h.key} value={h.key}>{h.label}</option>)}
            </select>
          </label>
          <label style={S.ctl}>Pet
            <select value={only} onChange={e => setOnly(e.target.value)}>
              <option value="">All</option>
              {PETS.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
            </select>
          </label>
          <label style={S.ctl}>
            <input type="checkbox" checked={motion} onChange={e => setMotion(e.target.checked)} /> motion
          </label>
          <label style={S.ctl}>
            <input type="checkbox" checked={accessory} onChange={e => setAccessory(e.target.checked)} /> accessory
          </label>
        </div>
        <p style={S.sub}>
          The number under each mood is how many times this browser has actually
          seen it ({stats.total} total{stats.since ? `, since ${new Date(stats.since).toLocaleDateString()}` : ""}).
          A mood sitting on zero after a week of real use is a mood that never
          fires.{" "}
          <button type="button" onClick={() => { clearMoodStats(); setStats(readMoodStats()); }}>reset</button>
          {" "}
          <button type="button" onClick={() => setStats(readMoodStats())}>refresh</button>
        </p>
      </header>

      <div style={S.scroll}>
        <table style={S.table}>
          <thead>
            <tr>
              <th style={{ ...S.th, ...S.sticky }} />
              {MOODS.map(m => (
                <th key={m} style={S.th}>
                  {m}
                  <span style={S.tally}>{stats.counts[m] || 0}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pets.map(pet => (
              <tr key={pet.key}>
                <th style={{ ...S.th, ...S.sticky, textAlign: "left" }}>{pet.label}</th>
                {MOODS.map(mood => (
                  <td key={mood} style={S.td}>
                    <span
                      className="dg-pet"
                      // `.dg-pet` sets no `display`, so a bare span stays inline
                      // and drops width/height entirely — in the app it is a
                      // <button> or a grid item, which blockifies it for free.
                      style={{ display: "inline-grid", width: size, height: size, "--pet-z": `${size * 0.22}px` }}
                      data-pet={pet.key}
                      data-mood={mood}
                      data-motion={motion ? "on" : "off"}
                      data-beat={beat || undefined}
                      data-accessory={accessory ? "on" : "off"}
                      aria-hidden="true"
                    >
                      <pet.Svg />
                      <PetHat hat={hat || null} />
                      <PetSleepCue />
                    </span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}

// Inline styles on purpose: this page must never add a selector to styles.css
// that could collide with the real pet rules it is here to inspect.
const S = {
  page: { padding: 24, font: "13px/1.5 system-ui, sans-serif", background: "var(--bg)", color: "var(--text)", minHeight: "100vh" },
  head: { marginBottom: 20 },
  h1: { margin: "0 0 4px", fontSize: 20 },
  sub: { margin: "0 0 12px", maxWidth: 620, opacity: .72 },
  controls: { display: "flex", flexWrap: "wrap", gap: 14, alignItems: "center" },
  ctl: { display: "inline-flex", gap: 6, alignItems: "center", fontWeight: 600 },
  scroll: { overflowX: "auto" },
  table: { borderCollapse: "separate", borderSpacing: 0 },
  th: { padding: "6px 10px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".4px", opacity: .7, whiteSpace: "nowrap" },
  sticky: { position: "sticky", left: 0, background: "var(--bg)", zIndex: 5 },
  td: { padding: 14, textAlign: "center", verticalAlign: "middle" },
  tally: { display: "block", marginTop: 2, fontSize: 10, fontWeight: 800, opacity: .55 },
};
