import React, { useEffect, useState, useMemo } from 'react';
import {
  Calendar, Megaphone, SlidersHorizontal, CheckCircle2, AlertTriangle, ArrowRight,
  Check, X, ShieldCheck, History, RotateCcw, BellRing, Eye, Code2, Clock3, Lock,
  ChevronDown, ChevronRight, Copy, RefreshCw, Send, Sparkles, Layers, AlertCircle,
  CalendarClock, Info
} from 'lucide-react';
import {
  domainPayload, loadPublication, PUBLICATION_DOMAINS, publishDomain, scheduleDomain,
  previewScheduleNotices, publishScheduleWithNotice
} from '../lib/adminPublication.js';
import { canonicalJson } from '../lib/adminPublicationDomains.js';
import { hasAdminCapability } from '../lib/adminCapabilities.js';
import { mergeAdminDraft, resolveDraftField } from '../lib/adminDraftMerge.js';
import { supabase } from '../lib/supabase';
import PushPreview from './PushPreview.jsx';
import { scheduleNoticeCopy } from '../../supabase/functions/_shared/notificationCopy.js';
import { subjectClass } from '../lib/subjectColors.js';
import { fmtTime12 } from '../lib/datetime.js';
import '../styles/admin-publishing.css';

const DOMAIN_INFO = {
  schedule: {
    label: 'Schedule',
    kicker: 'Timetable & Classes',
    Icon: Calendar,
    desc: 'Class cancellations, rescheduled timings, room shifts, and examination entries.',
    color: 'violet',
  },
  communications: {
    label: 'Communications',
    kicker: 'Broadcasts & Banners',
    Icon: Megaphone,
    desc: 'Campus announcement banner, student push notices, quick links, and feedback flashes.',
    color: 'blue',
  },
  system: {
    label: 'System & Flags',
    kicker: 'Features & Access',
    Icon: SlidersHorizontal,
    desc: 'Diwali festive decor, companion XP adjustments, maintenance switches, and feature flags.',
    color: 'emerald',
  },
};

function formatIST(isoStr) {
  if (!isoStr) return '';
  const d = new Date(isoStr);
  if (Number.isNaN(d.getTime())) return isoStr;
  return d.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getQuickPresets() {
  const now = new Date();
  const presets = [];

  // Tonight 23:00 IST
  const tonight = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  tonight.setHours(23, 0, 0, 0);
  if (tonight.getTime() > Date.now() + 15 * 60 * 1000) {
    const pad = n => String(n).padStart(2, '0');
    const isoVal = `${tonight.getFullYear()}-${pad(tonight.getMonth() + 1)}-${pad(tonight.getDate())}T23:00`;
    presets.push({ label: 'Tonight 23:00 IST', value: isoVal });
  }

  // Tomorrow 07:00 IST
  const tomorrowMorning = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  tomorrowMorning.setDate(tomorrowMorning.getDate() + 1);
  tomorrowMorning.setHours(7, 0, 0, 0);
  const pad = n => String(n).padStart(2, '0');
  const t07 = `${tomorrowMorning.getFullYear()}-${pad(tomorrowMorning.getMonth() + 1)}-${pad(tomorrowMorning.getDate())}T07:00`;
  presets.push({ label: 'Tomorrow 07:00 IST', value: t07 });

  // Tomorrow 08:30 IST
  const t08 = `${tomorrowMorning.getFullYear()}-${pad(tomorrowMorning.getMonth() + 1)}-${pad(tomorrowMorning.getDate())}T08:30`;
  presets.push({ label: 'Tomorrow 08:30 IST', value: t08 });

  return presets;
}

/**
 * Computes human-friendly visual diff between before and proposed state.
 */
function computeVisualDiff(domain, before = {}, proposed = {}) {
  if (domain === 'schedule') {
    const bOverrides = before?.flags?.classOverrides || {};
    const pOverrides = proposed?.flags?.classOverrides || {};
    const allDates = [...new Set([...Object.keys(bOverrides), ...Object.keys(pOverrides)])].sort();

    const dateDiffs = [];
    for (const d of allDates) {
      const bDate = bOverrides[d] || {};
      const pDate = pOverrides[d] || {};
      const allClassKeys = [...new Set([...Object.keys(bDate), ...Object.keys(pDate)])];

      const classChanges = [];
      for (const key of allClassKeys) {
        const bCls = bDate[key];
        const pCls = pDate[key];

        if (!bCls && pCls) {
          classChanges.push({
            key,
            type: 'added',
            status: pCls.type === 'cancelled' ? 'Cancelled' : 'Custom Override',
            detail: pCls,
          });
        } else if (bCls && !pCls) {
          classChanges.push({
            key,
            type: 'removed',
            status: 'Reverted to Sheet',
            detail: bCls,
          });
        } else if (canonicalJson(bCls) !== canonicalJson(pCls)) {
          const fieldChanges = [];
          if (bCls.type !== pCls.type) fieldChanges.push(`Type: ${bCls.type || 'normal'} → ${pCls.type}`);
          if (bCls.start !== pCls.start || bCls.end !== pCls.end) {
            fieldChanges.push(`Time: ${bCls.start || '—'}–${bCls.end || '—'} → ${pCls.start || '—'}–${pCls.end || '—'}`);
          }
          if (bCls.room !== pCls.room) fieldChanges.push(`Room: ${bCls.room || 'None'} → ${pCls.room || 'None'}`);
          if (bCls.note !== pCls.note) fieldChanges.push(`Note updated`);
          if (bCls.faculty !== pCls.faculty) fieldChanges.push(`Faculty updated`);

          classChanges.push({
            key,
            type: 'modified',
            status: pCls.type === 'cancelled' ? 'Cancelled' : 'Updated',
            fieldChanges,
            before: bCls,
            proposed: pCls,
          });
        }
      }

      if (classChanges.length > 0) {
        dateDiffs.push({ date: d, changes: classChanges });
      }
    }
    return { domain: 'schedule', count: dateDiffs.reduce((acc, d) => acc + d.changes.length, 0), dateDiffs };
  }

  if (domain === 'communications') {
    const bAnn = before?.announcement;
    const pAnn = proposed?.announcement;
    const annChanged = canonicalJson(bAnn) !== canonicalJson(pAnn);

    const bLinks = before?.flags?.quickLinks || [];
    const pLinks = proposed?.flags?.quickLinks || [];
    const linksChanged = canonicalJson(bLinks) !== canonicalJson(pLinks);

    const bFlashes = before?.flags?.feedbackFlashes || [];
    const pFlashes = proposed?.flags?.feedbackFlashes || [];
    const flashesChanged = canonicalJson(bFlashes) !== canonicalJson(pFlashes);

    const bUpdate = before?.flags?.updatePrompt;
    const pUpdate = proposed?.flags?.updatePrompt;
    const updateChanged = canonicalJson(bUpdate) !== canonicalJson(pUpdate);

    let count = 0;
    if (annChanged) count++;
    if (linksChanged) count++;
    if (flashesChanged) count++;
    if (updateChanged) count++;

    return {
      domain: 'communications',
      count,
      annChanged,
      beforeAnn: bAnn,
      proposedAnn: pAnn,
      linksChanged,
      bLinksCount: bLinks.length,
      pLinksCount: pLinks.length,
      flashesChanged,
      bFlashesCount: bFlashes.length,
      pFlashesCount: pFlashes.length,
      updateChanged,
      proposedUpdate: pUpdate,
    };
  }

  // System domain
  const bFlags = before?.flags || {};
  const pFlags = proposed?.flags || {};
  const allKeys = [...new Set([...Object.keys(bFlags), ...Object.keys(pFlags)])].sort();

  const flagDiffs = [];
  for (const k of allKeys) {
    if (canonicalJson(bFlags[k]) !== canonicalJson(pFlags[k])) {
      flagDiffs.push({
        key: k,
        before: bFlags[k],
        proposed: pFlags[k],
      });
    }
  }

  return { domain: 'system', count: flagDiffs.length, flagDiffs };
}

export default function AdminPublishWorkspace({
  role,
  flags,
  originalFlags,
  announcement,
  originalAnnouncement,
  onPublished,
  scheduleAt = '',
  baseOverrides,
  onClose,
}) {
  const [domain, setDomain] = useState('schedule');
  const [snapshot, setSnapshot] = useState(null);
  const [review, setReview] = useState(null);
  const [diffView, setDiffView] = useState('visual'); // 'visual' | 'code'
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [at, setAt] = useState(scheduleAt);
  const [releaseMode, setReleaseMode] = useState(scheduleAt ? 'schedule' : 'now');
  const [versions, setVersions] = useState([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [restore, setRestore] = useState(null);
  const [notify, setNotify] = useState(false);
  const [noticeMessage, setNoticeMessage] = useState('');
  const [audience, setAudience] = useState(null);
  const [copiedJson, setCopiedJson] = useState(false);

  const local = useMemo(() => domainPayload(domain, flags, announcement), [domain, flags, announcement]);
  const base = useMemo(() => baseOverrides?.[domain] || domainPayload(domain, originalFlags, originalAnnouncement), [baseOverrides, domain, originalFlags, originalAnnouncement]);

  const hasStagedEdits = useMemo(() => {
    return canonicalJson(local) !== canonicalJson(base);
  }, [local, base]);

  // Load publication state & versions on domain switch
  useEffect(() => {
    let active = true;
    setSnapshot(null);
    setReview(null);
    setRestore(null);
    setError('');
    setMessage('');
    setAudience(null);

    loadPublication(domain)
      .then(data => {
        if (!active) return;
        setSnapshot(data);
        // Auto-prepare review so the diff is immediately visible
        const merged = mergeAdminDraft(base, local, data.payload);
        setReview({ ...merged, before: data.payload, revision: data.revision });
      })
      .catch(e => {
        if (active) setError(e.message);
      });

    supabase
      .from('admin_publication_versions')
      .select('revision,payload,created_at,created_by')
      .eq('domain', domain)
      .order('revision', { ascending: false })
      .limit(20)
      .then(({ data, error: failure }) => {
        if (!active) return;
        if (failure) setError(failure.message);
        else setVersions(data || []);
      });

    return () => { active = false; };
  }, [domain, base, local]);

  // If restore is chosen from history, re-run review with restore payload
  useEffect(() => {
    if (!restore || !snapshot) return;
    setReview({
      value: restore,
      conflicts: [],
      before: snapshot.payload,
      revision: snapshot.revision,
    });
  }, [restore, snapshot]);

  const run = async (action) => {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await action();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const recheckReview = () => run(async () => {
    const fresh = await loadPublication(domain);
    setSnapshot(fresh);
    setAudience(null);
    const merged = restore ? { value: restore, conflicts: [] } : mergeAdminDraft(base, local, fresh.payload);
    setReview({ ...merged, before: fresh.payload, revision: fresh.revision });
  });

  const publish = () => run(async () => {
    if (!review || review.conflicts.length) throw new Error('Review and resolve conflicts first.');
    if (notify && domain === 'schedule' && !audience) throw new Error('Preview the affected audience before confirming.');

    const targetTime = releaseMode === 'schedule' && at ? at : '';

    if (targetTime) {
      await scheduleDomain(domain, review.value, review.revision, targetTime, domain === 'schedule' && notify ? audience.id : null);
      setMessage(`Publication scheduled for ${formatIST(targetTime)} IST. Revisions and admin permissions will be re-validated automatically at execution.`);
    } else {
      const result = domain === 'schedule' && notify
        ? await publishScheduleWithNotice(review.value, review.revision, audience.id)
        : await publishDomain(domain, review.value, review.revision);

      await onPublished(domain, result.payload, result.revision);
      setSnapshot(result);
      setRestore(null);
      setMessage(`Published ${domain} revision #${result.revision}. Other staged areas are preserved.${result.notice_count !== undefined ? ` ${result.notice_count} notifications queued.` : ''}`);
    }
    setReview(null);
  });

  const allowed = hasAdminCapability(role, `${domain}.publish`);
  const domainInfo = DOMAIN_INFO[domain] || DOMAIN_INFO.schedule;
  const quickPresets = useMemo(() => getQuickPresets(), []);

  // Compute visual diff between live snapshot and proposed review value
  const visualDiff = useMemo(() => {
    if (!review) return null;
    return computeVisualDiff(domain, review.before, review.value);
  }, [domain, review]);

  const copyProposedJson = () => {
    if (!review) return;
    navigator.clipboard?.writeText(JSON.stringify(review.value, null, 2));
    setCopiedJson(true);
    setTimeout(() => setCopiedJson(false), 2000);
  };

  return (
    <div className="apw-root" aria-label="Review and publish workspace">
      {/* Top Domain Selector Bar */}
      <div className="apw-domain-bar">
        {PUBLICATION_DOMAINS.map((area) => {
          const info = DOMAIN_INFO[area] || {};
          const Icon = info.Icon || Layers;
          const isActive = area === domain;
          const isStaged = canonicalJson(domainPayload(area, flags, announcement)) !== canonicalJson(domainPayload(area, originalFlags, originalAnnouncement));

          return (
            <button
              key={area}
              type="button"
              className={`apw-domain-tab${isActive ? ' is-active' : ''}`}
              onClick={() => {
                setDomain(area);
                setRestore(null);
                setMessage('');
              }}
              aria-pressed={isActive}
            >
              <div className={`apw-tab-icon-wrap apw-tone-${info.color || 'violet'}`}>
                <Icon size={18} />
              </div>
              <div className="apw-tab-copy">
                <div className="apw-tab-title-row">
                  <span className="apw-tab-name">{info.label || area}</span>
                  {isStaged ? (
                    <span className="apw-staged-pill">● Staged</span>
                  ) : (
                    <span className="apw-synced-pill">Synced</span>
                  )}
                </div>
                <span className="apw-tab-kicker">{info.kicker}</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Domain Context & Meta Bar */}
      <div className="apw-context-strip">
        <div className="apw-context-left">
          <span className="apw-domain-badge">{domainInfo.label} Area</span>
          <span className="apw-revision-pill">
            <Clock3 size={13} />
            {snapshot ? `Live: Rev #${snapshot.revision}` : 'Connecting…'}
          </span>
          {hasStagedEdits && (
            <span className="apw-edits-count-badge">
              <Sparkles size={13} /> Local edits staged
            </span>
          )}
        </div>

        <div className="apw-context-right">
          {allowed ? (
            <span className="apw-perm-tag is-allowed" title="You have permission to deploy this area">
              <ShieldCheck size={13} /> Publish capability active
            </span>
          ) : (
            <span className="apw-perm-tag is-locked" title="Read-only access: you can review but not deploy">
              <Lock size={13} /> Read-only access
            </span>
          )}
          <button
            type="button"
            className="apw-refresh-btn"
            disabled={busy || !snapshot}
            onClick={recheckReview}
            title="Refresh remote status"
          >
            <RefreshCw size={13} className={busy ? 'apw-spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Alerts & Messages */}
      {error && (
        <div className="apw-error-card" role="alert">
          <AlertTriangle size={18} />
          <div className="apw-alert-body">
            <strong>Publication Blocked</strong>
            <p>{error}</p>
          </div>
          <button type="button" className="apw-dismiss-btn" onClick={() => setError('')} aria-label="Dismiss error">
            <X size={14} />
          </button>
        </div>
      )}

      {message && (
        <div className="apw-success-card" role="status">
          <div className="apw-success-icon-wrap">
            <CheckCircle2 size={24} color="#10b981" />
          </div>
          <div className="apw-success-body">
            <div className="apw-success-title-row">
              <strong>Deployed Successfully</strong>
              <span className="apw-live-badge"><i /> Live in production</span>
            </div>
            <p>{message}</p>
          </div>
          {onClose && (
            <button type="button" className="admin-btn primary apw-done-btn" onClick={onClose}>
              Done <Check size={14} />
            </button>
          )}
        </div>
      )}

      {/* Loading Skeleton */}
      {!snapshot && !error && (
        <div className="apw-loading-box" role="status">
          <RefreshCw size={24} className="apw-spin apw-spinner-icon" />
          <p>Connecting to publication server and merging live revision…</p>
        </div>
      )}

      {/* Main Review Section */}
      {review && (
        <div className="apw-review-container">
          {/* Conflict Resolution Drawer */}
          {review.conflicts && review.conflicts.length > 0 && (
            <div className="apw-conflict-banner" role="alert">
              <div className="apw-conflict-head">
                <AlertCircle size={20} />
                <div>
                  <h4>Concurrent Edit Conflict ({review.conflicts.length} fields)</h4>
                  <p>Another administrator published updates while your draft was open. Choose which version to keep for each field before deploying.</p>
                </div>
              </div>

              <div className="apw-conflicts-list">
                {review.conflicts.map((conflict) => (
                  <div key={conflict.path} className="apw-conflict-card">
                    <span className="apw-conflict-path">Field: <code>{conflict.path}</code></span>
                    <div className="apw-conflict-options">
                      <div className="apw-conflict-side">
                        <span className="apw-side-label">Your Local Edit</span>
                        <pre className="apw-side-pre">{JSON.stringify(conflict.local, null, 2) || 'undefined (deleted)'}</pre>
                        <button
                          type="button"
                          className="admin-btn outline apw-resolve-btn"
                          onClick={() => setReview(curr => ({
                            ...curr,
                            value: resolveDraftField(curr.value, conflict.keys, conflict.local),
                            conflicts: curr.conflicts.filter(c => c.path !== conflict.path),
                          }))}
                        >
                          <Check size={14} /> Keep my edit
                        </button>
                      </div>

                      <div className="apw-conflict-side">
                        <span className="apw-side-label">Live Server Version</span>
                        <pre className="apw-side-pre">{JSON.stringify(conflict.remote, null, 2) || 'undefined (deleted)'}</pre>
                        <button
                          type="button"
                          className="admin-btn outline apw-resolve-btn"
                          onClick={() => setReview(curr => ({
                            ...curr,
                            value: resolveDraftField(curr.value, conflict.keys, conflict.remote),
                            conflicts: curr.conflicts.filter(c => c.path !== conflict.path),
                          }))}
                        >
                          <Check size={14} /> Accept server version
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Staged Changes Card */}
          <div className="apw-diff-section">
            <div className="apw-diff-header">
              <div className="apw-diff-title-wrap">
                <h3>Proposed Changes</h3>
                <span className="apw-diff-badge">
                  {visualDiff ? `${visualDiff.count} change${visualDiff.count === 1 ? '' : 's'} detected` : 'Reviewing'}
                </span>
              </div>

              <div className="apw-diff-actions">
                <div className="apw-view-toggle" role="radiogroup" aria-label="Diff view mode">
                  <button
                    type="button"
                    className={`apw-vt-btn${diffView === 'visual' ? ' is-on' : ''}`}
                    onClick={() => setDiffView('visual')}
                    aria-pressed={diffView === 'visual'}
                  >
                    <Eye size={13} /> Visual Breakdown
                  </button>
                  <button
                    type="button"
                    className={`apw-vt-btn${diffView === 'code' ? ' is-on' : ''}`}
                    onClick={() => setDiffView('code')}
                    aria-pressed={diffView === 'code'}
                  >
                    <Code2 size={13} /> Code / Raw JSON
                  </button>
                </div>

                {diffView === 'code' && (
                  <button
                    type="button"
                    className="admin-btn outline apw-copy-code-btn"
                    onClick={copyProposedJson}
                    title="Copy proposed payload"
                  >
                    {copiedJson ? <Check size={13} color="#10b981" /> : <Copy size={13} />}
                    <span>{copiedJson ? 'Copied!' : 'Copy JSON'}</span>
                  </button>
                )}
              </div>
            </div>

            {/* Visual Breakdown Mode */}
            {diffView === 'visual' ? (
              <div className="apw-visual-content">
                {visualDiff?.count === 0 ? (
                  <div className="apw-empty-diff">
                    <CheckCircle2 size={32} color="#10b981" />
                    <strong>No staged modifications in {domainInfo.label}</strong>
                    <p>The proposed draft matches the live server revision #{snapshot?.revision}. Everything is in sync.</p>
                  </div>
                ) : (
                  <>
                    {/* Schedule Diff */}
                    {visualDiff?.domain === 'schedule' && (
                      <div className="apw-sched-diff-list">
                        {visualDiff.dateDiffs.map(({ date, changes }) => (
                          <div key={date} className="apw-date-group">
                            <div className="apw-date-group-header">
                              <Calendar size={14} />
                              <strong>{formatIST(`${date}T12:00:00`).split(',')[0]}</strong>
                              <span>({date})</span>
                              <small>{changes.length} session override{changes.length === 1 ? '' : 's'}</small>
                            </div>

                            <div className="apw-date-changes">
                              {changes.map((ch, idx) => (
                                <div key={idx} className={`apw-change-card is-${ch.type}`}>
                                  <div className="apw-change-top">
                                    <span className={`ses ${subjectClass(ch.key.split('_')[0])} apw-code-chip`}>
                                      {ch.key}
                                    </span>
                                    <span className={`apw-status-badge is-${ch.status.toLowerCase().replace(/\s+/g, '-')}`}>
                                      {ch.status}
                                    </span>
                                  </div>

                                  {ch.type === 'modified' && (
                                    <div className="apw-change-fields">
                                      {ch.fieldChanges.map((fc, i) => (
                                        <div key={i} className="apw-fc-row">
                                          <ArrowRight size={12} />
                                          <span>{fc}</span>
                                        </div>
                                      ))}
                                    </div>
                                  )}

                                  {ch.type === 'added' && (
                                    <div className="apw-change-fields">
                                      <div className="apw-fc-row">
                                        <span>Added new override: {ch.detail.name || ch.detail.type || 'Custom'} {ch.detail.start ? `(${fmtTime12(ch.detail.start)}–${fmtTime12(ch.detail.end)})` : ''} {ch.detail.room ? `in ${ch.detail.room}` : ''}</span>
                                      </div>
                                    </div>
                                  )}

                                  {ch.type === 'removed' && (
                                    <div className="apw-change-fields">
                                      <div className="apw-fc-row">
                                        <span>Removed override; timetable row will revert to source sheet timetable.</span>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Communications Diff */}
                    {visualDiff?.domain === 'communications' && (
                      <div className="apw-comm-diff-list">
                        {visualDiff.annChanged && (
                          <div className="apw-comm-card">
                            <div className="apw-comm-card-head">
                              <Megaphone size={16} />
                              <strong>Campus Announcement Banner</strong>
                            </div>
                            <div className="apw-comm-banner-compare">
                              <div className="apw-banner-box apw-box-before">
                                <span className="apw-box-label">Live on Campus</span>
                                {visualDiff.beforeAnn ? (
                                  <div className={`apw-banner-preview tone-${visualDiff.beforeAnn.tone || 'info'}`}>
                                    <strong>{visualDiff.beforeAnn.title || 'Announcement'}</strong>
                                    <p>{visualDiff.beforeAnn.text}</p>
                                  </div>
                                ) : (
                                  <em>No active announcement.</em>
                                )}
                              </div>

                              <div className="apw-banner-box apw-box-proposed">
                                <span className="apw-box-label">Staged Proposal</span>
                                {visualDiff.proposedAnn ? (
                                  <div className={`apw-banner-preview tone-${visualDiff.proposedAnn.tone || 'info'}`}>
                                    <strong>{visualDiff.proposedAnn.title || 'Announcement'}</strong>
                                    <p>{visualDiff.proposedAnn.text}</p>
                                  </div>
                                ) : (
                                  <em>Announcement will be cleared / hidden.</em>
                                )}
                              </div>
                            </div>
                          </div>
                        )}

                        {visualDiff.linksChanged && (
                          <div className="apw-comm-card">
                            <strong>Quick Links</strong>
                            <p>Modified list: {visualDiff.bLinksCount} links on server → {visualDiff.pLinksCount} links staged.</p>
                          </div>
                        )}

                        {visualDiff.flashesChanged && (
                          <div className="apw-comm-card">
                            <strong>Feedback Flashes</strong>
                            <p>Modified: {visualDiff.bFlashesCount} flashes on server → {visualDiff.pFlashesCount} flashes staged.</p>
                          </div>
                        )}

                        {visualDiff.updateChanged && (
                          <div className="apw-comm-card">
                            <strong>Version Update Modal Prompt</strong>
                            <p>Title: {visualDiff.proposedUpdate?.title || 'Updated'}</p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* System Diff */}
                    {visualDiff?.domain === 'system' && (
                      <div className="apw-sys-diff-table">
                        <div className="apw-sys-row apw-sys-head">
                          <span>Setting / Flag Key</span>
                          <span>Live Server Value</span>
                          <span />
                          <span>Staged Proposal</span>
                        </div>
                        {visualDiff.flagDiffs.map(({ key, before, proposed }) => (
                          <div key={key} className="apw-sys-row">
                            <span className="apw-sys-key"><code>{key}</code></span>
                            <span className="apw-sys-val apw-val-before">
                              {typeof before === 'boolean' ? String(before) : JSON.stringify(before) || 'unset'}
                            </span>
                            <ArrowRight size={13} className="apw-sys-arrow" />
                            <span className="apw-sys-val apw-val-proposed">
                              {typeof proposed === 'boolean' ? String(proposed) : JSON.stringify(proposed) || 'unset'}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            ) : (
              /* Raw JSON Mode */
              <div className="apw-code-comparison">
                <div className="apw-code-pane">
                  <div className="apw-code-pane-head">
                    <span>Live Server (Rev #{review.revision})</span>
                  </div>
                  <pre>{JSON.stringify(review.before, null, 2)}</pre>
                </div>
                <div className="apw-code-pane">
                  <div className="apw-code-pane-head">
                    <span>Proposed Payload (Staged Draft)</span>
                  </div>
                  <pre>{JSON.stringify(review.value, null, 2)}</pre>
                </div>
              </div>
            )}
          </div>

          {/* Release Timing Selector */}
          <div className="apw-section-card apw-timing-card">
            <div className="apw-card-header">
              <CalendarClock size={16} />
              <div>
                <h4>Publication Timing & Schedule</h4>
                <p>Choose whether changes deploy immediately or execute automatically at a planned IST timestamp.</p>
              </div>
            </div>

            <div className="apw-timing-modes">
              <button
                type="button"
                className={`apw-timing-mode-btn${releaseMode === 'now' ? ' is-selected' : ''}`}
                onClick={() => {
                  setReleaseMode('now');
                  setAt('');
                }}
              >
                <div className="apw-tm-radio"><i /></div>
                <div>
                  <strong>⚡ Instant Live Release</strong>
                  <span>Apply immediately to all active student browsers and cache.</span>
                </div>
              </button>

              <button
                type="button"
                className={`apw-timing-mode-btn${releaseMode === 'schedule' ? ' is-selected' : ''}`}
                onClick={() => {
                  setReleaseMode('schedule');
                  if (!at && quickPresets.length > 0) setAt(quickPresets[0].value);
                }}
              >
                <div className="apw-tm-radio"><i /></div>
                <div>
                  <strong>⏰ Schedule for Later (IST)</strong>
                  <span>Enqueue automated execution in Indian Standard Time (UTC+5:30).</span>
                </div>
              </button>
            </div>

            {releaseMode === 'schedule' && (
              <div className="apw-schedule-controls">
                <div className="apw-ist-notice">
                  <Info size={14} />
                  <span>All scheduled releases run in <strong>Indian Standard Time (IST, UTC+5:30)</strong>. Revision and permissions will be validated again at execution.</span>
                </div>

                <div className="apw-preset-chips">
                  {quickPresets.map((pr) => (
                    <button
                      key={pr.value}
                      type="button"
                      className={`apw-preset-chip${at === pr.value ? ' is-active' : ''}`}
                      onClick={() => setAt(pr.value)}
                    >
                      {pr.label}
                    </button>
                  ))}
                </div>

                <label className="apw-datetime-label">
                  <span>Exact IST Timestamp (YYYY-MM-DDTHH:MM)</span>
                  <input
                    type="datetime-local"
                    className="admin-input apw-datetime-input"
                    value={at}
                    onChange={e => setAt(e.target.value)}
                  />
                </label>
              </div>
            )}
          </div>

          {/* Schedule Student Notifications (Schedule Domain Only) */}
          {domain === 'schedule' && (
            <div className="apw-section-card apw-notify-card">
              <div className="apw-card-header">
                <BellRing size={16} />
                <div>
                  <h4>Student Notification Broadcast</h4>
                  <p>Send a targeted push notification and activity inbox notice to students whose enrolled classes were changed.</p>
                </div>
              </div>

              <label className="apw-notify-toggle-label">
                <input
                  type="checkbox"
                  checked={notify}
                  onChange={(e) => {
                    setNotify(e.target.checked);
                    setAudience(null);
                  }}
                />
                <span>Queue an optional timetable update notification with this publication</span>
              </label>

              {notify && (
                <div className="apw-notify-content">
                  <label className="apw-note-label">
                    <span>Additional announcement note (optional)</span>
                    <textarea
                      maxLength={500}
                      rows={2}
                      className="admin-input apw-note-textarea"
                      placeholder="e.g. Please bring laptops for the revised case study presentation."
                      value={noticeMessage}
                      onChange={(e) => {
                        setNoticeMessage(e.target.value);
                        setAudience(null);
                      }}
                    />
                    <small>{noticeMessage.length} / 500 characters</small>
                  </label>

                  <div className="apw-audience-cta-row">
                    <button
                      type="button"
                      className="admin-btn outline"
                      disabled={busy || review.conflicts.length > 0}
                      onClick={() => run(async () => {
                        const aud = await previewScheduleNotices(review.value, review.revision, noticeMessage);
                        setAudience(aud);
                      })}
                    >
                      <Send size={13} /> Calculate affected audience & preview
                    </button>
                  </div>

                  {audience && (
                    <div className="apw-audience-preview-panel">
                      <div className="apw-audience-stats">
                        <div className="apw-astat">
                          <strong>{audience.students}</strong>
                          <span>Students affected</span>
                        </div>
                        <div className="apw-astat">
                          <strong>{audience.push_subscribers}</strong>
                          <span>Push subscribers</span>
                        </div>
                        <div className="apw-astat">
                          <strong>{audience.notifications}</strong>
                          <span>Inbox entries</span>
                        </div>
                      </div>

                      <div className="apw-notif-samples">
                        <span className="apw-samples-title">Student Push Notification Preview</span>
                        {audience.classes.map((item, index) => {
                          const copy = item.copy || scheduleNoticeCopy({
                            code: item.effective.code || item.key,
                            date: item.date,
                            before: item.before,
                            effective: item.effective,
                            note: noticeMessage,
                          });
                          return (
                            <details key={index} className="apw-notif-accordion">
                              <summary>
                                <span className="apw-notif-sum-left">
                                  <strong>{item.date}</strong> · <code>{item.key}</code>
                                </span>
                                <span className="apw-notif-sum-right">Preview notice <ChevronRight size={13} /></span>
                              </summary>
                              <div className="apw-push-preview-box">
                                <PushPreview
                                  {...copy}
                                  type={item.effective.type === 'cancelled' ? 'class_cancelled' : 'schedule_change'}
                                  data={{ date: item.date }}
                                />
                              </div>
                            </details>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Action Footer Bar */}
          <div className="apw-actions-bar">
            <div className="apw-act-summary">
              <strong>Domain: {domainInfo.label}</strong>
              <span>
                {snapshot ? `Revision #${snapshot.revision}` : ''}
                {releaseMode === 'schedule' && at ? ` · Enqueue for ${formatIST(at)} IST` : ' · Instant Live Deployment'}
              </span>
            </div>

            <div className="apw-act-buttons">
              {onClose && (
                <button type="button" className="admin-btn outline" onClick={onClose} disabled={busy}>
                  Keep editing
                </button>
              )}

              <button
                type="button"
                className="admin-btn primary apw-publish-cta-btn"
                disabled={busy || review.conflicts.length > 0 || !allowed}
                onClick={publish}
              >
                {busy ? (
                  <>
                    <RefreshCw size={14} className="apw-spin" />
                    <span>Processing release…</span>
                  </>
                ) : releaseMode === 'schedule' && at ? (
                  <>
                    <CalendarClock size={15} />
                    <span>Schedule {domainInfo.label} Release</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={15} />
                    <span>Deploy {domainInfo.label} Now</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Revision History & Rollback Drawer */}
      <details
        className="apw-history-drawer"
        open={historyOpen}
        onToggle={(e) => setHistoryOpen(e.currentTarget.open)}
      >
        <summary className="apw-history-summary">
          <div className="apw-hist-sum-left">
            <History size={16} />
            <strong>Publication History & Safe Rollbacks</strong>
            <span className="apw-hist-count">({versions.length} revisions)</span>
          </div>
          <ChevronDown size={16} className="apw-hist-caret" />
        </summary>

        <div className="apw-history-body">
          <p className="apw-hist-intro">
            Restoring an earlier version stages its payload in the review workspace so you can inspect the diff and publish it as a fresh revision without destructive database overwrites.
          </p>

          {versions.length === 0 ? (
            <div className="apw-hist-empty">No previous versions recorded for this area.</div>
          ) : (
            <div className="apw-versions-grid">
              {versions.map((version) => {
                const isCurrent = snapshot && snapshot.revision === version.revision;
                return (
                  <div key={version.revision} className={`apw-version-item${isCurrent ? ' is-current' : ''}`}>
                    <div className="apw-vi-left">
                      <div className="apw-vi-tag-row">
                        <span className="apw-rev-tag">v{version.revision}</span>
                        {isCurrent && <span className="apw-active-tag">Current Live</span>}
                      </div>
                      <div className="apw-vi-meta">
                        <span>{formatIST(version.created_at)}</span>
                        <span>by <code>{version.created_by || 'Admin'}</code></span>
                      </div>
                    </div>

                    <div className="apw-vi-right">
                      <button
                        type="button"
                        className="admin-btn outline apw-stage-restore-btn"
                        disabled={!allowed || busy || isCurrent}
                        onClick={() => {
                          setRestore(version.payload);
                          setReview(null);
                          setMessage(`Revision v${version.revision} staged. Review the diff above and confirm to publish as a new revision.`);
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                      >
                        <RotateCcw size={13} /> Stage rollback
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </details>
    </div>
  );
}
