import { useMemo, useRef, useState } from "react";
import { ArrowLeft, Sparkles, Clock, ClipboardList, CalendarOff, Flame, GraduationCap, UtensilsCrossed, Share2, Download, Check } from "lucide-react";
import { buildWrapped } from "../lib/wrapped.js";
import { subjectClass } from "../lib/subjectColors.js";
import "../styles/wrapped.css";

// TermFlow Wrapped — story-style end-of-term recap. All stats come from
// lib/wrapped.js (local data only); the share card is drawn on a canvas and
// handed to the Web Share API (download fallback).

function drawShareCard(stats, termLabel, userName) {
  const W = 1080, H = 1350;
  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d");

  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, "#241046");
  bg.addColorStop(1, "#0B0D11");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // soft glow
  const glow = ctx.createRadialGradient(W * 0.3, H * 0.18, 60, W * 0.3, H * 0.18, 700);
  glow.addColorStop(0, "rgba(139,122,232,0.35)");
  glow.addColorStop(1, "rgba(139,122,232,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  ctx.textBaseline = "top";
  ctx.fillStyle = "#8B7AE8";
  ctx.font = "700 34px Inter, system-ui, sans-serif";
  ctx.fillText("TERMFLOW WRAPPED", 80, 90);

  ctx.fillStyle = "#FFFFFF";
  ctx.font = "800 88px 'Bricolage Grotesque', Inter, system-ui, sans-serif";
  ctx.fillText(termLabel || "My Term", 80, 150);
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.font = "500 34px Inter, system-ui, sans-serif";
  ctx.fillText(userName || "", 80, 260);

  const rows = [
    [String(stats.heldSessions), "classes held"],
    [`${stats.totalHrs}h`, "in the classroom"],
    stats.attendancePct !== null ? [`${stats.attendancePct}%`, "attendance"] : null,
    stats.busiestWeek ? [`${stats.busiestWeek.hrs}h`, stats.busiestWeek.label.toLowerCase()] : null,
    stats.earliest ? [stats.earliest.time, "earliest start survived"] : null,
    stats.mostSkipped ? [String(stats.mostSkipped.absent), `${stats.mostSkipped.code} skips (no judgement)`] : null,
    [String(stats.examsTaken), "exams taken"],
  ].filter(Boolean);

  let y = 360;
  for (const [num, label] of rows) {
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "800 72px 'Bricolage Grotesque', Inter, system-ui, sans-serif";
    ctx.fillText(num, 80, y);
    const numWidth = ctx.measureText(num).width;
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.font = "500 36px Inter, system-ui, sans-serif";
    ctx.fillText(label, 80 + numWidth + 28, y + 28);
    y += 118;
  }

  ctx.fillStyle = "rgba(255,255,255,0.4)";
  ctx.font = "600 30px Inter, system-ui, sans-serif";
  ctx.fillText("pgp2.termflow.tech", 80, H - 110);

  return canvas;
}

export default function WrappedView({ visible, legend, attendance, now, termLabel, userName, onBack }) {
  const stats = useMemo(() => buildWrapped(visible, legend, attendance, now), [visible, legend, attendance, now]);
  const [shared, setShared] = useState(false);
  const busyRef = useRef(false);

  async function handleShare() {
    if (!stats || busyRef.current) return;
    busyRef.current = true;
    try {
      const canvas = drawShareCard(stats, termLabel, userName);
      const blob = await new Promise(res => canvas.toBlob(res, "image/png"));
      if (!blob) return;
      const file = new File([blob], "termflow-wrapped.png", { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: "TermFlow Wrapped" });
      } else {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "termflow-wrapped.png";
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      }
      setShared(true);
      setTimeout(() => setShared(false), 2500);
    } catch { /* user cancelled the share sheet */ }
    finally { busyRef.current = false; }
  }

  if (!stats) {
    return (
      <div className="wrapped">
        <button type="button" className="wrapped-back" onClick={onBack}><ArrowLeft size={15} /> Back</button>
        <div className="wrapped-card wrapped-intro" style={{ animationDelay: "0s" }}>
          <Sparkles size={22} />
          <h2>Wrapped isn&rsquo;t ready yet</h2>
          <p>Come back once a bit more of the term has happened — there isn&rsquo;t enough class data to recap yet.</p>
        </div>
      </div>
    );
  }

  let i = 0;
  const delay = () => ({ animationDelay: `${(i++) * 0.12}s` });

  return (
    <div className="wrapped">
      <button type="button" className="wrapped-back" onClick={onBack}><ArrowLeft size={15} /> Back</button>

      <div className="wrapped-card wrapped-intro" style={delay()}>
        <span className="wrapped-eyebrow"><Sparkles size={13} /> TermFlow Wrapped</span>
        <h2>{termLabel || "Your term"}, recapped</h2>
        <p>{userName ? `${userName}, here` : "Here"}&rsquo;s what your term looked like — from your own schedule and attendance data.</p>
      </div>

      <div className="wrapped-card" style={delay()}>
        <span className="wrapped-ico wrapped-ico-violet"><Clock size={17} /></span>
        <div className="wrapped-big">{stats.totalHrs}<span className="wrapped-unit">hrs</span></div>
        <p className="wrapped-sub">{stats.heldSessions} classes across {stats.courseCount} courses.</p>
        {stats.topCourse && (
          <p className="wrapped-note">
            Most of it in <span className={`ses ${subjectClass(stats.topCourse.code)}`}>{stats.topCourse.code}</span> — {stats.topCourse.hrs}h of {stats.topCourse.name}.
          </p>
        )}
      </div>

      {stats.attendancePct !== null && (
        <div className="wrapped-card" style={delay()}>
          <span className="wrapped-ico wrapped-ico-live"><ClipboardList size={17} /></span>
          <div className="wrapped-big">{stats.attendancePct}<span className="wrapped-unit">%</span></div>
          <p className="wrapped-sub">attendance on the {stats.marked} sessions you marked ({stats.present} present · {stats.absent} skipped).</p>
          {stats.bestAttended && (
            <p className="wrapped-note">
              Star pupil in <span className={`ses ${subjectClass(stats.bestAttended.code)}`}>{stats.bestAttended.code}</span> — {stats.bestAttended.pct}% showed up.
            </p>
          )}
        </div>
      )}

      {stats.mostSkipped && (
        <div className="wrapped-card" style={delay()}>
          <span className="wrapped-ico wrapped-ico-amber"><CalendarOff size={17} /></span>
          <div className="wrapped-big">{stats.mostSkipped.absent}<span className="wrapped-unit">skips</span></div>
          <p className="wrapped-sub">
            Your most-dodged course: <span className={`ses ${subjectClass(stats.mostSkipped.code)}`}>{stats.mostSkipped.code}</span> {stats.mostSkipped.name}. No judgement.
          </p>
        </div>
      )}

      {(stats.busiestWeek || stats.busiestDay || stats.earliest) && (
        <div className="wrapped-card" style={delay()}>
          <span className="wrapped-ico wrapped-ico-danger"><Flame size={17} /></span>
          {stats.busiestWeek && <div className="wrapped-big">{stats.busiestWeek.hrs}<span className="wrapped-unit">hrs</span></div>}
          {stats.busiestWeek && <p className="wrapped-sub">in your heaviest week — {stats.busiestWeek.label}.</p>}
          {stats.busiestDay && <p className="wrapped-note">Longest day: {stats.busiestDay.count} classes on {stats.busiestDay.label}.</p>}
          {stats.earliest && <p className="wrapped-note">And you survived {stats.earliest.count} × {stats.earliest.time} starts. Respect.</p>}
        </div>
      )}

      {(stats.examsTaken > 0 || stats.assignmentsTotal > 0) && (
        <div className="wrapped-card" style={delay()}>
          <span className="wrapped-ico wrapped-ico-blue"><GraduationCap size={17} /></span>
          <div className="wrapped-big">{stats.examsTaken}<span className="wrapped-unit">exams</span></div>
          <p className="wrapped-sub">
            faced so far{stats.assignmentsTotal > 0 ? `, plus ${stats.assignmentsDone}/${stats.assignmentsTotal} assignments ticked off.` : "."}
          </p>
        </div>
      )}

      {(stats.likedDishes.length > 0 || stats.favouriteCount > 0) && (
        <div className="wrapped-card" style={delay()}>
          <span className="wrapped-ico wrapped-ico-amber"><UtensilsCrossed size={17} /></span>
          <div className="wrapped-big">{stats.likedDishes.length || stats.favouriteCount}<span className="wrapped-unit">dishes</span></div>
          <p className="wrapped-sub">
            {stats.likedDishes.length > 0
              ? <>got your thumbs-up in the mess{stats.likedDishes.length > 0 && <> — top of the list: {stats.likedDishes.slice(0, 3).join(", ")}.</>}</>
              : <>starred as mess favourites.</>}
          </p>
          {stats.dislikedDishes.length > 0 && <p className="wrapped-note">({stats.dislikedDishes.length} dishes… did not make the cut.)</p>}
        </div>
      )}

      <div className="wrapped-card wrapped-share" style={delay()}>
        <h3>Share your Wrapped</h3>
        <p className="wrapped-sub">Get it as an image for your story / group chat.</p>
        <button type="button" className="wrapped-share-btn" onClick={handleShare}>
          {shared ? <><Check size={15} /> Done!</> : navigator.canShare ? <><Share2 size={15} /> Share image</> : <><Download size={15} /> Download image</>}
        </button>
      </div>
    </div>
  );
}
