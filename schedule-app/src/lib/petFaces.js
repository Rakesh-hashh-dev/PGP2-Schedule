// Illustration-only profiles; these never change saved personalities or XP.
//
// `family` picks the eye anatomy PetEyes draws (see docs below); shape, tilt
// and pupil only tune it. Families exist so species read differently at 40px —
// before them every pet shared one iris-and-big-pupil eye.
//   slit    – full iris + vertical slit that widens with --pet-pupil (cats, foxes, dragons)
//   bead    – glossy dark bead, no iris ring (rodents, birds, small critters)
//   puppy   – big round iris with a sliver of white below (dogs, soft mammals)
//   patch   – light ring around a bright iris, so it reads on dark fur/masks
//   owl     – full bright iris, round pupil, no white
//   display – screen eyes (robots); unchanged pixel styling
const face = (family, shape, pupil, width = 1, height = 1, tilt = 0, sparkle = 'soft', brow = 0) =>
  ({ family, shape, pupil, width, height, tilt, sparkle, brow });

export const PET_FACES = {
  cat: face('slit', 'oval', .65, 1, 1, 0, 'warm'),
  fox: face('slit', 'almond', .63, 1.08, 1.05, 5, 'warm', .25),
  dog: face('puppy', 'round', .73, 1.04, 1.06, -3, 'warm', -.2),
  bunny: face('bead', 'oval', .7, 1.02, 1.06, -2, 'soft'),
  penguin: face('bead', 'round', .68, 1, 1, 0, 'bright', -.15),
  panda: face('patch', 'round', .72, 1.12, 1.12, -2, 'soft'),
  chick: face('bead', 'round', .72, 1.04, 1.08, 0, 'bright', -.15),
  koala: face('bead', 'round', .74, 1.04, 1, -2, 'soft'),
  otter: face('puppy', 'round', .7, 1.05, 1.04, -2, 'warm', -.15),
  rover: face('display', 'display', .58, 1.06, 1, 0, 'pixel'),
  raccoon: face('patch', 'almond', .67, 1.05, 1, 4, 'bright', .2),
  axolotl: face('bead', 'bead', .78, 1.08, 1.06, 0, 'soft'),
  spark: face('bead', 'round', .66, 1, 1.08, 0, 'bright', -.2),
  leafy: face('puppy', 'oval', .68, 1, 1, -2, 'star'),
  cinder: face('puppy', 'round', .7, 1.06, 1.05, 2, 'warm', .12),
  hoot: face('owl', 'round', .66, 1.05, 1.08, 0, 'bright', -.25),
  byte: face('display', 'display', .6, 1.08, 1, 0, 'pixel'),
  pebble: face('bead', 'bead', .77, 1.08, 1.12, -3, 'soft'),
  prickle: face('bead', 'oval', .73, 1.05, 1.05, -3, 'soft'),
  luna: face('puppy', 'oval', .7, 1.04, 1.08, 2, 'star', -.12),
  frost: face('slit', 'almond', .68, 1.06, 1.05, 3, 'bright', .12),
  unicorn: face('puppy', 'oval', .68, 1.02, 1.08, -2, 'star'),
  dragon: face('slit', 'almond', .69, 1.1, 1.08, 3, 'warm', .1),
  hamster: face('bead', 'round', .77, 1.08, 1.1, -2, 'warm'),
  sloth: face('patch', 'round', .75, 1.12, 1.04, -2, 'soft'),
  capy: face('bead', 'round', .78, 1.1, 1, 0, 'warm'),
  maple: face('slit', 'almond', .7, 1.08, 1.06, 3, 'warm', .18),
  ember: face('slit', 'almond', .7, 1.08, 1.06, 2, 'bright', .1),
  mochi: face('bead', 'round', .77, 1.06, 1, 0, 'warm'),
  nimbus: face('puppy', 'oval', .7, 1, 1.08, -2, 'star'),
  sable: face('slit', 'almond', .69, 1.08, 1.04, 4, 'bright', .2),
  inky: face('bead', 'round', .73, 1.05, 1.08, -2, 'bright', -.2),
};

export function petFace(pet) {
  return PET_FACES[pet] || face('puppy', 'oval', .65);
}

// One contour for paint, clipping and alternate expressions, in SVG user units.
export function eyeContour(x, y, rx, ry, shape) {
  if (shape === 'almond') return `M${x - rx} ${y}C${x - rx * .72} ${y - ry * 1.22} ${x + rx * .72} ${y - ry * 1.22} ${x + rx} ${y}C${x + rx * .72} ${y + ry * 1.2} ${x - rx * .72} ${y + ry * 1.2} ${x - rx} ${y}Z`;
  if (shape === 'cozy') return `M${x - rx} ${y - ry * .18}Q${x} ${y - ry * .8} ${x + rx} ${y - ry * .18}C${x + rx * 1.06} ${y + ry * 1.35} ${x - rx * 1.06} ${y + ry * 1.35} ${x - rx} ${y - ry * .18}Z`;
  return `M${x - rx} ${y}a${rx} ${ry} 0 1 0 ${rx * 2} 0a${rx} ${ry} 0 1 0 ${-rx * 2} 0Z`;
}

// The upper half of a contour: drawn heavier as the lash line.
export function eyeLash(x, y, rx, ry, shape) {
  if (shape === 'almond') return `M${x - rx} ${y}C${x - rx * .72} ${y - ry * 1.22} ${x + rx * .72} ${y - ry * 1.22} ${x + rx} ${y}`;
  return `M${x - rx * .9} ${y - ry * .436}A${rx} ${ry} 0 0 1 ${x + rx * .9} ${y - ry * .436}`;
}
