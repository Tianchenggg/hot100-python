import fs from 'node:fs';
import assert from 'node:assert/strict';
import groups from '../dist/data/groups.js';
import { extraIds, extraProblems } from './extra-problems.mjs';
const problems = JSON.parse(fs.readFileSync(new URL('../dist/data/problems.json', import.meta.url)));
const originalIds = Object.keys(JSON.parse(fs.readFileSync(new URL('./problem-corrections.json', import.meta.url)))).map(Number);
assert.equal(originalIds.length, 100);
assert.deepEqual([...extraIds].sort((a, b) => a - b), [122, 123, 188]);
assert.deepEqual(problems.map(p => p.id).sort((a, b) => a - b), [...originalIds, ...extraIds].sort((a, b) => a - b));
assert.equal(problems.length, 103);
assert.equal(new Set(problems.map(p => p.id)).size, 103);
assert.equal(groups.length, 17);
assert.equal(new Set(groups.map(group => group.id)).size, groups.length);
for (const group of groups) {
  assert.ok(group.id && group.name && group.problemIds.length, `Incomplete group ${group.id}`);
}
const groupedIds = groups.flatMap(group => group.problemIds);
assert.equal(groupedIds.length, 103);
assert.equal(new Set(groupedIds).size, 103, 'Duplicate grouped problem');
assert.deepEqual(
  [...groupedIds].sort((a, b) => a - b),
  problems.map(problem => problem.id).sort((a, b) => a - b),
  'Groups must contain every problem exactly once',
);
let count = 0;
for (const p of problems) {
  assert.ok(p.title && p.desc && p.inputSpec && p.outputSpec, `Incomplete problem ${p.id}`);
  assert.ok(Array.isArray(p.constraints) && p.constraints.length && p.constraints.every(item => typeof item === 'string' && item.trim()), `Missing constraints ${p.id}`);
  assert.match(p.url, /^https:\/\/leetcode\.cn\/problems\/[a-z0-9-]+\/$/, `Missing official source ${p.id}`);
  assert.ok(p.examples.length && p.tests.length, `Missing cases ${p.id}`);
  for (const c of [...p.examples, ...p.tests]) {
    assert.equal(typeof c.input, 'string');
    assert.equal(typeof c.output, 'string');
  }
  for (const unwanted of ['core','freq','topic','explain','template']) assert.ok(!(unwanted in p));
  count += p.tests.length;
}
assert.equal(problems.filter(p => !extraIds.includes(p.id)).reduce((sum, p) => sum + p.tests.length, 0), 484);
assert.equal(count, 484 + extraProblems.reduce((sum, p) => sum + p.cases.length, 0));
const recitation = JSON.parse(fs.readFileSync(new URL('../dist/data/recitation.json', import.meta.url)));
assert.deepEqual(recitation.groups.map(g => [g.id, g.name, g.problems.map(p => p.id)]), groups.map(g => [g.id, g.name, g.problemIds]));
console.log(`Validated ${groups.length} groups, ${problems.length} problems and ${count} test cases.`);
