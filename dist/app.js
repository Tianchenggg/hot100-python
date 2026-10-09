import { PythonRunner } from './runner.js?v=15';
import { getLeetCodeProblem, buildLeetCodeHarness, checkLeetCodeOutput } from './leetcode.js?v=7';
import { checkOutput } from './checker.js?v=7';
import { getResultTone as resultTone, buildResultsView } from './result-view.js?v=15';
import { celebrateAcceptance, clearCelebration } from './celebration.js?v=15';
import problemGroups from './data/groups.js';
import { initLayout } from './layout.js?v=5';
import { installPythonEnhancements, smartIndentBackspace } from './editor-enhancements.js?v=10';

const $ = id => document.getElementById(id);
const runner = new PythonRunner();
const prefix = 'hot100-python:v1:';
const state = { mode: 'acm', problems: [], current: null, results: [], resultIndex: 0, busy: false, token: 0, caseIndex: 0, errorLine: null, restoring: false, codeAuthored: false, historyCode: null, passed: new Set(), custom: { input: '', output: '' } };
let copyRequest = 0;
let copyTimer;
function read(key, fallback = '') { try { return localStorage.getItem(prefix + key) ?? fallback; } catch { return fallback; } }
function save(key, value) { try { localStorage.setItem(prefix + key, value); return true; } catch { return false; } }
const initialMode = new URL(location.href).searchParams.get('mode') || read('mode', 'acm');
state.mode = initialMode === 'leetcode' ? 'leetcode' : 'acm';
save('mode', state.mode);
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
installPythonEnhancements(CodeMirror);
const editor = CodeMirror.fromTextArea($('codeEditor'), {
  mode: 'hot100-python', lineNumbers: true, indentUnit: 4, tabSize: 4, indentWithTabs: false,
  matchBrackets: true, lineWrapping: false, autofocus: false,
  gutters: ['CodeMirror-linenumbers', 'errors'],
  extraKeys: {
    Backspace: cm => smartIndentBackspace(cm, CodeMirror),
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
  if (!state.current || !state.codeAuthored) return;
  $('saveStatus').textContent = save(modeKey(`code:${state.current.id}`), editor.getValue()) ? '已保存到此浏览器' : '保存失败，请复制代码';
}
function loadHistory() {
  if (state.busy || state.historyCode === null) return;
  state.restoring = true;
  editor.replaceRange(state.historyCode, { line: 0, ch: 0 }, { line: editor.lastLine(), ch: editor.getLine(editor.lastLine()).length }, 'restore-history');
  state.restoring = false;
  state.codeAuthored = true;
  persistCode(); clearErrorLine();
  if (state.results.length) $('resultTab').firstChild.textContent = '上次结果';
  editor.setCursor(0, 0); editor.focus();
}
function updateHistoryButton() {
  $('historyButton').disabled = state.busy || state.historyCode === null;
  $('historyButton').title = state.historyCode === null ? '暂无历史作答' : '载入上次保存的代码，可撤销';
}
function resetCopyFeedback() {
  copyRequest++;
  clearTimeout(copyTimer);
  $('copyProblem').disabled = !state.current;
  $('copyProblem').classList.remove('is-copied');
  $('copyProblem').title = '复制题目';
  $('copyNotice').hidden = true;
  $('copyNotice').textContent = '';
}
async function copyProblem() {
  const p = state.current;
  if (!p) return;
  resetCopyFeedback();
  const request = copyRequest;
  const text = [
    `${p.id}. ${p.title}`,
    `${p.difficulty} · ${state.mode === 'leetcode' ? 'LeetCode' : 'ACM'} 模式`,
    p.desc,
    `输入\n${p.inputSpec}`,
    `输出\n${p.outputSpec}`,
    ...(p.constraints?.length ? [`数据范围\n${p.constraints.map(value => `- ${value}`).join('\n')}`] : []),
    ...p.examples.map((example, index) => `样例 ${index + 1}\n输入\n${example.input}\n输出\n${example.output}`),
    `原题：${p.url}`
  ].join('\n\n');
  $('copyProblem').disabled = true;
  let copied = false;
  try { await navigator.clipboard.writeText(text); copied = true; } catch {}
  if (request !== copyRequest) return;
  $('copyProblem').disabled = false;
  $('copyProblem').classList.toggle('is-copied', copied);
  $('copyProblem').title = copied ? '已复制' : '复制失败，请重试';
  $('copyNotice').textContent = copied ? '已复制' : '复制失败，请重试';
  $('copyNotice').hidden = false;
  copyTimer = setTimeout(resetCopyFeedback, 2200);
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
  state.codeAuthored = true;
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
  clearCelebration();
  const p = state.mode === 'leetcode' ? getLeetCodeProblem(base) : base;
  if (state.current) persistCode();
  if (state.busy) stop();
  state.current = p; state.results = []; state.resultIndex = 0; state.caseIndex = 0; state.custom = { input: '', output: '' };
  resetCopyFeedback();
  try { state.custom = JSON.parse(read(modeKey(`input:${p.id}`), '{"input":"","output":""}')); } catch {}
  const previousCode = read(modeKey(`code:${p.id}`), null);
  state.historyCode = previousCode !== null && previousCode !== (p.template || '') ? previousCode : null;
  state.codeAuthored = false;
  state.restoring = true; editor.setValue(p.template || ''); state.restoring = false; clearErrorLine();
  editor.clearHistory(); updateHistoryButton();
  $('saveStatus').textContent = state.historyCode === null ? '尚未作答' : '历史作答已保留';
  const index = state.problems.findIndex(item => item.id === p.id);
  $('prevProblem').disabled = index === 0; $('nextProblem').disabled = index === state.problems.length - 1;
  const constraints = p.constraints?.length ? `<details class="problem-constraints"><summary>数据范围</summary><ul>${p.constraints.map(value => `<li>${escapeHtml(value)}</li>`).join('')}</ul></details>` : '';
  $('statementContent').innerHTML = `<div class="problem-meta"><span class="difficulty">${escapeHtml(p.difficulty)}</span><a class="source-link" href="${escapeHtml(p.url)}" target="_blank" rel="noreferrer">原题 ↗</a></div><h1>${p.id}. ${escapeHtml(p.title)}</h1><p class="description">${escapeHtml(p.desc)}</p><h2>输入</h2><p class="spec-text">${escapeHtml(p.inputSpec)}</p><h2>输出</h2><p class="spec-text">${escapeHtml(p.outputSpec)}</p>${constraints}${p.examples.map((e, i) => `<section class="example-block"><h2>样例 ${i + 1}</h2><div class="example-label">输入</div><pre class="example-code">${escapeHtml(e.input)}</pre><div class="example-label">输出</div><pre class="example-code">${escapeHtml(e.output)}</pre></section>`).join('')}`;
  $('statementContent').scrollTop = 0;
  $('resultView').innerHTML = '<div class="empty-result">运行代码后查看结果</div>';
  $('resultTab').firstChild.textContent = '结果'; $('resultIndicator').className = '';
  const groupId = groupByProblem.get(p.id);
  if (groupId) { expandedGroups.add(groupId); searchCollapsedGroups.delete(groupId); save('expandedGroups', JSON.stringify([...expandedGroups])); }
  selectCase(0); setTab('input'); renderList();
  save('current', String(p.id));
  const url = new URL('./', import.meta.url); url.searchParams.set('problem', p.id); url.searchParams.set('mode', state.mode);
  $('appShell').dataset.url = url.href;
  $('appShell').dataset.title = `${p.title} · Hot 100`;
  if (!$('appShell').hidden) {
    history.replaceState(history.state, '', url);
    document.title = $('appShell').dataset.title;
  }
  $('workspaceTitle').textContent = p.title;
  if (!force) {
    setSearchOpen(false);
    if (mobileLayout.matches) setSidebar(false);
  }
  requestAnimationFrame(() => { editor.refresh(); revealCurrentProblem(); });
}
function renderCaseTabs() {
  $('expectedOptional').hidden = state.caseIndex < state.current.examples.length;
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
  state.busy = busy; updateHistoryButton();
  $('runButton').hidden = busy; $('submitButton').hidden = busy; $('stopButton').hidden = !busy;
  $('codingPane')?.setAttribute('aria-busy', String(busy));
}
function renderWorking(message) {
  if ($('resultView').querySelector('.status-badge.working')?.textContent === message) return;
  $('resultView').innerHTML = `<div class="result-summary"><span class="status-badge working"><span class="spinner" aria-hidden="true"></span>${escapeHtml(message)}</span></div>`;
  $('resultIndicator').className = 'working';
}
function stop() {
  clearCelebration();
  state.token++; runner.cancel(); setBusy(false);
  $('resultView').innerHTML = '<div class="result-summary"><span class="status-badge">已停止</span></div>';
  $('resultIndicator').className = ''; clearErrorLine();
}
function renderResults(submit) {
  const results = state.results;
  if (!results.length) return;
  const r = results[state.resultIndex];
  $('resultIndicator').className = results.some(item => resultTone(item) === 'failure') ? 'failure' : results.some(item => item.compared) ? 'success' : '';
  $('resultView').innerHTML = buildResultsView({ results, index: state.resultIndex, submit, total: submit ? state.current.tests.length : results.filter(item => item.compared).length, mode: state.mode, elapsedMs: state.elapsedMs });
  $('resultView').querySelectorAll('[data-case]').forEach(button => button.addEventListener('click', () => {
    state.resultIndex = Number(button.dataset.case);
    renderResults(submit);
    $('resultView').querySelector(`[data-case="${state.resultIndex}"]`).focus({ preventScroll: true });
  }));
  $('resultView').querySelector('[data-line]')?.addEventListener('click', () => { editor.setCursor(r.line - 1, 0); editor.scrollIntoView({ line: r.line - 1, ch: 0 }, 60); editor.focus(); });
  if (editor.getValue() === state.submittedCode) markError(r.line);
  else $('resultTab').firstChild.textContent = '上次结果';
}
async function execute(submit) {
  if (state.busy || !state.current) return;
  clearCelebration();
  const code = editor.getValue();
  expandPanel(); setTab('result'); clearErrorLine(); $('resultTab').firstChild.textContent = '结果';
  if (!code.trim()) { $('resultView').innerHTML = '<div class="empty-result">请先写入代码</div>'; editor.focus(); return; }
  persistCode(); setBusy(true); state.results = []; state.resultIndex = 0; state.submittedCode = code;
  const token = ++state.token; const p = state.current;
  const isLeetCode = state.mode === 'leetcode';
  const startedAt = performance.now();
  const compare = isLeetCode ? checkLeetCodeOutput : checkOutput;
  const cases = submit ? p.tests : p.examples.map((c, i) => ({ ...c, name: `样例 ${i + 1}`, compared: true }));
  if (!submit && (state.custom.input !== '' || state.custom.output !== '')) {
    cases.push({ ...state.custom, name: '自定义', compared: state.custom.output !== '' });
  }
  const asResult = (r, c) => {
    const compared = submit || c.compared;
    const actual = isLeetCode ? r.value ?? '' : r.stdout;
    return { ...r, actual, input: c.input, expected: c.output, name: c.name, compared, passed: r.ok };
  };
  try {
    renderWorking('准备 Python…');
    let completed = 0;
    const batch = await runner.runCases(code, cases, {
      buildHarness: isLeetCode ? c => buildLeetCodeHarness(p, c.input) : undefined,
      compare: (c, r) => !submit && !c.compared ? true : compare(p, c.input, c.output, isLeetCode ? r.value ?? '' : r.stdout),
      stopOnError: submit,
      onStatus: status => { if (token === state.token && status === 'running') renderWorking(`${submit ? '评测' : '运行'} ${completed} / ${cases.length}…`); },
      onProgress: ({ index }) => { completed = index; if (token === state.token) renderWorking(`${submit ? '评测' : '运行'} ${index} / ${cases.length}…`); },
    });
    if (token !== state.token) return;
    state.results = batch.results.map(r => asResult(r, cases[r.index]));
    state.elapsedMs = performance.now() - startedAt;
    state.resultIndex = Math.max(0, state.results.findIndex(r => !r.passed));
    if (submit && state.results.length === cases.length && state.results.every(r => r.passed)) {
      state.passed.add(p.id); save(modeKey('passed'), JSON.stringify([...state.passed])); renderList();
      celebrateAcceptance($('codingPane'), cases.length);
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
$('copyProblem').addEventListener('click', copyProblem);
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
$('historyButton').addEventListener('click', loadHistory);
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
  if ($('appShell').hidden) return;
  if (e.key === 'Escape') {
    if (!$('modeMenu').hidden) closeModeMenu(true);
    else if (!$('searchField').hidden) setSearchOpen(false, true);
    else if (mobileLayout.matches) setSidebar(false);
  }
  if ((e.metaKey || e.ctrlKey) && e.key === 's') { e.preventDefault(); persistCode(); }
});
window.addEventListener('resize', () => { syncSidebar(); editor.refresh(); });
window.addEventListener('pagehide', () => { persistCode(); if (state.busy) stop(); else runner.cancel(); });
export function activate() { syncSidebar(); editor.refresh(); }
export function deactivate() { persistCode(); closeModeMenu(); clearCelebration(); resetCopyFeedback(); }
$('appShell').addEventListener('transitionend', e => { if (e.target === $('appShell') && e.propertyName === 'grid-template-columns') editor.refresh(); });

try {
  const response = await fetch('./data/problems.json?v=7'); if (!response.ok) throw new Error('题库加载失败，请刷新重试');
  const problems = await response.json();
  const byId = new Map(problems.map(p => [p.id, p]));
  state.problems = problemGroups.flatMap(group => group.problemIds.map(id => byId.get(id)));
  if (state.problems.some(p => !p) || new Set(state.problems).size !== problems.length) throw new Error('题目分组加载失败，请刷新重试');
  loadProgress(); updateModeControl(); syncSidebar();
  const requested = Number(new URL(location.href).searchParams.get('problem') || read('current', '1'));
  selectProblem(state.problems.some(p => p.id === requested) ? requested : state.problems[0].id);
} catch (error) { $('statementContent').innerHTML = `<div class="empty-result">${escapeHtml(error.message)}</div>`; $('problemList').textContent = '加载失败'; $('runButton').disabled = true; $('submitButton').disabled = true; }
