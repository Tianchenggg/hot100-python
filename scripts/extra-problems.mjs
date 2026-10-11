import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export const extraProblems = JSON.parse(fs.readFileSync(new URL('./hot20-extra-problems.json', import.meta.url)));
export const extraIds = extraProblems.map(problem => problem.id);

export function extraLeetCodeProblem(problem) {
  const params = [
    ...(problem.id === 188 ? [{ name: 'k', type: 'int', desc: '最多交易次数' }] : []),
    { name: 'prices', type: 'int[]', desc: '每天的股票价格' },
  ];
  const core = { kind: 'function', className: 'Solution', method: 'maxProfit', params,
    returns: 'int', returnsDesc: '能获得的最大利润', mutates: -1 };
  const cases = problem.cases.map(test => ({
    input: `{
${Object.entries(test.params).map(([key, value]) => `  ${JSON.stringify(key)}: ${JSON.stringify(value)}`).join(',\n')}
}`,
    output: JSON.stringify(test.expected),
  }));
  return {
    core,
    template: `class Solution:\n    def maxProfit(self, ${problem.id === 188 ? 'k: int, ' : ''}prices: List[int]) -> int:\n        pass\n`,
    signature: `maxProfit(${params.map(param => param.name).join(', ')})`,
    inputSpec: `JSON 对象：${params.map(param => param.name).join('、')}。`,
    outputSpec: core.returnsDesc,
    examples: cases.slice(0, problem.examples),
    tests: cases,
  };
}

export function addExtraLeetCodeProblems(dataset) {
  for (const problem of extraProblems) dataset[problem.id] = extraLeetCodeProblem(problem);
  return dataset;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const file = new URL('../dist/data/leetcode.js', import.meta.url);
  const { default: dataset } = await import(file.href);
  fs.writeFileSync(file, `export default ${JSON.stringify(addExtraLeetCodeProblems(dataset))};\n`);
}
