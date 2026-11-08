// Filled, low-contrast planes complement the fine linework. Coordinates follow
// each actual face, including Pebble's offset head and Leafy's low-set face.
// Keep these inside the caller's head/body rig; moving ears, wings and tails
// carry their own artwork and must not acquire stationary overlay markings.
const RELIEF = {
  cat: {
    head: 'M7.9 20.3q1.5 1.8 3.7 1.7l-1.2 1-1.7-.6.6-.7zM24.1 20.3q-1.5 1.8-3.7 1.7l1.2 1 1.7-.6-.6-.7z',
    light: 'M11.5 10.8q1.4-.9 2.8-.7l-.9 1.2-1.7.6z',
    body: 'M13.8 26.2q2.2 1 4.4 0l-.5 1.8-1.7 1-1.7-1z',
    texture: 'M14.5 26.8l1.5.7 1.5-.7',
  },
  fox: {
    head: 'M8.3 19.4l2.2 1.7 1.1-.2-1 1.7-1.9-.5.4-.8zM23.7 19.4l-2.2 1.7-1.1-.2 1 1.7 1.9-.5-.4-.8z',
    light: 'M13.6 11.5 16 9.8l-1.3 2.7-.8.7z',
    body: 'M12.6 26.4l1.8.8 1.6-.4 1.6.4 1.8-.8-1.3 2.1-2.1.8-2.1-.8z',
    texture: 'M14.6 27.4l1.4.7 1.4-.7',
  },
  dog: {
    head: 'M10.1 21q1.5 1.7 4 1.1l-1.4 1-1.8-.3zM21.9 21q-1.5 1.7-4 1.1l1.4 1 1.8-.3z',
    light: 'M10.3 10.9q1.9-1.5 4-1l-.9 1.1-2.4.8z',
    body: 'M13.6 26.6q2.4 1.4 4.8 0l-.7 2.1-1.7.5-1.7-.5z',
    texture: 'M14.4 27.5l.8.5m1.6 0 .8-.5',
  },
  bunny: {
    head: 'M8.4 21.3q1.3 1.2 3.4 1l-1 1-1.7-.2zM23.6 21.3q-1.3 1.2-3.4 1l1 1 1.7-.2z',
    light: 'M12.4 11.4q1.3-.8 2.6-.5l-1 1-1.5.3z',
    body: 'M13.4 26.2q2.6 1 5.2 0l-.8 2.4-1.8.4-1.8-.4z',
    texture: 'M14.5 27.3q1.5.8 3 0',
  },
  penguin: {
    head: 'M12.2 20.1q1.5 1 3.1.4l-.6 1.4-1.4-.3zM19.8 20.1q-1.5 1-3.1.4l.6 1.4 1.4-.3zM14.3 23q1.7.8 3.4 0l-.8 1.3h-1.8z',
    light: 'M8.5 12q1.5-2.2 3.2-2.1l-1.4 1.3-1.2 1.6z',
    body: 'M10.1 27.3q1.3-.7 2.7-.1l-.5.7-1.6.1zM19.2 27.2q1.4-.6 2.7.1l-.6.7-1.6-.1z',
    texture: 'M11.1 27.2l.1.9m9.7-.9-.1.9',
  },
  panda: {
    head: 'M8.5 21q1.8 1.5 3.9 1.4l-1.2 1-1.8-.6zM23.5 21q-1.8 1.5-3.9 1.4l1.2 1 1.8-.6z',
    light: 'M12.6 10.2q1.5-.6 2.8-.2l-.9 1.1-1.9.2z',
    body: 'M13.4 26.5q2.6.9 5.2 0l-.8 1.9-1.8.6-1.8-.6z',
    texture: 'M14.3 27.2l1 .6m1.4 0 1-.6',
  },
  chick: {
    head: 'M8.3 20q1.2 2 3.5 2l-1.3 1.1-1.7-.9zM23.7 20q-1.2 2-3.5 2l1.3 1.1 1.7-.9zM13.8 24l2.2.8 2.2-.8-1 1.5h-2.4z',
    light: 'M10.4 12.5q1.7-1.5 3.4-1l-1.7 1.3-1.3.2z',
    body: 'M11.6 27.6l1.1.2-.1.5-1.2-.1zM19.3 27.8l1.1-.2.2.6-1.2.1z',
    texture: 'M12.2 27.5v.6m7.6-.6v.6',
  },
  koala: {
    head: 'M7.8 20.4l2 1.4 1.1-.2-.6 1.6-1.7-.5zM24.2 20.4l-2 1.4-1.1-.2.6 1.6 1.7-.5z',
    light: 'M11.9 11.5q1.5-.9 3.1-.6l-1 1.2-1.8.2z',
    body: 'M13.5 26.4l2.5.7 2.5-.7-.8 2-1.7.5-1.7-.5z',
    texture: 'M14.7 27.4l1.3.6 1.3-.6',
  },
  otter: {
    head: 'M10.2 21.7q1.3 1.2 3.6.8l-.8 1.1-1.8-.3zM21.8 21.7q-1.3 1.2-3.6.8l.8 1.1 1.8-.3z',
    light: 'M10.8 11.8q1.6-.9 3.1-.6l-1 1-1.7.3z',
    body: 'M12.7 26.7q3.3-1.5 6.6 0l-1 1.2-2.3.3-2.3-.3z',
    texture: 'M13.8 27q2.2-.6 4.4 0m-2.8.8 1.2-.1',
  },
  rover: {
    head: 'M8.4 13.3v5.9l.6.7v-6.6zM22.9 12.2l.8.8v6.5l-.8.6z',
    light: 'M11.1 10.5h6l-1 .6h-4.5z',
    body: 'M10 24h12v2.7H10z',
    texture: 'M11.2 24.8h2m1.8 0h2m1.8 0h2M11.2 26h9.6',
  },
  raccoon: {
    head: 'M7.8 20.7l2 1.3 1.3-.3-1.1 1.6-1.5-.5zM24.2 20.7l-2 1.3-1.3-.3 1.1 1.6 1.5-.5z',
    light: 'M13.8 11.2 16 9.6l-.9 2.5-1 .5z',
    body: 'M13 26.3l3 1 3-1-.8 2.2-2.2.5-2.2-.5z',
    texture: 'M14.6 27.5l1.4.5 1.4-.5',
  },
  axolotl: {
    head: 'M8.6 21.5q1.3 1.6 3.4 1l-.7 1-1.9-.1zM23.4 21.5q-1.3 1.6-3.4 1l.7 1 1.9-.1z',
    light: 'M10.6 11.4q1.8-1.1 3.5-.4l-1.5.7-1.6.3z',
    body: 'M12.5 26.2q3.5 1.4 7 0l-.8 1.8-2.7.7-2.7-.7z',
    texture: 'M14 27.1q2 .8 4 0',
  },
  spark: {
    head: 'M8.7 20l1.8 1.1-.7 1.2 1.7-.4-.7 1.1-1.9-.6zM23.3 20l-1.8 1.1.7 1.2-1.7-.4.7 1.1 1.9-.6z',
    light: 'M14.3 11.2 16 9.6l-.3 1.4 1 .2-2 1.1z',
    body: 'M13.1 26.7 16 28l2.9-1.3-.9 1.7-2 .8-2-.8z',
    texture: 'M14.5 27.4l1.5.7 1.5-.7',
  },
  leafy: {
    head: 'M7.3 23q1.6 1.2 3.1 1.1l-1.3 1.3-1.5-.8zM24.7 23q-1.6 1.2-3.1 1.1l1.3 1.3 1.5-.8z',
    light: 'M12.4 14.4q2.1-.6 3 .5-1.7 1-3-.5z',
    headTexture: 'M13 14.6l1.5.3m-.7-.2-.4-.4M8 23.6l1.4.6m13.2 0 1.4-.6',
    body: 'M8.2 27.3q1.7-.9 3.4-.4l-.9 1.2-1.8.1zM20.4 26.9q1.7-.5 3.4.4l-.7.9-1.8-.1z',
    texture: 'M9.2 27.4l1-.2m11.6 0 1 .2',
  },
  cinder: {
    head: 'M8.9 21.7l2.1.6 1.3-.2-1.1 1.6-1.6-.5zM23.1 21.7l-2.1.6-1.3-.2 1.1 1.6 1.6-.5z',
    light: 'M12.5 11q1.2-.7 2.1-.4l-.7.8-1.1.3z',
    body: 'M13.1 26.3l1.4.8 1.5-.3 1.5.3 1.4-.8-.9 1.8-2 .6-2-.6z',
    texture: 'M14.3 27.1l.7.7m2 0 .7-.7',
  },
  hoot: {
    head: 'M10 22.1q1 1.7 2.2 0l-.4 1.7h-1.3zM14.9 23.3q1.1 1.7 2.2 0l-.4 1.7h-1.4zM19.8 22.1q1.2 1.7 2.2 0l-.5 1.7h-1.3zM12.8 25.4q1 1.4 2 0l-.4 1.5h-1.2zM17.2 25.4q1 1.4 2 0l-.4 1.5h-1.2z',
    light: 'M8.5 9q1.4-1.2 3-.7l-.8.8-1.7.5z',
    body: 'M10 28.3h2l-.3.6h-1.4zM20 28.3h2l-.3.6h-1.4z',
    texture: 'M11 28.5v.8m10-.8v.8',
  },
  byte: {
    head: 'M7.1 11.2h.6v6.3h-.6zM24.3 11.2h.6v6.3h-.6zM10.4 20.1h6.8v.5h-6.8z',
    light: 'M10.1 8.3h5.7l-.8.5h-4.9z',
    body: 'M11.2 23.3h2v3h-2zM18.8 23.3h2v3h-2z',
    texture: 'M11.8 24h.8m-.8 1h.8m6.8-1h.8m-.8 1h.8',
  },
  pebble: {
    head: 'M18.7 21q1.2.9 2.5.6l-.5 1-1.1-.1zM28.7 21q-1.2.9-2.5.6l.5 1 1.1-.1z',
    light: 'M20.2 13.2q1.2-.9 2.6-.6l-.7.9-1.4.3z',
    headTexture: 'M23.4 12.7l.7-.4.7.4-.7.5zM19.2 19.7h.1m8.8 0h.1',
    body: 'M10.6 17.3l2.9-2.1 2.9 2.1-.7 3.6h-4.4zM4.7 21.2l3.4-2 .7 3.2-1.1 1.5H4.6z',
    texture: 'M11.7 17.8l1.8-1.2 1.8 1.2-.4 2.1h-2.8zM4.9 24h12.8',
  },
  prickle: {
    head: 'M12 20.8l1.8.8 1.3-.1-1 1.3-1.6-.7zM26 20.8l-1.8.8-1.3-.1 1 1.3 1.6-.7z',
    light: 'M15.5 12.1q1.7-1 3.2-.6l-.9 1-1.8.3z',
    body: 'M15.7 26.4q2.8 1.3 5.6 0l-.9 1.6-1.9.5-1.9-.5z',
    texture: 'M16.8 27l1.7.6 1.7-.6',
  },
  frost: {
    head: 'M8.5 20.8l2.3 1.4 1.2-.3-1 1.6-1.7-.3.4-.8zM23.5 20.8l-2.3 1.4-1.2-.3 1 1.6 1.7-.3-.4-.8z',
    light: 'M13.8 11.6 16 9.5l-.7 2.4-1 .7z',
    body: 'M12.9 26.6l1.5 1 1.6-.5 1.6.5 1.5-1-.8 1.8-2.3.8-2.3-.8z',
    texture: 'M14.4 27.6l1.6.6 1.6-.6',
  },
  unicorn: {
    head: 'M9.1 21.4q1.3 1.5 3.3 1.1l-.9 1-1.8-.4zM22.9 21.4q-1.3 1.5-3.3 1.1l.9 1 1.8-.4z',
    light: 'M15.6 7.7 16.3 3l.1 4.7z',
    headTexture: 'M9.1 12.3q-.9 1.5-.7 3M22.8 11.7l1 1.3',
    body: 'M13.3 26.7q2.7 1.1 5.4 0l-.8 1.8-1.9.5-1.9-.5z',
    texture: 'M14.2 27.5q1.8.6 3.6 0',
  },
  dragon: {
    head: 'M8.2 18.8l1.2.8 1.1-.8-.2 1.4-1 .4-1-.4zM23.8 18.8l-1.2.8-1.1-.8.2 1.4 1 .4 1-.4zM12.1 11.3l1-.6 1 .6-1 .7z',
    light: 'M14.9 10.6 16 9l-.2 1.9z',
    headTexture: 'M8.6 18.3l.7.4.7-.4M22 18.3l.7.4.7-.4',
    body: 'M13.3 25.5q2.7.8 5.4 0l-.2 1-2.5.6-2.5-.6zM13.5 27.2q2.5.8 5 0l-.3 1-2.2.5-2.2-.5z',
    texture: 'M10 25.8l.8.5.8-.5m8.8 0 .8.5.8-.5',
  },
  hamster: {
    head: 'M8.7 20.4q1.1 1.9 3.8 1.9l-1.2 1-1.8-.8zM23.3 20.4q-1.1 1.9-3.8 1.9l1.2 1 1.8-.8z',
    light: 'M11.6 10.8q1.7-.9 3.2-.5l-1 1.1-1.8.2z',
    body: 'M15.1 26.9 16 26.3l.9.6-.2 1.1h-1.4z',
    texture: 'M15.9 26.8l.1.6m-2.5-.2.8.6m3.4 0 .8-.6',
  },
  sloth: {
    head: 'M9.1 21.1q1.3 1.9 3.7 1.6l-1 1-1.6-.4zM22.9 21.1q-1.3 1.9-3.7 1.6l1 1 1.6-.4z',
    light: 'M11.7 12.3q1.1-1 2.6-.6l-1 .9-1.4.3z',
    body: 'M13.4 26.4l2.6 1 2.6-1-.8 1.9-1.8.5-1.8-.5z',
    texture: 'M14.6 27.2l1.4.6 1.4-.6',
  },
  capy: {
    head: 'M10.2 20.9q1.5 1.7 3.4 1.3l-.7 1-1.6-.3zM21.8 20.9q-1.5 1.7-3.4 1.3l.7 1 1.6-.3z',
    light: 'M10.2 11.1q1.6-.8 3-.4l-.9.9-1.6.1z',
    headTexture: 'M7.8 15.1l.8.5m14.8-.5-.8.5M11.7 22l.9.3m6.8 0 .9-.3',
    body: 'M12.7 27q3.3 1 6.6 0l-.8 1.6-2.5.5-2.5-.5z',
    texture: 'M14 27.6l.9.4m2.2 0 .9-.4',
  },
  maple: {
    head: 'M7.4 19.5l2 1.2 1.3-.2-.9 1.6-1.6-.3zM24.6 19.5l-2 1.2-1.3-.2.9 1.6 1.6-.3z',
    light: 'M14.8 12.1l1.2-.7-.5 2.8-.6.8z',
    body: 'M13 26.4l2.6.8 2.6-.8-.8 1.8-1.8.6-1.8-.6z',
    texture: 'M14.4 27.3l1.2.5 1.2-.5',
  },
  ember: {
    head: 'M8.1 18.9l1 .8 1-.8-.2 1.3-.8.5-.8-.5zM23.9 18.9l-1 .8-1-.8.2 1.3.8.5.8-.5zM12.5 10.8l.8-.6.8.6-.8.6zM17.9 10.8l.8-.6.8.6-.8.6z',
    light: 'M15.3 10.8l.7-.5.6.5-.7.5z',
    headTexture: 'M11.5 12.1l.6.3.6-.3m6.6 0 .6.3.6-.3',
    body: 'M13.4 26.1q2.6.9 5.2 0l-.2 1-2.4.5-2.4-.5zM13.7 28q2.3.8 4.6 0l-.4.8-1.9.4-1.9-.4z',
    texture: 'M10.4 26.4l.7.5.7-.5m8.4 0 .7.5.7-.5',
  },
  mochi: {
    head: 'M9.8 21.9q1.3 1.7 3.3 1.4l-.9 1-1.5-.4zM22.2 21.9q-1.3 1.7-3.3 1.4l.9 1 1.5-.4z',
    light: 'M10.8 11q1.7-.8 3.5-.3l-1.1.9-1.8.2z',
    headTexture: 'M8.3 18l.6.4m14.2-.4.6.4M11.8 22.1h.1m8.2 0h.1',
    body: 'M13 27q3 .9 6 0l-.8 1.6-2.2.5-2.2-.5z',
    texture: 'M14.2 27.8l.8.3m2 0 .8-.3',
  },
  nimbus: {
    head: 'M8.9 20.8l1.5.8 1.1-.2-.8 1.2-1.4-.3zM23.1 20.8l-1.5.8-1.1-.2.8 1.2 1.4-.3z',
    light: 'M10.7 10.9q1.1-.8 2.6-.6l-.9 1-1.4.2z',
    headTexture: 'M10.8 12.1l1.2.3m8 0 1.2-.3',
    body: 'M13.3 24.1q2.7 1.4 5.4 0l-.3 1.2q-2.4 1.3-4.8 0zM13.8 26q2.2 1.1 4.4 0l-.5 1.2q-1.7 1-3.4 0z',
    texture: 'M14.3 25.1q1.7.6 3.4 0m-2.8 2q1.1.4 2.2 0',
  },
  sable: {
    head: 'M8 19.7l1.8 1.2 1.2-.2-.8 1.4-1.6-.4zM24 19.7l-1.8 1.2-1.2-.2.8 1.4 1.6-.4z',
    light: 'M12.1 11.3q1.4-.5 2.5-.2l-.8.8-1.5.1z',
    headTexture: 'M10.7 12.4l.8.4m3.9-1.4.6.5m4.5.5.8-.4',
    body: 'M13.1 26.5l2.4.7 2.4-.7-.7 1.8-1.7.5-1.7-.5z',
    texture: 'M14.3 27.4l1.2.4 1.2-.4',
  },
  inky: {
    head: 'M7.7 18.3q1.1-.6 1.4.4-.3 1.1-1.2.5zM23 19.2q1.1-.6 1.4.4-.3 1.1-1.2.5zM20.8 10.4q.8-.3 1.1.4-.5.8-1.1.2z',
    light: 'M10.6 11.5q1.6-1.3 3.4-.8l-1.2 1.1-1.8.4z',
    body: 'M7.3 27.6q1.1-.8 1.7 0-.2 1-1.3.8zM12 28.7q1.1-.8 1.7 0-.2 1-1.3.8zM24.7 27.6q-1.1-.8-1.7 0 .2 1 1.3.8zM20 28.7q-1.1-.8-1.7 0 .2 1 1.3.8z',
    texture: 'M7.8 27.9h.1m4.7 1.1h.1m10.9-1.1h.1m-4.9 1.1h.1',
  },
};

// Start points of each sub-shape: the cheek planes begin at the cheek edge and
// the chest plane at the top of the chest, so tufts can sit on real anatomy.
const starts = d => [...(d || '').matchAll(/M(-?[d.]+)[ ,](-?[d.]+)/g)].map(m => [Number(m[1]), Number(m[2])]);

// Portrait-only fur (styles/pet-finish.css shows .pet-lod at >= 96px): a
// three-hair tuft sweeping outward on each cheek, a small V of fluff on the chest.
function Tufts({ relief, head, ink }) {
  const pts = starts(head ? relief.head : relief.body);
  const d = head
    ? pts.filter(([x]) => x < 12.5 || x > 19.5).map(([x, y]) => {
      const s = x < 16 ? -1 : 1;
      return `M${x} ${y}l${s * .75} .3M${x + s * .1} ${y + .45}l${s * .7} .45M${x + s * .05} ${y + .9}l${s * .5} .5`;
    }).join('')
    : pts.slice(0, 1).map(([, y]) => `M15.1 ${y + .1}l.9.75.9-.75M15.6 ${y + .75}l.4.35.4-.35`).join('');
  return d ? <path className="pet-lod pet-lod-tuft" d={d} fill="none" stroke={ink} strokeWidth=".32" strokeLinecap="round" opacity=".7" /> : null;
}

export default function PetSurfaceRelief({ pet, layer, ink }) {
  const relief = RELIEF[pet];
  if (!relief) return null;
  const head = layer !== 'body';
  return <g data-surface-relief={pet} stroke="none">
    <path d={head ? relief.head : relief.body} fill={head ? '#fff3df' : ink} opacity={head ? '.42' : '.2'} />
    {/* The painted key light. At portrait size the finish filter lights the
        head instead, and this softens into a highlight that drifts with breath. */}
    {head && <path className="pet-relief-light" d={relief.light} fill="#fff9ec" opacity=".55" />}
    <Tufts relief={relief} head={head} ink={ink} />
    {(head ? relief.headTexture : relief.texture) && <path d={head ? relief.headTexture : relief.texture} fill="none" stroke={ink} strokeWidth=".4" opacity=".65" />}
  </g>;
}
