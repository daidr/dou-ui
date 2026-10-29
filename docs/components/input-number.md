# InputNumber 数字输入

输入数字，可以设置范围和步长。

<script setup>
import { ref } from 'vue'
const count = ref(3)
const ratio = ref(0.5)
const price = ref(99)
const memory = ref(512)
</script>

## 基础用法

<div class="demo">
  <DouInputNumber v-model="count" :min="1" :max="10" />
  <DouText variant="tertiary" size="sm">当前值：{{ count ?? 'null' }}</DouText>
</div>

```vue
<DouInputNumber v-model="count" :min="1" :max="10" />
```

清空输入框得到 `null`。到达 `min` 或 `max` 时，对应的步进键会变为禁用。

## 步长与精度

`step` 决定每次步进的量，小数步进不会出现浮点误差（`0.1 + 0.2` 得到 `0.3`）。`precision` 指定保留的小数位，输入和显示都会按它取整。

<div class="demo">
  <DouInputNumber v-model="ratio" :min="0" :max="1" :step="0.1" />
  <DouInputNumber v-model="price" :precision="2" :step="0.5" />
</div>

```vue
<DouInputNumber v-model="ratio" :min="0" :max="1" :step="0.1" />
<DouInputNumber v-model="price" :precision="2" :step="0.5" />
```

## 前缀与后缀

<div class="demo">
  <DouInputNumber v-model="memory" :min="128" :max="4096" :step="128">
    <template #suffix>MB</template>
  </DouInputNumber>
  <DouInputNumber v-model="price" :precision="2" :controls="false">
    <template #prefix>¥</template>
  </DouInputNumber>
</div>

```vue
<DouInputNumber v-model="memory" :step="128">
  <template #suffix>MB</template>
</DouInputNumber>
<DouInputNumber v-model="price" :precision="2" :controls="false">
  <template #prefix>¥</template>
</DouInputNumber>
```

`controls` 设为 `false` 时隐藏步进键，键盘步进仍然可用。

## 输入与提交

- 输入过程中，只要文字已经是一个范围内的数字，就会立刻更新 `v-model`；像 `-`、`1.` 这样尚未完成的输入会被保留，不会被打断。
- 失焦或按下 `Enter` 时提交：超出范围的值收回到 `min` / `max`，按 `precision` 取整，无法识别的文字恢复为之前的值。提交时若值有变化，触发 `change`。
- 输入法产生的全角数字和符号（如 `１２．５`）也能识别。

## 键盘与指针

| 操作                  | 行为                     |
| --------------------- | ------------------------ |
| `↑` / `↓`             | 增加 / 减少一个步长      |
| `PageUp` / `PageDown` | 增加 / 减少十个步长      |
| `Home` / `End`        | 跳到 `min` / `max`       |
| `Enter`               | 提交当前输入             |
| 按住步进键            | 先停顿片刻，然后连续步进 |

输入框带有 `role="spinbutton"` 与 `aria-valuenow`、`aria-valuemin`、`aria-valuemax`。步进键不进入 Tab 顺序（键盘直接用方向键），它们的读屏标签来自 [全局配置](./config-provider) 的语言包。

## 尺寸与状态

<div class="demo demo--column">
  <DouSpace size="sm"><DouInputNumber size="sm" :model-value="1" /><DouButton size="sm" variant="outline">应用</DouButton></DouSpace>
  <DouSpace size="sm"><DouInputNumber :model-value="1" /><DouButton variant="outline">应用</DouButton></DouSpace>
  <DouSpace size="sm"><DouInputNumber size="lg" :model-value="1" /><DouButton size="lg" variant="outline">应用</DouButton></DouSpace>
  <DouSpace size="sm">
    <DouInputNumber :model-value="5" invalid />
    <DouInputNumber :model-value="5" readonly />
    <DouInputNumber :model-value="5" disabled />
  </DouSpace>
</div>

默认宽度为 `160px`，可以用 `style` 或 `class` 覆盖。

## API

### Props

| 名称         | 说明                                  | 类型                   | 默认值      |
| ------------ | ------------------------------------- | ---------------------- | ----------- |
| `modelValue` | 绑定值，配合 `v-model`，为空时 `null` | `number \| null`       | `null`      |
| `min`        | 最小值                                | `number`               | `-Infinity` |
| `max`        | 最大值                                | `number`               | `Infinity`  |
| `step`       | 步长                                  | `number`               | `1`         |
| `precision`  | 保留的小数位                          | `number`               | —           |
| `size`       | 尺寸，默认取表单或全局配置            | `'sm' \| 'md' \| 'lg'` | `'md'`      |
| `controls`   | 显示步进键                            | `boolean`              | `true`      |
| `disabled`   | 禁用                                  | `boolean`              | `false`     |
| `readonly`   | 只读，不能输入也不能步进              | `boolean`              | `false`     |
| `invalid`    | 标记为无效                            | `boolean`              | `false`     |

其他属性（`placeholder`、`name` 等）透传给原生 `<input>`。

### Events

| 名称                | 说明                                   | 参数                                                |
| ------------------- | -------------------------------------- | --------------------------------------------------- |
| `update:modelValue` | 值变化，输入过程中也会触发             | `(value: number \| null)`                           |
| `change`            | 提交了新的值：失焦、`Enter` 或一次步进 | `(value: number \| null, oldValue: number \| null)` |

### Slots

| 名称     | 说明                     |
| -------- | ------------------------ |
| `prefix` | 数字前的内容，如货币符号 |
| `suffix` | 数字后的内容，如单位     |

### 实例方法

| 名称       | 说明           | 类型                       |
| ---------- | -------------- | -------------------------- |
| `input`    | 原生输入元素   | `HTMLInputElement \| null` |
| `focus`    | 聚焦           | `() => void`               |
| `blur`     | 失焦           | `() => void`               |
| `increase` | 增加若干个步长 | `(count?: number) => void` |
| `decrease` | 减少若干个步长 | `(count?: number) => void` |

### CSS 变量

| 变量                              | 说明         |
| --------------------------------- | ------------ |
| `--dou-input-number-height`       | 高度         |
| `--dou-input-number-padding-x`    | 水平内边距   |
| `--dou-input-number-step-width`   | 步进键宽度   |
| `--dou-input-number-bg`           | 背景色       |
| `--dou-input-number-border`       | 描边颜色     |
| `--dou-input-number-border-focus` | 聚焦描边颜色 |
| `--dou-input-number-ring`         | 聚焦光晕颜色 |
