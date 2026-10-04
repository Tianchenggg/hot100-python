import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { Worker as NodeWorker } from 'node:worker_threads';
import { PythonRunner } from '../dist/runner.js';

const runtimePath = resolve(process.env.PYODIDE_PACKAGE_PATH || 'node_modules/pyodide');
const workerSource = (await readFile(new URL('../dist/python-worker.js', import.meta.url), 'utf8'))
  .replace('https://cdn.jsdelivr.net/pyodide/v0.27.7/full/pyodide.mjs', pathToFileURL(`${runtimePath}/pyodide.mjs`).href)
  .replace('https://cdn.jsdelivr.net/pyodide/v0.27.7/full/', `${runtimePath}/`);
const bridge = `
import { parentPort } from 'node:worker_threads';
globalThis.self = globalThis;
self.postMessage = data => parentPort.postMessage(data);
parentPort.on('message', data => self.onmessage?.({ data }));
`;
class BrowserWorker {
  constructor() {
    this.worker = new NodeWorker(new URL(`data:text/javascript,${encodeURIComponent(bridge + workerSource)}`), { type: 'module', execArgv: [] });
    this.worker.on('message', data => this.onmessage?.({ data }));
    this.worker.on('error', error => this.onerror?.({ message: error.message, preventDefault() {} }));
    this.worker.on('messageerror', () => this.onmessageerror?.());
  }
  postMessage(data) { this.worker.postMessage(data); }
  terminate() { void this.worker.terminate(); }
}
globalThis.Worker = BrowserWorker;
const code = 'values = list(map(int, input().split()))\nprint(sum(values))';
const cases = Array.from({ length: 8 }, (_, i) => ({ input: `${i} ${i + 1}`, output: String(i * 2 + 1) }));
const modes = {
  previousSequentialFreshWorkers: { maxConcurrency: 1, warmWorkers: 0 },
  parallelFreshWorkers: { maxConcurrency: 2, warmWorkers: 0 },
};
const samples = Object.fromEntries(Object.keys(modes).map(key => [key, []]));
for (let repeat = 0; repeat < 3; repeat++) {
  for (const [name, options] of Object.entries(modes)) {
    const runner = new PythonRunner(options);
    const started = performance.now();
    const result = await runner.runCases(code, cases);
    samples[name].push(Math.round(performance.now() - started));
    assert.equal(result.allPassed, true);
    runner.cancel();
  }
}
const runner = new PythonRunner();
await runner.run(code, cases[0].input);
await Promise.all(runner.idle.map(slot => slot.ready));
const warmStarted = performance.now();
const warm = await runner.run(code, cases[0].input);
const warmRunMs = Math.round(performance.now() - warmStarted);
assert.equal(warm.stdout.trim(), cases[0].output);
runner.cancel();
const medians = Object.fromEntries(Object.entries(samples).map(([name, values]) => [name, [...values].sort((a, b) => a - b)[1]]));
console.log(JSON.stringify({ environment: 'Node worker_threads + locally cached Pyodide 0.27.7', cases: cases.length, samplesMs: samples, medianMs: medians, decreasePercent: Math.round((1 - medians.parallelFreshWorkers / medians.previousSequentialFreshWorkers) * 100), unusedWarmWorkerRunMs: warmRunMs }, null, 2));
