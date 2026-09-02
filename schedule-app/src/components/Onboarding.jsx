import { useState, useMemo, useEffect, useRef } from "react";
import { ArrowRight, Info, X, Settings2, Download } from "lucide-react";
import { subjectClass } from "../lib/subjectColors.js";

const AREA_LABEL = { "F&A": "Finance & Accounting", MKTG: "Marketing", ISM: "Information Systems", STM: "Strategy", OPS: "Operations", "OB&HR": "OB & HR", Other: "Other" };
const AREA_ORDER = ["F&A", "MKTG", "ISM", "STM", "OPS", "OB&HR", "Other"];

export default function Onboarding({ legend, sectionsByCode, onDone, initialPicked, onCancel, termLabel, onPullFromSheet, prefill, cloudChecked, waitingForAllocation, needsName, reonboardFromTerm, newTermLabel, liveTerm, priorTerm, priorLegend, priorPicked }) {
  const isEditing = !!initialPicked;
  const [picked, setPicked] = useState(() => initialPicked || {});
  const [name, setName] = useState("");
  const [pulling, setPulling] = useState(false);
  const [pullMsg, setPullMsg] = useState(null);
  const prefillApplied = useRef(false);
  useEffect(() => {
    if (prefillApplied.current || !prefill || Object.keys(prefill).length === 0) return;
    setPicked(prefill);
    prefillApplied.current = true;
  }, [prefill]);

  const offered = (code) => {
    const s = (sectionsByCode && sectionsByCode[code]) || ["Single"];
    return s.length ? s : ["Single"];
  };

  const groups = useMemo(() => {
    const byArea = {};
    Object.entries(legend || {}).forEach(([code, info]) => {
      const a = info.area || "Other";
      (byArea[a] = byArea[a] || []).push([code, info.name]);
    });
    Object.values(byArea).forEach((l) => l.sort((x, y) => x[1].localeCompare(y[1])));
    return AREA_ORDER.map((a) => [a, byArea[a] || []]).filter(([, l]) => l.length);
  }, [legend]);

  const priorGroups = useMemo(() => {
    const byArea = {};
    Object.entries(priorLegend || {}).forEach(([code, info]) => {
      const a = info.area || "Other";
      (byArea[a] = byArea[a] || []).push([code, info.name]);
    });
    Object.values(byArea).forEach((l) => l.sort((x, y) => x[1].localeCompare(y[1])));
    return AREA_ORDER.map((a) => [a, byArea[a] || []]).filter(([, l]) => l.length);
  }, [priorLegend]);

  const allCodes = useMemo(() => Object.keys(legend || {}), [legend]);
  const count = Object.keys(picked).length;
  const allOn = count === allCodes.length && allCodes.length > 0;

  async function handlePullFromSheet() {
    if (!onPullFromSheet) return;
    setPulling(true);
    setPullMsg(null);
    const allocation = await onPullFromSheet();
    setPulling(false);
    if (!allocation || Object.keys(allocation).length === 0) {
      setPullMsg({ ok: false, text: "No allocation found for your account." });
      return;
    }
    setPicked(allocation);
    setPullMsg({ ok: true, text: `Filled ${Object.keys(allocation).length} subjects from timetable.` });
  }

  const toggle = (code) => setPicked((p) => {
    const n = { ...p };
    if (n[code]) delete n[code]; else n[code] = offered(code)[0];
    return n;
  });
  const setSec = (code, s) => setPicked((p) => ({ ...p, [code]: s }));
  const selectAll = () => setPicked(allOn ? {} : Object.fromEntries(allCodes.map((c) => [c, offered(c)[0]])));

  return (
    <div className="ob">
      <header className="bar">
        <div className="brand">
          <div className="logo"><img src="/termflow-icon.svg" alt="TermFlow" width={22} height={22} /></div>
          <div>
            <div className="brand-name">TermFlow</div>
            <div className="brand-sub">IIM Sambalpur · {termLabel || "PGP2"}</div>
          </div>
        </div>
        <div className="bar-right">
          {isEditing && (
            <span className="ob-step"><Settings2 size={12} /> Edit setup</span>
          )}
          {!isEditing && (
            <span className="ob-step">Setup</span>
          )}
          {isEditing && onCancel && (
            <button className="sync" onClick={onCancel} aria-label="Cancel"><X size={15} /></button>
          )}
        </div>
      </header>

      <div className="ob-body">
        {liveTerm && (
          <div className="ob-term-badge" role="note">
            <span className="ob-term-badge-live">Term {liveTerm}</span>
            <span className="ob-term-badge-label">Now enrolling · Live</span>
            {priorTerm && priorTerm !== liveTerm && (
              <span className="ob-term-badge-prior">Finished Term {priorTerm}? Your old courses &amp; attendance are safe — switch to Term {priorTerm} anytime from the term picker.</span>
            )}
          </div>
        )}
        <h1 className="ob-title">{isEditing ? "Edit your courses." : reonboardFromTerm ? `Term ${newTermLabel || ""} has started.` : "Set up your timetable."}</h1>
        <p className="ob-sub">
          {reonboardFromTerm
            ? `Your Term ${reonboardFromTerm} courses have ended — pick your subjects for the new term to keep going. Your old schedule and attendance are saved and still viewable from the term switcher.`
            : "Pick your courses — and your section for each. We'll show only your classes, with no clashes."}
        </p>
        <div className="ob-hint"><Info size={14} /> Your section can differ per course — choose A or B on each.</div>

        {needsName && (
          <div className="ob-name">
            <label className="ob-name-label" htmlFor="ob-name-input">Your name</label>
            <input
              id="ob-name-input"
              className="ob-name-input"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Riya Sharma"
              maxLength={40}
              autoComplete="name"
            />
            <span className="ob-name-hint">So classmates can recognise you when you connect as friends.</span>
          </div>
        )}

        {!isEditing && !cloudChecked && (
          <div className="ob-sync-notice">
            <span className="ob-sync-dot" />
            <div>
              <span className="ob-sync-title">Checking your profile for subjects…</span>
              <span className="ob-sync-sub">Syncing from database, courses may auto-fill</span>
            </div>
          </div>
        )}

        {!isEditing && cloudChecked && waitingForAllocation && (
          <div className="ob-sync-notice ob-sync-notice--feed">
            <span className="ob-sync-dot ob-sync-dot--feed" />
            <div>
              <span className="ob-sync-title">Fetching timetable allocation…</span>
              <span className="ob-sync-sub">Reading your course list from the sheet, hang tight</span>
            </div>
          </div>
        )}

        {onPullFromSheet && (
          <div className="ob-pull-row">
            <button className="ob-pull-btn" onClick={handlePullFromSheet} disabled={pulling}>
              <Download size={14} />
              {pulling ? "Pulling…" : "Pull from timetable"}
            </button>
            {pullMsg && <span className={`ob-pull-msg${pullMsg.ok ? "" : " ob-pull-msg-err"}`}>{pullMsg.text}</span>}
          </div>
        )}

        <div className="ob-label-row">
          <span className="ob-label">{liveTerm ? `Your Term ${liveTerm} courses & sections` : "Your courses & sections"}</span>
          <button className="ob-all" onClick={selectAll}>{allOn ? "Clear all" : "Select all"}</button>
        </div>

        {groups.map(([area, list]) => (
          <div key={area} className="ob-grp">
            <div className="ob-grp-h">{AREA_LABEL[area] || area}</div>
            <div className="oc-list">
              {list.map(([code, name]) => {
                const on = !!picked[code];
                const opts = offered(code);
                const split = opts.length > 1;
                return (
                  <div key={code} className={`oc ${on ? "on" : ""}`}>
                    <button className="oc-main" onClick={() => toggle(code)} aria-pressed={on}>
                      <span className={`ses ${subjectClass(code)}`}>
                        {code}
                      </span>
                      <span className="oc-n">{name}</span>
                    </button>
                    <div className="oc-right">
                      {on && split && (
                        <div className="oc-seg" role="group" aria-label={`${code} section`}>
                          {opts.map((s) => (
                            <button key={s} className={picked[code] === s ? "on" : ""} onClick={() => setSec(code, s)}>
                              {s === "Single" ? "All" : s}
                            </button>
                          ))}
                        </div>
                      )}
                      {on && !split && <span className="oc-single">All</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {priorTerm && priorTerm !== liveTerm && priorGroups.length > 0 && priorPicked && Object.keys(priorPicked).length > 0 && (
          <div className="ob-prior">
            <div className="ob-prior-head">
              <span className="ob-prior-tag">Term {priorTerm} · Completed</span>
              <span className="ob-prior-note">Archived &amp; read-only — view from the term picker</span>
            </div>
            {priorGroups.map(([area, list]) => (
              <div key={area} className="ob-grp">
                <div className="ob-grp-h">{AREA_LABEL[area] || area}</div>
                <div className="oc-list">
                  {list.map(([code, name]) => {
                    const sec = priorPicked && priorPicked[code];
                    const on = !!sec;
                    return (
                      <div key={code} className={`oc oc-archived ${on ? "on" : ""}`}>
                        <div className="oc-main">
                          <span className={`ses ${subjectClass(code)}`}>{code}</span>
                          <span className="oc-n">{name}</span>
                        </div>
                        {on && (
                          <div className="oc-right">
                            <span className="oc-single">{sec === "Single" ? "All" : sec}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="ob-foot">
        <div className="ob-foot-inner">
          <span className="ob-count">{count} {count === 1 ? "subject" : "subjects"} selected</span>
          <button className="ob-cta" disabled={count === 0 || (needsName && !name.trim())} onClick={() => onDone({ ...picked }, name)}>
            {isEditing ? "Save changes" : "Show my schedule"} <ArrowRight size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
