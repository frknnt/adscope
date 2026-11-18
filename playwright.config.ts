import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end suite.
 *  - demo-*      : starts an isolated dev server on :3100 in demo mode with the in-memory backend.
 *  - supabase-*  : runs the same specs against E2E_SUPABASE_BASE_URL (an app started with local Supabase env).
 * PW_CHROMIUM_PATH lets CI or sandboxes point at a preinstalled Chromium.
 */
const launchOptions = process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {};
const supabaseBase = process.env.E2E_SUPABASE_BASE_URL;
// Each project (and each run) signs up from its own documentation-range client address, so the per-IP
// sign-up limit (20 per 10 minutes) is not shared between projects or with a long-running dev server.
const run = Math.floor(Math.random() * 200) + 20;
const ip = (n: number) => ({ "X-Forwarded-For": `198.51.100.${run + n}` });

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: { trace: "off", launchOptions, locale: "tr-TR", timezoneId: "Europe/Istanbul", reducedMotion: "reduce" },
  projects: [
    { name: "demo-desktop", use: { extraHTTPHeaders: ip(0), ...devices["Desktop Chrome"], baseURL: "http://localhost:3100", viewport: { width: 1360, height: 900 } } },
    { name: "demo-mobile", use: { extraHTTPHeaders: ip(1), ...devices["Pixel 7"], baseURL: "http://localhost:3100" } },
    ...(supabaseBase ? [{ name: "supabase-desktop", use: { extraHTTPHeaders: ip(2), ...devices["Desktop Chrome"], baseURL: supabaseBase } }] : []),
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
      // Lets the landing page scan reach the fixture server on 127.0.0.1. Ignored in production.
      LANDING_SCAN_ALLOW_PRIVATE: "true",
      // Speech-to-text goes to a mock started by the video spec on this port; no real provider is called.
      SPEECH_TO_TEXT_API_KEY: "e2e-fake-key",
      SPEECH_TO_TEXT_BASE_URL: "http://127.0.0.1:3199",
      // E-mail stays in the demo outbox.
      RESEND_API_KEY: "",
      CRON_SECRET: "e2e-cron-secret-0123456789",
      DEMO_ADMIN_EMAILS: "@yonetim.adscope.test",
      // Meta Ad Library goes to a mock started by the agency spec on this port.
      META_AD_LIBRARY_TOKEN: "e2e-fake-token",
      META_GRAPH_BASE_URL: "http://127.0.0.1:3198",
      // Photoroom goes to a fake provider started by the tools spec on this port.
      PHOTOROOM_API_KEY: "e2e-fake-key",
      PHOTOROOM_SDK_URL: "http://127.0.0.1:3197",
      PHOTOROOM_IMAGE_API_URL: "http://127.0.0.1:3197",
      // Gemini (AI images and videos) goes to a fake provider started by the genai spec on this port.
      GEMINI_API_KEY: "e2e-fake-gemini-key",
      GEMINI_API_BASE: "http://127.0.0.1:3196",
    },
  },
});
