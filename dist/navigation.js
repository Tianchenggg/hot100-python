// Keep both screens alive so switching pages preserves the editor and scroll position.
const base = new URL('./', import.meta.url);
const pages = {
  practice: { selector: '.app-shell', path: './', module: './app.js?v=27', title: 'Hot 100' },
  recite: { selector: '.recitation-app', path: './recite.html', module: './recite.js?v=27', title: '背诵模式 · Hot 100' },
};
const loading = window.pageLoading;
let current = document.querySelector('.recitation-app') ? 'recite' : 'practice';
let sequence = 0;
let animation;
let loadingTarget = current;
let loadingToken = loading.token;
let editorReady;
const styles = new Map();
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
for (const page of Object.values(pages)) {
  page.root = document.querySelector(page.selector);
  page.url = new URL(page.path, base).href;
}
pages[current].url = location.href;
document.body.dataset.page = current;

function stage(name, text, completed = 0, total = 1) {
  pages[name].phase = text;
  if (loadingTarget === name) loading.stage(loadingToken, text, completed, total);
}

function stylesheet(href) {
  const url = new URL(href, base).href;
  if (styles.has(url)) return styles.get(url);
  const ready = new Promise((resolve, reject) => {
    const existing = [...document.querySelectorAll('link[rel="stylesheet"]')].find(link => link.href === url);
    const link = existing || document.createElement('link');
    const done = () => { link.media = 'all'; resolve(); };
    if (link.dataset.failed) { reject(new Error('Stylesheet failed to load')); return; }
    if (link.sheet) { done(); return; }
    link.addEventListener('load', done, { once: true });
    link.addEventListener('error', () => reject(new Error('Stylesheet failed to load')), { once: true });
    if (!existing) { link.rel = 'stylesheet'; link.href = url; document.head.append(link); }
  });
  styles.set(url, ready);
  return ready;
}

function loadEditor() {
  if (editorReady) return editorReady;
  editorReady = (async () => {
    for (const path of ['lib/codemirror.js', 'mode/python/python.js', 'addon/edit/matchbrackets.js']) {
      await new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = new URL(`./vendor/codemirror/${path}`, base).href;
        script.onload = resolve; script.onerror = () => reject(new Error('Editor failed to load'));
        document.head.append(script);
      });
    }
  })();
  return editorReady;
}

function prepare(name) {
  const page = pages[name];
  if (page.ready) return page.ready;
  page.ready = (async () => {
    stage(name, '正在准备页面');
    if (!page.root) {
      const response = await fetch(new URL(page.path, base));
      if (!response.ok) throw new Error('Page failed to load');
      const html = new DOMParser().parseFromString(await response.text(), 'text/html');
      const shell = html.querySelector(page.selector);
      if (!shell) throw new Error('Page content is missing');
      await Promise.all([...html.querySelectorAll('link[rel="stylesheet"]')].map(link => stylesheet(link.getAttribute('href'))));
      page.root = document.importNode(shell, true);
      page.root.hidden = true; page.root.inert = true;
      document.body.append(page.root);
      if (name === 'recite') document.body.append(document.importNode(html.querySelector('#problemDialog'), true));
    } else {
      await Promise.all([...document.querySelectorAll('link[data-page-style]')].map(link => stylesheet(link.href)));
    }
    if (name === 'practice') { stage(name, '正在准备编辑器', 1, 3); await loadEditor(); }
    stage(name, '正在加载题目', name === 'practice' ? 2 : 1, name === 'practice' ? 3 : 2);
    page.controller = await import(page.module);
    page.root.dataset.ready = 'true';
    return page;
  })();
  return page.ready;
}

async function navigate(name, { pop = false } = {}) {
  if (!pages[name]) return;
  if (name === current && pages[name].root?.dataset.ready) {
    if (loadingTarget && loadingTarget !== current) loading.cancel();
    return;
  }
  const ticket = ++sequence;
  loadingTarget = name;
  const token = loadingToken = loading.start({
    text: pages[name].phase || '正在准备页面', href: pages[name].url, delay: 120,
    cancel: document.body.classList.contains('is-booting') ? null : () => { ++sequence; loadingTarget = null; history.replaceState({ hot100Page: current }, '', pages[current].url); },
  });
  try {
    const page = await prepare(name);
    if (ticket !== sequence || !loading.pending(token)) return;
    const previous = pages[current];
    if (!pop) previous.url = location.href;
    previous.controller?.deactivate?.();
    animation?.cancel();
    previous.root.hidden = true; previous.root.inert = true;
    page.root.hidden = false;
    current = name;
    document.body.dataset.page = name;
    document.title = page.root.dataset.title || page.title;
    if (!pop) history.pushState({ hot100Page: name }, '', page.root.dataset.url || page.url);
    page.controller?.activate?.();
    await new Promise(resolve => requestAnimationFrame(resolve));
    if (ticket !== sequence || !loading.pending(token)) return;
    loading.finish(token); loadingTarget = null;
    page.root.querySelector('.app-rail [aria-current="page"]')?.focus({ preventScroll: true });
    if (!reducedMotion.matches) animation = page.root.querySelector(name === 'recite' ? '.recite-main' : '.workspace').animate?.([
      { opacity: .45, transform: `translateX(${name === 'recite' ? 8 : -8}px)` },
      { opacity: 1, transform: 'translateX(0)' },
    ], { duration: 160, easing: 'cubic-bezier(.2,.8,.2,1)' });
  } catch (error) {
    console.error('Page navigation failed', error);
    if (ticket === sequence) loading.fail(token);
  }
}

document.addEventListener('click', event => {
  const link = event.target.closest('a[data-page]');
  if (!link || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  link.setAttribute('aria-busy', 'true');
  navigate(link.dataset.page).finally(() => link.removeAttribute('aria-busy'));
});
window.addEventListener('popstate', () => {
  if (loading.awaitingEntry) { location.reload(); return; }
  navigate(location.pathname.endsWith('/recite.html') ? 'recite' : 'practice', { pop: true });
});

const bootName = current, bootToken = loadingToken, bootTicket = sequence;
try {
  if (await loading.showScene(bootToken) && sequence === bootTicket) {
    const page = await prepare(bootName);
    await new Promise(resolve => requestAnimationFrame(resolve));
    if (sequence === bootTicket && loading.pending(bootToken)) {
      loadingTarget = null;
      const entered = await loading.ready(bootToken, () => page.controller?.activate?.());
      if (entered && sequence === bootTicket) {
        const preload = () => prepare(current === 'practice' ? 'recite' : 'practice').catch(() => {});
        if ('requestIdleCallback' in window) requestIdleCallback(preload, { timeout: 1000 });
        else setTimeout(preload, 120);
      }
    }
  }
} catch (error) {
  console.error('Page initialization failed', error);
  if (sequence === bootTicket) loading.fail(bootToken);
}
