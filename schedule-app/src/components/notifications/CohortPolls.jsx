import { useEffect, useState } from "react";
import { BarChart3, Plus } from "lucide-react";
import { fetchCohortPolls, createPoll, pollIsClosed } from "../../lib/polls.js";
import PollCard, { PollComposer } from "../PollCard.jsx";

// Cohort-wide polls on the Announcements page. Open polls sit on top; recently
// closed ones collapse behind a toggle. Creation is admin-only (client-gated,
// same posture as the rest of the admin tooling).
export default function CohortPolls({ userId, userName, isAdmin }) {
  const [polls, setPolls] = useState([]);
  const [showComposer, setShowComposer] = useState(false);
  const [showClosed, setShowClosed] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    fetchCohortPolls().then(rows => { if (alive) setPolls(rows); });
    return () => { alive = false; };
  }, []);

  const open = polls.filter(p => !pollIsClosed(p));
  const closed = polls.filter(p => pollIsClosed(p));

  async function handleCreate({ question, options, multi, closesAt }) {
    setBusy(true);
    const poll = await createPoll({ scope: "cohort", userId, userName, question, options, multi, closesAt });
    setBusy(false);
    if (!poll) return;
    setShowComposer(false);
    setPolls(prev => [poll, ...prev]);
  }

  if (!isAdmin && open.length === 0 && closed.length === 0) return null;

  return (
    <div className="poll-cohort-wrap">
      {(open.length > 0 || isAdmin) && (
        <div className="poll-cohort-head">
          <span className="poll-tag"><BarChart3 size={12} /> Cohort polls</span>
          {isAdmin && !showComposer && (
            <button type="button" className="poll-mini-btn" onClick={() => setShowComposer(true)}>
              <Plus size={11} /> New poll
            </button>
          )}
        </div>
      )}
      {showComposer && <PollComposer onSubmit={handleCreate} onCancel={() => setShowComposer(false)} busy={busy} />}
      {open.map(p => (
        <PollCard key={p.id} poll={p} userId={userId} userName={userName} onDeleted={(id) => setPolls(prev => prev.filter(x => x.id !== id))} />
      ))}
      {closed.length > 0 && (
        <>
          <button type="button" className="poll-closed-toggle" onClick={() => setShowClosed(o => !o)}>
            {showClosed ? "Hide" : "Show"} {closed.length} closed poll{closed.length === 1 ? "" : "s"}
          </button>
          {showClosed && closed.map(p => (
            <PollCard key={p.id} poll={p} userId={userId} userName={userName} onDeleted={(id) => setPolls(prev => prev.filter(x => x.id !== id))} />
          ))}
        </>
      )}
    </div>
  );
}
