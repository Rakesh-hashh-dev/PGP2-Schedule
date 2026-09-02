import { useMemo, useState } from "react";
import { ArrowLeft, History, Image, Share2, Sparkles } from "lucide-react";
import { buildWrapped, buildWrappedComparison } from "../lib/wrapped.js";
import {
  AttendanceDonut,
  BeyondClassroom,
  CourseLoadBars,
  MomentsTimeline,
  WeeklyLoadChart,
  WeeklyRhythmHeatmap,
} from "./wrapped/WrappedCharts.jsx";
import WrappedShareSheet from "./wrapped/WrappedShareSheet.jsx";
import WrappedDetailModal from "./wrapped/WrappedDetailModal.jsx";
import { WrappedComparison, WrappedIdentity } from "./wrapped/WrappedInsights.jsx";
import "../styles/wrapped.css";

export default function WrappedView({ visible, legend, attendance, now, termLabel, userName, isArchived = false, previousTerm, previousTermNumber, onViewPrevious, onBack }) {
  const stats = useMemo(
    () => buildWrapped(visible, legend, attendance, now, { includeLocalExtras: !isArchived }),
    [visible, legend, attendance, now, isArchived],
  );
  const previousStats = useMemo(
    () => previousTerm ? buildWrapped(previousTerm.visible, previousTerm.legend, previousTerm.attendance || {}, previousTerm.now, { includeLocalExtras: false }) : null,
    [previousTerm],
  );
  const comparison = useMemo(
    () => buildWrappedComparison(stats, previousStats, termLabel || "This term", previousTerm?.termLabel || "Previous term"),
    [stats, previousStats, termLabel, previousTerm?.termLabel],
  );
  const [shareOpen, setShareOpen] = useState(false);
  const [detail, setDetail] = useState(null);

  if (!stats) {
    return (
      <div className="wrapped wrapped-empty">
        <button type="button" className="wrapped-back" onClick={onBack}><ArrowLeft size={15} /> Back</button>
        <section className="wrapped-empty-card">
          <span className="wrapped-empty-icon"><Sparkles size={24} aria-hidden="true" /></span>
          <span className="wrapped-eyebrow">TermFlow Wrapped</span>
          <h1>Not enough story yet</h1>
          <p>Wrapped unlocks after ten regular classes have finished. Exams and future sessions do not count toward that threshold.</p>
          {onViewPrevious && previousTermNumber && previousTerm && (
            <button type="button" className="wrapped-prev-cta" onClick={onViewPrevious}>
              <History size={15} aria-hidden="true" /> See your Term {previousTermNumber} Wrapped
            </button>
          )}
        </section>
      </div>
    );
  }

  const attendanceValue = stats.attendancePct === null ? "—" : `${stats.attendancePct}%`;
  const displayName = userName?.trim();

  return (
    <div className="wrapped">
      <header className="wrapped-topbar">
        <button type="button" className="wrapped-back" onClick={onBack}><ArrowLeft size={15} /> Back</button>
        <div className="wrapped-topbar-title">
          <strong>Term Wrapped</strong>
          <span>{isArchived ? <><History size={12} aria-hidden="true" /> Archived recap</> : "Your recap so far"}</span>
        </div>
        <button type="button" className="wrapped-top-share" onClick={() => setShareOpen(true)}><Share2 size={15} /> Share recap</button>
      </header>

      <section className="wrapped-hero">
        <div className="wrapped-hero-glow" aria-hidden="true" />
        <span className="wrapped-eyebrow"><Sparkles size={13} aria-hidden="true" /> TermFlow Wrapped</span>
        <h1>{displayName ? `${displayName}, your term had range.` : "Your term had range."}</h1>
        <p>{termLabel || "Your term"} — where your time went, when the pressure peaked, and how consistently you showed up.</p>
        <div className="wrapped-hero-metrics">
          <div><strong>{stats.totalHrs}</strong><span>classroom hours</span></div>
          <div><strong>{attendanceValue}</strong><span>{stats.marked ? "attendance" : "not marked"}</span></div>
          <div><strong>{stats.courseCount}</strong><span>courses</span></div>
        </div>
        {onViewPrevious && previousTermNumber && previousTerm && (
          <button type="button" className="wrapped-prev-cta wrapped-prev-cta--hero" onClick={onViewPrevious}>
            <History size={15} aria-hidden="true" /> See your Term {previousTermNumber} Wrapped
          </button>
        )}
      </section>

      <WrappedIdentity archetype={stats.archetype} insights={stats.insights} />

      <WrappedComparison comparison={comparison} />

      <div className="wrapped-dashboard">
        <div className="wrapped-column wrapped-column-main">
          <section className="wrapped-panel">
            <div className="wrapped-panel-head">
              <div><h2>Your workload, week by week</h2><p>Classroom hours across completed weeks.</p></div>
              {stats.busiestWeek && <span className="wrapped-insight">Peak · {stats.busiestWeek.hours}h</span>}
            </div>
            <WeeklyLoadChart weeks={stats.weeklyLoad} onSelectWeek={(week) => setDetail({ type: "week", data: week })} />
          </section>

          <section className="wrapped-panel">
            <div className="wrapped-panel-head">
              <div><h2>Where your time went</h2><p>Top courses ranked by classroom hours.</p></div>
              {stats.topCourse && <span className="wrapped-insight">{stats.topCourse.code} led</span>}
            </div>
            <CourseLoadBars courses={stats.courses} mostSkipped={stats.mostSkipped} onSelectCourse={(course) => setDetail({ type: "course", data: course })} />
          </section>
        </div>

        <div className="wrapped-column wrapped-column-side">
          <section className="wrapped-panel">
            <div className="wrapped-panel-head">
              <div><h2>Attendance, honestly</h2><p>Unmarked sessions stay visible instead of disappearing from the story.</p></div>
            </div>
            <AttendanceDonut attendance={stats.attendance} confidence={stats.confidence} />
          </section>

          <section className="wrapped-panel">
            <div className="wrapped-panel-head">
              <div><h2>Your weekly rhythm</h2><p>Class density by weekday and time of day.</p></div>
            </div>
            <WeeklyRhythmHeatmap rhythm={stats.rhythm} />
          </section>

          <section className="wrapped-panel">
            <div className="wrapped-panel-head">
              <div><h2>Moments that defined it</h2><p>Useful extremes rather than vanity scores.</p></div>
            </div>
            <MomentsTimeline stats={stats} />
          </section>
        </div>
      </div>

      {!isArchived && <BeyondClassroom stats={stats} />}

      <section className="wrapped-story-cta">
        <span className="wrapped-story-icon"><Image size={20} aria-hidden="true" /></span>
        <div><h2>Turn this recap into a story</h2><p>Choose up to three slides, preview the topics, then share or download them.</p></div>
        <button type="button" onClick={() => setShareOpen(true)}>Create story</button>
      </section>

      <WrappedShareSheet
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        stats={stats}
        termLabel={termLabel}
        userName={displayName}
      />
      <WrappedDetailModal detail={detail} onClose={() => setDetail(null)} />
    </div>
  );
}
