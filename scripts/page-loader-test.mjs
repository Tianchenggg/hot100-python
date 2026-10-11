import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';

const nodes = new Map();
function element() {
  const properties = new Map();
  return { hidden: false, inert: false, dataset: {}, attrs: {}, listeners: {},
    style: { setProperty(k, v) { properties.set(k, v); }, getPropertyValue(k) { return properties.get(k); } }, querySelector() { return null; }, querySelectorAll() { return []; },
    setAttribute(k, v) { this.attrs[k] = v; }, removeAttribute(k) { delete this.attrs[k]; },
    addEventListener(type, fn) { this.listeners[type] = fn; }, focus() {},
  };
}
for (const id of ['pageLoader', 'pageLoadTitle', 'pageLoadDetail', 'pageLoadActions', 'pageLoadRetry', 'pageLoadBack', 'pageLoadProgress', 'pageLoadMeter', 'pageLoadValue', 'pageLoadEnter', 'pageLoadDoor']) nodes.set(id, element());
const visible = element(), hidden = element();
hidden.hidden = true; hidden.inert = true;
let booting = true, now = 0, nextTimer = 0, nextFrame = 0;
const timers = new Map();
const window = {};
const frames = new Map();
function paint(ms = 16) {
  advance(ms);
  for (const [id, fn] of [...frames]) {
    if (!frames.has(id)) continue;
    frames.delete(id); fn(now);
  }
}
const reducedMotion = { matches: false };
const context = {
  window, matchMedia: () => reducedMotion, location: { href: 'https://example.test/?problem=3' },
  performance: { now: () => now },
  document: { activeElement: null, getElementById: id => nodes.get(id), querySelectorAll: () => [visible, hidden], body: { classList: { remove: () => { booting = false; } } } },
  setTimeout(fn, delay) { const id = ++nextTimer; timers.set(id, { fn, at: now + delay }); return id; },
  clearTimeout(id) { timers.delete(id); },
  requestAnimationFrame(fn) { const id = ++nextFrame; frames.set(id, fn); return id; },
  cancelAnimationFrame(id) { frames.delete(id); },
};
const advance = ms => {
  const end = now + ms;
  for (;;) {
    const next = [...timers].filter(([, timer]) => timer.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
    if (!next) break;
    const [id, timer] = next;
    now = timer.at; timers.delete(id); timer.fn();
  }
  now = end;
};
runInNewContext(await readFile(new URL('../dist/page-loader.js', import.meta.url), 'utf8'), context);
const loading = window.pageLoading, panel = nodes.get('pageLoader');
const meter = nodes.get('pageLoadMeter'), enter = nodes.get('pageLoadEnter'), door = nodes.get('pageLoadDoor');
const displayed = () => Number(meter.style.getPropertyValue('--load-progress')) * 100;
function assertProgressSynchronized() {
  const amount = displayed(), label = Number(meter.attrs['aria-valuenow']);
  assert.ok(Number.isFinite(amount) && amount >= 0 && amount <= 100);
  assert.ok(Number.isInteger(label) && label <= amount + 1e-9 && amount < label + 1 + 1e-9, 'the label must follow the fill');
  assert.equal(nodes.get('pageLoadValue').textContent, `${label}%`);
  if (amount < 100 - 1e-9) assert.ok(label < 100, 'the label cannot round up to 100 early');
}
function progressPaint(ms = 16) {
  const before = displayed();
  paint(ms); assertProgressSynchronized();
  const change = displayed() - before;
  assert.ok(change >= -1e-9, 'displayed progress must never rewind');
  assert.ok(change <= 32 * 48 / 1000 + 1e-9, 'each frame must be rate limited');
}
function reach(percent) {
  let count = 0;
  while (displayed() < percent && count++ < 1200) progressPaint();
  assert.equal(displayed(), percent, 'progress must reach its target in a bounded number of frames');
}
function finishProgress() {
  reach(100);
  assert.equal(panel.dataset.state, 'completing');
  assert.equal(enter.hidden, true); assert.equal(enter.disabled, true); assert.equal(door.disabled, true);
  enter.listeners.click(); door.listeners.click();
  assert.equal(panel.dataset.state, 'completing', 'early clicks must not open the door');
  advance(180);
  assert.equal(enter.hidden, true, 'a timer alone cannot bypass the full-bar paint');
  progressPaint(); advance(179);
  assert.equal(enter.hidden, true, 'the painted full bar must hold for 180 ms');
  advance(1);
  assert.equal(panel.dataset.state, 'ready');
  assert.equal(enter.hidden, false); assert.equal(enter.disabled, false); assert.equal(door.disabled, false);
  assert.equal(frames.size, 0);
}
const first = loading.token;
assert.equal(visible.inert, true);
assert.equal(panel.hidden, false);
assert.equal(panel.dataset.sceneReady, 'false');
loading.stage(first, 'too early', 2, 3);
assert.equal(nodes.get('pageLoadMeter').attrs['aria-valuenow'], '0', 'progress cannot start before the complete scene');
assert.equal(await loading.ready(first), false, 'entry cannot be enabled before the scene');
async function presentScene(id) {
  const showing = loading.showScene(id);
  await new Promise(setImmediate);
  paint(); paint();
  return showing;
}
assert.equal(await presentScene(first), true);
assert.equal(panel.dataset.sceneReady, 'true');
assert.equal(nodes.get('pageLoadMeter').attrs['aria-valuenow'], '0');
loading.stage(first, '正在准备编辑器', 1, 3);
assert.equal(displayed(), 0, 'stage completion sets a target without jumping the display');
progressPaint(); progressPaint();
loading.stage(first, '正在加载题目', 2, 3);
assert.equal(nodes.get('pageLoadProgress').attrs['aria-valuetext'], '正在加载题目');
loading.stage(first, 'late older stage', 1, 3);
assert.equal(frames.size, 1, 'rapid updates share one progress loop');
assert.equal(nodes.get('pageLoadDetail').textContent, '正在加载', 'the visible caption stays stable');
reach(67);
loading.stage(first, 'another old stage', 1, 3);
for (let i = 0; i < 10; i++) progressPaint();
assert.equal(displayed(), 67, 'a lower target cannot rewind progress');
advance(5000); progressPaint();
assert.equal(displayed(), 67, 'time alone cannot advance beyond completed resources');
loading.stage(first, 'more resources', 99, 100);
const beforePause = displayed();
advance(5000); progressPaint();
assert.ok(displayed() > beforePause && displayed() - beforePause <= 1.536 + 1e-9, 'background resumption must not jump');
let prepared = 0;
const entered = loading.ready(first, () => prepared++);
assert.ok(displayed() < 100);
assert.equal(panel.dataset.state, 'completing');
assert.equal(visible.inert, true);
assert.equal(booting, true);
assert.equal(loading.pending(first), false);
assert.equal(await loading.ready(first), false, 'duplicate ready calls must not restart completion');
advance(30001);
assert.equal(panel.dataset.state, 'completing', 'real loading completion clears the resource timeout');
progressPaint(); finishProgress();
advance(30001); loading.fail(first);
assert.equal(panel.dataset.state, 'ready', 'waiting for entry must not time out');
nodes.get('pageLoadEnter').listeners.click();
assert.equal(booting, false);
assert.equal(prepared, 1, 'layout must be prepared before the overlay reveals it');
assert.equal(panel.dataset.state, 'ready', 'the overlay stays opaque through layout preparation');
paint(); paint();
assert.equal(visible.inert, true, 'page stays locked while the door opens');
assert.equal(panel.hidden, false);
assert.equal(panel.dataset.state, 'opening');
nodes.get('pageLoadDoor').listeners.click();
assert.equal(timers.size, 1, 'repeated entry must not start another animation');
panel.listeners.animationend({target: panel, animationName:'door-arrival'});
assert.equal(await entered, true);
assert.equal(booting, false);
assert.equal(panel.hidden, true);
assert.equal(visible.inert, false);
assert.equal(hidden.inert, true);
advance(30001);
assert.equal(panel.hidden, true, 'a completed request must not time out later');

const quick = loading.start({ delay: 120 });
loading.finish(quick); advance(121);
assert.equal(panel.hidden, true, 'cached navigation must not flash the loading screen');
const old = loading.start(), newer = loading.start();
loading.finish(old); loading.fail(old);
assert.equal(loading.pending(newer), true, 'a stale request cannot dismiss or fail the current load');
advance(30000);
assert.equal(panel.dataset.state, 'error');
assert.equal(nodes.get('pageLoadActions').hidden, false);
assert.equal(visible.inert, true);
loading.finish(newer);
assert.equal(panel.hidden, false, 'late completion after timeout must not silently navigate');

let cancelled = 0;
const cancelledToken = loading.start({ cancel: () => cancelled++, delay: 120 });
advance(120); assert.equal(panel.hidden, false);
loading.fail(cancelledToken);
nodes.get('pageLoadBack').listeners.click();
assert.equal(cancelled, 1);
assert.equal(panel.hidden, true);
assert.equal(visible.inert, false);
assert.equal(hidden.inert, true);
assert.equal(loading.pending(cancelledToken), false);
loading.finish(cancelledToken); loading.fail(cancelledToken);
assert.equal(panel.hidden, true);

const fallback = loading.start({ entrance: true });
await presentScene(fallback);
const fallbackEntry = loading.ready(fallback);
assert.equal(displayed(), 0, 'fully cached resources still begin visibly at zero');
progressPaint(); assert.ok(displayed() > 0 && displayed() < 2);
finishProgress();
nodes.get('pageLoadDoor').listeners.click();
paint(); paint();
advance(2050);
assert.equal(await fallbackEntry, true, 'animation fallback must unblock entry');
reducedMotion.matches = true;
const reduced = loading.start({ entrance: true });
await presentScene(reduced);
const reducedEntry = loading.ready(reduced);
assert.equal(displayed(), 100); assertProgressSynchronized();
assert.equal(panel.dataset.state, 'completing'); assert.equal(enter.hidden, true);
enter.listeners.click(); assert.equal(panel.dataset.state, 'completing');
paint();
assert.equal(panel.dataset.state, 'ready', 'reduced motion offers entry on the next frame');
nodes.get('pageLoadEnter').listeners.click();
assert.equal(await reducedEntry, true);
assert.equal(panel.hidden, true, 'reduced motion must enter without animation');
const abandoned = loading.start({ entrance: true });
await presentScene(abandoned);
const abandonedEntry = loading.ready(abandoned);
const abandonedFrame = [...frames.values()][0];
loading.start();
assert.equal(await abandonedEntry, false, 'a replacement must settle the previous entrance');
abandonedFrame(now);
assert.equal(enter.hidden, true, 'an obsolete reduced-motion frame cannot reveal entry');
loading.finish(loading.token);
reducedMotion.matches = false;

// Failures, cancellation and replacement must discard progress callbacks.
for (const operation of ['fail', 'cancel', 'finish', 'start']) {
  const id = loading.start({ entrance: true, cancel: () => cancelled++ });
  await presentScene(id); loading.stage(id, 'loading', 2, 3); progressPaint();
  const staleFrame = [...frames.values()][0];
  assert.equal(typeof staleFrame, 'function');
  if (operation === 'start') loading.start();
  else loading[operation](id);
  const amount = displayed(), state = panel.dataset.state;
  assert.equal(frames.size, 0, `${operation} must cancel progress RAF`);
  staleFrame(now + 5000);
  assert.equal(displayed(), amount, `${operation} must ignore an already captured callback`);
  assert.equal(panel.dataset.state, state); assert.equal(frames.size, 0);
  if (operation === 'start') loading.finish(loading.token);
}

// Completion timers must not enable entry after cancellation or replacement.
for (const operation of ['cancel', 'start']) {
  const id = loading.start({ entrance: true, cancel: () => cancelled++ });
  await presentScene(id);
  const entry = loading.ready(id);
  reach(100); progressPaint();
  if (operation === 'cancel') loading.cancel();
  else loading.start();
  assert.equal(await entry, false);
  advance(181);
  assert.equal(enter.hidden, true, 'an old completion timer cannot reveal entry');
  assert.equal(frames.size, 0);
  if (operation === 'start') loading.finish(loading.token);
}

// Every image may arrive last, and load completion alone must not bypass decoding.
for (const delayed of ['sky', 'frame', 'leaf']) {
  let decodeImage;
  const images = ['sky', 'frame', 'leaf'].map(name => {
    const image = element(); image.complete = name !== delayed; image.naturalWidth = image.complete ? 100 : 0;
    image.decode = () => name === delayed ? new Promise(resolve => { decodeImage = resolve; }) : Promise.resolve();
    return image;
  });
  panel.querySelectorAll = () => images;
  const id = loading.start({ entrance: true });
  const scene = loading.showScene(id);
  await new Promise(setImmediate);
  assert.equal(panel.dataset.sceneReady, 'false', `${delayed} must hold the whole scene`);
  const last = images[['sky', 'frame', 'leaf'].indexOf(delayed)];
  last.complete = true; last.naturalWidth = 100; last.listeners.load();
  await new Promise(setImmediate);
  assert.equal(panel.dataset.sceneReady, 'false', 'loaded but not decoded must stay hidden');
  decodeImage(); await new Promise(setImmediate);
  assert.equal(panel.dataset.sceneReady, 'true');
  assert.equal(nodes.get('pageLoadMeter').attrs['aria-valuenow'], '0');
  let painted = false; scene.then(() => { painted = true; });
  paint(); await new Promise(setImmediate);
  assert.equal(painted, false, 'initial scene must paint before progress begins');
  paint(); assert.equal(await scene, true);
  loading.finish(id);
}
const broken = element(); broken.complete = true; broken.naturalWidth = 100;
broken.decode = () => Promise.reject(new Error('decode failed'));
panel.querySelectorAll = () => [broken];
const brokenId = loading.start({ entrance: true });
await assert.rejects(loading.showScene(brokenId), /decode failed/);
loading.fail(brokenId);
assert.equal(panel.dataset.sceneReady, 'false');
assert.equal(nodes.get('pageLoadActions').hidden, false);
let lateDecode;
broken.decode = () => new Promise(resolve => { lateDecode = resolve; });
const lateId = loading.start({ entrance: true });
const lateScene = loading.showScene(lateId);
advance(30000); lateDecode();
assert.equal(await lateScene, false);
assert.equal(panel.dataset.state, 'error');
assert.equal(panel.dataset.sceneReady, 'false', 'late images cannot reveal a timed-out scene');
panel.querySelectorAll = () => [];
await loading.assets();
const entrypoints = await Promise.all(['index.html','recite.html'].map(name => readFile(new URL(`../dist/${name}`, import.meta.url),'utf8')));
for (const html of entrypoints) {
  assert.ok(html.indexOf('id="pageLoader"') < html.indexOf('src="./page-loader.js'));
  assert.ok(html.indexOf('id="pageLoadingStyles"') < html.indexOf('rel="stylesheet"'));
  assert.match(html, /media="print" data-page-style/);
  assert.match(html, /data-gate="true" data-scene-ready="false"/);
  assert.match(html, /rel="preload" href="\.\/assets\/celestial-sky.jpg"/);
  assert.match(html, /overflow:clip/, "entry overlay must not scroll when focus changes");
  assert.match(html, /inert aria-busy="true"/);
  assert.match(html, /id="pageLoadEnter" type="button" hidden disabled/);
  assert.match(html, /id="pageLoadDoor" type="button" aria-label="开门进入" disabled/);
  const trackRule = html.match(/\.entrance-progress-track\s*\{([^}]+)\}/)?.[1];
  const fillRule = html.match(/\.entrance-progress-fill\s*\{([^}]+)\}/)?.[1];
  assert.match(trackRule, /height:4px;\s*padding:0;/, 'the border-box track must leave room for the fill');
  assert.match(fillRule, /transform:scaleX\(var\(--load-progress,0\)\)/);
  assert.doesNotMatch(fillRule, /transition:/, 'CSS must not delay the fill behind the number');
  assert.match(html, /\.entrance-enter-wrap\s*\{[^}]*flex:0 0 46px/, 'entry action must have reserved layout space');
}
console.log('Smooth progress, full-bar entry timing, stale frames, scene decoding, errors, reduced motion and navigation checks passed.');
