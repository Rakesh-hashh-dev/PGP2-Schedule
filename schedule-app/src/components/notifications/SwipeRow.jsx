import { useState, useEffect, useRef } from "react";
import { Check, EyeOff } from "lucide-react";
import { Clock } from "lucide-react"; // Only imported if extraAction needs it

const SWIPE_THRESHOLD = 68;

// Generic swipe wrapper: right = quick action (mark read), left = dismiss/hide.
export function SwipeRow({ onSwipeRight, onSwipeLeft, extraAction, className = "", children }) {
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef(null);
  const justSwiped = useRef(false);
  const clickGuardTimer = useRef(null);
  const rowRef = useRef(null);

  useEffect(() => () => clearTimeout(clickGuardTimer.current), []);

  const onPointerDown = (e) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    dragRef.current = { startX: e.clientX, startY: e.clientY, axis: null, moved: false };
    setDragging(true);
  };

  const onPointerMove = (e) => {
    const d = dragRef.current;
    if (!d) return;
    const dxNow = e.clientX - d.startX;
    const dyNow = e.clientY - d.startY;
    if (!d.axis) {
      if (Math.abs(dxNow) < 8 && Math.abs(dyNow) < 8) return;
      d.axis = Math.abs(dxNow) > Math.abs(dyNow) ? "x" : "y";
      if (d.axis === "x") rowRef.current?.setPointerCapture?.(e.pointerId);
    }
    if (d.axis !== "x") return;
    d.moved = true;
    const maxLeft = onSwipeLeft ? 120 : 0;
    const maxRight = onSwipeRight ? 120 : 0;
    setDx(Math.max(-maxLeft, Math.min(maxRight, dxNow)));
  };

  const onPointerEnd = () => {
    const d = dragRef.current;
    dragRef.current = null;
    setDragging(false);
    if (!d || !d.moved) return;
    justSwiped.current = true;
    clearTimeout(clickGuardTimer.current);
    clickGuardTimer.current = setTimeout(() => { justSwiped.current = false; }, 350);
    if (dx > SWIPE_THRESHOLD && onSwipeRight) {
      onSwipeRight();
    } else if (dx < -SWIPE_THRESHOLD && onSwipeLeft) {
      setDx(0);
      onSwipeLeft();
      return;
    }
    setDx(0);
  };

  const capture = (fn) => (e) => {
    if (justSwiped.current) { justSwiped.current = false; return; }
    fn?.(e);
  };

  return (
    <div className={`notif-swipe-wrap${extraAction ? " has-snooze" : ""}${dragging || dx !== 0 ? " swiping" : ""}`}>
      {(onSwipeRight || onSwipeLeft) && (
        <div className={`notif-swipe-bg ${dx > 0 ? 'show-read' : dx < 0 ? 'show-hide' : ''}`}>
          <span className="notif-swipe-ico read"><Check size={16} strokeWidth={3} /></span>
          <span className="notif-swipe-ico hide"><EyeOff size={15} /></span>
        </div>
      )}
      <div
        ref={rowRef}
        className={className}
        style={{ transform: dx ? `translateX(${dx}px)` : "none", transition: dragging ? 'none' : 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
      >
        {typeof children === "function" ? children(capture) : children}
      </div>
      {extraAction && (
        <div className="notif-extra-actions">
          <button type="button" className="notif-snooze-btn" data-tip={extraAction.title} onClick={(e) => { e.stopPropagation(); extraAction.onClick(); }}>
            <Clock size={12} />
          </button>
        </div>
      )}
    </div>
  );
}
