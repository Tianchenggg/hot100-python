import assert from 'node:assert/strict';
import fs from 'node:fs';
import data from '../dist/data/leetcode.js';
const problems = JSON.parse(fs.readFileSync(new URL('../dist/data/problems.json', import.meta.url)));
const n = (x, a, b) => Number.isInteger(x) && x >= a && x <= b;
const arr = (x, a, b, lo = -Infinity, hi = Infinity) => Array.isArray(x) && n(x.length, a, b) && x.every(v => n(v, lo, hi));
const str = (x, a, b, pattern) => typeof x === 'string' && n(x.length, a, b) && (!pattern || pattern.test(x));
const letters = /^[a-z]*$/, upperLower = /^[a-zA-Z]*$/;
const unique = x => new Set(x).size === x.length;
const sorted = x => x.every((v, i) => !i || x[i - 1] <= v);
const strict = x => sorted(x) && unique(x);
const tree = (x, a, b, lo, hi) => Array.isArray(x) && arr(x.filter(v => v !== null), a, b, lo, hi);
const matrix = (x, a, b, lo, hi) => Array.isArray(x) && n(x.length, a, b) && n(x[0]?.length, a, b) && x.every(r => arr(r, x[0].length, x[0].length, lo, hi));
const list2 = (x, lo, hi) => arr(x, lo, hi, -100, 100) && sorted(x);
const int32 = [-2147483648, 2147483647];
const checks = {
  1: x => arr(x.nums,2,1e4,-1e9,1e9) && n(x.target,-1e9,1e9) && x.nums.flatMap((v,i)=>x.nums.slice(i+1).filter(w=>v+w===x.target)).length===1,
  2: x => [x.l1,x.l2].every(v=>arr(v,1,100,0,9) && (v.length===1 || v.at(-1)!==0)),
  3: x => str(x.s,0,1e5),
  4: x => [x.nums1,x.nums2].every(v=>arr(v,0,1000,-1e6,1e6)&&sorted(v)) && n(x.nums1.length+x.nums2.length,1,2000),
  5: x => str(x.s,1,1000,/^[a-zA-Z0-9]+$/),
  11: x => arr(x.height,2,1e5,0,1e4),
  15: x => arr(x.nums,3,3000,-1e5,1e5),
  17: x => str(x.digits,1,4,/^[2-9]+$/),
  19: x => arr(x.head,1,30,0,100) && n(x.n,1,x.head.length),
  20: x => str(x.s,1,1e4,/^[()[\]{}]+$/),
  21: x => [x.list1,x.list2].every(v=>list2(v,0,50)),
  22: x => n(x.n,1,8),
  23: x => Array.isArray(x.lists) && x.lists.length<=1e4 && x.lists.every(v=>arr(v,0,500,-1e4,1e4)&&sorted(v)) && x.lists.flat().length<=1e4,
  24: x => arr(x.head,0,100,0,100),
  25: x => arr(x.head,1,5000,0,1000) && n(x.k,1,x.head.length),
  31: x => arr(x.nums,1,100,0,100),
  32: x => str(x.s,0,3e4,/^[()]*$/),
  33: x => arr(x.nums,1,5000,-1e4,1e4) && unique(x.nums) && n(x.target,-1e4,1e4),
  34: x => arr(x.nums,0,1e5,-1e9,1e9) && sorted(x.nums) && n(x.target,-1e9,1e9),
  35: x => arr(x.nums,1,1e4,-1e4,1e4) && strict(x.nums) && n(x.target,-1e4,1e4),
  39: x => arr(x.candidates,1,30,2,40) && unique(x.candidates) && n(x.target,1,40),
  41: x => arr(x.nums,1,1e5,...int32),
  42: x => arr(x.height,1,2e4,0,1e5),
  45: x => { if(!arr(x.nums,1,1e4,0,1000)) return false; let r=0;for(let i=0;i<x.nums.length&&i<=r;i++)r=Math.max(r,i+x.nums[i]);return r>=x.nums.length-1;},
  46: x => arr(x.nums,1,6,-10,10) && unique(x.nums),
  48: x => matrix(x.matrix,1,20,-1000,1000) && x.matrix.length===x.matrix[0].length,
  49: x => Array.isArray(x.strs) && n(x.strs.length,1,1e4) && x.strs.every(v=>str(v,0,100,letters)),
  51: x => n(x.n,1,9),
  53: x => arr(x.nums,1,1e5,-1e4,1e4),
  54: x => matrix(x.matrix,1,10,-100,100),
  55: x => arr(x.nums,1,1e4,0,1e5),
  56: x => Array.isArray(x.intervals) && n(x.intervals.length,1,1e4) && x.intervals.every(v=>arr(v,2,2,0,1e4)&&sorted(v)),
  62: x => {if(!n(x.m,1,100)||!n(x.n,1,100))return false;let v=1;for(let i=1;i<x.m;i++)v=v*(x.n+i-1)/i;return v<=2e9;},
  64: x => matrix(x.grid,1,200,0,200),
  70: x => n(x.n,1,45),
  72: x => [x.word1,x.word2].every(v=>str(v,0,500,letters)),
  73: x => matrix(x.matrix,1,200,...int32),
  74: x => matrix(x.matrix,1,100,-1e4,1e4) && n(x.target,-1e4,1e4) && x.matrix.every((r,i)=>sorted(r)&&(!i||r[0]>x.matrix[i-1].at(-1))),
  75: x => arr(x.nums,1,300,0,2),
  76: x => [x.s,x.t].every(v=>str(v,1,1e5,upperLower)),
  78: x => arr(x.nums,1,10,-10,10)&&unique(x.nums),
  79: x => matrix(x.board.map(r=>r.map(c=>c.charCodeAt(0))),1,6,65,122) && x.board.flat().every(v=>str(v,1,1,upperLower)) && str(x.word,1,15,upperLower),
  84: x => arr(x.heights,1,1e5,0,1e4),
  94: x => tree(x.root,0,100,-100,100),
  98: x => tree(x.root,1,1e4,...int32),
  101: x => tree(x.root,1,1000,-100,100),
  102: x => tree(x.root,0,2000,-1000,1000),
  104: x => tree(x.root,0,1e4,-100,100),
  105: x => arr(x.preorder,1,3000,-3000,3000) && arr(x.inorder,x.preorder.length,x.preorder.length,-3000,3000) && unique(x.preorder) && unique(x.inorder) && [...x.preorder].sort().join() === [...x.inorder].sort().join(),
  108: x => arr(x.nums,1,1e4,-1e4,1e4) && strict(x.nums),
  114: x => tree(x.root,0,2000,-100,100),
  118: x => n(x.numRows,1,30),
  121: x => arr(x.prices,1,1e5,0,1e4),
  124: x => tree(x.root,1,3e4,-1000,1000),
  128: x => arr(x.nums,0,1e5,-1e9,1e9),
  131: x => str(x.s,1,16,letters),
  136: x => {if(!arr(x.nums,1,3e4,-3e4,3e4))return false;const f=x.nums.map(v=>x.nums.filter(w=>w===v).length);return f.filter(v=>v===1).length===1&&f.every(v=>v===1||v===2);},
  138: x => Array.isArray(x.head) && x.head.length<=1000 && x.head.every(v=>v.length===2&&n(v[0],-1e4,1e4)&&(v[1]===null||n(v[1],0,x.head.length-1))),
  139: x => str(x.s,1,300,letters) && n(x.wordDict.length,1,1000) && x.wordDict.every(v=>str(v,1,20,letters)) && unique(x.wordDict),
  141: x => arr(x.head,0,1e4,-1e5,1e5) && n(x.pos,-1,x.head.length-1),
  142: x => arr(x.head,0,1e4,-1e5,1e5) && n(x.pos,-1,x.head.length-1),
  146: x => n(x.arguments[0][0],1,3000) && x.operations.length<=2e5+1 && x.arguments.slice(1).every(v=>n(v[0],0,1e4)&&(v.length===1||n(v[1],0,1e5))),
  148: x => arr(x.head,0,5e4,-1e5,1e5),
  152: x => {if(!arr(x.nums,1,2e4,-10,10))return false;for(let i=0;i<x.nums.length;i++){let p=1;for(let j=i;j<x.nums.length;j++){p*=x.nums[j];if(!n(p,...int32))return false;}}return true;},
  153: x => arr(x.nums,1,5000,-5000,5000) && unique(x.nums),
  155: x => {let size=0;return x.operations.length<=3e4+1 && x.operations.slice(1).every((op,i)=>op==='push'?(++size,n(x.arguments[i+1][0],...int32)):op==='pop'?size-->0:size>0);},
  // Official example 1 contains 0 despite the displayed Node.val lower bound of 1.
  160: x => [x.listA,x.listB].every(v=>arr(v,1,3e4,0,1e5)) && n(x.skipA,0,x.listA.length) && n(x.skipB,0,x.listB.length) && JSON.stringify(x.listA.slice(x.skipA))===JSON.stringify(x.listB.slice(x.skipB)),
  169: x => arr(x.nums,1,5e4,-1e9,1e9) && x.nums.some(v=>x.nums.filter(w=>w===v).length>x.nums.length/2),
  189: x => arr(x.nums,1,1e5,...int32) && n(x.k,0,1e5),
  198: x => arr(x.nums,1,100,0,400),
  199: x => tree(x.root,0,100,-100,100),
  200: x => matrix(x.grid.map(r=>r.map(Number)),1,300,0,1) && x.grid.flat().every(v=>v==='0'||v==='1'),
  206: x => arr(x.head,0,5000,-5000,5000),
  207: x => n(x.numCourses,1,2000) && x.prerequisites.length<=5000 && x.prerequisites.every(v=>arr(v,2,2,0,x.numCourses-1)) && unique(x.prerequisites.map(JSON.stringify)),
  208: x => x.operations.length<=3e4+1 && x.arguments.slice(1).every(v=>str(v[0],1,2000,letters)),
  215: x => arr(x.nums,1,1e5,-1e4,1e4) && n(x.k,1,x.nums.length),
  226: x => tree(x.root,0,100,-100,100),
  230: x => tree(x.root,1,1e4,0,1e4) && n(x.k,1,x.root.filter(v=>v!==null).length),
  234: x => arr(x.head,1,1e5,0,9),
  236: x => tree(x.root,2,1e5,-1e9,1e9) && unique(x.root.filter(v=>v!==null)) && x.p!==x.q && x.root.includes(x.p) && x.root.includes(x.q),
  238: x => arr(x.nums,2,1e5,-30,30),
  239: x => arr(x.nums,1,1e5,-1e4,1e4) && n(x.k,1,x.nums.length),
  240: x => matrix(x.matrix,1,300,-1e9,1e9) && n(x.target,-1e9,1e9) && x.matrix.every((r,i)=>sorted(r)&&(!i||r.every((v,j)=>v>=x.matrix[i-1][j]))),
  279: x => n(x.n,1,1e4),
  283: x => arr(x.nums,1,1e4,...int32),
  287: x => arr(x.nums,2,1e5+1,1,x.nums.length-1) && x.nums.length-new Set(x.nums).size>=1 && [...new Set(x.nums)].filter(v=>x.nums.filter(w=>w===v).length>1).length===1,
  295: x => {let size=0;return x.operations.length<=5e4+1 && x.operations.slice(1).every((op,i)=>op==='addNum'?(++size,n(x.arguments[i+1][0],-1e5,1e5)):size>0);},
  300: x => arr(x.nums,1,2500,-1e4,1e4),
  322: x => arr(x.coins,1,12,1,2147483647) && n(x.amount,0,1e4),
  347: x => {if(!arr(x.nums,1,1e5,-1e4,1e4)||!n(x.k,1,new Set(x.nums).size))return false;let f=[...new Set(x.nums)].map(v=>x.nums.filter(w=>w===v).length).sort((a,b)=>b-a);return x.k===f.length||f[x.k-1]>f[x.k];},
  394: x => str(x.s,1,30,/^[a-z0-9\[\]]+$/),
  416: x => arr(x.nums,1,200,1,100),
  437: x => tree(x.root,0,1000,-1e9,1e9) && n(x.targetSum,-1000,1000),
  438: x => [x.s,x.p].every(v=>str(v,1,3e4,letters)),
  543: x => tree(x.root,1,1e4,-100,100),
  560: x => arr(x.nums,1,2e4,-1000,1000) && n(x.k,-1e7,1e7),
  739: x => arr(x.temperatures,1,1e5,30,100),
  763: x => str(x.s,1,500,letters),
  994: x => matrix(x.grid,1,10,0,2),
  1143: x => [x.text1,x.text2].every(v=>str(v,1,1000,letters)),
};
assert.equal(Object.keys(checks).length,100);
let cases=0;
for(const p of problems) {
  assert.equal(typeof checks[p.id],'function',`Missing domain check ${p.id}`);
  for(const [i,t] of data[p.id].tests.entries()) {assert.ok(checks[p.id](JSON.parse(t.input)),`Outside official input domain: ${p.id} case ${i+1}`);cases++;}
}
const treeIds=new Set([94,98,101,102,104,114,124,199,226,230,236,437,543]);
for(const p of problems)for(const t of [...p.examples,...p.tests]){
  const lines=t.input.split('\n');
  if(treeIds.has(p.id)){const count=Number(lines[0]);assert.equal(count,count?lines[1].trim().split(/\s+/).length:0,`Tree token count ${p.id}`);}
  if(p.id===287)assert.equal(Number(lines[0])+1,lines[1].trim().split(/\s+/).length,'Duplicate-number n+1 length');
}
console.log(`${Object.keys(checks).length} problem input domains, ${cases} LeetCode cases and ACM tree/length formats validated.`);
