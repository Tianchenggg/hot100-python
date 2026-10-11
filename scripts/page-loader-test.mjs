import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';

const nodes = new Map();
function element() {
  return { hidden: false, inert: false, dataset: {}, attrs: {}, listeners: {},
    setAttribute(k, v) { this.attrs[k] = v; }, removeAttribute(k) { delete this.attrs[k]; },
    addEventListener(type, fn) { this.listeners[type] = fn; }, focus() {},
  };
}
for (const id of ['pageLoader', 'pageLoadTitle', 'pageLoadDetail', 'pageLoadActions', 'pageLoadRetry', 'pageLoadBack', 'pageLoadProgress']) nodes.set(id, element());
const visible = element(), hidden = element();
hidden.hidden = true; hidden.inert = true;
let booting = true, now = 0, nextTimer = 0;
const timers = new Map();
const window = {};
const context = {
  window, location: { href: 'https://example.test/?problem=3' },
  document: { activeElement: null, getElementById: id => nodes.get(id), querySelectorAll: () => [visible, hidden], body: { classList: { remove: () => { booting = false; } } } },
  setTimeout(fn, delay) { const id = ++nextTimer; timers.set(id, { fn, at: now + delay }); return id; },
  clearTimeout(id) { timers.delete(id); },
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
loading.stage(first, '正在加载题目');
assert.equal(nodes.get('pageLoadProgress').attrs['aria-valuetext'], '正在加载题目');
loading.finish(first);
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

const entrypoints = await Promise.all(['index.html','recite.html'].map(name => readFile(new URL(`../dist/${name}`, import.meta.url),'utf8')));
for (const html of entrypoints) {
  assert.ok(html.indexOf('id="pageLoader"') < html.indexOf('src="./page-loader.js'));
  assert.ok(html.indexOf('id="pageLoadingStyles"') < html.indexOf('rel="stylesheet"'));
  assert.match(html, /media="print" data-page-style/);
  assert.match(html, /inert aria-busy="true"/);
}
console.log('Loading readiness, delayed display, timeout, cancellation and stale-request checks passed.');
