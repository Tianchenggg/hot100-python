export function initLayout({ read, save, refreshEditor, mobileLayout }) {
  const shell = document.getElementById('appShell');
  const body = document.querySelector('.workspace-body');
  const sidebarHandle = document.getElementById('sidebarResizer');
  const statementHandle = document.getElementById('statementResizer');
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const storedSidebar = Number(read('layout:sidebarWidth'));
  const storedRatio = Number(read('layout:statementRatio'));
  let sidebarWidth = Number.isFinite(storedSidebar) && storedSidebar > 0 ? storedSidebar : null;
  let statementRatio = Number.isFinite(storedRatio) && storedRatio > 0 ? clamp(storedRatio, 0.1, 0.9) : 0.43;
  let active = null;
  let frame = 0;
  let editorFrame = 0;

  const defaultSidebar = () => innerWidth <= 1100 ? 220 : 248;
  const sidebarLimits = () => ({ min: 192, max: Math.max(192, Math.min(420, shell.clientWidth - 48 - 8 - 522)) });
  const statementLimits = () => {
    const min = Math.min(240, body.clientWidth / 2);
    return { min, max: Math.max(min, body.clientWidth - 280) };
  };
  function setAria(handle, value, limits) {
    handle.setAttribute('aria-valuemin', Math.round(limits.min));
    handle.setAttribute('aria-valuemax', Math.round(limits.max));
    handle.setAttribute('aria-valuenow', Math.round(value));
    handle.setAttribute('aria-valuetext', `${Math.round(value)} 像素`);
  }
  function scheduleEditorRefresh() {
    if (editorFrame) return;
    editorFrame = requestAnimationFrame(() => { editorFrame = 0; refreshEditor(); });
  }
  function fitStatement() {
    if (!mobileLayout.matches) {
      const limits = statementLimits();
      const width = clamp(body.clientWidth * statementRatio, limits.min, limits.max);
      body.style.setProperty('--statement-width', `${width}px`);
      setAria(statementHandle, width, limits);
    }
    scheduleEditorRefresh();
  }
  function fitLayout() {
    if (!mobileLayout.matches) {
      const limits = sidebarLimits();
      const width = clamp(sidebarWidth ?? defaultSidebar(), limits.min, limits.max);
      shell.style.setProperty('--sidebar-width', `${width}px`);
      setAria(sidebarHandle, width, limits);
    }
    fitStatement();
  }
  function setWidth(kind, width) {
    if (kind === 'sidebar') {
      const limits = sidebarLimits();
      sidebarWidth = clamp(width, limits.min, limits.max);
      shell.style.setProperty('--sidebar-width', `${sidebarWidth}px`);
      setAria(sidebarHandle, sidebarWidth, limits);
      fitStatement();
    } else {
      const limits = statementLimits();
      const bounded = clamp(width, limits.min, limits.max);
      statementRatio = bounded / body.clientWidth;
      fitStatement();
    }
  }
  function persist() {
    save('layout:sidebarWidth', sidebarWidth === null ? '' : String(sidebarWidth));
    save('layout:statementRatio', String(statementRatio));
  }
  function flushDrag() {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    if (active) setWidth(active.kind, active.width + active.x - active.startX);
  }
  function finishDrag() {
    if (!active) return;
    flushDrag();
    const { handle, pointerId } = active;
    active = null;
    handle.classList.remove('is-active');
    shell.classList.remove('is-resizing');
    document.body.classList.remove('layout-resizing');
    if (handle.hasPointerCapture(pointerId)) handle.releasePointerCapture(pointerId);
    persist();
    scheduleEditorRefresh();
  }
  for (const [handle, kind] of [[sidebarHandle, 'sidebar'], [statementHandle, 'statement']]) {
    const currentWidth = () => document.getElementById(kind === 'sidebar' ? 'sidebar' : 'statementPane').getBoundingClientRect().width;
    handle.addEventListener('pointerdown', event => {
      if (event.button !== 0 || mobileLayout.matches || active) return;
      event.preventDefault();
      handle.focus({ preventScroll: true });
      active = { handle, kind, pointerId: event.pointerId, startX: event.clientX, x: event.clientX, width: currentWidth() };
      shell.classList.add('is-resizing');
      document.body.classList.add('layout-resizing');
      handle.classList.add('is-active');
      handle.setPointerCapture(event.pointerId);
    });
    handle.addEventListener('pointermove', event => {
      if (!active || active.handle !== handle || active.pointerId !== event.pointerId) return;
      active.x = event.clientX;
      if (!frame) frame = requestAnimationFrame(flushDrag);
    });
    handle.addEventListener('pointerup', event => {
      if (active?.pointerId !== event.pointerId) return;
      active.x = event.clientX;
      finishDrag();
    });
    handle.addEventListener('pointercancel', finishDrag);
    handle.addEventListener('lostpointercapture', finishDrag);
    handle.addEventListener('dblclick', () => {
      if (kind === 'sidebar') sidebarWidth = null; else statementRatio = 0.43;
      fitLayout(); persist();
    });
    handle.addEventListener('keydown', event => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const limits = kind === 'sidebar' ? sidebarLimits() : statementLimits();
      const delta = (event.key === 'ArrowLeft' ? -1 : 1) * (event.shiftKey ? 32 : 16);
      setWidth(kind, event.key === 'Home' ? limits.min : event.key === 'End' ? limits.max : currentWidth() + delta);
      persist();
    });
  }
  window.addEventListener('resize', () => { finishDrag(); fitLayout(); });
  window.addEventListener('blur', finishDrag);
  new ResizeObserver(fitStatement).observe(body);
  shell.classList.add('is-resizing');
  fitLayout();
  requestAnimationFrame(() => { if (!active) shell.classList.remove('is-resizing'); });
}
