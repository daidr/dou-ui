# Space 间距

让一组元素之间保持一致的间距。

`DouSpace` 只是一个使用 `gap` 的弹性容器，**不会给子元素再包一层**，因此子元素的样式和事件都保持原样。

## 基础用法

<div class="demo">
  <DouSpace>
    <DouButton variant="outline">取消</DouButton>
    <DouButton>确认</DouButton>
  </DouSpace>
</div>

```vue
<DouSpace>
  <DouButton variant="outline">取消</DouButton>
  <DouButton>确认</DouButton>
</DouSpace>
```

## 间距

`size` 使用间距 Token（`sm` 8px / `md` 12px / `lg` 20px），也可以传任意长度，数字按像素处理。

<div class="demo demo--column">
  <DouSpace size="sm"><DouTag>sm</DouTag><DouTag>sm</DouTag><DouTag>sm</DouTag></DouSpace>
  <DouSpace size="lg"><DouTag>lg</DouTag><DouTag>lg</DouTag><DouTag>lg</DouTag></DouSpace>
  <DouSpace :size="32"><DouTag>32</DouTag><DouTag>32</DouTag><DouTag>32</DouTag></DouSpace>
</div>

## 方向与对齐

垂直方向时，子元素默认拉伸到相同宽度。

<div class="demo">
  <DouSpace direction="vertical" style="width: 240px">
    <DouInput placeholder="邮箱" />
    <DouInput placeholder="密码" type="password" />
    <DouButton block>登录</DouButton>
  </DouSpace>
</div>

```vue
<DouSpace direction="vertical">
  <DouInput placeholder="邮箱" />
  <DouInput placeholder="密码" type="password" />
  <DouButton block>登录</DouButton>
</DouSpace>
```

## 两端分布

`block` 撑满容器，配合 `justify="between"` 做工具栏。

<div class="demo">
  <DouSpace block justify="between">
    <DouText weight="medium">3 个项目</DouText>
    <DouSpace size="sm">
      <DouButton variant="ghost" size="sm">筛选</DouButton>
      <DouButton size="sm">新建</DouButton>
    </DouSpace>
  </DouSpace>
</div>

## API

### Props

| 名称        | 说明         | 类型                                                      | 默认值                                |
| ----------- | ------------ | --------------------------------------------------------- | ------------------------------------- |
| `direction` | 方向         | `'horizontal' \| 'vertical'`                              | `'horizontal'`                        |
| `size`      | 间距         | `'sm' \| 'md' \| 'lg' \| number \| string`                | `'md'`                                |
| `align`     | 交叉轴对齐   | `'start' \| 'center' \| 'end' \| 'baseline' \| 'stretch'` | 水平时 `'center'`，垂直时 `'stretch'` |
| `justify`   | 主轴分布     | `'start' \| 'center' \| 'end' \| 'between'`               | —                                     |
| `wrap`      | 允许换行     | `boolean`                                                 | `false`                               |
| `block`     | 撑满容器宽度 | `boolean`                                                 | `false`                               |

### CSS 变量

| 变量              | 说明 |
| ----------------- | ---- |
| `--dou-space-gap` | 间距 |
