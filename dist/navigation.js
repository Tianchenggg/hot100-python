// Keep both screens alive: editor, input, scroll and question data load only once.
const base = new URL('./', import.meta.url);
const pages = {
  practice: { selector: '.app-shell', path: './', module: './app.js?v=21', title: 'Hot 100' },
  recite: { selector: '.recitation-app', path: './recite.html', module: './recite.js?v=20', title: '背诵模式 · Hot 100' },
};
let current = document.querySelector('.recitation-app') ? 'recite' : 'practice';
let sequence = 0;
let animation;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
for (const page of Object.values(pages)) {
  page.root = document.querySelector(page.selector);
  page.url = new URL(page.path, base).href;
}
pages[current].url = location.href;
document.body.dataset.page = current;

function stylesheet(href) {
  const url = new URL(href, base).href;
  if ([...document.querySelectorAll('link[rel="stylesheet"]')].some(link => link.href === url)) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const link = document.createElement('link');
    link.rel = 'stylesheet'; link.href = url;
    link.onload = resolve; link.onerror = reject;
    document.head.append(link);
  });
}

async function loadEditor() {
  if (window.CodeMirror) return;
  for (const path of ['lib/codemirror.js', 'mode/python/python.js', 'addon/edit/matchbrackets.js']) {
    await new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = new URL(`./vendor/codemirror/${path}`, base).href;
      script.onload = resolve; script.onerror = reject;
      document.head.append(script);
    });
  }
}

function prepare(name) {
  const page = pages[name];
  if (page.ready) return page.ready;
  page.ready = (async () => {
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
    }
    if (name === 'practice') await loadEditor();
    page.controller = await import(page.module);
    page.root.dataset.ready = 'true';
    return page;
  })().catch(error => { page.ready = null; throw error; });
  return page.ready;
}

async function navigate(name, { pop = false } = {}) {
  if (!pages[name]) return;
  const ticket = ++sequence;
  const page = await prepare(name);
  if (ticket !== sequence) return;
  if (name === current) return;
  const previous = pages[current];
  if (!pop) previous.url = location.href;
  previous.controller?.deactivate?.();
  const update = () => {
    previous.root.hidden = true; previous.root.inert = true;
    page.root.hidden = false; page.root.inert = false;
    current = name;
    document.body.dataset.page = name;
    document.title = page.root.dataset.title || page.title;
    if (!pop) history.pushState({ hot100Page: name }, '', page.root.dataset.url || page.url);
    page.controller?.activate?.();
    page.root.querySelector('.app-rail [aria-current="page"]')?.focus({ preventScroll: true });
  };
  animation?.cancel();
  update();
  // Animate the live panel, not a screenshot of the 100-card page.
  if (!reducedMotion.matches) animation = page.root.querySelector(name === 'recite' ? '.recite-main' : '.workspace').animate?.([
    { opacity: .45, transform: `translateX(${name === 'recite' ? 8 : -8}px)` },
    { opacity: 1, transform: 'translateX(0)' },
  ], { duration: 160, easing: 'cubic-bezier(.2,.8,.2,1)' });
}

document.addEventListener('click', event => {
  const link = event.target.closest('a[data-page]');
  if (!link || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  link.setAttribute('aria-busy', 'true');
  navigate(link.dataset.page).catch(() => location.assign(link.href)).finally(() => link.removeAttribute('aria-busy'));
});
window.addEventListener('popstate', () => {
  const name = location.pathname.endsWith('/recite.html') ? 'recite' : 'practice';
  navigate(name, { pop: true }).catch(() => location.reload());
});

await prepare(current);
const preload = () => prepare(current === 'practice' ? 'recite' : 'practice').catch(() => {});
if ('requestIdleCallback' in window) requestIdleCallback(preload, { timeout: 1000 });
else setTimeout(preload, 120);
