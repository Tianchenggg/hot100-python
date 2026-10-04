const PYODIDE_URL = 'https://cdn.jsdelivr.net/pyodide/v0.27.7/full/pyodide.mjs';
const PYODIDE_INDEX = 'https://cdn.jsdelivr.net/pyodide/v0.27.7/full/';

const DRIVER = `
import sys as _runner_sys
import json as _runner_json
import traceback as _runner_traceback
import linecache as _runner_linecache

def _runner_execute(source):
    namespace = {"__name__": "__main__", "__file__": "main.py", "__builtins__": __builtins__}
    _runner_linecache.cache["main.py"] = (len(source), None, source.splitlines(True), "main.py")
    format_exception = _runner_traceback.format_exception
    dumps = _runner_json.dumps
    stdout_flush = _runner_sys.stdout.flush
    stderr_flush = _runner_sys.stderr.flush
    result = {"status": "ok", "error": "", "line": None}
    try:
        exec(compile(source, "main.py", "exec"), namespace, namespace)
    except SystemExit as error:
        if error.code is not None and error.code != 0:
            result = {"status": "error", "error": "SystemExit: " + str(error.code), "line": None}
            tb = error.__traceback__
            while tb:
                if tb.tb_frame.f_code.co_filename == "main.py":
                    result["line"] = tb.tb_lineno
                tb = tb.tb_next
    except BaseException as error:
        tb = error.__traceback__
        if tb and tb.tb_frame.f_code.co_name == "_runner_execute":
            tb = tb.tb_next
        line = getattr(error, "lineno", None) if isinstance(error, SyntaxError) else None
        cursor = tb
        while cursor:
            if cursor.tb_frame.f_code.co_filename == "main.py":
                line = cursor.tb_lineno
            cursor = cursor.tb_next
        result = {"status": "error", "error": "".join(format_exception(type(error), error, tb)), "line": line}
    finally:
        for flush in (stdout_flush, stderr_flush):
            try:
                flush()
            except BaseException:
                pass
    return dumps(result)

_runner_execute(_runner_source)
`;

function createOutput(pyodide, limit) {
  let byteCount = 0;
  let exceeded = false;
  const streams = Object.fromEntries(['stdout', 'stderr'].map((name) => [name, {
    decoder: new TextDecoder(), pending: '', lastFlush: performance.now(),
  }]));
  const flush = (name, final = false) => {
    const stream = streams[name];
    if (final && !exceeded) stream.pending += stream.decoder.decode();
    if (stream.pending) {
      self.postMessage({ type: 'output', stream: name, text: stream.pending });
      stream.pending = '';
    }
    stream.lastFlush = performance.now();
  };
  const flushAll = (final = false) => {
    flush('stdout', final);
    flush('stderr', final);
  };
  const write = (name, buffer) => {
    const remaining = Math.max(0, limit - byteCount);
    const accepted = buffer.subarray(0, remaining);
    byteCount += accepted.byteLength;
    const stream = streams[name];
    stream.pending += stream.decoder.decode(accepted, { stream: true });
    if (buffer.byteLength > remaining || exceeded) {
      exceeded = true;
      flushAll();
      self.postMessage({ type: 'output_limit' });
      throw new pyodide.FS.ErrnoError(pyodide.ERRNO_CODES.EFBIG);
    }
    if (stream.pending.length >= 4096 || performance.now() - stream.lastFlush >= 40) flush(name);
    return buffer.byteLength;
  };
  pyodide.setStdout({ write: (buffer) => write('stdout', buffer) });
  pyodide.setStderr({ write: (buffer) => write('stderr', buffer) });
  return { flushAll, isExceeded: () => exceeded };
}

async function initialize() {
  try {
    const { loadPyodide } = await import(PYODIDE_URL);
    const pyodide = await loadPyodide({ indexURL: PYODIDE_INDEX, stdout: () => {}, stderr: () => {} });
    let hasRun = false;
    self.onmessage = ({ data }) => {
      if (data?.type !== 'run' || hasRun) return;
      hasRun = true;
      const source = String(data.code ?? '');
      const input = new TextEncoder().encode(String(data.input ?? ''));
      let inputOffset = 0;
      pyodide.setStdin({
        read(buffer) {
          const size = Math.min(buffer.byteLength, input.byteLength - inputOffset);
          buffer.set(input.subarray(inputOffset, inputOffset + size));
          inputOffset += size;
          return size;
        },
        isatty: false,
      });
      const output = createOutput(pyodide, Math.min(Number(data.outputLimit) || 65536, 65536));
      const startedAt = performance.now();
      let result;
      try {
        pyodide.FS.writeFile('main.py', source);
        pyodide.globals.set('_runner_source', source);
        result = JSON.parse(pyodide.runPython(DRIVER, { filename: '__runner__.py' }));
      } catch (error) {
        result = { status: 'error', error: String(error.message || error), line: null };
      }
      output.flushAll(true);
      if (output.isExceeded()) return;
      self.postMessage({ type: 'result', ...result, ms: performance.now() - startedAt });
    };
    self.postMessage({ type: 'ready' });
  } catch (error) {
    self.postMessage({ type: 'load_error', error: String(error.message || error) });
  }
}

initialize();
