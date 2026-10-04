import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { installPythonEnhancements, smartIndentBackspace } from '../dist/editor-enhancements.js';

// The real vendored tokenizer, StringStream and Doc run without a rendered editor.
const element = () => ({
  style: {}, childNodes: [], setAttribute() {}, getAttribute() { return null; },
  appendChild(child) { this.childNodes.push(child); return child; }, removeChild() {},
  addEventListener() {}, removeEventListener() {}, cloneNode: () => element(),
  getBoundingClientRect: () => ({ left: 0, top: 0, right: 0, bottom: 0 })
});
const document = {
  createElement: element, createTextNode: text => ({ nodeType: 3, textContent: text }),
  documentElement: element(), body: element(), addEventListener() {}, removeEventListener() {},
  createRange: () => ({ setEnd() {}, setStart() {}, getClientRects: () => [], getBoundingClientRect: () => ({ left: 0, top: 0, right: 0, bottom: 0 }) })
};
const context = { navigator: { userAgent: 'Node', platform: 'Node', vendor: '' }, document, setTimeout, clearTimeout };
context.window = context;
context.self = context;
vm.createContext(context);
for (const path of ['lib/codemirror.js', 'mode/python/python.js']) {
  vm.runInContext(await readFile(new URL(`../dist/vendor/codemirror/${path}`, import.meta.url), 'utf8'), context);
}
const CodeMirror = context.CodeMirror;
const enhancedName = installPythonEnhancements(CodeMirror);
assert.equal(installPythonEnhancements(CodeMirror), enhancedName);
const config = { indentUnit: 4, tabSize: 4 };

function tokenize(source, name = enhancedName, initialState) {
  const mode = CodeMirror.getMode(config, name);
  const state = initialState || CodeMirror.startState(mode);
  const tokens = [];
  const indents = [];
  for (const [line, text] of source.split('\n').entries()) {
    indents.push(mode.indent(state, text.trimStart()));
    const stream = new CodeMirror.StringStream(text, 4);
    if (!text) mode.blankLine?.(state);
    while (!stream.eol()) {
      const start = stream.pos;
      const style = mode.token(stream, state);
      assert.ok(stream.pos > start, 'tokenizer must always advance');
      tokens.push({ text: stream.current(), style, line });
      stream.start = stream.pos;
    }
  }
  return { tokens, indents, state, mode };
}
const source = `from typing import List, Optional
@cache
@tools.装饰器(maxsize=128)
class Solution:
    def 查找(self, nums: List[int]) -> Optional[TreeNode]:
        """node.append() List[int]
        # a multiline string, not a comment or function
        """
        node.value = 查找(nums)
        node.append(nums[0])
        print(f"result: {查找(node.value)} {len(nums)}")
        text = "fake() # Optional"
        raw = r'node.method()'
        escaped = "quote: \\\" f()"
        # fake() self List[int]
        return self.visit(node)

class 节点:
    pass`;
const actual = tokenize(source);
const baseline = tokenize(source, 'python');
assert.deepEqual(actual.tokens.map(({ text, line }) => ({ text, line })), baseline.tokens.map(({ text, line }) => ({ text, line })), 'enhancement must preserve base token boundaries');
assert.deepEqual(actual.indents, baseline.indents, 'Python autoindent is unchanged');
for (let i = 0; i < baseline.tokens.length; i++) {
  for (const style of (baseline.tokens[i].style || '').split(/\s+/).filter(Boolean)) {
    assert.ok((actual.tokens[i].style || '').split(/\s+/).includes(style), `base ${style} must survive on ${baseline.tokens[i].text}`);
  }
  if (/string|comment/.test(baseline.tokens[i].style || '')) assert.equal(actual.tokens[i].style, baseline.tokens[i].style, 'never add semantic colors inside strings or comments');
}
function has(text, style, line) {
  assert.ok(actual.tokens.some(token => token.text === text && (line === undefined || token.line === line) && (token.style || '').split(/\s+/).includes(style)), `${text} should be ${style} at line ${line ?? '*'}`);
}
has('cache', 'decorator');
has('装饰器', 'decorator');
has('Solution', 'type');
has('节点', 'type');
has('查找', 'function', 4);
has('查找', 'function', 8);
has('查找', 'function', 10);
has('List', 'type');
has('int', 'type');
has('TreeNode', 'type');
has('value', 'property');
has('append', 'function');
has('self', 'self');
has('len', 'function');
assert.equal(actual.tokens.find(token => token.text === 'maxsize')?.style, 'variable', 'decorator arguments are not decorator names');

// Copying state must retain multiline string context without sharing changes.
const partial = tokenize('value = """first line');
const copied = CodeMirror.copyState(partial.mode, partial.state);
const ending = tokenize('still fake()\n"""\nreal_call()', enhancedName, copied);
assert.equal(ending.tokens.find(token => token.text === 'still fake()')?.style, 'string');
assert.ok(ending.tokens.find(token => token.text === 'real_call')?.style.includes('function'));
const continued = tokenize('another fake()', enhancedName, partial.state);
assert.equal(continued.tokens[0].style, 'string', 'copied state cannot terminate the original string');
const fstring = tokenize('message = f"""literal call()\n{worker.run(value)}\nmore text"""');
assert.equal(fstring.tokens.find(token => token.text.includes('literal call()'))?.style, 'string');
assert.ok(fstring.tokens.find(token => token.text === 'run')?.style.includes('function'));

function editor(text, cursors, options = {}) {
  const doc = new CodeMirror.Doc(text);
  const settings = { ...config, readOnly: false, ...options };
  doc.getOption = name => settings[name];
  doc.operation = operation => operation();
  doc.setSelections(cursors.map(cursor => Array.isArray(cursor) ? { anchor: cursor[0], head: cursor[1] } : { anchor: cursor, head: cursor }));
  return doc;
}
const pos = (line, ch) => ({ line, ch });
const cursor = doc => { const { line, ch } = doc.getCursor(); return { line, ch }; };
let doc = editor('        ', [pos(0, 8)]);
smartIndentBackspace(doc, CodeMirror);
assert.equal(doc.getValue(), '    ');
assert.deepEqual(cursor(doc), pos(0, 4));
smartIndentBackspace(doc, CodeMirror);
assert.equal(doc.getValue(), '');
assert.deepEqual(cursor(doc), pos(0, 0));
assert.equal(smartIndentBackspace(doc, CodeMirror), CodeMirror.Pass, 'column zero keeps normal line-joining Backspace');
doc = editor('      body', [pos(0, 6)]);
smartIndentBackspace(doc, CodeMirror);
assert.equal(doc.getValue(), '    body', 'partial indentation returns to previous tab stop');
doc = editor('\t  body', [pos(0, 3)]);
smartIndentBackspace(doc, CodeMirror);
assert.equal(doc.getValue(), '\tbody');
doc = editor('\tbody', [pos(0, 1)], { tabSize: 8 });
smartIndentBackspace(doc, CodeMirror);
assert.equal(doc.getValue(), '    body', 'tab crossing a 4-column boundary preserves the target visual column');
doc = editor('  \t  body', [pos(0, 5)]);
smartIndentBackspace(doc, CodeMirror);
assert.equal(doc.getValue(), '  \tbody');
doc = editor('    one\n        two', [pos(0, 4), pos(1, 8)]);
smartIndentBackspace(doc, CodeMirror);
assert.equal(doc.getValue(), 'one\n    two', 'multiple cursors remove one indentation level each');
const beforeUndo=doc.getValue();
doc.undo();
assert.equal(doc.getValue(), '    one\n        two', 'indent deletion undoes together');
doc.redo();
assert.equal(doc.getValue(), beforeUndo);
assert.deepEqual(Array.from(doc.listSelections(), range => ({ line: range.head.line, ch: range.head.ch })), [pos(0, 0), pos(1, 4)]);
doc = editor('        ', [pos(0, 4), pos(0, 8)]);
smartIndentBackspace(doc, CodeMirror);
assert.equal(doc.getValue(), '', 'adjacent deletion ranges on one line are safe');
for (const [text, selections, options] of [
  ['        ', [pos(0, 6), pos(0, 8)]],
  ['    a', [pos(0, 5)]],
  ['    a\n    ', [pos(0, 5), pos(1, 4)]],
  ['    a', [[pos(0, 0), pos(0, 4)]]],
  ['    a\n    b', [[pos(0, 0), pos(1, 4)]]],
  ['    ', [pos(0, 4)], { readOnly: true }],
  ['    ', [pos(0, 4)], { readOnly: 'nocursor' }]
]) {
  doc = editor(text, selections, options);
  const beforeSelections = JSON.stringify(doc.listSelections());
  assert.equal(smartIndentBackspace(doc, CodeMirror), CodeMirror.Pass, 'ordinary deletion and complex selections fall back atomically');
  assert.equal(doc.getValue(), text);
  assert.equal(JSON.stringify(doc.listSelections()), beforeSelections);
}
console.log('Editor checks passed: Python tokenizer state, semantic colors, f-strings, Unicode, indentation, tabs and multiple cursors.');
