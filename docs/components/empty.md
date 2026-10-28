# Empty 空状态

填在"还什么都没有"的地方：一个放在凹进小方块里的线条图标，一句简短的标题，必要时给出下一步。不用插画——空状态应该平静，而不是讨巧。

## 基础用法

<div class="demo demo--column">
  <DouEmpty />
</div>

不传标题和说明时，标题取语言包里的"暂无数据"。

## 标题、说明与操作

<div class="demo demo--column">
  <DouEmpty title="还没有项目" description="项目是部署的基本单位。从一个 Git 仓库导入，或从模板开始。">
    <DouButton variant="outline" size="sm">从模板开始</DouButton>
    <DouButton size="sm">导入仓库</DouButton>
  </DouEmpty>
</div>

```vue
<DouEmpty title="还没有项目" description="从一个 Git 仓库导入，或从模板开始。">
  <DouButton variant="outline" size="sm">从模板开始</DouButton>
  <DouButton size="sm">导入仓库</DouButton>
</DouEmpty>
```

## 紧凑尺寸

`size="sm"` 用在表格、列表、菜单里面。

<div class="demo demo--column">
  <DouEmpty size="sm" description="没有符合筛选条件的记录" />
</div>

## API

### Props

| 名称          | 说明                                         | 类型           | 默认值 |
| ------------- | -------------------------------------------- | -------------- | ------ |
| `title`       | 标题；与说明都不传时取语言包的"暂无数据"     | `string`       | —      |
| `description` | 说明为什么是空的，或接下来该做什么           | `string`       | —      |
| `size`        | `sm` 用在表格、列表里，`md` 用在整页或卡片里 | `'sm' \| 'md'` | `'md'` |

### Slots

| 名称          | 说明           |
| ------------- | -------------- |
| `default`     | 文字下方的操作 |
| `icon`        | 替换图标       |
| `title`       | 替换标题       |
| `description` | 替换说明       |
