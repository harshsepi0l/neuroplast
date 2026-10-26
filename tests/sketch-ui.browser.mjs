// Run against a running app: node tests/sketch-ui.browser.mjs
// BROWSER_PATH and BASE_URL can override the local defaults.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import puppeteer from 'puppeteer-core';

const browser = await puppeteer.launch({
  executablePath: process.env.BROWSER_PATH || '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
  headless: true,
});
const base = process.env.BASE_URL || 'http://127.0.0.1:3000';
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.welcome h1');
  await page.waitForSelector('.navigation-open');
  await page.evaluate(() => document.fonts.ready);
  assert.match(await page.$eval('h1', el => el.textContent), /What would you like/);
  assert.equal(await page.$$('.suggestions button').then(x => x.length), 3);
  const labels = await page.$$eval('nav[aria-label="Workspace navigation"] button', els => els.map(el => el.textContent));
  for (const label of ['Home', 'Learn', 'Challenges', 'Knowledge', 'Sessions', 'Settings']) {
    assert.ok(labels.some(text => text.startsWith(label)), `Missing navigation: ${label}`);
  }
  await page.click('.suggestions button');
  assert.equal(await page.$eval('.composer-input', el => el.value), 'Understand a difficult topic');
  await mkdir('test-results', { recursive: true });
  for (const mode of ['light', 'dark']) {
    await page.mouse.move(1270, 790);
    await page.evaluate(async mode => {
      document.documentElement.classList.toggle('dark', mode === 'dark');
      // Flush style changes and wait for the theme's color transitions.
      getComputedStyle(document.querySelector('.composer-box')).borderColor;
      await Promise.all(document.getAnimations().map(animation => animation.finished.catch(() => {})));
    }, mode);
    const visual = await page.evaluate(() => {
      const css = selector => getComputedStyle(document.querySelector(selector));
      const welcome = document.querySelector('.welcome').getBoundingClientRect();
      const composer = document.querySelector('.composer-wrap').getBoundingClientRect();
      return {
        canvas: css('.workspace').backgroundColor,
        dots: css('.workspace').backgroundImage,
        active: css('.nav-item.selected').backgroundColor,
        stroke: css('.composer-box').borderTopWidth,
        font: css('.welcome h1').fontFamily,
        alignment: css('.welcome').textAlign,
        aligned: Math.abs(welcome.left - composer.left) < 2,
        overflow: document.documentElement.scrollWidth > innerWidth,
      };
    });
    assert.equal(visual.canvas, mode === 'light' ? 'rgb(255, 255, 255)' : 'rgb(18, 18, 18)');
    assert.match(visual.dots, /radial-gradient/);
    assert.equal(visual.active, 'rgb(255, 212, 59)');
    assert.equal(visual.stroke, '2px');
    assert.match(visual.font, /Cascadia Mono/);
    assert.equal(visual.alignment, 'left');
    assert.equal(visual.aligned, true);
    assert.equal(visual.overflow, false);
    await page.screenshot({ path: `test-results/home-${mode}.png` });
  }
  await page.goto(`${base}/challenges`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.challenge-page');
  await page.goto(`${base}/chat/new`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.welcome');
  assert.ok(page.url().endsWith('/chat/new'), 'Learn has its own route');
  await page.setViewport({ width: 390, height: 844 });
  await page.evaluate(() => localStorage.setItem('neuroplast:sidebar-open', '0'));
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.welcome');
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await page.click('button[aria-label="Open navigation"]');
  await page.waitForSelector('.navigation-open');
  await page.click('button[aria-label="Close navigation"]');
  await page.waitForSelector('.navigation-closed');
  await page.screenshot({ path: 'test-results/home-mobile.png' });
  console.log('Mock UI browser checks passed: light/dark, layout, draft chips, routes, mobile navigation.');
} finally {
  await browser.close();
}
