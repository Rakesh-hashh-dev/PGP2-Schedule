import { AlertTriangle, ExternalLink, RefreshCw, X } from "lucide-react";
import { REGISTRO_FEEDBACK_URL } from "../lib/registroSync.js";
import "../styles/cancellation.css";

export default function FeedbackAlert({
  pendingCourses = [],
  feedbackUrl = REGISTRO_FEEDBACK_URL,
  onOpenRegistroSync,
  onDismissCourse,
  onDismissAll,
  compact = false,
}) {
  if (!pendingCourses.length) return null;

  return (
    <section className={`cx-alert cx-alert-warn${compact ? " compact" : ""}`} role="alert" aria-label="Registro feedback reminder">
      <div className="cx-alert-ico cx-alert-ico-warn">
        <AlertTriangle size={18} />
      </div>
      <div className="cx-alert-body">
        <div className="cx-alert-head-row">
          <div className="cx-alert-title">
            {pendingCourses.length === 1
              ? "Course feedback pending on Registro (1 Grade Drop risk)"
              : `${pendingCourses.length} course feedbacks pending on Registro (1 Grade Drop risk)`}
          </div>
          <div className="cx-alert-head-actions">
            <a
              className="cx-alert-cta"
              href={feedbackUrl || REGISTRO_FEEDBACK_URL}
              target="_blank"
              rel="noopener noreferrer"
            >
              <span>Submit on Registro</span>
              <ExternalLink size={12} aria-hidden="true" />
            </a>
            {onOpenRegistroSync && (
              <button
                type="button"
                className="cx-alert-secondary"
                onClick={onOpenRegistroSync}
                title="Re-sync status from Registro"
              >
                <RefreshCw size={12} aria-hidden="true" />
                <span>Re-sync</span>
              </button>
            )}
            {onDismissAll && (
              <button
                type="button"
                className="cx-alert-dismiss"
                aria-label="Dismiss feedback alerts"
                onClick={onDismissAll}
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>
        <ul className="cx-alert-list">
          {pendingCourses.map((course) => (
            <li key={course.code} className="cx-alert-item">
              <div className="cx-alert-item-copy">
                <strong>{course.name || course.code}</strong>
                <span>
                  {course.code}
                  {course.feedbackInfo ? ` · ${course.feedbackInfo}` : " · Feedback not given"}
                </span>
              </div>
              {onDismissCourse && (
                <button
                  type="button"
                  className="cx-alert-dismiss"
                  aria-label={`Dismiss feedback reminder for ${course.code}`}
                  onClick={() => onDismissCourse(course.code)}
                >
                  <X size={13} />
                </button>
              )}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
