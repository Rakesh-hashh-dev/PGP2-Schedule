import { eyeContour, petFace } from '../lib/petFaces.js';

// Alternate faces use each character's own eye and mouth coordinates. The
// original face stays the neutral pose; CSS selects the expression on its parent.
export default function PetExpression({ pet, left = 12, right = 20, y = 16, rx = 2, ry = rx, mouthY = 22, ink = "#252333", digital = false, beak = false, onDark = false }) {
  const middle = (left + right) / 2;
  const lidInk = onDark ? "#f4edda" : ink;
  const face = petFace(pet);
  const width = rx * face.width * .85;
  const height = ry * face.height;
  const tilt = face.tilt;
  const curve = (x, rise) => `M${x - width} ${y + .25}q${width} ${rise} ${width * 2} 0`;
  return (
    <g className="dg-pet-expression" data-face-personality={pet} fill="none" stroke={ink} strokeWidth=".85" strokeLinecap="round" strokeLinejoin="round">
      <g className="dg-pet-expression-joy" stroke={lidInk} data-part="happy-eyelids">
        {[left, right].map((x, i) => <path key={x} d={curve(x, -height * (face.shape === 'cozy' ? .65 : 1))} transform={`rotate(${i ? -tilt : tilt} ${x} ${y})`} />)}
      </g>
      <g className="dg-pet-expression-rest" stroke={lidInk} data-part="sleeping-eyelids">
        {[left, right].map(x => <path key={x} d={curve(x, height * .55)} />)}
      </g>
      <g className="dg-pet-expression-surprise">
        {[left, right].map((x, i) => <g key={x} transform={`rotate(${i ? -tilt : tilt} ${x} ${y})`}>
          {digital ? <rect x={x - width} y={y - height} width={width * 2} height={height * 2} rx={width * .5} fill={ink} />
            : <path d={eyeContour(x, y, width, height, face.shape)} fill="#fffaf2" strokeWidth=".4" />}
          {!digital && <><ellipse cx={x} cy={y} rx={width * face.pupil * .8} ry={height * .63} fill={ink} /><ellipse cx={x - width * .2} cy={y - height * .3} rx={width * .2} ry={height * .15} fill="#fffdf6" stroke="none" /></>}
        </g>)}
      </g>
      {digital && <g className="dg-pet-expression-heart" fill="#f589b5" stroke="none">
        {[left, right].map(x => <path key={x} d={`M${x} ${y + 1.8}l-1.6-1.6c-1.5-1.5.6-3.1 1.6-1.5 1-1.6 3.1 0 1.6 1.5z`} />)}
      </g>}
      <g className="dg-pet-expression-brows">
        {[left, right].map((x, i) => <path key={x} d={`M${x - width * .8} ${y - height - .65 + (i ? -face.brow : face.brow)}q${width * .8} ${-.5 - Math.abs(face.brow)} ${width * 1.6} ${i ? face.brow : -face.brow}`} stroke={lidInk} strokeWidth=".55" />)}
      </g>
      {!beak && <>
        <path className="dg-pet-expression-smile" d={`M${middle - 2} ${mouthY}q2 2.2 4 0`} />
        <ellipse className="dg-pet-expression-yawn" cx={middle} cy={mouthY + .7} rx="1.35" ry="1.9" fill={ink} />
        <ellipse className="dg-pet-expression-oh" cx={middle} cy={mouthY + .5} rx=".9" ry="1.2" fill={ink} />
      </>}
    </g>
  );
}

export function PetGesture({ fur = "#aab2c5", y = 26, ink = "#252333" }) {
  return <g className="dg-pet-gesture" fill={fur} stroke={ink} strokeWidth=".85">
    <g className="dg-pet-paw dg-pet-paw-left" data-part="arm-left" style={{ "--pet-paw-x": "12px", "--pet-paw-y": `${y - 2}px` }}>
      <path d={`M12.3 ${y - 2}q-3.9-.8-3.8 2.1c0 3.7 4.7 3.7 4.3.1z`} />
      <path d={`M9.9 ${y + 1}v.8m1-.8v.8`} fill="none" strokeWidth=".4" strokeLinecap="round" />
    </g>
    <g className="dg-pet-paw dg-pet-paw-right" data-part="arm-right" style={{ "--pet-paw-x": "20px", "--pet-paw-y": `${y - 2}px` }}>
      <path d={`M19.7 ${y - 2}q3.9-.8 3.8 2.1c0 3.7-4.7 3.7-4.3.1z`} />
      <path d={`M21.1 ${y + 1}v.8m1-.8v.8`} fill="none" strokeWidth=".4" strokeLinecap="round" />
    </g>
  </g>;
}
