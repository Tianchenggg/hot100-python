# Sources

The problem statements, ACM input/output descriptions, examples, test cases,
core-mode metadata, and Python class templates
were adapted from [Hubert-hwk/hot100-judge](https://github.com/Hubert-hwk/hot100-judge),
commit `b9fda30362e5bad229cad8dede99ab6c1fd0609c`.

The dataset contains the original Hot 100 plus 3 Hot 20 extensions, with 543 ACM
test cases and 547 LeetCode-mode test cases. It excludes company metadata and reference solutions. Each problem retains
its original LeetCode source link.

On 2026-10-04, all 100 problems were checked against official LeetCode problem
content, constraints, and method metadata. Concise input constraints were added;
incorrect tree examples, array-length formats, output-order restrictions, and
out-of-domain fixtures were corrected. Additional boundary cases were included.
See [the problem audit](docs/problem-audit.md) for the per-problem record and
[source fingerprints](docs/problem-audit-sources.json) for official links,
metadata, and content hashes. Full official statements are not redistributed.

On 2026-10-11, stock problems II (122), III (123), and IV (188) were added to the
user-supplied Hot 20 list. This list has 23 individual problems; 20 are in the
original Hot 100. Their concise statements, constraints, examples, and independent
boundary tests are maintained in `scripts/hot20-extra-problems.json`, with official
source URLs. All data generators include these extensions.

The 17 knowledge groups and navigation order in `dist/data/groups.js` follow
the user-provided `LeetCode_Hot_100_纯题目背诵版.md`. The recitation list in
`dist/data/recitation.json` reproduces its 100 problem titles, difficulty labels,
and short task descriptions in the same order. Three additional stock problems
follow problem 121. Input/output formats and examples use the same ACM data as the
practice page. The list contains no solutions. The source document itself is not distributed.

To regenerate the recitation list from the supplied Markdown and ACM data:

```sh
python3 scripts/prepare-recitation.py /path/to/recitation.md dist/data/recitation.json --groups dist/data/groups.js
```

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
