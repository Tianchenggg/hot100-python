# Hot 100 Python

支持 ACM 与 LeetCode 双模式的 Python Hot 100 在线刷题网站。

[在线使用](https://hot100-python.htcafasfadf.chatgpt.site)

## 功能

- 100 道题，按 17 个知识点分组，支持搜索。
- 背诵模式：题目卡片、折叠样例和随机抽题。
- ACM 模式编写完整程序，LeetCode 模式使用函数或类模板。
- 一次运行全部样例与已填写的自定义用例，逐项查看输出、对比结果和报错位置。
- Python 语法高亮，可调整面板宽度；LeetCode 模式支持字号与换行设置。
- 简洁的 Codex 风格界面，自动适配系统深浅模式。
- 自动保存代码与通过进度。只在点击运行或提交时执行代码。

## 记录保存

代码、自定义用例、通过进度和界面设置保存在当前浏览器，ACM 与 LeetCode 的代码分别保存。关闭网页后，在同一浏览器重新打开网站即可继续。

不跨设备同步，不保留每次提交的历史版本。清除网站数据或结束无痕会话可能丢失记录。

## 本地开发

使用原生 JavaScript、CodeMirror 和 Pyodide，线上由 ChatGPT Sites 托管。

```sh
npm ci
npm run check
npm test
python3 -m http.server 8000 --directory dist
```

打开 `http://localhost:8000`。

## 题库与判题

本项目是独立练习判题器，测试集不等同于 LeetCode 官方隐藏测试集。

[题库核查](docs/problem-audit.md) · [判题说明](docs/judge-audit.md) · [性能测试](docs/performance.md)

## 来源与许可

改编自 [Hubert-hwk/hot100-judge](https://github.com/Hubert-hwk/hot100-judge)，保留 MIT 许可与版权声明。详见 [LICENSE](LICENSE) 和 [SOURCES.md](SOURCES.md)。

本项目与 LeetCode、OpenAI 及上游作者不存在官方隶属关系。
