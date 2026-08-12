import { defineConfig } from "vitest/config";

// Unit tests target the pure logic in src/lib (money splitting, override keying,
// insights). No DOM needed, so run in node. Supabase env vars are stubbed so the
// client constructs at import time without real credentials — no network is hit;
// the tested functions are pure and never touch the client.
export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["src/test/setup.js"],
    include: ["src/**/*.test.{js,jsx}"],
    env: {
      VITE_SUPABASE_URL: "http://localhost:54321",
      VITE_SUPABASE_ANON_KEY: "test-anon-key",
    },
  },
});
