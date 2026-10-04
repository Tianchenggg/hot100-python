import { PythonRunner } from './runner.js';
import { checkOutput } from './checker.js';

const $ = id => document.getElementById(id);
const runner = new PythonRunner();
const prefix = 'hot100-python:v1:';
const state = { problems: [], current: null, results: [], resultIndex: 0, busy: false, token: 0, caseIndex: 0, errorLine: null, restoring: false, passed: new Set(), custom: { input: '', output: '' } };
function read(key, fallback = '') { try { return localStorage.getItem(prefix + key) ?? fallback; } catch { return fallback; } }
function save(key, value) { try { localStorage.setItem(prefix + key, value); return true; } catch { return false; } }
try { state.passed = new Set(JSON.parse(read('passed', '[]'))); } catch {}
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const codeBlock = value => `<pre>${escapeHtml(value || '（空）')}</pre>`;
const editor = CodeMirror.fromTextArea($('codeEditor'), {
  mode: 'python', lineNumbers: true, indentUnit: 4, tabSize: 4, indentWithTabs: false,
  matchBrackets: true, lineWrapping: false, autofocus: false,
  gutters: ['CodeMirror-linenumbers', 'errors'],
  extraKeys: {
    Tab: cm => cm.somethingSelected() ? cm.indentSelection('add') : cm.replaceSelection(' '.repeat(4 - cm.getCursor().ch % 4)),
    'Shift-Tab': cm => cm.indentSelection('subtract'),
    'Ctrl-Enter': () => execute(false), 'Cmd-Enter': () => execute(false),
    'Shift-Ctrl-Enter': () => execute(true), 'Shift-Cmd-Enter': () => execute(true),
    'Ctrl-S': () => persistCode(), 'Cmd-S': () => persistCode()
  }
});
editor.getInputField().setAttribute('aria-label', 'Python 代码编辑器');
editor.on('cursorActivity', () => {
  const cursor = editor.getCursor();
  $('cursorPosition').textContent = `第 ${cursor.line + 1} 行，第 ${cursor.ch + 1} 列`;
});

function persistCode() {
  if (!state.current) return;
  $('saveStatus').textContent = save(`code:${state.current.id}`, editor.getValue()) ? '已保存到此浏览器' : '保存失败，请复制代码';
}
function clearErrorLine() {
  if (state.errorLine !== null) editor.removeLineClass(state.errorLine, 'background', 'code-error-line');
  editor.clearGutter('errors'); state.errorLine = null;
}
function markError(line) {
  clearErrorLine();
  if (!Number.isInteger(line) || line < 1 || line > editor.lineCount()) return;
  state.errorLine = line - 1;
  editor.addLineClass(state.errorLine, 'background', 'code-error-line');
  const marker = document.createElement('span'); marker.className = 'error-gutter-marker'; marker.textContent = '●';
  marker.title = `第 ${line} 行`; editor.setGutterMarker(state.errorLine, 'errors', marker);
}
editor.on('change', () => {
  if (state.restoring) return;
  persistCode(); clearErrorLine();
  if (state.results.length) $('resultTab').firstChild.textContent = '上次结果';
});

function renderList() {
  const search = $('searchInput').value.trim().toLowerCase();
  const list = state.problems.filter(p => `${p.id} ${p.title}`.toLowerCase().includes(search));
  $('problemList').replaceChildren();
  if (!list.length) { const empty = document.createElement('div'); empty.className = 'empty-result'; empty.textContent = '没有找到题目'; $('problemList').append(empty); }
  for (const p of list) {
    const button = document.createElement('button'); button.type = 'button'; button.className = `problem-item${state.current?.id === p.id ? ' active' : ''}`;
    button.dataset.problemId = p.id;
    if (state.current?.id === p.id) button.setAttribute('aria-current', 'true');
    button.innerHTML = `<span class="problem-number">${p.id}</span><span class="problem-name">${escapeHtml(p.title)}</span><span class="problem-check" aria-label="${state.passed.has(p.id) ? '已通过' : '未通过'}">${state.passed.has(p.id) ? '✓' : ''}</span>`;
    button.addEventListener('click', () => selectProblem(p.id)); $('problemList').append(button);
  }
  $('progressText').textContent = `${state.passed.size} / ${state.problems.length} 已通过`;
}
function selectProblem(id) {
  const p = state.problems.find(x => x.id === Number(id)); if (!p || state.current?.id === p.id) return;
  if (state.current) persistCode();
  if (state.busy) stop();
  state.current = p; state.results = []; state.resultIndex = 0; state.caseIndex = 0; state.custom = { input: '', output: '' };
  try { state.custom = JSON.parse(read(`input:${p.id}`, '{"input":"","output":""}')); } catch {}
  state.restoring = true; editor.setValue(read(`code:${p.id}`)); state.restoring = false; clearErrorLine();
  editor.clearHistory(); $('saveStatus').textContent = '已保存到此浏览器';
  const index = state.problems.indexOf(p);
  $('prevProblem').disabled = index === 0; $('nextProblem').disabled = index === state.problems.length - 1;
  $('statementContent').innerHTML = `<div class="problem-meta"><span class="difficulty">${escapeHtml(p.difficulty)}</span></div><h1>${p.id}. ${escapeHtml(p.title)}</h1><p class="description">${escapeHtml(p.desc)}</p><h2>输入</h2><p class="spec-text">${escapeHtml(p.inputSpec)}</p><h2>输出</h2><p class="spec-text">${escapeHtml(p.outputSpec)}</p>${p.examples.map((e, i) => `<section class="example-block"><h2>样例 ${i + 1}</h2><div class="example-label">输入</div><pre class="example-code">${escapeHtml(e.input)}</pre><div class="example-label">输出</div><pre class="example-code">${escapeHtml(e.output)}</pre></section>`).join('')}`;
  $('statementContent').scrollTop = 0;
  $('resultView').innerHTML = '<div class="empty-result">运行代码后查看结果</div>';
  $('resultTab').firstChild.textContent = '结果'; $('resultIndicator').className = '';
  selectCase(0); setTab('input'); renderList();
  save('current', String(p.id));
  const url = new URL(location.href); url.searchParams.set('problem', p.id); history.replaceState(null, '', url);
  document.title = `${p.title} · Hot 100`;
  $('workspaceTitle').textContent = p.title;
  $('appShell').classList.remove('sidebar-open');
  requestAnimationFrame(() => editor.refresh());
}
function renderCaseTabs() {
  $('caseTabs').replaceChildren();
  const names = [...state.current.examples.map((_, i) => `样例 ${i + 1}`), '自定义'];
  names.forEach((name, i) => {
    const button = document.createElement('button'); button.type = 'button'; button.className = `case-tab${state.caseIndex === i ? ' active' : ''}`; button.textContent = name;
    button.setAttribute('aria-pressed', String(state.caseIndex === i)); button.addEventListener('click', () => selectCase(i)); $('caseTabs').append(button);
  });
}
function selectCase(index) {
  state.caseIndex = index;
  const data = state.current.examples[index] ?? state.custom;
  $('testInput').value = data.input; $('expectedOutput').value = data.output; renderCaseTabs();
}
function updateCustom() {
  if (!state.current) return;
  state.caseIndex = state.current.examples.length;
  state.custom = { input: $('testInput').value, output: $('expectedOutput').value };
  save(`input:${state.current.id}`, JSON.stringify(state.custom)); renderCaseTabs();
}
function setTab(tab) {
  const input = tab === 'input';
  $('inputView').hidden = !input; $('resultView').hidden = input;
  $('inputTab').classList.toggle('active', input); $('resultTab').classList.toggle('active', !input);
  $('inputTab').setAttribute('aria-selected', String(input)); $('resultTab').setAttribute('aria-selected', String(!input));
}
function expandPanel() {
  $('testPanel').classList.remove('collapsed'); $('panelToggle').setAttribute('aria-expanded', 'true'); $('panelToggle').setAttribute('aria-label', '收起测试面板'); editor.refresh();
}
function setBusy(busy) {
  state.busy = busy;
  $('runButton').hidden = busy; $('submitButton').hidden = busy; $('stopButton').hidden = !busy;
  $('codingPane')?.setAttribute('aria-busy', String(busy));
}
function renderWorking(message) {
  $('resultView').innerHTML = `<div class="result-summary"><span class="status-badge working"><span class="spinner" aria-hidden="true"></span>${escapeHtml(message)}</span></div>`;
  $('resultIndicator').className = 'working';
}
function stop() {
  state.token++; runner.cancel(); setBusy(false);
  $('resultView').innerHTML = '<div class="result-summary"><span class="status-badge">已停止</span></div>';
  $('resultIndicator').className = ''; clearErrorLine();
}
function getLabel(r) {
  if (r.status === 'timeout') return '运行超时';
  if (r.status === 'output_limit') return '输出超限';
  if (r.status === 'cancelled') return '已停止';
  if (r.status !== 'ok') return r.error?.includes('SyntaxError') || r.error?.includes('IndentationError') ? '语法错误' : '运行错误';
  return r.compared ? (r.passed ? '通过' : '答案错误') : '运行完成';
}
function renderResults(submit) {
  const results = state.results;
  if (!results.length) return;
  const passed = results.filter(r => r.passed).length;
  const all = submit ? passed === state.current.tests.length : results[0].passed;
  const r = results[state.resultIndex];
  const label = submit ? `${passed} / ${state.current.tests.length} 通过` : getLabel(r);
  const tone = all ? 'success' : (r.status === 'ok' && !r.compared && !submit ? '' : 'failure');
  const statusIcon = tone ? `<svg class="status-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/>${tone === 'success' ? '<path d="m8 12 3 3 5-6"/>' : '<path d="m9 9 6 6m0-6-6 6"/>'}</svg>` : '';
  $('resultIndicator').className = tone;
  $('resultView').innerHTML = `<div class="result-summary" role="status"><span class="status-badge ${tone}">${statusIcon}${escapeHtml(label)}</span><span class="result-time">${Math.round(results.reduce((sum, x) => sum + (x.ms || 0), 0))} ms</span></div>${submit ? `<div class="result-cases">${results.map((x, i) => `<button class="result-case ${x.passed ? 'passed' : 'failed'}${i === state.resultIndex ? ' selected' : ''}" data-case="${i}" aria-label="用例 ${i + 1}，${getLabel(x)}">${x.passed ? '✓' : '×'} ${i + 1}</button>`).join('')}</div>` : ''}${submit ? `<div class="case-status">用例 ${state.resultIndex + 1}<span class="${r.passed ? 'success' : 'failure'}">${escapeHtml(getLabel(r))}</span></div>` : ''}<div class="result-grid"><div class="result-block"><label>输入</label>${codeBlock(r.input)}</div><div class="result-block ${r.passed ? 'output-passed' : 'output-failed'}"><label>实际输出</label>${codeBlock(r.stdout)}</div><div class="result-block"><label>期望输出</label>${codeBlock(r.compared ? r.expected : '未设置')}</div></div>${r.error || r.stderr ? `<div class="error-details"><div class="error-heading">${r.status === 'ok' ? '标准错误输出' : '错误'}${r.line ? `<button class="error-link" data-line="${r.line}">第 ${r.line} 行 ↗</button>` : ''}</div><pre>${escapeHtml(r.error || r.stderr)}</pre></div>` : ''}`;
  $('resultView').querySelectorAll('[data-case]').forEach(button => button.addEventListener('click', () => { state.resultIndex = Number(button.dataset.case); renderResults(submit); }));
  $('resultView').querySelector('[data-line]')?.addEventListener('click', () => { editor.setCursor(r.line - 1, 0); editor.scrollIntoView({ line: r.line - 1, ch: 0 }, 60); editor.focus(); });
  if (editor.getValue() === state.submittedCode) markError(r.line);
  else $('resultTab').firstChild.textContent = '上次结果';
}
async function execute(submit) {
  if (state.busy || !state.current) return;
  const code = editor.getValue();
  expandPanel(); setTab('result'); clearErrorLine(); $('resultTab').firstChild.textContent = '结果';
  if (!code.trim()) { $('resultView').innerHTML = '<div class="empty-result">请先写入代码</div>'; editor.focus(); return; }
  persistCode(); setBusy(true); state.results = []; state.resultIndex = 0; state.submittedCode = code;
  const token = ++state.token; const p = state.current;
  const cases = submit ? p.tests : [{ input: $('testInput').value, output: $('expectedOutput').value }];
  try {
    for (let i = 0; i < cases.length; i++) {
      if (token !== state.token) return;
      renderWorking(submit ? `评测 ${i + 1} / ${cases.length}…` : '准备 Python…');
      const c = cases[i];
      const r = await runner.run(code, c.input, { onStatus: status => {
        if (token !== state.token) return;
        const text = typeof status === 'string' ? status : status?.status;
        renderWorking(submit ? `评测 ${i + 1} / ${cases.length}…` : (text === 'running' ? '运行中…' : '准备 Python…'));
      } });
      if (token !== state.token) return;
      const compared = submit || c.output !== '';
      const passed = r.status === 'ok' && (!compared || checkOutput(p, c.input, c.output, r.stdout));
      state.results.push({ ...r, input: c.input, expected: c.output, compared, passed });
      if (r.status !== 'ok') break;
    }
    if (token !== state.token) return;
    state.resultIndex = Math.max(0, state.results.findIndex(r => !r.passed));
    if (submit && state.results.length === cases.length && state.results.every(r => r.passed)) {
      state.passed.add(p.id); save('passed', JSON.stringify([...state.passed])); renderList();
    }
    renderResults(submit);
  } catch (error) {
    if (token === state.token) { $('resultView').innerHTML = `<div class="error-details"><div class="error-heading">运行失败</div><pre>${escapeHtml(error.message)}</pre></div>`; $('resultIndicator').className = 'failure'; }
  } finally { if (token === state.token) setBusy(false); }
}

$('searchInput').addEventListener('input', renderList);
$('testInput').addEventListener('input', updateCustom); $('expectedOutput').addEventListener('input', updateCustom);
$('runButton').addEventListener('click', () => execute(false)); $('submitButton').addEventListener('click', () => execute(true)); $('stopButton').addEventListener('click', stop);
$('inputTab').addEventListener('click', () => { setTab('input'); expandPanel(); }); $('resultTab').addEventListener('click', () => { setTab('result'); expandPanel(); });
$('prevProblem').addEventListener('click', () => selectProblem(state.problems[state.problems.indexOf(state.current) - 1]?.id));
$('nextProblem').addEventListener('click', () => selectProblem(state.problems[state.problems.indexOf(state.current) + 1]?.id));
$('railToggle').addEventListener('click', () => { $('appShell').classList.toggle('sidebar-collapsed'); editor.refresh(); });
$('closeSidebar').addEventListener('click', () => { $('appShell').classList.add('sidebar-collapsed'); $('appShell').classList.remove('sidebar-open'); editor.refresh(); });
$('openSidebar').addEventListener('click', () => { $('appShell').classList.remove('sidebar-collapsed'); $('appShell').classList.toggle('sidebar-open'); editor.refresh(); });
$('panelToggle').addEventListener('click', () => {
  const collapsed = $('testPanel').classList.toggle('collapsed');
  $('panelToggle').setAttribute('aria-expanded', String(!collapsed)); $('panelToggle').setAttribute('aria-label', collapsed ? '展开测试面板' : '收起测试面板'); editor.refresh();
});
let drag = null;
$('panelResizer').addEventListener('pointerdown', e => { drag = { y: e.clientY, height: $('testPanel').getBoundingClientRect().height }; $('panelResizer').setPointerCapture(e.pointerId); e.preventDefault(); expandPanel(); });
$('panelResizer').addEventListener('pointermove', e => { if (!drag) return; setPanelHeight(drag.height + drag.y - e.clientY); });
$('panelResizer').addEventListener('pointerup', () => { drag = null; });
$('panelResizer').addEventListener('pointercancel', () => { drag = null; });
$('panelResizer').addEventListener('keydown', e => { if (['ArrowUp', 'ArrowDown'].includes(e.key)) { e.preventDefault(); expandPanel(); setPanelHeight($('testPanel').getBoundingClientRect().height + (e.key === 'ArrowUp' ? 24 : -24)); } });
function setPanelHeight(value) { const height = Math.max(180, Math.min(value, Math.max(200, innerHeight - 240))); $('testPanel').style.setProperty('--panel-height', `${height}px`); editor.refresh(); }
document.addEventListener('keydown', e => { if (e.key === 'Escape') $('appShell').classList.remove('sidebar-open'); if ((e.metaKey || e.ctrlKey) && e.key === 's') { e.preventDefault(); persistCode(); } });
window.addEventListener('resize', () => editor.refresh());

try {
  const response = await fetch('./data/problems.json'); if (!response.ok) throw new Error('题库加载失败，请刷新重试');
  state.problems = await response.json();
  state.passed = new Set([...state.passed].filter(id => state.problems.some(p => p.id === id)));
  const requested = Number(new URL(location.href).searchParams.get('problem') || read('current', '1'));
  selectProblem(state.problems.some(p => p.id === requested) ? requested : state.problems[0].id);
} catch (error) { $('statementContent').innerHTML = `<div class="empty-result">${escapeHtml(error.message)}</div>`; $('problemList').textContent = '加载失败'; $('runButton').disabled = true; $('submitButton').disabled = true; }
