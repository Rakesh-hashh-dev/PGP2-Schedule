import { useState } from "react";
import { buildPushPayload } from "../../supabase/functions/_shared/pushPresentation.ts";
import "../styles/push-preview.css";

export default function PushPreview({ title, body, url, image, when }) {
  const [feedback, setFeedback] = useState("");
  const payload = buildPushPayload({ type: "admin_broadcast", title: title?.trim() || "Notification title", body: body?.trim() || "Your message shows here as you type it.", url: url?.trim(), data: { image } });
  return <section className="android-push-preview" aria-label="Android notification preview">
    <div className="android-push-preview-heading"><strong>Android recipient preview</strong><small>Illustrative · layout varies by device</small></div>
    <div className="android-push-preview-states">
      {[false, true].map(expanded => <div key={String(expanded)}>
        <span className="android-push-state-label">{expanded ? "Expanded" : "Collapsed"}</span>
        <div className={`android-push-card${expanded ? " is-expanded" : ""}`}>
          <div className="android-push-brand"><img src="/icon-notification.png" alt="TermFlow logo" width="28" height="28" /><span>TermFlow</span><small>{when || "now"}</small><span aria-hidden="true">{expanded ? "⌃" : "⌄"}</span></div>
          <strong className="android-push-title">{payload.title}</strong>
          <p className="android-push-body">{payload.body}</p>
          {expanded && payload.image && <img className="android-push-image" src={payload.image} alt="Event poster preview" onError={e => { e.currentTarget.hidden = true; }} onLoad={e => { e.currentTarget.hidden = false; }} />}
          {expanded && <div className="android-push-actions">{payload.actions.map(action => <button key={action.action} type="button" onClick={() => setFeedback(action.action === "dismiss" ? "Dismiss closes the notification without opening the app." : `Read update opens ${action.url}.`)}>{action.title}</button>)}</div>}
        </div>
      </div>)}
    </div>
    <p className="android-push-preview-caption">Tap opens: <strong>{payload.url}</strong></p>
    <p className="android-push-preview-caption" role="status">{feedback || "Try an expanded action above. Preview actions do not send a notification."}</p>
  </section>;
}
