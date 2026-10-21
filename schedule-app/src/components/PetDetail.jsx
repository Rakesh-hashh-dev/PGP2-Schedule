import PetDesignDetail from "./PetDesignDetail.jsx";

// A few broad, species-specific marks read at 40px and remain clean at 160px.
// Highlights are lit from the upper left; texture follows the existing anatomy.
const DETAILS = {
  cat: { ink: "#52596b", path: "M8.3 18.2q1 .6 1.8.4M22 18.6q.8.2 1.7-.4M13 21.2h.1m5.8 0h.1", shine: "M15.3 20.2q.6-.25 1.1 0", neck: "M12.8 25.6q3.2 1.2 6.4 0" },
  fox: { ink: "#a35b33", path: "M9.2 21.4q1.1.6 2.1.4M20.7 21.8q1 .2 2.1-.4", shine: "M14.9 12.1q.5-.7 1.1-1", neck: "M13.2 25q2.8.9 5.6 0" },
  dog: { ink: "#ae784c", path: "M10.6 20.5q.8-.3 1.5 0M19.9 20.5q.8-.3 1.5 0M12.1 21.3h.1m7.6 0h.1", shine: "M10 9.6q1.3-1.1 2.5-1.2", neck: "M13.5 26.5q2.5 1 5 0" },
  bunny: { ink: "#b6a4c5", path: "M8.5 20.6q1 .6 1.9.5M21.6 21.1q.9.1 1.9-.5", shine: "M15.5 20q.5-.2 1 0", neck: "M13.3 26q2.7 1 5.4 0" },
  penguin: { ink: "#abbace", path: "M13.3 20.2q1.2.6 2.4 0m.6 0q1.2.6 2.4 0M14.8 21.5q1.2.5 2.4 0", shine: "M14.9 17q.6-.5 1.1-.6" },
  panda: { ink: "#a9b1c2", path: "M13.1 22.2q.8.5 1.5.2M17.4 22.4q.7.3 1.5-.2", shine: "M10.4 10.5q1.1-.6 2.1-.8", neck: "M9.8 27.2v.6m1.2-.6v.6m8.5-.6v.6m1.2-.6v.6" },
  chick: { ink: "#d8a426", path: "M12 22q1 .7 2 0m4 0q1 .7 2 0M14.5 25q1.5.6 3 0", shine: "M10.4 12.5q1.1-1 2.4-1.3" },
  koala: { ink: "#95a0b1", path: "M7.5 20.7q.6 1.1 1.9 1.3M22.6 22q1.3-.2 1.9-1.3M13.5 24.5q2.5.8 5 0", shine: "M14.9 18.1q.1-.5.5-.8" },
  otter: { ink: "#be9979", path: "M12.4 20.7h.1m1.1.5h.1m5.5-.5h.1m-1.1.5h.1M13 24.2q3 1 6 0", shine: "M14.9 19q.5-.3 1-.3" },
  rover: { ink: "#56687b", path: "M8.8 21.5h1.3m11.8 0h1.3M10 26.7h1.2m2.2 0h1.2m2.2 0H18m2.2 0h1.2", shine: "M10.5 13.3h4.5", neck: "M10 23.4h12" },
  raccoon: { ink: "#9ba5b7", path: "M10.8 23.7q.6.8 1.8.9M19.4 24.6q1.2-.1 1.8-.9", shine: "M15.3 20q.5-.3 1-.2" },
  axolotl: { ink: "#d983a7", path: "M12.4 22.6q1 .6 1.9.2M17.7 22.8q.9.4 1.9-.2", shine: "M10.1 11.8q1.1-.8 2.3-1", neck: "M12.2 25.5q3.8 1.2 7.6 0" },
  spark: { ink: "#c59436", path: "M8.1 18.4q.5.8 1.1.9M22.8 19.3q.6-.1 1.1-.9", shine: "M14.1 11.3q1-.8 1.9-.8", neck: "M12.6 27.5q3.4 1.1 6.8 0" },
  leafy: { ink: "#3c8d82", path: "M12.6 25.1q.8.8 1.5.8M17.9 25.9q.7 0 1.5-.8", shine: "M13.3 8.9q.5 2.1.3 3.3", neck: "M13.7 27.1q2.3.8 4.6 0" },
  cinder: { ink: "#ba8749", path: "M11 21.1q.6 1 1.7 1.2M19.3 22.3q1.1-.2 1.7-1.2", shine: "M15.2 18.4q.6-.2 1.1-.1", neck: "M13.6 26.1q2.4.7 4.8 0" },
  hoot: { ink: "#a47b55", path: "M10 25.5q1 .7 2 0m3 0q1 .7 2 0m3 0q1 .7 2 0M13 27q1 .7 2 0m2 0q1 .7 2 0", shine: "M8 9.9q1.1-.8 2.4-.8" },
  byte: { ink: "#558c87", path: "M8 18.9h1m14 0h1M13.4 25.8h1m3.2 0h1", shine: "M9.8 11.6h4.5", neck: "M12.3 22.5h1m5.4 0h1" },
  pebble: { ink: "#7d996c", path: "M20 20.7q.6.5 1.2.3M26.1 21q.6.2 1.2-.3", shine: "M20.4 13.4q.8-.7 1.7-.7", neck: "M5.8 27.4h1m9.2 0h1" },
  prickle: { ink: "#bc9875", path: "M12.8 20q.8.7 1.8.7M23.4 20.7q1-.1 1.8-.7", shine: "M18.4 22q.5-.2 1-.1", neck: "M15.5 27.6q2.8.8 5.6 0" },
  luna: { ink: "#8a8f9c", path: "M10.2 21.6q.8.7 1.8.6M20 22.2q1 .1 1.8-.6", shine: "M15.2 19q.6-.3 1.1-.2", neck: "M13 26.2l1.2.8 1.8-.6 1.8.6 1.2-.8" },
  frost: { ink: "#87a5c5", path: "M10.2 21.6q.8.7 1.8.6M20 22.2q1 .1 1.8-.6", shine: "M15.2 19q.6-.3 1.1-.2", neck: "M13 26.2l1.2.8 1.8-.6 1.8.6 1.2-.8" },
  unicorn: { ink: "#b7b1dd", path: "M10.4 22.6q.8.5 1.5.2M20.1 22.8q.7.3 1.5-.2", shine: "M11 11.2q1.1-.7 2.2-.8", neck: "M13.2 27.2q2.8.8 5.6 0" },
  dragon: { ink: "#1e8a5c", path: "M10.1 22.2q.8.7 1.6.3M20.3 22.5q.8.4 1.6-.3", shine: "M12.6 10.6q.9-.6 1.8-.7", neck: "M13.3 27q2.7.8 5.4 0" },
  hamster: { ink: "#c98a4e", path: "M8.6 16.6q.6.5 1.2.4M22.2 17q.6.1 1.2-.4", shine: "M15.4 18.8q.4-.2.8 0", neck: "M13.4 27.4q2.6.9 5.2 0" },
  sloth: { ink: "#8d7660", path: "M9.4 21.8q.8.6 1.6.4M21 22.2q.8.2 1.6-.4", shine: "M15.5 19.4q.4-.2.8-.1", neck: "M13.4 27.5q2.6.8 5.2 0" },
  capy: { ink: "#8c5d38", path: "M8.6 15.6q.7.5 1.4.3M22 15.9q.7.2 1.4-.3M12.2 21.6q.7.4 1.3.2M18.5 21.8q.6.2 1.3-.2", shine: "M15.4 18.1q.5-.3 1-.3", neck: "M12.6 27.6q3.4.9 6.8 0" },
};

export default function PetDetail({ pet, layer = "head" }) {
  const detail = DETAILS[pet];
  if (!detail) return null;
  return <><PetDesignDetail pet={pet} layer={layer} /><g className={`dg-pet-detail dg-pet-detail-${layer}`} fill="none" strokeLinecap="round" strokeLinejoin="round" data-part={layer === "head" ? "surface-detail" : "contact-detail"}>
    <path d={layer === "body" ? detail.neck : detail.path} stroke={detail.ink} strokeWidth=".5" opacity=".65" />
    {layer === "head" && <path d={detail.shine} stroke="#fff6e6" strokeWidth=".55" opacity=".5" />}
  </g></>;
}

export function PetPaintDefs({ id, light, coat, shade }) {
  return <radialGradient id={id} cx="34%" cy="24%" r="85%">
    <stop offset="0" stopColor={light} />
    <stop offset=".58" stopColor={coat} />
    <stop offset="1" stopColor={shade} />
  </radialGradient>;
}
