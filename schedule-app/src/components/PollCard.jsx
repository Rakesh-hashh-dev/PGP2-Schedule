import { useCallback, useEffect, useMemo, useState } from "react";
import { BarChart3, Check, Lock, Plus, Trash2, X } from "lucide-react";
import { fetchPoll, fetchPollVotes, votePoll, closePoll, deletePoll, subscribePoll, pollIsClosed } from "../lib/polls.js";
import "../styles/polls.css";
import ReportContentButton from './ReportContentDialog.jsx';

// PollCard — renders one poll (group chat inline, or Announcements for cohort
// scope) with tap-to-vote rows and live result bars. Results show once you've
// voted or the poll is closed. Group-poll voter names are visible to the poll
// creator only; cohort polls are always totals-only.

function timeLeft(closesAt, now) {
  const ms = new Date(closesAt) - now;
  if (ms <= 0) return null;
  const m = Math.round(ms / 60000);
  if (m < 60) return `${m}m left`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h left`;
  return `${Math.round(h / 24)}d left`;
}

export default function PollCard({ poll: initialPoll, pollId, userId, userName, onDeleted }) {
  const [poll, setPoll] = useState(initialPoll || null);
  const [votes, setVotes] = useState(null); // { counts, mine, total, voters }
  const [gone, setGone] = useState(false);
  const id = initialPoll?.id || pollId;
  useEffect(() => {
    if (!id) return;
    let active = true;
    const refresh = () => { if (document.visibilityState !== 'hidden') fetchPoll(id).then(current => { if (active) { setGone(!current || !!current.moderation_hidden); if (current) setPoll(current); } }); };
    const timer = setInterval(refresh, 30000);
    return () => { active = false; clearInterval(timer); };
  }, [id]);

  const optionCount = poll?.options?.length || 0;

  const refreshVotes = useCallback(async () => {
    if (!id || !optionCount) return;
    setVotes(await fetchPollVotes(id, userId, optionCount));
  }, [id, userId, optionCount]);

  useEffect(() => {
    if (!id) return;
    let alive = true;
    (async () => {
      if (!initialPoll) {
        const p = await fetchPoll(id);
        if (!alive) return;
        if (!p) { setGone(true); return; }
        setPoll(p);
      }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (!id || !optionCount) return;
    let alive = true;
    fetchPollVotes(id, userId, optionCount).then(v => { if (alive) setVotes(v); });
    return () => { alive = false; };
  }, [id, userId, optionCount]);

  useEffect(() => {
    if (!id) return;
    const unsub = subscribePoll(id, {
      onVotes: refreshVotes,
      onPoll: (row, eventType) => {
        if (eventType === "DELETE") { setGone(true); return; }
        if (row) setPoll(prev => ({ ...prev, ...row }));
      },
    });
    return unsub;
  }, [id, refreshVotes]);

  const closed = pollIsClosed(poll);
  const mine = votes?.mine || null;
  const hasVoted = !!mine && mine.length > 0;
  const showResults = hasVoted || closed;
  const isCreator = poll && poll.created_by === userId;
  const maxCount = useMemo(() => Math.max(1, ...(votes?.counts || [0])), [votes]);

  if (gone) return null;
  if (!poll) return <div className="poll-card poll-loading">Loading poll…</div>;

  async function handlePick(idx) {
    if (closed) return;
    let next;
    if (poll.multi) {
      const cur = new Set(mine || []);
      if (cur.has(idx)) cur.delete(idx); else cur.add(idx);
      next = [...cur];
    } else {
      next = mine?.[0] === idx ? [] : [idx];
    }
    // Optimistic: reflect my vote immediately, realtime confirms
    setVotes(prev => {
      if (!prev) return prev;
      const counts = [...prev.counts];
      for (const i of prev.mine || []) counts[i] = Math.max(0, counts[i] - 1);
      for (const i of next) counts[i]++;
      const hadVote = (prev.mine || []).length > 0;
      const hasVote = next.length > 0;
      return { ...prev, counts, mine: next, total: prev.total + (hasVote ? 1 : 0) - (hadVote ? 1 : 0) };
    });
    await votePoll(poll.id, userId, userName, next);
  }

  const ended = poll.closes_at && !poll.closed ? timeLeft(poll.closes_at, new Date()) : null;

  return (
    <div className={`poll-card${closed ? " is-closed" : ""}`}>
      {!isCreator && <ReportContentButton type="poll" contentId={id} />}
      <div className="poll-head">
        <span className="poll-tag"><BarChart3 size={12} /> Poll{poll.multi ? " · multi" : ""}</span>
        <span className="poll-meta">
          {closed ? <span className="poll-closed-tag"><Lock size={10} /> Closed</span> : ended}
        </span>
      </div>
      <div className="poll-q">{poll.question}</div>
      {poll.created_by_name && <div className="poll-by">by {isCreator ? "you" : poll.created_by_name}</div>}

      <div className="poll-opts">
        {poll.options.map((opt, idx) => {
          const count = votes?.counts?.[idx] ?? 0;
          const pct = showResults && votes?.total ? Math.round((count / maxCount) * 100) : 0;
          const picked = mine?.includes(idx);
          return (
            <button
              key={idx}
              type="button"
              className={`poll-opt${picked ? " is-mine" : ""}${showResults ? " show-results" : ""}`}
              disabled={closed}
              onClick={() => handlePick(idx)}
            >
              {showResults && <span className="poll-opt-bar" style={{ width: `${pct}%` }} />}
              <span className="poll-opt-label">
                <span className={`poll-opt-tick${picked ? " on" : ""}`}>{picked && <Check size={11} />}</span>
                {opt}
              </span>
              {showResults && <span className="poll-opt-count">{count}</span>}
            </button>
          );
        })}
      </div>

      <div className="poll-foot">
        <span>{votes ? `${votes.total} vote${votes.total === 1 ? "" : "s"}` : ""}</span>
        {isCreator && poll.scope === "group" && showResults && votes?.voters?.length > 0 && (
          <span className="poll-voters" title={votes.voters.map(v => v.name).join(", ")}>
            {votes.voters.slice(0, 3).map(v => v.name).join(", ")}{votes.voters.length > 3 ? ` +${votes.voters.length - 3}` : ""}
          </span>
        )}
        {isCreator && (
          <span className="poll-actions">
            {!closed && (
              <button type="button" className="poll-mini-btn" onClick={() => { setPoll(p => ({ ...p, closed: true })); closePoll(poll.id); }}>
                <Lock size={11} /> Close
              </button>
            )}
            <button type="button" className="poll-mini-btn poll-danger" onClick={async () => { if (await deletePoll(poll.id)) { setGone(true); onDeleted?.(poll.id); } }}>
              <Trash2 size={11} /> Delete
            </button>
          </span>
        )}
      </div>
    </div>
  );
}

// Inline composer — used by the group-chat "+ Poll" button and the admin
// cohort-poll tool. Calls onSubmit({ question, options, multi, closesAt }).
export function PollComposer({ onSubmit, onCancel, busy = false, allowDuration = true }) {
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", ""]);
  const [multi, setMulti] = useState(false);
  const [duration, setDuration] = useState("0"); // hours; 0 = no auto-close

  const validOptions = options.map(o => o.trim()).filter(Boolean);
  const canSubmit = question.trim().length > 0 && validOptions.length >= 2 && !busy;

  function submit(e) {
    e?.preventDefault();
    if (!canSubmit) return;
    const hrs = Number(duration);
    onSubmit({
      question: question.trim(),
      options: validOptions,
      multi,
      closesAt: hrs > 0 ? new Date(Date.now() + hrs * 3600_000).toISOString() : null,
    });
  }

  return (
    <form className="poll-composer" onSubmit={submit}>
      <div className="poll-composer-head">
        <span className="poll-tag"><BarChart3 size={12} /> New poll</span>
        <button type="button" className="poll-mini-btn" onClick={onCancel} aria-label="Cancel poll"><X size={12} /></button>
      </div>
      <input
        className="poll-input"
        placeholder="Ask a question…"
        maxLength={200}
        value={question}
        onChange={e => setQuestion(e.target.value)}
        autoFocus
      />
      {options.map((opt, i) => (
        <div key={i} className="poll-opt-row">
          <input
            className="poll-input poll-input-opt"
            placeholder={`Option ${i + 1}`}
            maxLength={80}
            value={opt}
            onChange={e => setOptions(prev => prev.map((o, j) => (j === i ? e.target.value : o)))}
          />
          {options.length > 2 && (
            <button type="button" className="poll-mini-btn" aria-label="Remove option" onClick={() => setOptions(prev => prev.filter((_, j) => j !== i))}>
              <X size={12} />
            </button>
          )}
        </div>
      ))}
      {options.length < 6 && (
        <button type="button" className="poll-add-opt" onClick={() => setOptions(prev => [...prev, ""])}>
          <Plus size={12} /> Add option
        </button>
      )}
      <div className="poll-composer-foot">
        <label className="poll-check">
          <input type="checkbox" checked={multi} onChange={e => setMulti(e.target.checked)} /> Multiple answers
        </label>
        {allowDuration && (
          <select className="poll-select" value={duration} onChange={e => setDuration(e.target.value)} aria-label="Auto-close">
            <option value="0">No auto-close</option>
            <option value="1">Closes in 1h</option>
            <option value="6">Closes in 6h</option>
            <option value="24">Closes in 1 day</option>
            <option value="72">Closes in 3 days</option>
          </select>
        )}
        <button type="submit" className="poll-submit" disabled={!canSubmit}>{busy ? "Posting…" : "Post poll"}</button>
      </div>
    </form>
  );
}
