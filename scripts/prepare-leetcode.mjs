import fs from 'node:fs';
import path from 'node:path';

const upstream = process.argv[2];
if (!upstream) throw new Error('Usage: node scripts/prepare-leetcode.mjs /path/to/hot100-judge');
const problems = JSON.parse(fs.readFileSync(path.join(upstream, 'public/data/problems.json')));
const tests = JSON.parse(fs.readFileSync(path.join(upstream, 'public/data/tests.json')));
const types = { int: 'int', double: 'float', bool: 'bool', string: 'str', void: 'None', 'int[]': 'List[int]', 'int[][]': 'List[List[int]]', 'string[]': 'List[str]', 'string[][]': 'List[List[str]]', grid: 'List[List[str]]', list: 'Optional[ListNode]', tree: 'Optional[TreeNode]', randomList: 'Optional[Node]', listArray: 'List[Optional[ListNode]]' };
function decode(value) {
  if (Array.isArray(value)) return value.map(decode);
  if (typeof value !== 'string') return value;
  const match = /^(list|tree|grid|randomList|listArray):(.+)$/.exec(value);
  if (!match) return value;
  const parsed = JSON.parse(match[2]);
  if (match[1] === 'grid') return parsed.map(row => Array.from(row));
  if (match[1] === 'randomList') return parsed.map(([v, index]) => [v, index < 0 ? null : index]);
  return parsed;
}
const formatInput = value => `{\n${Object.entries(value).map(([key, item]) => `  ${JSON.stringify(key)}: ${JSON.stringify(item)}`).join(',\n')}\n}`;
const dataset = {};
for (const problem of problems) {
  const core = structuredClone(problem.core);
  delete core.templates;
  if (problem.id === 23) core.params[0] = { name: 'lists', type: 'listArray', desc: '升序链表数组' };
  if (problem.id === 994) core.params[0] = { name: 'grid', type: 'int[][]', desc: '橘子网格' };
  if (problem.id === 142) { core.returns = 'list'; core.returnsDesc = '环入口节点；无环返回 None'; }
  if (problem.id === 236) {
    core.params[1].type = core.params[2].type = 'tree';
    core.params[1].desc = '目标节点 p'; core.params[2].desc = '目标节点 q';
    core.returns = 'tree'; core.returnsDesc = '最近公共祖先节点';
  }
  let template;
  if (core.kind === 'ops') {
    template = problem.core.templates.python3.replace(/^(\s*)#.*$/gm, '$1pass');
  } else {
    const args = core.params.map(p => `${p.name}: ${types[p.type]}`).join(', ');
    template = `class Solution:\n    def ${core.method}(self${args ? ', ' + args : ''}) -> ${types[core.returns]}:\n        pass\n`;
  }
  const cases = tests[problem.id].core.map(test => {
    let input, expected = decode(test.expected);
    if (core.kind === 'ops') {
      input = { operations: test.ops, arguments: test.args };
    } else if ([141, 142].includes(problem.id)) {
      const [head, pos] = JSON.parse(test.args[0].slice('cycleList:'.length));
      input = { head, pos };
      if (problem.id === 142) expected = pos < 0 ? null : pos;
    } else if (problem.id === 160) {
      const [listA, listB, skipA, skipB] = JSON.parse(test.args[0].slice('intersectList:'.length));
      input = { listA, listB, skipA, skipB };
      expected = expected.length ? expected[0] : null;
    } else {
      input = Object.fromEntries(core.params.map((p, index) => [p.name, decode(test.args[index])]));
      if (problem.id === 994) input.grid = input.grid.map(row => row.map(Number));
    }
    return { input: formatInput(input), output: JSON.stringify(expected) };
  });
  const signature = core.kind === 'ops' ? core.className : `${core.method}(${core.params.map(p => p.name).join(', ')})`;
  let inputSpec = core.kind === 'ops'
    ? 'JSON 对象：operations 为操作名数组，arguments 为对应参数数组。'
    : `JSON 对象：${core.params.map(p => p.name).join('、')}。`;
  if ([141, 142].includes(problem.id)) inputSpec = 'JSON 对象：head 为节点值数组，pos 为尾节点连接的位置（从 0 开始），-1 表示无环。';
  if (problem.id === 160) inputSpec = 'JSON 对象：listA、listB 为节点值数组，skipA、skipB 为相交位置；无交点时设为各自长度。';
  if (problem.id === 236) inputSpec = 'JSON 对象：root 为层序数组（null 表示空节点），p、q 为目标节点值。';
  if (problem.id === 138) inputSpec = 'JSON 对象：head 为 [节点值, random 下标] 数组，无 random 指针时使用 null。';
  let outputSpec = core.kind === 'ops' ? '按操作顺序返回结果数组；构造和无返回值操作对应 null。' : core.returnsDesc;
  if (core.mutates >= 0) outputSpec = `原地修改 ${core.params[core.mutates].name}，返回 None。结果显示修改后的数据。`;
  if (problem.id === 142) outputSpec = '返回环入口节点；结果显示该节点的位置下标，无环显示 null。';
  if (problem.id === 160) outputSpec = '返回相交节点；结果显示其节点值，无交点显示 null。';
  if (problem.id === 236) outputSpec = '返回最近公共祖先节点；结果显示其节点值。';
  const desc = {
    142: '给定链表的头节点 head，返回链表开始入环的第一个节点。如果链表无环，则返回 None。pos 表示尾节点连接的位置，不作为函数参数传入。不得修改链表。',
    160: '给定两个单链表的头节点 headA 和 headB，返回它们相交的起始节点。如果不存在相交节点，则返回 None。不得修改原有链表结构。',
    236: '给定一个二叉树的根节点 root 以及两个目标节点 p 和 q，返回它们的最近公共祖先节点。一个节点可以是它自己的祖先。树中节点值互不相同，p 和 q 均存在于树中。',
  }[problem.id];
  dataset[problem.id] = { core, template, signature, inputSpec, outputSpec, ...(desc ? { desc } : {}), examples: cases.slice(0, 2), tests: cases };
}
fs.writeFileSync(new URL('../dist/data/leetcode.js', import.meta.url), `export default ${JSON.stringify(dataset)};\n`);
console.log(`Generated ${problems.length} LeetCode problems, ${Object.values(dataset).reduce((n, p) => n + p.tests.length, 0)} cases.`);
