import { useEffect, useState } from "react";
import GroupPins from "./GroupPins.jsx";
import MeetupsStrip from "./Meetups.jsx";
import PollCard, { PollComposer } from "./PollCard.jsx";
import { supabase } from "../lib/supabase.js";
import { createPoll, POLL_MARKER } from "../lib/polls.js";
import { sendGroupChatMessage, sendSocialNotification } from "../lib/friends.js";

function GroupPolls({ group, userId, userName }) {
  const [polls, setPolls] = useState(null);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const [compose, setCompose] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let alive = true;
    const load = async () => {
      const result = await supabase.from("polls").select("id").eq("scope", "group").eq("group_id", group.id).order("created_at", { ascending: false });
      if (!alive) return;
      if (result.error) setError("Could not load group polls.");
      else { setPolls(result.data || []); setError(""); }
    };
    load().catch(() => { if (alive) setError("Could not load group polls."); });
    const channel = supabase.channel(`workspace-polls:${group.id}`).on("postgres_changes", { event: "*", schema: "public", table: "polls", filter: `group_id=eq.${group.id}` }, load).subscribe();
    return () => { alive = false; supabase.removeChannel(channel); };
  }, [group.id, reload]);
  const create = async input => {
    setBusy(true); setError("");
    try {
      const poll = await createPoll({ ...input, scope: "group", groupId: group.id, userId, userName });
      if (!poll) throw new Error("Could not create the poll. Your choices are kept here; try again.");
      setPolls(current => [{ id: poll.id }, ...(current || []).filter(row => row.id !== poll.id)]); setCompose(false);
      try { await sendGroupChatMessage(group.id, userId, userName, `${POLL_MARKER}${poll.id}`); }
      catch { setError("Poll saved, but its chat announcement could not be sent. The poll remains available here."); }
      for (const id of new Set([...(group.cloudMemberIds || []), ...(group.inviteMembers || []).map(member => member.userId)])) if (id !== userId) sendSocialNotification(id, "group_poll", { fromId: userId, fromName: userName, group: group.name, pollId: poll.id });
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  };
  return <div className="fr-workspace-polls">
    <button type="button" className="fr-btn fr-btn-secondary" onClick={() => setCompose(value => !value)} aria-expanded={compose}>Create poll</button>
    {compose && <PollComposer onSubmit={create} onCancel={() => setCompose(false)} busy={busy} />}
    {error && <p className="fr-meetup-error" role="alert">{error} <button type="button" className="fr-text-button" onClick={() => setReload(value => value + 1)}>Retry loading</button></p>}
    {!polls && !error && <p className="fr-extra-help">Loading polls…</p>}
    {polls?.length === 0 && <p className="fr-extra-help">No polls in this group yet. Create one to gather everyone’s preference.</p>}
    {polls?.map(poll => <PollCard key={poll.id} pollId={poll.id} userId={userId} userName={userName} />)}
  </div>;
}

export default function GroupWorkspace({ group, userId, userName, chat, children, meetupsEnabled, friends, allClasses, enrolled, now, showToast, focusPollId, initialTab }) {
  const key = `pgp2.group-tab:${userId}:${group.id}`;
  const [tab, setTab] = useState(() => { if (initialTab) return initialTab; if (focusPollId) return "chat"; try { return localStorage.getItem(key) || "chat"; } catch { return "chat"; } });
  const tabs = ["chat", ...(meetupsEnabled ? ["plans"] : []), "polls", "pins", "members"];
  const current = tabs.includes(tab) ? tab : "chat";
  const shared = group.isReceived || group.visibility === "shared" || group.visibility === "global" || group.inviteMembers?.length > 0;
  const choose = value => { setTab(value); try { localStorage.setItem(key, value); } catch { /* optional device preference */ } };
  return <div className="fr-group-workspace">
    <div className="fr-group-tabs" role="group" aria-label={`${group.name} workspace sections`}>{tabs.map(value => <button type="button" key={value} className={`fr-btn fr-btn-small${current === value ? " is-active" : ""}`} aria-pressed={current === value} onClick={() => choose(value)}>{value[0].toUpperCase() + value.slice(1)}</button>)}</div>
    <section aria-label={`${group.name} ${current}`}>
      {current === "members" ? children : !shared ? <p className="fr-extra-help">Share this group with members to use {current}. Membership and privacy are available in Members.</p> : <>
        {current === "chat" && chat}
        {current === "plans" && <MeetupsStrip userId={userId} userName={userName} groupId={group.id} group={group} friends={friends} allClasses={allClasses} enrolled={enrolled} now={now} showToast={showToast} />}
        {current === "polls" && <GroupPolls group={group} userId={userId} userName={userName} />}
        {current === "pins" && <GroupPins group={group} userId={userId} userName={userName} />}
      </>}
    </section>
  </div>;
}
