# Sources

The problem statements, ACM input/output descriptions, examples, and test cases
were adapted from [Hubert-hwk/hot100-judge](https://github.com/Hubert-hwk/hot100-judge),
commit `b9fda30362e5bad229cad8dede99ab6c1fd0609c`.

The dataset contains 100 problems and 478 ACM test cases. It excludes company
metadata, reference solutions, starter code, and the original core-code mode.
Each problem retains its original LeetCode source link. Test cases were preserved
as supplied. The output-order wording for problems 15, 49, 131, and 347 was corrected
to allow equivalent answers instead of requiring the reference solution's order.
Full original constraints are not present in the source dataset.

The upstream MIT license and copyright notice are preserved in `LICENSE`.
This project is an independent adaptation and is not affiliated with LeetCode,
OpenAI, or the upstream author.

To regenerate the dataset from a local upstream checkout:

```sh
python3 scripts/prepare-data.py /path/to/hot100-judge
```
