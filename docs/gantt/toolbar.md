# 工具栏

甘特图不内置工具栏，ref 上的方法可以配合 [Toolbar](/components/toolbar) 自己组合。

## 基础用法

<DocDemo src="gantt/toolbar" column />

常用的方法：

- `undo()`、`redo()` 撤销、重做，`canUndo`、`canRedo` 控制按钮状态；
- `schedule()` 按依赖[重新排期](./scheduling#重新排期)；
- `zoomIn()`、`zoomOut()` 缩放，`fit()` 显示全部任务；
- `scrollToToday()` 滚动到今天。

导出、打印的按钮见[导出与打印](./export)。
