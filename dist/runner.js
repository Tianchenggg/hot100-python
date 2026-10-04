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
    return Math.abs(a - b) <= 1e-6 * Math.max(1, Math.abs(a), Math.abs(b));
  });
}

function notify(callback, value) {
  if (typeof callback === 'function') {
    try { callback(value); } catch (error) { console.error(error); }
  }
}

export class PythonRunner {
  constructor({
    workerURL = new URL('./python-worker.js', import.meta.url),
    loadTimeoutMs = LOAD_TIMEOUT_MS,
    runTimeoutMs = RUN_TIMEOUT_MS,
  } = {}) {
    this.workerURL = workerURL;
    this.loadTimeoutMs = loadTimeoutMs;
    this.runTimeoutMs = runTimeoutMs;
    this.active = null;
    this.generation = 0;
  }

  cancel() {
    this.generation += 1;
    this.active?.finish({ status: 'cancelled', error: '已停止运行' });
  }

  async run(code, input = '', { onStatus } = {}) {
    this.cancel();
    return this.execute(String(code ?? ''), String(input ?? ''), onStatus);
  }

  async runCases(code, cases, { onProgress, onStatus } = {}) {
    this.cancel();
    const generation = this.generation;
    const results = [];
    let passed = 0;
    for (let index = 0; index < cases.length; index += 1) {
      if (generation !== this.generation) break;
      const test = cases[index];
      const result = await this.execute(String(code ?? ''), String(test.input ?? ''), onStatus);
      const expected = String(test.output ?? test.expected ?? '');
      const entry = {
        ...result, index, input: String(test.input ?? ''), expected,
        ok: result.status === 'ok' && outputsEqual(expected, result.stdout),
      };
      results.push(entry);
      if (entry.ok) passed += 1;
      notify(onProgress, { index: index + 1, total: cases.length, passed, result: entry });
      if (result.status === 'cancelled' || generation !== this.generation) break;
    }
    const cancelled = generation !== this.generation;
    return {
      results, passed, total: cases.length, cancelled,
      allPassed: !cancelled && results.length === cases.length && passed === cases.length,
    };
  }

  execute(code, input, onStatus) {
    return new Promise((resolve) => {
      let worker;
      let timer;
      let startedAt = null;
      let settled = false;
      let stdout = '';
      let stderr = '';
      let outputBytes = 0;
      const encoder = new TextEncoder();

      const task = {
        finish: (result) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          worker?.terminate();
          if (this.active === task) this.active = null;
          resolve({
            stdout, stderr, error: '', line: null,
            ms: startedAt === null ? 0 : Math.round(performance.now() - startedAt),
            ...result,
          });
        },
      };
      this.active = task;
      notify(onStatus, 'loading');
      if (settled) return;

      try {
        worker = new Worker(this.workerURL, { type: 'module', name: 'python-runner' });
      } catch (error) {
        task.finish({ status: 'error', error: `无法启动 Python：${error.message || error}` });
        return;
      }

      timer = setTimeout(() => task.finish({
        status: 'timeout', error: 'Python 加载超时，请检查网络后重试',
      }), this.loadTimeoutMs);

      worker.onmessage = ({ data }) => {
        if (settled || !data || typeof data.type !== 'string') return;
        if (data.type === 'ready') {
          if (startedAt !== null) return;
          clearTimeout(timer);
          startedAt = performance.now();
          timer = setTimeout(() => task.finish({
            status: 'timeout', error: `运行超时（${this.runTimeoutMs / 1000} 秒）`,
          }), this.runTimeoutMs);
          notify(onStatus, 'running');
          if (!settled) worker.postMessage({ type: 'run', code, input, outputLimit: OUTPUT_LIMIT_BYTES });
        } else if (data.type === 'output') {
          const value = String(data.text ?? '');
          const bytes = encoder.encode(value);
          const available = Math.max(0, OUTPUT_LIMIT_BYTES - outputBytes);
          const text = bytes.byteLength <= available
            ? value : new TextDecoder().decode(bytes.subarray(0, available), { stream: true });
          outputBytes += Math.min(available, bytes.byteLength);
          if (data.stream === 'stderr') stderr += text;
          else stdout += text;
          if (bytes.byteLength > available) task.finish({
            status: 'output_limit', error: '输出超过 64 KB 限制',
          });
        } else if (data.type === 'output_limit') {
          task.finish({ status: 'output_limit', error: '输出超过 64 KB 限制' });
        } else if (data.type === 'result') {
          task.finish({
            status: data.status === 'ok' ? 'ok' : 'error',
            error: String(data.error ?? ''),
            line: Number.isInteger(data.line) && data.line > 0 ? data.line : null,
            ms: Number.isFinite(data.ms) ? Math.max(0, Math.round(data.ms)) : undefined,
          });
        } else if (data.type === 'load_error') {
          task.finish({ status: 'error', error: `Python 加载失败：${String(data.error ?? '请重试')}` });
        }
      };
      worker.onerror = (event) => {
        event.preventDefault?.();
        task.finish({ status: 'error', error: `Python 运行器错误：${event.message || '请重试'}` });
      };
      worker.onmessageerror = () => task.finish({ status: 'error', error: 'Python 返回了无法读取的数据' });
    });
  }
}
