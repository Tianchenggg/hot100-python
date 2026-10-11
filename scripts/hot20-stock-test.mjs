import assert from 'node:assert/strict';
import fs from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { extraProblems, extraIds } from './extra-problems.mjs';
import { getLeetCodeProblem, buildLeetCodeHarness, checkLeetCodeOutput } from '../dist/leetcode.js';
import { checkOutput } from '../dist/checker.js';

const allProblems = JSON.parse(fs.readFileSync(new URL('../dist/data/problems.json', import.meta.url)));
const acm = new Map(allProblems.filter(p => extraIds.includes(p.id)).map(p => [p.id, p]));
const leetcode = new Map([...acm].map(([id, p]) => [id, getLeetCodeProblem(p)]));
const runtimePath = resolve(process.env.PYODIDE_PACKAGE_PATH || fileURLToPath(new URL('../node_modules/pyodide/', import.meta.url)));
const { loadPyodide } = await import(pathToFileURL(`${runtimePath}/pyodide.mjs`).href);
const pyodide = await loadPyodide({ indexURL: `${runtimePath}/`, stdout() {}, stderr() {} });
const bodies = {
  122: 'return sum(max(b - a, 0) for a, b in zip(prices, prices[1:]))',
  123: `first_buy = second_buy = -float('inf')
first_sell = second_sell = 0
for price in prices:
    first_buy = max(first_buy, -price)
    first_sell = max(first_sell, first_buy + price)
    second_buy = max(second_buy, first_sell - price)
    second_sell = max(second_sell, second_buy + price)
return second_sell`,
  188: `cash = [0] * (k + 1)
hold = [-float('inf')] * (k + 1)
for price in prices:
    for transaction in range(k, 0, -1):
        cash[transaction] = max(cash[transaction], hold[transaction] + price)
        hold[transaction] = max(hold[transaction], cash[transaction - 1] - price)
return cash[k]`,
};
const solution = (id, body = bodies[id]) => `class Solution:\n    def maxProfit(self, ${id === 188 ? 'k, ' : ''}prices):\n${body.split('\n').map(line => '        ' + line).join('\n')}\n`;

function run(source, input = '', setup = '', invoke = '') {
  pyodide.globals.set('_stock_source', source);
  pyodide.globals.set('_stock_input', input);
  pyodide.globals.set('_stock_setup', setup);
  pyodide.globals.set('_stock_invoke', invoke);
  return JSON.parse(pyodide.runPython(`
import io, sys, json, traceback
_stock_streams = sys.stdin, sys.stdout, sys.stderr
_stock_out, _stock_err = io.StringIO(), io.StringIO()
sys.stdin, sys.stdout, sys.stderr = io.StringIO(_stock_input), _stock_out, _stock_err
_stock_ns, _stock_error = {"__name__": "__main__"}, ""
try:
    exec(compile(_stock_setup, "__leetcode__.py", "exec"), _stock_ns, _stock_ns)
    exec(compile(_stock_source, "main.py", "exec"), _stock_ns, _stock_ns)
    exec(compile(_stock_invoke, "__leetcode__.py", "exec"), _stock_ns, _stock_ns)
except BaseException:
    _stock_error = traceback.format_exc()
finally:
    sys.stdin, sys.stdout, sys.stderr = _stock_streams
json.dumps({"stdout": _stock_out.getvalue(), "error": _stock_error, "value": _stock_ns.get("_leetcode_result")})
`));
}

function runLeetCode(id, params, body) {
  const input = JSON.stringify(params);
  const { setup, invoke } = buildLeetCodeHarness(leetcode.get(id), input);
  return run(solution(id, body), '', setup, invoke);
}

function tradeSearch(prices, remaining) {
  const memo = new Map();
  function visit(day, count) {
    if (!count || day >= prices.length) return 0;
    const key = `${day}:${count}`;
    if (memo.has(key)) return memo.get(key);
    let best = visit(day + 1, count);
    for (let sell = day + 1; sell < prices.length; sell++) {
      best = Math.max(best, prices[sell] - prices[day] + visit(sell + 1, count - 1));
    }
    memo.set(key, best);
    return best;
  }
  return visit(0, remaining);
}

let tested = 0;
for (const source of extraProblems) {
  const id = source.id, p = acm.get(id), lc = leetcode.get(id);
  assert.deepEqual(lc.core.params.map(param => param.name), id === 188 ? ['k', 'prices'] : ['prices']);
  assert.equal(p.tests.length, source.cases.length);
  assert.equal(lc.tests.length, source.cases.length);
  for (const [index, test] of source.cases.entries()) {
    const params = test.params, limit = id === 122 ? Math.floor(params.prices.length / 2) : id === 123 ? 2 : params.k;
    if (params.prices.length <= 30) assert.equal(test.expected, tradeSearch(params.prices, limit), `Independent oracle ${id}/${index}`);
    const actual = runLeetCode(id, params);
    assert.equal(actual.error, '', `LeetCode ${id}/${index}: ${actual.error}`);
    assert.equal(checkLeetCodeOutput(lc, lc.tests[index].input, lc.tests[index].output, actual.value), true);
    const stdin = p.tests[index].input.trim().split(/\s+/).map(Number);
    const n = stdin.shift(), k = id === 188 ? stdin.shift() : undefined;
    assert.equal(n, params.prices.length);
    assert.deepEqual(stdin, params.prices);
    if (id === 188) assert.equal(k, params.k);
    const main = `import sys\nvalues = list(map(int, sys.stdin.read().split()))\nn = values[0]\n${id === 188 ? 'k = values[1]\nprices = values[2:]\n' : 'prices = values[1:]\n'}print(Solution().maxProfit(${id === 188 ? 'k, ' : ''}prices))\n`;
    const result = run(solution(id) + main, p.tests[index].input);
    assert.equal(result.error, '', `ACM ${id}/${index}: ${result.error}`);
    assert.equal(checkOutput(p, p.tests[index].input, p.tests[index].output, result.stdout), true);
    assert.equal(checkOutput(p, p.tests[index].input, p.tests[index].output, `${test.expected + 1}\n`), false);
    assert.equal(checkOutput(p, p.tests[index].input, p.tests[index].output, `${test.expected}.0\n`), false);
    tested += 2;
  }
  for (const wrong of ['return True', 'return 0.0', 'return "0"', 'return None']) {
    assert.ok(runLeetCode(id, source.cases[0].params, wrong).error, `${id} must reject a wrong return type`);
  }
}

const singleTrade = 'best = 0\nminimum = prices[0]\nfor price in prices:\n    minimum = min(minimum, price)\n    best = max(best, price - minimum)\nreturn best';
for (const [id, wrong] of [[122, singleTrade], [123, singleTrade], [123, bodies[122]], [188, bodies[122]], [188, bodies[123]]]) {
  const rejected = extraProblems.find(p => p.id === id).cases.some(test => {
    const result = runLeetCode(id, test.params, wrong);
    return result.error || !checkLeetCodeOutput(leetcode.get(id), JSON.stringify(test.params), String(test.expected), result.value);
  });
  assert.equal(rejected, true, `${id} data must reject incorrect transaction limits`);
}

const upperBounds = [
  [122, { prices: Array.from({ length: 30000 }, (_, i) => i % 2 ? 10000 : 0) }, 150000000],
  [123, { prices: Array.from({ length: 100000 }, (_, i) => i % 2 ? 100000 : 0) }, 200000],
  [188, { k: 100, prices: Array.from({ length: 1000 }, (_, i) => i % 2 ? 1000 : 0) }, 100000],
];
const started = performance.now();
for (const [id, params, expected] of upperBounds) {
  const actual = runLeetCode(id, params);
  assert.equal(actual.error, '');
  assert.equal(JSON.parse(actual.value), expected);
}
console.log(JSON.stringify({ stocks: 'passed', modeCases: tested, rejectedAlgorithms: 5, officialUpperBounds: 3, upperBoundsMs: Math.round(performance.now() - started) }));
