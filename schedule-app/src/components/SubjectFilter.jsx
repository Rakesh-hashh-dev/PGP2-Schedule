import { useState } from "react";
import { SlidersHorizontal, ChevronDown, ChevronUp } from "lucide-react";

export default function SubjectFilter({ legend, mine, setMine }) {
  const [open, setOpen] = useState(false);
  const allCodes = Object.keys(legend);
  const isFiltered = mine.size < allCodes.length;

  return (
    <div className={`sf ${open ? "sf-open" : ""}`}>
      <button className="sf-toggle" onClick={() => setOpen((p) => !p)}>
        <span className="sf-left">
          <SlidersHorizontal size={14} />
          <span className="sf-label">Subject Filter</span>
          {isFiltered
            ? <span className="sf-badge">{mine.size} of {allCodes.length} selected</span>
            : <span className="sf-badge sf-badge-all">All {allCodes.length} subjects</span>}
        </span>
        {open ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
      </button>

      {open && (
        <div className="sf-body">
          <div className="sf-acts">
            <button onClick={() => setMine(new Set(allCodes))}>Select all</button>
            <button onClick={() => setMine(new Set())}>Clear all</button>
          </div>
          <div className="sf-chips">
            {allCodes.map((code) => (
              <button
                key={code}
                className={`sf-chip ${mine.has(code) ? "on" : ""}`}
                onClick={() =>
                  setMine((prev) => {
                    const n = new Set(prev);
                    n.has(code) ? n.delete(code) : n.add(code);
                    return n;
                  })
                }
              >
                <span className="sf-code">{code}</span>
                <span className="sf-name">{legend[code].name}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
