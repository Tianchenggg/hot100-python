import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { getLeetCodeProblem, buildLeetCodeHarness, checkLeetCodeOutput } from '../dist/leetcode.js';

const rawProblems = JSON.parse(await readFile(new URL('../dist/data/problems.json', import.meta.url), 'utf8'));
const problems = new Map(rawProblems.map((problem) => [Number(problem.id), getLeetCodeProblem(problem)]));
const runtimePath = resolve(process.env.PYODIDE_PACKAGE_PATH || fileURLToPath(
  new URL('../node_modules/pyodide/', import.meta.url),
));
const { loadPyodide } = await import(pathToFileURL(`${runtimePath}/pyodide.mjs`).href);
const pyodide = await loadPyodide({ indexURL: `${runtimePath}/`, stdout() {}, stderr() {} });
let assertions = 0;

function equal(actual, expected, message) {
  assert.deepEqual(actual, expected, message);
  assertions += 1;
}

function checked(id, input, expected, actual, accepted = true) {
  const result = checkLeetCodeOutput(problems.get(id), JSON.stringify(input), JSON.stringify(expected), JSON.stringify(actual));
  equal(result, accepted, `Problem ${id}: ${JSON.stringify(actual)}`);
}

function execute(id, code, input = problems.get(id).tests[0].input) {
  const text = typeof input === 'string' ? input : JSON.stringify(input);
  const { setup, invoke } = buildLeetCodeHarness(problems.get(id), text);
  pyodide.globals.set('_qa_setup', setup);
  pyodide.globals.set('_qa_invoke', invoke);
  pyodide.globals.set('_qa_source', code);
  return JSON.parse(pyodide.runPython(`
import sys, io, json, traceback, linecache
_qa_old_streams = sys.stdin, sys.stdout, sys.stderr
_qa_stdout, _qa_stderr = io.StringIO(), io.StringIO()
sys.stdin, sys.stdout, sys.stderr = io.StringIO(), _qa_stdout, _qa_stderr
_qa_namespace = {"__name__": "__main__", "__file__": "main.py"}
_qa_error, _qa_line = "", None
linecache.cache["main.py"] = (len(_qa_source), None, _qa_source.splitlines(True), "main.py")
try:
    exec(compile(_qa_setup, "__leetcode__.py", "exec"), _qa_namespace, _qa_namespace)
    exec(compile(_qa_source, "main.py", "exec"), _qa_namespace, _qa_namespace)
    exec(compile(_qa_invoke, "__leetcode__.py", "exec"), _qa_namespace, _qa_namespace)
except BaseException as error:
    _qa_error = traceback.format_exc()
    _qa_line = error.lineno if isinstance(error, SyntaxError) and error.filename == "main.py" else None
    _qa_cursor = error.__traceback__
    while _qa_cursor:
        if _qa_cursor.tb_frame.f_code.co_filename == "main.py":
            _qa_line = _qa_cursor.tb_lineno
        _qa_cursor = _qa_cursor.tb_next
finally:
    sys.stdin, sys.stdout, sys.stderr = _qa_old_streams
json.dumps({"stdout": _qa_stdout.getvalue(), "stderr": _qa_stderr.getvalue(), "error": _qa_error,
           "line": _qa_line, "value": _qa_namespace.get("_leetcode_result")})
`));
}

function solution(method, body) {
  return `class Solution:\n    def ${method}:\n${body.split('\n').map((line) => `        ${line}`).join('\n')}\n`;
}

function runValue(id, code, input, expected) {
  const result = execute(id, code, input);
  equal(result.error, '', `Problem ${id}: ${result.error}`);
  equal(JSON.parse(result.value), expected, `Problem ${id} return value`);
  return result;
}

for (const problem of problems.values()) {
  assert.ok(problem.template && problem.tests.length && problem.examples.length, `Missing LeetCode data ${problem.id}`);
  pyodide.globals.set('_qa_source', problem.template);
  assert.doesNotThrow(() => pyodide.runPython('compile(_qa_source, "main.py", "exec")'), `Invalid template ${problem.id}`);
  for (const test of problem.tests) {
    assert.doesNotThrow(() => JSON.parse(test.input));
    assert.doesNotThrow(() => JSON.parse(test.output));
    equal(checkLeetCodeOutput(problem, test.input, test.output, test.output), true, `Self-comparison ${problem.id}`);
  }
}

checked(1, { nums: [2, 7, 11, 15], target: 9 }, [0, 1], [1, 0]);
checked(1, { nums: [3, 3], target: 6 }, [0, 1], [0, 0], false);
checked(1, { nums: [2, 7], target: 9 }, [0, 1], [0, 2], false);
checked(1, { nums: [2, 7], target: 9 }, [0, 1], ['0', '1'], false);
checked(5, { s: 'babad' }, 'bab', 'aba');
checked(5, { s: 'babad' }, 'bab', 'bad', false);
checked(5, { s: 'babad' }, 'bab', 'b', false);
checked(15, { nums: [-1, 0, 1, 2, -1, -4] }, [[-1, -1, 2], [-1, 0, 1]], [[1, 0, -1], [2, -1, -1]]);
checked(15, { nums: [-1, 0, 1, 2, -1, -4] }, [[-1, -1, 2], [-1, 0, 1]], [[-1, 0, 1], [-1, 0, 1]], false);
checked(17, { digits: '2' }, ['a', 'b', 'c'], ['c', 'a', 'b']);
checked(22, { n: 2 }, ['(())', '()()'], ['()()', '(())']);
checked(46, { nums: [1, 2] }, [[1, 2], [2, 1]], [[2, 1], [1, 2]]);
checked(46, { nums: [1, 2] }, [[1, 2], [2, 1]], [[2, 1], [2, 1]], false);
checked(49, { strs: ['ab', 'ba', 'ab', 'x'] }, [['ab', 'ba', 'ab'], ['x']], [['x'], ['ba', 'ab', 'ab']]);
checked(49, { strs: ['ab', 'ba', 'ab', 'x'] }, [['ab', 'ba', 'ab'], ['x']], [['x'], ['ba', 'ab']], false);
checked(51, { n: 4 }, [['.Q..', '...Q', 'Q...', '..Q.'], ['..Q.', 'Q...', '...Q', '.Q..']],
  [['..Q.', 'Q...', '...Q', '.Q..'], ['.Q..', '...Q', 'Q...', '..Q.']]);
checked(51, { n: 4 }, [['.Q..', '...Q', 'Q...', '..Q.']], [['.Q..', '.Q..', 'Q...', '..Q.']], false);
checked(56, { intervals: [[1, 3], [2, 6], [8, 10]] }, [[1, 6], [8, 10]], [[8, 10], [1, 6]]);
checked(56, { intervals: [[1, 3], [2, 6], [8, 10]] }, [[1, 6], [8, 10]], [[6, 1], [8, 10]], false);
checked(76, { s: 'abxba', t: 'ab' }, 'ab', 'ba');
checked(76, { s: 'abxba', t: 'ab' }, 'ab', 'bx', false);
checked(78, { nums: [1, 2] }, [[], [1], [2], [1, 2]], [[2, 1], [2], [], [1]]);
checked(78, { nums: [1, 2] }, [[], [1], [2], [1, 2]], [[2, 1], [2], [], [2]], false);
checked(108, { nums: [1, 2, 3, 4] }, [2, 1, 3, null, null, null, 4], [3, 2, 4, 1]);
checked(108, { nums: [1, 2, 3, 4] }, [2, 1, 3, null, null, null, 4], [1, null, 2, null, 3, null, 4], false);
checked(108, { nums: [1, 2, 3] }, [2, 1, 3], [2, 3, 1], false);
checked(131, { s: 'aab' }, [['a', 'a', 'b'], ['aa', 'b']], [['aa', 'b'], ['a', 'a', 'b']]);
checked(131, { s: 'aab' }, [['a', 'a', 'b'], ['aa', 'b']], [['b', 'aa'], ['a', 'a', 'b']], false);
checked(347, { nums: [1, 1, 2, 2, 3], k: 1 }, [1], [2]);
checked(347, { nums: [1, 1, 2, 2, 3], k: 2 }, [1, 2], [2, 1]);
checked(347, { nums: [1, 1, 2, 2, 3], k: 2 }, [1, 2], [1, 1], false);
checked(347, { nums: [1, 1, 2, 2, 3], k: 2 }, [1, 2], [1, 3], false);
checked(4, { nums1: [1], nums2: [2] }, 1.5, 1.50000001);
checked(4, { nums1: [1], nums2: [2] }, 1.5, 1.51, false);
checked(3, { s: 'abc' }, 3, 3.00000001, false);
checked(20, { s: '()' }, true, 1, false);
checked(20, { s: '()' }, true, 'true', false);

const debug = runValue(1, solution('twoSum(self, nums: List[int], target: int) -> List[int]',
  'print("debug", nums)\nimport sys\nsys.stderr.write("trace\\n")\nreturn [1, 0]'), undefined, [1, 0]);
equal(debug.stdout, 'debug [2, 7, 11, 15]\n', 'Debug output stays separate from return value');
equal(debug.stderr, 'trace\n', 'Stderr stays separate from return value');
equal(checkLeetCodeOutput(problems.get(1), problems.get(1).tests[0].input,
  problems.get(1).tests[0].output, debug.value), true);

runValue(2, solution('addTwoNumbers(self, l1: Optional[ListNode], l2: Optional[ListNode]) -> Optional[ListNode]',
  'return ListNode(l1.val + l2.val)'), { l1: [2], l2: [3] }, [5]);
runValue(23, solution('mergeKLists(self, lists)',
  'return lists[1]'), { lists: [[], [1, 2]] }, [1, 2]);
runValue(48, solution('rotate(self, matrix)',
  'matrix[:] = [list(row) for row in zip(*matrix[::-1])]'), { matrix: [[1, 2], [3, 4]] }, [[3, 1], [4, 2]]);
runValue(283, solution('moveZeroes(self, nums)',
  'nums[:] = [x for x in nums if x] + [0] * nums.count(0)\nreturn "ignored"'), { nums: [0, 1, 0, 3] }, [1, 3, 0, 0]);
runValue(226, solution('invertTree(self, root: Optional[TreeNode]) -> Optional[TreeNode]',
  'root.left, root.right = root.right, root.left\nreturn root'), { root: [1, 2, 3] }, [1, 3, 2]);
runValue(142, solution('detectCycle(self, head)', 'return head.next'), { head: [3, 2, 0, -4], pos: 1 }, 1);
runValue(142, solution('detectCycle(self, head)', 'return None'), { head: [1], pos: -1 }, null);
runValue(236, solution('lowestCommonAncestor(self, root, p, q)',
  'assert p is root.left and q is root.right\nreturn root'), { root: [3, 5, 1], p: 5, q: 1 }, 3);
const borrowed = execute(138, solution('copyRandomList(self, head)', 'return head'), { head: [[7, null], [13, 0]] });
assert.ok(borrowed.error, 'Returning original random-list nodes must be rejected'); assertions += 1;
const fakeCycle = execute(142, solution('detectCycle(self, head)', 'return ListNode(2)'), { head: [3, 2, 0, -4], pos: 1 });
assert.ok(fakeCycle.error, 'Returning a new node for a cycle entry must be rejected'); assertions += 1;
const fakeLca = execute(236, solution('lowestCommonAncestor(self, root, p, q)', 'return TreeNode(3)'), { root: [3, 5, 1], p: 5, q: 1 });
assert.ok(fakeLca.error, 'Returning a new node for the ancestor must be rejected'); assertions += 1;
runValue(160, solution('getIntersectionNode(self, headA, headB)', 'return headA.next'),
  { listA: [1, 8, 9], listB: [2, 8, 9], skipA: 1, skipB: 1 }, 8);
runValue(160, solution('getIntersectionNode(self, headA, headB)', 'return None'),
  { listA: [1, 2], listB: [3, 4], skipA: 2, skipB: 2 }, null);
runValue(160, solution('getIntersectionNode(self, headA, headB)', 'return None'),
  { listA: [], listB: [3, 4], skipA: 0, skipB: 2 }, null);
const fakeIntersection = execute(160, solution('getIntersectionNode(self, headA, headB)', 'return ListNode(8, ListNode(9))'),
  { listA: [1, 8, 9], listB: [2, 8, 9], skipA: 1, skipB: 1 });
assert.ok(fakeIntersection.error, 'Equal node values do not establish an intersection'); assertions += 1;
const damagedCopy = execute(138, solution('copyRandomList(self, head)', 'copy = Node(head.val)\nhead.val += 1\nreturn copy'),
  { head: [[7, null]] });
assert.ok(damagedCopy.error, 'Copying must preserve the original linked list'); assertions += 1;
runValue(138, solution('copyRandomList(self, head)', 'copy = Node(head.val)\ncopy.random = copy\nreturn copy'),
  { head: [[7, 0]] }, [[7, 0]]);
const externalRandom = execute(138, solution('copyRandomList(self, head)', 'copy = Node(head.val)\ncopy.random = head\nreturn copy'),
  { head: [[7, 0]] });
assert.ok(externalRandom.error, 'Copied random pointers must not target original nodes'); assertions += 1;
const cyclicOutput = execute(206, solution('reverseList(self, head)', 'head.next = head\nreturn head'), { head: [1] });
assert.ok(cyclicOutput.error, 'Unexpected output cycles must terminate with an error'); assertions += 1;
const sharedTree = execute(226, solution('invertTree(self, root)', 'root.right = root.left\nreturn root'), { root: [1, 2, 3] });
assert.ok(sharedTree.error, 'A tree output cannot reuse one node twice'); assertions += 1;

runValue(155, `class MinStack:
    def __init__(self):
        self.values = []
    def push(self, val):
        self.values.append(val)
        return "ignored"
    def pop(self):
        return self.values.pop()
    def top(self):
        return self.values[-1]
    def getMin(self):
        return min(self.values)
`, { operations: ['MinStack', 'push', 'push', 'push', 'getMin', 'pop', 'top', 'getMin'],
  arguments: [[], [-2], [0], [-3], [], [], [], []] }, [null, null, null, null, -3, null, 0, -2]);
runValue(295, `class MedianFinder:
    def __init__(self):
        self.values = []
    def addNum(self, num):
        self.values.append(num)
        self.values.sort()
    def findMedian(self):
        n = len(self.values)
        return (self.values[(n - 1) // 2] + self.values[n // 2]) / 2
`, { operations: ['MedianFinder', 'addNum', 'addNum', 'findMedian', 'addNum', 'findMedian'],
  arguments: [[], [1], [2], [], [3], []] }, [null, null, null, 1.5, null, 2]);
assert.throws(() => buildLeetCodeHarness(problems.get(1), '{broken'), /JSON/); assertions += 1;
assert.throws(() => buildLeetCodeHarness(problems.get(1), '{"nums":[1,2]}'), /target/); assertions += 1;
assert.throws(() => buildLeetCodeHarness(problems.get(155), '{"operations":[],"arguments":[1]}'), /参数数组/); assertions += 1;
const runtimeError = execute(1, solution('twoSum(self, nums, target)', 'return 1 / 0'));
equal(runtimeError.line, 3, 'Runtime errors refer to user code line');
assert.match(runtimeError.error, /ZeroDivisionError/); assertions += 1;
const syntaxError = execute(1, 'class Solution:\n    def twoSum(self, nums, target)\n        pass\n');
equal(syntaxError.line, 2, 'Syntax errors refer to user code line');

console.log(JSON.stringify({ leetcode: 'passed', assertions }));

if (process.env.CORE_REFERENCE_DATA_DIR) {
  const sourceDirectory = resolve(process.env.CORE_REFERENCE_DATA_DIR);
  const referenceProblems = JSON.parse(await readFile(resolve(sourceDirectory, 'problems.json'), 'utf8'));
  const references = JSON.parse(await readFile(resolve(sourceDirectory, 'solutions.json'), 'utf8'));
  const metadata = new Map(referenceProblems.map((problem) => [Number(problem.id), problem.core]));
  const failures = [];
  let count = 0;
  for (const [id, problem] of problems) {
    const core = metadata.get(id);
    let code = references[id]?.python3?.core;
    assert.equal(typeof code, 'string', `Missing reference solution ${id}`);
    if (id === 142) code = code.replace('return p.val', 'return p').replace('return -1', 'return None');
    if (id === 236) code = code.replace('node.val == p or node.val == q', 'node is p or node is q').replace('return lca(root).val', 'return lca(root)');
    if (id === 994) code = code.replaceAll("'1'", '1').replaceAll("'2'", '2');
    if (core.kind !== 'ops') code += `\nclass Solution:\n    ${core.method} = staticmethod(${core.method})\n`;
    for (const [index, test] of problem.tests.entries()) {
      const result = execute(id, code, test.input);
      const accepted = !result.error && checkLeetCodeOutput(problem, test.input, test.output, result.value);
      count += 1;
      if (!accepted) failures.push({ id, index, expected: test.output, ...result });
    }
  }
  console.log(JSON.stringify({ referenceProblems: problems.size, cases: count, failures }));
  equal(failures.length, 0, 'Reference solutions failed in Pyodide');
}
