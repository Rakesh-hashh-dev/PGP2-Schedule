// Illustration-only profiles; these never change saved personalities or XP.
const face = (shape, pupil, width = 1, height = 1, tilt = 0, sparkle = 'soft', brow = 0) =>
  ({ shape, pupil, width, height, tilt, sparkle, brow });

export const PET_FACES = {
  cat: face('oval', .65, 1, 1, 0, 'warm'),
  fox: face('almond', .63, 1.08, 1.05, 5, 'warm', .25),
  dog: face('round', .73, 1.04, 1.06, -3, 'warm', -.2),
  bunny: face('oval', .7, 1.02, 1.06, -2, 'soft'),
  penguin: face('round', .68, 1, 1, 0, 'bright', -.15),
  panda: face('cozy', .72, 1.12, 1.12, -2, 'soft'),
  chick: face('round', .72, 1.04, 1.08, 0, 'bright', -.15),
  koala: face('cozy', .74, 1.04, 1, -2, 'soft'),
  otter: face('round', .7, 1.05, 1.04, -2, 'warm', -.15),
  rover: face('display', .58, 1.06, 1, 0, 'pixel'),
  raccoon: face('almond', .67, 1.05, 1, 4, 'bright', .2),
  axolotl: face('bead', .78, 1.08, 1.06, 0, 'soft'),
  spark: face('round', .66, 1, 1.08, 0, 'bright', -.2),
  leafy: face('oval', .68, 1, 1, -2, 'star'),
  cinder: face('round', .7, 1.06, 1.05, 2, 'warm', .12),
  hoot: face('round', .66, 1.05, 1.08, 0, 'bright', -.25),
  byte: face('display', .6, 1.08, 1, 0, 'pixel'),
  pebble: face('bead', .77, 1.08, 1.12, -3, 'soft'),
  prickle: face('oval', .73, 1.05, 1.05, -3, 'soft'),
  luna: face('oval', .7, 1.04, 1.08, 2, 'star', -.12),
  frost: face('almond', .68, 1.06, 1.05, 3, 'bright', .12),
  unicorn: face('oval', .68, 1.02, 1.08, -2, 'star'),
  dragon: face('almond', .69, 1.1, 1.08, 3, 'warm', .1),
  hamster: face('round', .77, 1.08, 1.1, -2, 'warm'),
  sloth: face('cozy', .75, 1.12, 1.04, -2, 'soft'),
  capy: face('cozy', .78, 1.1, 1, 0, 'warm'),
  maple: face('almond', .7, 1.08, 1.06, 3, 'warm', .18),
  ember: face('almond', .7, 1.08, 1.06, 2, 'bright', .1),
  mochi: face('cozy', .77, 1.06, 1, 0, 'warm'),
  nimbus: face('oval', .7, 1, 1.08, -2, 'star'),
  sable: face('almond', .69, 1.08, 1.04, 4, 'bright', .2),
  inky: face('round', .73, 1.05, 1.08, -2, 'bright', -.2),
};

export function petFace(pet) {
  return PET_FACES[pet] || face('oval', .65);
}

// One contour for paint, clipping and alternate expressions, in SVG user units.
export function eyeContour(x, y, rx, ry, shape) {
  if (shape === 'almond') return `M${x - rx} ${y}C${x - rx * .72} ${y - ry * 1.22} ${x + rx * .72} ${y - ry * 1.22} ${x + rx} ${y}C${x + rx * .72} ${y + ry * 1.2} ${x - rx * .72} ${y + ry * 1.2} ${x - rx} ${y}Z`;
  if (shape === 'cozy') return `M${x - rx} ${y - ry * .18}Q${x} ${y - ry * .8} ${x + rx} ${y - ry * .18}C${x + rx * 1.06} ${y + ry * 1.35} ${x - rx * 1.06} ${y + ry * 1.35} ${x - rx} ${y - ry * .18}Z`;
  return `M${x - rx} ${y}a${rx} ${ry} 0 1 0 ${rx * 2} 0a${rx} ${ry} 0 1 0 ${-rx * 2} 0Z`;
}
