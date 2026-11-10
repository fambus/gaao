import fs from "node:fs";
import path from "node:path";
import { test, expect } from "@playwright/test";
import { mockAll, shot, SHOT_DIR, AI } from "./fixtures.js";

test("welcome, settings and idle screens render", async ({ page }, testInfo) => {
  const errors = [];
  page.on("pageerror", e => errors.push(e.message));
  await mockAll(page);

  await page.goto("./?invite=test-invite-1");
  await expect(page.locator("#welcome")).toBeVisible();
  await expect(page.locator("#wListen")).toContainText("Listen to a song nearby");
  await shot(page, testInfo, "welcome");

  // Settings: status comes from the mocked /health.
  await page.evaluate(() => { localStorage.setItem("welcomed", "1"); });
  await page.reload();
  await expect(page.locator("#welcome")).toBeHidden();
  await expect(page.locator("#stage")).toContainText("Hear a song? Tap Listen.");
  await shot(page, testInfo, "idle");

  await page.locator("#gear").click();
  await expect(page.locator("#status")).toContainText("Listen is on");
  await expect(page.locator("#status")).toContainText("Claude meanings are on");
  await expect(page.locator("#shareLink")).toContainText("invite=share-code-1");
  await shot(page, testInfo, "settings");

  await page.locator("#testBtn").click();
  await expect(page.locator("#diag")).toContainText("Romanized on this phone: Mainu mere yaar mod do");
  await page.locator("#closeSetup").click();
  await expect(page.locator("#setup")).toBeHidden();
  expect(errors).toEqual([]);
});

test("Listen recognises a song and shows synced, romanized lines with meanings", async ({ page }, testInfo) => {
  const errors = [];
  page.on("pageerror", e => errors.push(e.message));
  const calls = await mockAll(page);

  await page.goto("./?invite=test-invite-1");
  await page.locator("#wListen").click();
  await expect(page.locator("#listenTxt")).toContainText("Listening");

  // 8 s clip from the fake mic, then the mocked /recognize and LRCLIB.
  await expect(page.locator("#title")).toHaveText("Test Geet", { timeout: 20_000 });
  await expect(page.locator("#artist")).toContainText("Gaao Band · heard nearby");
  await expect(page.locator(".ln.on .r")).toBeVisible({ timeout: 10_000 });
  await expect(page.locator("#about")).toContainText(AI.summary);
  await expect(page.locator("#chip")).toHaveText("Live");

  // Every sung line is in Latin letters and has its meaning; nothing is left in Gurmukhi.
  const rows = await page.locator(".ln:not(.gap)").evaluateAll(els => els.map(e => [e.children[0].textContent, e.children[2].textContent]));
  expect(rows.length).toBe(30);
  for (const [r, m] of rows) {
    expect(r).toMatch(/^[\x20-\x7e]+$/);
    expect(m.trim().length).toBeGreaterThan(3);
  }
  expect(rows[0]).toEqual([AI.lines[0].r, AI.lines[0].m]);
  expect(calls.recognize).toBe(1);
  expect(calls.meanings).toBe(1);

  await shot(page, testInfo, "lyrics");
  fs.writeFileSync(path.join(SHOT_DIR, `${testInfo.project.name}-lyrics.txt`), rows.map(r => r.join(" | ")).join("\n"));
  expect(errors).toEqual([]);
});
