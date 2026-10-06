const $ = (id) => document.getElementById(id);
const folder = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 8V5h6l2 3h10v12H3Zm0 3h18"/></svg>';
const chevron = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 10 5 5 5-5"/></svg>';
const arrow = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17 17 7M7 7h10v10"/></svg>';
const escape = (text) => String(text).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
let problems = [];
let lastProblemId = null;
let drawBag = [];
let scrollFrame = 0;
let randomSession = false;

function metadata(problem) {
  return `<div class="recite-card-meta"><span class="recite-number">${problem.id.toString().padStart(3, '0')}</span><span class="recite-level" data-level="${escape(problem.difficulty)}">${escape(problem.difficulty)}</span></div>`;
}

function examples(problem) {
  return `<details class="recite-examples"><summary>查看样例${chevron}</summary><div class="recite-example-body"><span class="recite-example-label">输入</span><pre>${escape(problem.input)}</pre><span class="recite-example-label">输出</span><pre>${escape(problem.output)}</pre></div></details>`;
}

function card(problem) {
  return `<article class="recite-card">${metadata(problem)}<h3><button class="recite-card-title" data-problem="${problem.id}" aria-label="查看题目：${escape(problem.title)}"><span>${escape(problem.title)}</span>${arrow}</button></h3><p class="recite-description">${escape(problem.description)}</p>${examples(problem)}</article>`;
}

function showProblem(problem, random = false) {
  if (!problem) return;
  randomSession = random;
  $('closeDialog').hidden = random;
  $('dialogFooter').hidden = !random;
  lastProblemId = problem.id;
  $('dialogGroup').textContent = problem.groupName;
  $('dialogContent').innerHTML = `${metadata(problem)}<h2 id="dialogTitle">${escape(problem.title)}</h2><p class="recite-description">${escape(problem.description)}</p>${examples(problem)}`;
  const dialog = $('problemDialog');
  if (!dialog.open) dialog.showModal();
  dialog.scrollTop = 0;
  (random ? $('nextRandom') : $('closeDialog')).focus({ preventScroll: true });
}

function randomProblem() {
  if (!problems.length) return;
  if (!drawBag.length) {
    drawBag = [...problems];
    for (let i = drawBag.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [drawBag[i], drawBag[j]] = [drawBag[j], drawBag[i]];
    }
  }
  if (drawBag.length > 1 && drawBag.at(-1).id === lastProblemId) {
    [drawBag[0], drawBag[drawBag.length - 1]] = [drawBag.at(-1), drawBag[0]];
  }
  showProblem(drawBag.pop(), true);
}

function activeGroup(id) {
  $('reciteGroups').querySelectorAll('a').forEach((link) => {
    if (link.hash === `#${id}`) link.setAttribute('aria-current', 'location');
    else link.removeAttribute('aria-current');
  });
  $('mobileGroup').value = id;
}

function jumpToGroup(id) {
  const section = document.getElementById(id);
  if (!section?.classList.contains('recite-section')) return;
  section.scrollIntoView({ block: 'start', behavior: 'instant' });
  activeGroup(id);
  if (!document.querySelector('.recitation-app').hidden) history.replaceState(history.state, '', `#${id}`);
}

async function loadProblems() {
  try {
    const response = await fetch('./data/recitation.json');
    if (!response.ok) throw new Error('Could not load cards');
    const { groups } = await response.json();
    problems = groups.flatMap((group) => group.problems.map((problem) => ({ ...problem, groupName: group.name })));
    $('groupCount').textContent = groups.length;
    $('cardCount').textContent = `${problems.length} 题`;
    $('reciteGroups').innerHTML = groups.map((group) => `<a class="recite-group-link" href="#${group.id}">${folder}<span>${escape(group.name)}</span><span>${group.problems.length}</span></a>`).join('');
    $('mobileGroup').innerHTML = groups.map((group) => `<option value="${group.id}">${escape(group.name)} · ${group.problems.length} 题</option>`).join('');
    $('mobileGroup').disabled = false;
    $('reciteContent').innerHTML = groups.map((group) => `<section class="recite-section" id="${group.id}" aria-labelledby="${group.id}-heading"><div class="recite-section-heading">${folder}<h2 id="${group.id}-heading">${escape(group.name)}</h2><span>${group.problems.length}</span></div><div class="recite-grid">${group.problems.map(card).join('')}</div></section>`).join('');
    $('randomProblem').disabled = false;
    const requested = location.hash.slice(1);
    jumpToGroup(groups.some((group) => group.id === requested) ? requested : groups[0].id);
  } catch {
    $('reciteContent').innerHTML = '<div class="recite-error"><p class="recite-loading" role="alert">题目未能加载</p><button class="button" id="retryLoad">重试</button></div>';
    $('retryLoad').addEventListener('click', loadProblems, { once: true });
  }
}

$('randomProblem').addEventListener('click', randomProblem);
$('nextRandom').addEventListener('click', randomProblem);
$('closeDialog').addEventListener('click', () => $('problemDialog').close());
$('problemDialog').addEventListener('cancel', (event) => {
  if (randomSession) event.preventDefault();
});
let backdropDown = false;
$('problemDialog').addEventListener('pointerdown', (event) => { backdropDown = event.target === event.currentTarget; });
$('problemDialog').addEventListener('click', (event) => {
  if (!randomSession && backdropDown && event.target === event.currentTarget) {
    const rect = event.currentTarget.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) event.currentTarget.close();
  }
});
$('reciteContent').addEventListener('click', (event) => {
  const button = event.target.closest('[data-problem]');
  if (button) showProblem(problems.find((problem) => problem.id === Number(button.dataset.problem)));
});
$('reciteGroups').addEventListener('click', (event) => {
  const link = event.target.closest('a');
  if (!link || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  jumpToGroup(link.hash.slice(1));
});
$('mobileGroup').addEventListener('change', (event) => jumpToGroup(event.target.value));
$('reciteScroll').addEventListener('scroll', () => {
  if (scrollFrame) return;
  scrollFrame = requestAnimationFrame(() => {
    scrollFrame = 0;
    const top = $('reciteScroll').getBoundingClientRect().top + 60;
    const sections = [...document.querySelectorAll('.recite-section')];
    const current = sections.findLast((section) => section.getBoundingClientRect().top <= top) || sections[0];
    if (current) activeGroup(current.id);
  });
}, { passive: true });
window.addEventListener('hashchange', (event) => {
  if (!document.querySelector('.recitation-app').hidden && new URL(event.oldURL).pathname === new URL(event.newURL).pathname) jumpToGroup(location.hash.slice(1));
});
export function deactivate() { $('problemDialog').close(); }
await loadProblems();
