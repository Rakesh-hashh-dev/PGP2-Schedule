import { useState } from "react";
import { buildPushPayload } from "../../supabase/functions/_shared/pushPresentation.ts";
import "../styles/push-preview.css";

export default function PushPreview({ title, body, url, image, when, type = 'admin_broadcast', data }) {
  const [feedback, setFeedback] = useState("");
  const [platform, setPlatform] = useState('pc');
  const payload = buildPushPayload({ type, title: title?.trim() || "Notification title", body: body?.trim() || "Your message shows here as you type it.", url: url?.trim(), data: { ...data, image } });
  return <section className={`android-push-preview push-preview-${platform}`} aria-label="Notification recipient preview">
    <div className="android-push-preview-heading"><strong>Recipient preview</strong><small>Illustrative · layout varies by device</small></div>
    <div className="push-preview-platforms" role="group" aria-label="Preview platform">
      {[['pc', 'PC / Windows'], ['android', 'Android'], ['ios', 'iPhone']].map(([key, label]) => <button key={key} type="button" aria-pressed={platform === key} onClick={() => { setPlatform(key); setFeedback(''); }}>{label}</button>)}
    </div>
    <div className="android-push-preview-states">
      {[false, true].map(expanded => <div key={String(expanded)}>
        <span className="android-push-state-label">{expanded ? "Expanded" : "Collapsed"}</span>
        <div className={`android-push-card${expanded ? " is-expanded" : ""}`}>
          <div className="android-push-brand"><img src="/icon-notification.png" alt="TermFlow logo" width="28" height="28" /><span>TermFlow</span><small>{when || "now"}</small><span aria-hidden="true">{expanded ? "⌃" : "⌄"}</span></div>
          <strong className="android-push-title">{payload.title}</strong>
          <p className="android-push-body">{payload.body}</p>
          {expanded && payload.image && <img className="android-push-image" src={payload.image} alt="Event poster preview" onError={e => { e.currentTarget.hidden = true; }} onLoad={e => { e.currentTarget.hidden = false; }} />}
          {expanded && platform !== 'ios' && <div className="android-push-actions">{payload.actions.map(action => <button key={action.action} type="button" onClick={() => setFeedback(action.action === "dismiss" ? "Dismiss closes the notification without opening the app." : `${action.title} opens ${action.url}.`)}>{action.title}</button>)}</div>}
        </div>
      </div>)}
    </div>
    <p className="android-push-preview-caption">Tap opens: <strong>{payload.url}</strong></p>
    <button className="push-preview-tap" type="button" onClick={() => setFeedback(`Notification tap opens ${payload.url}.`)}>Simulate notification tap</button>
    <p className="android-push-preview-caption" role="status">{feedback || "Preview actions do not send a notification. Keep essential details in the title and message."}</p>
    <p className="android-push-preview-caption">{platform === 'ios' ? 'Body-tap preview; action buttons are not assumed.' : 'The browser controls text clipping and available action buttons.'}</p>
  </section>;
}
