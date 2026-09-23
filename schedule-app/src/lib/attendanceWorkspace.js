export const ATTENDANCE_REQUIREMENT = 80;
export const ZERO_CREDIT_REQUIREMENT = 90;

export function attendanceRequirement(credits) {
  return Number(credits) === 0 ? ZERO_CREDIT_REQUIREMENT : ATTENDANCE_REQUIREMENT;
}

export function attendanceCoverage({ present = 0, absent = 0, total = 0 } = {}) {
  const marked = present + absent;
  return total > 0 ? Math.round((marked / total) * 100) : 0;
}

export function sessionsToRecover(present, absent, requiredPct = ATTENDANCE_REQUIREMENT) {
  const marked = present + absent;
  if (!marked || present / marked >= requiredPct / 100) return 0;
  const target = requiredPct / 100;
  const raw = ((target * marked) - present) / (1 - target);
  return Math.max(0, Math.ceil(raw - 1e-9));
}

export function attendanceCourseState(course) {
  const marked = course.present + course.absent;
  const requiredPct = course.requiredPct ?? ATTENDANCE_REQUIREMENT;
  const coverage = attendanceCoverage({ ...course, total: course.total });
  const recovery = sessionsToRecover(course.present, course.absent, requiredPct);

  if (course.penaltyHit) {
    return { id: "critical", rank: 0, label: "Penalty threshold crossed", detail: "Review this course now", coverage, recovery };
  }
  if (marked > 0 && course.pct < requiredPct) {
    return {
      id: "below",
      rank: 1,
      label: `Below ${requiredPct}% requirement`,
      detail: `Attend the next ${recovery} session${recovery === 1 ? "" : "s"} to recover`,
      coverage,
      recovery,
    };
  }
  if (course.totalAllowedSkips > 0 && course.skipsRemaining <= 1) {
    return {
      id: "watch",
      rank: 2,
      label: course.skipsRemaining === 1 ? "One skip remaining" : "No skips remaining",
      detail: "Plan the next absence carefully",
      coverage,
      recovery,
    };
  }
  if (course.unmarked > 0) {
    return {
      id: "incomplete",
      rank: 3,
      label: `${course.unmarked} session${course.unmarked === 1 ? "" : "s"} unmarked`,
      detail: "Complete records for an accurate percentage",
      coverage,
      recovery,
    };
  }
  if (marked === 0) {
    return { id: "empty", rank: 4, label: "No completed sessions", detail: "Tracking will begin after class", coverage, recovery };
  }
  return {
    id: "on-track",
    rank: 5,
    label: "On track",
    detail: course.totalAllowedSkips > 0
      ? `${course.skipsRemaining} skip${course.skipsRemaining === 1 ? "" : "s"} available`
      : `Meeting the ${requiredPct}% requirement`,
    coverage,
    recovery,
  };
}

export function sortAttendanceCourses(courses) {
  return [...courses].sort((a, b) => {
    const aState = a.state || attendanceCourseState(a);
    const bState = b.state || attendanceCourseState(b);
    return aState.rank - bState.rank
      || b.unmarked - a.unmarked
      || (a.pct ?? 101) - (b.pct ?? 101)
      || a.code.localeCompare(b.code);
  });
}

export function groupPendingSessions(sessions) {
  const groups = new Map();
  [...sessions]
    .sort((a, b) => b.date.localeCompare(a.date) || b.start.localeCompare(a.start))
    .forEach((session) => {
      if (!groups.has(session.date)) groups.set(session.date, []);
      groups.get(session.date).push(session);
    });
  return [...groups.entries()].map(([date, items]) => ({ date, sessions: items }));
}
