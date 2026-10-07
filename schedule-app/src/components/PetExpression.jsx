// Alternate faces use each character's own eye and mouth coordinates. The
// original face stays the neutral pose; CSS selects the expression on its parent.
export default function PetExpression({ left = 12, right = 20, y = 16, mouthY = 22, ink = "#252333", digital = false, beak = false }) {
  const middle = (left + right) / 2;
  return (
    <g className="dg-pet-expression" fill="none" stroke={ink} strokeWidth=".85" strokeLinecap="round" strokeLinejoin="round">
      <g className="dg-pet-expression-joy">
        <path d={`M${left - 1.6} ${y + .4}q1.6-2.2 3.2 0M${right - 1.6} ${y + .4}q1.6-2.2 3.2 0`} />
      </g>
      <g className="dg-pet-expression-rest">
        <path d={`M${left - 1.6} ${y}q1.6 1.5 3.2 0M${right - 1.6} ${y}q1.6 1.5 3.2 0`} />
      </g>
      <g className="dg-pet-expression-surprise">
        <ellipse cx={left} cy={y} rx="1.65" ry="2.15" fill={digital ? ink : "#fffaf2"} />
        <ellipse cx={right} cy={y} rx="1.65" ry="2.15" fill={digital ? ink : "#fffaf2"} />
        {!digital && <><circle cx={left} cy={y} r=".75" fill={ink} /><circle cx={right} cy={y} r=".75" fill={ink} /></>}
      </g>
      {digital && <g className="dg-pet-expression-heart" fill="#f589b5" stroke="none">
        {[left, right].map(x => <path key={x} d={`M${x} ${y + 1.8}l-1.6-1.6c-1.5-1.5.6-3.1 1.6-1.5 1-1.6 3.1 0 1.6 1.5z`} />)}
      </g>}
      <g className="dg-pet-expression-brows">
        <path d={`M${left - 1.5} ${y - 3.2}l2.7.6M${right - 1.2} ${y - 2.6}l2.7-.6`} />
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
    <ellipse className="dg-pet-paw dg-pet-paw-left" cx="10.5" cy={y} rx="2.1" ry="2.6" />
    <ellipse className="dg-pet-paw dg-pet-paw-right" cx="21.5" cy={y} rx="2.1" ry="2.6" />
  </g>;
}
