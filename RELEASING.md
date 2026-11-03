# 发布流程

所有包使用同一个版本号，由 GitHub Actions 构建并发布到 npm，带透明度证明（provenance）。本地不发布。

## 通道

| 通道   | 版本号          | npm 标签 | 从哪里发                |
| ------ | --------------- | -------- | ----------------------- |
| 正式版 | `x.y.z`         | `latest` | `main` 或 `release/x.y` |
| 测试版 | `x.y.z-beta.n`  | `beta`   | `main`                  |
| 预览版 | `x.y.z-alpha.n` | `alpha`  | `main`                  |

标签由版本号决定，不能手填。版本只能前进：同一个 `x.y.z` 按 alpha → beta → 正式版推进。

`main` 不对应任何发布版本：它的版本号停在上一次发布，只有发版 PR 会改。文档的正式版站点 ui.daidr.me 部署自 `stable` 分支，`stable` 只由发版工作流在正式版发布后移动；next.ui.daidr.me 部署自 `main`。

## 发一个版本

1. 在 Actions 里运行「Prepare release」，填版本号。它会改好所有包的版本号、把 `.changes/` 汇总进 CHANGELOG.md，跑完检查和构建，然后开一个「release: vX.Y.Z」PR。
2. 看一遍 PR 里的更新日志，需要的话直接在 PR 里改 CHANGELOG.md，然后合并。
3. 合并后「Release」工作流在 GitHub 托管的机器上构建、打包并演练发布，然后停在 `npm` 环境等待批准。在工作流页面点 Review deployments → Approve。
4. 批准后它依次发布所有包、打 tag、创建 GitHub Release；正式版还会把 `stable` 移到这个提交。

某个包发布失败时，修好问题后重新运行失败的 job 即可，已经发布的包会被跳过。npm 上的版本号发出去就不能再用；发错了只能再发一个新版本，并用 `npm deprecate` 标记错的那个。

## 维护旧版本

`main` 已经有了下一个次版本的不兼容改动、而旧版本需要修复时：

1. 从旧版本的 tag 拉出维护分支：`git switch -c release/0.2 v0.2.0 && git push -u origin release/0.2`。
2. 修复先合进 `main`，再 cherry-pick 到 `release/0.2`，连同它的 `.changes/` 文件。
3. 在 `release/0.2` 上运行「Prepare release」发 `0.2.1`。如果它比 npm 上的 `latest` 旧，会以 `latest-0.2` 标签发布，不影响 `latest` 和 `stable`。
4. 把 `release/0.2` 上 CHANGELOG.md 新增的一节同步回 `main`，并删掉 `main` 上已经发过的 `.changes/` 文件。

## 本地命令

```sh
bun run release <版本号>          # 发版 PR 里做的事：改版本号、汇总更新日志
bun run release:pack               # 构建后打包并检查 tarball（写到 .release/）
bun run release:publish --dry-run  # 演练发布
bun run changelog preview          # 看待发布的改动
```

## 一次性设置

### 首次发布

npm 上还没有这些包时无法配置可信发布，所以第一个版本在本地发布：

1. 照常运行「Prepare release」并合并发版 PR。「Release」工作流停在等待批准时先不要批准。
2. 在本地切到发版 PR 合并后的提交，`npm login`（账号开启 2FA），然后：

   ```sh
   bun install && bun run gen && bun run build
   bun run release:pack
   bun run release:publish   # 每个包会提示输入一次 2FA 验证码
   ```

3. 配置可信发布（需要 npm 11.15 或更新）：`bun run release:trust`。
4. 回到工作流页面批准。所有包都已存在，会被跳过，工作流只打 tag、建 Release。这一个版本没有透明度证明，之后的版本都有。
5. 在 npmjs.com 每个包的 Settings → Publishing access 选 Require two-factor authentication and disallow tokens。

### GitHub

- 仓库公开（npm 不为私有仓库生成透明度证明）。
- Settings → Environments 新建 `npm`：Required reviewers 加上自己；Deployment branches and tags 只允许 `main` 与 `release/*`。
- Settings → Actions → General → Workflow permissions：勾选 Allow GitHub Actions to create and approve pull requests。
- Settings → Rules → Rulesets：保护 `v*` tag 与 `stable` 分支，禁止删除和强推，只允许 GitHub Actions 绕过。
- 给仓库加一个「无需记录」标签，用于不需要改动说明的 PR。

### Vercel 与 DNS

- Settings → Domains 添加 `next.ui.daidr.me`，环境选 Preview，Git Branch 填 `main`；在 `daidr.me` 的 DNS 加 CNAME `next.ui`，值按 Vercel 显示的填写。
- 首个正式版发布、`stable` 分支出现之后：Settings → Environments → Production → Branch Tracking 改为 `stable`。在那之前 ui.daidr.me 仍然部署 `main`。
- 文档按 `VERCEL_GIT_COMMIT_REF` 判断自己是正式版还是开发版，不需要额外的环境变量。
