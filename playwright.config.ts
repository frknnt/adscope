import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end suite.
 *  - demo-*      : starts an isolated dev server on :3100 in demo mode with the in-memory backend.
 *  - supabase-*  : runs the same specs against E2E_SUPABASE_BASE_URL (an app started with local Supabase env).
 * PW_CHROMIUM_PATH lets CI or sandboxes point at a preinstalled Chromium.
 */
const launchOptions = process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {};
const supabaseBase = process.env.E2E_SUPABASE_BASE_URL;

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: { trace: "off", launchOptions, locale: "tr-TR", timezoneId: "Europe/Istanbul", reducedMotion: "reduce" },
  projects: [
    { name: "demo-desktop", use: { ...devices["Desktop Chrome"], baseURL: "http://localhost:3100", viewport: { width: 1360, height: 900 } } },
    { name: "demo-mobile", use: { ...devices["Pixel 7"], baseURL: "http://localhost:3100" } },
    ...(supabaseBase ? [{ name: "supabase-desktop", use: { ...devices["Desktop Chrome"], baseURL: supabaseBase } }] : []),
  ],
  webServer: {
    command: "npx next dev -p 3100",
    url: "http://localhost:3100",
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: {
      NEXT_DIST_DIR: ".next-e2e",
      APP_MODE: "demo",
      NEXT_PUBLIC_SUPABASE_URL: "",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "",
      SUPABASE_SECRET_KEY: "",
      ANTHROPIC_API_KEY: "",
      DEMO_SESSION_SECRET: "e2e-only-secret-not-for-production-0123456789",
    },
  },
});
