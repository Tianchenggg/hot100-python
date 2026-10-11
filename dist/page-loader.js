(() => {
  const panel = document.getElementById('pageLoader');
  const title = document.getElementById('pageLoadTitle');
  const detail = document.getElementById('pageLoadDetail');
  const actions = document.getElementById('pageLoadActions');
  const retry = document.getElementById('pageLoadRetry');
  const back = document.getElementById('pageLoadBack');
  const progress = document.getElementById('pageLoadProgress');
  const meter = document.getElementById('pageLoadMeter');
  const value = document.getElementById('pageLoadValue');
  const enterButton = document.getElementById('pageLoadEnter');
  const doorButton = document.getElementById('pageLoadDoor');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let token = 0, status = 'idle', gate = false;
  let timeout, reveal, openingTimer, onCancel, returnFocus, resolveEntry, prepareEntry;
  const roots = () => document.querySelectorAll('.app-shell, .recitation-app');
  function clearTimers() { clearTimeout(timeout); clearTimeout(reveal); clearTimeout(openingTimer); clearTimeout(window.__pageBootTimer); }
  function unlock() {
    roots().forEach(root => { root.inert = root.hidden; root.removeAttribute('aria-busy'); });
  }
  function setProgress(percent) {
    meter.style.setProperty('--load-progress', `${percent}%`);
    meter.setAttribute('aria-valuenow', String(percent));
    value.textContent = `${percent}%`;
  }
  function start({ text = '正在准备页面', href = location.href, cancel = null, delay = 0, entrance = false } = {}) {
    clearTimers(); resolveEntry?.(false); resolveEntry = null;
    const id = ++token;
    status = 'pending'; gate = entrance; onCancel = cancel; returnFocus = document.activeElement;
    title.textContent = gate ? 'Hot 100' : '正在加载…'; detail.textContent = text;
    progress.setAttribute('aria-valuetext', text); setProgress(0);
    panel.dataset.gate = String(gate); panel.dataset.state = 'loading'; panel.dataset.sceneReady = String(!gate);
    actions.hidden = true; retry.href = href; back.hidden = !cancel;
    enterButton.hidden = true; enterButton.disabled = true; doorButton.disabled = true;
    roots().forEach(root => { if (!root.hidden) { root.inert = true; root.setAttribute('aria-busy', 'true'); } });
    panel.hidden = delay > 0;
    if (delay) reveal = setTimeout(() => { if (pending(id)) panel.hidden = false; }, delay);
    timeout = setTimeout(() => fail(id, '加载时间较长，请检查网络后重试'), 30000);
    return id;
  }
  const pending = id => id === token && status === 'pending';
  function stage(id, text, completed = 0, total = 1) {
    if (!pending(id) || (gate && panel.dataset.sceneReady !== 'true')) return;
    detail.textContent = text; progress.setAttribute('aria-valuetext', text);
    setProgress(Math.min(99, Math.round(completed / total * 100)));
  }
  function finish(id) {
    if (!pending(id)) return;
    clearTimers(); status = 'idle'; panel.hidden = true;
    document.body.classList.remove('is-booting'); unlock();
  }
  function ready(id, beforeEnter = () => {}) {
    if (!pending(id) || (gate && panel.dataset.sceneReady !== 'true')) return Promise.resolve(false);
    clearTimers(); prepareEntry = beforeEnter; status = 'ready'; panel.hidden = false; panel.dataset.state = 'ready';
    setProgress(100); detail.textContent = '准备就绪';
    enterButton.hidden = false; enterButton.disabled = false; doorButton.disabled = false;
    enterButton.focus({ preventScroll: true });
    return new Promise(resolve => { resolveEntry = resolve; });
  }
  function completeEntry(id) {
    if (id !== token || status !== 'opening') return;
    clearTimers(); status = 'idle'; panel.hidden = true; unlock();
    roots().forEach(root => { if (!root.hidden) { root.setAttribute('tabindex', '-1'); root.focus({ preventScroll: true }); } });
    resolveEntry?.(true); resolveEntry = null;
  }
  function enter() {
    if (status !== 'ready') return;
    const id = token;
    status = 'entering'; enterButton.disabled = true; doorButton.disabled = true;
    document.body.classList.remove('is-booting');
    try { prepareEntry(); } catch {
      status = 'pending'; fail(id); resolveEntry?.(false); resolveEntry = null; return;
    }
    const open = () => {
      if (id !== token || status !== 'entering') return;
      status = 'opening'; panel.dataset.state = 'opening';
      if (reducedMotion.matches) completeEntry(id);
      else openingTimer = setTimeout(() => completeEntry(id), 2050);
    };
    if (reducedMotion.matches) open();
    else requestAnimationFrame(() => requestAnimationFrame(open));
  }
  panel.addEventListener('animationend', event => {
    if (event.target === panel && event.animationName === 'door-arrival') completeEntry(token);
  });
  function fail(id, message = '请检查网络后重新加载') {
    if (!pending(id)) return;
    clearTimers(); status = 'error'; panel.hidden = false; panel.dataset.state = 'error';
    title.textContent = '页面未能加载'; detail.textContent = message; actions.hidden = false;
    retry.focus({ preventScroll: true });
  }
  function cancel() {
    if (!onCancel) return;
    const cancel = onCancel;
    clearTimers(); ++token; status = 'idle'; panel.hidden = true; unlock(); cancel();
    if (returnFocus?.isConnected && !returnFocus.closest('[hidden]')) returnFocus.focus({ preventScroll: true });
  }
  back.addEventListener('click', cancel);
  enterButton.addEventListener('click', enter); doorButton.addEventListener('click', enter);
  function assets() {
    return Promise.all([...panel.querySelectorAll('[data-entrance-asset]')].map(async asset => {
      if (!asset.complete) await new Promise((resolve, reject) => {
        asset.addEventListener('load', resolve, { once: true });
        asset.addEventListener('error', reject, { once: true });
      });
      if (!asset.naturalWidth) throw new Error('Scene failed to load');
      if (asset.decode) await asset.decode();
    }));
  }
  async function showScene(id) {
    await assets();
    if (!pending(id) || !gate) return false;
    panel.dataset.sceneReady = 'true';
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    return pending(id) && gate;
  }
  window.pageLoading = { assets, showScene, start, stage, finish, ready, fail, cancel, pending, get token() { return token; }, get awaitingEntry() { return gate && status !== 'idle'; } };
  start({ entrance: true });
})();
