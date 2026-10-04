const LOAD_TIMEOUT_MS = 60_000;
const RUN_TIMEOUT_MS = 5_000;
const OUTPUT_LIMIT_BYTES = 64 * 1024;

export function outputsEqual(expectedRaw, actualRaw) {
  const normalize = (value) => String(value || '').replace(/\r\n/g, '\n')
    .split('\n').map((line) => line.trimEnd())
    .filter((line, index, lines) => !(index === lines.length - 1 && line === ''));
  const expected = normalize(expectedRaw);
  const actual = normalize(actualRaw);
  if (expected.length !== actual.length) return false;
  if (expected.every((line, index) => line === actual[index])) return true;
  const isNumber = (value) => /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(value.trim());
  if (!expected.every(isNumber) || !actual.every(isNumber)) return false;
  return expected.every((line, index) => {
    const a = Number.parseFloat(line);
    const b = Number.parseFloat(actual[index]);
    return Number.isFinite(a) && Number.isFinite(b)
      && Math.abs(a - b) <= 1e-5;
  });
}

function notify(callback, value) {
  if (typeof callback === 'function') {
    try { callback(value); } catch (error) { console.error(error); }
  }
}

export class PythonRunner {
  constructor({
    workerURL = new URL('./python-worker.js?v=7', import.meta.url),
    loadTimeoutMs = LOAD_TIMEOUT_MS,
    runTimeoutMs = RUN_TIMEOUT_MS,
    maxConcurrency = 2,
    warmWorkers = 1,
    idleTimeoutMs = 60_000,
  } = {}) {
    this.workerURL = workerURL;
    this.loadTimeoutMs = loadTimeoutMs;
    this.runTimeoutMs = runTimeoutMs;
    this.maxConcurrency = Math.max(1, Math.min(2, Math.trunc(maxConcurrency) || 1));
    this.warmWorkers = Math.max(0, Math.min(1, Math.trunc(warmWorkers) || 0));
    this.idleTimeoutMs = idleTimeoutMs;
    this.tasks = new Set();
    this.idle = [];
    this.generation = 0;
  }

  cancel() {
    this.begin();
    for (const slot of this.idle.splice(0)) slot.close();
  }

  begin() {
    this.generation += 1;
    for (const task of [...this.tasks]) task.finish({ status: 'cancelled', error: '已停止运行' });
    return this.generation;
  }

  createWorker() {
    let settleReady;
    const slot = {
      worker: null, closed: false, dispatch: null,
      ready: new Promise(resolve => { settleReady = resolve; }),
      close: () => {
        if (slot.closed) return;
        slot.closed = true;
        clearTimeout(slot.loadTimer);
        clearTimeout(slot.idleTimer);
        slot.worker?.terminate();
        settleReady({ status: 'cancelled', error: '已停止运行' });
      },
    };
    let loaded = false;
    const fail = error => {
      if (slot.closed) return;
      if (loaded) {
        if (slot.dispatch) slot.dispatch({ type: 'load_error', error: error.error });
        else slot.close();
      } else {
        settleReady(error);
        slot.close();
      }
    };
    try {
      slot.worker = new Worker(this.workerURL, { type: 'module', name: 'python-runner' });
      slot.loadTimer = setTimeout(() => fail({
        status: 'timeout', error: 'Python 加载超时，请检查网络后重试',
      }), this.loadTimeoutMs);
      slot.worker.onmessage = ({ data }) => {
        if (slot.closed || !data || typeof data.type !== 'string') return;
        if (data.type === 'ready' && !loaded) {
          loaded = true;
          clearTimeout(slot.loadTimer);
          settleReady(null);
        } else if (data.type === 'load_error') {
          fail({ status: 'error', error: `Python 加载失败：${String(data.error ?? '请重试')}` });
        } else slot.dispatch?.(data);
      };
      slot.worker.onerror = event => {
        event.preventDefault?.();
        fail({ status: 'error', error: `Python 运行器错误：${event.message || '请重试'}` });
      };
      slot.worker.onmessageerror = () => fail({ status: 'error', error: 'Python 返回了无法读取的数据' });
    } catch (error) {
      fail({ status: 'error', error: `无法启动 Python：${error.message || error}` });
    }
    return slot;
  }

  prepareNext() {
    this.idle = this.idle.filter(slot => !slot.closed);
    if (this.idle.length >= this.warmWorkers) return;
    const slot = this.createWorker();
    this.idle.push(slot);
    slot.ready.then(error => {
      if (error || slot.closed || !this.idle.includes(slot)) return;
      slot.idleTimer = setTimeout(() => {
        this.idle = this.idle.filter(item => item !== slot);
        slot.close();
      }, this.idleTimeoutMs);
    });
  }

  async run(code, input = '', { onStatus, harness } = {}) {
    const generation = this.begin();
    const result = await this.execute(String(code ?? ''), String(input ?? ''), onStatus, harness);
    if (generation === this.generation) this.prepareNext();
    return result;
  }

  async runCases(code, cases, {
    onProgress, onStatus, buildHarness,
    compare = (test, result) => outputsEqual(test.output ?? test.expected ?? '', result.stdout),
    stopOnError = false,
  } = {}) {
    const generation = this.begin();
    const completed = new Array(cases.length);
    const results = [];
    let nextIndex = 0;
    let reportIndex = 0;
    let passed = 0;
    let stopped = false;
    const isCurrent = () => generation === this.generation && !stopped;
    const report = () => {
      while (isCurrent() && completed[reportIndex]) {
        const entry = completed[reportIndex++];
        results.push(entry);
        if (entry.ok) passed += 1;
        notify(onProgress, { index: entry.index + 1, total: cases.length, passed, result: entry });
        if (generation === this.generation && stopOnError && entry.status !== 'ok') {
          stopped = true;
          for (const task of [...this.tasks]) task.finish({ status: 'cancelled', error: '已停止运行' });
        }
      }
    };
    const lane = async () => {
      while (isCurrent() && nextIndex < cases.length) {
        const index = nextIndex++;
        const test = cases[index];
        const harness = buildHarness?.(test, index) ?? test.harness;
        const result = await this.execute(String(code ?? ''), String(test.input ?? ''), onStatus, harness);
        if (!isCurrent()) return;
        completed[index] = {
          ...result, index, input: String(test.input ?? ''),
          expected: String(test.output ?? test.expected ?? ''),
          ok: result.status === 'ok' && Boolean(compare(test, result, index)),
        };
        report();
      }
    };
    try {
      await Promise.all(Array.from({ length: Math.min(this.maxConcurrency, cases.length) }, lane));
    } catch (error) {
      stopped = true;
      if (generation === this.generation) {
        for (const task of [...this.tasks]) task.finish({ status: 'cancelled', error: '已停止运行' });
      }
      throw error;
    } finally {
      if (generation === this.generation && cases.length) this.prepareNext();
    }
    const cancelled = generation !== this.generation;
    return {
      results, passed, total: cases.length, cancelled,
      allPassed: !cancelled && results.length === cases.length && passed === cases.length,
    };
  }

  execute(code, input, onStatus, harness) {
    return new Promise(resolve => {
      this.idle = this.idle.filter(slot => !slot.closed);
      const slot = this.idle.shift() ?? this.createWorker();
      clearTimeout(slot.idleTimer);
      let timer;
      let startedAt = null;
      let settled = false;
      let stdout = '';
      let stderr = '';
      let outputBytes = 0;
      const encoder = new TextEncoder();
      const task = {
        finish: result => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          slot.close();
          this.tasks.delete(task);
          resolve({
            stdout, stderr, error: '', line: null,
            ms: startedAt === null ? 0 : Math.round(performance.now() - startedAt),
            ...result,
          });
        },
      };
      this.tasks.add(task);
      notify(onStatus, 'loading');
      if (settled) return;
      slot.dispatch = data => {
        if (settled) return;
        if (data.type === 'output') {
          const value = String(data.text ?? '');
          const bytes = encoder.encode(value);
          const available = Math.max(0, OUTPUT_LIMIT_BYTES - outputBytes);
          const text = bytes.byteLength <= available
            ? value : new TextDecoder().decode(bytes.subarray(0, available), { stream: true });
          outputBytes += Math.min(available, bytes.byteLength);
          if (data.stream === 'stderr') stderr += text;
          else stdout += text;
          if (bytes.byteLength > available) task.finish({ status: 'output_limit', error: '输出超过 64 KB 限制' });
        } else if (data.type === 'output_limit') {
          task.finish({ status: 'output_limit', error: '输出超过 64 KB 限制' });
        } else if (data.type === 'result') {
          task.finish({
            status: data.status === 'ok' ? 'ok' : 'error', error: String(data.error ?? ''),
            line: Number.isInteger(data.line) && data.line > 0 ? data.line : null,
            value: typeof data.value === 'string' ? data.value : undefined,
            ms: Number.isFinite(data.ms) ? Math.max(0, Math.round(data.ms)) : Math.round(performance.now() - startedAt),
          });
        } else if (data.type === 'load_error') {
          task.finish({ status: 'error', error: String(data.error) });
        }
      };
      slot.ready.then(error => {
        if (settled) return;
        if (error) { task.finish(error); return; }
        startedAt = performance.now();
        timer = setTimeout(() => task.finish({
          status: 'timeout', error: `运行超时（${this.runTimeoutMs / 1000} 秒）`,
        }), this.runTimeoutMs);
        notify(onStatus, 'running');
        if (!settled) {
          try { slot.worker.postMessage({ type: 'run', code, input, harness, outputLimit: OUTPUT_LIMIT_BYTES }); }
          catch (error) { task.finish({ status: 'error', error: `无法发送 Python 代码：${error.message || error}` }); }
        }
      });
    });
  }
}
