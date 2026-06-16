import { useState, useMemo } from "react";
import { SlidersHorizontal, ChevronDown, ChevronUp } from "lucide-react";

const AREA_LABELS = {
  "F&A":   "Finance",
  "ISM":   "ISM",
  "MKTG":  "Marketing",
  "OB&HR": "OB & HR",
  "OPS":   "Operations",
  "STM":   "Strategy",
};

export default function SubjectFilter({ legend, mine, setMine }) {
  const [open, setOpen] = useState(false);

  const allCodes = useMemo(() => Object.keys(legend), [legend]);

  const byArea = useMemo(() => {
    const map = {};
    for (const code of allCodes) {
      const area = legend[code].area || "Other";
      if (!map[area]) map[area] = [];
      map[area].push(code);
    }
    return map;
  }, [allCodes, legend]);

  const areas = useMemo(() => Object.keys(byArea).sort(), [byArea]);

  const activeArea = useMemo(() => {
    for (const area of areas) {
      const codes = byArea[area];
      if (codes.every((c) => mine.has(c)) && [...mine].every((c) => codes.includes(c)))
        return area;
    }
    return null;
  }, [mine, byArea, areas]);

  const isAll = mine.size === allCodes.length;
  const isFiltered = !isAll;

  function selectArea(area) {
    setMine(activeArea === area ? new Set(allCodes) : new Set(byArea[area]));
  }

  function toggleChip(code) {
    setMine((prev) => {
      const n = new Set(prev);
      n.has(code) ? n.delete(code) : n.add(code);
      return n;
    });
  }

  function toggleArea(area) {
    const codes = byArea[area];
    const allOn = codes.every((c) => mine.has(c));
    setMine((prev) => {
      const n = new Set(prev);
      if (allOn) codes.forEach((c) => n.delete(c));
      else codes.forEach((c) => n.add(c));
      return n;
    });
  }

  return (
    <div className="sf-wrap">
      <div className={`sf ${open ? "sf-open" : ""}`}>
        {/* Header toggle */}
        <button className="sf-toggle" onClick={() => setOpen((p) => !p)}>
          <span className="sf-left">
            <SlidersHorizontal size={13} />
            <span className="sf-label">Subject Filter</span>
            <span className={`sf-count${!isAll ? " filtered" : ""}`}>
              {isAll ? `All ${allCodes.length} subjects` : `${mine.size} of ${allCodes.length}`}
            </span>
          </span>
          {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>

        {/* Area pills — visible when drawer is open */}
        {open && <div className="sf-areas">
          <button className={`sf-apill ${isAll ? "on" : ""}`} onClick={() => setMine(new Set(allCodes))}>
            All
          </button>
          {areas.map((area) => {
            const hasSome = byArea[area].some((c) => mine.has(c));
            return (
              <button
                key={area}
                className={`sf-apill ${activeArea === area ? "on" : hasSome && !isAll ? "partial" : ""}`}
                onClick={() => selectArea(area)}
              >
                {AREA_LABELS[area] || area}
              </button>
            );
          })}
        </div>}

        {/* Expanded: individual subject chips */}
        {open && (
          <div className="sf-body">
            <div className="sf-acts">
              <button onClick={() => setMine(new Set(allCodes))}>Select all</button>
              <button onClick={() => setMine(new Set())}>Clear all</button>
            </div>
            {areas.map((area) => {
              const codes = byArea[area];
              const sel = codes.filter((c) => mine.has(c)).length;
              const allOn = sel === codes.length;
              return (
                <div key={area} className="sf-area">
                  <button
                    className={`sf-area-hd ${allOn ? "on" : sel > 0 ? "partial" : ""}`}
                    onClick={() => toggleArea(area)}
                  >
                    <span className="sf-area-name">{AREA_LABELS[area] || area}</span>
                    <span className="sf-area-tag">{area}</span>
                    <span className="sf-area-count">{sel}/{codes.length}</span>
                  </button>
                  <div className="sf-chips">
                    {codes.map((code) => (
                      <button
                        key={code}
                        className={`sf-chip ${mine.has(code) ? "on" : ""}`}
                        onClick={() => toggleChip(code)}
                      >
                        <span className="sf-code">{code}</span>
                        <span className="sf-name">{legend[code].name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
