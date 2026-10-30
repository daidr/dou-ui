---
wide: true
---

# 文件管理

文件管理页：左侧是文件夹目录树，右侧按列表或网格显示当前文件夹的内容，可以上传、新建文件夹、重命名、移动和删除。

<DocDemo src="blocks/files" column />

用到的组件：[Tree](../components/tree)、[Breadcrumb](../components/breadcrumb)、[ToggleGroup](../components/toggle)、[Table](../components/table)、[Editable](../components/editable)、[ContextMenu](../components/context-menu)、[Dropdown](../components/dropdown)、[Upload](../components/upload)、[Checkbox](../components/checkbox)、[Drawer](../components/drawer)、[Dialog](../components/dialog)、[Toast](../components/toast)。

- 数据是扁平的列表，每一项用 `parent` 指向所在的文件夹；目录树和面包屑都由它算出。
- 单击或双击文件夹打开；选中一项后按 `F2`，或在菜单里选“重命名”，名称就地变成输入框，同一文件夹里不能重名。
- 在文件上点右键会先选中它，再显示针对它的菜单；在空白处点右键则是“新建文件夹”和“上传文件”。选中多项时可以一起移动或删除，文件夹不能移到自己里面。
- 把文件拖进右侧区域会显示放置提示，松开后上传到当前文件夹。按钮上传用的是 `DouUpload`，关闭了自动上传和文件列表，选中的文件由页面自己处理。
- 宽度小于 640px 时，目录树收进左侧抽屉（可以向左滑动关闭），默认改为网格视图。
