// Lite edition build. Reuses the full app's config factory — same src/, public/,
// plugins and chunking — but swaps root → lite/, outDir → dist-lite/, injects
// VITE_EDITION=lite, and uses the lite PWA manifest. See ../vite.config.js.
import { makeConfig } from '../vite.config.js';

export default makeConfig({ edition: 'lite' });
