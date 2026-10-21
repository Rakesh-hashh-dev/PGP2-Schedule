import { defineConfig, mergeConfig } from "vitest/config";
import base from "./vitest.config.js";

const config = mergeConfig(base, defineConfig({ test: { maxWorkers: 1, fileParallelism: false } }));
config.test.include = ["src/**/*.perf.test.js"];
config.test.exclude = ["**/node_modules/**", "**/.git/**"];
export default config;
