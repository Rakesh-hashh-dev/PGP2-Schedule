// Eyes remain editable vectors. Only the pupils follow the pointer; the socket
// and upper lid stay attached to the face while the complete eye blinks.
export default function PetEyes({ left, right, y, rx = 2, ry = rx, ink = "#252333", iris = "#ae8060", sclera, angle = 0, digital = false, square = false }) {
  return <g className="dg-pet-eyes" data-part="eyes">
    {[left, right].map((x, index) => <g key={x} className={`dg-pet-eye dg-pet-eye-${index ? "right" : "left"}`} transform={angle ? `rotate(${index ? -angle : angle} ${x} ${y})` : undefined}>
      {square ? <rect x={x - rx} y={y - ry} width={rx * 2} height={ry * 2} rx={rx * .6} fill={iris} />
        : <ellipse cx={x} cy={y} rx={rx} ry={ry} fill={sclera || ink} stroke={digital ? iris : ink} strokeWidth={digital ? .3 : .25} />}
      {!square && <ellipse cx={x} cy={y + ry * .22} rx={rx * .76} ry={ry * .72} fill={iris} />}
      <g className="dg-pet-pupils" data-part="pupils">
        <ellipse cx={x} cy={y} rx={rx * (sclera ? .5 : .53)} ry={ry * .68} fill={ink} />
        <ellipse cx={x - rx * .28} cy={y - ry * .38} rx={rx * .23} ry={ry * .18} fill="#fffdf6" opacity={digital ? .8 : .96} />
        <circle cx={x + rx * .3} cy={y + ry * .4} r={rx * .1} fill="#fffdf6" opacity=".5" />
      </g>
      {!digital && <path className="dg-pet-eyelid" data-part="eyelids" d={`M${x - rx * .88} ${y - ry * .45}Q${x} ${y - ry * 1.25} ${x + rx * .88} ${y - ry * .45}`} fill="none" stroke={ink} strokeWidth=".38" strokeLinecap="round" />}
    </g>)}
  </g>;
}
