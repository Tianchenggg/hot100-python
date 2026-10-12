import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import groups from '../dist/data/groups.js';

const storageKey = 'hot100-python:v1:collection';
const storage = new Map([[storageKey, 'hot100'], ['hot100-python:v1:passed', '[1,49]'], ['hot100-python:v1:code:49', 'my code']]);
const handlers = new Map();
globalThis.window = {
  location: { href: 'https://example.test/?collection=hot20' },
  localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) },
  addEventListener: (event, handler) => handlers.set(event, handler),
};
const { getCollection, setCollection, subscribeCollection, filterProblems, HOT20_IDS, EXTRA_IDS } = await import('../dist/collections.js');
const problems = JSON.parse(await readFile(new URL('../dist/data/problems.json', import.meta.url)));
const recitation = JSON.parse(await readFile(new URL('../dist/data/recitation.json', import.meta.url)));
const acmById = new Map(problems.map(problem => [problem.id, problem]));
const recitationProblems = recitation.groups.flatMap(group => group.problems);
assert.equal(recitationProblems.length, 103);
for (const problem of recitationProblems) {
  const acm = acmById.get(problem.id);
  assert.ok(acm, `Recitation problem ${problem.id} must exist in ACM data`);
  assert.equal(problem.input, acm.examples[0].input, `ACM sample input ${problem.id}`);
  assert.equal(problem.output, acm.examples[0].output, `ACM sample output ${problem.id}`);
  assert.equal(problem.inputSpec, acm.inputSpec, `ACM input format ${problem.id}`);
  assert.equal(problem.outputSpec, acm.outputSpec, `ACM output format ${problem.id}`);
}
assert.equal(getCollection(), 'hot20', 'an explicit shared URL overrides the stored scope');
assert.equal(storage.get(storageKey), 'hot20');
assert.deepEqual(HOT20_IDS, [49,15,42,3,76,48,25,146,199,200,22,20,215,55,121,122,123,188,139,300,1143,64,72]);
assert.equal(new Set(HOT20_IDS).size, 23);
const hundred = filterProblems(problems, 'hot100');
const twenty = filterProblems(problems, 'hot20');
assert.equal(hundred.length, 100);
assert.equal(twenty.length, 23);
assert.equal(filterProblems(hundred, 'hot20').length, 20);
assert.deepEqual(twenty.filter(p => !hundred.includes(p)).map(p => p.id).sort((a,b)=>a-b), EXTRA_IDS);
for (const scope of ['hot100', 'hot20']) {
  const practiceIds = filterProblems(problems, scope).map(p => p.id).sort((a,b)=>a-b);
  const cardIds = filterProblems(recitation.groups.flatMap(g=>g.problems), scope).map(p=>p.id).sort((a,b)=>a-b);
  const groupedIds = filterProblems(groups.flatMap(g=>g.problemIds.map(id=>({id}))), scope).map(p=>p.id).sort((a,b)=>a-b);
  assert.deepEqual(cardIds, practiceIds);
  assert.deepEqual(groupedIds, practiceIds);
}
const changesA=[], changesB=[];
subscribeCollection(scope=>changesA.push(scope));
const unsubscribe = subscribeCollection(scope=>changesB.push(scope));
assert.equal(setCollection('hot100'), true);
assert.deepEqual(changesA, ['hot100']); assert.deepEqual(changesB, changesA);
assert.equal(setCollection('hot100'), false);
assert.equal(setCollection('unknown'), false);
assert.equal(changesA.length, 1);
setCollection('hot20');
assert.equal(storage.get(storageKey), 'hot20');
unsubscribe();
handlers.get('storage')({key:storageKey, newValue:'hot100'});
assert.equal(getCollection(), 'hot100');
assert.deepEqual(changesA, ['hot100','hot20','hot100']);
assert.deepEqual(changesB, ['hot100','hot20']);
assert.equal(storage.get('hot100-python:v1:passed'), '[1,49]', 'collection changes must preserve all passing records');
assert.equal(storage.get('hot100-python:v1:code:49'), 'my code', 'collection changes must preserve code');
window.localStorage.setItem = () => { throw new Error('Storage unavailable'); };
assert.equal(setCollection('hot20'), true, 'unavailable storage must not prevent switching');
assert.equal(filterProblems(problems).length, 23);
console.log('Collection checks passed: exact 100/23 membership, 20 highlights, all 103 recitation ACM samples/formats, data parity, URL preference, cross-page updates and record preservation.');
