// Build the actual app in an isolated output directory, without snapshot
// generation, source-map uploads or replacing a developer's normal dist.
import { build, loadConfigFromFile } from 'vite';
import { writeFileSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

process.env.SENTRY_AUTH_TOKEN = '';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(root);
const target = resolve(root, '../../tmp/pgp2-social-build-20261111');
const loaded = await loadConfigFromFile({ command: 'build', mode: 'production' }, resolve(root, 'vite.config.js'));
if (!loaded) throw new Error('Vite configuration could not be loaded.');
const config = loaded.config;
const plugins = config.plugins.filter(plugin => plugin?.name !== 'visualizer').map(plugin =>
  plugin?.name === 'generate-meta' ? {
    ...plugin,
    writeBundle() {
      writeFileSync(join(target, 'meta.json'), JSON.stringify({ version: JSON.parse(config.define.__APP_VERSION__) }));
    },
  } : plugin,
);
await build({ ...config, configFile: false, plugins, build: { ...config.build, outDir: target } });
console.log(`Verified production build: ${target}`);
