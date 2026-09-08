#!/usr/bin/env node
/**
 * Headless smoke test for the built app (run `npm run build` first).
 *
 *   PLAYWRIGHT_MODULE_DIR=$(npm root -g) node scripts/smoke.mjs
 *
 * Playwright is not a project dependency; point PLAYWRIGHT_MODULE_DIR at a
 * directory whose node_modules (or itself) contains the `playwright` package.
 * Writes docs/screenshot.png (override with SMOKE_OUT).
 *
 * Behind an HTTPS_PROXY (sandboxed CI), external assets (emoji art, fonts) are
 * fetched by Node on the browser's behalf; run with NODE_USE_ENV_PROXY=1 so
 * Node's fetch honours the proxy.
 */
import { spawn } from 'node:child_process';
import { mkdir, readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import process from 'node:process';

const moduleDir = process.env.PLAYWRIGHT_MODULE_DIR;
const requireFrom = createRequire(moduleDir ? path.join(moduleDir, 'noop.js') : import.meta.url);
const { chromium } = requireFrom('playwright');

const PORT = Number(process.env.PORT ?? 4173);
const BASE = `http://127.0.0.1:${PORT}/`;
const OUT = process.env.SMOKE_OUT ?? 'docs';
const proxyServer = process.env.HTTPS_PROXY ?? process.env.https_proxy;
const EXTERNAL_URL = /^https?:\/\/(?!(?:127\.0\.0\.1|localhost)(?:[:/]|$))/;

const assert = (condition, message) => {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
};
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForServer(url, timeoutMs = 30_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // not up yet
    }
    await sleep(250);
  }
  throw new Error(`Preview server did not start at ${url}`);
}

async function settle(page) {
  await page.waitForSelector('[data-testid="preview"][data-pending="false"]', { timeout: 30_000 });
  await page.waitForFunction(() => Array.from(document.images).every((img) => img.complete), null, {
    timeout: 30_000,
  });
  await sleep(400);
}

const previewData = (page) =>
  page.evaluate(() => document.querySelector('[data-testid="preview"] canvas').toDataURL());

const setRange = (page, label, value) =>
  page.getByLabel(label).evaluate((el, v) => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    setter.call(el, String(v));
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }, value);

const server = spawn(
  'npx',
  ['vite', 'preview', '--port', String(PORT), '--strictPort', '--host', '127.0.0.1'],
  { stdio: 'ignore', detached: true },
);
server.unref();
const stopServer = () => {
  try {
    process.kill(-server.pid, 'SIGTERM');
  } catch {
    // already gone
  }
};
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    stopServer();
    process.exit(130);
  });
}
const problems = [];
let browser;

try {
  await waitForServer(BASE);
  await mkdir(OUT, { recursive: true });
  browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    acceptDownloads: true,
  });
  if (proxyServer) {
    await context.route(EXTERNAL_URL, async (route) => {
      const request = route.request();
      try {
        const headers = request.headers();
        const response = await fetch(request.url(), {
          headers: { accept: headers.accept ?? '*/*', 'user-agent': headers['user-agent'] ?? '' },
        });
        await route.fulfill({
          status: response.status,
          headers: {
            'content-type': response.headers.get('content-type') ?? 'application/octet-stream',
            'access-control-allow-origin': '*',
            'cache-control': 'no-store',
          },
          body: Buffer.from(await response.arrayBuffer()),
        });
      } catch (error) {
        console.warn(`external fetch failed for ${request.url().slice(0, 80)}: ${error.message}`);
        await route.abort();
      }
    });
  }
  const watch = (page, name) => {
    page.on('pageerror', (error) => problems.push(`[${name}] pageerror: ${error.message}`));
    page.on('console', (message) => {
      if (message.type() !== 'error') return;
      const text = message.text();
      if (/Failed to load resource/.test(text)) console.warn(`[${name}] resource warning: ${text}`);
      else problems.push(`[${name}] console.error: ${text}`);
    });
  };

  // 1. Loads and renders.
  const page = await context.newPage();
  watch(page, 'desktop');
  await page.goto(BASE);
  await settle(page);
  const initial = await previewData(page);
  assert(initial.startsWith('data:image/png'), 'preview canvas exports a PNG data URL');
  console.log('✓ page renders');

  // 1b. The assistant turns a description into ideas, loads one, and applies tweaks.
  await page.getByTestId('assistant-prompt').fill('gold crown for the server owner');
  await page.getByTestId('assistant-generate').click();
  await page.waitForSelector('[data-testid="idea-0"]');
  const ideaCount = await page.locator('.idea').count();
  assert(ideaCount >= 4, `assistant produced ideas (${ideaCount})`);
  await settle(page);
  const fromAssistant = await previewData(page);
  assert(fromAssistant !== initial, 'the first idea is loaded into the preview');
  assert((await page.getByLabel('Role name').inputValue()) === 'Owner', 'assistant sets the role name from the prompt');
  await page.getByTestId('idea-1').click();
  await settle(page);
  const secondIdea = await previewData(page);
  assert(secondIdea !== fromAssistant, 'clicking another idea changes the preview');
  await page.screenshot({ path: path.join(OUT, 'screenshot.png'), fullPage: true });
  await page.getByTestId('assistant-tweak').fill('make it a hexagon');
  await page.getByTestId('assistant-apply').click();
  await settle(page);
  const tweaked = await previewData(page);
  assert(tweaked !== secondIdea, 'a tweak instruction changes the preview');
  const shapeAfterTweak = await page.evaluate(() => JSON.parse(localStorage.getItem('role-icon-maker:v1')).icon.shape);
  assert(shapeAfterTweak === 'hexagon', `tweak changed the shape to hexagon (${shapeAfterTweak})`);
  console.log(`✓ assistant: ${ideaCount} ideas, load, tweak; screenshot saved`);

  // 2. A control change repaints the preview.
  await page.getByRole('tab', { name: 'Effects' }).click();
  await setRange(page, 'Width', 0.1);
  await sleep(300);
  const edited = await previewData(page);
  assert(edited !== initial, 'changing the border width repaints the preview');
  console.log('✓ slider change repaints');

  // 3. Export produces a PNG of the requested size.
  await page.getByRole('tab', { name: 'Export' }).click();
  await page.waitForFunction(
    () => document.querySelector('[data-testid="size-estimate"]')?.textContent?.trim() !== '…',
    null,
    { timeout: 30_000 },
  );
  const estimate = await page.getByTestId('size-estimate').textContent();
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByTestId('download').click(),
  ]);
  const file = await readFile(await download.path());
  assert(file.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), 'download is a PNG');
  assert(file.readUInt32BE(16) === 256 && file.readUInt32BE(20) === 256, 'download is 256×256');
  assert(download.suggestedFilename() === 'role-icon-owner-256.png', `filename ${download.suggestedFilename()}`);
  assert(file.length <= 256 * 1024, 'download is under 256 KB');
  console.log(`✓ export: ${download.suggestedFilename()} (${file.length} bytes, estimate ${estimate})`);

  // 4. Share link round-trips through a fresh page.
  await page.getByRole('button', { name: 'Copy share link' }).first().click();
  const hash = await page.evaluate(() => window.location.hash);
  assert(hash.startsWith('#s='), 'share link is written to the URL hash');
  const shared = await context.newPage();
  watch(shared, 'shared');
  await shared.goto(BASE + hash);
  await settle(shared);
  assert((await previewData(shared)) === edited, 'share link reproduces the same icon');
  await shared.close();
  console.log('✓ share link round-trips');

  // 5. Presets load and survive a reload (localStorage).
  await page.getByTestId('preset-admin').click();
  await settle(page);
  const preset = await previewData(page);
  assert(preset !== edited, 'preset changes the icon');
  assert((await page.getByLabel('Role name').inputValue()) === 'Admin', 'preset sets the role name');
  await page.reload();
  await settle(page);
  assert((await previewData(page)) === preset, 'design persists across reloads');
  console.log('✓ presets and persistence');

  // 6. Mobile layout: single column, no horizontal scroll.
  const mobile = await context.newPage();
  watch(mobile, 'mobile');
  await mobile.setViewportSize({ width: 390, height: 844 });
  await mobile.goto(BASE);
  await settle(mobile);
  const layout = await mobile.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    columns: getComputedStyle(document.querySelector('.main')).gridTemplateColumns.split(' ').length,
  }));
  assert(layout.scrollWidth <= 390, `no horizontal overflow on mobile (scrollWidth ${layout.scrollWidth})`);
  assert(layout.columns === 1, `single column on mobile (${layout.columns} columns)`);
  await mobile.screenshot({ path: path.join(process.env.SMOKE_SCRATCH ?? OUT, 'screenshot-mobile.png'), fullPage: true });
  console.log('✓ mobile layout');

  await browser.close();
} catch (error) {
  problems.push(error.stack ?? String(error));
} finally {
  if (browser) await browser.close().catch(() => {});
  stopServer();
}

if (problems.length > 0) {
  console.error('\nSmoke test FAILED:');
  for (const problem of problems) console.error(` - ${problem}`);
  process.exit(1);
}
console.log('\nSmoke test passed');
