import { useState } from "react";
import { BookMarked, Check, ChevronDown, CircleHelp, ExternalLink, FileText, Plus, RotateCcw, Trash2 } from "lucide-react";
import { nextReviewDate, reviewQueue } from "../lib/courseHub.js";
import { safeUrl } from "../lib/safeUrl.js";
import { useBackClose } from "../lib/backClose.js";

const dayKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const labelDate = (iso) => {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString([], { day: "numeric", month: "short" });
};
const sessionKey = (session) => `${session.date}_${session.start}_${session.code}_${session.section}`;
const blank = { kind: "", id: "", title: "", faculty: "", room: "", syllabusUrl: "", grading: "", question: "", answer: "", flagged: false, sessionKey: "", takeaway: "", doubt: "", followUp: "" };

export default function CourseLearning({ course, items, now, isArchived, onSave, onChange }) {
  const [form, setForm] = useState(blank);
  const [error, setError] = useState("");
  const [reviewId, setReviewId] = useState("");
  const [revealed, setRevealed] = useState(false);
  const essentials = items.find((item) => item.kind === "essentials");
  const topics = items.filter((item) => item.kind === "topic");
  const notes = items.filter((item) => item.kind === "note").sort((a, b) => (b.details?.sessionDate || "").localeCompare(a.details?.sessionDate || ""));
  const queue = reviewQueue(topics, now);
  const due = queue.filter((item) => item.dueDate <= dayKey(now));
  const past = course.sessions.filter((session) => session.date < dayKey(now) || (session.date === dayKey(now) && session.end <= `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`)).slice().reverse();
  const faculty = [...new Set(course.sessions.map((session) => session.faculty).filter(Boolean))].join(", ");
  const room = course.nextClass?.room || [...new Set(course.sessions.map((session) => session.room).filter(Boolean))][0] || "";
  const syllabusUrl = /^https?:\/\//i.test(essentials?.details?.syllabusUrl || "") ? safeUrl(essentials.details.syllabusUrl) : null;

  const openForm = (kind, item) => {
    const details = item?.details || {};
    setForm({ ...blank, kind, id: item?.id || "", title: item?.title || "", faculty: details.faculty || "", room: details.room || "", syllabusUrl: details.syllabusUrl || "", grading: details.grading || "", question: details.question || "", answer: details.answer || "", flagged: Boolean(details.flagged), sessionKey: item?.sessionKey || past[0] && sessionKey(past[0]) || "", takeaway: details.takeaway || "", doubt: details.doubt || "", followUp: details.followUp || "" });
    setError("");
  };
  const closeForm = () => { setForm(blank); setError(""); };
  useBackClose(closeForm, !!form.kind);
  const submit = (event) => {
    event.preventDefault();
    const title = form.title.trim();
    if (form.kind === "topic" && !title) { setError("Add a topic name."); return; }
    if (form.kind === "topic" && form.flagged && !form.answer.trim()) { setError("Add key points for the self-check."); return; }
    if (form.kind === "note" && !form.takeaway.trim() && !form.doubt.trim() && !form.followUp.trim()) { setError("Add at least one note."); return; }
    if (form.kind === "essentials" && form.syllabusUrl.trim() && (!/^https?:\/\//i.test(form.syllabusUrl.trim()) || !safeUrl(form.syllabusUrl.trim()))) { setError("Use a valid http or https syllabus link."); return; }
    const selected = past.find((session) => sessionKey(session) === form.sessionKey);
    const existingNote = notes.find((item) => item.id === form.id);
    if (form.kind === "note" && !selected && !existingNote) { setError("Select a past class."); return; }
    if (form.kind === "essentials") onSave("essentials", "Course essentials", { faculty: form.faculty.trim(), room: form.room.trim(), syllabusUrl: form.syllabusUrl.trim(), grading: form.grading.trim() }, "", form.id);
    if (form.kind === "topic") {
      const existing = topics.find((item) => item.id === form.id);
      onSave("topic", title, { ...existing?.details, question: form.question.trim(), answer: form.answer.trim(), flagged: form.flagged, reviewAt: form.flagged ? existing?.details?.reviewAt || dayKey(now) : "", reviewStep: existing?.details?.reviewStep ?? -1 }, "", form.id);
    }
    if (form.kind === "note") onSave("note", selected ? `Class · ${labelDate(selected.date)} ${selected.start}` : existingNote.title, { sessionDate: selected?.date || existingNote.details?.sessionDate, takeaway: form.takeaway.trim(), doubt: form.doubt.trim(), followUp: form.followUp.trim() }, selected ? form.sessionKey : existingNote.sessionKey, form.id);
    closeForm();
  };
  const review = (item, remembered) => {
    onChange(item, { details: { ...item.details, ...nextReviewDate(now, Number(item.details?.reviewStep ?? -1), remembered) } });
    setReviewId(""); setRevealed(false);
  };

  return <>
    <section className="ch-panel" aria-labelledby="ch-essentials-title">
      <div className="ch-panel-head"><div><span className="ch-eyebrow">REFERENCE</span><h2 id="ch-essentials-title">Course essentials</h2></div><BookMarked size={18} aria-hidden="true" /></div>
      <div className="ch-essentials-grid">
        <div><small>Faculty</small><strong>{essentials?.details?.faculty || faculty || "Not listed"}</strong></div>
        <div><small>Next room</small><strong>{essentials?.details?.room || room || "Not listed"}</strong></div>
        <div><small>Grading breakdown</small><strong>{essentials?.details?.grading || "Add from your course outline"}</strong></div>
      </div>
      <div className="ch-panel-footer">{syllabusUrl && <a className="ch-inline-link" href={syllabusUrl} target="_blank" rel="noopener noreferrer">Open syllabus <ExternalLink size={14} /></a>}{!isArchived && <button className="ch-add" onClick={() => openForm("essentials", essentials)}>{essentials ? "Edit essentials" : "Add essentials"}</button>}</div>
      <p className="ch-footnote">Faculty and room come from your timetable unless you set your own values. Check grading against the official course outline.</p>
    </section>
    <section className="ch-panel" aria-labelledby="ch-topics-title">
      <div className="ch-panel-head"><div><span className="ch-eyebrow">LEARNING PROGRESS</span><h2 id="ch-topics-title">Topics and revision</h2></div><CircleHelp size={18} aria-hidden="true" /></div>
      <p className="ch-sub">Track the syllabus in your own words. Flag topics you want to revisit.</p>
      {topics.length ? <><div className="ch-topic-progress" role="img" aria-label={`${topics.filter((item) => item.done).length} of ${topics.length} topics covered`}><span style={{ width: `${topics.filter((item) => item.done).length / topics.length * 100}%` }} /></div><p className="ch-footnote">{topics.filter((item) => item.done).length} of {topics.length} topics covered</p><div className="ch-learning-list">{topics.map((item) => <div className="ch-learning-row" key={item.id}><button className={`ch-topic-check${item.done ? " is-done" : ""}`} disabled={isArchived} aria-label={`${item.done ? "Mark not covered" : "Mark covered"}: ${item.title}`} onClick={() => onChange(item, { done: !item.done })}><Check size={14} /></button><span><strong>{item.title}</strong>{item.details?.flagged && <small>In revision queue</small>}</span>{!isArchived && <><button className="ch-item-edit" onClick={() => openForm("topic", item)}>Edit</button><button className="ch-item-delete" aria-label={`Remove ${item.title}`} onClick={() => onChange(item, { deleted: true })}><Trash2 size={14} /></button></>}</div>)}</div></> : <p className="ch-empty">Add your first topic from the syllabus.</p>}
      {!isArchived && <button className="ch-add" onClick={() => openForm("topic")}><Plus size={15} /> Add topic</button>}
      <div className="ch-revision"><h3>Revision queue</h3>{queue.length ? <><p className="ch-sub">{due.length ? `${due.length} ready to review` : `Next review ${labelDate(queue[0].dueDate)}`}. Recall the answer before revealing it.</p>{queue.slice(0, 5).map((item) => <div className="ch-review-item" key={item.id}><button className="ch-review-open" onClick={() => { setReviewId(reviewId === item.id ? "" : item.id); setRevealed(false); }} aria-expanded={reviewId === item.id}><span><strong>{item.title}</strong><small>{item.dueDate <= dayKey(now) ? "Ready now" : `Review ${labelDate(item.dueDate)}`}</small></span><ChevronDown size={15} /></button>{reviewId === item.id && <div className="ch-review-body"><p>{item.details?.question || `What do you remember about ${item.title}?`}</p>{revealed && item.details?.answer && <p className="ch-review-answer">{item.details.answer}</p>}{!revealed ? <button className="ch-inline-link" onClick={() => setRevealed(true)}>Reveal answer</button> : !isArchived && <div className="ch-review-actions"><button onClick={() => review(item, false)}><RotateCcw size={14} /> Review again tomorrow</button><button onClick={() => review(item, true)}><Check size={14} /> I remembered</button></div>}</div>}</div>)}</> : <p className="ch-empty">Flag a topic to build a review queue.</p>}</div>
    </section>
    <section className="ch-panel" aria-labelledby="ch-notes-title">
      <div className="ch-panel-head"><div><span className="ch-eyebrow">AFTER CLASS</span><h2 id="ch-notes-title">Class notes</h2></div><FileText size={18} aria-hidden="true" /></div>
      <p className="ch-sub">Capture one takeaway, a doubt, or a follow-up for each class.</p>
      {notes.length ? <div className="ch-learning-list">{notes.map((item) => <article className="ch-note" key={item.id}><div className="ch-note-head"><strong>{item.title}</strong>{!isArchived && <span><button className="ch-item-edit" onClick={() => openForm("note", item)}>Edit</button><button className="ch-item-delete" aria-label={`Remove note for ${item.title}`} onClick={() => onChange(item, { deleted: true })}><Trash2 size={14} /></button></span>}</div>{item.details?.takeaway && <p><b>Takeaway</b> {item.details.takeaway}</p>}{item.details?.doubt && <p><b>Doubt</b> {item.details.doubt}</p>}{item.details?.followUp && <p><b>Follow-up</b> {item.details.followUp}</p>}</article>)}</div> : <p className="ch-empty">No class notes yet.</p>}
      {!isArchived && past.length > 0 && <button className="ch-add" onClick={() => openForm("note")}><Plus size={15} /> Add class note</button>}
    </section>
    {form.kind && <div className="ch-modal-backdrop" onClick={closeForm}><form className="ch-modal ch-learning-modal" role="dialog" aria-modal="true" aria-labelledby="ch-learning-modal-title" onClick={(event) => event.stopPropagation()} onSubmit={submit}><h2 id="ch-learning-modal-title">{form.id ? "Edit" : "Add"} {form.kind === "essentials" ? "course essentials" : form.kind === "topic" ? "topic" : "class note"}</h2>
      {form.kind === "essentials" && <><label>Faculty<input maxLength={160} value={form.faculty} onChange={(event) => setForm({ ...form, faculty: event.target.value })} placeholder={faculty || "Faculty name"} /></label><label>Usual room<input maxLength={80} value={form.room} onChange={(event) => setForm({ ...form, room: event.target.value })} placeholder={room || "Room"} /></label><label>Syllabus link<input type="url" maxLength={2048} value={form.syllabusUrl} onChange={(event) => setForm({ ...form, syllabusUrl: event.target.value })} placeholder="https://" /></label><label>Grading breakdown<textarea maxLength={500} rows={3} value={form.grading} onChange={(event) => setForm({ ...form, grading: event.target.value })} placeholder="e.g. quizzes 20%, project 30%, final 50%" /></label></>}
      {form.kind === "topic" && <><label>Topic<input autoFocus maxLength={120} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="Pricing strategy" /></label><label>Recall question<input maxLength={240} value={form.question} onChange={(event) => setForm({ ...form, question: event.target.value })} placeholder="What are the main pricing approaches?" /></label><label>Answer or key points<textarea maxLength={1000} rows={3} value={form.answer} onChange={(event) => setForm({ ...form, answer: event.target.value })} /></label><label className="ch-check-label"><input type="checkbox" checked={form.flagged} onChange={(event) => setForm({ ...form, flagged: event.target.checked })} /> Add to revision queue</label></>}
      {form.kind === "note" && <><label>Class<select value={form.sessionKey} onChange={(event) => setForm({ ...form, sessionKey: event.target.value })}>{form.sessionKey && !past.some((session) => sessionKey(session) === form.sessionKey) && <option value={form.sessionKey}>Original class (timetable changed)</option>}{past.map((session) => <option key={sessionKey(session)} value={sessionKey(session)}>{labelDate(session.date)} · {session.start}{session.session ? ` · ${session.session}` : ""}</option>)}</select></label><label>Key takeaway<textarea autoFocus maxLength={1000} rows={3} value={form.takeaway} onChange={(event) => setForm({ ...form, takeaway: event.target.value })} /></label><label>Doubt to clarify<textarea maxLength={500} rows={2} value={form.doubt} onChange={(event) => setForm({ ...form, doubt: event.target.value })} /></label><label>Follow-up<textarea maxLength={500} rows={2} value={form.followUp} onChange={(event) => setForm({ ...form, followUp: event.target.value })} /></label></>}
      {error && <p role="alert" className="ch-error">{error}</p>}<div className="ch-modal-actions"><button type="button" onClick={closeForm}>Cancel</button><button type="submit"><Check size={15} /> Save</button></div></form></div>}
  </>;
}
