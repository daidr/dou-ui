# 绘制规范

`dou-icons` 的每个图标都按同一组规则手工绘制，保证放在一起时粗细、留白和气质一致。新增图标时请遵守下面的约定。

## 网格与线条

- 画布 `16 × 16`，与 DouUI 组件内部使用的图标同一网格。
- 线宽 `1.5`，圆头（`round` cap）、圆角（`round` join）。
- 主体落在 `2 ~ 14` 的范围内，四周至少留出约 1 个单位，加上线宽后外缘不超过 `1 ~ 15`。
- 坐标尽量取 `0.25` 的整数倍；完整的圆形外框统一用 `r = 6.25`，与提示类图标对齐。
- 只用线条表达。点（如“更多”里的三个点）用长度近似为 0 的线段画出，粗细随线宽变化。
- 不写颜色、填充和线宽：这些都由根元素统一给出，跟随 `currentColor` 与 `stroke-width`。

## 气质

与 DouUI 的视觉语言一致：克制、中性、几何化。

- 用最少的笔画表达含义，不加装饰细节、不用透视与阴影。
- 同一概念的家族（例如 `info` / `check-circle` / `x-circle`）共用外形，只换内部符号。
- 方向类图标（箭头、折角）共用同一套箭头头部的角度与长度。

## 文件结构

每个图标由同名的两个文件组成，放在 `packages/icons/icons/`：

```
icons/
  search.json         元信息
  search.stroke.svg   线性变体
```

`search.json` 描述元信息：

```json
{
  "label": "搜索",
  "categories": ["actions"]
}
```

`search.stroke.svg` 是可以直接预览的完整 SVG，根元素的属性固定，内部只放 `path`、`circle`、`ellipse`、`rect`、`line`、`polyline`、`polygon`，且只写几何属性：

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
  <circle cx="7" cy="7" r="4.5" />
  <path d="m10.25 10.25 3.25 3.25" />
</svg>
```

`bun run gen` 会校验所有文件（根属性、允许的元素与属性、标签与分类），再为每个图标生成一个组件模块、导出入口与元信息。校验不通过时会列出具体文件与原因。

## 分类

| 键              | 名称 |
| --------------- | ---- |
| `arrows`        | 箭头 |
| `actions`       | 操作 |
| `status`        | 状态 |
| `interface`     | 界面 |
| `files`         | 文件 |
| `communication` | 通讯 |
| `people`        | 人物 |
| `media`         | 媒体 |
| `time`          | 时间 |
| `objects`       | 物品 |
| `devices`       | 设备 |
| `development`   | 开发 |
| `maps`          | 地图 |
| `weather`       | 天气 |

一个图标可以属于多个分类。需要新分类时，在 `packages/icons/src/categories.ts` 里补充。

## 变体

目前只提供线性变体（`stroke`）。后续增加其他变体时，同一个图标会多一个 `<name>.<variant>.svg` 文件，组件名带上变体后缀，元信息里的 `variant` 区分它们；现有的线性图标名称保持不变。
