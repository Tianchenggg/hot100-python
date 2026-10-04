# Sources

The problem statements, ACM input/output descriptions, examples, test cases,
core-mode metadata, and Python class templates
were adapted from [Hubert-hwk/hot100-judge](https://github.com/Hubert-hwk/hot100-judge),
commit `b9fda30362e5bad229cad8dede99ab6c1fd0609c`.

The dataset contains 100 problems, 478 ACM test cases, and 481 LeetCode-mode test
cases. It excludes company metadata and reference solutions. Each problem retains
its original LeetCode source link. ACM test cases retain the supplied input and
output. The output-order wording for problems 15, 49, 131, and 347 was corrected to
allow equivalent answers instead of requiring the reference solution's order.
Full original constraints are not present in the source dataset.

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
