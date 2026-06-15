import { Filter } from "lucide-react";

export default function CoursePicker({ legend, mine, setMine, open, setOpen }) {
  const allCodes = Object.keys(legend);

  return (
    <>
      <button
        className={`mybtn ${mine.size < allCodes.length ? "active" : ""}`}
        onClick={() => setOpen((p) => !p)}
      >
        <Filter size={13} /> My courses · {mine.size}/{allCodes.length}
      </button>

      {open && (
        <div className="picker">
          <div className="picker-head">
            <span>Show only the courses you're enrolled in</span>
            <div className="picker-acts">
              <button onClick={() => setMine(new Set(allCodes))}>All</button>
              <button onClick={() => setMine(new Set())}>None</button>
            </div>
          </div>
          <div className="chips">
            {allCodes.map((code) => (
              <button
                key={code}
                className={`chip ${mine.has(code) ? "on" : ""}`}
                onClick={() =>
                  setMine((prev) => {
                    const n = new Set(prev);
                    n.has(code) ? n.delete(code) : n.add(code);
                    return n;
                  })
                }
              >
                <span className="chip-code">{code}</span> {legend[code].name}
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
