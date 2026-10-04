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

async function run(code, input = '', expected = {}) {
  const started = performance.now();
  let readyAt;
  const result = await runner.run(code, input, {
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

const cancelled = await runner.run('while True: pass', '', {
  onStatus(status) { if (status === 'running') setTimeout(() => runner.cancel(), 30); },
});
assert.equal(cancelled.status, 'cancelled');
await run('print("after cancel")', '', { status: 'ok', stdout: 'after cancel\n' });

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

globalThis.Worker = class {
  postMessage() {}
  terminate() {}
};
const noLoad = await new PythonRunner({ loadTimeoutMs: 20 }).run('print(1)');
assert.equal(noLoad.status, 'timeout');
assert.equal(noLoad.ms, 0);
globalThis.Worker = BrowserWorker;

assert.equal(outputsEqual('1.0\n', '1.0000001\n'), true);
assert.equal(outputsEqual('a  \r\n', 'a\n'), true);
assert.equal(outputsEqual('1 2\n', '2 1\n'), false);
assert.equal(outputsEqual('hello\n', 'hello\n\n'), false);
assert.equal(outputsEqual('1\n', '1.1\n'), false);
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
