# Dialog 对话框

需要用户停下来处理的内容：确认一个操作、填一张小表单。页面变暗，中间是一块抬起的面板——细描边加最深的阴影；操作放在底部，用一条细线和淡淡的底色与内容分开。

浮层的通用行为见 [浮层](../guide/overlays)。

<script setup>
import { ref } from 'vue'
const basic = ref(false)
const form = ref(false)
const centered = ref(false)
const guarded = ref(false)
const email = ref('')
const confirmLeave = () => window.confirm('有未保存的修改，确定关闭？')
</script>

## 基础用法

用 `v-model:open` 控制开关。`footer` 插槽放操作，插槽参数里的 `close` 用来关闭。

<div class="demo">
  <DouButton variant="outline" @click="basic = true">删除项目</DouButton>
  <DouDialog v-model:open="basic" title="删除项目？" :width="420">
    <DouText as="p" variant="secondary">项目 dou-ui 的全部部署、域名与环境变量都会被永久删除，此操作无法撤销。</DouText>
    <template #footer="{ close }">
      <DouButton variant="outline" @click="close">取消</DouButton>
      <DouButton tone="danger" @click="close">删除</DouButton>
    </template>
  </DouDialog>
</div>

```vue
<DouButton variant="outline" @click="open = true">删除项目</DouButton>
<DouDialog v-model:open="open" title="删除项目？" :width="420">
  <DouText as="p" variant="secondary">项目 dou-ui 的全部部署……</DouText>
  <template #footer="{ close }">
    <DouButton variant="outline" @click="close">取消</DouButton>
    <DouButton tone="danger" @click="close">删除</DouButton>
  </template>
</DouDialog>
```

## 放入表单

给第一个输入框加上 `autofocus`，打开时焦点直接落在它上面；否则落在面板本身，读屏先读出标题。

<div class="demo">
  <DouButton variant="outline" @click="form = true">邀请成员</DouButton>
  <DouDialog v-model:open="form" title="邀请成员">
    <DouForm>
      <DouFormItem label="邮箱" help="成员会收到一封邀请邮件">
        <DouInput v-model="email" placeholder="name@example.com" autofocus />
      </DouFormItem>
    </DouForm>
    <template #footer="{ close }">
      <DouButton variant="outline" @click="close">取消</DouButton>
      <DouButton @click="close">发送邀请</DouButton>
    </template>
  </DouDialog>
</div>

## 垂直居中

默认面板离视口顶部 12vh，内容变化时上沿不跳动。`centered` 让它垂直居中。

<div class="demo">
  <DouButton variant="outline" @click="centered = true">居中的对话框</DouButton>
  <DouDialog v-model:open="centered" title="已复制" centered :width="360">
    <DouText as="p" variant="secondary">部署地址已复制到剪贴板。</DouText>
  </DouDialog>
</div>

## 阻止关闭

`before-close` 在关闭按钮、遮罩与 `Esc` 关闭前调用，返回 `false`（或解析为 `false` 的 Promise）则保持打开。`close-on-mask`、`close-on-escape` 可以分别关掉这两种关闭方式。

<div class="demo">
  <DouButton variant="outline" @click="guarded = true">编辑说明</DouButton>
  <DouDialog v-model:open="guarded" title="编辑说明" :before-close="confirmLeave" :close-on-mask="false">
    <DouTextarea placeholder="写点什么……" />
  </DouDialog>
</div>

```vue
<DouDialog v-model:open="open" title="编辑说明" :before-close="confirmLeave" :close-on-mask="false">
  <DouTextarea />
</DouDialog>
```

## 键盘与读屏

面板带有 `role="dialog"` 与 `aria-modal="true"`，由标题命名。打开时焦点移入面板，`Tab` 在面板内循环；`Esc` 关闭，焦点回到打开前的元素。打开期间页面不能滚动。

## API

### Props

| 名称             | 说明                                | 类型                                                | 默认值   |
| ---------------- | ----------------------------------- | --------------------------------------------------- | -------- |
| `open`           | 是否打开，配合 `v-model:open`       | `boolean`                                           | `false`  |
| `title`          | 标题，同时为对话框命名              | `string`                                            | —        |
| `width`          | 面板宽度；数字为 px                 | `string \| number`                                  | `480px`  |
| `centered`       | 垂直居中                            | `boolean`                                           | `false`  |
| `closable`       | 显示右上角的关闭按钮                | `boolean`                                           | `true`   |
| `closeOnMask`    | 点击遮罩关闭                        | `boolean`                                           | `true`   |
| `closeOnEscape`  | 按 `Esc` 关闭                       | `boolean`                                           | `true`   |
| `lockScroll`     | 打开期间锁定页面滚动                | `boolean`                                           | `true`   |
| `destroyOnClose` | 关闭后卸载内容                      | `boolean`                                           | `false`  |
| `beforeClose`    | 关闭前调用，返回 `false` 则保持打开 | `() => boolean \| void \| Promise<boolean \| void>` | —        |
| `teleport`       | 渲染到哪里；`false` 为原地渲染      | `string \| HTMLElement \| false`                    | `'body'` |

### Events

| 名称          | 说明         |
| ------------- | ------------ |
| `update:open` | 打开状态变化 |
| `open`        | 开始打开     |
| `opened`      | 打开动画结束 |
| `close`       | 开始关闭     |
| `closed`      | 关闭动画结束 |

### Slots

| 名称      | 说明                       |
| --------- | -------------------------- |
| `default` | 内容                       |
| `title`   | 标题，替代 `title`         |
| `footer`  | 底部操作；参数 `{ close }` |

### 方法

| 名称      | 说明                       |
| --------- | -------------------------- |
| `close()` | 关闭，会经过 `beforeClose` |

### CSS 变量

| 变量                   | 说明                 |
| ---------------------- | -------------------- |
| `--dou-dialog-mask`    | 遮罩颜色             |
| `--dou-dialog-bg`      | 面板底色             |
| `--dou-dialog-width`   | 默认宽度             |
| `--dou-dialog-top`     | 不居中时离顶部的距离 |
| `--dou-dialog-radius`  | 圆角                 |
| `--dou-dialog-padding` | 内边距               |
