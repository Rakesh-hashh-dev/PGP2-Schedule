// Ground shadow in two layers: a tight, darker contact patch under the feet and
// a wide soft falloff. The group keeps the `dg-pet-ground` class, so the dark
// theme rule (pet-art.css) still recolours it; the finish CSS squashes it when
// the pet leaves the ground.
export default function PetGround({ cx = 16, cy = 30.25, rx = 7.3, ry = .85 }) {
  return <g className="dg-pet-ground" fill="#252333">
    <ellipse className="dg-pet-ground-soft" cx={cx} cy={cy} rx={rx * 1.15} ry={ry * 1.45} opacity=".07" />
    <ellipse className="dg-pet-ground-contact" cx={cx} cy={cy - .08} rx={rx * .74} ry={ry * .72} opacity=".19" />
  </g>;
}
