#!/usr/bin/env node
/* eslint-disable no-console */
//
// capture.js — Playwright capture helper for Dead Air Radio screenshots.
//
// Loads the running Expo Web dev server and captures each of the 6 core
// screenshots listed in docs/store/screenshots.md at the required App Store
// and Google Play dimensions.
//
// Requirements:
//   - npx playwright install chromium
//   - Expo Web dev server running (capture-screenshots.sh starts it)
//
// Usage:
//   node capture.js --base http://localhost:8081 --out ./screenshots
//   node capture.js --base http://localhost:8081 --out ./screenshots --viewports apple
//   node capture.js --base http://localhost:8081 --out ./screenshots --viewports android
//
// Outputs PNGs into `--out` named `{NN}-{screen}-{WxH}.png` per the screenshot
// spec. Exits non-zero if Playwright is unavailable or if the app fails to
// load. No `any` types, no `@ts-ignore` — JS-only file, no TS needed.
//

'use strict';

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

/**
 * @typedef {"apple" | "android" | "both"} ViewportMode
 */

/**
 * @typedef {Object} ScreenSelect
 * @property {string} name - human-readable screen label
 * @property {string} route - hash route relative to app root (e.g. "/radio")
 * @property {string} shot - 2-digit shot number used in filename prefix
 */

/**
 * @typedef {Object} Viewport
 * @property {string} label - device class label used in filename
 * @property {number} width
 * @property {number} height
 * @property {string} suffix - dimension suffix appended to filename (e.g. "1290x2796")
 */

/** @type {readonly Viewport[]} VIEWPORTS_APPLE */
const VIEWPORTS_APPLE = Object.freeze([
  Object.freeze({ label: 'iphone67', width: 1290, height: 2796, suffix: '1290x2796' }),
]);

/** @type {readonly Viewport[]} VIEWPORTS_ANDROID */
const VIEWPORTS_ANDROID = Object.freeze([
  Object.freeze({ label: 'android', width: 1080, height: 1920, suffix: '1080x1920' }),
]);

/** @type {readonly ScreenSelect[]} SCREENS */
const SCREENS = Object.freeze([
  Object.freeze({ shot: '01', name: 'radio-tuning', route: '/radio' }),
  Object.freeze({ shot: '02', name: 'active-call', route: '/radio?call=active' }),
  Object.freeze({ shot: '03', name: 'tape-collection', route: '/tapes' }),
  Object.freeze({ shot: '04', name: 'band-selector', route: '/radio?bands=open' }),
  Object.freeze({ shot: '05', name: 'store', route: '/store' }),
  Object.freeze({ shot: '06', name: 'settings', route: '/settings' }),
]);

/** @type {number} NAV_TIMEOUT_MS */
const NAV_TIMEOUT_MS = 30000;
/** @type {number} STABILIZE_MS */
const STABILIZE_MS = 1500;

/**
 * Parse argv into {base, out, viewports}.
 * @param {string[]} argv - process.argv slice(2)
 * @returns {{base: string, out: string, viewports: ViewportMode}}
 */
function parseArgs(argv) {
  const flags = { base: 'http://localhost:8081', out: './screenshots', viewports: 'both' };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = argv[i + 1];
    if (arg === '--base' && next) {
      flags.base = next;
      i++;
    } else if (arg === '--out' && next) {
      flags.out = next;
      i++;
    } else if (arg === '--viewports' && next) {
      /** @type {ViewportMode} */
      const mode = next === 'apple' || next === 'android' || next === 'both' ? next : 'both';
      flags.viewports = mode;
      i++;
    } else if (arg === '--help' || arg === '-h') {
      console.log('Usage: node capture.js --base URL --out DIR --viewports apple|android|both');
      process.exit(0);
    }
  }
  return flags;
}

/**
 * @param {ViewportMode} mode
 * @returns {readonly Viewport[]}
 */
function pickViewports(mode) {
  if (mode === 'apple') return VIEWPORTS_APPLE;
  if (mode === 'android') return VIEWPORTS_ANDROID;
  return VIEWPORTS_APPLE.concat(VIEWPORTS_ANDROID);
}

/**
 * @param {string} base
 * @param {ScreenSelect} screen
 * @returns {string}
 */
function buildUrl(base, screen) {
  const trimmed = base.endsWith('/') ? base.slice(0, -1) : base;
  return `${trimmed}${screen.route}`;
}

/**
 * Wait until the page is idle and the CRT shell is rendered.
 * @param {import("playwright").Page} page
 * @returns {Promise<void>}
 */
async function waitForAppShell(page) {
  await page.waitForLoadState('networkidle', { timeout: NAV_TIMEOUT_MS });
  // The radio screen typically renders a body with background #030303.
  // Bail if body background is still blank after timeout.
  try {
    await page.waitForFunction(
      () => {
        const body = document.body;
        if (!body) return false;
        const bg = window.getComputedStyle(body).backgroundColor;
        return bg === 'rgb(3, 3, 3)' || bg === '#030303';
      },
      { timeout: NAV_TIMEOUT_MS },
    );
  } catch (_err) {
    // Non-fatal: still attempt the shot. The user can rerun if needed.
    console.warn('warn: app shell color not detected — capturing anyway');
  }
  await page.waitForTimeout(STABILIZE_MS);
}

/**
 * @param {Object} params
 * @param {import("playwright").Browser} params.browser
 * @param {Viewport} params.viewport
 * @param {ScreenSelect} params.screen
 * @param {string} params.base
 * @param {string} params.outDir
 * @returns {Promise<void>}
 */
async function captureOne({ browser, viewport, screen, base, outDir }) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: 1,
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  const url = buildUrl(base, screen);

  console.log(`  → ${screen.shot}-${screen.name} @ ${viewport.suffix} (${url})`);
  try {
    await page.goto(url, { waitUntil: 'load', timeout: NAV_TIMEOUT_MS });
    await waitForAppShell(page);
    const file = `${screen.shot}-${screen.name}-${viewport.suffix}.png`;
    await page.screenshot({ path: path.join(outDir, file), type: 'png', fullPage: false });
    console.log(`    saved: ${file}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`    error: ${screen.name} @ ${viewport.suffix}: ${message}`);
    throw err;
  } finally {
    await context.close();
  }
}

/**
 * @returns {Promise<void>}
 */
async function main() {
  const flags = parseArgs(process.argv.slice(2));
  const outDir = path.resolve(flags.out);

  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  let browser = null;
  try {
    browser = await chromium.launch({ headless: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(
      `Failed to launch Chromium. Run \`npx playwright install chromium\` first.\n${message}`,
    );
    process.exit(2);
  }

  const viewports = pickViewports(flags.viewports);
  let failures = 0;

  for (const viewport of viewports) {
    console.log(`\nCapturing ${viewport.label} [${viewport.suffix}]`);
    for (const screen of SCREENS) {
      try {
        await captureOne({ browser, viewport, screen, base: flags.base, outDir });
      } catch {
        failures++;
      }
    }
  }

  await browser.close();

  if (failures > 0) {
    console.error(`\nDone with ${failures} failure(s). Review stderr above.`);
    process.exit(1);
  }
  console.log('\nAll captures saved to:', outDir);
}

main().catch((err) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`capture.js: uncaught: ${message}`);
  process.exit(1);
});
