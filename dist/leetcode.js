import data from './data/leetcode.js';
import { checkOutput } from './checker.js';

export function getLeetCodeProblem(problem) {
  const entry = data[problem.id];
  if (!entry) throw new Error('此题尚未提供 LeetCode 模式');
  return { ...problem, ...entry };
}

const PYTHON_SETUP = String.raw`
from typing import *
import json as _lc_json
from collections import deque as _lc_deque

class ListNode:
    def __init__(self, val=0, next=None):
        self.val, self.next = val, next

class TreeNode:
    def __init__(self, val=0, left=None, right=None):
        self.val, self.left, self.right = val, left, right

class Node:
    def __init__(self, val=0, next=None, random=None):
        self.val, self.next, self.random = val, next, random

def _lc_list(values):
    nodes = [ListNode(value) for value in values]
    for a, b in zip(nodes, nodes[1:]):
        a.next = b
    return (nodes[0] if nodes else None), nodes

def _lc_tree(values):
    if not values or values[0] is None:
        return None
    root = TreeNode(values[0])
    queue = _lc_deque([root])
    index = 1
    while queue and index < len(values):
        node = queue.popleft()
        for side in ('left', 'right'):
            if index < len(values) and values[index] is not None:
                child = TreeNode(values[index])
                setattr(node, side, child)
                queue.append(child)
            index += 1
    if index < len(values) and any(v is not None for v in values[index:]):
        raise ValueError('root 包含无法连接到树的节点')
    return root

def _lc_random(values):
    nodes = [Node(item[0]) for item in values]
    for index, item in enumerate(values):
        nodes[index].next = nodes[index + 1] if index + 1 < len(nodes) else None
        target = item[1]
        if target is not None and (not isinstance(target, int) or not 0 <= target < len(nodes)):
            raise ValueError('random 下标超出范围')
        nodes[index].random = None if target is None else nodes[target]
    return (nodes[0] if nodes else None), nodes

def _lc_build(value, kind):
    if kind == 'list':
        return _lc_list(value)[0]
    if kind == 'tree':
        return _lc_tree(value)
    if kind == 'randomList':
        return _lc_random(value)[0]
    if kind == 'listArray':
        return [_lc_list(item)[0] for item in value]
    return value

def _lc_list_output(node):
    values, seen = [], set()
    while node is not None:
        if id(node) in seen:
            raise ValueError('返回的链表包含环')
        seen.add(id(node))
        values.append(node.val)
        node = node.next
    return values

def _lc_tree_output(root):
    if root is None:
        return []
    values, seen, queue = [], set(), _lc_deque([root])
    while queue:
        node = queue.popleft()
        if node is None:
            values.append(None)
            continue
        if id(node) in seen:
            raise ValueError('返回的树包含环或共享节点')
        seen.add(id(node))
        values.append(node.val)
        queue.append(node.left)
        queue.append(node.right)
    while values and values[-1] is None:
        values.pop()
    return values

def _lc_random_output(head):
    nodes, positions = [], {}
    while head is not None:
        if id(head) in positions:
            raise ValueError('返回链表的 next 指针包含环')
        if id(head) in _lc_original_nodes:
            raise ValueError('必须返回深拷贝后的链表节点')
        positions[id(head)] = len(nodes)
        nodes.append(head)
        head = head.next
    output = []
    for node in nodes:
        if node.random is not None and id(node.random) not in positions:
            raise ValueError('random 必须指向复制链表中的节点')
        output.append([node.val, None if node.random is None else positions[id(node.random)]])
    return output

def _lc_serialize(value, kind):
    if kind == 'list':
        return _lc_list_output(value)
    if kind == 'tree':
        return _lc_tree_output(value)
    if kind == 'randomList':
        return _lc_random_output(value)
    return value

def _lc_nodes(root):
    result, stack = [], [root] if root is not None else []
    while stack:
        node = stack.pop()
        result.append(node)
        if node.right is not None: stack.append(node.right)
        if node.left is not None: stack.append(node.left)
    return result

_lc_original_nodes = set()
_lc_protected = []
_lc_random_protected = []
_lc_shared = None
_lc_node_positions = {}
_lc_tree_nodes = {}
_lc_args = []
if _lc_spec['kind'] != 'ops':
    if _lc_id in (141, 142):
        _lc_head, _lc_nodes_array = _lc_list(_lc_input['head'])
        _lc_pos = _lc_input['pos']
        if not isinstance(_lc_pos, int) or _lc_pos < -1 or _lc_pos >= len(_lc_nodes_array):
            raise ValueError('pos 必须为 -1 或有效的节点下标')
        if _lc_pos >= 0:
            _lc_nodes_array[-1].next = _lc_nodes_array[_lc_pos]
        _lc_args = [_lc_head]
        _lc_node_positions = {id(node): index for index, node in enumerate(_lc_nodes_array)}
        _lc_protected = [(node, node.val, node.next) for node in _lc_nodes_array]
    elif _lc_id == 160:
        _lc_a, _lc_an = _lc_list(_lc_input['listA'])
        _lc_b, _lc_bn = _lc_list(_lc_input['listB'])
        _lc_sa, _lc_sb = _lc_input['skipA'], _lc_input['skipB']
        if not isinstance(_lc_sa, int) or not isinstance(_lc_sb, int) or not 0 <= _lc_sa <= len(_lc_an) or not 0 <= _lc_sb <= len(_lc_bn):
            raise ValueError('skipA 或 skipB 超出范围')
        if _lc_sa < len(_lc_an) or _lc_sb < len(_lc_bn):
            if _lc_input['listA'][_lc_sa:] != _lc_input['listB'][_lc_sb:]:
                raise ValueError('两条链表在相交位置之后的数据必须一致')
            _lc_shared = _lc_an[_lc_sa]
            if _lc_sb:
                _lc_bn[_lc_sb - 1].next = _lc_shared
            else:
                _lc_b = _lc_shared
        _lc_args = [_lc_a, _lc_b]
        _lc_original_nodes = {id(node) for node in _lc_an + _lc_bn[:_lc_sb]}
        _lc_protected = [(node, node.val, node.next) for node in _lc_an + _lc_bn[:_lc_sb]]
    else:
        for _lc_param in _lc_spec['params']:
            _lc_name, _lc_kind = _lc_param['name'], _lc_param['type']
            if _lc_id == 236 and _lc_name in ('p', 'q'):
                _lc_matches = [node for node in _lc_tree_nodes.values() if node.val == _lc_input[_lc_name]]
                if len(_lc_matches) != 1:
                    raise ValueError('p 和 q 必须对应树中唯一存在的节点')
                _lc_args.append(_lc_matches[0])
            else:
                _lc_built = _lc_build(_lc_input[_lc_name], _lc_kind)
                _lc_args.append(_lc_built)
                if _lc_id == 236:
                    _lc_tree_nodes = {id(node): node for node in _lc_nodes(_lc_built)}
                if _lc_id == 138:
                    _lc_cursor = _lc_built
                    while _lc_cursor is not None:
                        _lc_original_nodes.add(id(_lc_cursor))
                        _lc_random_protected.append((_lc_cursor, _lc_cursor.val, _lc_cursor.next, _lc_cursor.random))
                        _lc_cursor = _lc_cursor.next
`;

const PYTHON_INVOKE = String.raw`
if _lc_spec['kind'] == 'ops':
    _lc_ops, _lc_values = _lc_input['operations'], _lc_input['arguments']
    if len(_lc_ops) != len(_lc_values) or not _lc_ops or _lc_ops[0] != _lc_spec['className']:
        raise ValueError('operations 与 arguments 长度需一致，首项需为构造函数')
    _lc_object = globals()[_lc_spec['className']](*_lc_values[0])
    _lc_value = [None]
    _lc_allowed = {method['name']: method for method in _lc_spec['ops']['methods']}
    for _lc_op, _lc_a in zip(_lc_ops[1:], _lc_values[1:]):
        if _lc_op not in _lc_allowed:
            raise ValueError('未知操作：' + str(_lc_op))
        _lc_return = getattr(_lc_object, _lc_op)(*_lc_a)
        _lc_value.append(None if _lc_allowed[_lc_op]['ret'] == 'void' else _lc_return)
else:
    _lc_return = getattr(Solution(), _lc_spec['method'])(*_lc_args)
    for _lc_node, _lc_oldval, _lc_oldnext in _lc_protected:
        if _lc_node.val != _lc_oldval or _lc_node.next is not _lc_oldnext:
            raise ValueError('此题不得修改原有链表')
    for _lc_node, _lc_oldval, _lc_oldnext, _lc_oldrandom in _lc_random_protected:
        if _lc_node.val != _lc_oldval or _lc_node.next is not _lc_oldnext or _lc_node.random is not _lc_oldrandom:
            raise ValueError('复制后必须保留原有链表结构')
    if _lc_id == 142:
        if _lc_return is not None and id(_lc_return) not in _lc_node_positions:
            raise ValueError('必须返回输入链表中的节点或 None')
        _lc_value = None if _lc_return is None else _lc_node_positions[id(_lc_return)]
    elif _lc_id == 160:
        if _lc_return is not _lc_shared:
            raise ValueError('必须返回两条链表实际共享的节点；无交点时返回 None')
        _lc_value = None if _lc_return is None else _lc_return.val
    elif _lc_id == 236:
        if _lc_return is None or id(_lc_return) not in _lc_tree_nodes:
            raise ValueError('必须返回输入二叉树中的节点')
        _lc_value = _lc_return.val
    elif _lc_spec.get('mutates', -1) >= 0:
        _lc_index = _lc_spec['mutates']
        _lc_value = _lc_serialize(_lc_args[_lc_index], _lc_spec['params'][_lc_index]['type'])
    else:
        _lc_value = _lc_serialize(_lc_return, _lc_spec['returns'])
_leetcode_result = _lc_json.dumps(_lc_value, ensure_ascii=False, allow_nan=False, separators=(',', ':'))
`;

function parseInput(problem, input) {
  let value;
  try { value = JSON.parse(input); } catch { throw new Error('输入需要是有效的 JSON 对象'); }
  if (!value || Array.isArray(value) || typeof value !== 'object') throw new Error('输入需要是 JSON 对象');
  const { core } = getLeetCodeProblem(problem);
  const required = core.kind === 'ops' ? ['operations', 'arguments']
    : [141, 142].includes(Number(problem.id)) ? ['head', 'pos']
      : Number(problem.id) === 160 ? ['listA', 'listB', 'skipA', 'skipB']
        : core.params.map(param => param.name);
  for (const name of required) if (!Object.hasOwn(value, name)) throw new Error(`输入缺少参数：${name}`);
  if (core.kind === 'ops' && (!Array.isArray(value.operations) || !Array.isArray(value.arguments)
    || !value.arguments.every(Array.isArray))) throw new Error('operations 和 arguments 需要是数组，arguments 中每项需要是参数数组');
  return value;
}

export function buildLeetCodeHarness(problem, input) {
  const entry = getLeetCodeProblem(problem);
  const value = parseInput(problem, input);
  const preamble = `import json as _lc_json\n_lc_input = _lc_json.loads(${JSON.stringify(JSON.stringify(value))})\n_lc_spec = _lc_json.loads(${JSON.stringify(JSON.stringify(entry.core))})\n_lc_id = ${Number(problem.id)}\n`;
  return { setup: preamble + PYTHON_SETUP, invoke: PYTHON_INVOKE };
}

function sameValue(left, right, floats = false) {
  if (typeof left !== typeof right) return false;
  if (Array.isArray(left) || Array.isArray(right)) {
    return Array.isArray(left) && Array.isArray(right) && left.length === right.length
      && left.every((value, index) => sameValue(value, right[index], floats));
  }
  if (left !== null && typeof left === 'object') return false;
  if (typeof left === 'number' && floats) return Math.abs(left - right) <= 1e-6 * Math.max(1, Math.abs(left), Math.abs(right));
  return left === right;
}

function canonical(value, innerSort = false) {
  if (!Array.isArray(value)) throw new Error('Expected an array');
  return value.map(item => JSON.stringify(innerSort && Array.isArray(item) ? [...item].sort() : item)).sort();
}

export function checkLeetCodeOutput(problem, input, expected, actual) {
  try {
    const params = parseInput(problem, input);
    const wanted = JSON.parse(expected), got = JSON.parse(actual);
    const id = Number(problem.id);
    if (id === 1) {
      return Array.isArray(got) && got.length === 2 && got.every(x => Number.isInteger(x) && x >= 0 && x < params.nums.length)
        && got[0] !== got[1] && params.nums[got[0]] + params.nums[got[1]] === params.target;
    }
    if (id === 5) return typeof got === 'string' && typeof wanted === 'string'
      && Array.from(got).length === Array.from(wanted).length && params.s.includes(got)
      && got === Array.from(got).reverse().join('');
    if (id === 76) {
      if (typeof got !== 'string' || typeof wanted !== 'string' || got.length !== wanted.length || !params.s.includes(got)) return false;
      if (!got) return true;
      const counts = new Map();
      for (const c of got) counts.set(c, (counts.get(c) || 0) + 1);
      for (const c of params.t) { const count = counts.get(c) || 0; if (!count) return false; counts.set(c, count - 1); }
      return true;
    }
    if (id === 108) {
      if (!Array.isArray(got) || got.some(v => v !== null && !Number.isInteger(v))) return false;
      return checkOutput(problem, `${params.nums.length}\n${params.nums.join(' ')}\n`, '', got.map(v => v === null ? 'null' : v).join(' '));
    }
    if (id === 347) {
      if (!Array.isArray(got) || got.some(v => !Number.isInteger(v))) return false;
      return checkOutput(problem, `${params.nums.length} ${params.k}\n${params.nums.join(' ')}\n`, '', got.join(' '));
    }
    if ([15, 39, 78, 49].includes(id)) return sameValue(canonical(wanted, true), canonical(got, true));
    if ([17, 22, 46, 51, 56, 131].includes(id)) return sameValue(canonical(wanted), canonical(got));
    return sameValue(wanted, got, id === 4 || id === 295);
  } catch {
    return false;
  }
}
