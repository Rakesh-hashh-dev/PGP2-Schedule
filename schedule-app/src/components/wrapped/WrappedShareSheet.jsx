import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Download, Image, Share2, X } from "lucide-react";
import { buildWrappedShareFiles, createWrappedPreview, downloadWrappedShareFiles, WRAPPED_SHARE_SLIDES, WRAPPED_SHARE_THEMES } from "../../lib/wrappedShare.js";
import { useBackClose } from "../../lib/backClose.js";

const DEFAULT_SLIDES = ["summary", "workload", "attendance"];

export default function WrappedShareSheet({ open, onClose, stats, termLabel, userName }) {
  useBackClose(onClose, open);
  const [selected, setSelected] = useState(DEFAULT_SLIDES);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [theme, setTheme] = useState("aurora");
  const [previews, setPreviews] = useState({});
  const closeRef = useRef(null);
  const sheetRef = useRef(null);
  const closeSheet = useCallback(() => {
    setStatus("");
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (!open) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const timer = setTimeout(() => closeRef.current?.focus(), 0);
    const onKeyDown = (event) => {
      if (event.key === "Escape") closeSheet();
      if (event.key === "Tab") {
        const focusable = [...(sheetRef.current?.querySelectorAll("button:not(:disabled)") || [])];
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      clearTimeout(timer);
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, closeSheet]);

  useEffect(() => {
    if (!open || !stats) return undefined;
    let cancelled = false;
    const timer = setTimeout(() => {
      const next = Object.fromEntries(WRAPPED_SHARE_SLIDES.map((slide) => [
        slide.id,
        createWrappedPreview(slide.id, stats, termLabel, userName, theme),
      ]));
      if (!cancelled) setPreviews(next);
    }, 0);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [open, stats, termLabel, userName, theme]);

  if (!open || !stats) return null;

  function toggleSlide(id) {
    setStatus("");
    setSelected((current) => {
      if (current.includes(id)) return current.length === 1 ? current : current.filter((item) => item !== id);
      if (current.length >= 3) return current;
      return [...current, id];
    });
  }

  async function handleCreate() {
    if (busy) return;
    setBusy(true);
    setStatus("Creating your story…");
    try {
      const files = await buildWrappedShareFiles(selected, stats, termLabel, userName, theme);
      if (!files.length) throw new Error("The images could not be created.");
      const shareable = files.every((item) => item.file) && navigator.canShare?.({ files: files.map((item) => item.file) });
      if (shareable) {
        await navigator.share({ files: files.map((item) => item.file), title: "TermFlow Wrapped" });
        setStatus("Shared successfully.");
      } else {
        downloadWrappedShareFiles(files);
        setStatus(`${files.length} story image${files.length === 1 ? "" : "s"} downloaded.`);
      }
    } catch (error) {
      if (error?.name === "AbortError") setStatus("Share cancelled.");
      else setStatus(error?.message || "Could not create the story images. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return createPortal(
    <div className="wrapped-share-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) closeSheet(); }}>
      <section ref={sheetRef} className="wrapped-share-sheet" role="dialog" aria-modal="true" aria-labelledby="wrapped-share-title">
        <header className="wrapped-share-head">
          <div>
            <span className="wrapped-share-kicker"><Image size={14} aria-hidden="true" /> Story builder</span>
            <h2 id="wrapped-share-title">Choose up to three slides</h2>
            <p>Each selection becomes a 1080 × 1920 image.</p>
          </div>
          <button ref={closeRef} type="button" className="wrapped-share-close" onClick={closeSheet} aria-label="Close story builder"><X size={18} /></button>
        </header>

        <div className="wrapped-theme-picker" role="group" aria-label="Story color theme">
          <span>Choose a look</span>
          <div>
            {WRAPPED_SHARE_THEMES.map((option) => (
              <button type="button" className={theme === option.id ? "is-selected" : ""} aria-pressed={theme === option.id} onClick={() => setTheme(option.id)} key={option.id}>
                <i style={{ background: option.swatch }} aria-hidden="true" />{option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="wrapped-slide-options">
          {WRAPPED_SHARE_SLIDES.map((slide, index) => {
            const active = selected.includes(slide.id);
            const disabled = !active && selected.length >= 3;
            return (
              <button
                type="button"
                className={`wrapped-slide-option is-${slide.id}${active ? " is-selected" : ""}`}
                aria-pressed={active}
                disabled={disabled}
                onClick={() => toggleSlide(slide.id)}
                key={slide.id}
              >
                {previews[slide.id] && <img className="wrapped-slide-preview" src={previews[slide.id]} alt="" />}
                <span className="wrapped-slide-shade" aria-hidden="true" />
                <span className="wrapped-slide-number">{index + 1}</span>
                <span className="wrapped-slide-check" aria-hidden="true">{active && <Check size={14} />}</span>
                <strong>{slide.label}</strong>
                <span>{slide.description}</span>
              </button>
            );
          })}
        </div>

        <footer className="wrapped-share-actions">
          <p aria-live="polite">{status || `${selected.length} slide${selected.length === 1 ? "" : "s"} selected`}</p>
          <button type="button" className="wrapped-story-create" onClick={handleCreate} disabled={busy}>
            {busy ? "Creating…" : navigator.canShare ? <><Share2 size={16} /> Create & share</> : <><Download size={16} /> Create & download</>}
          </button>
        </footer>
      </section>
    </div>,
    document.body,
  );
}
