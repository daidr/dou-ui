# InfiniteScroll 滚动加载

列表滚动到底部附近时加载下一页，用于动态、评论、订单这类按页拉取的长列表。

## 基础用法

把列表放进 `DouInfiniteScroll`，`load` 返回一个 Promise，加载期间不会重复触发。数据取完后把 `finished` 设为 `true`，底部会显示"没有更多了"。

组件监听最近的滚动容器，没有时监听窗口；也可以用 `target` 指定。挂载时会先检查一次，第一页不够填满容器时会继续加载，直到填满或者 `finished`。

<DocDemo src="infinite-scroll/basic" />

## 加载失败

`load` 返回的 Promise 被拒绝时，底部显示"加载失败"和重试按钮，滚动不会再触发加载，直到重试。`error` 插槽可以替换这一行，插槽参数里有 `retry`。`immediate` 设为 `false` 时挂载后不检查，等用户滚动。

<DocDemo src="infinite-scroll/error" />

## 指令

不需要底部状态时，可以直接在滚动的元素上使用 `v-infinite-scroll`。值是加载函数，或者带 `load`、`disabled`、`distance`、`immediate` 的对象。元素自己不滚动时，指令改为监听它最近的滚动容器。

全量注册 DouUI 时指令已经注册好；按需使用时导入 `vInfiniteScroll`。

<DocDemo src="infinite-scroll/directive" />

## 读屏

底部一行带 `role="status"`，"加载中""没有更多了"会被读出；加载期间根元素带 `aria-busy="true"`。

## API

### Props

| 名称        | 说明                                                  | 类型            | 默认值         |
| ----------- | ----------------------------------------------------- | --------------- | -------------- |
| `load`      | 加载下一页；返回 Promise 时等它结束，被拒绝时显示失败 | `() => unknown` | —              |
| `finished`  | 已经没有更多数据                                      | `boolean`       | `false`        |
| `disabled`  | 暂停加载，比如切换筛选条件时                          | `boolean`       | `false`        |
| `distance`  | 离底部多近时开始加载，单位 px                         | `number`        | `100`          |
| `target`    | 滚动容器：元素、选择器、窗口或返回它们的函数          | `ScrollTarget`  | 最近的滚动容器 |
| `immediate` | 挂载后立即检查一次                                    | `boolean`       | `true`         |

### Slots

| 名称       | 说明                                        |
| ---------- | ------------------------------------------- |
| `default`  | 列表                                        |
| `loading`  | 替换加载中的提示                            |
| `finished` | 替换"没有更多了"                            |
| `error`    | 替换加载失败的提示，参数 `{ error, retry }` |

### Exposes

| 名称    | 说明                                     |
| ------- | ---------------------------------------- |
| `check` | 立即检查一次，比如整体替换了列表数据之后 |
| `retry` | 清除失败状态并重新加载                   |

### 指令

| 写法                                                          | 说明                                      |
| ------------------------------------------------------------- | ----------------------------------------- |
| `v-infinite-scroll="load"`                                    | 滚动到底部附近时调用 `load`               |
| `v-infinite-scroll="{ load, disabled, distance, immediate }"` | 同组件的同名属性；`distance` 缺省为 `100` |
