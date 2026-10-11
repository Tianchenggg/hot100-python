export const HOT20_IDS = Object.freeze([49, 15, 42, 3, 76, 48, 25, 146, 199, 200, 22, 20, 215, 55, 121, 122, 123, 188, 139, 300, 1143, 64, 72]);
export const EXTRA_IDS = Object.freeze([122, 123, 188]);
const hot20 = new Set(HOT20_IDS), extras = new Set(EXTRA_IDS);
const key = 'hot100-python:v1:collection';
const listeners = new Set();
const valid = value => value === 'hot100' || value === 'hot20';
let collection = 'hot100';
if (typeof window !== 'undefined') {
  let stored;
  try { stored = window.localStorage.getItem(key); } catch {}
  const requested = new URL(window.location.href).searchParams.get('collection');
  collection = valid(requested) ? requested : valid(stored) ? stored : 'hot100';
  if (valid(requested)) { try { window.localStorage.setItem(key, collection); } catch {} }
  window.addEventListener('storage', event => {
    if (event.key === key) update(valid(event.newValue) ? event.newValue : 'hot100', false);
  });
}
export const getCollection = () => collection;
export const collectionLabel = (scope = collection) => scope === 'hot20' ? 'Hot 20' : 'Hot 100';
export const isHot20 = id => hot20.has(Number(id));
export const inCollection = (id, scope = collection) => scope === 'hot20' ? isHot20(id) : !extras.has(Number(id));
export const filterProblems = (problems, scope = collection) => problems.filter(problem => inCollection(problem.id, scope));
function update(scope, persist) {
  if (!valid(scope) || scope === collection) return false;
  collection = scope;
  if (persist && typeof window !== 'undefined') { try { window.localStorage.setItem(key, scope); } catch {} }
  listeners.forEach(listener => listener(scope));
  return true;
}
export const setCollection = scope => update(scope, true);
export function subscribeCollection(listener) { listeners.add(listener); return () => listeners.delete(listener); }
