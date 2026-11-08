import { useId } from 'react';
import { eyeContour, eyeLash, petFace } from '../lib/petFaces.js';

const SCLERA = '#fffaf2';
const GLINT = '#fffdf6';

// One eye per species family (lib/petFaces.js). Layers, back to front:
//   socket fill → iris → pupil (tracks gaze) → fixed glints → moving lid line,
// all clipped to the socket, all inside a lid mask, then the lash line.
//
// Lids: `--pet-eye-open` below 1 slides `.dg-pet-lid` (the mask and its line)
// down over the eye, revealing the face art behind it — so a tired pet gets a
// lowered lid instead of a squashed eyeball, with round glints, and no per-pet
// fur colour is needed. Values above 1 still widen the eye (CSS scaleY).
// Pupils: `--pet-pupil` scales `.dg-pet-pupil`; slits widen ~3x faster.
export default function PetEyes({ pet, left, right, y, rx = 2, ry = rx, ink = '#252333', iris = '#ae8060', sclera, angle, digital = false, square = false }) {
  const id = 'eyes' + useId().replace(/\W/g, '');
  const face = petFace(pet);
  const width = rx * face.width;
  const height = ry * face.height;
  const tilt = angle ?? face.tilt;
  const display = digital || face.family === 'display' || face.shape === 'display';
  const family = display ? 'display' : face.family;
  return <g className="dg-pet-eyes" data-part="eyes" data-eye-personality={pet} data-eye-shape={face.shape} data-eye-family={family}>
    {[left, right].map((x, index) => {
      const clip = `${id}-${index}`;
      const lidClip = `${id}-lid-${index}`;
      const w = width, h = height;
      const inward = (index ? -1 : 1) * w * .07;
      const px = x + inward;
      const socket = square || display
        ? <rect x={x - w} y={y - h} width={w * 2} height={h * 2} rx={w * (square ? .55 : .8)} />
        : <path d={eyeContour(x, y, w, h, face.shape)} />;

      // Lid edge: a downward-bowed curve that starts just above the socket.
      // At rest the bow's lowest point sits above the lash stroke (y - 1.2h).
      const lidTop = y - h * 1.45, lidBow = h * .25, lidHalf = w * 1.3;
      const lidCurve = `M${x - lidHalf} ${lidTop}Q${x} ${lidTop + lidBow * 2} ${x + lidHalf} ${lidTop}`;
      const lidStyle = { '--lid-travel': `${(h * 1.6).toFixed(3)}px` };

      const base = display ? (sclera || ink)
        : family === 'puppy' ? (sclera || SCLERA)
        : family === 'patch' ? (sclera || '#fbf6ec')
        : ink;

      return <g key={index} className={`dg-pet-eye dg-pet-eye-${index ? 'right' : 'left'}`} transform={tilt ? `rotate(${index ? -tilt : tilt} ${x} ${y})` : undefined}>
        <defs>
          <clipPath id={clip} clipPathUnits="userSpaceOnUse">{socket}</clipPath>
          <clipPath id={lidClip} clipPathUnits="userSpaceOnUse">
            <path className="dg-pet-lid dg-pet-lidmask" data-lid-travel={(h * 1.6).toFixed(3)} style={lidStyle}
              d={`${lidCurve}V${y + h * 4}H${x - lidHalf}Z`} />
          </clipPath>
        </defs>
        <g clipPath={`url(#${lidClip})`}>
          <g fill={base} stroke={display ? iris : ink} strokeWidth=".3">{socket}</g>
          <g clipPath={`url(#${clip})`}>
            {display ? <DisplayEye x={x} y={y} w={w} h={h} iris={iris} ink={ink} pupil={face.pupil} />
              : <OrganicEye family={family} x={x} px={px} y={y} w={w} h={h} iris={iris} ink={ink} face={face} />}
            <path className="dg-pet-lid dg-pet-lidline" data-lid-travel={(h * 1.6).toFixed(3)} style={lidStyle}
              d={lidCurve} fill="none" stroke={ink} strokeWidth=".7" strokeLinecap="round" />
          </g>
          {!display && <path className="pet-lod pet-lod-lowerlid" d={`M${x - w * .62} ${y + h * 1.14}Q${x} ${y + h * 1.42} ${x + w * .62} ${y + h * 1.14}`}
            fill="none" stroke="#fffaf0" strokeWidth=".26" strokeLinecap="round" opacity=".7" />}
          {/* No lash on beads: ink on ink, only its end caps showed — as a frown at 40px. */}
          {!display && family !== 'bead' && <path className="dg-pet-lash" data-part="eyelids" d={eyeLash(x, y, w, h, face.shape)}
            fill="none" stroke={ink} strokeWidth=".62" strokeLinecap="round" />}
        </g>
      </g>;
    })}
  </g>;
}

function OrganicEye({ family, x, px, y, w, h, iris, ink, face }) {
  const bead = family === 'bead';
  // Iris footprint per family: full for slit/owl, lifted to show a white
  // sliver for puppy, inset inside a light ring for patch.
  const irisBox = {
    slit: [y + h * .06, w * .96, h * .98],
    owl: [y + h * .04, w * .94, h * .96],
    puppy: [y - h * .07, w * .93, h * .95],
    patch: [y - h * .04, w * .7, h * .74],
  }[family];
  return <>
    {irisBox && <>
      <ellipse cx={x} cy={irisBox[0]} rx={irisBox[1]} ry={irisBox[2]} fill={iris} />
      {/* Lid shadow across the top of the iris, warm bounce light below. */}
      <ellipse cx={x} cy={irisBox[0] - irisBox[2] * .95} rx={irisBox[1] * 1.15} ry={irisBox[2] * .55} fill={ink} opacity=".3" />
      <ellipse cx={x} cy={irisBox[0] + irisBox[2] * .62} rx={irisBox[1] * .72} ry={irisBox[2] * .24} fill="#ffe8bf" opacity=".34" />
    </>}
    {bead && <ellipse cx={x} cy={y + h * .62} rx={w * .7} ry={h * .28} fill={iris} opacity=".55" />}
    <g className="dg-pet-pupils" data-part="pupils">
      {family === 'slit'
        ? <path className="dg-pet-pupil" data-pupil="slit" fill={ink}
          d={`M${px} ${y - h * .84}Q${px + w * .36} ${y + h * .04} ${px} ${y + h * .9}Q${px - w * .36} ${y + h * .04} ${px} ${y - h * .84}Z`} />
        : !bead && <ellipse className="dg-pet-pupil" data-pupil="round" cx={px} cy={irisBox[0] - h * .02}
          rx={irisBox[1] * face.pupil * .68} ry={irisBox[2] * face.pupil * .72} fill={ink} />}
    </g>
    {/* Portrait-only iris texture: fine radial fibres, darker at the rim. */}
    {irisBox && <g className="pet-lod pet-lod-iris" stroke={ink} strokeWidth=".09" strokeLinecap="round" opacity=".32">
      <ellipse cx={x} cy={irisBox[0]} rx={irisBox[1] * .97} ry={irisBox[2] * .97} fill="none" strokeWidth=".16" />
      <path d={Array.from({ length: 10 }, (_, i) => {
        const a = (i / 10) * Math.PI * 2 + .3;
        const r0 = .58, r1 = .86;
        return `M${(x + Math.cos(a) * irisBox[1] * r0).toFixed(2)} ${(irisBox[0] + Math.sin(a) * irisBox[2] * r0).toFixed(2)}L${(x + Math.cos(a) * irisBox[1] * r1).toFixed(2)} ${(irisBox[0] + Math.sin(a) * irisBox[2] * r1).toFixed(2)}`;
      }).join('')} />
    </g>}
    {/* Glints stay put while pupils track: they belong to the light, not the gaze. */}
    <ellipse className="dg-pet-glint" cx={x - w * .32} cy={y - h * .36} rx={w * (bead ? .34 : .28)} ry={h * (bead ? .29 : .24)} fill={GLINT} />
    <ellipse className="dg-pet-glint-small" cx={x + w * .36} cy={y + h * .34} rx={w * .13} ry={h * .12} fill={GLINT} opacity=".85" />
    {face.sparkle === 'star' && <path className="dg-pet-glint-small" d={`M${x + w * .43} ${y - h * .5}v${h * .32}m${-w * .16} ${-h * .16}h${w * .32}`} stroke={GLINT} strokeWidth=".16" strokeLinecap="round" />}
  </>;
}

function DisplayEye({ x, y, w, h, iris, ink, pupil }) {
  return <>
    <ellipse cx={x} cy={y + h * .16} rx={w * .92} ry={h * .94} fill={iris} />
    <ellipse cx={x} cy={y + h * .63} rx={w * .72} ry={h * .23} fill="#b9fff1" opacity=".28" />
    <g className="dg-pet-pupils" data-part="pupils">
      <ellipse className="dg-pet-pupil" data-pupil="round" cx={x} cy={y - h * .03} rx={w * pupil} ry={h * .79} fill={ink} />
    </g>
    <rect x={x - w * .52} y={y - h * .58} width={w * .46} height={h * .33} rx=".08" fill="#e4fff9" />
    <path className="dg-pet-glint-small" d={`M${x + w * .2} ${y + h * .38}h${w * .3}`} stroke={iris} strokeWidth=".3" />
  </>;
}
