const fs = require('fs');
const file = 'F:/Web Dev/Antigravity/PGP2 Schedule/schedule-app/src/styles.css';
let css = fs.readFileSync(file, 'utf8');

// Replace :root { ... } with --ink-inv
css = css.replace(/--ink:\s*#15182B;/g, '--ink: #15182B;\n  --ink-inv: #FFFFFF;');

// Replace body.theme-night
const nightThemeRegex = /body\.theme-night\s*{[^}]*}/;
const newNightTheme = `/* Premium Night (OLED Black) */
body.theme-night {
  --bg-gradient: radial-gradient(circle at 50% 0%, rgba(255, 255, 255, 0.04) 0%, transparent 60%), #000000;
  --bg: #000000;
  --card: #0A0A0A;
  --card-hi: #141414;
  --surface: rgba(10, 10, 10, 0.7);
  --text: #F0F0F0;
  --muted: #8F8F8F;
  --border: #222222;
  --border-hi: #333333;
  --ink: #FFFFFF;
  --ink-inv: #000000;
}`;
css = css.replace(nightThemeRegex, newNightTheme);

// For all rules containing `background: var(--ink);`, replace `color: #fff;` with `color: var(--ink-inv);`
css = css.replace(/background:\s*var\(--ink\)[^}]*}/g, match => {
    return match.replace(/color:\s*#fff/g, 'color: var(--ink-inv)');
});

fs.writeFileSync(file, css);
console.log("Updated styles.css for OLED night mode and --ink-inv");
