const typeNames = new Set([
  'int', 'float', 'bool', 'str', 'bytes', 'bytearray', 'complex', 'object',
  'list', 'tuple', 'dict', 'set', 'frozenset', 'memoryview',
  'Any', 'AnyStr', 'Annotated', 'Callable', 'ClassVar', 'Concatenate', 'Final',
  'Generic', 'Hashable', 'Iterable', 'Iterator', 'Generator', 'Literal',
  'List', 'Dict', 'Tuple', 'Set', 'FrozenSet', 'Optional', 'Union', 'Type',
  'Sequence', 'MutableSequence', 'Mapping', 'MutableMapping', 'Collection',
  'Container', 'Deque', 'DefaultDict', 'NamedTuple', 'TypedDict', 'Protocol',
  'TypeVar', 'ParamSpec', 'Self', 'Never', 'NoReturn', 'TypeAlias', 'TypeGuard',
  'ListNode', 'TreeNode', 'Node'
]);

export function installPythonEnhancements(CodeMirror) {
  const name = 'hot100-python';
  if (CodeMirror.modes[name]) return name;
  CodeMirror.defineMode(name, (config, options) => {
    const base = CodeMirror.getMode(config, { ...options, name: 'python', version: 3 });
    return {
      ...base,
      startState: (...args) => ({ base: CodeMirror.startState(base, ...args), decoratorChain: false }),
      copyState: state => ({ base: CodeMirror.copyState(base, state.base), decoratorChain: state.decoratorChain }),
      innerMode: state => ({ mode: base, state: state.base }),
      indent: (state, ...args) => base.indent(state.base, ...args),
      blankLine: state => {
        state.decoratorChain = false;
        return base.blankLine?.(state.base);
      },
      token(stream, state) {
        if (stream.sol()) state.decoratorChain = false;
        const previous = state.base.lastToken;
        const style = base.token(stream, state.base);
        const token = stream.current();
        const classes = (style || '').split(/\s+/);
        if (classes.includes('string') || classes.includes('comment')) {
          state.decoratorChain = false;
          return style;
        }
        if (style === 'meta' && token === '@') state.decoratorChain = true;
        if (state.decoratorChain) {
          if (classes.some(value => ['meta', 'variable', 'builtin', 'property'].includes(value))) return `${style} decorator`;
          if (/\S/.test(token) && token !== '.') state.decoratorChain = false;
        }
        if (classes.includes('variable-2') && (token === 'self' || token === 'cls')) return `${style} self`;
        if (classes.includes('def')) return `${style} ${previous === 'class' ? 'type' : 'function'}`;
        if (classes.some(value => ['variable', 'builtin'].includes(value)) && typeNames.has(token)) return `${style} type`;
        if (classes.some(value => ['variable', 'builtin', 'property'].includes(value)) && stream.match(/^\s*\(/, false)) return `${style} function`;
        return style;
      }
    };
  });
  return name;
}

export function smartIndentBackspace(cm, CodeMirror = globalThis.CodeMirror) {
  if (cm.getOption('readOnly')) return CodeMirror.Pass;
  const unit = Math.max(1, cm.getOption('indentUnit') || 4);
  const tabSize = Math.max(1, cm.getOption('tabSize') || 4);
  const plans = [];
  for (const { anchor, head } of cm.listSelections()) {
    if (anchor.line !== head.line || anchor.ch !== head.ch || head.ch === 0) return CodeMirror.Pass;
    const prefix = cm.getLine(head.line).slice(0, head.ch);
    if (!/^[ \t]+$/.test(prefix)) return CodeMirror.Pass;
    const column = CodeMirror.countColumn(prefix, prefix.length, tabSize);
    const target = Math.floor((column - 1) / unit) * unit;
    let ch = 0;
    let keptColumn = 0;
    while (ch < prefix.length) {
      const next = prefix[ch] === '\t' ? keptColumn + tabSize - keptColumn % tabSize : keptColumn + 1;
      if (next > target) break;
      keptColumn = next;
      ch++;
    }
    plans.push({ from: { line: head.line, ch }, to: { line: head.line, ch: head.ch }, text: ' '.repeat(target - keptColumn) });
  }
  plans.sort((a, b) => a.from.line - b.from.line || a.from.ch - b.from.ch);
  for (let i = 1; i < plans.length; i++) {
    if (plans[i - 1].to.line === plans[i].from.line && plans[i - 1].to.ch > plans[i].from.ch) return CodeMirror.Pass;
  }
  cm.operation(() => {
    for (let i = plans.length - 1; i >= 0; i--) {
      const plan = plans[i];
      cm.replaceRange(plan.text, plan.from, plan.to, '+delete');
    }
  });
}
