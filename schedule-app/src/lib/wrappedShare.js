export const WRAPPED_SHARE_SLIDES = [
  { id: "summary", label: "Big picture", description: "Hours, attendance and courses" },
  { id: "workload", label: "Workload", description: "Your week-by-week class rhythm" },
  { id: "attendance", label: "Attendance", description: "Present, skipped and unmarked" },
  { id: "highlights", label: "Highlights", description: "The moments that defined the term" },
];

const WIDTH = 1080;
const HEIGHT = 1920;
const BASE_COLORS = {
  background: "#10091b",
  surface: "#1d1330",
  surfaceHi: "#2b1d45",
  text: "#ffffff",
  muted: "rgba(255,255,255,.62)",
  faint: "rgba(255,255,255,.12)",
  violet: "#aa8cff",
  blue: "#73afff",
  green: "#55d7a5",
  coral: "#ff7796",
  amber: "#ffbd66",
};

export const WRAPPED_SHARE_THEMES = [
  { id: "aurora", label: "Aurora", swatch: "linear-gradient(135deg,#7550d8,#160d25 65%,#ffbd66)" },
  { id: "midnight", label: "Midnight", swatch: "linear-gradient(135deg,#17427a,#071220 65%,#58d7ff)" },
  { id: "campus", label: "Campus", swatch: "linear-gradient(135deg,#18755e,#081c1a 65%,#ffd166)" },
];

function themeColors(themeId) {
  if (themeId === "midnight") return { ...BASE_COLORS, background: "#071220", surface: "#0d2137", surfaceHi: "#153453", violet: "#73afff", blue: "#58d7ff", amber: "#a4e6ff", gradientStart: "#17427a", gradientEnd: "#030810", glow: "rgba(88,215,255,.25)" };
  if (themeId === "campus") return { ...BASE_COLORS, background: "#081c1a", surface: "#102d28", surfaceHi: "#17453c", violet: "#55d7a5", blue: "#6fe0d0", amber: "#ffd166", gradientStart: "#18755e", gradientEnd: "#03100e", glow: "rgba(255,209,102,.24)" };
  return { ...BASE_COLORS, gradientStart: "#4d2ca2", gradientEnd: "#09060f", glow: "rgba(255,189,102,.28)" };
}

let COLORS = themeColors("aurora");

function roundedRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function fillRoundedRect(ctx, x, y, width, height, radius, fill) {
  roundedRect(ctx, x, y, width, height, radius);
  ctx.fillStyle = fill;
  ctx.fill();
}

function wrapLines(ctx, text, maxWidth, maxLines = Infinity) {
  const words = String(text || "").split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(candidate).width > maxWidth) {
      lines.push(line);
      line = word;
      if (lines.length === maxLines) break;
    } else {
      line = candidate;
    }
  }
  if (line && lines.length < maxLines) lines.push(line);
  if (lines.length === maxLines && words.join(" ") !== lines.join(" ")) {
    let last = lines[maxLines - 1];
    while (last && ctx.measureText(`${last}…`).width > maxWidth) last = last.slice(0, -1);
    lines[maxLines - 1] = `${last.trim()}…`;
  }
  return lines;
}

function drawWrappedText(ctx, text, x, y, maxWidth, lineHeight, maxLines) {
  const lines = wrapLines(ctx, text, maxWidth, maxLines);
  lines.forEach((line, index) => ctx.fillText(line, x, y + index * lineHeight));
  return y + lines.length * lineHeight;
}

function drawBackground(ctx) {
  const gradient = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
  gradient.addColorStop(0, COLORS.gradientStart);
  gradient.addColorStop(.43, COLORS.background);
  gradient.addColorStop(1, COLORS.gradientEnd);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  const glow = ctx.createRadialGradient(900, 210, 20, 900, 210, 560);
  glow.addColorStop(0, COLORS.glow);
  glow.addColorStop(1, "rgba(255,189,102,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, WIDTH, 800);
}

function drawHeader(ctx, termLabel, userName, slideLabel) {
  ctx.textBaseline = "top";
  ctx.fillStyle = COLORS.violet;
  ctx.font = "700 30px Inter, system-ui, sans-serif";
  ctx.fillText("TERMFLOW WRAPPED", 78, 78);
  ctx.textAlign = "right";
  ctx.fillStyle = COLORS.muted;
  ctx.font = "600 26px Inter, system-ui, sans-serif";
  ctx.fillText(slideLabel.toUpperCase(), WIDTH - 78, 82);
  ctx.textAlign = "left";

  ctx.fillStyle = COLORS.text;
  ctx.font = "800 70px 'Bricolage Grotesque', Inter, system-ui, sans-serif";
  const afterTerm = drawWrappedText(ctx, termLabel || "My term", 78, 150, WIDTH - 156, 78, 2);
  if (userName) {
    ctx.fillStyle = COLORS.muted;
    ctx.font = "500 30px Inter, system-ui, sans-serif";
    drawWrappedText(ctx, userName, 78, afterTerm + 10, WIDTH - 156, 38, 1);
  }
}

function drawFooter(ctx, page, total) {
  ctx.fillStyle = COLORS.muted;
  ctx.font = "600 27px Inter, system-ui, sans-serif";
  ctx.fillText("pgp2.termflow.tech", 78, HEIGHT - 92);
  ctx.textAlign = "right";
  ctx.fillText(`${page} / ${total}`, WIDTH - 78, HEIGHT - 92);
  ctx.textAlign = "left";
}

function drawMetric(ctx, x, y, width, value, label, color = COLORS.text) {
  fillRoundedRect(ctx, x, y, width, 220, 34, COLORS.surface);
  ctx.fillStyle = color;
  ctx.font = "800 72px 'Bricolage Grotesque', Inter, system-ui, sans-serif";
  ctx.fillText(String(value), x + 34, y + 36);
  ctx.fillStyle = COLORS.muted;
  ctx.font = "500 28px Inter, system-ui, sans-serif";
  drawWrappedText(ctx, label, x + 34, y + 132, width - 68, 36, 2);
}

function drawSummary(ctx, stats) {
  ctx.fillStyle = COLORS.text;
  ctx.font = "800 88px 'Bricolage Grotesque', Inter, system-ui, sans-serif";
  ctx.fillText("Your term had range.", 78, 410);
  ctx.fillStyle = COLORS.muted;
  ctx.font = "500 31px Inter, system-ui, sans-serif";
  drawWrappedText(ctx, "A snapshot of where your time went and how consistently you showed up.", 78, 525, WIDTH - 156, 44, 3);

  drawMetric(ctx, 78, 700, 446, stats.totalHrs, "hours in the classroom", COLORS.violet);
  drawMetric(ctx, 556, 700, 446, stats.attendancePct === null ? "—" : `${stats.attendancePct}%`, "attendance on marked sessions", COLORS.green);
  drawMetric(ctx, 78, 952, 446, stats.heldSessions, "classes completed", COLORS.blue);
  drawMetric(ctx, 556, 952, 446, stats.courseCount, "courses in your schedule", COLORS.amber);

  if (stats.topCourse) {
    fillRoundedRect(ctx, 78, 1240, 924, 250, 34, COLORS.surfaceHi);
    ctx.fillStyle = COLORS.muted;
    ctx.font = "600 27px Inter, system-ui, sans-serif";
    ctx.fillText("MOST TIME SPENT IN", 112, 1280);
    ctx.fillStyle = COLORS.text;
    ctx.font = "800 60px 'Bricolage Grotesque', Inter, system-ui, sans-serif";
    ctx.fillText(stats.topCourse.code, 112, 1334);
    ctx.fillStyle = COLORS.muted;
    ctx.font = "500 28px Inter, system-ui, sans-serif";
    drawWrappedText(ctx, `${stats.topCourse.hrs} hours · ${stats.topCourse.name}`, 112, 1410, 840, 36, 2);
  }
}

function drawWorkload(ctx, stats) {
  ctx.fillStyle = COLORS.text;
  ctx.font = "800 78px 'Bricolage Grotesque', Inter, system-ui, sans-serif";
  ctx.fillText("Week by week", 78, 410);
  ctx.fillStyle = COLORS.muted;
  ctx.font = "500 30px Inter, system-ui, sans-serif";
  ctx.fillText("Classroom hours across the term", 78, 505);

  const x = 90;
  const y = 690;
  const width = 900;
  const height = 520;
  const values = stats.weeklyLoad;
  const max = Math.max(1, ...values.map((week) => week.hours));
  ctx.strokeStyle = COLORS.faint;
  ctx.lineWidth = 2;
  for (let i = 0; i <= 4; i++) {
    const gy = y + (height * i) / 4;
    ctx.beginPath();
    ctx.moveTo(x, gy);
    ctx.lineTo(x + width, gy);
    ctx.stroke();
  }

  const points = values.map((week, index) => ({
    x: values.length === 1 ? x + width / 2 : x + (index / (values.length - 1)) * width,
    y: y + height - (week.hours / max) * height,
    week,
  }));
  if (points.length) {
    const area = ctx.createLinearGradient(0, y, 0, y + height);
    area.addColorStop(0, "rgba(170,140,255,.5)");
    area.addColorStop(1, "rgba(170,140,255,.03)");
    ctx.beginPath();
    ctx.moveTo(points[0].x, y + height);
    points.forEach((point) => ctx.lineTo(point.x, point.y));
    ctx.lineTo(points[points.length - 1].x, y + height);
    ctx.closePath();
    ctx.fillStyle = area;
    ctx.fill();

    ctx.beginPath();
    points.forEach((point, index) => index ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y));
    ctx.strokeStyle = COLORS.violet;
    ctx.lineWidth = 8;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.stroke();
  }

  const peak = points.sort((a, b) => b.week.hours - a.week.hours)[0];
  if (peak) {
    ctx.fillStyle = COLORS.text;
    ctx.beginPath();
    ctx.arc(peak.x, peak.y, 13, 0, Math.PI * 2);
    ctx.fill();
    fillRoundedRect(ctx, Math.max(78, Math.min(peak.x - 105, WIDTH - 288)), peak.y - 112, 210, 76, 20, COLORS.surfaceHi);
    ctx.fillStyle = COLORS.text;
    ctx.font = "700 30px Inter, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`${peak.week.hours}h · ${peak.week.label}`, Math.max(183, Math.min(peak.x, WIDTH - 183)), peak.y - 91);
    ctx.textAlign = "left";
  }

  const topCourses = stats.courses.slice(0, 4);
  ctx.fillStyle = COLORS.text;
  ctx.font = "700 36px Inter, system-ui, sans-serif";
  ctx.fillText("Where the time went", 78, 1350);
  const topMax = Math.max(1, ...topCourses.map((course) => course.hours));
  topCourses.forEach((course, index) => {
    const rowY = 1430 + index * 92;
    ctx.fillStyle = COLORS.text;
    ctx.font = "700 27px Inter, system-ui, sans-serif";
    ctx.fillText(course.code, 78, rowY);
    fillRoundedRect(ctx, 200, rowY + 3, 670, 28, 14, COLORS.surfaceHi);
    fillRoundedRect(ctx, 200, rowY + 3, 670 * (course.hours / topMax), 28, 14, COLORS.violet);
    ctx.textAlign = "right";
    ctx.fillStyle = COLORS.muted;
    ctx.font = "600 26px Inter, system-ui, sans-serif";
    ctx.fillText(`${course.hours}h`, 1002, rowY);
    ctx.textAlign = "left";
  });
}

function drawAttendance(ctx, stats) {
  ctx.fillStyle = COLORS.text;
  ctx.font = "800 78px 'Bricolage Grotesque', Inter, system-ui, sans-serif";
  ctx.fillText("Attendance, honestly", 78, 410);
  ctx.fillStyle = COLORS.muted;
  ctx.font = "500 30px Inter, system-ui, sans-serif";
  ctx.fillText("Present, skipped and not marked", 78, 505);

  const centerX = WIDTH / 2;
  const centerY = 915;
  const radius = 285;
  const lineWidth = 80;
  const total = Math.max(1, stats.heldSessions);
  const segments = [
    [stats.present, COLORS.green],
    [stats.absent, COLORS.coral],
    [stats.unmarked, COLORS.surfaceHi],
  ];
  let angle = -Math.PI / 2;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = "butt";
  for (const [count, color] of segments) {
    const next = angle + (count / total) * Math.PI * 2;
    if (count > 0) {
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, angle, next);
      ctx.strokeStyle = color;
      ctx.stroke();
    }
    angle = next;
  }

  ctx.textAlign = "center";
  ctx.fillStyle = COLORS.text;
  ctx.font = "800 116px 'Bricolage Grotesque', Inter, system-ui, sans-serif";
  ctx.fillText(stats.attendancePct === null ? "—" : `${stats.attendancePct}%`, centerX, centerY - 72);
  ctx.fillStyle = COLORS.muted;
  ctx.font = "500 29px Inter, system-ui, sans-serif";
  ctx.fillText("of marked sessions", centerX, centerY + 66);
  ctx.textAlign = "left";

  const legend = [
    ["Present", stats.present, COLORS.green],
    ["Skipped", stats.absent, COLORS.coral],
    ["Unmarked", stats.unmarked, COLORS.surfaceHi],
  ];
  legend.forEach(([label, count, color], index) => {
    const lx = 110 + index * 320;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(lx, 1320, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = COLORS.text;
    ctx.font = "700 32px Inter, system-ui, sans-serif";
    ctx.fillText(String(count), lx + 28, 1297);
    ctx.fillStyle = COLORS.muted;
    ctx.font = "500 25px Inter, system-ui, sans-serif";
    ctx.fillText(label, lx + 28, 1340);
  });

  fillRoundedRect(ctx, 78, 1480, 924, 180, 32, COLORS.surface);
  ctx.fillStyle = COLORS.violet;
  ctx.font = "800 48px 'Bricolage Grotesque', Inter, system-ui, sans-serif";
  ctx.fillText(`${stats.attendance.coveragePct}%`, 116, 1522);
  ctx.fillStyle = COLORS.muted;
  ctx.font = "500 27px Inter, system-ui, sans-serif";
  drawWrappedText(ctx, "of completed sessions had an attendance mark", 270, 1532, 670, 36, 2);
}

function drawHighlights(ctx, stats) {
  ctx.fillStyle = COLORS.text;
  ctx.font = "800 78px 'Bricolage Grotesque', Inter, system-ui, sans-serif";
  ctx.fillText("The moments", 78, 410);
  ctx.fillStyle = COLORS.muted;
  ctx.font = "500 30px Inter, system-ui, sans-serif";
  ctx.fillText("Useful extremes from your term", 78, 505);

  const moments = [
    stats.busiestDay ? { value: `${stats.busiestDay.count} classes`, label: "Heaviest day", note: stats.busiestDay.label, color: COLORS.coral } : null,
    stats.longestPresentStreak ? { value: `${stats.longestPresentStreak.count} in a row`, label: "Confirmed attendance streak", note: "Only consecutively marked-present classes count", color: COLORS.green } : null,
    stats.earliest ? { value: stats.earliest.time, label: "Earliest start", note: `Survived ${stats.earliest.count} time${stats.earliest.count === 1 ? "" : "s"}`, color: COLORS.amber } : null,
    stats.mostSkipped ? { value: `${stats.mostSkipped.absent} skips`, label: stats.mostSkipped.code, note: stats.mostSkipped.name, color: COLORS.violet } : null,
  ].filter(Boolean).slice(0, 4);

  moments.forEach((moment, index) => {
    const y = 650 + index * 250;
    fillRoundedRect(ctx, 78, y, 924, 210, 34, COLORS.surface);
    ctx.fillStyle = moment.color;
    ctx.font = "800 56px 'Bricolage Grotesque', Inter, system-ui, sans-serif";
    ctx.fillText(moment.value, 116, y + 32);
    ctx.fillStyle = COLORS.text;
    ctx.font = "700 29px Inter, system-ui, sans-serif";
    ctx.fillText(moment.label, 116, y + 105);
    ctx.fillStyle = COLORS.muted;
    ctx.font = "500 25px Inter, system-ui, sans-serif";
    drawWrappedText(ctx, moment.note, 116, y + 146, 820, 32, 1);
  });
}

export function drawWrappedSlide(slideId, stats, termLabel, userName, page = 1, total = 1, themeId = "aurora") {
  const previousColors = COLORS;
  COLORS = themeColors(themeId);
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext("2d");
  drawBackground(ctx);
  const slide = WRAPPED_SHARE_SLIDES.find((item) => item.id === slideId) || WRAPPED_SHARE_SLIDES[0];
  drawHeader(ctx, termLabel, userName, slide.label);

  if (slide.id === "workload") drawWorkload(ctx, stats);
  else if (slide.id === "attendance") drawAttendance(ctx, stats);
  else if (slide.id === "highlights") drawHighlights(ctx, stats);
  else drawSummary(ctx, stats);

  drawFooter(ctx, page, total);
  COLORS = previousColors;
  return canvas;
}

export function createWrappedPreview(slideId, stats, termLabel, userName, themeId = "aurora") {
  const source = drawWrappedSlide(slideId, stats, termLabel, userName, 1, 1, themeId);
  const preview = document.createElement("canvas");
  preview.width = 216;
  preview.height = 384;
  preview.getContext("2d").drawImage(source, 0, 0, preview.width, preview.height);
  return preview.toDataURL("image/webp", .8);
}

function canvasBlob(canvas) {
  return new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
}

export async function buildWrappedShareFiles(slideIds, stats, termLabel, userName, themeId = "aurora") {
  const ids = slideIds.length ? slideIds : ["summary"];
  const files = [];
  for (let index = 0; index < ids.length; index++) {
    const id = ids[index];
    const canvas = drawWrappedSlide(id, stats, termLabel, userName, index + 1, ids.length, themeId);
    const blob = await canvasBlob(canvas);
    if (!blob) continue;
    const name = `termflow-wrapped-${String(index + 1).padStart(2, "0")}-${id}.png`;
    files.push({ name, blob, file: typeof File === "function" ? new File([blob], name, { type: "image/png" }) : null });
  }
  return files;
}

export function downloadWrappedShareFiles(files) {
  files.forEach(({ name, blob }, index) => {
    setTimeout(() => {
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = name;
      link.click();
      setTimeout(() => URL.revokeObjectURL(link.href), 5000);
    }, index * 180);
  });
}
