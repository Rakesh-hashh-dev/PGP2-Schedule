import { useId } from "react";
import PetEyes from "./PetEyes.jsx";
import PetExpression, { PetGesture } from "./PetExpression.jsx";
import PetGrowthDetail from "./PetGrowthDetail.jsx";

// Anatomy is drawn per species. Shared primitives only provide paint and the
// existing head/wing/tail anchors; saved identities and behaviour stay separate.
const INK = "#302c39";
const CREAM = "#fff1d9";
const HEAD = { "--pet-head-x": "16px", "--pet-head-y": "24px" };
const PALETTES = {
  cat: ["#d0d0dd", "#9e9fb5", "#777c96"],
  fox: ["#ffbf79", "#e18445", "#b55a35"],
  dog: ["#f0ce9b", "#c79663", "#996b47"],
  bunny: ["#fffdfb", "#eee4ef", "#c9b9d3"],
  penguin: ["#58687c", "#354254", "#222b3b"],
  panda: ["#fffdf5", "#e7e7e3", "#c7cbd1"],
  chick: ["#fff2a7", "#f6cf60", "#dba438"],
  koala: ["#dce2e9", "#aebbc8", "#8393aa"],
  otter: ["#c79d77", "#a17452", "#72503d"],
  rover: ["#b1bfcd", "#657a90", "#3c4c64"],
  raccoon: ["#cbd1dc", "#9ba6b9", "#69788f"],
  axolotl: ["#ffe9ef", "#f2b7ce", "#d78aa9"],
  spark: ["#fff0a7", "#efc568", "#cc9144"],
  leafy: ["#bce6c2", "#6db99e", "#3d8e80"],
  cinder: ["#f6d698", "#dcb06e", "#b5854a"],
  hoot: ["#d6b596", "#a87e62", "#795647"],
  byte: ["#e5f5ea", "#acd6ca", "#79aaa4"],
  pebble: ["#d4dfa6", "#a7bd7f", "#788f64"],
  prickle: ["#eed4b2", "#bf9a77", "#967357"],
  frost: ["#e4f5fc", "#abcde3", "#7094b7"],
  unicorn: ["#fff8ff", "#e8dfef", "#bdb2d3"],
  hamster: ["#ffe0a2", "#e8b16f", "#c4894f"],
  sloth: ["#e0d2b7", "#b1a18a", "#86786a"],
  capy: ["#ddba86", "#bd925f", "#977143"],
  maple: ["#f0b078", "#c87d4d", "#944d36"],
  ember: ["#a8e5cc", "#62b9ae", "#397d8c"],
  mochi: ["#f0d6ae", "#d1ad7d", "#ac815a"],
  nimbus: ["#e9def6", "#bda6d6", "#8873af"],
  sable: ["#f0eeee", "#c4c5ce", "#9699ad"],
  inky: ["#c9b1e8", "#a587cd", "#7765a6"],
};
function Path({ d, fill = "none", stroke = INK, w = 0.85, ...props }) {
  return (
    <path
      d={d}
      fill={fill}
      stroke={stroke}
      strokeWidth={w}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    />
  );
}
function Oval({ x, y, rx, ry = rx, fill, stroke = INK, w = 0.75, ...props }) {
  return (
    <ellipse
      cx={x}
      cy={y}
      rx={rx}
      ry={ry}
      fill={fill}
      stroke={stroke}
      strokeWidth={w}
      {...props}
    />
  );
}
function Head({ children, x = 16, y = 24 }) {
  return (
    <g
      className="dg-pet-head pet-rig-head"
      data-part="head"
      data-pet-part="head"
      style={{ ...HEAD, "--pet-head-x": `${x}px`, "--pet-head-y": `${y}px` }}
    >
      {children}
    </g>
  );
}
function Ear({ right = false, children }) {
  return (
    <g
      className={`dg-pet-ear dg-pet-ear-${right ? "right" : "left"}`}
      data-part={`ear-${right ? "right" : "left"}`}
    >
      {children}
    </g>
  );
}
function Tail({ children }) {
  return (
    <g
      className="dg-pet-tail pet-rig-tail"
      data-part="tail"
      data-pet-part="tail"
    >
      {children}
    </g>
  );
}
function Wing({ right = false, children }) {
  return (
    <g
      className={`dg-pet-wing dg-pet-wing-${right ? "right" : "left"} pet-rig-wing-${right ? "right" : "left"}`}
      data-part={`wing-${right ? "right" : "left"}`}
      data-pet-part="wing"
    >
      {children}
    </g>
  );
}
function Face({ d, fill }) {
  return <Path className="dg-pet-face" d={d} fill={fill} w={0.95} />;
}
function RoundEars({
  fill,
  inner = "#d9a5a2",
  left = 8,
  right = 24,
  y = 8,
  r = 2.5,
}) {
  return (
    <>
      {[left, right].map((x, i) => (
        <Ear key={x} right={!!i}>
          <Oval x={x} y={y} rx={r} fill={fill} />
          <Oval x={x} y={y} rx={r * 0.54} fill={inner} stroke="none" />
        </Ear>
      ))}
    </>
  );
}
function Feet({
  fill,
  left = 11,
  right = 21,
  y = 29,
  rx = 2.5,
  ry = 1.35,
  toes = true,
}) {
  return (
    <g data-anatomy="feet">
      {[left, right].map((x) => (
        <g key={x}>
          <Oval x={x} y={y} rx={rx} ry={ry} fill={fill} />
          {toes && (
            <Path
              className="pet-design-fine"
              d={`M${x - 0.7} ${y}v.7m1.4-.7v.7`}
              stroke="#655466"
              w={0.4}
            />
          )}
        </g>
      ))}
    </g>
  );
}
function Torso({ fill, bib = CREAM, width = 6.2, top = 20, bottom = 29.8 }) {
  return (
    <g data-anatomy="torso">
      <Path
        d={`M${16 - width * 0.65} ${top}q${width * 0.65}-${width * 0.5} ${width * 1.3} 0l${width * 0.35} ${bottom - top - 2}q0 2-${width} 2t-${width}-2z`}
        fill={fill}
      />
      {bib && (
        <Oval
          x={16}
          y={(top + bottom) / 2 + 1}
          rx={width * 0.58}
          ry={(bottom - top) * 0.38}
          fill={bib}
          stroke="none"
        />
      )}
    </g>
  );
}
function Forelegs({ fill, y = 23, length = 5, spread = 5 }) {
  return (
    <g data-anatomy="forelegs">
      {[-1, 1].map((sign) => (
        <Path
          key={sign}
          d={`M${16 + sign * (spread - 1)} ${y}q${sign * 1.6} 1 ${sign * 1.7} ${length - 1}q${-sign * 0.4} 1.7 ${-sign * 2.7} .8l${sign * 0.1}-${length - 1}`}
          fill={fill}
          w={0.6}
        />
      ))}
    </g>
  );
}
function Scarf({ fill = "#7d9b8a" }) {
  return (
    <g className="dg-pet-accessory">
      <Path
        d="M10.3 23.3q5.7 1.7 11.4 0l.2 1.3q-5.9 1.8-11.8 0z"
        fill={fill}
        w={0.55}
      />
      <Path d="m19 25 2.5 3.1-2.3.3-1.7-3z" fill={fill} w={0.55} />
    </g>
  );
}
function Collar({ fill = "#a88964", gem = "#e8bd6e" }) {
  return (
    <g className="dg-pet-accessory">
      <Path d="M11 23.8q5 1.4 10 0" stroke={fill} w={1.35} />
      <Oval x={16} y={25} rx={0.9} fill={gem} w={0.4} />
    </g>
  );
}
function Features({
  pet,
  left = 12,
  right = 20,
  y = 14.9,
  rx = 1.7,
  ry = 1.95,
  iris = "#ad825a",
  mouth = 20.7,
  nose = true,
  digital = false,
  beak = false,
  onDark = false,
}) {
  const sig =
    pet === "axolotl"
      ? "axolotl-bubbles"
      : ["maple", "ember", "mochi", "nimbus", "sable", "inky"].includes(pet)
        ? "new-nose"
        : pet;
  return (
    <>
      <PetEyes
        left={left}
        right={right}
        y={y}
        rx={rx}
        ry={ry}
        iris={iris}
        ink={INK}
        digital={digital}
      />
      {nose && (
        <g
          className={[
            "dg-pet-sig",
            !["spark", "leafy", "cinder", "frost", "unicorn"].includes(pet) &&
              `dg-pet-sig-${sig}`,
          ]
            .filter(Boolean)
            .join(" ")}
        >
          <Path
            d={`M${(left + right) / 2 - 1} ${mouth - 2}q1-.6 2 0-.2 1.1-1 1.1t-1-1.1z`}
            fill={INK}
            stroke="none"
          />
        </g>
      )}
      {!beak && (
        <Path
          className="dg-pet-mouth-base"
          d={`M${(left + right) / 2 - 1.6} ${mouth}q1.6 1.3 3.2 0`}
          w={0.65}
        />
      )}
      <PetExpression
        left={left}
        right={right}
        y={y}
        mouthY={mouth}
        ink={INK}
        digital={digital}
        beak={beak}
        onDark={onDark}
      />
      <PetGrowthDetail pet={pet} />
    </>
  );
}
function Tabby() {
  return (
    <g stroke="#696d85" strokeWidth=".8" fill="none" strokeLinecap="round">
      <path d="m13.3 9.6 1 1.6m1.7-2 .1 2m1.6-1.6-1 1.6M7.6 16.9l2 .7m-1.2 1.1 1.4.4m14.6-2.2-2 .7m1.2 1.1-1.4.4" />
    </g>
  );
}
function Whiskers({ x = 16, y = 19, color = "#61586c", pet = "cat" }) {
  return (
    <g className={pet === "cat" ? "dg-pet-sig dg-pet-sig-cat" : undefined}>
      <Path
        d={`M${x - 5} ${y}l-4-.7m4 2-3.4 1M${x + 5} ${y}l4-.7m-4 2 3.4 1`}
        stroke={color}
        w={0.45}
      />
    </g>
  );
}

function CatArt({ coat }) {
  return (
    <>
      <Tail>
        <Path
          d="M21 27q9.5 3.8 7.4-3.8-1.2-3.1-3.6-1.7-1.5 1.2 1.4 2.4"
          fill="none"
          stroke={INK}
          w={3.6}
        />
        <Path
          d="M21 27q9.5 3.8 7.4-3.8-1.2-3.1-3.6-1.7-1.5 1.2 1.4 2.4"
          stroke="#999eb4"
          w={2.2}
        />
        <Path d="m25.6 28.1-.4-1.7m3-1.3-1.5.2" stroke="#646a83" w={0.8} />
      </Tail>
      <Torso fill={coat} bib="#e9e5e4" width={5.6} />
      <Feet fill={coat} left={10.8} right={21.2} />
      <Forelegs fill={coat} spread={3.7} y={22.2} length={6.2} />
      <Head>
        <Ear>
          <Path d="m7.5 12-2-9 7 5.4z" fill={coat} />
          <Path d="m7.7 8.7-.9-3.4 3.1 2.8z" fill="#d5a0af" stroke="none" />
        </Ear>
        <Ear right>
          <Path d="m24.5 12 2-9-7 5.4z" fill={coat} />
          <Path d="m24.3 8.7.9-3.4-3.1 2.8z" fill="#d5a0af" stroke="none" />
        </Ear>
        <Face
          d="M16 7.7q8.6 0 9 8.1l1.5 1.4-1.9.6 1 1.4-2.2.5Q21.5 23 16 23t-7.4-3.3l-2.2-.5 1-1.4-1.9-.6L7 15.8q.4-8.1 9-8.1z"
          fill={coat}
        />
        <Tabby />
        <Path
          d="M10.7 18.8q2-2 5.3-.9 3.3-1.1 5.3.9-.8 3.6-5.3 3.6t-5.3-3.6z"
          fill="#f3e9dc"
          stroke="none"
        />
        <Features pet="cat" iris="#cda257" y={14.8} mouth={20.5} />
        <Whiskers />
      </Head>
      <Collar fill="#8e7da2" />
    </>
  );
}
function FoxArt({ coat }) {
  return (
    <>
      <Tail>
        <Path
          d="M20 28q11.8 2.5 9.4-9.8-2.9 4.3-7.1 3.5-5.2.9-2.3 6.3z"
          fill={coat}
        />
        <Path
          d="M25.7 22.2q3.7-2.1 3.7-4-.1 6-2.3 8.2l-1-1.5-1.5.2.9-1.5-1-.7z"
          fill={CREAM}
          stroke="none"
        />
      </Tail>
      <Torso fill={coat} width={5.5} bib={null} />
      <Path
        d="M12.5 21.2q3.5-1 7 0l-1 4.3-1 .5-1.5 2-1.5-2-1-.5z"
        fill={CREAM}
        stroke="none"
      />
      <Feet fill="#66463f" />
      <Forelegs fill={coat} spread={3.6} length={5.6} />
      <Head>
        <Ear>
          <Path d="M7.5 12 5.3 2.5q6 1.4 7.2 6.3z" fill={coat} />
          <Path d="m8.3 8.6-1.4-4 3.8 3.8" fill="#6d473f" stroke="none" />
        </Ear>
        <Ear right>
          <Path d="m24.5 12 2.2-9.5q-6 1.4-7.2 6.3z" fill={coat} />
          <Path d="m23.7 8.6 1.4-4-3.8 3.8" fill="#6d473f" stroke="none" />
        </Ear>
        <Face
          d="M16 7.2q8.4 0 8.8 8.3l2 2-2.7.4Q21.5 22.7 16 23q-5.5-.3-8.1-5.1l-2.7-.4 2-2Q7.6 7.2 16 7.2z"
          fill={coat}
        />
        <Path
          d="M7.7 16.8q3.3.8 6.2 1.5l2.1-.4 2.1.4q2.9-.7 6.2-1.5-2.7 5.2-8.3 5.5-5.6-.3-8.3-5.5z"
          fill={CREAM}
          stroke="none"
        />
        <Path
          d="M10 12.1q1.7-1.2 3.2-.4m5.6 0q1.5-.8 3.2.4"
          stroke="#ffddb3"
          w={0.85}
        />
        <Features
          pet="fox"
          y={14.5}
          rx={1.6}
          ry={1.8}
          iris="#9d693d"
          mouth={20.5}
        />
      </Head>
      <Collar fill="#6d9f93" />
    </>
  );
}
function DogArt({ coat }) {
  return (
    <>
      <Tail>
        <Path d="M21 27q7.1.4 6.1-5.2-2.8 1.5-4.9 1.3" fill={coat} />
      </Tail>
      <Torso fill={coat} width={6.7} bib="#f7e5c8" />
      <Feet fill={coat} left={10} right={22} rx={2.8} />
      <Forelegs fill={coat} spread={4.2} length={5.7} />
      <Head>
        <Ear>
          <Path
            d="M10.7 8Q3.3 6.8 3.8 17.5q.6 6.3 5.2 3.8l2.7-8.5z"
            fill="#9b714f"
          />
          <Path d="M6.1 11q-1.2 5.4.8 8.3" stroke="#d7ab79" w={1.1} />
        </Ear>
        <Ear right>
          <Path
            d="M21.3 8q7.4-1.2 6.9 9.5-.6 6.3-5.2 3.8l-2.7-8.5z"
            fill="#9b714f"
          />
          <Path d="M25.9 11q1.2 5.4-.8 8.3" stroke="#d7ab79" w={1.1} />
        </Ear>
        <Face
          d="M16 6.8q8 0 8 7.9v3.2Q24 23 16 23t-8-5.1v-3.2q0-7.9 8-7.9z"
          fill={coat}
        />
        <Path
          d="M14.5 7.1q1.5-.4 3 0l-.4 5.2-1.1 1.4-1.1-1.4z"
          fill="#fff0d9"
          stroke="none"
        />
        <Oval x={16} y={19.1} rx={5.1} ry={3.2} fill="#f7e5c8" stroke="none" />
        <Features
          pet="dog"
          left={12.3}
          right={19.7}
          y={14.5}
          rx={1.65}
          iris="#9c7049"
          mouth={20.3}
        />
        <Path
          className="dg-pet-sig dg-pet-sig-dog dg-pet-mouth-base"
          d="M15.1 21q.9 2.3 1.8 0"
          fill="#d28c9c"
          stroke="#966a78"
          w={0.4}
        />
      </Head>
      <Collar fill="#698da5" />
    </>
  );
}
function BunnyArt({ coat }) {
  return (
    <>
      <Oval x={24.1} y={26} rx={2.7} fill="#fffdf9" />
      <Torso fill={coat} width={6.4} bib="#fffaf6" />
      <Feet fill={coat} left={10.4} right={21.6} rx={3.2} ry={1.6} />
      <Forelegs fill={coat} spread={3.8} length={5} />
      <Head>
        <Ear>
          <Path d="M10 11Q3.6 8.9 6.3 1.7q1.2-2 3.1.2L13 9z" fill={coat} />
          <Path
            d="M9.6 8.9Q6.3 5.5 7.7 2.8q1.4 1.5 2.7 5.8z"
            fill="#e6b3c6"
            stroke="none"
          />
        </Ear>
        <Ear right>
          <Path d="M20 10q-.4-8.6 3.3-8.5 3.4.6 2.1 5.8L23 12z" fill={coat} />
          <Path
            d="M21.8 9.1q.3-6.2 1.8-5.6 1.4 1-.5 5.9z"
            fill="#e6b3c6"
            stroke="none"
          />
        </Ear>
        <Face
          d="M16 9q8.7 0 9 6.8.6 7.3-9 7.3t-9-7.3Q7.3 9 16 9z"
          fill={coat}
        />
        <Oval x={16} y={20} rx={4.4} ry={2.3} fill="#fffaf7" stroke="none" />
        <Features
          pet="bunny"
          left={12.6}
          right={19.4}
          y={16}
          rx={1.65}
          ry={1.9}
          iris="#a389ac"
          mouth={21.1}
        />
        <Path d="M15.2 21.6v.8h1.6v-.8" fill="#fff" stroke="#a193ae" w={0.35} />
      </Head>
      <Collar fill="#ae91b9" />
    </>
  );
}
function PandaArt({ coat }) {
  return (
    <>
      <Torso fill="#414452" bib={coat} width={8} top={19.5} />
      <Feet fill="#414452" left={9.2} right={22.8} rx={3.3} ry={2} />
      <g fill="#8e8896">
        <ellipse cx="9.2" cy="29" rx="1.4" ry=".8" />
        <ellipse cx="22.8" cy="29" rx="1.4" ry=".8" />
      </g>
      <Path
        d="M10.5 21.8q-3 .2-3.1 4.4 1.8 1.5 4.1-.3m10-4.1q3 .2 3.1 4.4-1.8 1.5-4.1-.3"
        fill="#414452"
      />
      <Head>
        <RoundEars
          fill="#414452"
          inner="#626373"
          left={8}
          right={24}
          y={7.5}
          r={3}
        />
        <Face
          d="M16 6.8q9.7 0 9.6 8.8-.1 7.7-9.6 7.7t-9.6-7.7q-.1-8.8 9.6-8.8z"
          fill={coat}
        />
        <g fill="#505261">
          <ellipse
            cx="11.6"
            cy="15"
            rx="3.1"
            ry="3.5"
            transform="rotate(22 11.6 15)"
          />
          <ellipse
            cx="20.4"
            cy="15"
            rx="3.1"
            ry="3.5"
            transform="rotate(-22 20.4 15)"
          />
        </g>
        <Features
          pet="panda"
          left={11.7}
          right={20.3}
          y={15}
          rx={1.55}
          ry={1.8}
          iris="#aaa6a5"
          mouth={20.3}
        />
      </Head>
      <g className="dg-pet-accessory pet-native-prop dg-pet-sig dg-pet-sig-panda">
        <Path d="m24 28 3-9" stroke="#637f58" w={1.6} />
        <Path d="m25 25.3 1 .3m-.1-3.3 1 .3" stroke="#c9d5a3" w={0.6} />
        <Path
          d="M26 22q-1.5-3-3.6-2.2.3 2.6 3.6 2.2m.8-2.3q3.2-2.8 3.5-.6-1.1 1.6-3.5.6"
          fill="#86b772"
          w={0.5}
        />
      </g>
    </>
  );
}
function KoalaArt({ coat }) {
  return (
    <>
      <Torso fill={coat} bib="#f0ede6" width={6.8} top={20} />
      <Feet fill={coat} left={10.4} right={21.6} rx={2.9} ry={1.5} />
      <Forelegs fill={coat} spread={4.7} y={22} length={5} />
      <Head>
        <RoundEars
          fill={coat}
          inner="#eee8e5"
          left={6.2}
          right={25.8}
          y={10.4}
          r={4.6}
        />
        <g fill="#faf5ec">
          <path d="m3.4 9.5 1.1-1.8.2 1.1 1.2-1 .1 1.2-2.6 2zM28.6 9.5l-1.1-1.8-.2 1.1-1.2-1-.1 1.2 2.6 2z" />
        </g>
        <Face
          d="M16 7.6q8.2 0 8.4 7.9l1.2 1.6-1.6.6Q22.9 23 16 23t-8-5.3l-1.6-.6 1.2-1.6q.2-7.9 8.4-7.9z"
          fill={coat}
        />
        <Oval x={16} y={19.8} rx={5.2} ry={3.1} fill="#f1ede7" stroke="none" />
        <Features
          pet="koala"
          left={11.7}
          right={20.3}
          y={15.1}
          rx={1.45}
          ry={1.6}
          iris="#897e92"
          mouth={21.4}
          nose={false}
        />
        <Path
          className="dg-pet-sig dg-pet-sig-koala"
          d="M13.8 17.7q-.2-3.1 2.2-3.1t2.2 3.1q-.2 3.1-2.2 3.1t-2.2-3.1z"
          fill="#495260"
          w={0.5}
        />
        <Path d="m15 16.2.8-.4" stroke="#86909e" w={0.55} />
      </Head>
      <g className="dg-pet-accessory pet-native-prop">
        <Path d="m20.4 27.7 5-5.7" stroke="#6d826a" w={0.6} />
        <Path
          d="M23.5 24.2q-4.5-.8-2.5-2.5 2.2-.7 2.5 2.5m.5.8q4.7-1.8 4.5.7-1.6 1.7-4.5-.7"
          fill="#8caf8f"
          w={0.5}
        />
      </g>
    </>
  );
}
function OtterArt({ coat }) {
  return (
    <>
      <Tail>
        <Path
          d="M20.2 27.5q7.8 3.2 8.4-1.1.1-3-4.9-3.6 2.4 2.4.1 2.7"
          fill={coat}
        />
      </Tail>
      <Torso fill={coat} bib="#ead5b4" width={6.6} top={19.5} />
      <Feet fill={coat} left={10.6} right={21.4} rx={2.9} />
      <Head>
        <RoundEars
          fill={coat}
          inner="#e4c49e"
          left={8.2}
          right={23.8}
          y={9.5}
          r={2.5}
        />
        <Face
          d="M16 8q8.8 0 9 7.1.5 7.1-9 7.8-9.5-.7-9-7.8Q7.2 8 16 8z"
          fill={coat}
        />
        <Path
          d="M8.5 16.5q3-2.7 7.5-1.2 4.5-1.5 7.5 1.2-.3 5.7-7.5 5.7t-7.5-5.7z"
          fill="#efdbbd"
          stroke="none"
        />
        <Features
          pet="otter"
          left={12}
          right={20}
          y={14.8}
          rx={1.5}
          ry={1.65}
          iris="#9b775b"
          mouth={20}
        />
        <Whiskers y={18.8} color="#91775f" pet="otter" />
      </Head>
      <Oval x={16} y={26.2} rx={2.7} ry={2.1} fill="#a8b8b7" w={0.65} />
      <Path d="M14.8 25.5q.8-.7 1.7-.4" stroke="#e2e8dc" w={0.7} />
      <Path
        d="M10.4 23.6q1.4.1 3.7 2.7-1.6 2.3-3.9-.6m11.4-2.1q-1.4.1-3.7 2.7 1.6 2.3 3.9-.6"
        fill={coat}
      />
      <Collar fill="#977c68" />
    </>
  );
}
function RaccoonArt({ coat }) {
  return (
    <>
      <Tail>
        <Path d="M21 28q10 2.2 8.2-5.1-2.5-2.9-6.1-.8" fill={coat} />
        <Path d="m25.9 22-.4 6.5m3.1-4.6-1 3.6" stroke="#536173" w={1.4} />
      </Tail>
      <Torso fill={coat} bib="#e6e5df" width={6} />
      <Feet fill="#4d5565" />
      <Forelegs fill={coat} spread={4.4} />
      <Head>
        <Ear>
          <Path d="m7.5 12-1-8.6 6.1 5.7z" fill={coat} />
          <Path d="m8.5 9.1-.4-3 2.1 2.5z" fill="#535565" stroke="none" />
        </Ear>
        <Ear right>
          <Path d="m24.5 12 1-8.6-6.1 5.7z" fill={coat} />
          <Path d="m23.5 9.1.4-3-2.1 2.5z" fill="#535565" stroke="none" />
        </Ear>
        <Face
          d="M16 7.5q9.3 0 9.4 8.4l1.2 1.3-2.1.6.8 1.2-2 .4Q21.7 23 16 23t-7.3-3.6l-2-.4.8-1.2-2.1-.6 1.2-1.3q.1-8.4 9.4-8.4z"
          fill={coat}
        />
        <Path
          d="M7.8 13.1q4.1-2.3 8.2 1 4.1-3.3 8.2-1l-1.1 5.1-4.8-.7-2.3.9-2.3-.9-4.8.7z"
          fill="#495267"
          stroke="none"
        />
        <Path
          d="M11.2 19.1q1.4-2.3 4.8-2.2 3.4-.1 4.8 2.2-1.5 3.4-4.8 3.5-3.3-.1-4.8-3.5z"
          fill="#f1e7d9"
          stroke="none"
        />
        <Features
          pet="raccoon"
          y={14.9}
          rx={1.55}
          ry={1.7}
          iris="#aebccc"
          mouth={20.8}
        />
      </Head>
      <Collar fill="#b9816b" />
    </>
  );
}
function HamsterArt({ coat }) {
  return (
    <>
      <Torso fill={coat} bib="#fff0d4" width={7.3} top={20.6} />
      <Feet fill="#ddaaa0" left={10.6} right={21.4} rx={2.3} />
      <Head>
        <RoundEars
          fill={coat}
          inner="#d7a0a0"
          left={8.1}
          right={23.9}
          y={8}
          r={2.9}
        />
        <Face
          d="M16 7q8.6 0 8.6 7.5 3.7 2.7.7 6.3-3.4 3.1-9.3 2.6-5.9.5-9.3-2.6-3-3.6.7-6.3Q7.4 7 16 7z"
          fill={coat}
        />
        <Path d="M14.5 7.3h3l-.2 9-1.3 1-1.3-1z" fill="#fff3da" stroke="none" />
        <Oval
          x={10.3}
          y={19.7}
          rx={3.4}
          ry={2.9}
          fill="#ffe8bc"
          stroke="none"
        />
        <Oval
          x={21.7}
          y={19.7}
          rx={3.4}
          ry={2.9}
          fill="#ffe8bc"
          stroke="none"
        />
        <Features
          pet="hamster"
          y={14.9}
          rx={1.65}
          ry={1.85}
          iris="#9b6e50"
          mouth={20.7}
        />
        <Whiskers y={19.3} pet="hamster" color="#b68b6b" />
      </Head>
      <Path d="M11.7 24.5q1.4-1 2.8 1.2m5.8-1.2q-1.4-1-2.8 1.2" fill={coat} />
      <Path d="M14.4 25q1.6-2 3.2 0l-.7 3.3h-1.8z" fill="#b68c59" w={0.6} />
      <Path d="M16 24.5v3.1" stroke="#e9cd97" w={0.5} />
      <Collar fill="#a38ba4" />
    </>
  );
}
function SlothArt({ coat }) {
  return (
    <>
      <Torso fill={coat} bib="#ded1b9" width={6.2} top={20} />
      <Feet fill={coat} left={11} right={21} />
      <Path
        d="M10.7 21q-5.8.9-5.4 7.7 2.3 2.7 4.4-.4l1.5-5.1m10.1-2.2q5.8.9 5.4 7.7-2.3 2.7-4.4-.4l-1.5-5.1"
        fill={coat}
      />
      <Path
        d="m5.5 28 .2 1.9m1-1.7.2 1.8m1-1.9.3 1.6m15.6-1.7-.3 1.6m1.4-1.4-.2 1.8m1.4-1.8-.2 1.9"
        stroke="#f3e8d0"
        w={0.65}
      />
      <Head>
        <RoundEars
          fill={coat}
          inner="#9c8b78"
          left={8.5}
          right={23.5}
          y={10.2}
          r={2}
        />
        <Face
          d="M16 7.2q9.3 0 9.3 7.7 1.1 8.5-9.3 8.5t-9.3-8.5q0-7.7 9.3-7.7z"
          fill={coat}
        />
        <Path
          d="M16 10q-8-4.4-8.4 5.6.3 6.4 8.4 6.8 8.1-.4 8.4-6.8-.4-10-8.4-5.6z"
          fill="#eee1c9"
          stroke="none"
        />
        <Path
          d="m8.7 12.4 5.9 1.4-.9 3.7-5.5-.4zm14.6 0-5.9 1.4.9 3.7 5.5-.4z"
          fill="#766655"
          stroke="none"
        />
        <Features
          pet="sloth"
          left={12}
          right={20}
          y={15}
          rx={1.35}
          ry={1.45}
          iris="#8a7861"
          mouth={20.4}
        />
        <Path
          className="pet-design-fine"
          d="m11.5 9.9 1.5.4m5.8 0 1.5-.4M10.1 21.5l1.1.4m9.6 0 1.1-.4"
          stroke="#c7b99c"
          w={0.55}
        />
      </Head>
      <Scarf fill="#8caa86" />
    </>
  );
}
function CapyArt({ coat, mochi = false }) {
  const pet = mochi ? "mochi" : "capy";
  return (
    <>
      <Torso
        fill={coat}
        bib={mochi ? "#ebd0a6" : "#d6b27d"}
        width={mochi ? 7.6 : 8.3}
        top={19.6}
      />
      <Feet fill={coat} left={10} right={22} rx={2.9} />
      <Forelegs fill={coat} spread={4.6} y={22.6} length={5.3} />
      <Head>
        <RoundEars
          fill={coat}
          inner="#ae8467"
          left={8.6}
          right={23.4}
          y={9.6}
          r={2.1}
        />
        <Face
          d={
            mochi
              ? "M11.7 8.5h8.6q5.2 0 5.2 5.9v4q0 4.9-5.3 5h-8.4q-5.3-.1-5.3-5v-4q0-5.9 5.2-5.9z"
              : "M11.2 7.7h9.6q5.1.2 5.1 6.2v5.5q-.1 4.6-6.1 4.6h-7.6q-6 0-6.1-4.6v-5.5q0-6 5.1-6.2z"
          }
          fill={coat}
        />
        <Path
          d="M10 17.2q6-1.7 12 0l.8 4q-1.4 2-6.8 2t-6.8-2z"
          fill={mochi ? "#e5c397" : "#d8b17c"}
          stroke="none"
        />
        <Features
          pet={pet}
          left={11.5}
          right={20.5}
          y={14.5}
          rx={mochi ? 1.4 : 1.25}
          ry={mochi ? 1.55 : 1.3}
          iris="#967350"
          mouth={21.4}
          nose={false}
        />
        <g
          className={`dg-pet-sig dg-pet-sig-${mochi ? "new-nose" : "capy"}`}
          fill="#72543d"
        >
          <ellipse cx="13.5" cy="18.7" rx=".65" ry=".45" />
          <ellipse cx="18.5" cy="18.7" rx=".65" ry=".45" />
        </g>
        {mochi && (
          <g className="dg-pet-accessory pet-native-prop">
            <Path
              d="M15 9q-3.3-6 5.7-5.3Q21 8.9 15 9z"
              fill="#91aa71"
              w={0.6}
            />
            <Path d="m15.2 8.2 4.1-3.4" stroke="#657f54" w={0.4} />
          </g>
        )}
      </Head>
      {!mochi && (
        <g className="dg-pet-accessory pet-native-prop">
          <Oval x={26} y={28} rx={2.2} fill="#edbd62" w={0.6} />
          <Path
            d="M25.5 25.7q.8-2.3 3.1-1.2-1 2-3.1 1.2z"
            fill="#8da170"
            w={0.4}
          />
        </g>
      )}
    </>
  );
}
function PenguinArt({ coat }) {
  return (
    <>
      <Wing>
        <Path d="M9.8 15.5Q3.5 17 4.4 25q3.6-1.1 6.9-5.6z" fill={coat} />
        <Path d="M6 21.8q1.5-2.4 3-3.3" stroke="#7d91a6" w={0.6} />
      </Wing>
      <Wing right>
        <Path d="M22.2 15.5q6.3 1.5 5.4 9.5-3.6-1.1-6.9-5.6z" fill={coat} />
        <Path d="M26 21.8q-1.5-2.4-3-3.3" stroke="#7d91a6" w={0.6} />
      </Wing>
      <Path
        d="M9.2 17.8q6.8-3.5 13.6 0l1.1 7.5q0 4.6-7.9 4.6t-7.9-4.6z"
        fill={coat}
      />
      <Oval x={16} y={24} rx={5.6} ry={5} fill="#f8efdb" stroke="none" />
      <g className="dg-pet-sig dg-pet-sig-penguin">
        <Feet
          fill="#d99b5e"
          left={11}
          right={21}
          rx={3.2}
          y={29.4}
          toes={false}
        />
      </g>
      <Head>
        <Face
          d="M16 6.4q8.3 0 8.3 8.8.4 7.1-8.3 7.1t-8.3-7.1q0-8.8 8.3-8.8z"
          fill={coat}
        />
        <Path
          d="M16 12q-5.6-6.8-6.9 3-.9 5.5 6.9 6.6 7.8-1.1 6.9-6.6-1.3-9.8-6.9-3z"
          fill="#fff2dc"
          stroke="none"
        />
        <Features
          pet="penguin"
          left={12.1}
          right={19.9}
          y={14.7}
          rx={1.5}
          ry={1.75}
          iris="#7f9aaf"
          beak
          nose={false}
        />
        <Path
          className="dg-pet-beak"
          d="M13.7 18.1q2.3-1.3 4.6 0L16 20z"
          fill="#dca465"
          w={0.55}
        />
      </Head>
      <Scarf fill="#8ba5b8" />
    </>
  );
}
function ChickArt({ coat }) {
  return (
    <>
      <g className="dg-pet-sig dg-pet-sig-chick">
        <Path
          d="M12 26v3.3m8-3.3v3.3M9.5 29.6l2.5-.3 2 .4m3.5-.1 2.5-.3 2 .4"
          stroke="#bf8d46"
          w={1}
        />
      </g>
      <Path
        d="M16 14.2q8 0 8.3 8.1.8 5.7-8.3 5.7t-8.3-5.7q.3-8.1 8.3-8.1z"
        fill={coat}
      />
      <Oval x={16} y={23.6} rx={4.9} ry={3.6} fill="#fff0b2" stroke="none" />
      <Wing>
        <Path
          d="M9.1 19q-4.2.5-4 4.8l1.3-.6.7 1.5 1.3-.8 1 1 1.7-4.1z"
          fill={coat}
          w={0.7}
        />
      </Wing>
      <Wing right>
        <Path
          d="M22.9 19q4.2.5 4 4.8l-1.3-.6-.7 1.5-1.3-.8-1 1-1.7-4.1z"
          fill={coat}
          w={0.7}
        />
      </Wing>
      <Head>
        <Path
          className="dg-pet-tuft"
          d="M12.8 8q-1.9-4.4.7-5 .9 0 1.6 2.3 1-4 3.1-2.6.9 1.3-1.1 4.5z"
          fill={coat}
          w={0.7}
        />
        <Face
          d="M16 7q8.5 0 8.5 7.8 0 7.4-8.5 7.4t-8.5-7.4Q7.5 7 16 7z"
          fill={coat}
        />
        <Features
          pet="chick"
          left={12.2}
          right={19.8}
          y={14.3}
          rx={1.6}
          ry={1.85}
          iris="#aa8043"
          beak
          nose={false}
        />
        <Path
          className="dg-pet-beak"
          d="M13.8 17.6q2.2-1.6 4.4 0-1.3 2.8-2.2 2.8t-2.2-2.8z"
          fill="#d89a50"
          w={0.6}
        />
        <Path d="M14.2 18.2h3.6" stroke="#a87540" w={0.4} />
      </Head>
      <g className="dg-pet-accessory">
        <Path d="m16 23.3-3.4-1.3v2.8L16 24l3.4.8V22z" fill="#b77675" w={0.5} />
        <Oval x={16} y={23.5} rx={0.7} fill="#dcb1a0" w={0.4} />
      </g>
    </>
  );
}
function HootArt({ coat }) {
  return (
    <>
      <Path d="M10 26.5v3m12-3v3m-14 0h4m8 0h4" stroke="#c49a61" w={1.2} />
      <Path
        d="M16 14.7q10.5 0 9.5 9.1-.6 5.7-9.5 5.7t-9.5-5.7q-1-9.1 9.5-9.1z"
        fill={coat}
      />
      <Path
        d="M11 21q5-1.8 10 0l-.2 5.3q-4.8 3.8-9.6 0z"
        fill="#e2cbab"
        stroke="none"
      />
      <g
        className="pet-design-fine"
        stroke="#b19473"
        strokeWidth=".65"
        fill="none"
      >
        <path d="m12 23 1.2 1 1.2-1m3.2 0 1.2 1 1.2-1m-6.4 2 1.2 1 1.2-1m.8 0 1.2 1 1.2-1" />
      </g>
      <Wing>
        <Path
          d="M8.9 17.9q-6.4.7-4.8 7.5l2.6 2 1.6-1.7.9-4.9z"
          fill="#936c56"
        />
        <Path d="m5.8 22 .8 2.5m.8-4 .9 2.5" stroke="#bc9775" w={0.55} />
      </Wing>
      <Wing right>
        <Path
          d="M23.1 17.9q6.4.7 4.8 7.5l-2.6 2-1.6-1.7-.9-4.9z"
          fill="#936c56"
        />
        <Path d="m26.2 22-.8 2.5m-.8-4-.9 2.5" stroke="#bc9775" w={0.55} />
      </Wing>
      <Head>
        <Face
          d="m7 11-1-6.4 5.1 2.2q4.9-2 9.8 0L26 4.6 25 11q3.7 9.6-9 11.8Q3.3 20.6 7 11z"
          fill={coat}
        />
        <Path
          d="M16 12q-5.5-6.2-8.1.3-1.9 6.5 8.1 9 10-2.5 8.1-9.1-2.6-6.4-8.1-.2z"
          fill="#f2e2c7"
          stroke="none"
        />
        <Features
          pet="hoot"
          left={11.7}
          right={20.3}
          y={14.4}
          rx={1.5}
          ry={1.75}
          iris="#c19c63"
          beak
          nose={false}
        />
        <Path
          className="dg-pet-beak"
          d="m16 17.1-1.5 1.1 1.5 2.4 1.5-2.4z"
          fill="#cc9b56"
          w={0.5}
        />
        <g className="dg-pet-sig dg-pet-sig-hoot dg-pet-glasses">
          <Oval x={11.7} y={14.4} rx={3.35} fill="none" w={0.65} />
          <Oval x={20.3} y={14.4} rx={3.35} fill="none" w={0.65} />
          <Path d="M15.1 14h1.8m-8.5-.4-2-1m17.2 1 2-1" w={0.55} />
        </g>
      </Head>
      <Scarf fill="#7c9790" />
    </>
  );
}
function RobotArt({ coat, rover = false }) {
  const pet = rover ? "rover" : "byte";
  return (
    <>
      {rover ? (
        <>
          <g fill="#465266" stroke={INK} strokeWidth=".85">
            <rect x="5.2" y="23.6" width="6.3" height="6.3" rx="2.4" />
            <rect x="20.5" y="23.6" width="6.3" height="6.3" rx="2.4" />
          </g>
          <Path d="M9 22h14l1.3 4.9Q24 29 16 29t-8.3-2.1z" fill={coat} />
          <Path d="M13.1 25.1h5.8v1.8h-5.8z" fill="#34465b" w={0.5} />
          <Path
            d="M6.7 26h3.3m-3.3 1.8h3.3M22 26h3.3m-3.3 1.8h3.3"
            stroke="#8d9aad"
            w={0.6}
          />
        </>
      ) : (
        <>
          <Torso fill={coat} bib={null} top={21.2} width={5.1} />
          <Path d="M12.7 25h6.6v3h-6.6z" fill="#edf3e9" w={0.5} />
          <Oval x={16} y={26.5} rx={1.1} fill="#d9b776" w={0.45} />
          <Feet fill="#7eaaa4" left={12} right={20} rx={2.2} />
          <Path d="M10.6 23.2 6 25.6m15.4-2.4 4.6 2.4" stroke={INK} w={1.8} />
          <Oval x={5.8} y={25.8} rx={1.65} fill={coat} />
          <Oval x={26.2} y={25.8} rx={1.65} fill={coat} />
        </>
      )}
      <Head>
        <Ear>
          <Path
            d={rover ? "M6 12H3.7v6H6z" : "M7 12H4.7v5H7z"}
            fill={rover ? "#8b9bad" : "#7faaa4"}
            w={0.6}
          />
        </Ear>
        <Ear right>
          <Path
            d={rover ? "M26 12h2.3v6H26z" : "M25 12h2.3v5H25z"}
            fill={rover ? "#8b9bad" : "#7faaa4"}
            w={0.6}
          />
        </Ear>
        <Path d={rover ? "M16 6V3.3" : "M16 6.8V3.4"} stroke={INK} w={1.2} />
        <Oval x={16} y={3} rx={1.1} fill="#deb77a" w={0.6} />
        <Face
          d={
            rover
              ? "M9 7h14q3 0 3 3v9q0 3-3 3H9q-3 0-3-3v-9q0-3 3-3z"
              : "M10 7h12q3.5 0 3.5 3.5v7.8q0 4.4-9.5 4.4t-9.5-4.4v-7.8Q6.5 7 10 7z"
          }
          fill={coat}
        />
        <Path
          d={
            rover
              ? "M9.5 10.3h13q1.5 0 1.5 1.5V18q0 1.5-1.5 1.5h-13Q8 19.5 8 18v-6.2q0-1.5 1.5-1.5z"
              : "M10.2 10.5h11.6q2.1 0 2.1 2v4.3q-.2 3.3-7.9 3.3t-7.9-3.3v-4.3q0-2 2.1-2z"
          }
          fill={rover ? "#29394d" : "#315e61"}
          stroke="none"
        />
        <Features
          pet={pet}
          left={12}
          right={20}
          y={14.5}
          rx={rover ? 1.7 : 1.4}
          ry={rover ? 1.7 : 1.9}
          iris={rover ? "#8bcbd2" : "#a6e7d1"}
          mouth={18.3}
          digital
          nose={false}
          onDark
        />
        <g className={`dg-pet-sig dg-pet-sig-${pet}`}>
          <Oval
            x={rover ? 23.4 : 22.7}
            y={rover ? 8.6 : 8.7}
            rx={0.45}
            fill="#e8bd72"
            stroke="none"
          />
        </g>
        <Path d="M10 8.6h4.1" stroke="#f3f7ef" w={0.6} />
      </Head>
      {!rover && (
        <g className="dg-pet-accessory">
          <Path d="M12.5 23.2h7" stroke="#b88d55" w={0.8} />
        </g>
      )}
    </>
  );
}
function PebbleArt({ coat }) {
  return (
    <>
      <Tail>
        <Path d="m5.2 25.9-3.5 1.5 1.2-3.1z" fill={coat} />
      </Tail>
      <Feet fill={coat} left={7.2} right={18.2} rx={2.6} y={29} ry={1.3} />
      <Path
        d="M3.8 25.8Q4.4 12 13 11.8q9.4 0 10.4 14z"
        fill="#758e65"
        w={0.95}
      />
      <Path d="m13 12 3.4 4.6-1.7 5.6H8.2l-1.7-5.6z" fill="#aac089" w={0.65} />
      <Path
        d="m16.4 16.6 4.6 2.1 2.4 7.1-8.7-3.6m-8.2-5.6-2.3 2.1M8.2 22.2l-4.4 3.6"
        w={0.65}
      />
      <Path d="M3.7 25.8h19.7l-.7 2.1H4.3z" fill="#c5c894" w={0.65} />
      <Head x={20} y={26}>
        <Ear>
          <Path d="m20.2 17-1.9-1.1.8 3.1" fill={coat} w={0.5} />
        </Ear>
        <Ear right>
          <Path d="m27.7 16.6 1.6-.9-.7 2.9" fill={coat} w={0.5} />
        </Ear>
        <Face
          d="M23.5 13.1q6 0 6 6.5.1 6.7-6 6.7t-5.7-6.7q0-6.5 5.7-6.5z"
          fill={coat}
        />
        <Oval x={23.5} y={23.2} rx={4} ry={2.3} fill="#dfe1b4" stroke="none" />
        <Features
          pet="pebble"
          left={21}
          right={26.1}
          y={19.4}
          rx={1.1}
          ry={1.35}
          iris="#839258"
          mouth={23.3}
          nose={false}
        />
        <Path
          className="dg-pet-sig dg-pet-sig-pebble"
          d="m22.5 16 .8-.6.8.6"
          stroke="#94ad75"
          w={0.6}
        />
      </Head>
      <g className="dg-pet-accessory">
        <Path d="M20.8 26.7q2.7 1 5.4 0" stroke="#a87966" w={1.1} />
      </g>
    </>
  );
}
function PrickleArt({ coat }) {
  return (
    <>
      <Path
        d="m7 28-3.4-2.3 1.3-2.6-2.1-2.7 2.4-2.2-1-3 2.6-1.5.1-3.1 3.1-.4 1.3-2.7 2.8 1 2.5-1.9 2.4 1.9 3-.5 1.2 3 2.9.8-.3 3.1 2.1 2-.9 2.9 1.2 2.4-2 2.1-.5 3.1-3.1 1.4z"
        fill="#8d735f"
        w={0.95}
      />
      <g
        className="pet-design-fine"
        stroke="#c2a286"
        strokeWidth=".9"
        fill="none"
        strokeLinecap="round"
      >
        <path d="m8.5 15-1-1.4m4.7-2.1-.3-1.2m5.2.9.7-1.1m5.9 5.1 1.1-1M6.5 20l1.5.4m-1 4.2 1.5-.4m15.2-1.7 1.1.6" />
      </g>
      <Torso fill={coat} bib="#f6e3c7" width={5.8} top={21.3} />
      <Feet fill={coat} left={12} right={21.7} rx={2.3} />
      <Head x={18} y={24}>
        <RoundEars
          fill={coat}
          inner="#bf9d87"
          left={11.2}
          right={24}
          y={12.2}
          r={2}
        />
        <Face
          d="M18.3 10q7.7.3 7.5 8.5l1.2 2.6-2.5.5Q22.7 25 17 24.5q-6.8-.7-6.8-7.5 0-7.3 8.1-7z"
          fill="#efd8b6"
        />
        <Oval
          x={21.7}
          y={21.1}
          rx={3.8}
          ry={2.3}
          fill="#f8ead2"
          stroke="none"
        />
        <Features
          pet="prickle"
          left={15}
          right={22.2}
          y={16.6}
          rx={1.3}
          ry={1.5}
          iris="#9c7658"
          mouth={22.2}
        />
      </Head>
      <Path d="M13 25q1.6-1.5 3.8.8m6.4-.4q-1.4-1.1-3.5.6" fill={coat} />
      <Collar fill="#88a09a" />
    </>
  );
}
function AxolotlArt({ coat }) {
  return (
    <>
      <Tail>
        <Path
          d="M21.8 26.5q8.5 2.4 7-3.8-1-3.3-4.2-2.7 2.4 1.4 1 3.6l-3 .1z"
          fill="#d995b2"
        />
        <Path d="M23.4 26q4.1-.1 4.2-2.5" stroke="#f2c2d5" w={0.55} />
      </Tail>
      <Torso fill={coat} bib="#fbdde5" width={5.8} top={20} />
      <Feet fill={coat} left={10.5} right={21.5} rx={2.3} />
      <Forelegs fill={coat} spread={4.5} length={4.7} />
      <Head>
        {[false, true].map((right) => (
          <Ear key={String(right)} right={right}>
            <g transform={right ? "translate(32 0) scale(-1 1)" : undefined}>
              <g
                className="dg-pet-sig dg-pet-sig-axolotl-gill"
                strokeLinecap="round"
              >
                <Path
                  d="M8.7 13q-4.6-2.5-4.4-7M7.5 16.3q-4.5-.5-5.3-3.5M8.4 19.3q-3.3 2-6 1.3"
                  stroke="#ae5f84"
                  w={2.4}
                />
                <Path
                  d="M8.7 13q-4.6-2.5-4.4-7M7.5 16.3q-4.5-.5-5.3-3.5M8.4 19.3q-3.3 2-6 1.3m3.3-10.1-2-.4m1.3-1.6 1.2-.8M4.3 15l-1.5.3m3.2 4.9-.4 1.7"
                  stroke="#e392b2"
                  w={1.1}
                />
              </g>
            </g>
          </Ear>
        ))}
        <Face
          d="M16 9q8.8 0 9 6.7.7 7.3-9 7.3t-9-7.3Q7.2 9 16 9z"
          fill={coat}
        />
        <Oval x={16} y={20.2} rx={5.7} ry={2.5} fill="#ffdde8" stroke="none" />
        <g fill="#dc9eb7">
          <circle cx="13" cy="11.9" r=".35" />
          <circle cx="16" cy="11.2" r=".45" />
          <circle cx="19" cy="11.9" r=".35" />
        </g>
        <Features
          pet="axolotl"
          y={15.5}
          rx={1.3}
          ry={1.45}
          iris="#b67899"
          mouth={20.7}
          nose={false}
        />
        <Oval x={9.6} y={18.7} rx={1.1} ry={0.5} fill="#eaa4be" stroke="none" />
        <Oval
          x={22.4}
          y={18.7}
          rx={1.1}
          ry={0.5}
          fill="#eaa4be"
          stroke="none"
        />
      </Head>
      <g
        className="dg-pet-accessory pet-native-prop dg-pet-sig dg-pet-sig-axolotl-bubbles"
        stroke="#c59cb4"
        fill="none"
      >
        <circle cx="27.2" cy="6.4" r=".8" />
        <circle cx="29" cy="9" r=".4" />
      </g>
    </>
  );
}
function FrostArt({ coat }) {
  return (
    <>
      <Tail>
        <Path
          d="M21.7 28q10 1.9 7-7.9-2.1-2.8-4.4-1 3.4.5 1.4 3.8l-4 1.1z"
          fill={coat}
        />
        <Path
          d="M27.8 22.3q-.2-2.5-2.8-3.2 3.4.5 1.4 3.8z"
          fill="#f8fcfa"
          stroke="none"
        />
      </Tail>
      <Torso fill={coat} bib="#f6f9f3" width={6.3} />
      <Feet fill="#f5f6ef" left={10.5} right={21.5} rx={2.7} />
      <Forelegs fill={coat} spread={4.2} y={22} length={6.3} />
      <Head>
        <Ear>
          <Path d="M8.2 12 6.6 2.7q4.4 1.6 6.1 6.5z" fill="#587595" />
          <Path d="m9 9-.9-3.9L11 8.5z" fill="#cfdee8" stroke="none" />
        </Ear>
        <Ear right>
          <Path d="m23.8 12 1.6-9.3q-4.4 1.6-6.1 6.5z" fill="#587595" />
          <Path d="m23 9 .9-3.9L21 8.5z" fill="#cfdee8" stroke="none" />
        </Ear>
        <Face
          d="M16 7q8.2 0 8.7 8.5l1.7 1.7-2.1.7.9 1.1-2.2.5Q20.9 23 16 23t-7-3.5L6.8 19l.9-1.1-2.1-.7 1.7-1.7Q7.8 7 16 7z"
          fill={coat}
        />
        <Path
          d="M16 8.2q-1.2 4.9-3.6 4.5-3.4-3.4-4.4 2.6 2.1 2.5 4.6 2.5-2.7 3.7 3.4 4.6 6.1-.9 3.4-4.6 2.5 0 4.6-2.5-1-6-4.4-2.6-2.4.4-3.6-4.5z"
          fill="#f4f8f1"
          stroke="none"
        />
        <Features
          pet="frost"
          y={14.8}
          rx={1.6}
          ry={1.85}
          iris="#6f9ebd"
          mouth={20.5}
        />
        <Whiskers y={19.3} pet="frost" color="#9db5c5" />
      </Head>
      <Collar fill="#6f91ab" gem="#dcece9" />
    </>
  );
}
function LionArt({ coat }) {
  return (
    <>
      <Tail>
        <Path d="M22 27q7.8 1.9 5.3-4.4" stroke={INK} w={2.6} />
        <Path d="M22 27q7.8 1.9 5.3-4.4" stroke="#d8a35d" w={1.4} />
        <Path d="M27.3 24q-3.1-2 .1-4 3.2 2 .4 4.3z" fill="#a47147" w={0.65} />
      </Tail>
      <Torso fill={coat} bib="#f4d7a6" width={6.4} />
      <Feet fill={coat} left={10.3} right={21.7} rx={2.8} />
      <Forelegs fill={coat} spread={3.9} length={5.8} />
      <Head>
        <Path
          d="M16 5.3q2-2.2 4.1.2 3.7-.5 4.7 2.5 3.6.9 3.3 4.4 2.2 3.2-.3 5.7.7 3.2-2.5 4.7-1.1 3.3-4.7 2.9-2 2.6-4.6.6-2.6 2-4.6-.6-3.6.4-4.7-2.9-3.2-1.5-2.5-4.7-2.5-2.5-.3-5.7-.3-3.5 3.3-4.4 1-3 4.7-2.5 2.1-2.4 4.1-.2z"
          fill="#ac784a"
          w={0.95}
        />
        <Path
          d="M16 7.1q9-2.6 10 8.3-.4 8.4-10 9.5-9.6-1.1-10-9.5 1-10.9 10-8.3z"
          fill="#ce9a60"
          stroke="none"
        />
        <RoundEars
          fill={coat}
          inner="#ad7751"
          left={9.3}
          right={22.7}
          y={9.9}
          r={2.4}
        />
        <Face
          d="M16 9q6.8 0 7 6.3.6 7-7 7.7-7.6-.7-7-7.7Q9.2 9 16 9z"
          fill={coat}
        />
        <Oval x={16} y={19.8} rx={4.6} ry={2.6} fill="#f7dcaf" stroke="none" />
        <Features
          pet="cinder"
          left={12.3}
          right={19.7}
          y={15.5}
          rx={1.45}
          ry={1.7}
          iris="#a57b4c"
          mouth={21}
        />
        <Path
          className="pet-design-fine"
          d="m6 15.1 1.3.7M25 16l1.2-.8M10 23.3l1.5.7m9 0 1.5-.7"
          stroke="#8d603c"
          w={0.6}
        />
      </Head>
      <Collar fill="#74918c" />
    </>
  );
}
function SparkArt({ coat }) {
  return (
    <>
      <Tail>
        <Path
          d="m22 26 4.7-1.1-1-3.6 4.1-1.6-1.1-4-3.3 1.4.7 3.1-4.2 1.1z"
          fill="#7aa9a0"
          w={0.8}
        />
      </Tail>
      <Torso fill={coat} bib="#fff0be" width={5.6} />
      <Feet fill={coat} left={10.3} right={21.7} rx={2.9} />
      <Forelegs fill={coat} spread={3.6} length={5.5} />
      <Head>
        <Ear>
          <Path d="M10 11Q3.8 7.6 5.2 1.6q4.5.9 7.6 7z" fill={coat} />
          <Path
            d="M5.2 1.6q2.6.7 3.7 3.1l-3 .8z"
            fill="#63988f"
            stroke="none"
          />
        </Ear>
        <Ear right>
          <Path d="M22 11q6.2-3.4 4.8-9.4-4.5.9-7.6 7z" fill={coat} />
          <Path
            d="M26.8 1.6q-2.6.7-3.7 3.1l3 .8z"
            fill="#63988f"
            stroke="none"
          />
        </Ear>
        <Face
          d="M16 8q8.4 0 8.5 7.3L26 17l-1.8 1.1q-.9 4.9-8.2 5-7.3-.1-8.2-5L6 17l1.5-1.7Q7.6 8 16 8z"
          fill={coat}
        />
        <Path
          d="m16 8.5-1.3 3.3h1.7l-.8 2.1 2-3.4h-1.8l.8-2z"
          fill="#fff5d5"
          stroke="none"
        />
        <Path
          d="m9.2 18.2 2 .6-.9 1.4m11.5-2-2 .6.9 1.4"
          stroke="#71a39a"
          w={1}
        />
        <Features
          pet="spark"
          y={14.8}
          rx={1.5}
          ry={1.8}
          iris="#ab7f3f"
          mouth={20.4}
        />
      </Head>
      <Collar fill="#749c94" />
    </>
  );
}
function LeafyArt({ coat }) {
  return (
    <>
      <Tail>
        <Path
          d="M21 27q7.8.1 6.5-3.6-1.7-2.2-4.2-.9"
          fill="none"
          stroke="#438a70"
          w={1.8}
        />
        <Path
          className="dg-pet-vine-leaf"
          d="M25.3 23.5q-2.4-5.6 2.8-4.2 2.2 2.6-2.8 4.2z"
          fill="#91bc78"
          w={0.6}
        />
      </Tail>
      <Torso fill={coat} bib="#d3e1b6" width={5.5} />
      <Feet fill={coat} left={11} right={21} rx={2.6} />
      <Forelegs fill={coat} spread={4} length={5} />
      <Head>
        <Ear>
          <Path
            className="dg-pet-vine-leaf"
            d="M14 10Q4 13 2.8 6.3q6.4-3.2 11.2 3.7z"
            fill="#81b876"
            w={0.8}
          />
          <Path d="m4.4 6.9 7.2 2.3" stroke="#c7dc9e" w={0.5} />
        </Ear>
        <Ear right>
          <Path
            className="dg-pet-vine-leaf"
            d="M18 10q10 3 11.2-3.7Q22.8 3.1 18 10z"
            fill="#81b876"
            w={0.8}
          />
          <Path d="m27.6 6.9-7.2 2.3" stroke="#c7dc9e" w={0.5} />
        </Ear>
        <Face
          d="M16 9q8.3.2 8.3 7 0 7.3-8.3 7.3T7.7 16q0-6.8 8.3-7z"
          fill={coat}
        />
        <Path
          className="dg-pet-vine-leaf"
          d="M16 10q-7.4-4.2-1.1-8.8 7.4 3.5 1.1 8.8z"
          fill="#a8ce8e"
          w={0.7}
        />
        <Path d="M16 8.3 15.4 3" stroke="#6b9f6b" w={0.6} />
        <Features
          pet="leafy"
          y={15.5}
          rx={1.6}
          ry={1.85}
          iris="#9d6f56"
          mouth={20.9}
          nose={false}
        />
        <Oval x={9.8} y={18.8} rx={1} ry={0.5} fill="#b1c4a3" stroke="none" />
        <Oval x={22.2} y={18.8} rx={1} ry={0.5} fill="#b1c4a3" stroke="none" />
      </Head>
      <g className="dg-pet-accessory">
        <Path d="M11 24q5 1.2 10 0" stroke="#b6a27b" w={0.85} />
        <Path d="M16 24q-2.6 2.5 0 3.3 2.6-.8 0-3.3z" fill="#b7cb8d" w={0.4} />
      </g>
    </>
  );
}
function UnicornArt({ coat }) {
  return (
    <>
      <Tail>
        <Path d="M22 27q8 3.4 6.2-5.7-1 3.7-5.2 2.7z" fill="#c8a2ce" />
        <Path d="M25 26.6q2.5-.4 2.3-3" stroke="#edd5e5" w={0.8} />
      </Tail>
      <Torso fill={coat} bib="#fff7ef" width={5.8} top={20} />
      <Forelegs fill={coat} spread={3.5} y={22.1} length={6.8} />
      <Feet fill="#bfa7c7" left={11.3} right={20.7} y={29.3} rx={2} ry={1.2} />
      <Head>
        <Ear>
          <Path d="m9.5 11-2.4-7.1Q11.4 5 13 9z" fill={coat} />
          <Path d="M9 6.5 10.3 9" stroke="#d9b4cc" w={0.8} />
        </Ear>
        <Ear right>
          <Path d="m22.5 11 2.4-7.1Q20.6 5 19 9z" fill={coat} />
          <Path d="M23 6.5 21.7 9" stroke="#d9b4cc" w={0.8} />
        </Ear>
        <Face
          d="M16 7.7q7 0 7 6.4l-1.5 6.5Q20.8 24 16 24t-5.5-3.4L9 14.1q0-6.4 7-6.4z"
          fill={coat}
        />
        <Path
          d="M15.8 8.8Q11.6 6 8.7 10.2q-1.9 2.7-.4 6.2l1.7-3.6q3.8 1.7 5.8-4z"
          fill="#c7a3d2"
          w={0.5}
        />
        <Path d="M14.9 8.9q-3.9-.2-5.3 2.5" stroke="#eed9ea" w={0.6} />
        <Path d="m14.5 8.7 1.7-7 1.6 7z" fill="#e7c78e" w={0.6} />
        <Path d="m15.1 6.3 2.1.7m-1.6-2.1 1.3.4" stroke="#b9945c" w={0.45} />
        <Oval x={16} y={21} rx={4.8} ry={2.8} fill="#ecdde8" stroke="none" />
        <Features
          pet="unicorn"
          left={12.3}
          right={19.7}
          y={15.2}
          rx={1.45}
          ry={1.8}
          iris="#a291ba"
          mouth={22}
          nose={false}
        />
        <g fill="#a993ae">
          <ellipse cx="13.8" cy="20.5" rx=".5" ry=".35" />
          <ellipse cx="18.2" cy="20.5" rx=".5" ry=".35" />
        </g>
      </Head>
      <Collar fill="#b99cbb" gem="#dfc58f" />
    </>
  );
}
function MapleArt({ coat }) {
  return (
    <>
      <Tail>
        <Path
          d="M21.5 28.3q11 2.6 8-9.6-1.8-3-4.4-1.3 3 5-3.8 6.1z"
          fill={coat}
        />
        <Path
          d="m26.3 18 3.8 1.8m-4.5 1.2 4.3 1.5m-5.5 1.3 4.6 2m-7.5-.1 3.4 3.1"
          stroke="#794c3c"
          w={1.4}
        />
      </Tail>
      <Torso fill="#725044" bib={coat} width={6.3} />
      <Feet fill="#654b43" left={10.8} right={21.2} />
      <Forelegs fill="#725044" spread={3.8} length={5.7} />
      <Head>
        <RoundEars
          fill={coat}
          inner="#f7e7cf"
          left={7.7}
          right={24.3}
          y={7.9}
          r={3.3}
        />
        <Face
          d="M16 7.4q9 0 9.2 7.8l1.5 1.5-2 .5Q23.5 23 16 23t-8.7-5.8l-2-.5 1.5-1.5q.2-7.8 9.2-7.8z"
          fill={coat}
        />
        <Path
          d="M7.8 15.5q1.3-6.5 5.2-2.9l3 4.2 3-4.2q3.9-3.6 5.2 2.9 1.1 6.7-8.2 6.9-9.3-.2-8.2-6.9z"
          fill="#f6e6cb"
          stroke="none"
        />
        <Path
          d="M9 12.9q1.3-1.2 3.6.2l1.7 4.3-2.5 1-3.4-2.2zm14 0q-1.3-1.2-3.6.2l-1.7 4.3 2.5 1 3.4-2.2z"
          fill="#85533e"
          stroke="none"
        />
        <Path d="m10.8 10.6 2 .2m6.4 0 2-.2" stroke="#f7e8cf" w={1} />
        <Features
          pet="maple"
          y={14.7}
          rx={1.5}
          ry={1.7}
          iris="#b98751"
          mouth={20.6}
        />
      </Head>
      <Scarf fill="#859a78" />
    </>
  );
}
function EmberArt({ coat }) {
  return (
    <>
      <Tail>
        <Path d="M21 27q8.2 4.5 7.2-3.2" stroke={INK} w={3.1} />
        <Path d="M21 27q8.2 4.5 7.2-3.2" stroke="#62b4a6" w={1.8} />
        <Path
          className="dg-pet-sig dg-pet-sig-new-flame"
          d="M28.2 24.4q-3.2-1.7-1.4-5 .3 1.8 1.6 1.9l1.2-1.8q2.2 3.9-1.4 4.9z"
          fill="#e4b579"
          w={0.6}
        />
      </Tail>
      <Wing>
        <Path
          d="M10.6 23.7q-4.3-1.8-7.5-1.4 1.5-4.7-.5-10 5.8 1.8 9.1 6.9z"
          fill="#bd887b"
        />
        <Path d="m3.8 14.4 5.7 7.7-3.2-1.8" stroke="#f0c9a1" w={0.65} />
      </Wing>
      <Wing right>
        <Path
          d="M21.4 23.7q4.3-1.8 7.5-1.4-1.5-4.7.5-10-5.8 1.8-9.1 6.9z"
          fill="#bd887b"
        />
        <Path d="m28.2 14.4-5.7 7.7 3.2-1.8" stroke="#f0c9a1" w={0.65} />
      </Wing>
      <Torso fill={coat} bib="#f5e5c5" width={5.8} />
      <Feet fill={coat} left={10.8} right={21.2} />
      <Head>
        <Ear>
          <Path
            d="M10.4 9.3q-4.5-.9-3.3-5.2Q9 6.7 12 6.8z"
            fill="#e3c69b"
            w={0.7}
          />
        </Ear>
        <Ear right>
          <Path
            d="M21.6 9.3q4.5-.9 3.3-5.2Q23 6.7 20 6.8z"
            fill="#e3c69b"
            w={0.7}
          />
        </Ear>
        <Face
          d="M16 7q8.4 0 8.7 7.9.9 8-8.7 8.4-9.6-.4-8.7-8.4Q7.6 7 16 7z"
          fill={coat}
        />
        <Path
          d="m13.3 8.5 1.3-3.1L16 7l1.4-1.6 1.3 3.1"
          fill="#6b9d91"
          w={0.55}
        />
        <Oval x={16} y={20.1} rx={5.2} ry={2.9} fill="#f3e3c6" stroke="none" />
        <Features
          pet="ember"
          y={14.6}
          rx={1.65}
          ry={1.9}
          iris="#c7a161"
          mouth={21}
          nose={false}
        />
        <g fill="#688d7a">
          <circle cx="14" cy="19.3" r=".4" />
          <circle cx="18" cy="19.3" r=".4" />
        </g>
        <Path
          className="pet-design-fine"
          d="m8.8 18.1 1 .7 1-.7m10.4 0 1 .7 1-.7"
          stroke="#90d4ba"
          w={0.7}
        />
      </Head>
      <Collar fill="#a88a94" />
    </>
  );
}
function NimbusArt({ coat }) {
  return (
    <>
      {[false, true].map((right) => (
        <Wing key={String(right)} right={right}>
          <g transform={right ? "translate(32 0) scale(-1 1)" : undefined}>
            <Path
              d="M14.1 13.2Q5.4 3.5 2 7.3-.8 12.8 9.7 20 3 20.4 4.1 25.6q.9 4.6 9.8-3z"
              fill={coat}
              w={0.85}
            />
            <Path
              d="M12.7 13.4Q7 7.3 3.3 8.5q-.6 5.4 8.8 10.8"
              stroke="#e5d4e9"
              w={0.7}
            />
            <Oval x={6.9} y={12.8} rx={2.2} ry={2.5} fill="#8d76a9" w={0.5} />
            <Path
              d="M7.5 10.9q-3.3.4-1.7 3.8 1.6 1 2.4-.9-2.3 1-2-1.3.2-1.1 1.3-1.6z"
              fill="#e6c891"
              stroke="none"
            />
            <Path
              d="M6.3 22.6q-2.1 2.3 1.1 3.2-1.2-1.4.6-2.4z"
              fill="#e7ce9e"
              stroke="none"
            />
            <Path
              className="pet-design-fine"
              d="m4.7 8.2 3.9 2.1m-5 4.1 3.2 2.2m-.4 9.7 4.1-3.2"
              stroke="#f0dfec"
              w={0.5}
            />
          </g>
        </Wing>
      ))}
      <Path
        d="M13.4 17.5q2.6-2 5.2 0l.5 6.9q-.9 5.2-3.1 5.4-2.2-.2-3.1-5.4z"
        fill="#a88cba"
      />
      <Path
        d="M13 23q3 1.3 6 0m-5.5 2.1q2.5 1.1 5 0m-4.4 1.9q1.9.8 3.8 0"
        stroke="#dbc7df"
        w={0.65}
      />
      <Head>
        <Ear>
          <Path
            d="M13.4 12Q10.2 6.7 11.1 3m-.1 1.5-1.2-.4m1.2 1.5-1.7-.5m2 1.7-1.8-.4m1.6-1.3 1-1m-.5 2.1 1.1-.8"
            stroke="#79628f"
            w={0.65}
          />
        </Ear>
        <Ear right>
          <Path
            d="M18.6 12q3.2-5.3 2.3-9m.1 1.5 1.2-.4M21 5.6l1.7-.5m-2 1.7 1.8-.4m-1.6-1.3-1-1m.5 2.1-1.1-.8"
            stroke="#79628f"
            w={0.65}
          />
        </Ear>
        <Face
          d="m12 11.2 1-.5L16 10l3 .7 1 .5.2 1.3 1.1 1.2-.7 1.3.6 1.5-1.1.9Q20 20.8 16 21t-4.1-3.6l-1.1-.9.6-1.5-.7-1.3 1.1-1.2z"
          fill="#f5e8ed"
        />
        <Features
          pet="nimbus"
          left={13.5}
          right={18.5}
          y={15.1}
          rx={1.15}
          ry={1.45}
          iris="#9e85b4"
          mouth={18.7}
          nose={false}
        />
        <g className="dg-pet-accessory pet-native-prop dg-pet-sig dg-pet-sig-new-nose">
          <Path
            d="M17 12q-2 .1-1.6-1.8-2 1.2-.6 2.5 1.4.7 2.2-.7z"
            fill="#d8b477"
            stroke="none"
          />
        </g>
      </Head>
    </>
  );
}
function SableArt({ coat }) {
  return (
    <>
      <Tail>
        <Path
          d="M21 28q11.6 3.7 8.1-6.1-1.9-3.2-4.2-1 4.1 2.7.1 4.1"
          fill={coat}
        />
        <Path
          d="m25.2 27.1.5 2.7m2.1-4.6 2.4.3m-3.9-4.4-.6 1.7"
          stroke="#777a90"
          w={1.2}
        />
      </Tail>
      <Torso fill={coat} bib="#f7f2e9" width={6.8} />
      <Feet fill="#f7f2e9" left={10.5} right={21.5} rx={2.9} />
      <Forelegs fill={coat} spread={3.8} length={6} />
      <Head>
        <RoundEars
          fill={coat}
          inner="#baa1af"
          left={7.8}
          right={24.2}
          y={7.8}
          r={2.8}
        />
        <Face
          d="M16 7.5q9.2 0 9.1 8.3l1.6 1.4-2 .7.7 1.3-2.2.4Q21.7 23 16 23t-7.2-3.4l-2.2-.4.7-1.3-2-.7 1.6-1.4Q6.8 7.5 16 7.5z"
          fill={coat}
        />
        <g stroke="#777a90" strokeWidth=".75" strokeLinecap="round" fill="none">
          <path d="M10.6 10.9q-1.7-1-.8-2m1.6.1q1.1.6.3 1.6m8.1.3q1.8.1 1.6-1.4m-1.3-.7q-1.4-.2-1.5 1.1M15.7 10q-1.4-.4-1.3-1.5m2.6 0q.8 1.3-.3 1.7M8.6 18l1.6.5M23.4 18l-1.6.5" />
        </g>
        <Path
          d="M10.7 18.9q1.9-2.1 5.3-1.2 3.4-.9 5.3 1.2Q20.8 22 16 22.4q-4.8-.4-5.3-3.5z"
          fill="#f8efe3"
          stroke="none"
        />
        <Features
          pet="sable"
          y={14.9}
          rx={1.6}
          ry={1.85}
          iris="#86aaa9"
          mouth={20.6}
        />
        <Whiskers y={19.3} color="#808092" pet="sable" />
      </Head>
      <Scarf fill="#9f92ad" />
    </>
  );
}
function InkyArt({ coat }) {
  return (
    <>
      <g data-anatomy="eight-arms">
        <Path
          d="M10.3 23q-6.5-6.1-6.4-1.5 0 3.2 5.4 4.2m12.4-2.7q6.5-6.1 6.4-1.5 0 3.2-5.4 4.2"
          fill={coat}
        />
        <Wing>
          <Path
            d="M11 24q-4.4-5.6-7.8-3.2Q.2 24 3 26.5q2.1 1.5 4.1-.4-3 .4-2.7-1.8 1.3-.8 5.7 3z"
            fill={coat}
          />
          <g fill="#e1c1de">
            <circle cx="3.8" cy="24.2" r=".5" />
            <circle cx="5.6" cy="25.5" r=".5" />
          </g>
        </Wing>
        <Wing right>
          <Path
            d="M21.3 24q5.5-3.3 5.1-8.6.6-2.4 2.4-1.4 3.2 3.6-5.6 12.9z"
            fill={coat}
          />
          <g fill="#e1c1de">
            <circle cx="28.2" cy="17.1" r=".5" />
            <circle cx="27.3" cy="19.4" r=".5" />
            <circle cx="25.9" cy="21.4" r=".5" />
          </g>
        </Wing>
        <Path
          d="M12.7 24.3q-5.7 1.2-5 4.6 1 2.7 4.4.4-2.8.2-.7-1.3l3.1-1.5m5-2.2q5.7 1.2 5 4.6-1 2.7-4.4.4 2.8.2.7-1.3l-3.1-1.5"
          fill={coat}
        />
        <Path
          d="M14.3 24.3q-2.1 3.5-.7 5.6 2.4 1.4 2.4-3.3 0 4.7 2.4 3.3 1.4-2.1-.7-5.6"
          fill={coat}
        />
      </g>
      <Head>
        <Ear>
          <Path d="m9 14-1.2 1.6.7 2.3" fill={coat} stroke="none" />
        </Ear>
        <Ear right>
          <Path d="m23 14 1.2 1.6-.7 2.3" fill={coat} stroke="none" />
        </Ear>
        <Face
          d="M16 6.4q8.9 0 8.4 8.6-.1 9.1-8.4 10.4-8.3-1.3-8.4-10.4Q7.1 6.4 16 6.4z"
          fill={coat}
        />
        <g fill="#8068ac" opacity=".5">
          <circle cx="10.7" cy="12.2" r=".7" />
          <circle cx="21.1" cy="10.7" r=".6" />
          <circle cx="22.5" cy="17.9" r=".5" />
        </g>
        <Path d="M10.5 10.3q1.4-1.7 3-1.8" stroke="#ddc5eb" w={1} />
        <Features
          pet="inky"
          y={16.5}
          rx={1.65}
          ry={1.95}
          iris="#85b7b3"
          mouth={22.1}
          nose={false}
        />
        <g className="dg-pet-accessory pet-native-prop dg-pet-sig dg-pet-sig-new-nose">
          <Oval
            x={10.2}
            y={20.2}
            rx={1}
            ry={0.5}
            fill="#c3a5d6"
            stroke="none"
          />
          <Oval
            x={21.8}
            y={20.2}
            rx={1}
            ry={0.5}
            fill="#c3a5d6"
            stroke="none"
          />
        </g>
      </Head>
    </>
  );
}
const DRAWINGS = {
  cat: CatArt,
  fox: FoxArt,
  dog: DogArt,
  bunny: BunnyArt,
  panda: PandaArt,
  koala: KoalaArt,
  otter: OtterArt,
  raccoon: RaccoonArt,
  hamster: HamsterArt,
  sloth: SlothArt,
  capy: CapyArt,
  mochi: CapyArt,
  penguin: PenguinArt,
  chick: ChickArt,
  hoot: HootArt,
  rover: RobotArt,
  byte: RobotArt,
  pebble: PebbleArt,
  prickle: PrickleArt,
  axolotl: AxolotlArt,
  frost: FrostArt,
  cinder: LionArt,
  spark: SparkArt,
  leafy: LeafyArt,
  unicorn: UnicornArt,
  maple: MapleArt,
  ember: EmberArt,
  nimbus: NimbusArt,
  sable: SableArt,
  inky: InkyArt,
};
export default function CompanionArtwork({ pet }) {
  const id = "companion" + useId().replace(/\W/g, "");
  const colors = PALETTES[pet];
  const Drawing = DRAWINGS[pet];
  if (!colors || !Drawing) return null;
  return (
    <svg
      className={`pet-art pet-rig${pet === "nimbus" ? " pet-rig-moth" : ""}`}
      data-art-revision="anatomy-2"
      viewBox="0 0 32 32"
      aria-hidden="true"
    >
      <defs>
        <radialGradient id={id} cx="32%" cy="20%" r="88%">
          <stop offset="0" stopColor={colors[0]} />
          <stop offset=".55" stopColor={colors[1]} />
          <stop offset="1" stopColor={colors[2]} />
        </radialGradient>
      </defs>
      <ellipse
        className="dg-pet-ground"
        cx="16"
        cy="30.6"
        rx="7.3"
        ry=".7"
        fill={INK}
        opacity=".12"
      />
      <g className="dg-pet-canvas" transform="translate(1 .35) scale(.935)">
        <g
          className="dg-pet-body pet-rig-frame"
          data-part="body"
          data-pet-part="body"
        >
          <Drawing
            coat={`url(#${id})`}
            rover={pet === "rover"}
            mochi={pet === "mochi"}
          />
          {![
            "nimbus",
            "inky",
            "penguin",
            "chick",
            "hoot",
            "rover",
            "pebble",
          ].includes(pet) && <PetGesture fur={colors[1]} ink={INK} />}
        </g>
      </g>
    </svg>
  );
}
