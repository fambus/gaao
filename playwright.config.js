import { defineConfig } from "@playwright/test";

// End-to-end checks run against the production build, at the primary phone size and at desktop size.
// The backend, LRCLIB and translators are mocked in tests/e2e/fixtures.js; the mic is Chromium's fake device.
const baseURL = process.env.GAAO_BASE_URL || "http://localhost:4173/gaao/";

export default defineConfig({
  testDir: "tests/e2e",
  outputDir: "test-results/pw",
  timeout: 60_000,
  fullyParallel: true,
  reporter: [["list"]],
  use: {
    baseURL,
    permissions: ["microphone"],
    launchOptions: { args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"] },
  },
  projects: [
    { name: "iphone", use: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } },
    { name: "desktop", use: { viewport: { width: 1440, height: 900 } } },
  ],
  webServer: process.env.GAAO_BASE_URL ? undefined : {
    command: "npm run build && npm run preview",
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
