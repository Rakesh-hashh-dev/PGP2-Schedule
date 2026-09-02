import { useState } from "react";
import { Asterisk } from "lucide-react";
import { getTimeGreeting } from "../lib/datetime.js";

export default function DayGreeting({ now, name }) {
  // Picked once name is known and cached from then on, so it doesn't re-randomize
  // on every clock tick — `now` updates every second/minute via the app's live clock.
  const [picked, setPicked] = useState(null);
  if (name && !picked) setPicked(getTimeGreeting(now, name));
  if (!picked) return null;
  return (
    <div className="day-greeting">
      <Asterisk size={18} className="day-greeting-ico" aria-hidden="true" />
      <span>{picked}</span>
    </div>
  );
}
