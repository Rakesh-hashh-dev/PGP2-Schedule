import { Fragment, useState, useEffect, useLayoutEffect, useRef, useCallback } from "react";
import { Pin, Pencil, Trash2, BarChart3, Reply } from "lucide-react";
import { SkeletonText } from "./ui.jsx";
import ReportContentButton from "./ReportContentDialog.jsx";
import PollCard, { PollComposer } from "./PollCard.jsx";
import { createPoll, POLL_MARKER } from "../lib/polls.js";
import { sendGroupChatMessage, fetchGroupChatMessages, fetchReadableGroupChatMessages, deleteGroupChatMessage, editGroupChatMessage, sendSocialNotification, avatarGradient } from "../lib/friends.js";
import { markGroupRead, loadGroupReads, saveGroupPin } from "../lib/socialActivity.js";
import { supabase } from "../lib/supabase.js";
import { CHAT_PAGE_SIZE, compareChatTimes, mergeChatMessages, reconcileChatMessages, normalizeChatMessage, messageCursor, loadChatDraft, storeChatDraft, firstUnreadMessage, visibleReadCursor } from "../lib/groupChat.js";

export default function GroupChat({ group, userId, userName, focusPollId }) {
  const chatRef = useRef(null);
  const listRef = useRef(null);
  const position = useRef({ initial: true, bottom: false, prepend: null });
  const seenIds = useRef(new Set());
  const cursor = useRef(null);
  const [originalRead, setOriginalRead] = useState(null);
  const cursorReady = useRef(false);
  const [messages, setMessages] = useState([]);
  const loadedMessages = useRef([]);
  useLayoutEffect(() => { loadedMessages.current = messages; }, [messages]);
  const [draft, setDraft] = useState(() => loadChatDraft(userId, group.id));
  const [editingMsg, setEditingMsg] = useState(null);
  const [editText, setEditText] = useState("");
  const [loading, setLoading] = useState(true);
  const [olderBusy, setOlderBusy] = useState(false);
  const [hasOlder, setHasOlder] = useState(false);
  const [showPollComposer, setShowPollComposer] = useState(false);
  const [pollBusy, setPollBusy] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [sending, setSending] = useState(false);
  const [chatError, setChatError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [actionError, setActionError] = useState("");
  const [chatReload, setChatReload] = useState(0);
  const [query, setQuery] = useState("");
  const text = editingMsg ? editText : draft.text;
  const setText = value => editingMsg ? setEditText(value) : setDraft(current => ({ ...current, text: value }));
  useEffect(() => { storeChatDraft(userId, group.id, draft); }, [userId, group.id, draft]);

  useEffect(() => {
    let alive = true;
    const start = async () => {
      try {
        const [rows, read] = await Promise.all([
          fetchGroupChatMessages(group.id),
          supabase.from("social_group_reads").select("seen_at").eq("user_id", userId).eq("group_id", group.id).maybeSingle(),
        ]);
        if (!alive) return;
        if (read.error) throw new Error("Could not load the chat read position. Retry to safely restore unread messages.");
        const cached = loadGroupReads(userId)[group.id];
        cursor.current = compareChatTimes(cached, read.data?.seen_at) > 0 ? cached : read.data?.seen_at || null;
        setOriginalRead(cursor.current); cursorReady.current = true;
        position.current.initial = true;
        setMessages(previous => mergeChatMessages(previous, rows));
        setHasOlder(rows.length === CHAT_PAGE_SIZE); setChatError("");
      } catch (error) { if (alive) setChatError(error.message); }
      finally { if (alive) setLoading(false); }
    };
    start();
    return () => { alive = false; };
  }, [group.id, userId, chatReload]);

  useEffect(() => {
    let alive = true;
    const merge = rows => { if (alive) setMessages(previous => mergeChatMessages(previous, rows)); };
    const channel = supabase.channel(`group-chat:${userId}:${group.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "group_messages", filter: `group_id=eq.${group.id}` }, payload => { if (!payload.new.moderation_hidden) merge([normalizeChatMessage(payload.new)]); })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "group_messages", filter: `group_id=eq.${group.id}` }, payload => { if (alive) setMessages(previous => previous.filter(message => message.id !== payload.old.id)); })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "group_messages", filter: `group_id=eq.${group.id}` }, payload => {
        if (payload.new.moderation_hidden) { if (alive) setMessages(previous => previous.filter(message => message.id !== payload.new.id)); }
        else merge([normalizeChatMessage(payload.new)]);
      }).subscribe();
    let refreshing = false;
    const refresh = async () => {
      if (document.visibilityState !== "visible" || refreshing) return;
      refreshing = true;
      const ids = loadedMessages.current.map(message => message.id);
      try {
        const [recent, readable] = await Promise.all([fetchGroupChatMessages(group.id), fetchReadableGroupChatMessages(group.id, ids)]);
        if (alive) { setMessages(previous => reconcileChatMessages(previous, ids, readable, recent)); setChatError(""); }
      } catch (error) { if (alive) setChatError(error.message); }
      finally { refreshing = false; }
    };
    const timer = setInterval(refresh, 30000);
    window.addEventListener("focus", refresh); window.addEventListener("online", refresh);
    return () => { alive = false; clearInterval(timer); window.removeEventListener("focus", refresh); window.removeEventListener("online", refresh); supabase.removeChannel(channel); };
  }, [group.id, userId]);

  const unreadId = firstUnreadMessage(messages, userId, originalRead);
  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list || loading) return;
    const saved = position.current.prepend;
    if (saved) { list.scrollTop = saved.top + list.scrollHeight - saved.height; position.current.prepend = null; }
    else if (position.current.initial && messages.length) {
      const unread = list.querySelector("[data-unread-start]");
      if (unread) list.scrollTop = unread.offsetTop - list.offsetTop;
      else list.scrollTop = list.scrollHeight;
      position.current.initial = false;
      position.current.bottom = list.scrollHeight - list.clientHeight - list.scrollTop < 24;
    } else if (position.current.bottom && !query) list.scrollTop = list.scrollHeight;
  }, [messages, loading, query]);

  const recordRead = useCallback(() => {
    if (!cursorReady.current || document.visibilityState !== "visible" || query) return;
    const next = visibleReadCursor(messages, seenIds.current, cursor.current, hasOlder);
    if (next) { cursor.current = next; markGroupRead(userId, group.id, next); }
  }, [messages, hasOlder, query, userId, group.id]);
  useEffect(() => {
    const list = listRef.current;
    if (!list || loading || query || !globalThis.IntersectionObserver) return;
    const observer = new IntersectionObserver(entries => {
      const bounds = list.getBoundingClientRect();
      if (document.visibilityState !== "visible" || bounds.top >= window.innerHeight || bounds.bottom <= 0) return;
      for (const entry of entries) if (entry.isIntersecting && entry.intersectionRatio === 1) seenIds.current.add(entry.target.dataset.messageSeen);
      recordRead();
    }, { root: list, threshold: 1 });
    list.querySelectorAll("[data-message-seen]").forEach(node => observer.observe(node));
    document.addEventListener("visibilitychange", recordRead);
    return () => { observer.disconnect(); document.removeEventListener("visibilitychange", recordRead); };
  }, [messages, loading, query, recordRead]);

  useEffect(() => {
    if (!focusPollId || loading) return;
    const node = chatRef.current?.querySelector(`[data-poll-id="${globalThis.CSS.escape(focusPollId)}"]`);
    node?.focus({ preventScroll: true });
    const list = listRef.current;
    if (node && list?.contains(node)) list.scrollTop = node.offsetTop - list.offsetTop;
  }, [focusPollId, loading]);

  const loadOlder = async () => {
    if (olderBusy || !messages.length) return;
    setOlderBusy(true); setChatError("");
    try {
      const rows = await fetchGroupChatMessages(group.id, { before: messageCursor(messages[0]) });
      const list = listRef.current;
      position.current.prepend = list ? { top: list.scrollTop, height: list.scrollHeight } : null;
      position.current.bottom = false;
      setMessages(previous => mergeChatMessages(previous, rows)); setHasOlder(rows.length === CHAT_PAGE_SIZE);
    } catch (error) { setChatError(error.message); } finally { setOlderBusy(false); }
  };
  const pinMessage = async message => {
    setActionError("");
    try { await saveGroupPin({ groupId: group.id, userId, userName, title: `Message from ${message.name}`, body: message.text, url: null, messageId: message.id }); window.dispatchEvent(new CustomEvent("pgp2:social-pins")); }
    catch (error) { setActionError(error.message); }
  };
  const send = async event => {
    event.preventDefault(); if (!text.trim() || sending) return;
    setSending(true); setSaveError("");
    try {
      if (editingMsg) {
        const saved = await editGroupChatMessage(editingMsg.id, userId, text.trim());
        if (!saved) throw new Error("Could not save your edit. Please try again.");
        setMessages(previous => previous.map(message => message.id === editingMsg.id ? { ...message, text: text.trim() } : message));
        setEditingMsg(null); setEditText("");
      } else {
        const message = await sendGroupChatMessage(group.id, userId, userName, text.trim(), draft.replyTo);
        setMessages(previous => mergeChatMessages(previous, [message]));
        setDraft({ text: "", replyTo: null });
      }
    } catch (error) { setSaveError(error.message || "Could not save your message. Please try again."); }
    finally { setSending(false); }
  };
  const remove = async id => {
    setDeletingId(id); setActionError("");
    const ok = await deleteGroupChatMessage(id, userId);
    if (ok) setMessages(previous => previous.filter(message => message.id !== id));
    else setActionError("Could not delete this message. Try again.");
    setDeletingId(null);
  };
  const create = async input => {
    setPollBusy(true); setActionError("");
    try {
      const poll = await createPoll({ ...input, scope: "group", groupId: group.id, userId, userName });
      if (!poll) throw new Error("Could not create the poll. Please try again.");
      setShowPollComposer(false);
      try { const message = await sendGroupChatMessage(group.id, userId, userName, `${POLL_MARKER}${poll.id}`); setMessages(previous => mergeChatMessages(previous, [message])); }
      catch { setActionError("Poll saved, but its chat announcement failed. Find it in the Polls tab."); }
      for (const id of new Set([...(group.cloudMemberIds || []), ...(group.inviteMembers || []).map(member => member.userId)])) if (id !== userId) sendSocialNotification(id, "group_poll", { fromId: userId, fromName: userName, group: group.name, pollId: poll.id });
    } catch (error) { setActionError(error.message); } finally { setPollBusy(false); }
  };
  const shown = messages.filter(message => !query.trim() || `${message.name} ${message.text.startsWith(POLL_MARKER) ? "Group poll" : message.text}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  const replying = messages.find(message => message.id === draft.replyTo);
  return <div className="fr-chat-box" ref={chatRef}>
    <label className="fr-chat-search">Search loaded messages<input type="search" className="fr-add-input" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search names or messages" /></label>
    <p className="fr-extra-help">Showing {messages.length} loaded messages.{hasOlder ? " Load older messages to search more history." : ""}</p>
    {!loading && focusPollId && !messages.some(message => message.text === `${POLL_MARKER}${focusPollId}`) && <div data-poll-id={focusPollId} tabIndex={-1}><PollCard pollId={focusPollId} userId={userId} userName={userName} /></div>}
    <div className="fr-chat-msgs" ref={listRef} onScroll={event => { const list = event.currentTarget; position.current.bottom = list.scrollHeight - list.clientHeight - list.scrollTop < 24; }}>
      {hasOlder && <button type="button" className="fr-btn fr-btn-secondary" disabled={olderBusy} onClick={loadOlder}>{olderBusy ? "Loading older…" : "Load older messages"}</button>}
      {loading ? <SkeletonText lines={3} /> : !shown.length ? <div className="fr-empty">{query ? "No matching messages in loaded history." : "No messages yet. Say hi!"}</div> : shown.map((message, index) => {
        const mine = message.from_id === userId;
        const day = new Date(message.created_at).toLocaleDateString();
        const parent = messages.find(item => item.id === message.reply_to);
        return <Fragment key={message.id}>
          {(index === 0 || day !== new Date(shown[index - 1].created_at).toLocaleDateString()) && <div className="fr-chat-day">{new Date(message.created_at).toLocaleDateString([], { weekday: "short", day: "numeric", month: "short", year: "numeric" })}</div>}
          {message.id === unreadId && <div className="fr-chat-unread" data-unread-start>Unread messages</div>}
          <div className={`fr-chat-message ${mine ? "is-mine" : ""}`}>
            <div className="fr-chat-msg-row" style={{ flexDirection: mine ? "row-reverse" : "row" }}>
              <div className="fr-group-avatar-dot" style={{ background: avatarGradient(message.name)[0], flexShrink: 0 }}>{message.name[0]?.toUpperCase()}</div>
              {message.text.startsWith(POLL_MARKER) ? <div data-poll-id={message.text.slice(POLL_MARKER.length)} tabIndex={-1}><PollCard pollId={message.text.slice(POLL_MARKER.length)} userId={userId} userName={userName} /></div> : <div className={`fr-chat-msg-bubble ${mine ? "fr-chat-msg-mine" : "fr-chat-msg-theirs"}`}>
                {!mine && <div className="fr-chat-msg-name">{message.name}</div>}
                {message.reply_to && <blockquote className="fr-chat-reply-preview">{parent ? `${parent.name}: ${parent.text.startsWith(POLL_MARKER) ? "Group poll" : parent.text.slice(0, 180)}` : "Reply to an earlier or unavailable message"}</blockquote>}
                <span className="fr-chat-text">{message.text}</span>
                {message.id === editingMsg?.id && <small> (Editing)</small>}
              </div>}
            </div>
            <div className="fr-chat-message-meta"><time dateTime={message.created_at}>{new Date(message.created_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</time>
              <div className="fr-chat-message-actions">
                <button type="button" className="fr-chat-del-btn" disabled={sending} aria-label={`Reply to ${message.name}`} onClick={() => { setEditingMsg(null); setDraft(current => ({ ...current, replyTo: message.id })); }}><Reply size={14} /></button>
                {!message.text.startsWith(POLL_MARKER) && <button type="button" className="fr-chat-del-btn" aria-label={`Pin message from ${message.name}`} onClick={() => pinMessage(message)}><Pin size={14} /></button>}
                {!mine && <ReportContentButton type="group_message" contentId={message.id} />}
                {mine && <><button type="button" className="fr-chat-del-btn" disabled={sending} aria-label="Edit message" onClick={() => { setEditingMsg(message); setEditText(message.text); setSaveError(""); }}><Pencil size={14} /></button><button type="button" className="fr-chat-del-btn" disabled={deletingId === message.id} aria-label="Delete message" onClick={() => remove(message.id)}><Trash2 size={14} /></button></>}
              </div>
            </div>
            <span className="fr-chat-seen-marker" data-message-seen={message.id} />
          </div>
        </Fragment>;
      })}
    </div>
    {actionError && <p className="fr-meetup-error" role="alert">{actionError}</p>}
    {chatError && <p className="fr-meetup-error" role="alert">{chatError} <button type="button" className="fr-text-button" onClick={() => setChatReload(value => value + 1)}>Retry</button></p>}
    {saveError && <p className="fr-meetup-error" role="alert">{saveError} Your message stays here until it is saved.</p>}
    {draft.replyTo && !editingMsg && <div className="fr-chat-reply-compose"><span>Replying to {replying ? `${replying.name}: ${replying.text.startsWith(POLL_MARKER) ? "Group poll" : replying.text.slice(0, 100)}` : "an earlier message"}</span><button type="button" className="fr-text-button" onClick={() => setDraft(current => ({ ...current, replyTo: null }))}>Cancel reply</button></div>}
    {showPollComposer && <PollComposer onSubmit={create} onCancel={() => setShowPollComposer(false)} busy={pollBusy} />}
    <form onSubmit={send} className="fr-chat-form">
      <button type="button" className="fr-btn fr-btn-secondary" aria-label="Start a poll" onClick={() => setShowPollComposer(value => !value)}><BarChart3 size={15} /></button>
      <label className="fr-chat-compose-label"><span>{editingMsg ? "Edit your message" : `Message ${group.name}`}</span><input type="text" className="fr-chat-input" value={text} disabled={sending} onChange={event => { setText(event.target.value); setSaveError(""); }} /></label>
      {editingMsg && <button type="button" className="fr-btn fr-btn-secondary" disabled={sending} onClick={() => { setEditingMsg(null); setEditText(""); setSaveError(""); }}>Cancel edit</button>}
      <button type="submit" className="fr-btn fr-btn-primary" disabled={sending || !text.trim()} aria-busy={sending}>{sending ? "Saving…" : saveError ? "Retry" : editingMsg ? "Save" : "Send"}</button>
    </form>
  </div>;
}

