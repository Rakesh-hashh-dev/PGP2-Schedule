import { useState, useRef } from "react";

export default function SwipeToDelete({ onDelete, children, className, onClick }) {
  const [x, setX] = useState(0);
  const [gone, setGone] = useState(false);
  const touch = useRef(null);

  if (gone) return null;

  function onTouchStart(e) {
    touch.current = { startX: e.touches[0].clientX, startY: e.touches[0].clientY, axis: null };
  }
  function onTouchMove(e) {
    if (!touch.current) return;
    const dx = e.touches[0].clientX - touch.current.startX;
    const dy = e.touches[0].clientY - touch.current.startY;
    if (!touch.current.axis) {
      if (Math.abs(dx) < 5 && Math.abs(dy) < 5) return;
      touch.current.axis = Math.abs(dx) >= Math.abs(dy) ? "h" : "v";
    }
    if (touch.current.axis !== "h" || dx > 0) return;
    e.preventDefault();
    setX(dx);
  }
  function onTouchEnd() {
    if (x < -72) {
      setX(-window.innerWidth);
      setTimeout(() => { setGone(true); onDelete?.(); }, 200);
    } else {
      setX(0);
    }
    touch.current = null;
  }

  return (
    <div className={className} style={{ position: "relative", overflow: "hidden" }} onClick={onClick}>
      <div style={{
        position: "absolute", inset: 0,
        background: "#e74c3c",
        display: "flex", alignItems: "center", justifyContent: "flex-end",
        paddingRight: 14, color: "#fff", fontSize: 11, fontWeight: 700,
      }}>
        Clear
      </div>
      <div
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        style={{
          transform: `translateX(${Math.min(0, x)}px)`,
          transition: x === 0 || x <= -window.innerWidth ? "transform .2s ease" : "none",
          position: "relative",
          background: "inherit",
        }}
      >
        {children}
      </div>
    </div>
  );
}
