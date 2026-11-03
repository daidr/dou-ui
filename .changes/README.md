# 改动记录

每个改动了包的 PR 在这里加一个 Markdown 文件，说明用户能感觉到的变化。发版时 `bun run release <版本号>` 把它们汇总成 [CHANGELOG.md](../CHANGELOG.md) 的一节。不要直接改 CHANGELOG.md。

## 写法

```sh
bun run changelog add
```

按提示填写，或者直接新建文件，如 `.changes/sheet-comments.md`：

```markdown
---
type: 新增
packages: [sheet]
---

支持评论：单元格的 `comment` 指向讨论，右键菜单或 `Ctrl/⌘+Alt+M` 发起。
```

- `type`：`说明`、`不兼容`、`新增`、`改进`、`修复`、`性能` 之一。`不兼容` 要写清楚怎么迁移；`说明` 原样放在这一版的开头，适合写引言。
- `packages`：涉及的包在 `packages/` 下的目录名，可以写多个，也可以不写。
- 正文：一句话说明改了什么，写法和 CHANGELOG 里已有的条目一致。不用写 PR 号，发版时会从合并提交里取出并加上链接。
- 文件名用小写字母、数字和短横线，只要不和别的文件重名就行。

在 CI 或脚本里可以不经提问直接写入，没给的 `--packages` 当作不涉及具体的包：

```sh
bun run changelog add sheet-comments --type 新增 --packages sheet --body "支持评论。"
```

## 什么时候可以不写

改动了 `packages/*/src` 的 PR 都要有一条，CI 会检查。纯重构、只改测试这类用户感觉不到的改动，给 PR 加上「无需记录」标签即可跳过。

## 发版之后

- 预发布版本（alpha、beta）把用过的文件移到 `prerelease/`，等正式版发布时再汇总一次，所以正式版的一节包含它所有预发布版本的改动。各预发布版本自己的一节随之从 CHANGELOG.md 移除，只在正式版里留下指向它们 GitHub Release 的链接，同样的内容不会出现两次。
- 正式版发布后，这里和 `prerelease/` 都会清空。

预览下一版会生成的内容：

```sh
bun run changelog preview          # 只看待发布的改动
bun run changelog preview 0.2.0    # 按某个版本号完整生成
```
