import { outputsEqual } from './runner.js?v=7';

const normalizeNewlines = (text) => text.replace(/\r\n?/g, '\n');
const tokens = (text) => text.trim() ? text.trim().split(/\s+/) : [];

function integer(token) {
  if (!/^[+-]?\d+$/.test(token)) throw new Error('Invalid integer');
  return BigInt(token).toString();
}

function integers(text) {
  return tokens(text).map(integer);
}

function lines(text, keepEmpty = false) {
  const normalized = normalizeNewlines(text);
  if (!normalized) return [];
  const result = normalized.split('\n');
  if (result.at(-1) === '') result.pop();
  return result.map((line) => line.trim()).filter((line) => keepEmpty || line !== '');
}

function sameMultiset(left, right) {
  if (left.length !== right.length) return false;
  const a = [...left].sort();
  const b = [...right].sort();
  return a.every((item, index) => item === b[index]);
}

function exactOutput(expected, actual) {
  const normalize = (text) => normalizeNewlines(text).split('\n')
    .map((line) => line.trimEnd())
    .filter((line, index, all) => !(index === all.length - 1 && line === ''));
  const left = normalize(expected);
  const right = normalize(actual);
  return left.length === right.length && left.every((line, index) => line === right[index]);
}

function rowCollection(expected, actual, { numeric = false, sortWithin = false, keepEmpty = false } = {}) {
  const canonical = (text) => lines(text, keepEmpty).map((line) => {
    const parts = numeric ? integers(line) : tokens(line);
    return JSON.stringify(sortWithin ? parts.sort() : parts);
  });
  return sameMultiset(canonical(expected), canonical(actual));
}

function twoSum(input, actual) {
  const source = integers(input);
  const n = Number(source[0]);
  if (!Number.isSafeInteger(n) || n < 2 || source.length !== n + 2) return false;
  const answer = integers(actual);
  if (answer.length !== 2) return false;
  const [a, b] = answer.map(Number);
  if (![a, b].every((index) => Number.isSafeInteger(index) && index >= 0 && index < n) || a === b) return false;
  return BigInt(source[a + 1]) + BigInt(source[b + 1]) === BigInt(source.at(-1));
}

function singleString(text) {
  const result = normalizeNewlines(text).replace(/\n$/, '');
  if (result.includes('\n')) throw new Error('Expected one output line');
  return result;
}

function longestPalindrome(input, expected, actual) {
  const source = normalizeNewlines(input).split('\n')[0];
  const answer = singleString(actual);
  const chars = Array.from(answer);
  return chars.length === Array.from(singleString(expected)).length
    && source.includes(answer)
    && chars.every((char, index) => char === chars[chars.length - index - 1]);
}

function minimumWindow(input, expected, actual) {
  const [source, target = ''] = normalizeNewlines(input).split('\n');
  const answer = singleString(actual);
  if (answer.length !== singleString(expected).length || !source.includes(answer)) return false;
  if (!answer) return true;
  const counts = new Map();
  for (const char of answer) counts.set(char, (counts.get(char) || 0) + 1);
  for (const char of target) {
    const count = counts.get(char) || 0;
    if (!count) return false;
    counts.set(char, count - 1);
  }
  return true;
}

function queens(input, expected, actual) {
  const n = Number(integer(tokens(input)[0]));
  if (!Number.isSafeInteger(n) || n < 1) return false;
  const canonical = (text) => lines(text).map((line) => {
    const rows = tokens(line);
    if (rows.length !== n) throw new Error('Wrong board size');
    const columns = new Set();
    const descending = new Set();
    const ascending = new Set();
    rows.forEach((row, r) => {
      if (row.length !== n || !/^[.Q]+$/.test(row) || row.split('Q').length !== 2) throw new Error('Invalid board');
      const c = row.indexOf('Q');
      if (columns.has(c) || descending.has(r - c) || ascending.has(r + c)) throw new Error('Attacking queens');
      columns.add(c);
      descending.add(r - c);
      ascending.add(r + c);
    });
    return JSON.stringify(rows);
  });
  return sameMultiset(canonical(expected), canonical(actual));
}

function balancedSearchTree(input, actual) {
  const source = integers(input);
  const n = Number(source[0]);
  if (!Number.isSafeInteger(n) || n < 0 || source.length !== n + 1) return false;
  const output = tokens(actual);
  if (!n) return !output.length || (output.length === 1 && output[0] === 'null');
  if (!output.length || output[0] === 'null' || output.length > n * 2 + 1) return false;
  const makeNode = (token) => token === 'null' ? null : { value: integer(token), left: null, right: null, height: 1 };
  const root = makeNode(output[0]);
  const nodes = [root];
  let nextNode = 0;
  let nextToken = 1;
  while (nextToken < output.length) {
    if (nextNode >= nodes.length) return false;
    const parent = nodes[nextNode++];
    for (const side of ['left', 'right']) {
      if (nextToken >= output.length) break;
      parent[side] = makeNode(output[nextToken++]);
      if (parent[side]) nodes.push(parent[side]);
    }
    if (nodes.length > n) return false;
  }
  if (nodes.length !== n) return false;
  const stack = [];
  const inorder = [];
  let current = root;
  while (current || stack.length) {
    while (current) {
      stack.push(current);
      current = current.left;
    }
    current = stack.pop();
    inorder.push(current.value);
    current = current.right;
  }
  if (!inorder.every((value, index) => value === source[index + 1]
    && (index === 0 || BigInt(inorder[index - 1]) < BigInt(value)))) return false;
  for (let index = nodes.length - 1; index >= 0; index--) {
    const node = nodes[index];
    const left = node.left?.height || 0;
    const right = node.right?.height || 0;
    if (Math.abs(left - right) > 1) return false;
    node.height = Math.max(left, right) + 1;
  }
  return true;
}

function topFrequent(input, actual) {
  const source = integers(input);
  const n = Number(source[0]);
  const k = Number(source[1]);
  if (!Number.isSafeInteger(n) || !Number.isSafeInteger(k) || n < 0 || k < 0 || source.length !== n + 2) return false;
  const answer = integers(actual);
  const selected = new Set(answer);
  if (answer.length !== k || selected.size !== k) return false;
  const counts = new Map();
  for (const value of source.slice(2)) counts.set(value, (counts.get(value) || 0) + 1);
  if (k > counts.size || answer.some((value) => !counts.has(value))) return false;
  if (!k) return true;
  const minimumSelected = Math.min(...answer.map((value) => counts.get(value)));
  return [...counts].every(([value, count]) => selected.has(value) || count <= minimumSelected);
}

export function checkOutput(problem, input, expected, actual) {
  if (![input, expected, actual].every((value) => typeof value === 'string')) return false;
  try {
    switch (Number(problem.id)) {
      case 1: return twoSum(input, actual);
      case 4:
      case 295: return outputsEqual(expected, actual);
      case 5: return longestPalindrome(input, expected, actual);
      case 15:
      case 39: return rowCollection(expected, actual, { numeric: true, sortWithin: true });
      case 17:
      case 22: return sameMultiset(lines(expected), lines(actual));
      case 46: return rowCollection(expected, actual, { numeric: true, keepEmpty: true });
      case 49: return rowCollection(expected, actual, { sortWithin: true });
      case 51: return queens(input, expected, actual);
      case 56: return rowCollection(expected, actual, { numeric: true });
      case 76: return minimumWindow(input, expected, actual);
      case 78: return rowCollection(expected, actual, { numeric: true, sortWithin: true, keepEmpty: true });
      case 108: return balancedSearchTree(input, actual);
      case 131: return rowCollection(expected, actual);
      case 347: return topFrequent(input, actual);
      case 438: return sameMultiset(integers(expected), integers(actual));
      default: return exactOutput(expected, actual);
    }
  } catch {
    return false;
  }
}
