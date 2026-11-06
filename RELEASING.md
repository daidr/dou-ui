# 发布流程

所有包使用同一个版本号，由 GitHub Actions 构建并发布到 npm，带透明度证明（provenance）。本地不发布。

## 通道

| 通道   | 版本号          | npm 标签 | 从哪里发                |
| ------ | --------------- | -------- | ----------------------- |
| 正式版 | `x.y.z`         | `latest` | `main` 或 `release/x.y` |
| 测试版 | `x.y.z-beta.n`  | `beta`   | `main`                  |
| 预览版 | `x.y.z-alpha.n` | `alpha`  | `main`                  |

标签由版本号决定，不能手填。版本只能前进：同一个 `x.y.z` 按 alpha → beta → 正式版推进。

`main` 不对应任何发布版本：它的版本号停在上一次发布，只有发版提交会改。文档的正式版站点 ui.daidr.me 部署自 `stable` 分支，`stable` 只由发版工作流在正式版发布后移动；next.ui.daidr.me 部署自 `main`。

## 预览版：合并发版 PR

「Release PR」工作流一直维护着一个「release: vX.Y.Z-alpha.N」PR（分支 `release-pr/next`）：

- `main` 每次更新，它都在最新的 `main` 上重新生成这个 PR：取当前预发布线的下一个号（`0.1.0-alpha.7` → `0.1.0-alpha.8`，`beta` 同理；当前是正式版 `x.y.z` 时从 `x.(y+1).0-alpha.0` 开始），改好版本号、bun.lock 和 CHANGELOG.md，强制推送到同一个分支，更新同一个 PR 的标题和说明。PR 里的手动修改会被覆盖，要改更新日志就改 `.changes/` 里的文件。
- `.changes/` 里没有待发布的改动时不开 PR，已经开着的会被关掉。
- 想发预览版时合并它，「Release」随即发布；不合并就什么都不发生，改动继续累积。PR 说明里写着它基于的 `main` 提交和那时的 CI 结论，合并前确认 CI 已通过。
- 上一版还在发布（tag 还没打）时它会等着；「Release」跑完后它自己再运行一次，开出下一版的 PR。

这个 PR 由 github-actions[bot] 推送，GitHub 会要求在 PR 页面点 Approve and run workflows，必需检查才会运行。CI 对 `release-pr/` 分支会跳过检查和基准测试（这些代码在 `main` 上已经检查过，「Release」发布前还会再构建、打包、演练一遍），被跳过的 job 在必需检查里算通过；Changelog 检查对发版 PR 改为检查它只改了版本号、bun.lock、CHANGELOG.md 和 `.changes/`，并且基于当前的 `main`，否则失败：发版 PR 不经过 CI，不能夹带代码。

要进入 beta 或发正式版，按下一节手动发一次；之后「Release PR」会接着这个号往下走。两个发版 PR 同时开着时，合并其中一个，另一个的版本号就过时了：预览版的 PR 会自动重新生成，手动准备的 PR 要关掉重新准备。

## 手动发一个版本

正式版和 beta 的第一个版本用这个流程。

1. 在 Actions 里运行「Prepare release」，填版本号。它会改好所有包的版本号（连同 bun.lock）、把 `.changes/` 汇总进 CHANGELOG.md，跑完检查和构建，然后开一个「release: vX.Y.Z」PR。

   和预览版的 PR 一样，可能要先点一次 Approve and run workflows。

2. 看一遍 PR 里的更新日志，需要的话直接在 PR 里改 CHANGELOG.md，然后合并。
3. 合并就是确认。合并后「Release」工作流在 GitHub 托管的机器上构建、打包并演练发布，然后依次发布所有包、打 tag、创建 GitHub Release；正式版还会把 `stable` 移到这个提交。

发布后它还会移动 dist-tag：正式版把落后的 `beta`、`alpha` 指到这个版本；某个包还没有正式版时，`latest` 跟着最新的预发布版本走（npm 只在包第一次发布时自动设置 `latest`）。移动失败不会让工作流变红，但运行的摘要页会出现“dist-tag 未移动”的警告，按里面列出的命令在本地手动运行即可，例如：

```sh
npm dist-tag add @dou-ui/sheet@0.2.0 beta
```

某个包发布失败时，修好问题后在原来那次运行里点 Re-run failed jobs，已经发布的包会被跳过。不要在 Actions 里点 Run workflow 重发：它用的是分支当前的提交，如果发版提交之后又合并了别的 PR，工作流会报“不是发版提交”并停止。npm 上的版本号发出去就不能再用；发错了只能再发一个新版本，并用 `npm deprecate` 标记错的那个。

## 维护旧版本

`main` 已经有了下一个次版本的不兼容改动、而旧版本需要修复时：

1. 从旧版本的 tag 拉出维护分支：`git switch -c release/0.2 v0.2.0 && git push -u origin release/0.2`。
2. 修复先合进 `main`，再 cherry-pick 到 `release/0.2`，连同它的 `.changes/` 文件。
3. 在 `release/0.2` 上运行「Prepare release」发 `0.2.1`。如果它比 npm 上的 `latest` 旧，会以 `latest-0.2` 标签发布，不影响 `latest` 和 `stable`。
4. 把 `release/0.2` 上 CHANGELOG.md 新增的一节同步回 `main`，并删掉 `main` 上已经发过的 `.changes/` 文件。

## 本地命令

```sh
bun run release <版本号>          # 发版 PR 里做的事：改版本号（连同 bun.lock）、汇总更新日志
bun run release:pack               # 构建后打包并检查 tarball（写到 .release/）
bun run release:publish --dry-run  # 演练发布
bun run changelog preview          # 看待发布的改动
```

## 一次性设置

按下面的顺序做。`npm` 环境一定要在第一次运行「Release」之前建好并限制好分支：工作流引用了一个不存在的环境时，GitHub 会自动建出一个不限分支的同名环境。

### GitHub

1. 仓库公开。npm 不为私有仓库生成透明度证明，`--provenance` 会让发布直接失败。
2. Settings → Actions → General：
   - Fork pull request workflows from outside collaborators 选 Require approval for all external contributors。工作流里自托管 runner 上的 job 本来就跳过 fork 的 PR，这一项是第二道保险。
   - Workflow permissions 勾选 Allow GitHub Actions to create and approve pull requests，「Prepare release」要开 PR。
3. Settings → Environments 新建 `npm`：不设 Required reviewers；Deployment branches and tags 只允许 `main` 与 `release/*`。npm 的可信发布绑定这个环境名，不要改名。
4. Settings → Rules → Rulesets：保护 `v*` tag 与 `stable` 分支，禁止删除和强推，只允许 GitHub Actions 绕过。再为 `release/**` 建一条规则，限制创建和更新（Restrict creations / Restrict updates），只允许仓库管理员绕过：发布不再需要批准，往这些分支推一个改了版本号的提交就会直接发布。
5. 新建标签「无需记录」，给不需要改动说明的 PR 用。

### npm

1. 在 npmjs.com 创建组织 `dou-ui`（公开包免费），`@dou-ui/*` 都发布在这个作用域下。账号开启 2FA。
2. 首次发布前，npm 上还没有这些包，无法配置可信发布，所以首个版本用一个短期 token 发：
   - 在 npmjs.com 创建 Granular Access Token：Packages and scopes 选 **All packages** 的 Read and write（`dou-ui` 这个包还不存在，没法单独选，只选组织会在发布它时失败），勾选 **Bypass two-factor authentication**（否则发布会被 2FA 拦下），有效期选最短（如 1 天）。
   - 把它存成 `npm` 环境的 secret `NPM_TOKEN`（Settings → Environments → npm → Environment secrets）。
   - 照常走「发一个版本」的流程。工作流仍在 GitHub 托管的机器上发布，并带透明度证明。
3. 首个版本发布成功后：
   - 本地运行 `bun run release:trust`（需要 npm 11.15 或更新），给所有包配置可信发布：仓库 `daidr/dou-ui`、工作流 `release.yml`、环境 `npm`。
   - 在 npmjs.com 每个包的 Settings → Trusted publishing 里，给这条配置打开 Allow npm dist-tag（默认关闭，命令行暂时不能设置），发布后移动 dist-tag 要用到。没打开时工作流会给出警告和手动命令。
   - 删除 `npm` 环境里的 `NPM_TOKEN`，并在 npmjs.com 撤销这个 token。之后的版本都用可信发布，不再需要 token。
   - 每个包的 Settings → Publishing access 选 Require two-factor authentication and disallow tokens。

### Vercel 与 DNS

- Settings → Domains 添加 `next.ui.daidr.me`。生产分支还是 `main` 时，Vercel 不允许把它挂到预览环境，所以先把它也连到 Production，和 ui.daidr.me 内容相同；在 `daidr.me` 的 DNS 加 CNAME `next.ui`，值按 Vercel 显示的填写。
- 首个正式版发布、`stable` 分支出现之后：先在 Settings → Environments → Production → Branch Tracking（旧界面在 Settings → Git → Production Branch）把生产分支改为 `stable`，再在 Settings → Domains 编辑 `next.ui.daidr.me`，改为 Preview、Git Branch 填 `main`。在那之前 ui.daidr.me 部署的是 `main`，会显示开发版横幅，这是预期的。
- 文档按 `VERCEL_GIT_COMMIT_REF` 判断自己是正式版还是开发版，不需要额外的环境变量。
