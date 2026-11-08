// Species collar charms. Each replaces a plain gold coin, at the same centre and
// size, so hats/neckwear anchoring and the accessory toggle are unchanged.
const SHAPES = {
  // Unit shapes centred on 0,0 with radius ~1; scaled by r.
  leaf: "M0-1.15C.85-.75 1-.05.55.6.3.95 0 1.05 0 1.05S-.3.95-.55.6C-1-.05-.85-.75 0-1.15Z",
  fish: "M-1.05 0C-.6-.65.25-.7.7-.05L1.15-.5V.5L.7.05C.25.7-.6.65-1.05 0Z",
  flower: "M0-.4a.42.42 0 1 1 .38.12.42.42 0 1 1-.14.62.42.42 0 1 1-.48 0 .42.42 0 1 1-.14-.62A.42.42 0 1 1 0-.4Z",
  shell: "M0-1C.75-1 1.1-.35 1.05.25L.45 1h-.9L-1.05.25C-1.1-.35-.75-1 0-1Z",
  star: "M0-1.15.33-.38 1.1-.36.5.13.72.92 0 .45-.72.92-.5.13-1.1-.36-.33-.38Z",
};
const DETAIL = {
  leaf: "M0-.85V.85",
  fish: "M-.55-.12h.02",
  flower: "",
  shell: "M0-.85V.8M-.45-.7-.25.8M.45-.7.25.8",
  star: "",
};

export default function PetCharm({ kind, cx, cy, r = 1.1, ink, fill = "#f6ca59", strokeWidth = .3 }) {
  const s = r * 1.05;
  return <g className="dg-pet-accessory pet-charm" data-charm={kind} transform={`translate(${cx} ${cy}) scale(${s})`}>
    <path d={SHAPES[kind]} fill={fill} stroke={ink} strokeWidth={strokeWidth / s} strokeLinejoin="round" />
    {DETAIL[kind] && <path d={DETAIL[kind]} fill="none" stroke="#b07a1e" strokeWidth={.22 / s * r} strokeLinecap="round" opacity=".8" />}
    {kind === "flower" && <circle r=".24" fill="#f08a3c" />}
    <ellipse cx="-.32" cy="-.42" rx=".26" ry=".14" fill="#fff" opacity=".75" transform="rotate(-30 -.32 -.42)" />
  </g>;
}
