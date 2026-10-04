import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Worker as NodeWorker } from 'node:worker_threads';
import { PythonRunner, outputsEqual } from '../dist/runner.js';

const runtimePath = resolve(process.env.PYODIDE_PACKAGE_PATH || fileURLToPath(
  new URL('../node_modules/pyodide/', import.meta.url),
));
const workerFile = await readFile(new URL('../dist/python-worker.js', import.meta.url), 'utf8');
const workerSource = workerFile
  .replace('https://cdn.jsdelivr.net/pyodide/v0.27.7/full/pyodide.mjs', pathToFileURL(`${runtimePath}/pyodide.mjs`).href)
  .replace('https://cdn.jsdelivr.net/pyodide/v0.27.7/full/', `${runtimePath}/`);
const bridge = `
import { parentPort } from 'node:worker_threads';
globalThis.self = globalThis;
self.postMessage = (data) => parentPort.postMessage(data);
parentPort.on('message', (data) => self.onmessage?.({ data }));
`;

class BrowserWorker {
  constructor() {
    this.worker = new NodeWorker(new URL(`data:text/javascript,${encodeURIComponent(bridge + workerSource)}`), {
      type: 'module', execArgv: [],
    });
    this.worker.on('message', (data) => this.onmessage?.({ data }));
    this.worker.on('error', (error) => this.onerror?.({ message: error.message, preventDefault() {} }));
    this.worker.on('messageerror', () => this.onmessageerror?.());
  }
  postMessage(data) { this.worker.postMessage(data); }
  terminate() { void this.worker.terminate(); }
}

globalThis.Worker = BrowserWorker;
const runner = new PythonRunner();
const timings = [];
let assertions = 0;

async function run(code, input = '', expected = {}, options = {}) {
  const started = performance.now();
  let readyAt;
  const result = await runner.run(code, input, {
    ...options,
    onStatus(status) { if (status === 'running') readyAt = performance.now(); },
  });
  if (readyAt) timings.push(Math.round(readyAt - started));
  for (const [key, value] of Object.entries(expected)) {
    assert.equal(result[key], value, `${key}: ${JSON.stringify(result)}`);
    assertions += 1;
  }
  assert.ok(Number.isFinite(result.ms));
  return result;
}

if (!process.argv.includes('--references-only')) {
await run('print("ready", end="")', '', { status: 'ok', stdout: 'ready', stderr: '', error: '', line: null });
await run('import sys\na = input()\nprint(a, sys.stdin.read(), sep="|")', 'first\nsecond\nthird', {
  status: 'ok', stdout: 'first|second\nthird\n',
});
await run('import sys\nprint(sys.stdin.buffer.read().decode())', '中文输入', {
  status: 'ok', stdout: '中文输入\n',
});
await run('import sys\nsys.stderr.write("stderr\\n")\nprint("stdout")', '', {
  status: 'ok', stdout: 'stdout\n', stderr: 'stderr\n',
});
const syntax = await run('x = 1\nif True print(x)', '', { status: 'error', line: 2 });
assert.match(syntax.error, /File "main.py", line 2/);
assert.match(syntax.error, /SyntaxError/);
const runtime = await run('def fail():\n    return 1 / 0\nfail()', '', { status: 'error', line: 2 });
assert.match(runtime.error, /ZeroDivisionError/);
assert.doesNotMatch(runtime.error, /__runner__\.py/);
await run('import sys\nprint("before")\nsys.exit(0)\nprint("after")', '', { status: 'ok', stdout: 'before\n' });
await run('raise SystemExit()', '', { status: 'ok' });
await run('raise SystemExit(2)', '', { status: 'error', error: 'SystemExit: 2', line: 1 });
await run('print("x" * 65536, end="")', '', { status: 'ok' });
const output = await run('print("x" * 65537, end="")', '', { status: 'output_limit' });
assert.equal(new TextEncoder().encode(output.stdout + output.stderr).byteLength, 65536);
const mixedOutput = await run('import sys\nprint("x" * 40000, end="", flush=True)\nsys.stderr.write("y" * 40000)', '', {
  status: 'output_limit',
});
assert.equal(new TextEncoder().encode(mixedOutput.stdout + mixedOutput.stderr).byteLength, 65536);
await run('import builtins\nbuiltins.print = lambda *args, **kwargs: None', '', { status: 'ok' });
await run('print("isolated")', '', { status: 'ok', stdout: 'isolated\n' });

const fastRunner = new PythonRunner({ runTimeoutMs: 250 });
const timeout = await fastRunner.run('while True: pass');
assert.equal(timeout.status, 'timeout');
assert.ok(timeout.ms >= 200 && timeout.ms < 2000);
assert.equal((await fastRunner.run('print("recovered")')).stdout, 'recovered\n');
fastRunner.cancel();

const cancelled = await runner.run('while True: pass', '', {
  onStatus(status) { if (status === 'running') setTimeout(() => runner.cancel(), 30); },
});
assert.equal(cancelled.status, 'cancelled');
await run('print("after cancel")', '', { status: 'ok', stdout: 'after cancel\n' });

const harness = { setup: 'from typing import *', invoke: '_leetcode_result = __import__("json").dumps(Solution().double(3))' };
await run('class Solution:\n    def double(self, value: int) -> int:\n        print("debug")\n        return value * 2', '', {
  status: 'ok', value: '6', stdout: 'debug\n', line: null,
}, { harness });
const functionError = await run('class Solution:\n    def double(self, value):\n        return value / 0', '', { status: 'error', line: 3 }, { harness });
assert.match(functionError.error, /File "main.py", line 3/);
assert.doesNotMatch(functionError.error, /__leetcode__|__runner__/);
await run('class Solution:\n    def double(self, value)\n        return value', '', { status: 'error', line: 2 }, { harness });
await run('class Solution:\n    def double(self, value):\n        return "x" * 65537', '', { status: 'output_limit' }, { harness });
await run('print("ACM still isolated")', '', { status: 'ok', stdout: 'ACM still isolated\n', value: undefined });

const isolationCases = [{ input: 'first', output: 'fresh\n' }, { input: 'second', output: 'fresh\n' }, { input: 'third', output: 'fresh\n' }, { input: 'fourth', output: 'fresh\n' }];
const isolation = await runner.runCases(`import sys, os, math, builtins, io
assert not os.path.exists('/tmp/runner-leak')
assert math.sqrt(9) == 3
assert not hasattr(builtins, '_runner_leak')
assert sys.stdin.read() in ('first', 'second', 'third', 'fourth')
print('fresh')
open('/tmp/runner-leak', 'w').write('changed')
math.sqrt = lambda value: -1
builtins._runner_leak = True
sys.stdin = io.StringIO('changed')
os.chdir('/tmp')`, isolationCases);
assert.equal(isolation.allPassed, true);
assert.equal(isolation.results.length, 4);
const harnessCases = await runner.runCases('class Solution:\n    def double(self, value):\n        return value * 2', [{ input: '2', output: '4' }, { input: '3', output: '6' }], {
  buildHarness: test => ({ setup: '', invoke: `_leetcode_result = str(Solution().double(${test.input}))` }),
  compare: (test, result) => test.output === result.value,
});
assert.equal(harnessCases.allPassed, true);
const invalidCustom = await runner.runCases('class Solution:\n    def double(self, value):\n        return value * 2', [
  { input: '2', output: '4' }, { input: '{broken', output: '' }, { input: '3', output: '6' },
], {
  buildHarness: test => ({ setup: '', invoke: `_leetcode_result = str(Solution().double(${JSON.parse(test.input)}))` }),
  compare: (test, result) => test.output === result.value,
  stopOnError: false,
});
assert.deepEqual(invalidCustom.results.map(r => [r.index, r.status, r.ok]), [[0, 'ok', true], [1, 'error', false], [2, 'ok', true]]);
assert.match(invalidCustom.results[1].error, /JSON|property|Unexpected/i);
assert.equal(invalidCustom.results[1].line, null);
const orderedProgress = [];
const ordered = await runner.runCases('import time\nn = int(input())\ntime.sleep(0.1 if n == 0 else 0)\nprint(n)', [0, 1, 2, 3].map(n => ({ input: String(n), output: String(n) })), {
  onProgress: entry => orderedProgress.push(entry.result.index),
});
assert.equal(ordered.allPassed, true);
assert.deepEqual(orderedProgress, [0, 1, 2, 3]);
const failedBatch = await runner.runCases('raise ValueError("stop")', isolationCases, { stopOnError: true });
assert.equal(failedBatch.cancelled, false);
assert.equal(failedBatch.results.length, 1);
assert.equal(failedBatch.results[0].status, 'error');

const cases = [{ input: '2\n', output: '4\n' }, { input: '3\n', output: '6\n' }];
const progress = [];
const batch = await runner.runCases('print(int(input()) * 2)', cases, {
  onProgress(value) { progress.push(value.index); },
});
assert.equal(batch.allPassed, true);
assert.deepEqual(progress, [1, 2]);
const stoppedBatch = await runner.runCases('print(int(input()) * 2)', cases, {
  onProgress() { runner.cancel(); },
});
assert.equal(stoppedBatch.cancelled, true);
assert.equal(stoppedBatch.results.length, 1);

runner.cancel();
globalThis.Worker = class {
  postMessage() {}
  terminate() {}
};
const noLoadRunner = new PythonRunner({ loadTimeoutMs: 20, warmWorkers: 0 });
const noLoad = await noLoadRunner.run('print(1)');
assert.equal(noLoad.status, 'timeout');
assert.equal(noLoad.ms, 0);
globalThis.Worker = BrowserWorker;

let liveWorkers = 0;
let peakWorkers = 0;
let createdWorkers = 0;
let sentRuns = 0;
class ScheduledWorker {
  constructor() {
    this.closed = false;
    this.runs = 0;
    createdWorkers += 1;
    liveWorkers += 1;
    peakWorkers = Math.max(peakWorkers, liveWorkers);
    this.readyTimer = setTimeout(() => this.onmessage?.({ data: { type: 'ready' } }), 5);
  }
  postMessage(data) {
    assert.equal(this.closed, false);
    assert.equal(++this.runs, 1, 'Each worker may execute only one case');
    sentRuns += 1;
    this.runTimer = setTimeout(() => this.onmessage?.({ data: { type: 'result', status: 'ok', ms: 1 } }), data.input === '0' ? 25 : 1);
  }
  terminate() {
    if (this.closed) return;
    this.closed = true;
    liveWorkers -= 1;
    clearTimeout(this.readyTimer);
    clearTimeout(this.runTimer);
  }
}
globalThis.Worker = ScheduledWorker;
const scheduled = new PythonRunner({ idleTimeoutMs: 20 });
assert.equal(createdWorkers, 0, 'No Python initialization before Run/Submit');
const scheduleProgress = [];
const scheduleBatch = await scheduled.runCases('pass', [0, 1, 2, 3].map(input => ({ input, output: '' })), {
  onProgress: entry => scheduleProgress.push(entry.index),
});
assert.equal(scheduleBatch.allPassed, true);
assert.deepEqual(scheduleProgress, [1, 2, 3, 4]);
assert.ok(peakWorkers <= 2, 'At most two workers may be alive');
assert.equal(sentRuns, 4, 'Warm worker must not execute user code');
assert.equal(liveWorkers, 1, 'Only one unused worker is retained');
await Promise.all(scheduled.idle.map(slot => slot.ready));
const beforeWarmRun = createdWorkers;
await scheduled.run('pass');
assert.equal(createdWorkers, beforeWarmRun + 1, 'Reuse pristine worker, then prepare its replacement');
await Promise.all(scheduled.idle.map(slot => slot.ready));
await new Promise(resolve => setTimeout(resolve, 30));
assert.equal(liveWorkers, 0, 'Idle worker expires');
await scheduled.run('pass');
scheduled.cancel();
assert.equal(liveWorkers, 0, 'Cancel also releases unused workers');
const cancelDuringLoad = await scheduled.runCases('pass', isolationCases, { onStatus: () => scheduled.cancel() });
assert.equal(cancelDuringLoad.cancelled, true);
assert.equal(liveWorkers, 0);
const cancelDuringRun = await scheduled.runCases('pass', isolationCases, {
  onStatus: status => { if (status === 'running') scheduled.cancel(); },
});
assert.equal(cancelDuringRun.cancelled, true);
assert.equal(liveWorkers, 0);
globalThis.Worker = BrowserWorker;

assert.equal(outputsEqual('1.0\n', '1.0000001\n'), true);
assert.equal(outputsEqual('a  \r\n', 'a\n'), true);
assert.equal(outputsEqual('1 2\n', '2 1\n'), false);
assert.equal(outputsEqual('hello\n', 'hello\n\n'), false);
assert.equal(outputsEqual('1\n', '1.1\n'), false);
assert.equal(outputsEqual('2.5\n', '1e999\n'), false);
assert.equal(outputsEqual('2.5\n', '-1e999\n'), false);
assert.equal(outputsEqual('100000', '100000.05'), false);
assert.equal(outputsEqual('0', '0.00001'), true);
assert.equal(outputsEqual('0', '0.0000101'), false);
console.log(JSON.stringify({ runner: 'passed', fieldAssertions: assertions, freshWorkerLoadMs: timings }));
}

if (process.env.REFERENCE_SOLUTIONS_PATH) {
  const { loadPyodide } = await import(pathToFileURL(`${runtimePath}/pyodide.mjs`).href);
  const { checkOutput } = await import('../dist/checker.js');
  const pyodide = await loadPyodide({ indexURL: `${runtimePath}/`, stdout() {}, stderr() {} });
  const problems = JSON.parse(await readFile(new URL('../dist/data/problems.json', import.meta.url), 'utf8'));
  const references = JSON.parse(await readFile(resolve(process.env.REFERENCE_SOLUTIONS_PATH), 'utf8'));
  const failures = [];
  let count = 0;
  for (const problem of problems) {
    for (const [index, test] of problem.tests.entries()) {
      pyodide.globals.set('_qa_source', references[problem.id]);
      pyodide.globals.set('_qa_input', test.input);
      const result = JSON.parse(pyodide.runPython(`
import sys, io, json, traceback
_qa_old_streams = sys.stdin, sys.stdout, sys.stderr
_qa_stdout, _qa_stderr = io.StringIO(), io.StringIO()
sys.stdin, sys.stdout, sys.stderr = io.StringIO(_qa_input), _qa_stdout, _qa_stderr
_qa_error = ""
try:
    exec(compile(_qa_source, "main.py", "exec"), {"__name__": "__main__", "__file__": "main.py"})
except SystemExit as error:
    if error.code is not None and error.code != 0:
        _qa_error = str(error)
except BaseException:
    _qa_error = traceback.format_exc()
finally:
    sys.stdin, sys.stdout, sys.stderr = _qa_old_streams
json.dumps({"stdout": _qa_stdout.getvalue(), "stderr": _qa_stderr.getvalue(), "error": _qa_error})
`));
      const checked = checkOutput(problem, test.input, test.output, result.stdout);
      count += 1;
      if (result.error || !checked) failures.push({ id: problem.id, index, checked, ...result });
    }
  }
  console.log(JSON.stringify({ references: problems.length, cases: count, failures }));
  assert.equal(failures.length, 0, 'Reference solutions failed in Pyodide');
}
