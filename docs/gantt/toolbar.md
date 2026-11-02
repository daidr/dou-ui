# 工具栏

甘特图不内置工具栏，ref 上的方法可以配合 [Toolbar](/components/toolbar) 自己组合。

## 基础用法

通过 ref 拿到组件实例，把按钮接到它的方法上。下面的例子放了撤销、重做、缩放、显示全部任务和回到今天：

<DocDemo src="gantt/toolbar" column />

常用的方法：

- `undo()`、`redo()` 撤销、重做，`canUndo`、`canRedo` 控制按钮状态；
- `schedule()` 按依赖[重新排期](./scheduling#重新排期)；
- `zoomIn()`、`zoomOut()` 缩放，`fit()` 显示全部任务；
- `scrollToToday()` 滚动到今天。

导出、打印的按钮见[导出与打印](./export)。

## API

### 相关 Exposes

| 名称                  | 说明                                           | 类型                                              |
| --------------------- | ---------------------------------------------- | ------------------------------------------------- |
| `undo` / `redo`       | 撤销、重做                                     | `() => boolean`                                   |
| `canUndo` / `canRedo` | 能否撤销、重做                                 | `boolean`                                         |
| `schedule`            | 按依赖重新排期，算作一步撤销                   | `(options?: { pull?: boolean }) => GanttSchedule` |
| `zoomIn` / `zoomOut`  | 放大、缩小时间轴                               | `() => void`                                      |
| `fit`                 | 选一个能放下全部任务的日宽，并滚动到第一个任务 | `() => void`                                      |
| `scrollToToday`       | 滚动到现在                                     | `() => void`                                      |
