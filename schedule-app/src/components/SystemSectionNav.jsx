import { useEffect, useRef, useState } from "react";

// Sticky section chips for the Admin › System tab. Each chip jumps to a
// `#system-<id>` heading; the chip for the section in view stays highlighted.
// A scroll listener (not IntersectionObserver) because "in view" here means
// "the last heading that has scrolled under the sticky bars", which is a
// position check, not a visibility one.

export default function SystemSectionNav({ sections, enabled }) {
  const [current, setCurrent] = useState(sections[0]?.id);
  const navRef = useRef(null);

  useEffect(() => {
    if (!enabled) return undefined;
    let frame = 0;
    const update = () => {
      frame = 0;
      // A heading counts as "reached" once it is just under this sticky bar.
      const line = (navRef.current?.getBoundingClientRect().bottom ?? 120) + 32;
      let next = sections[0]?.id;
      for (const s of sections) {
        const el = document.getElementById(`system-${s.id}`);
        if (el && el.getBoundingClientRect().top <= line) next = s.id;
      }
      // The last section is too short to scroll its heading up to the line.
      const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
      if (atBottom) next = sections[sections.length - 1]?.id;
      setCurrent(next);
    };
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(update); };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => { window.removeEventListener("scroll", onScroll); cancelAnimationFrame(frame); };
  }, [enabled, sections]);

  function jump(id) {
    const el = document.getElementById(`system-${id}`);
    if (!el) return;
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
    setCurrent(id);
  }

  return (
    <nav ref={navRef} className="admin-span-all admin-g-system system-section-nav" aria-label="System sections">
      {sections.map(({ id, label, Icon }) => (
        <button key={id} type="button" aria-current={current === id ? "true" : undefined} className={current === id ? "active" : ""} onClick={() => jump(id)}>
          <Icon size={14} aria-hidden="true" /> {label}
        </button>
      ))}
    </nav>
  );
}
