# Hot 100

简洁的 Python 在线刷题台。100 道题，478 个 ACM 测试用例。

**网站：** https://hot100-python.htcafasfadf.chatgpt.site

- 题目、空白 Python 编辑器、运行和提交。
- 手动运行才执行代码；写代码时不做语法检查。
- 自定义输入、输出对比、错误行定位。
- 代码和通过状态保存在当前浏览器，各访客互不影响。

网站托管在 ChatGPT Sites。Python 使用 Pyodide 0.27.7 在访客浏览器的独立 Web Worker 中执行，无需本地 Python、常驻电脑或额外判题服务器。第一次运行需加载 Python 运行时；运行时资源来自固定版本的 jsDelivr CDN。

每个测试使用新的 Python 实例，执行限时 5 秒，输出限制 64 KiB，支持中止。此项目用于日常练习；前端测试用例公开，耗时随设备变化，不提供比赛级隐藏测试或可信成绩。现有测试集不等同于 LeetCode 官方完整测试集。

## 源码

`dist/` 即可部署的静态网站；`app.js` 为交互，`runner.js` / `python-worker.js` 为执行层，`checker.js` 为输出比较，`data/problems.json` 为题目和测试数据。

```sh
npm run check
npm install
npm test
```

`.openai/hosting.json` 记录当前 Sites 项目。发布到自己的新 Site 时应使用自己的项目标识。GitHub 保存源码，线上托管由 Sites 管理。

## 来源

题库、测试数据和部分比较规则基于 [Hubert-hwk/hot100-judge](https://github.com/Hubert-hwk/hot100-judge)，保留原 MIT 声明。题目来源说明见 [SOURCES.md](SOURCES.md)。编辑器使用 [CodeMirror 5](https://codemirror.net/5/)，Python 运行时使用 [Pyodide](https://pyodide.org/)。
