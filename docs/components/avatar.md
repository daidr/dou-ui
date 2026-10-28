# Avatar 头像

代表一个人或一个实体：有图片时显示图片，没有图片或图片加载失败时显示名字的首字母，连名字也没有时显示一个人形图标。边缘内侧有一圈极细的描边，浅色照片放在浅色页面上也不会化开。

## 图片、首字母与图标

<div class="demo">
  <DouAvatar src="https://avatars.githubusercontent.com/u/18638914?s=96" name="daidr" />
  <DouAvatar src="/broken.png" name="Ada Lovelace" />
  <DouAvatar name="林小满" />
  <DouAvatar />
</div>

```vue
<DouAvatar src="/me.png" name="daidr" />
<DouAvatar name="Ada Lovelace" />
<!-- AL -->
<DouAvatar name="林小满" />
<!-- 林 -->
<DouAvatar />
```

拉丁字母的名字取首尾两个单词的首字母；中日韩等其他文字只取第一个字，单独一个字就足以指代一个人。

## 尺寸与形状

`size` 为 `sm`（24px）、`md`（32px）、`lg`（40px），也可以直接传像素数。`shape="square"` 用于团队、组织这类非个人实体。

<div class="demo">
  <DouAvatar size="sm" name="Ada Lovelace" />
  <DouAvatar name="Ada Lovelace" />
  <DouAvatar size="lg" name="Ada Lovelace" />
  <DouAvatar :size="56" name="Ada Lovelace" />
  <DouAvatar shape="square" name="Dou UI" />
  <DouAvatar shape="square" size="lg" name="Dou UI" />
</div>

## 头像组

`DouAvatarGroup` 让头像相互叠压，每个头像外圈有一道底色的描边把它从邻居身上"切"出来。`max` 限制显示数量，其余折叠为 `+N`。组上的 `size`、`shape` 会传给组内每个头像。

<div class="demo">
  <DouAvatarGroup :max="4">
    <DouAvatar name="Ada Lovelace" />
    <DouAvatar name="林小满" />
    <DouAvatar name="Grace Hopper" />
    <DouAvatar name="周以" />
    <DouAvatar name="Alan Turing" />
    <DouAvatar name="Linus" />
  </DouAvatarGroup>
  <DouAvatarGroup size="sm">
    <DouAvatar name="Ada" />
    <DouAvatar name="林" />
    <DouAvatar name="Grace" />
  </DouAvatarGroup>
</div>

```vue
<DouAvatarGroup :max="4">
  <DouAvatar v-for="user in users" :key="user.id" :src="user.avatar" :name="user.name" />
</DouAvatarGroup>
```

## 读屏

显示图片时，`alt`（默认取 `name`）就是它的替代文本。显示首字母或图标时，头像带 `role="img"` 并以 `name` 作为 `aria-label`；既没有图片也没有名字的头像对读屏隐藏。

## API

### Avatar Props

| 名称    | 说明                             | 类型                             | 默认值     |
| ------- | -------------------------------- | -------------------------------- | ---------- |
| `src`   | 图片地址，缺失或加载失败时回退   | `string`                         | —          |
| `alt`   | 图片的替代文本                   | `string`                         | `name`     |
| `name`  | 名字，用于首字母与读屏           | `string`                         | —          |
| `size`  | 尺寸，数字为像素；默认取所在的组 | `'sm' \| 'md' \| 'lg' \| number` | `'md'`     |
| `shape` | 形状；默认取所在的组             | `'circle' \| 'square'`           | `'circle'` |

### Avatar Slots

| 名称      | 说明                              |
| --------- | --------------------------------- |
| `default` | 替换首字母与图标，如 emoji 或标志 |

### AvatarGroup Props

| 名称    | 说明                        | 类型                             | 默认值     |
| ------- | --------------------------- | -------------------------------- | ---------- |
| `max`   | 最多显示几个，其余显示 `+N` | `number`                         | —          |
| `size`  | 组内头像的尺寸              | `'sm' \| 'md' \| 'lg' \| number` | `'md'`     |
| `shape` | 组内头像的形状              | `'circle' \| 'square'`           | `'circle'` |

### CSS 变量

| 变量                      | 说明             |
| ------------------------- | ---------------- |
| `--dou-avatar-size`       | 边长             |
| `--dou-avatar-font-size`  | 首字母字号       |
| `--dou-avatar-radius`     | 圆角             |
| `--dou-avatar-bg`         | 首字母与图标底色 |
| `--dou-avatar-fg`         | 首字母与图标颜色 |
| `--dou-avatar-group-ring` | 组内描边的颜色   |
