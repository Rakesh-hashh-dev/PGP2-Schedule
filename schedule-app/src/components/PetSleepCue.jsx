// The drifting z's above a dozing companion.
//
// One overlay serves all twelve pets: it sits alongside the SVG inside the
// `.dg-pet` box rather than inside any pet's artwork, so adding a thirteenth
// companion costs nothing here. It renders unconditionally and the mood rules
// in styles.css decide whether it shows — a full z-z-z stream at night
// ("sleepy") and a single slow one through the evening ("tired").
//
// `aria-hidden` for the same reason the pet SVGs are: the wrapper is already a
// labelled control (the greeting button) or decorative (the pet page hero), and
// the mood is spelled out in words right underneath either way.
export default function PetSleepCue() {
  return (
    <span className="dg-pet-zzz" aria-hidden="true">
      <i className="dg-pet-z dg-pet-z-a">z</i>
      <i className="dg-pet-z dg-pet-z-b">z</i>
      <i className="dg-pet-z dg-pet-z-c">z</i>
    </span>
  );
}
