import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { checkOutput } from '../dist/checker.js';

const problems = JSON.parse(await readFile(new URL('../dist/data/problems.json', import.meta.url), 'utf8'));
let checks = 0;
function check(id, input, expected, actual, accepted, label) {
  assert.equal(checkOutput({ id }, input, expected, actual), accepted, label);
  checks++;
}

for (const problem of problems) {
  for (const [index, test] of problem.tests.entries()) {
    check(problem.id, test.input, test.output, test.output, true, `${problem.id} reference case ${index + 1}`);
  }
}

check(1, '4\n2 7 11 15\n9\n', '0 1\n', '1 0\n', true, 'two sum index order');
check(1, '4\n2 7 11 15\n9\n', '0 1\n', '0 2\n', false, 'two sum wrong pair');
check(1, '2\n3 3\n6\n', '0 1\n', '0 0\n', false, 'two sum cannot reuse an index');
check(1, '2\n3 3\n6\n', '0 1\n', '0 2\n', false, 'two sum bounds');
check(5, 'babad\n', 'bab\n', 'aba\n', true, 'alternate longest palindrome');
check(5, 'ac\n', 'a\n', 'c\n', true, 'alternate one-character palindrome');
check(5, 'babad\n', 'bab\n', 'bad\n', false, 'same length but not palindrome');
check(5, 'babad\n', 'bab\n', 'cdc\n', false, 'palindrome absent from input');
check(15, '6\n-1 0 1 2 -1 -4\n', '-1 -1 2\n-1 0 1\n', '1 0 -1\n2 -1 -1\n', true, 'triples and their values reordered');
check(15, '', '-1 -1 2\n-1 0 1\n', '-1 0 1\n-1 0 1\n', false, 'duplicate triple does not replace missing triple');
check(17, '2\n', 'a\nb\nc\n', 'c\na\nb\n', true, 'phone combination order');
check(17, '2\n', 'a\nb\nc\n', 'a\nb\nc\nc\n', false, 'extra phone combination');
check(22, '2\n', '(())\n()()\n', '()()\n(())\n', true, 'parentheses order');
check(22, '2\n', '(())\n()()\n', '()()\n)(()\n', false, 'invalid parentheses');
check(39, '2 3\n1 2\n', '1 1 1\n1 2\n', '2 1\n1 1 1\n', true, 'combination group and value order');
check(39, '2 3\n1 2\n', '1 1 1\n1 2\n', '1 1\n1 2\n', false, 'combination multiplicity');
check(46, '2\n1 2\n', '1 2\n2 1\n', '2 1\n1 2\n', true, 'permutation order');
check(46, '2\n1 2\n', '1 2\n2 1\n', '1 2\n1 2\n', false, 'permutations preserve inner order');
check(46, '0\n', '\n', '', false, 'empty permutation requires one empty row');
check(49, '4\nab ba ab ac\n', 'ab ba ab\nac\n', 'ac\nba ab ab\n', true, 'anagram group order');
check(49, '4\nab ba ab ac\n', 'ab ba ab\nac\n', 'ac\nba ab\n', false, 'anagram repeated words retained');
check(49, '3\n"" "" a\n', '"" ""\na\n', 'a\n"" ""\n', true, 'empty strings use explicit tokens');
check(49, '3\n"" "" a\n', '"" ""\na\n', 'a\n""\n', false, 'empty strings retain multiplicity');
const queenExpected = '.Q.. ...Q Q... ..Q.\n..Q. Q... ...Q .Q..\n';
check(51, '4\n', queenExpected, '..Q. Q... ...Q .Q..\n.Q.. ...Q Q... ..Q.\n', true, 'whole queen board order');
check(51, '4\n', queenExpected, 'Q... Q... Q... Q...\n..Q. Q... ...Q .Q..\n', false, 'queens attack each other');
check(51, '4\n', queenExpected, '.Q..\n...Q\nQ...\n..Q.\n..Q.\nQ...\n...Q\n.Q..\n', false, 'queen board grouping is significant');
check(56, '', '1 6\n8 10\n', '8 10\n1 6\n', true, 'interval row order');
check(56, '', '1 6\n8 10\n', '6 1\n8 10\n', false, 'interval endpoints preserve order');
check(76, 'abxba\nab\n', 'ab\n', 'ba\n', true, 'alternate minimum covering window');
check(76, 'abxba\nab\n', 'ab\n', 'bx\n', false, 'window must cover target');
check(76, 'aaba\naa\n', 'aa\n', 'ab\n', false, 'window target multiplicity');
check(78, '2\n1 2\n', '\n1\n1 2\n2\n', '2\n2 1\n1\n\n', true, 'subset order and empty subset position');
check(78, '2\n1 2\n', '\n1\n1 2\n2\n', '1\n1 2\n2\n', false, 'cannot omit empty subset');
check(78, '0\n', '\n', '\n\n', false, 'cannot duplicate empty subset');
check(108, '5\n1 2 3 4 5\n', '3 1 4 null 2 null 5\n', '3 2 5 1 null 4\n', true, 'alternate balanced search tree');
check(108, '3\n1 2 3\n', '2 1 3\n', '1 null 2 null 3\n', false, 'unbalanced search tree');
check(108, '3\n1 2 3\n', '2 1 3\n', '2 3 1\n', false, 'not a search tree');
check(108, '1\n1\n', '1\n', '1 null null 99\n', false, 'unattached tree node is rejected');
check(108, '1\n1\n', '1\n', '1 null null null\n', false, 'unattached null is rejected');
check(108, '1\n1\n', '1\n', '1 null null\n', true, 'explicit terminal null children');
check(108, '0\n', '\n', 'null 1\n', false, 'cannot hide nodes under empty root');
check(108, '1\n1\n', '1\n', 'null\n', false, 'missing nonempty tree');
check(108, '3\n1 2 3\n', '2 1 3\n', '2 1 4\n', false, 'tree values must equal input');
check(131, 'aab\n', 'a a b\naa b\n', 'aa b\na a b\n', true, 'partition row order');
check(131, 'aab\n', 'a a b\naa b\n', 'b aa\na a b\n', false, 'partition pieces preserve string order');
check(347, '6 2\n1 1 1 2 2 3\n', '1 2\n', '2 1\n', true, 'top frequency order');
check(347, '6 2\n1 1 1 2 2 3\n', '1 2\n', '1 3\n', false, 'top frequency boundary');
check(347, '4 2\n1 1 2 3\n', '1 2\n', '3 1\n', true, 'frequency boundary ties accepted');
check(347, '4 2\n1 1 2 3\n', '1 2\n', '2 3\n', false, 'frequency boundary cannot omit higher frequency');
check(347, '4 2\n1 1 2 3\n', '1 2\n', '1 1\n', false, 'top frequencies cannot repeat a value');
check(347, '4 2\n1 1 2 3\n', '1 2\n', '1 99\n', false, 'top frequency value must exist');
check(438, 'cbaebabacd\nabc\n', '0 6\n', '6 0\n', true, 'anagram indices may use either order');
check(438, 'cbaebabacd\nabc\n', '0 6\n', '0 0\n', false, 'anagram indices cannot replace a match with a duplicate');
check(438, 'cbaebabacd\nabc\n', '0 6\n', '0 6 8\n', false, 'anagram indices cannot add a nonexistent match');
check(3, 'abcabcbb\n', '3\n', '2\n', false, 'ordinary incorrect answer');
check(20, '()\n', 'true\n', 'false\n', false, 'ordinary boolean incorrect answer');
check(62, '', '1000000\n', '1000001\n', false, 'integer results do not get relative float tolerance');
check(62, '', '9007199254740993\n', '9007199254740992\n', false, 'large integers do not round through Number');
check(62, '', '1000000\n', '1000000.0\n', false, 'integer result requires its integer representation');
check(3, '', '3\n', '3  \r\n', true, 'ordinary output ignores trailing spaces and line-ending style');
check(3, '', '3\n', '3', true, 'ordinary output ignores final newline');
check(31, '', '1 2 3\n', '1 3 2\n', false, 'ordinary array order remains significant');
check(4, '', '2.5\n', '2.5000000001\n', true, 'ordinary float tolerance');
check(4, '', '2.5\n', '2.6\n', false, 'ordinary float incorrect answer');
console.log(`${checks} checker assertions passed`);
