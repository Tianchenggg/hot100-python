# Sources

The problem statements, ACM input/output descriptions, examples, test cases,
core-mode metadata, and Python class templates
were adapted from [Hubert-hwk/hot100-judge](https://github.com/Hubert-hwk/hot100-judge),
commit `b9fda30362e5bad229cad8dede99ab6c1fd0609c`.

The dataset contains 100 problems, 484 ACM test cases, and 488 LeetCode-mode test
cases. It excludes company metadata and reference solutions. Each problem retains
its original LeetCode source link.

On 2026-10-04, all 100 problems were checked against official LeetCode problem
content, constraints, and method metadata. Concise input constraints were added;
incorrect tree examples, array-length formats, output-order restrictions, and
out-of-domain fixtures were corrected. Additional boundary cases were included.
See [the problem audit](docs/problem-audit.md) for the per-problem record and
[source fingerprints](docs/problem-audit-sources.json) for official links,
metadata, and content hashes. Full official statements are not redistributed.

The 17 knowledge groups and navigation order in `dist/data/groups.js` follow
the user-provided `LeetCode_Hot_100_纯题目背诵版.md`. Only group names and problem
IDs are included; the document itself is not distributed.

LeetCode mode reuses the upstream `core` metadata for function signatures, argument
types, return types, in-place changes, and class operations. Function templates are
generated from that metadata; class-operation templates are adapted from the
upstream Python templates. Core test cases are converted to named JSON parameters
and normalized results for browser execution.

The Python invocation, node construction, and serialization logic in
`dist/leetcode.js` adapts the Python driver from the upstream
`judge/core-driver.js`. It runs through the site's Pyodide worker, with return
values separated from debug output. This is an independent practice judge, not
LeetCode's official execution service or complete test suite.

The upstream MIT license and copyright notice are preserved in `LICENSE`.
This project is an independent adaptation and is not affiliated with LeetCode,
OpenAI, or the upstream author.

To regenerate the dataset from a local upstream checkout:

```sh
python3 scripts/prepare-data.py /path/to/hot100-judge
node scripts/prepare-leetcode.mjs /path/to/hot100-judge
```

Both generators apply `scripts/problem-corrections.json` after importing upstream
data so that regeneration preserves the audited corrections and added cases.

## Theme marks

The Codex mark in the theme selector comes from the Codex changelog card on
[OpenAI Developers](https://developers.openai.com/). The Claude asterisk is the
standalone mark in the official [Claude website](https://claude.com/) wordmark.
They identify the two visual themes; all rights to the marks remain with their
respective owners. The site is not affiliated with OpenAI or Anthropic.
