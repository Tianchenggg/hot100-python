# 题面与测试数据核对

核对日期：2026-10-04。范围：本项目的 100 道题，以及 ACM / LeetCode 两种输入输出形式。

## 来源与方法

逐题从 LeetCode 官方公开 GraphQL 读取题号、完整题面、约束、方法元数据，并比对本项目的描述、返回值、参数、样例和测试输入。100 个题号均返回有效题面且与本项目题号一致。下表链接指向中文官网；主要比对数据来自 `https://leetcode.com/graphql`。另外从 `https://leetcode.cn/graphql/` 复核了 3、17、1143 的中文范围。

[来源指纹](problem-audit-sources.json)记录题号、官方链接、方法元数据及完整英文题面的 SHA-256，便于后续比较。仓库不复制整份官方题面，只保留简述、数据范围和必要的输入输出适配。

## 修正

- **真正错误的样例／期望值**：94 的层序输入含 4 项却写成 3，104 含 3 项却写成 2；其期望值也对应被截断后的树。修正为完整树的中序结果和深度。101 同样修正了包含 `null` 的序列长度。
- **输入格式不一致**：287 的数组长度应为 `n + 1`，部分样例却把数组长度直接写成 `n`。现已统一。所有二叉树格式明确首行表示序列项数，包含 `null`。
- **错误的限制或遗漏**：160 不保证有交点；142 不保证环中节点值唯一；438 允许答案任意排序；75 禁止调用库排序，单趟扫描属于进阶；148 的常数空间属于进阶，递归归并不能据此声称 O(1) 空间。
- **官方允许、旧格式排除的输入**：3 支持行内和首尾空格；49 在 ACM 中用 `""` 表示空字符串，同时保留重复字符串。
- **合法解被额外边界误判的风险**：将上游包含的非法空输入、25 的 `k > n`、236 的 `p = q`、39 的候选数 1 等替换为官方范围内的边界用例。LeetCode 的 283 输入曾已预先移动零，现恢复原始输入。
- 为全部 100 题补充简洁数据范围。修订 29 条 ACM、31 条 LeetCode 测试记录，另新增 6 条 ACM、7 条 LeetCode 测试；当前分别为 **484 / 488 条**。修订数包括格式和测试质量修正，不全部代表错误期望值。

## 验证

- `node scripts/problem-data-test.mjs`：100 题各有输入范围检查；488 条 LeetCode 测试通过，ACM 的树序列和 `n + 1` 长度通过。检查包含主要数值／字符／长度范围及关键前提；不是任意输入的完整形式化验证器。
- 100 题的 484 条 ACM 测试均运行了上游 Python 参考实现，并经过本项目输出比较器。唯一输入解析适配是第 3 题：用按行读取替代按空白拆词，以保留合法空格。
- 100 题的 488 条 LeetCode 测试均通过参考实现和本项目调用适配器。节点返回类型、参数类型及网格类型使用与网站一致的适配。
- 无序答案、浮点误差、节点身份与故意错误解的拒绝测试，见 `scripts/checker-test.mjs` 与 `scripts/leetcode-test.mjs`。

生成流程会先导入上游数据，再应用 `scripts/problem-corrections.json`，避免重新生成时恢复旧问题。

## 范围说明

ACM 使用文本输入输出，因此节点身份、原地修改、内存复杂度等无法仅由打印结果完整证明。例如 142 输出入口节点值，160 输出相交后缀；LeetCode 模式分别返回并检查原节点。这些是显示出来的模式适配，不声称两种模式使用完全相同的调用协议。

官方第 160 题的示例含节点值 0，但其约束文字写为节点值至少 1；本项目保留该官方示例，数据检查对此明确放行。

本项目未获得 LeetCode 的隐藏测试。参考实现通过有限测试，不代表任意提交都已被数学证明正确，也不代表覆盖了官方全部大规模或复杂度测试。题库与判题器将通过有针对性的反例继续完善。

## 逐题覆盖

下表的“已核对”指题面语义、接口、输入范围和模式适配已逐项对照；不代表已经复现官方隐藏测试。

| 题号 | 官方题面 | 核对 | 本轮处理 |
| --- | --- | --- | --- |
| 1 | [两数之和](https://leetcode.cn/problems/two-sum/) | 已核对 | 澄清题意或输入输出 |
| 2 | [两数相加](https://leetcode.cn/problems/add-two-numbers/) | 已核对 | 修正测试输入或期望值 |
| 3 | [无重复字符的最长子串](https://leetcode.cn/problems/longest-substring-without-repeating-characters/) | 已核对 | 澄清题意或输入输出；补充边界用例 |
| 4 | [寻找两个正序数组的中位数](https://leetcode.cn/problems/median-of-two-sorted-arrays/) | 已核对 | 核心语义一致 |
| 5 | [最长回文子串](https://leetcode.cn/problems/longest-palindromic-substring/) | 已核对 | 核心语义一致 |
| 11 | [盛最多水的容器](https://leetcode.cn/problems/container-with-most-water/) | 已核对 | 澄清题意或输入输出；修正测试输入或期望值 |
| 15 | [三数之和](https://leetcode.cn/problems/3sum/) | 已核对 | 修正测试输入或期望值 |
| 17 | [电话号码的字母组合](https://leetcode.cn/problems/letter-combinations-of-a-phone-number/) | 已核对 | 澄清题意或输入输出；修正测试输入或期望值 |
| 19 | [删除链表的倒数第 N 个结点](https://leetcode.cn/problems/remove-nth-node-from-end-of-list/) | 已核对 | 核心语义一致 |
| 20 | [有效的括号](https://leetcode.cn/problems/valid-parentheses/) | 已核对 | 修正测试输入或期望值 |
| 21 | [合并两个有序链表](https://leetcode.cn/problems/merge-two-sorted-lists/) | 已核对 | 核心语义一致 |
| 22 | [括号生成](https://leetcode.cn/problems/generate-parentheses/) | 已核对 | 核心语义一致 |
| 23 | [合并 K 个升序链表](https://leetcode.cn/problems/merge-k-sorted-lists/) | 已核对 | 核心语义一致 |
| 24 | [两两交换链表中的节点](https://leetcode.cn/problems/swap-nodes-in-pairs/) | 已核对 | 核心语义一致 |
| 25 | [K 个一组翻转链表](https://leetcode.cn/problems/reverse-nodes-in-k-group/) | 已核对 | 修正测试输入或期望值 |
| 31 | [下一个排列](https://leetcode.cn/problems/next-permutation/) | 已核对 | 澄清题意或输入输出 |
| 32 | [最长有效括号](https://leetcode.cn/problems/longest-valid-parentheses/) | 已核对 | 核心语义一致 |
| 33 | [搜索旋转排序数组](https://leetcode.cn/problems/search-in-rotated-sorted-array/) | 已核对 | 核心语义一致 |
| 34 | [在排序数组中查找元素的第一个和最后一个位置](https://leetcode.cn/problems/find-first-and-last-position-of-element-in-sorted-array/) | 已核对 | 核心语义一致 |
| 35 | [搜索插入位置](https://leetcode.cn/problems/search-insert-position/) | 已核对 | 核心语义一致 |
| 39 | [组合总和](https://leetcode.cn/problems/combination-sum/) | 已核对 | 修正测试输入或期望值 |
| 41 | [缺失的第一个正数](https://leetcode.cn/problems/first-missing-positive/) | 已核对 | 核心语义一致 |
| 42 | [接雨水](https://leetcode.cn/problems/trapping-rain-water/) | 已核对 | 修正测试输入或期望值 |
| 45 | [跳跃游戏 II](https://leetcode.cn/problems/jump-game-ii/) | 已核对 | 核心语义一致 |
| 46 | [全排列](https://leetcode.cn/problems/permutations/) | 已核对 | 澄清题意或输入输出；修正测试输入或期望值 |
| 48 | [旋转图像](https://leetcode.cn/problems/rotate-image/) | 已核对 | 核心语义一致 |
| 49 | [字母异位词分组](https://leetcode.cn/problems/group-anagrams/) | 已核对 | 澄清题意或输入输出；修正测试输入或期望值；补充边界用例 |
| 51 | [N 皇后](https://leetcode.cn/problems/n-queens/) | 已核对 | 核心语义一致 |
| 53 | [最大子数组和](https://leetcode.cn/problems/maximum-subarray/) | 已核对 | 核心语义一致 |
| 54 | [螺旋矩阵](https://leetcode.cn/problems/spiral-matrix/) | 已核对 | 核心语义一致 |
| 55 | [跳跃游戏](https://leetcode.cn/problems/jump-game/) | 已核对 | 核心语义一致 |
| 56 | [合并区间](https://leetcode.cn/problems/merge-intervals/) | 已核对 | 澄清题意或输入输出；修正测试输入或期望值 |
| 62 | [不同路径](https://leetcode.cn/problems/unique-paths/) | 已核对 | 核心语义一致 |
| 64 | [最小路径和](https://leetcode.cn/problems/minimum-path-sum/) | 已核对 | 核心语义一致 |
| 70 | [爬楼梯](https://leetcode.cn/problems/climbing-stairs/) | 已核对 | 核心语义一致 |
| 72 | [编辑距离](https://leetcode.cn/problems/edit-distance/) | 已核对 | 核心语义一致 |
| 73 | [矩阵置零](https://leetcode.cn/problems/set-matrix-zeroes/) | 已核对 | 核心语义一致 |
| 74 | [搜索二维矩阵](https://leetcode.cn/problems/search-a-2d-matrix/) | 已核对 | 澄清题意或输入输出 |
| 75 | [颜色分类](https://leetcode.cn/problems/sort-colors/) | 已核对 | 澄清题意或输入输出；修正测试输入或期望值 |
| 76 | [最小覆盖子串](https://leetcode.cn/problems/minimum-window-substring/) | 已核对 | 核心语义一致 |
| 78 | [子集](https://leetcode.cn/problems/subsets/) | 已核对 | 修正测试输入或期望值 |
| 79 | [单词搜索](https://leetcode.cn/problems/word-search/) | 已核对 | 核心语义一致 |
| 84 | [柱状图中最大的矩形](https://leetcode.cn/problems/largest-rectangle-in-histogram/) | 已核对 | 核心语义一致 |
| 94 | [二叉树的中序遍历](https://leetcode.cn/problems/binary-tree-inorder-traversal/) | 已核对 | 澄清题意或输入输出；修正测试输入或期望值 |
| 98 | [验证二叉搜索树](https://leetcode.cn/problems/validate-binary-search-tree/) | 已核对 | 澄清题意或输入输出 |
| 101 | [对称二叉树](https://leetcode.cn/problems/symmetric-tree/) | 已核对 | 澄清题意或输入输出；修正测试输入或期望值 |
| 102 | [二叉树的层序遍历](https://leetcode.cn/problems/binary-tree-level-order-traversal/) | 已核对 | 澄清题意或输入输出 |
| 104 | [二叉树的最大深度](https://leetcode.cn/problems/maximum-depth-of-binary-tree/) | 已核对 | 澄清题意或输入输出；修正测试输入或期望值 |
| 105 | [从前序与中序遍历序列构造二叉树](https://leetcode.cn/problems/construct-binary-tree-from-preorder-and-inorder-traversal/) | 已核对 | 澄清题意或输入输出；修正测试输入或期望值 |
| 108 | [将有序数组转换为二叉搜索树](https://leetcode.cn/problems/convert-sorted-array-to-binary-search-tree/) | 已核对 | 澄清题意或输入输出；修正测试输入或期望值 |
| 114 | [二叉树展开为链表](https://leetcode.cn/problems/flatten-binary-tree-to-linked-list/) | 已核对 | 澄清题意或输入输出 |
| 118 | [杨辉三角](https://leetcode.cn/problems/pascals-triangle/) | 已核对 | 澄清题意或输入输出 |
| 121 | [买卖股票的最佳时机](https://leetcode.cn/problems/best-time-to-buy-and-sell-stock/) | 已核对 | 核心语义一致 |
| 124 | [二叉树中的最大路径和](https://leetcode.cn/problems/binary-tree-maximum-path-sum/) | 已核对 | 澄清题意或输入输出 |
| 128 | [最长连续序列](https://leetcode.cn/problems/longest-consecutive-sequence/) | 已核对 | 核心语义一致 |
| 131 | [分割回文串](https://leetcode.cn/problems/palindrome-partitioning/) | 已核对 | 核心语义一致 |
| 136 | [只出现一次的数字](https://leetcode.cn/problems/single-number/) | 已核对 | 澄清题意或输入输出 |
| 138 | [随机链表的复制](https://leetcode.cn/problems/copy-list-with-random-pointer/) | 已核对 | 澄清题意或输入输出 |
| 139 | [单词拆分](https://leetcode.cn/problems/word-break/) | 已核对 | 核心语义一致 |
| 141 | [环形链表](https://leetcode.cn/problems/linked-list-cycle/) | 已核对 | 核心语义一致 |
| 142 | [环形链表 II](https://leetcode.cn/problems/linked-list-cycle-ii/) | 已核对 | 澄清题意或输入输出 |
| 146 | [LRU 缓存](https://leetcode.cn/problems/lru-cache/) | 已核对 | 核心语义一致 |
| 148 | [排序链表](https://leetcode.cn/problems/sort-list/) | 已核对 | 澄清题意或输入输出 |
| 152 | [乘积最大子数组](https://leetcode.cn/problems/maximum-product-subarray/) | 已核对 | 核心语义一致 |
| 153 | [寻找旋转排序数组中的最小值](https://leetcode.cn/problems/find-minimum-in-rotated-sorted-array/) | 已核对 | 核心语义一致 |
| 155 | [最小栈](https://leetcode.cn/problems/min-stack/) | 已核对 | 核心语义一致 |
| 160 | [相交链表](https://leetcode.cn/problems/intersection-of-two-linked-lists/) | 已核对 | 澄清题意或输入输出；补充边界用例 |
| 169 | [多数元素](https://leetcode.cn/problems/majority-element/) | 已核对 | 核心语义一致 |
| 189 | [轮转数组](https://leetcode.cn/problems/rotate-array/) | 已核对 | 修正测试输入或期望值 |
| 198 | [打家劫舍](https://leetcode.cn/problems/house-robber/) | 已核对 | 修正测试输入或期望值 |
| 199 | [二叉树的右视图](https://leetcode.cn/problems/binary-tree-right-side-view/) | 已核对 | 澄清题意或输入输出 |
| 200 | [岛屿数量](https://leetcode.cn/problems/number-of-islands/) | 已核对 | 修正测试输入或期望值 |
| 206 | [反转链表](https://leetcode.cn/problems/reverse-linked-list/) | 已核对 | 核心语义一致 |
| 207 | [课程表](https://leetcode.cn/problems/course-schedule/) | 已核对 | 核心语义一致 |
| 208 | [实现 Trie](https://leetcode.cn/problems/implement-trie-prefix-tree/) | 已核对 | 修正测试输入或期望值 |
| 215 | [数组中的第 K 个最大元素](https://leetcode.cn/problems/kth-largest-element-in-an-array/) | 已核对 | 核心语义一致 |
| 226 | [翻转二叉树](https://leetcode.cn/problems/invert-binary-tree/) | 已核对 | 澄清题意或输入输出 |
| 230 | [二叉搜索树中第 K 小的元素](https://leetcode.cn/problems/kth-smallest-element-in-a-bst/) | 已核对 | 澄清题意或输入输出 |
| 234 | [回文链表](https://leetcode.cn/problems/palindrome-linked-list/) | 已核对 | 修正测试输入或期望值 |
| 236 | [二叉树的最近公共祖先](https://leetcode.cn/problems/lowest-common-ancestor-of-a-binary-tree/) | 已核对 | 澄清题意或输入输出；修正测试输入或期望值 |
| 238 | [除自身以外数组的乘积](https://leetcode.cn/problems/product-of-array-except-self/) | 已核对 | 核心语义一致 |
| 239 | [滑动窗口最大值](https://leetcode.cn/problems/sliding-window-maximum/) | 已核对 | 核心语义一致 |
| 240 | [搜索二维矩阵 II](https://leetcode.cn/problems/search-a-2d-matrix-ii/) | 已核对 | 澄清题意或输入输出 |
| 279 | [完全平方数](https://leetcode.cn/problems/perfect-squares/) | 已核对 | 核心语义一致 |
| 283 | [移动零](https://leetcode.cn/problems/move-zeroes/) | 已核对 | 澄清题意或输入输出；修正测试输入或期望值 |
| 287 | [寻找重复数](https://leetcode.cn/problems/find-the-duplicate-number/) | 已核对 | 澄清题意或输入输出；修正测试输入或期望值；补充边界用例 |
| 295 | [数据流的中位数](https://leetcode.cn/problems/find-median-from-data-stream/) | 已核对 | 核心语义一致 |
| 300 | [最长递增子序列](https://leetcode.cn/problems/longest-increasing-subsequence/) | 已核对 | 修正测试输入或期望值 |
| 322 | [零钱兑换](https://leetcode.cn/problems/coin-change/) | 已核对 | 核心语义一致 |
| 347 | [前 K 个高频元素](https://leetcode.cn/problems/top-k-frequent-elements/) | 已核对 | 核心语义一致 |
| 394 | [字符串解码](https://leetcode.cn/problems/decode-string/) | 已核对 | 核心语义一致 |
| 416 | [分割等和子集](https://leetcode.cn/problems/partition-equal-subset-sum/) | 已核对 | 澄清题意或输入输出；修正测试输入或期望值 |
| 437 | [路径总和 III](https://leetcode.cn/problems/path-sum-iii/) | 已核对 | 澄清题意或输入输出 |
| 438 | [找到字符串中所有字母异位词](https://leetcode.cn/problems/find-all-anagrams-in-a-string/) | 已核对 | 澄清题意或输入输出；修正测试输入或期望值；补充边界用例 |
| 543 | [二叉树的直径](https://leetcode.cn/problems/diameter-of-binary-tree/) | 已核对 | 澄清题意或输入输出；修正测试输入或期望值 |
| 560 | [和为 K 的子数组](https://leetcode.cn/problems/subarray-sum-equals-k/) | 已核对 | 核心语义一致 |
| 739 | [每日温度](https://leetcode.cn/problems/daily-temperatures/) | 已核对 | 核心语义一致 |
| 763 | [划分字母区间](https://leetcode.cn/problems/partition-labels/) | 已核对 | 核心语义一致 |
| 994 | [腐烂的橘子](https://leetcode.cn/problems/rotting-oranges/) | 已核对 | 核心语义一致 |
| 1143 | [最长公共子序列](https://leetcode.cn/problems/longest-common-subsequence/) | 已核对 | 澄清题意或输入输出；修正测试输入或期望值 |
