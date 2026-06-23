const { execSync } = require('child_process');
const fs = require('fs');

function runTest(type, args) {
  console.log(`\nRunning lighthouse for ${type}...`);
  try {
    execSync(`npx --yes lighthouse http://localhost:4173 --output json --output-path ./lh-${type}.json --chrome-flags="--headless" ${args}`, { stdio: 'inherit' });
    const data = JSON.parse(fs.readFileSync(`./lh-${type}.json`, 'utf8'));
    
    const scores = {
      Performance: Math.round(data.categories.performance.score * 100),
      Accessibility: Math.round(data.categories.accessibility.score * 100),
      'Best Practices': Math.round(data.categories['best-practices'].score * 100),
      SEO: Math.round(data.categories.seo.score * 100)
    };
    
    console.log(`\n--- ${type.toUpperCase()} SCORES ---`);
    console.table(scores);
  } catch (e) {
    console.error(`Error running lighthouse for ${type}:`, e.message);
  }
}

// Default is mobile
runTest('mobile', '');
// Preset desktop
runTest('desktop', '--preset=desktop');
