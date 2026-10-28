// Offline browser verification in an isolated profile; never opens the user's
// signed-in browser. Generates previews before checking their actual CSS.
import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import { existsSync, mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import { verifyCompanions } from './companion-browser-verify.mjs';

const exec = promisify(execFile);
const root = fileURLToPath(new URL("..", import.meta.url));
const out = resolve(root, ".local");
mkdirSync(out, { recursive: true });
const chrome = process.env.PET_QA_BROWSER || [
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
].find(existsSync);
if (!chrome) throw new Error("Set PET_QA_BROWSER to a Chromium executable.");
await exec(process.execPath, ["scripts/pet-preview.mjs"], { cwd: root, windowsHide: true });
await exec(process.execPath, ["scripts/pet-preview.mjs", "--pet", "cinder"], { cwd: root, windowsHide: true });
await exec(process.execPath, ["scripts/pet-preview.mjs", "--pet", "prickle"], { cwd: root, windowsHide: true });
await exec(process.execPath, ["scripts/pet-preview.mjs", "--pet", "luna"], { cwd: root, windowsHide: true });
await exec(process.execPath, ["scripts/companion-preview.mjs"], { cwd: root, windowsHide: true });
const cases = [
  ["roster", "pet-preview.html", "1250,4400", false],
  ["lion", "cinder-preview.html", "1250,780", false],
  ["prickle", "prickle-preview.html", "1250,780", false],
  ["luna", "luna-preview.html", "1250,1000", false],
  ["luna-phone", "luna-preview.html", "390,1600", false],
  ["luna-reduced", "luna-preview.html", "1250,1000", true],
  ["phone", "pet-preview.html", "390,1400", false],
  ["reduced", "pet-preview.html", "1250,1600", true],
  ["page-phone", "pet-page-preview.html", "390,1400", false],
  ["companion-light", "companion-preview.html", "1250,1800", false],
  ["companion-dark", "companion-preview.html", "1250,1800", false],
  ["companion-phone", "companion-preview.html", "390,1400", false],
  ["companion-reduced", "companion-preview.html", "1250,1800", true],
  ["moods-light", "companion-mood-matrix.html", "1300,2240", false],
  ["moods-dark", "companion-mood-matrix.html", "1300,2240", false],
];
const profile = resolve(out, "pet-browser-qa-cdp");
mkdirSync(profile, { recursive: true });
const portFile = resolve(profile, "DevToolsActivePort");
rmSync(portFile, { force: true });
const browser = spawn(chrome, ["--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check", "--remote-debugging-port=0", `--user-data-dir=${profile}`], { windowsHide: true, stdio: "ignore" });
const pause = ms => new Promise(done => setTimeout(done, ms));
let socket;
let id = 0;
const pending = new Map();
const results = [];
try {
  for (let i = 0; i < 100 && !existsSync(portFile); i++) await pause(100);
  const [port, wsPath] = readFileSync(portFile, "utf8").trim().split(/\r?\n/);
  socket = new WebSocket(`ws://127.0.0.1:${port}${wsPath}`);
  await new Promise((done, reject) => { socket.onopen = done; socket.onerror = reject; });
  socket.onmessage = event => {
    const reply = JSON.parse(event.data);
    if (!reply.id) return;
    const request = pending.get(reply.id);
    if (!request) return;
    pending.delete(reply.id);
    clearTimeout(request.timer);
    if (reply.error) request.reject(new Error(JSON.stringify(reply.error)));
    else request.done(reply.result);
  };
  const send = (method, params = {}, sessionId) => new Promise((done, reject) => {
    const requestId = ++id;
    const timer = setTimeout(() => { pending.delete(requestId); reject(new Error(`CDP timeout: ${method}`)); }, method === 'Runtime.evaluate' ? 120000 : method === 'Page.captureScreenshot' ? 60000 : 15000);
    pending.set(requestId, { done, reject, timer });
    socket.send(JSON.stringify({ id: requestId, method, params, ...(sessionId ? { sessionId } : {}) }));
  });
  for (const [name, file, size, reduced] of cases) {
    const [width, height] = size.split(",").map(Number);
    const { targetId } = await send("Target.createTarget", { url: "about:blank" });
    const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
    await send("Page.enable", {}, sessionId);
    await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: width < 600 }, sessionId);
    await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: reduced ? "reduce" : "no-preference" }] }, sessionId);
    await send("Page.navigate", { url: pathToFileURL(resolve(out, file)).href }, sessionId);
    if (name.startsWith('companion-')) {
      results.push({ name, ...await verifyCompanions(send, sessionId, out, name, reduced) });
      await send('Target.closeTarget', { targetId });
      continue;
    }
    let report;
    for (let i = 0; i < 80; i++) {
      const data = await send("Runtime.evaluate", { expression: 'document.querySelector("#report")?.textContent', returnByValue: true }, sessionId);
      if (data.result.value) { report = JSON.parse(data.result.value); break; }
      await pause(100);
    }
    if (!report) throw new Error(`No browser report for ${name}`);
    if (name.endsWith('-dark')) await send('Runtime.evaluate', { expression: 'document.documentElement.dataset.theme="dark"' }, sessionId);
    await pause(200);
    const actual = await send("Runtime.evaluate", { expression: 'JSON.stringify({width:innerWidth,documentWidth:document.documentElement.scrollWidth,bodyWidth:document.body.scrollWidth})', returnByValue: true }, sessionId);
    Object.assign(report, JSON.parse(actual.result.value));
    if (name === "luna") {
      const checks = await send("Runtime.evaluate", { awaitPromise: true, returnByValue: true, expression: `(async () => {
        const pet = document.querySelector('[data-pet="luna"]');
        const head = pet.querySelector('.pet-rig-head');
        const before = { mood: pet.dataset.mood, beat: pet.dataset.beat, reaction: pet.dataset.reaction, motion: pet.dataset.motion };
        const face = selector => getComputedStyle(pet.querySelector(selector)).display;
        pet.dataset.mood = 'sleepy'; pet.dataset.beat = 'headtilt';
        const priority = [];
        for (const reaction of ['pet', 'play', 'treat', 'leap']) {
          pet.dataset.reaction = reaction;
          priority.push({ reaction, head: getComputedStyle(head).animationName, joy: face('.dg-pet-expression-joy'), rest: face('.dg-pet-expression-rest') });
        }
        delete pet.dataset.reaction; delete pet.dataset.beat; pet.dataset.mood = 'content';
        head.style.animationPlayState = 'running'; head.style.animationDelay = '0s';
        const first = getComputedStyle(head).transform;
        await new Promise(done => setTimeout(done, 350));
        const next = getComputedStyle(head).transform;
        head.style.removeProperty('animation-play-state'); head.style.removeProperty('animation-delay');
        pet.dataset.motion = 'off';
        const offAnimations = [pet,...pet.querySelectorAll('*')].filter(e => getComputedStyle(e).animationName !== 'none').length;
        const vector = !!pet.querySelector('svg.pet-rig') && !pet.querySelector('image,.luna-strip');
        const eyes = pet.querySelector('.dg-pet-eyes').dataset.eyePersonality;
        const pupilClips = pet.querySelectorAll('.dg-pet-eye [clip-path]').length;
        for (const [key, value] of Object.entries(before)) { if (value === undefined) delete pet.dataset[key]; else pet.dataset[key] = value; }
        return { priority, advances: first !== next, offAnimations, vector, eyes, pupilClips };
      })()` }, sessionId);
      if (checks.exceptionDetails) throw new Error(checks.exceptionDetails.exception?.description || checks.exceptionDetails.text);
      report.lunaChecks = checks.result.value;
      if (!report.lunaChecks.advances || report.lunaChecks.offAnimations || !report.lunaChecks.vector || report.lunaChecks.eyes !== 'luna' || report.lunaChecks.pupilClips !== 2
        || report.lunaChecks.priority.some(check => check.head !== 'petAttention' || check.joy === 'none' || check.rest !== 'none')) {
        throw new Error(`Luna reaction/animation failure: ${JSON.stringify(report.lunaChecks)}`);
      }
    }
    const screenshot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false }, sessionId);
    writeFileSync(resolve(out, `pet-qa-${name}.png`), Buffer.from(screenshot.data, "base64"));
    if (report.overflow || report.offAnimations || report.reducedAnimations || report.width !== width) throw new Error(`Browser QA failed: ${name} ${JSON.stringify({ ...report, actions: undefined })}`);
    results.push({ name, ...report });
    console.log(`${name}: viewport=${report.width}px, ${report.tiles} previews, overflow=false, motion-off=${report.offAnimations}, reduced-motion=${report.reducedAnimations ?? "not requested"}`);
    await send("Target.closeTarget", { targetId });
  }
  writeFileSync(resolve(out, "pet-browser-report.json"), JSON.stringify(results, null, 2));
  await send("Browser.close");
} finally {
  socket?.close();
  browser.kill();
}
