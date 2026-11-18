import { useEffect, useRef, useState } from "react";
import {
  MapPin, Plus, RefreshCw, X,
} from "lucide-react";
import {
  WhatsAppBrandSVG, ShareGradientSVG, PremiumCabSVG, PremiumAutoSVG,
  PremiumBusSVG, PremiumTrainSVG, PremiumFlightSVG, PremiumSeatsSVG,
  TravelIllustrationSVG,
} from "./PremiumSVGs.jsx";
import { supabase } from "../lib/supabase.js";

// ── Constants ──────────────────────────────────────────────────────────────
const PLACES = [
  "Campus",
  "Sambalpur Jn Railway",
  "Sambalpur City Railway",
  "Laxmi Talkies",
  "Jharsuguda Airport (JRG)",
  "Raipur Airport (RPR)",
  "Raipur Railway",
  "Bhubaneswar Airport (BBI)",
  "Bhubaneswar Railway",
];

const MODES = [
  { value: "cab",   label: "Cab" },
  { value: "auto",  label: "Auto" },
  { value: "bus",   label: "Bus" },
  { value: "other", label: "Other" },
];

// ── Helpers ─────────────────────────────────────────────────────────────────
function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function fmt12h(time) {
  if (!time) return "";
  const [h, m] = time.split(":").map(Number);
  const ap = h < 12 ? "AM" : "PM";
  const hh = h % 12 || 12;
  return `${hh}:${String(m).padStart(2, "0")} ${ap}`;
}

function fmtDate(iso) {
  if (!iso) return "";
  const today = todayISO();
  const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
  const d = new Date(iso + "T00:00:00");
  const nice = d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
  if (iso === today) return `Today · ${nice}`;
  if (iso === tomorrow) return `Tomorrow · ${nice}`;
  return nice;
}

function savedWa() {
  try { return localStorage.getItem("pgp2.travel-wa") || ""; } catch { return ""; }
}
function saveWa(v) {
  try { localStorage.setItem("pgp2.travel-wa", v || ""); } catch { /* ok */ }
}

// ── Sub-components ───────────────────────────────────────────────────────────
function ModeIcon({ mode, size = 15 }) {
  if (mode === "cab") return <PremiumCabSVG size={size} />;
  if (mode === "auto") return <PremiumAutoSVG size={size} />;
  if (mode === "bus") return <PremiumBusSVG size={size} />;
  if (mode === "train") return <PremiumTrainSVG size={size} />;
  return <MapPin size={size} />;
}

function TripCard({ trip, onWhatsApp, onShare, onDelete, isMine }) {
  const isLowSeats = trip.seats === 1;
  const isFlight = /flight|air|6e|ai|uk|sg|qp|indigo|air\s*india|vistara|akasa/i.test(trip.onward || "");
  return (
    <div className={`tv-card${isMine ? " mine" : ""}`}>
      <div className="tv-card-header">
        <span className="tv-time">{fmt12h(trip.depart_time)}</span>
        <span className={`tv-mode-pill tv-mode-${trip.mode}`}>
          <ModeIcon mode={trip.mode} size={15} />
          {MODES.find(m => m.value === trip.mode)?.label ?? trip.mode}
        </span>
      </div>

      <div className="tv-leg">
        <span>{trip.origin}</span>
        <span className="tv-arrow" aria-hidden="true">→</span>
        <span>{trip.destination}</span>
      </div>

      <div className="tv-onward" title={trip.onward}>
        {isFlight ? <PremiumFlightSVG size={14} /> : <PremiumTrainSVG size={14} />}
        <span>{trip.onward}</span>
      </div>

      {trip.note && <p className="tv-note">{trip.note}</p>}

      <div className="tv-footer">
        <span className="tv-who">
          <span className="tv-who-name">{trip.user_name}</span>
          {isMine && <span className="tv-you">you</span>}
          <span className={`tv-seats ${isLowSeats ? "tv-seats-low" : "tv-seats-ok"}`} title={`${trip.seats} seat${trip.seats !== 1 ? "s" : ""} available`}>
            <PremiumSeatsSVG size={13} />
            {isLowSeats ? "1 seat left" : `${trip.seats} seats`}
          </span>
        </span>
        <div className="tv-actions">
          <button
            type="button"
            className="tv-share-btn"
            onClick={() => onShare(trip)}
            aria-label={`Share ${trip.user_name}'s journey to WhatsApp`}
            title="Share journey to WhatsApp batch groups"
          >
            <ShareGradientSVG size={13} />
            <span>Share</span>
          </button>
          {trip.wa_number && (
            <button
              type="button"
              className="tv-wa-btn"
              onClick={() => onWhatsApp(trip)}
              aria-label={`WhatsApp ${trip.user_name}`}
            >
              <WhatsAppBrandSVG size={14} />
              <span>WhatsApp</span>
            </button>
          )}
          {isMine && (
            <button
              type="button"
              className="tv-del-btn"
              onClick={() => onDelete(trip)}
              aria-label="Remove listing"
            >
              <X size={13} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function PostModal({ onClose, onPost }) {
  const today = todayISO();
  const [form, setForm] = useState({
    journey_date: today,
    depart_time: "",
    origin: "",
    destination: "",
    mode: "cab",
    onward: "",
    seats: "1",
    note: "",
    wa_number: savedWa(),
  });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const firstRef = useRef(null);

  useEffect(() => {
    firstRef.current?.focus();
  }, []);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const validate = () => {
    if (!form.journey_date) return "Pick a journey date.";
    if (!form.depart_time) return "Enter a departure time.";
    if (!form.origin) return "Select a pick-up location.";
    if (!form.destination) return "Select a drop location.";
    if (form.origin === form.destination) return "Pick-up and drop can't be the same.";
    if (!form.mode) return "Select a travel mode.";
    if (form.onward.trim().length < 2) return "Add your onward flight or train — that's what others match against.";
    if (Number(form.seats) < 1) return "At least 1 seat.";
    if (!/^[0-9]{10,15}$/.test(form.wa_number.replace(/\D/g, ""))) return "Enter a valid WhatsApp number (10–15 digits).";
    return null;
  };

  const handleSubmit = async () => {
    const error = validate();
    if (error) { setErr(error); return; }
    setBusy(true);
    setErr("");
    try {
      const cleanWa = form.wa_number.replace(/\D/g, "");
      await onPost({
        journey_date: form.journey_date,
        depart_time: form.depart_time,
        origin: form.origin,
        destination: form.destination,
        mode: form.mode,
        onward: form.onward.trim(),
        seats: Number(form.seats),
        note: form.note.trim() || null,
        wa_number: cleanWa,
      });
      saveWa(cleanWa);
      onClose();
    } catch (e) {
      setErr(e?.message || "Could not post listing. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="tv-modal-bg"
      role="dialog"
      aria-modal="true"
      aria-label="Post a journey"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      onKeyDown={e => { if (e.key === "Escape") onClose(); }}
    >
      <div className="tv-modal">
        <div className="tv-modal-head">
          <h3>Post a journey</h3>
          <button type="button" className="tv-modal-close" onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </div>

        <div className="tv-form-grid">
          <label className="tv-field">
            <span>Journey date</span>
            <input
              ref={firstRef}
              type="date"
              min={today}
              value={form.journey_date}
              onChange={e => set("journey_date", e.target.value)}
            />
          </label>

          <label className="tv-field">
            <span>Leaving at</span>
            <input
              type="time"
              value={form.depart_time}
              onChange={e => set("depart_time", e.target.value)}
            />
          </label>

          <label className="tv-field tv-field-place">
            <span>Pick-up</span>
            <select value={form.origin} onChange={e => set("origin", e.target.value)}>
              <option value="">Select…</option>
              {PLACES.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </label>

          <label className="tv-field tv-field-place">
            <span>Drop</span>
            <select value={form.destination} onChange={e => set("destination", e.target.value)}>
              <option value="">Select…</option>
              {PLACES.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </label>

          <label className="tv-field">
            <span>Travelling by</span>
            <select value={form.mode} onChange={e => set("mode", e.target.value)}>
              {MODES.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </label>

          <label className="tv-field">
            <span>Available seats</span>
            <select value={form.seats} onChange={e => set("seats", e.target.value)}>
              {[1, 2, 3, 4].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>

          <label className="tv-field tv-field-wide">
            <span>Onward flight / train</span>
            <input
              type="text"
              placeholder="e.g. IndiGo 6E-204 · 9:15 PM  or  Howrah Exp 12839"
              maxLength={120}
              value={form.onward}
              onChange={e => set("onward", e.target.value)}
            />
          </label>

          <label className="tv-field tv-field-wide">
            <span>WhatsApp number</span>
            <input
              type="tel"
              inputMode="tel"
              placeholder="9876543210"
              maxLength={15}
              value={form.wa_number}
              onChange={e => set("wa_number", e.target.value)}
            />
          </label>

          <label className="tv-field tv-field-wide">
            <span>Note <em>(optional)</em></span>
            <input
              type="text"
              placeholder="e.g. 2 seats free, splitting fare equally"
              maxLength={200}
              value={form.note}
              onChange={e => set("note", e.target.value)}
            />
          </label>
        </div>

        {err && <p className="tv-form-err" role="alert">{err}</p>}

        <div className="tv-modal-actions">
          <button
            type="button"
            className="tv-post-btn"
            onClick={handleSubmit}
            disabled={busy}
          >
            {busy ? "Posting…" : "Post my journey"}
          </button>
          <p className="tv-wa-hint">
            Your WhatsApp number is only stored with this listing and removed when it expires.
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function CampusTravelBoard({ userId, userName }) {
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [filterOrigin, setFilterOrigin] = useState("");
  const [filterDest, setFilterDest] = useState("");
  const [filterDate, setFilterDate] = useState("");
  const [filterMineOnly, setFilterMineOnly] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);

  // Data fetching in response to refreshTick
  useEffect(() => {
    let active = true;
    supabase
      .from("travel_listings")
      .select("id, user_id, user_name, journey_date, depart_time, origin, destination, mode, onward, seats, note, wa_number, created_at")
      .gte("journey_date", todayISO())
      .order("journey_date", { ascending: true })
      .order("depart_time", { ascending: true })
      .then(({ data, error: err }) => {
        if (!active) return;
        if (err) setError(err.message);
        else { setListings(data || []); setError(""); }
      })
      .catch((e) => {
        if (active) setError(e?.message || "Could not load travel board.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, [refreshTick]);

  // Re-fetch when browser tab becomes visible again
  useEffect(() => {
    const handler = () => {
      if (document.visibilityState === "visible") {
        setRefreshTick(t => t + 1);
      }
    };
    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
  }, []);

  const handlePost = async (payload) => {
    const { data, error: err } = await supabase
      .from("travel_listings")
      .insert({ ...payload, user_id: userId, user_name: userName })
      .select()
      .single();
    if (err) throw err;
    // Optimistic prepend
    setListings(prev => {
      const next = [data, ...prev];
      next.sort((a, b) => (a.journey_date + a.depart_time).localeCompare(b.journey_date + b.depart_time));
      return next;
    });
    // Trigger background sync
    setRefreshTick(t => t + 1);
  };

  const handleDelete = async (trip) => {
    if (!confirm(trip.user_id === userId ? "Remove your listing?" : "Delete this listing?")) return;
    const { error: err } = await supabase
      .from("travel_listings")
      .delete()
      .eq("id", trip.id);
    if (err) { setError(err.message); return; }
    setListings(prev => prev.filter(t => t.id !== trip.id));
  };

  const handleWhatsApp = (trip) => {
    const number = trip.wa_number.replace(/\D/g, "");
    window.open(`https://wa.me/${number}`, "_blank", "noopener");
  };

  const handleShare = async (trip) => {
    const cleanWa = trip.wa_number ? trip.wa_number.replace(/\D/g, "") : "";
    const waLink = cleanWa ? `https://wa.me/${cleanWa}` : "";
    const lines = [
      `🚗 *Cab Pooling:* ${trip.origin} → ${trip.destination}`,
      `📅 *Date:* ${fmtDate(trip.journey_date)} at ${fmt12h(trip.depart_time)}`,
      `💺 *Available:* ${trip.seats} seat${trip.seats !== 1 ? "s" : ""}`,
      `✈ *Onward:* ${trip.onward}`,
    ];
    if (trip.note) lines.push(`📝 *Note:* ${trip.note}`);
    if (waLink) lines.push(`💬 *Contact:* ${waLink}`);
    lines.push("\nPosted on TermFlow Travel Board");

    const text = lines.join("\n");

    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: `Cab Pooling: ${trip.origin} → ${trip.destination}`,
          text,
        });
        return;
      } catch (err) {
        if (err.name === "AbortError") return;
      }
    }
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const myTripsCount = listings.filter(t => t.user_id === userId).length;

  // Filtering
  const filtered = listings.filter(t =>
    (!filterMineOnly || t.user_id === userId) &&
    (!filterOrigin || t.origin === filterOrigin) &&
    (!filterDest   || t.destination === filterDest) &&
    (!filterDate   || t.journey_date >= filterDate)
  );

  // Group by date
  const grouped = filtered.reduce((acc, t) => {
    (acc[t.journey_date] = acc[t.journey_date] || []).push(t);
    return acc;
  }, {});

  return (
    <div className="tv-board">
      {/* Header */}
      <div className="tv-topbar">
        <div className="tv-topbar-left">
          <div className="tv-scope-pills" role="radiogroup" aria-label="Journey filter scope">
            <button
              type="button"
              className={`tv-scope-pill${!filterMineOnly ? " is-active" : ""}`}
              onClick={() => setFilterMineOnly(false)}
              aria-pressed={!filterMineOnly}
            >
              All journeys
            </button>
            <button
              type="button"
              className={`tv-scope-pill${filterMineOnly ? " is-active" : ""}`}
              onClick={() => setFilterMineOnly(true)}
              aria-pressed={filterMineOnly}
            >
              My journeys {myTripsCount > 0 && <span className="tv-badge">{myTripsCount}</span>}
            </button>
          </div>
          <span className="tv-count">
            {loading ? "Loading…" : listings.length
              ? `${filtered.length === listings.length ? listings.length : `${filtered.length} of ${listings.length}`} live journey${listings.length !== 1 ? "s" : ""}`
              : ""}
          </span>
        </div>
        <div className="tv-topbar-right">
          <button
            type="button"
            className="tv-refresh-btn"
            onClick={() => { setLoading(true); setRefreshTick(t => t + 1); }}
            disabled={loading}
            aria-label="Refresh"
          >
            <RefreshCw size={14} className={loading ? "spin-icon" : ""} />
          </button>
          <button
            type="button"
            className="tv-create-btn"
            onClick={() => setShowModal(true)}
          >
            <Plus size={15} />
            Post journey
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="tv-filters">
        <label className="tv-filter-field">
          <span>From</span>
          <select value={filterOrigin} onChange={e => setFilterOrigin(e.target.value)}>
            <option value="">Anywhere</option>
            {PLACES.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </label>
        <label className="tv-filter-field">
          <span>To</span>
          <select value={filterDest} onChange={e => setFilterDest(e.target.value)}>
            <option value="">Anywhere</option>
            {PLACES.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </label>
        <label className="tv-filter-field">
          <span>On or after</span>
          <input
            type="date"
            value={filterDate}
            min={todayISO()}
            onChange={e => setFilterDate(e.target.value)}
          />
        </label>
        {(filterOrigin || filterDest || filterDate) && (
          <button
            type="button"
            className="tv-clear-btn"
            onClick={() => { setFilterOrigin(""); setFilterDest(""); setFilterDate(""); }}
          >
            Clear
          </button>
        )}
      </div>

      {/* Error */}
      {error && <p className="tv-error" role="alert">{error}</p>}

      {/* Empty states */}
      {!loading && !error && filterMineOnly && myTripsCount === 0 && (
        <div className="tv-empty">
          <TravelIllustrationSVG size={120} />
          <strong>You haven&rsquo;t posted any journeys yet</strong>
          <span>Heading to the airport or station? Post your departure and coordinate cab rides with classmates.</span>
          <button type="button" className="tv-create-btn" onClick={() => setShowModal(true)} style={{ marginTop: 12 }}>
            <Plus size={15} /> Post journey
          </button>
        </div>
      )}
      {!loading && !error && !filterMineOnly && listings.length === 0 && (
        <div className="tv-empty">
          <TravelIllustrationSVG size={120} />
          <strong>No journeys posted yet</strong>
          <span>Post your departure — others heading the same way will find you here.</span>
        </div>
      )}
      {!loading && !error && listings.length > 0 && filtered.length === 0 && (
        <div className="tv-empty">
          <MapPin size={28} />
          <strong>Nothing matches those filters</strong>
          <span>Clear the filters or switch to &ldquo;All journeys&rdquo; to see all live departures.</span>
        </div>
      )}

      {/* Listings grouped by date */}
      {Object.keys(grouped).map(date => (
        <div key={date} className="tv-day-group">
          <div className="tv-day-label">{fmtDate(date)}</div>
          <div className="tv-cards">
            {grouped[date].map(trip => (
              <TripCard
                key={trip.id}
                trip={trip}
                isMine={trip.user_id === userId}
                onWhatsApp={handleWhatsApp}
                onShare={handleShare}
                onDelete={handleDelete}
              />
            ))}
          </div>
        </div>
      ))}

      {filtered.length > 0 && (
        <p className="tv-hint">
          Tap <strong>WhatsApp</strong> on any listing to open that person's chat directly.
        </p>
      )}

      {/* Post modal */}
      {showModal && (
        <PostModal
          onClose={() => setShowModal(false)}
          onPost={handlePost}
        />
      )}
    </div>
  );
}
