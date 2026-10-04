import fs from 'node:fs';
import assert from 'node:assert/strict';
import groups from '../dist/data/groups.js';
const problems = JSON.parse(fs.readFileSync(new URL('../dist/data/problems.json', import.meta.url)));
assert.equal(problems.length, 100);
assert.equal(new Set(problems.map(p => p.id)).size, 100);
assert.equal(groups.length, 17);
assert.equal(new Set(groups.map(group => group.id)).size, groups.length);
for (const group of groups) {
  assert.ok(group.id && group.name && group.problemIds.length, `Incomplete group ${group.id}`);
}
const groupedIds = groups.flatMap(group => group.problemIds);
assert.equal(groupedIds.length, 100);
assert.equal(new Set(groupedIds).size, 100, 'Duplicate grouped problem');
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
assert.equal(count, 484);
console.log(`Validated ${groups.length} groups, ${problems.length} problems and ${count} test cases.`);
