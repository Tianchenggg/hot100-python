let timer;
let element;

export function clearCelebration() {
  clearTimeout(timer);
  element?.remove();
  element = null;
}

export function celebrateAcceptance(container, count) {
  clearCelebration();
  if (container.closest('[hidden]')) return;
  element = document.createElement('div');
  element.className = 'completion-celebration';
  element.setAttribute('aria-hidden', 'true');
  element.innerHTML = `<div class="completion-medallion"><svg class="completion-rings" viewBox="0 0 120 120"><defs><linearGradient id="completionGradient" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#40d98a"/><stop offset="1" stop-color="#14965d"/></linearGradient></defs><circle class="completion-track" cx="60" cy="60" r="48"/><circle class="completion-orbit" cx="60" cy="60" r="48" pathLength="100" stroke="url(#completionGradient)"/><circle class="completion-orbit inner" cx="60" cy="60" r="38" pathLength="100" stroke="#32bba3"/><path class="completion-check" d="m43 60 12 12 23-25" pathLength="100"/></svg><strong>全部通过</strong><span>${count} 个用例</span></div>`;
  container.append(element);
  timer = setTimeout(clearCelebration, 2250);
}
