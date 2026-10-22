import { useId } from "react";
import CompanionArtwork from "./CompanionArtwork.jsx";
import PetEyes from "./PetEyes.jsx";
import PetExpression from "./PetExpression.jsx";
import PetGrowthDetail from "./PetGrowthDetail.jsx";
import PetDetail from "./PetDetail.jsx";
const HEAD = { "--pet-head-x": "16px", "--pet-head-y": "24px" };

export function Hamster() {
  return <CompanionArtwork pet="hamster" />;
}
export function Sloth() {
  return <CompanionArtwork pet="sloth" />;
}
export function Capy() {
  return <CompanionArtwork pet="capy" />;
}
export function Unicorn() {
  return <CompanionArtwork pet="unicorn" />;
}

// A jade guardian: swept horns, folded bat wings and a broad dragon muzzle.
// The stable dragon key and existing part classes preserve progression/behaviour.
export function Dragon() {
  const id = "dr" + useId().replace(/\W/g, "");
  const ink = "#173b35";
  const scale = `url(#${id}-scale)`;
  const gold = `url(#${id}-gold)`;
  return (
    <svg className="pet-art pet-rig" viewBox="0 0 32 32" aria-hidden="true">
      <defs>
        <radialGradient id={`${id}-scale`} cx="34%" cy="22%" r="88%">
          <stop offset="0" stopColor="#86d9b3" />
          <stop offset=".55" stopColor="#36a582" />
          <stop offset="1" stopColor="#236857" />
        </radialGradient>
        <linearGradient id={`${id}-gold`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff0bf" />
          <stop offset=".6" stopColor="#e5bb73" />
          <stop offset="1" stopColor="#b77e43" />
        </linearGradient>
        <radialGradient id={`${id}-aura`}>
          <stop offset="0" stopColor="#d8c18b" stopOpacity=".18" />
          <stop offset="1" stopColor="#d8c18b" stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse
        className="dg-pet-ground"
        cx="16"
        cy="30.25"
        rx="7.3"
        ry=".85"
        fill="#252333"
        opacity=".12"
      />
      <g className="dg-pet-canvas" transform="translate(1 .35) scale(.935)">
        <g
          className="dg-pet-body pet-rig-frame"
          data-part="body"
          data-pet-part="body"
        >
          <circle
            className="dg-pet-dragonaura"
            cx="16"
            cy="18"
            r="13.5"
            fill={`url(#${id}-aura)`}
          />
          <g
            className="dg-pet-tail pet-rig-tail"
            data-part="tail"
            data-pet-part="tail"
          >
            <path
              d="M21 28.2q8.8 3.7 8-3.8-.4-2.7-2.5-3.7"
              fill="none"
              stroke={ink}
              strokeWidth="3.7"
              strokeLinecap="round"
            />
            <path
              d="M21 28.2q8.8 3.7 8-3.8-.4-2.7-2.5-3.7"
              fill="none"
              stroke="#38997b"
              strokeWidth="2.1"
              strokeLinecap="round"
            />
            <path
              d="m26.5 22 1.1-3-3.4.6z"
              fill={gold}
              stroke={ink}
              strokeWidth=".65"
              strokeLinejoin="round"
            />
            <path
              className="pet-design-fine"
              d="m24.6 28.7.2-1.1m2.6-.2-.8-.8"
              stroke="#9bd4ad"
              strokeWidth=".55"
            />
          </g>
          <g
            className="dg-pet-wing dg-pet-wing-left pet-rig-wing-left"
            data-part="wing-left"
            data-pet-part="wing"
          >
            <path
              d="M11 26.5q-2.7-3.1-5.6-.7.4-3.7-2.6-3.6 1-4.3-.7-10 4.6 1.1 8.1 5.4z"
              fill="#327665"
              stroke={ink}
              strokeWidth="1"
              strokeLinejoin="round"
            />
            <path
              d="M9.6 24q-1.7-1.4-3.2-.5-.4-2.9-2.4-2.5.6-2.6-.9-7l2.5 1.3q3.3 2.8 4 8.7z"
              fill="#d5ba89"
            />
            <path
              d="m3.1 14 6.5 9.1M5.6 20.2l4 2.9"
              fill="none"
              stroke="#8b7759"
              strokeWidth=".55"
            />
          </g>
          <g
            className="dg-pet-wing dg-pet-wing-right pet-rig-wing-right"
            data-part="wing-right"
            data-pet-part="wing"
          >
            <path
              d="M21 26.5q2.7-3.1 5.6-.7-.4-3.7 2.6-3.6-1-4.3.7-10-4.6 1.1-8.1 5.4z"
              fill="#327665"
              stroke={ink}
              strokeWidth="1"
              strokeLinejoin="round"
            />
            <path
              d="M22.4 24q1.7-1.4 3.2-.5.4-2.9 2.4-2.5-.6-2.6.9-7l-2.5 1.3q-3.3 2.8-4 8.7z"
              fill="#d5ba89"
            />
            <path
              d="m28.9 14-6.5 9.1m4-2.9-4 2.9"
              fill="none"
              stroke="#8b7759"
              strokeWidth=".55"
            />
          </g>
          <path
            d="M10.8 20.8q5.2-2.7 10.4 0l1.9 6.3q-.5 3-7.1 3t-7.1-3z"
            fill={scale}
            stroke={ink}
            strokeWidth="1"
          />
          <path
            d="M12.4 23.1q3.6-1.4 7.2 0l-.5 5q-3.1 1.7-6.2 0z"
            fill={gold}
            stroke="#9b7748"
            strokeWidth=".45"
          />
          <path
            d="M12.7 25q3.3 1.1 6.6 0m-6.4 1.7q3.1 1 6.2 0"
            fill="none"
            stroke="#b28a53"
            strokeWidth=".55"
          />
          <g fill="#3c9577" stroke={ink} strokeWidth=".75">
            <path d="M9.9 27q3-1 3.6 1.7.3 1.6-2.8 1.6-3.3-.1-2.7-1.8z" />
            <path d="M22.1 27q-3-1-3.6 1.7-.3 1.6 2.8 1.6 3.3-.1 2.7-1.8z" />
          </g>
          <path
            d="m9 29.5.5-.8.5.8m1 0 .5-.8.5.8m8 0 .5-.8.5.8m1 0 .5-.8.5.8"
            fill="#f2e5c5"
            stroke={ink}
            strokeWidth=".25"
          />
          <g
            className="dg-pet-head pet-rig-head"
            data-part="head"
            data-pet-part="head"
            style={HEAD}
          >
            <g className="dg-pet-ear dg-pet-ear-left" data-part="ear-left">
              <path
                d="M11.2 9.4Q7.1 6.9 9.2 2.2q.1 3.6 3.4 4.7z"
                fill={gold}
                stroke={ink}
                strokeWidth=".9"
              />
              <path
                d="m9 5.7 1.8-.3m-1.2 1.5 1.8-.3"
                fill="none"
                stroke="#b78951"
                strokeWidth=".55"
              />
            </g>
            <g className="dg-pet-ear dg-pet-ear-right" data-part="ear-right">
              <path
                d="M20.8 9.4q4.1-2.5 2-7.2-.1 3.6-3.4 4.7z"
                fill={gold}
                stroke={ink}
                strokeWidth=".9"
              />
              <path
                d="m23 5.7-1.8-.3m1.2 1.5-1.8-.3"
                fill="none"
                stroke="#b78951"
                strokeWidth=".55"
              />
            </g>
            <path
              d="m8.3 12-4.9-1.7 1.1 6.2 3.1 1.1m16.1-5.6 4.9-1.7-1.1 6.2-3.1 1.1"
              fill="#5ab795"
              stroke={ink}
              strokeWidth=".8"
              strokeLinejoin="round"
            />
            <path
              className="dg-pet-face"
              d="M12 7.4h8q5.2.8 5.3 7l-.4 5.1Q23.6 25 16 25t-8.9-5.5l-.4-5.1q.1-6.2 5.3-7z"
              fill={scale}
              stroke={ink}
              strokeWidth="1.1"
              strokeLinejoin="round"
            />
            <path d="m16 8.5-2 3.1 2-.7 2 .7z" fill="#a6dab2" />
            <path
              d="M10.2 12.4q2-.8 4 .2m3.6 0q2-1 4-.2"
              fill="none"
              stroke="#257b60"
              strokeWidth="1.1"
              strokeLinecap="round"
            />
            <PetGrowthDetail pet="dragon" />
            <PetEyes
              left={12}
              right={20}
              y={15.9}
              rx={1.8}
              ry={2.05}
              ink={ink}
              iris="#e6b76b"
            />
            <path
              d="M11.5 18.4q4.5-1.4 9 0l1.4 2q.6 3.6-5.9 3.7-6.5-.1-5.9-3.7z"
              fill="#c0dcb4"
              stroke="#3c8067"
              strokeWidth=".55"
            />
            <g fill={ink}>
              <ellipse
                cx="13.3"
                cy="20.1"
                rx=".65"
                ry=".45"
                transform="rotate(-18 13.3 20.1)"
              />
              <ellipse
                cx="18.7"
                cy="20.1"
                rx=".65"
                ry=".45"
                transform="rotate(18 18.7 20.1)"
              />
            </g>
            <path
              className="dg-pet-mouth-base"
              d="M13.4 22.4q2.6 1.6 5.2 0"
              fill="none"
              stroke={ink}
              strokeWidth=".7"
              strokeLinecap="round"
            />
            <g fill="#edf1e3" stroke="#b1c4b3" strokeWidth=".3">
              <g className="dg-pet-breath" opacity="0">
                <circle cx="12" cy="20.4" r=".9" />
                <circle cx="10.6" cy="19.8" r="1.1" />
              </g>
              <g className="dg-pet-breath dg-pet-breath-b" opacity="0">
                <circle cx="20" cy="20.4" r=".9" />
                <circle cx="21.4" cy="19.8" r="1.1" />
              </g>
            </g>
            <PetExpression
              left={12}
              right={20}
              y={15.9}
              mouthY={22.4}
              ink={ink}
            />
            <PetDetail pet="dragon" />
          </g>
          <g className="dg-pet-accessory">
            <path
              d="M10.8 24.6q5.2 1.5 10.4 0l.2 1.1q-5.4 1.6-10.8 0z"
              fill="#b8874c"
              stroke={ink}
              strokeWidth=".5"
            />
            <path
              d="m16 25.5 1.1 1.3-1.1 1.4-1.1-1.4z"
              fill="#d78951"
              stroke={ink}
              strokeWidth=".4"
            />
          </g>
          <PetDetail pet="dragon" layer="body" />
        </g>
      </g>
    </svg>
  );
}
