import { bookmarkIcon } from './acceptance-mark.js?v=22';

const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const code = value => `<pre>${escape(value || '（空）')}</pre>`;
const icon = tone => tone === 'success' ? bookmarkIcon : `<svg viewBox="0 0 24 24" aria-hidden="true">${tone === 'failure' ? '<path d="m7 7 10 10M7 17 17 7"/>' : '<path d="M8 6v12l10-6Z"/>'}</svg>`;

export function getResultLabel(result) {
  if (result.status === 'timeout') return '运行超时';
  if (result.status === 'output_limit') return '输出超限';
  if (result.status === 'cancelled') return '已停止';
  if (result.status !== 'ok') {
    if (result.errorKind === 'compile') return '编译错误';
    if (result.errorKind === 'input') return '输入错误';
    if (result.errorKind === 'environment') return '环境加载失败';
    return '运行错误';
  }
  return result.compared ? (result.passed ? '通过' : '答案错误') : '运行完成';
}

export function getResultTone(result) {
  if (result.status !== 'ok' || (result.compared && !result.passed)) return 'failure';
  return result.compared ? 'success' : '';
}

export function buildResultsView({ results, index, submit, total, mode, elapsedMs }) {
  const result = results[index];
  const checked = results.filter(item => item.compared);
  const passed = checked.filter(item => item.passed).length;
  const failure = results.find(item => getResultTone(item) === 'failure');
  const tone = failure ? 'failure' : checked.length ? 'success' : '';
  const verdict = failure ? getResultLabel(failure) : checked.length ? (submit ? '全部通过' : '样例通过') : '运行完成';
  const detail = `${passed} / ${total} 用例通过${submit && results.length < total ? ` · ${total - results.length} 个未运行` : ''}${results.some(item => !item.compared) ? ' · 含自定义用例' : ''}`;
  const elapsed = elapsedMs >= 1000 ? `${(elapsedMs / 1000).toFixed(2)} s` : `${Math.round(elapsedMs || 0)} ms`;
  const pythonMs = Math.round(results.reduce((sum, item) => sum + (item.ms || 0), 0));
  const caseName = (item, i) => submit ? `用例 ${i + 1}` : item.name;
  const tabs = results.map((item, i) => {
    const status = getResultTone(item);
    return `<button class="result-case ${status}${i === index ? ' selected' : ''}" data-case="${i}" aria-pressed="${i === index}" aria-label="${escape(caseName(item, i))}，${getResultLabel(item)}" title="${getResultLabel(item)}">${icon(status)}<span>${submit ? i + 1 : escape(item.name)}</span></button>`;
  }).join('');
  const selectedTone = getResultTone(result);
  const error = result.error || result.stderr;
  const errorPanel = error ? `<div class="error-details"><div class="error-heading"><span>${result.status === 'ok' ? '标准错误输出' : escape(result.errorName || '错误详情')}</span>${result.line ? `<button class="error-link" data-line="${result.line}">定位第 ${result.line} 行</button>` : ''}</div><pre>${escape(error)}</pre></div>` : '';
  const outputPanel = result.status === 'ok' ? `<div class="result-comparison${result.compared ? '' : ' single-output'}"><div class="result-block ${selectedTone === 'success' ? 'output-passed' : selectedTone === 'failure' ? 'output-failed' : ''}"><label>${mode === 'leetcode' ? '返回值' : '实际输出'}</label>${code(result.actual)}</div>${result.compared ? `<div class="result-block"><label>期望输出</label>${code(result.expected)}</div>` : ''}</div>` : '';
  const debugPanel = mode === 'leetcode' && result.stdout ? `<details class="result-debug"><summary>标准输出</summary>${code(result.stdout)}</details>` : '';
  return `<div class="result-summary" role="status"><span class="verdict-icon ${tone}">${icon(tone)}</span><div class="verdict-copy"><strong class="verdict-title ${tone}">${verdict}</strong><span class="verdict-detail">${escape(detail)}</span></div><span class="result-time" title="总耗时（含环境准备与判题）；Python 执行合计 ${pythonMs} ms">${elapsed}</span></div><div class="result-cases" aria-label="选择用例结果">${tabs}</div><div class="result-detail"><div class="case-status"><strong>${escape(caseName(result, index))}</strong><span class="${selectedTone}">${getResultLabel(result)}</span></div>${errorPanel}<div class="result-block result-input"><label>输入</label>${code(result.input)}</div>${outputPanel}${debugPanel}</div>`;
}
