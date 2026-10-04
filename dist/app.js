import { PythonRunner } from './runner.js?v=3';
import { getLeetCodeProblem, buildLeetCodeHarness, checkLeetCodeOutput } from './leetcode.js?v=3';
import { checkOutput } from './checker.js';
import problemGroups from './data/groups.js';
import { initLayout } from './layout.js?v=5';

const $ = id => document.getElementById(id);
const runner = new PythonRunner();
const prefix = 'hot100-python:v1:';
const state = { mode: 'acm', problems: [], current: null, results: [], resultIndex: 0, busy: false, token: 0, caseIndex: 0, errorLine: null, restoring: false, passed: new Set(), custom: { input: '', output: '' } };
function read(key, fallback = '') { try { return localStorage.getItem(prefix + key) ?? fallback; } catch { return fallback; } }
function save(key, value) { try { localStorage.setItem(prefix + key, value); return true; } catch { return false; } }
const initialMode = new URL(location.href).searchParams.get('mode') || read('mode', 'acm');
state.mode = initialMode === 'leetcode' ? 'leetcode' : 'acm';
const modeKey = key => state.mode === 'leetcode' ? `leetcode:${key}` : key;
const groupByProblem = new Map(problemGroups.flatMap(group => group.problemIds.map(id => [id, group.id])));
let expandedGroups = new Set();
try { expandedGroups = new Set(JSON.parse(read('expandedGroups', '[]')).filter(id => problemGroups.some(group => group.id === id))); } catch {}
const searchCollapsedGroups = new Set();
const storedFontSize = Number(read('leetcode:editorFontSize', '14'));
let editorFontSize = Number.isFinite(storedFontSize) ? Math.max(11, Math.min(20, Math.round(storedFontSize))) : 14;
let wrapCode = read('leetcode:wrapCode', 'true') !== 'false';
function loadProgress() {
  try { state.passed = new Set(JSON.parse(read(modeKey('passed'), '[]'))); } catch { state.passed = new Set(); }
  state.passed = new Set([...state.passed].filter(id => state.problems.some(p => p.id === id)));
}
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
editor.on('renderLine', (cm, line, element) => {
  if (!cm.getOption('lineWrapping')) return;
  const indent = CodeMirror.countColumn(line.text, null, cm.getOption('tabSize'));
  const offset = Math.min(indent, 16) * cm.defaultCharWidth();
  element.style.paddingLeft = `calc(var(--code-line-padding, 14px) + ${offset}px)`;
  element.style.textIndent = `${-offset}px`;
});
editor.on('cursorActivity', () => {
  const cursor = editor.getCursor();
  $('cursorPosition').textContent = `第 ${cursor.line + 1} 行，第 ${cursor.ch + 1} 列`;
});

function persistCode() {
  if (!state.current) return;
  $('saveStatus').textContent = save(modeKey(`code:${state.current.id}`), editor.getValue()) ? '已保存到此浏览器' : '保存失败，请复制代码';
}
function updateModeControl() {
  const label = state.mode === 'leetcode' ? 'LeetCode 模式' : 'ACM 模式';
  $('modeLabel').textContent = label;
  $('modeButton').setAttribute('aria-label', `切换刷题模式，当前 ${label}`);
  $('modeMenu').querySelectorAll('[data-mode]').forEach(option => option.setAttribute('aria-checked', String(option.dataset.mode === state.mode)));
  applyEditorPreferences();
}
function applyEditorPreferences() {
  const isLeetCode = state.mode === 'leetcode';
  const fontSize = isLeetCode ? editorFontSize : 14;
  $('editorTools').hidden = !isLeetCode;
  const wrapper = editor.getWrapperElement().parentElement;
  wrapper.style.setProperty('--editor-font-size', `${fontSize}px`);
  wrapper.style.setProperty('--editor-line-height', `${Math.round(fontSize * 1.7)}px`);
  $('fontSizeValue').value = String(editorFontSize);
  $('fontDecrease').disabled = editorFontSize === 11;
  $('fontIncrease').disabled = editorFontSize === 20;
  $('wrapCode').setAttribute('aria-pressed', String(wrapCode));
  editor.setOption('lineWrapping', isLeetCode && wrapCode);
  editor.refresh();
}
function changeEditorFont(delta) {
  editorFontSize = Math.max(11, Math.min(20, editorFontSize + delta));
  save('leetcode:editorFontSize', String(editorFontSize));
  applyEditorPreferences();
}
function closeModeMenu(restoreFocus = false) {
  const wasOpen = !$('modeMenu').hidden;
  $('modeMenu').hidden = true;
  $('modeButton').setAttribute('aria-expanded', 'false');
  if (restoreFocus && wasOpen) $('modeButton').focus();
}
function openModeMenu(focusOption = false) {
  $('modeMenu').hidden = false;
  $('modeButton').setAttribute('aria-expanded', 'true');
  if (focusOption) $('modeMenu').querySelector('[aria-checked="true"]').focus();
}
function changeMode(mode) {
  if (!['acm', 'leetcode'].includes(mode)) return;
  closeModeMenu(true);
  if (state.mode === mode) return;
  persistCode();
  if (state.busy) stop();
  const id = state.current?.id;
  state.current = null;
  state.mode = mode;
  save('mode', mode);
  loadProgress(); updateModeControl();
  if (id) selectProblem(id, true);
}
const mobileLayout = matchMedia('(max-width: 800px)');
initLayout({ read, save, mobileLayout, refreshEditor: () => editor.refresh() });
function syncSidebar() {
  const open = mobileLayout.matches ? $('appShell').classList.contains('sidebar-open') : !$('appShell').classList.contains('sidebar-collapsed');
  const sidebar = $('sidebar');
  if (!open && sidebar.contains(document.activeElement)) (mobileLayout.matches ? $('openSidebar') : $('homeButton')).focus();
  sidebar.inert = !open;
  sidebar.setAttribute('aria-hidden', String(!open));
  $('openSidebar').setAttribute('aria-expanded', String(open));
  if (!open) closeModeMenu();
}
function setSidebar(open) {
  if (mobileLayout.matches) $('appShell').classList.toggle('sidebar-open', open);
  else {
    $('appShell').classList.toggle('sidebar-collapsed', !open);
    $('appShell').classList.remove('sidebar-open');
  }
  syncSidebar();
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) editor.refresh();
}
function setSearchOpen(open, restoreFocus = false) {
  if (!open && (restoreFocus || $('searchField').contains(document.activeElement))) $('searchButton').focus();
  $('searchField').hidden = !open;
  $('searchButton').setAttribute('aria-expanded', String(open));
  if (open) {
    closeModeMenu();
    $('searchInput').focus();
  } else if ($('searchInput').value) {
    $('searchInput').value = '';
    searchCollapsedGroups.clear();
    renderList();
    requestAnimationFrame(revealCurrentProblem);
  }
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

function setGroupOpen(section, open) {
  const header = section.querySelector('.group-header');
  const content = section.querySelector('.group-content');
  if (!open && content.contains(document.activeElement)) header.focus();
  section.classList.toggle('is-open', open);
  header.setAttribute('aria-expanded', String(open));
  content.setAttribute('aria-hidden', String(!open));
  content.inert = !open;
}
function renderList() {
  const search = $('searchInput').value.trim().toLowerCase();
  const byId = new Map(state.problems.map(p => [p.id, p]));
  const fragment = document.createDocumentFragment();
  let count = 0;
  for (const group of problemGroups) {
    const groupMatches = group.name.toLowerCase().includes(search);
    const list = group.problemIds.map(id => byId.get(id)).filter(p => p && (!search || groupMatches || `${p.id} ${p.title}`.toLowerCase().includes(search)));
    if (!list.length) continue;
    count += list.length;
    const section = document.createElement('section'); section.className = 'problem-group'; section.dataset.groupId = group.id;
    const header = document.createElement('button'); header.type = 'button'; header.className = 'group-header';
    header.id = `group-${group.id}-toggle`; header.setAttribute('aria-controls', `group-${group.id}-content`);
    header.setAttribute('aria-label', `${group.name}，${list.length} 题`);
    header.innerHTML = `<svg class="group-chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg><svg class="group-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 7V5a2 2 0 0 1 2-2h4l2 3h8a2 2 0 0 1 2 2v2M3 7v12a2 2 0 0 0 2 2h13l4-12H8l-3 3"/></svg><span class="group-name">${escapeHtml(group.name)}</span><span class="group-count">${list.length}</span>`;
    const content = document.createElement('div'); content.className = 'group-content'; content.id = `group-${group.id}-content`;
    const items = document.createElement('div'); items.className = 'group-items';
    for (const p of list) {
      const button = document.createElement('button'); button.type = 'button'; button.className = `problem-item${state.current?.id === p.id ? ' active' : ''}`;
      button.dataset.problemId = p.id; button.title = `${p.id}. ${p.title}`;
      if (state.current?.id === p.id) button.setAttribute('aria-current', 'true');
      button.innerHTML = `<span class="problem-number">${p.id}</span><span class="problem-name">${escapeHtml(p.title)}</span><span class="problem-check" aria-label="${state.passed.has(p.id) ? '已通过' : '未通过'}">${state.passed.has(p.id) ? '✓' : ''}</span>`;
      button.addEventListener('click', () => selectProblem(p.id)); items.append(button);
    }
    content.append(items); section.append(header, content);
    setGroupOpen(section, search ? !searchCollapsedGroups.has(group.id) : expandedGroups.has(group.id));
    header.addEventListener('click', () => {
      const open = !section.classList.contains('is-open');
      if (search) {
        if (open) searchCollapsedGroups.delete(group.id); else searchCollapsedGroups.add(group.id);
      } else {
        if (open) expandedGroups.add(group.id); else expandedGroups.delete(group.id);
        save('expandedGroups', JSON.stringify([...expandedGroups]));
      }
      setGroupOpen(section, open);
    });
    fragment.append(section);
  }
  if (!count) { const empty = document.createElement('div'); empty.className = 'empty-result'; empty.textContent = '没有找到题目'; fragment.append(empty); }
  $('problemList').replaceChildren(fragment);
  $('progressText').textContent = `${state.passed.size} / ${state.problems.length} 已通过`;
}
function revealCurrentProblem() {
  const list = $('problemList'), selected = list.querySelector('[aria-current="true"]');
  if (!selected) return;
  const outer = list.getBoundingClientRect(), inner = selected.getBoundingClientRect();
  if (inner.top < outer.top) list.scrollTop -= outer.top - inner.top;
  else if (inner.bottom > outer.bottom) list.scrollTop += inner.bottom - outer.bottom;
}
function selectProblem(id, force = false) {
  const base = state.problems.find(x => x.id === Number(id));
  if (!base) return;
  if (!force && state.current?.id === base.id) {
    setSearchOpen(false);
    if (mobileLayout.matches) setSidebar(false);
    return;
  }
  const p = state.mode === 'leetcode' ? getLeetCodeProblem(base) : base;
  if (state.current) persistCode();
  if (state.busy) stop();
  state.current = p; state.results = []; state.resultIndex = 0; state.caseIndex = 0; state.custom = { input: '', output: '' };
  try { state.custom = JSON.parse(read(modeKey(`input:${p.id}`), '{"input":"","output":""}')); } catch {}
  state.restoring = true; editor.setValue(read(modeKey(`code:${p.id}`), p.template || '')); state.restoring = false; clearErrorLine();
  editor.clearHistory(); $('saveStatus').textContent = '已保存到此浏览器';
  const index = state.problems.findIndex(item => item.id === p.id);
  $('prevProblem').disabled = index === 0; $('nextProblem').disabled = index === state.problems.length - 1;
  $('statementContent').innerHTML = `<div class="problem-meta"><span class="difficulty">${escapeHtml(p.difficulty)}</span></div><h1>${p.id}. ${escapeHtml(p.title)}</h1><p class="description">${escapeHtml(p.desc)}</p><h2>输入</h2><p class="spec-text">${escapeHtml(p.inputSpec)}</p><h2>输出</h2><p class="spec-text">${escapeHtml(p.outputSpec)}</p>${p.examples.map((e, i) => `<section class="example-block"><h2>样例 ${i + 1}</h2><div class="example-label">输入</div><pre class="example-code">${escapeHtml(e.input)}</pre><div class="example-label">输出</div><pre class="example-code">${escapeHtml(e.output)}</pre></section>`).join('')}`;
  $('statementContent').scrollTop = 0;
  $('resultView').innerHTML = '<div class="empty-result">运行代码后查看结果</div>';
  $('resultTab').firstChild.textContent = '结果'; $('resultIndicator').className = '';
  const groupId = groupByProblem.get(p.id);
  if (groupId) { expandedGroups.add(groupId); searchCollapsedGroups.delete(groupId); save('expandedGroups', JSON.stringify([...expandedGroups])); }
  selectCase(0); setTab('input'); renderList();
  save('current', String(p.id));
  const url = new URL(location.href); url.searchParams.set('problem', p.id); url.searchParams.set('mode', state.mode); history.replaceState(null, '', url);
  document.title = `${p.title} · Hot 100`;
  $('workspaceTitle').textContent = p.title;
  if (!force) {
    setSearchOpen(false);
    if (mobileLayout.matches) setSidebar(false);
  }
  requestAnimationFrame(() => { editor.refresh(); revealCurrentProblem(); });
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
  save(modeKey(`input:${state.current.id}`), JSON.stringify(state.custom)); renderCaseTabs();
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
  $('resultView').innerHTML = `<div class="result-summary" role="status"><span class="status-badge ${tone}">${statusIcon}${escapeHtml(label)}</span><span class="result-time">${Math.round(results.reduce((sum, x) => sum + (x.ms || 0), 0))} ms</span></div>${submit ? `<div class="result-cases">${results.map((x, i) => `<button class="result-case ${x.passed ? 'passed' : 'failed'}${i === state.resultIndex ? ' selected' : ''}" data-case="${i}" aria-label="用例 ${i + 1}，${getLabel(x)}">${x.passed ? '✓' : '×'} ${i + 1}</button>`).join('')}</div>` : ''}${submit ? `<div class="case-status">用例 ${state.resultIndex + 1}<span class="${r.passed ? 'success' : 'failure'}">${escapeHtml(getLabel(r))}</span></div>` : ''}<div class="result-grid"><div class="result-block"><label>输入</label>${codeBlock(r.input)}</div><div class="result-block ${r.passed ? 'output-passed' : 'output-failed'}"><label>${state.mode === 'leetcode' ? '返回值' : '实际输出'}</label>${codeBlock(r.actual)}</div><div class="result-block"><label>期望输出</label>${codeBlock(r.compared ? r.expected : '未设置')}</div></div>${state.mode === 'leetcode' && r.stdout ? `<div class="result-block debug-output"><label>标准输出</label>${codeBlock(r.stdout)}</div>` : ''}${r.error || r.stderr ? `<div class="error-details"><div class="error-heading">${r.status === 'ok' ? '标准错误输出' : '错误'}${r.line ? `<button class="error-link" data-line="${r.line}">第 ${r.line} 行 ↗</button>` : ''}</div><pre>${escapeHtml(r.error || r.stderr)}</pre></div>` : ''}`;
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
      const harness = state.mode === 'leetcode' ? buildLeetCodeHarness(p, c.input) : undefined;
      const r = await runner.run(code, c.input, { harness, onStatus: status => {
        if (token !== state.token) return;
        const text = typeof status === 'string' ? status : status?.status;
        renderWorking(submit ? `评测 ${i + 1} / ${cases.length}…` : (text === 'running' ? '运行中…' : '准备 Python…'));
      } });
      if (token !== state.token) return;
      const compared = submit || c.output !== '';
      const actual = state.mode === 'leetcode' ? r.value ?? '' : r.stdout;
      const compare = state.mode === 'leetcode' ? checkLeetCodeOutput : checkOutput;
      const passed = r.status === 'ok' && (!compared || compare(p, c.input, c.output, actual));
      state.results.push({ ...r, actual, input: c.input, expected: c.output, compared, passed });
      if (r.status !== 'ok') break;
    }
    if (token !== state.token) return;
    state.resultIndex = Math.max(0, state.results.findIndex(r => !r.passed));
    if (submit && state.results.length === cases.length && state.results.every(r => r.passed)) {
      state.passed.add(p.id); save(modeKey('passed'), JSON.stringify([...state.passed])); renderList();
    }
    renderResults(submit);
  } catch (error) {
    if (token === state.token) { $('resultView').innerHTML = `<div class="error-details"><div class="error-heading">运行失败</div><pre>${escapeHtml(error.message)}</pre></div>`; $('resultIndicator').className = 'failure'; }
  } finally { if (token === state.token) setBusy(false); }
}

$('searchInput').addEventListener('input', () => {
  searchCollapsedGroups.clear(); renderList();
  if (!$('searchInput').value.trim()) requestAnimationFrame(revealCurrentProblem);
});
$('searchButton').addEventListener('click', () => setSearchOpen($('searchField').hidden, true));
$('homeButton').addEventListener('click', () => {
  closeModeMenu();
  setSearchOpen(false);
  setSidebar(true);
  requestAnimationFrame(() => { $('problemList').scrollTop = 0; });
});
$('fontDecrease').addEventListener('click', () => changeEditorFont(-1));
$('fontIncrease').addEventListener('click', () => changeEditorFont(1));
$('wrapCode').addEventListener('click', () => { wrapCode = !wrapCode; save('leetcode:wrapCode', String(wrapCode)); applyEditorPreferences(); });
$('modeButton').addEventListener('click', () => $('modeMenu').hidden ? openModeMenu() : closeModeMenu());
$('modeButton').addEventListener('keydown', e => {
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); openModeMenu(true); }
});
$('modeMenu').addEventListener('click', e => {
  const option = e.target.closest('[data-mode]');
  if (option) changeMode(option.dataset.mode);
});
$('modeMenu').addEventListener('keydown', e => {
  if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeModeMenu(true); return; }
  const options = [...$('modeMenu').querySelectorAll('[data-mode]')];
  const index = options.indexOf(document.activeElement);
  if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) {
    e.preventDefault();
    const next = e.key === 'Home' ? 0 : e.key === 'End' ? options.length - 1 : (index + (e.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length;
    options[next].focus();
  }
  if (e.key === 'Tab') closeModeMenu();
});
document.addEventListener('pointerdown', e => { if (!e.target.closest('.mode-switch')) closeModeMenu(); });
$('testInput').addEventListener('input', updateCustom); $('expectedOutput').addEventListener('input', updateCustom);
$('runButton').addEventListener('click', () => execute(false)); $('submitButton').addEventListener('click', () => execute(true)); $('stopButton').addEventListener('click', stop);
$('inputTab').addEventListener('click', () => { setTab('input'); expandPanel(); }); $('resultTab').addEventListener('click', () => { setTab('result'); expandPanel(); });
$('prevProblem').addEventListener('click', () => selectProblem(state.problems[state.problems.findIndex(p => p.id === state.current.id) - 1]?.id));
$('nextProblem').addEventListener('click', () => selectProblem(state.problems[state.problems.findIndex(p => p.id === state.current.id) + 1]?.id));
$('openSidebar').addEventListener('click', () => setSidebar(true));
$('sidebarBackdrop').addEventListener('click', () => setSidebar(false));
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
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    if (!$('modeMenu').hidden) closeModeMenu(true);
    else if (!$('searchField').hidden) setSearchOpen(false, true);
    else if (mobileLayout.matches) setSidebar(false);
  }
  if ((e.metaKey || e.ctrlKey) && e.key === 's') { e.preventDefault(); persistCode(); }
});
window.addEventListener('resize', () => { syncSidebar(); editor.refresh(); });
$('appShell').addEventListener('transitionend', e => { if (e.target === $('appShell') && e.propertyName === 'grid-template-columns') editor.refresh(); });

try {
  const response = await fetch('./data/problems.json'); if (!response.ok) throw new Error('题库加载失败，请刷新重试');
  const problems = await response.json();
  const byId = new Map(problems.map(p => [p.id, p]));
  state.problems = problemGroups.flatMap(group => group.problemIds.map(id => byId.get(id)));
  if (state.problems.some(p => !p) || new Set(state.problems).size !== problems.length) throw new Error('题目分组加载失败，请刷新重试');
  loadProgress(); updateModeControl(); syncSidebar();
  const requested = Number(new URL(location.href).searchParams.get('problem') || read('current', '1'));
  selectProblem(state.problems.some(p => p.id === requested) ? requested : state.problems[0].id);
} catch (error) { $('statementContent').innerHTML = `<div class="empty-result">${escapeHtml(error.message)}</div>`; $('problemList').textContent = '加载失败'; $('runButton').disabled = true; $('submitButton').disabled = true; }
