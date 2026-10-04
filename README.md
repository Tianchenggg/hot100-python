<div align="center">

# Hot 100

专注题目、代码与结果的 Python 在线刷题台。

[![Python 3](https://img.shields.io/badge/Python-3-3776AB?style=flat-square&logo=python&logoColor=white)](https://www.python.org/)
![ACM](https://img.shields.io/badge/Mode-ACM-52525B?style=flat-square)
[![Browser runtime](https://img.shields.io/badge/Runtime-Browser-52525B?style=flat-square)](https://pyodide.org/)
[![ChatGPT Sites](https://img.shields.io/badge/Hosted_on-ChatGPT_Sites-18181B?style=flat-square)](https://hot100-python.htcafasfadf.chatgpt.site)
[![MIT License](https://img.shields.io/badge/License-MIT-52525B?style=flat-square)](LICENSE)

**[开始刷题 ↗](https://hot100-python.htcafasfadf.chatgpt.site)**

100 道题 · 478 个测试用例 · 无需安装

</div>

[![Hot 100 网站预览](docs/preview.jpg)](https://hot100-python.htcafasfadf.chatgpt.site)

## 功能

- **Python · ACM** — 阅读题面，编写完整程序，使用标准输入输出。
- **手动运行与提交** — 点击后执行代码；输入过程中不运行或检查语法。
- **调试与判题** — 自定义输入，查看期望与实际输出，定位报错行。
- **自动保存** — 代码与通过状态保存在当前浏览器，各访客互不影响。

网站托管在 ChatGPT Sites。Python 在访问者的浏览器中执行，无需本地 Python 或常驻电脑；首次运行会加载运行时。

<details>
<summary><strong>源码与开发</strong></summary>

`dist/` 是可部署的静态网站。交互使用原生 JavaScript 与 CodeMirror 5，执行层使用 Pyodide 0.27.7，在独立 Web Worker 中运行 Python。单次执行限时 5 秒，输出上限 64 KiB，支持中止。

| 文件 | 用途 |
| --- | --- |
| `dist/app.js` | 页面交互与本地保存 |
| `dist/runner.js` · `dist/python-worker.js` | Python 执行与输入输出 |
| `dist/checker.js` | 输出比较 |
| `dist/data/problems.json` | 题面与测试数据 |

```sh
npm install
npm test
npm run check
```

GitHub 保存源码，线上网站由 Sites 托管。`.openai/hosting.json` 记录当前 Sites 项目；发布到新 Site 时需使用自己的项目标识。

</details>

## 来源与许可

题库、测试数据及部分比较规则改编自 [Hubert-hwk/hot100-judge](https://github.com/Hubert-hwk/hot100-judge)，保留原 [MIT 许可与版权声明](LICENSE)。完整来源见 [SOURCES.md](SOURCES.md)。编辑器与执行环境分别使用 [CodeMirror](https://codemirror.net/5/) 和 [Pyodide](https://pyodide.org/)。

测试集不等同于 LeetCode 官方完整测试集。用例在前端公开，运行耗时取决于设备，适合日常练习，不用于可信比赛成绩。
