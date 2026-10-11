(() => {
  const panel = document.getElementById('pageLoader');
  const title = document.getElementById('pageLoadTitle');
  const detail = document.getElementById('pageLoadDetail');
  const actions = document.getElementById('pageLoadActions');
  const retry = document.getElementById('pageLoadRetry');
  const back = document.getElementById('pageLoadBack');
  const progress = document.getElementById('pageLoadProgress');
  let token = 0;
  let status = 'idle';
  let timeout;
  let reveal;
  let onCancel;
  let returnFocus;
  const roots = () => document.querySelectorAll('.app-shell, .recitation-app');
  function clearTimers() { clearTimeout(timeout); clearTimeout(reveal); clearTimeout(window.__pageBootTimer); }
  function unlock() {
    roots().forEach(root => { root.inert = root.hidden; root.removeAttribute('aria-busy'); });
  }
  function start({ text = '正在准备页面', href = location.href, cancel = null, delay = 0 } = {}) {
    clearTimers();
    const id = ++token;
    status = 'pending'; onCancel = cancel; returnFocus = document.activeElement;
    title.textContent = '正在加载…'; detail.textContent = text;
    progress.setAttribute('aria-valuetext', text);
    panel.dataset.state = 'loading'; actions.hidden = true; retry.href = href; back.hidden = !cancel;
    roots().forEach(root => { if (!root.hidden) { root.inert = true; root.setAttribute('aria-busy', 'true'); } });
    panel.hidden = delay > 0;
    if (delay) reveal = setTimeout(() => { if (pending(id)) panel.hidden = false; }, delay);
    timeout = setTimeout(() => fail(id, '加载时间较长，请检查网络后重试'), 30000);
    return id;
  }
  const pending = id => id === token && status === 'pending';
  function stage(id, text) {
    if (!pending(id)) return;
    detail.textContent = text; progress.setAttribute('aria-valuetext', text);
  }
  function finish(id) {
    if (!pending(id)) return;
    clearTimers(); status = 'idle'; panel.hidden = true;
    document.body.classList.remove('is-booting'); unlock();
  }
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
  window.pageLoading = { start, stage, finish, fail, cancel, pending, get token() { return token; } };
  start();
})();
