import fs from 'node:fs';
import assert from 'node:assert/strict';
const problems = JSON.parse(fs.readFileSync(new URL('../dist/data/problems.json', import.meta.url)));
assert.equal(problems.length, 100);
assert.equal(new Set(problems.map(p => p.id)).size, 100);
let count = 0;
for (const p of problems) {
  assert.ok(p.title && p.desc && p.inputSpec && p.outputSpec, `Incomplete problem ${p.id}`);
  assert.ok(p.examples.length && p.tests.length, `Missing cases ${p.id}`);
  for (const c of [...p.examples, ...p.tests]) {
    assert.equal(typeof c.input, 'string');
    assert.equal(typeof c.output, 'string');
  }
  for (const unwanted of ['core','freq','topic','explain','template']) assert.ok(!(unwanted in p));
  count += p.tests.length;
}
assert.equal(count, 478);
console.log(`Validated ${problems.length} problems and ${count} test cases.`);
