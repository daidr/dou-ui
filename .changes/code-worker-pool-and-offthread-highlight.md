---
type: 性能
packages: [code]
---

`DouCodeDiff` 支持透传 `worker`、`syncHighlightLines` 与 `syncDiffLines`（默认 `500`），超出阈值时可将 `diffText` 异步移入 Worker；`DouCodeEditor` 新增 `syncHighlightLines` 控制同步分词行数并支持视口外任务取消；Worker 协议新增扁平行级 `tokens` 模式、`remoteCodeLanguage` 与 `createShikiLanguageResolver` 支持 Shiki 离主线程高亮，内置 Worker 升级为按需懒启动的 Worker 池并导出 `createCodeWorkerPool`。
