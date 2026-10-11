import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';

const nodes = new Map();
function element() {
  return { hidden: false, inert: false, dataset: {}, attrs: {}, listeners: {},
    style: { setProperty() {} }, querySelector() { return null; }, querySelectorAll() { return []; },
    setAttribute(k, v) { this.attrs[k] = v; }, removeAttribute(k) { delete this.attrs[k]; },
    addEventListener(type, fn) { this.listeners[type] = fn; }, focus() {},
  };
}
for (const id of ['pageLoader', 'pageLoadTitle', 'pageLoadDetail', 'pageLoadActions', 'pageLoadRetry', 'pageLoadBack', 'pageLoadProgress', 'pageLoadMeter', 'pageLoadValue', 'pageLoadEnter', 'pageLoadDoor']) nodes.set(id, element());
const visible = element(), hidden = element();
hidden.hidden = true; hidden.inert = true;
let booting = true, now = 0, nextTimer = 0;
const timers = new Map();
const window = {};
const frames = [];
const paint = () => { for (const fn of frames.splice(0)) fn(); };
const reducedMotion = { matches: false };
const context = {
  window, matchMedia: () => reducedMotion, location: { href: 'https://example.test/?problem=3' },
  document: { activeElement: null, getElementById: id => nodes.get(id), querySelectorAll: () => [visible, hidden], body: { classList: { remove: () => { booting = false; } } } },
  setTimeout(fn, delay) { const id = ++nextTimer; timers.set(id, { fn, at: now + delay }); return id; },
  clearTimeout(id) { timers.delete(id); },
  requestAnimationFrame(fn) { frames.push(fn); },
};
const advance = ms => {
  now += ms;
  for (const [id, timer] of [...timers]) if (timer.at <= now && timers.has(id)) { timers.delete(id); timer.fn(); }
};
runInNewContext(await readFile(new URL('../dist/page-loader.js', import.meta.url), 'utf8'), context);
const loading = window.pageLoading, panel = nodes.get('pageLoader');
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
loading.stage(first, '正在加载题目', 2, 3);
assert.equal(nodes.get('pageLoadProgress').attrs['aria-valuetext'], '正在加载题目');
assert.equal(nodes.get('pageLoadMeter').attrs['aria-valuenow'], '67');
let prepared = 0;
const entered = loading.ready(first, () => prepared++);
assert.equal(nodes.get('pageLoadMeter').attrs['aria-valuenow'], '100');
assert.equal(panel.dataset.state, 'ready');
assert.equal(visible.inert, true);
assert.equal(booting, true);
assert.equal(loading.pending(first), false);
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
nodes.get('pageLoadDoor').listeners.click();
paint(); paint();
advance(2050);
assert.equal(await fallbackEntry, true, 'animation fallback must unblock entry');
reducedMotion.matches = true;
const reduced = loading.start({ entrance: true });
await presentScene(reduced);
const reducedEntry = loading.ready(reduced);
nodes.get('pageLoadEnter').listeners.click();
assert.equal(await reducedEntry, true);
assert.equal(panel.hidden, true, 'reduced motion must enter without animation');
const abandoned = loading.start({ entrance: true });
await presentScene(abandoned);
const abandonedEntry = loading.ready(abandoned);
loading.start();
assert.equal(await abandonedEntry, false, 'a replacement must settle the previous entrance');
loading.finish(loading.token);

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
}
console.log('Atomic scene loading, image decoding, first paint, timeout, explicit entry and navigation checks passed.');
