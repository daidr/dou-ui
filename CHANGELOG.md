# 更新日志

DouUI 的所有包（`dou-ui`、`@dou-ui/theme`、`@dou-ui/icons` 以及生态系统各包）使用同一个版本号，一起发布。
版本号遵循[语义化版本](https://semver.org/lang/zh-CN/)；`1.0.0` 之前，次版本号（`0.x.0`）的变化可能包含不兼容的改动，会在「不兼容」一节单独列出。

预发布版本带 `-alpha.n` 或 `-beta.n` 后缀，分别以 npm 的 `alpha`、`beta` 标签发布；正式版以 `latest` 发布。正式版的一节汇总了它所有预发布版本的改动。

这个文件由发版脚本生成：改动先以碎片文件记在 [`.changes/`](./.changes/README.md) 里，发布时汇总到这里。

## 0.1.0-alpha.18 · 2026-11-11

### 新增

- **@dou-ui/editor、@dou-ui/flow**：文档里的白板和流程图块可以评论：全屏编辑器里右键图形或连线、点工具栏按钮或按 `Ctrl/⌘+Alt+M` 发起讨论，也可以钉在图形里的某一点。讨论和文字上的共用 `v-model:comments`、作者和 `v-model:activeComment`；在评论列表里打开白板上的讨论，或点白板预览上的讨论标记，会打开全屏编辑器并定位到图形。`getCommentAnchors()` 对这些讨论多返回 `type` 和 `target`。自定义块可以给 `defineBlock` 传 `comments` 接入同一套能力，块组件的 `updateProps` 新增 `{ history: false }`，修改不进撤销记录；`whiteboardBlock` 和 `flowBlock` 新增 `commentable` 选项。流程编辑器在窄屏上打开讨论时，卡片不再盖住被评论的图形。 ([#451](https://github.com/daidr/dou-ui/pull/451))

## 0.1.0-alpha.17 · 2026-11-11

### 新增

- **dou-ui、@dou-ui/theme**：DouChatMessage 新增 `reactable`（默认 `true`）：设为 `false` 时回应只显示、不能点，也没有“添加回应”按钮，样式、位置和悬停提示与可点的回应一致，适合自己的消息或已归档的对话。 ([#444](https://github.com/daidr/dou-ui/pull/444))

## 0.1.0-alpha.16 · 2026-11-10

### 不兼容

- **dou-ui、@dou-ui/theme**：`DouChatMessage` 的操作改为浮在消息右上角的小浮条，不再占用消息左侧或下方的位置；浮条高出消息 24px，正好是 `DouChatList` 里消息之间的间距；长消息顶部滚出去时，浮条固定在滚动区域顶部，距离可以用 `--dou-chat-message-toolbar-top` 调整。`DouChatList` 的顶部内边距相应加大 12px（`--dou-chat-list-padding-top`），给第一条消息的浮条留位置。`actions-visible` 的默认值统一为 `'hover'`：鼠标悬停、键盘焦点在消息内时显示，触屏上点一下消息显示、点别处收起。以前助手消息的操作始终显示，想保持这样，设置 `actions-visible="always"`，或在 `defaults` 里给 `DouChatMessage` 设置 `actionsVisible: 'always'`。 ([#442](https://github.com/daidr/dou-ui/pull/442))

### 新增

- **@dou-ui/icons**：新增 `SmileIcon`（笑脸）和 `SmilePlusIcon`（添加表情）。 ([#441](https://github.com/daidr/dou-ui/pull/441))
- **dou-ui、@dou-ui/theme**：`DouChatMessage` 新增回应：`reactions` 在消息下方显示表情和人数，自己回应过的一项带主题色，点击触发 `react`（参数为表情和对应的那一项），由应用加上或收回。提供 `reaction-picker` 插槽后出现“添加回应”按钮，弹出层里放什么由应用决定；还没有回应时按钮在操作里，有了回应后跟在回应末尾。`reaction` 插槽可以把表情渲染成图片。 ([#442](https://github.com/daidr/dou-ui/pull/442))

### 改进

- **@dou-ui/theme**：触屏上 Command 的每一行至少 40px 高，方便点按；流程编辑器从连线添加节点时的列表也随之变高。 ([#433](https://github.com/daidr/dou-ui/pull/433))
- **@dou-ui/editor**：`flowBlock` 的全屏编辑器左上角新增“添加节点”按钮，列出扩展里写了 `palette` 的节点类型，点击添加或拖到画布上；不传 `extensions` 时提供一种带输入和输出端口的节点。空的流程图会提示从这里开始。 ([#433](https://github.com/daidr/dou-ui/pull/433))
- **@dou-ui/chart**：柱子很多时画得更整齐：相邻柱子之间的空隙取整像素、处处一样宽，并随每根柱子占的位置变窄逐渐缩小到紧挨着，缩放时不再出现条纹或突然换样子；空隙很小时不画圆角，堆叠各段之间不留细缝。合成到同一列像素的堆叠柱各段不再互相遮盖。瀑布图和箱线图在位置很窄时同样处理。缩略图上按在哪个把手附近就拖哪个，光标也随之变化；窄的时间段按住中间可以平移；把手贴着图表边缘、外侧没有地方时，朝里多占一些。文档“大量数据”加上几百天的缺陷累计流图和一年逐小时的堆叠柱两个示例。 ([#434](https://github.com/daidr/dou-ui/pull/434))

### 修复

- **@dou-ui/pivot**：DouPivotFields 字段筛选弹层里的选项文字显示完整，此前上下部分被切掉。 ([#437](https://github.com/daidr/dou-ui/pull/437))
- **@dou-ui/theme**：DouTable 设了 `maxHeight` 时，固定列的表头格在表体滚动后不再被表体的固定列单元格盖住。 ([#439](https://github.com/daidr/dou-ui/pull/439))
- **@dou-ui/theme**：`soft` 的 DouLink 在 `leading`、`trailing` 里放 DouStatusDot、DouAvatar 时不再偏下，与 SVG 图标一样居中在文字旁。`external` 的外链箭头也改为居中，比原来略高；放文字或 emoji 时与链接文字同一基线。 ([#440](https://github.com/daidr/dou-ui/pull/440))

## 0.1.0-alpha.15 · 2026-11-10

### 不兼容

- **@dou-ui/editor**：块把手改成浮在正文左侧的圆角气泡，不再占用宽度，鼠标移到把手上才出现 `+`：`--dou-editor-gutter` 默认从 `56px`（触屏 `32px`）改为 `0`，正文从编辑器左边开始，把手放在外层容器的内边距里，放不下时移进正文。只读时不再强制为 `0`，设置的空白只读时也保留（只读时要去掉，另写 `.dou-editor.is-readonly { --dou-editor-gutter: 0px }`）；对比版本时为 `16px`。要保留原来的左侧空白：`.dou-editor { --dou-editor-gutter: 56px }`，触屏另加 `@media (pointer: coarse) { .dou-editor { --dou-editor-gutter: 32px } }`。宽表格向左滚动时，左边移到离编辑器左边 10px 处。 ([#431](https://github.com/daidr/dou-ui/pull/431))

### 新增

- **@dou-ui/editor**：块的 spec 新增 `checkProps`，`checkDocument` 用它把块类型不能使用的属性报告为 `invalid-props`；白板会报告不是流程文档的 `board` 和不是正数的 `height`。 ([#429](https://github.com/daidr/dou-ui/pull/429))
- **@dou-ui/editor**：新增 `@dou-ui/editor/flow`：`whiteboardBlock()` 在文档里放一块白板，`flowBlock()` 放自定义节点的流程图。文档里显示预览，双击、点“编辑”或选中后按 `Enter` 在全屏编辑器里绘制，撤销与文档共用历史；协同编辑时按节点和连线合并。块的 spec 新增 `mergeProps`，自定义块的列表属性也能逐项合并。 ([#429](https://github.com/daidr/dou-ui/pull/429))
- **@dou-ui/flow**：扩展的 `history` 新增可选的 `drop(group)` 与 `close()`：拖动被 `Esc` 取消、手势结束时调用，自定义撤销记录可以丢掉取消的拖动，把一次拖动合成一步。 ([#429](https://github.com/daidr/dou-ui/pull/429))

### 修复

- **@dou-ui/editor**：`v-model` 绑定的是 `ref` 时，值为对象的块属性不再在读取文档时报错。 ([#429](https://github.com/daidr/dou-ui/pull/429))
- **@dou-ui/editor**：单击图片、附件、嵌入等没有文字的块时，选中整个块（此前点击没有反应）。 ([#429](https://github.com/daidr/dou-ui/pull/429))
- **dou-ui**：`DouDropdownSub` 的子菜单面板现在带上 `DouDropdown`、`DouContextMenu` 上写的 `class`，并和外层菜单渲染到同一个地方（遵循 `teleport` 和全局配置），此前固定渲染到 `body`，在全屏元素里看不到。 ([#430](https://github.com/daidr/dou-ui/pull/430))
- **@dou-ui/editor**：格式工具栏颜色菜单里，文字颜色和背景色两个子菜单的预览现在显示对应的颜色，此前都显示成默认的文字颜色。 ([#430](https://github.com/daidr/dou-ui/pull/430))
- **@dou-ui/editor**：按 `Esc` 关掉块菜单后焦点回到正文，选中的块可以继续按 `Delete` 删除或复制；表格旁的块把手不再和表格的行把手重叠。 ([#431](https://github.com/daidr/dou-ui/pull/431))

## 0.1.0-alpha.14 · 2026-11-10

### 新增

- **dou-ui、@dou-ui/theme**：DouInput 和 DouInputNumber 的前缀、后缀里可以放 DouButton 或 DouCopyButton：按钮的高度跟随输入框尺寸，随输入框一起禁用；按钮位于最前或最后时，它的底色与输入框上、下和该侧边框的距离相同，聚焦环也落在这段距离之内。这段距离可用 `--dou-input-action-inset`、`--dou-input-number-action-inset` 调整，默认 2px。触屏上这类按钮上下方向至少有 40px 的点按范围。 ([#427](https://github.com/daidr/dou-ui/pull/427))

### 修复

- **@dou-ui/theme**：DouTooltip 的 `content` 插槽里的 DouLink 跟随提示的文字色（`tone` 不生效），浅色主题下不再是深色字落在深色底上，下划线和外链箭头也一样；`soft` 链接的底色由提示的文字色混出。DouBanner 的 `solid` 横幅里，`soft` 链接在中性横幅上同样改用由文字色混出的底色，在彩色横幅上改为带下划线的普通样式，不再是浅灰底上的浅色字。 ([#426](https://github.com/daidr/dou-ui/pull/426))

## 0.1.0-alpha.13 · 2026-11-10

### 不兼容

- **@dou-ui/flow**：`ports: 'sides'`（`sidePorts`）的端口改为和白板形状的锚点一样：起点在悬停或选中节点时显示，终点只在拉连线时显示。需要一直显示的，在组件里放 `<DouFlowPort visible="always">`，或者自己写端口列表。 ([#417](https://github.com/daidr/dou-ui/pull/417))
- **@dou-ui/editor**：协同编辑时光标和选区改放在 awareness 的 `editor` 字段（原来是 `cursor`），和其他包按包名取字段一致。自己读写过 `cursor` 字段的代码改成 `editor`；各端要一起升级，否则新旧版本之间看不到对方的光标。 ([#424](https://github.com/daidr/dou-ui/pull/424))

### 新增

- **@dou-ui/editor**：块编辑器支持分栏：斜杠菜单里的“分栏”可以在旁边的面板里选择 2 到 5 栏（手机上在这一项下面展开）；块可以在栏之间拖动，拖到两栏之间新建一栏，拖动栏之间的竖线调整栏宽（也可以用键盘和触屏），区域窄于 480px 时各栏上下排列。分栏里不能再放分栏。斜杠菜单的选项新增 `choices`，可以在选项旁边选择变体，自己画变体时用 `BlockOptionChoicesProps` 和 `BlockOptionChoicesEmits`。`checkDocument` 新增 `invalid-columns`，扩展的 `context` 新增 `messages()`。 ([#416](https://github.com/daidr/dou-ui/pull/416))
- **@dou-ui/flow**：端口新增显示时机 `visible`：写在端口声明（`FlowPortSpec`）或 `DouFlowPort` 上，`hover` 在悬停、选中节点或在节点里的输入框中输入时显示，`connecting` 只在拉连线时显示，只读时都不显示。自定义白板节点用 `ports: 'sides'` 就和内置形状有一样的锚点，缩放时大小也一样。 ([#417](https://github.com/daidr/dou-ui/pull/417))
- **@dou-ui/dashboard**：`@dou-ui/dashboard/collaboration` 新增 `updateMap(map, next, { base, origin })`：不经过仪表盘把新版本写进共享文档，只写 `base` 到新版本之间的差别（增删格子、改了的键、改了位置的断点、挪了顺序的格子），其他人同时做的修改保留。`fillMap` 也可以传 `origin`。 ([#418](https://github.com/daidr/dou-ui/pull/418))
- **@dou-ui/editor**：`@dou-ui/editor/collaboration` 新增 `cursorAt(map, head, { anchor, extensions })`：不经过编辑器，按块 id 和块内文字位置得到放进 awareness `editor` 字段的光标，服务器上写入文档的一方也能显示自己的光标和名字。同时导出 `EditorPresence`、`EditorPresencePlace`、`EditorCursorTarget` 类型，文档写明 `editor` 字段的结构。 ([#424](https://github.com/daidr/dou-ui/pull/424))

### 改进

- **@dou-ui/editor**：设置了 `--dou-editor-reading-width` 时，顶层的宽表格不再受正文宽度限制：左边和正文对齐，右边伸进正文右侧的空白；还放不下时左右滚动，左边先移到手柄栏边上，再滚动列。

  表格左右滚动时，还有被遮住的列的一侧显示一道阴影，新增 `--dou-editor-scroll-shadow` 调整颜色。 ([#412](https://github.com/daidr/dou-ui/pull/412))

- **@dou-ui/form-builder、@dou-ui/gantt**：`@dou-ui/form-builder/collaboration` 和 `@dou-ui/gantt/collaboration` 的 `fillMaps` 可以传 `origin`，作为这次 Yjs 事务的来源。 ([#418](https://github.com/daidr/dou-ui/pull/418))

### 修复

- **dou-ui、@dou-ui/theme**：DouCommand / DouCommandDialog 的 `item` 插槽放两行或更高的内容时，行会跟着长高，高亮底色盖住整行，滚动定位也按实际高度来，不再固定 36px、溢出到下一行。开启 `virtual`（超过 100 条时默认开启）时也一样：渲染过的行按实际高度计算，没渲染的按最先显示的几行估算，上方的行高度变化时看到的内容不动；新增 `itemSize`（数字或 `(item) => number`），传了就固定每一行的高度、不再测量，内容超出时开发环境会提示。DouCommandDialog 现在也会把 `virtual` 和 `itemSize` 传给里面的列表，不传 `virtual` 时和 DouCommand 一样超过 100 条自动开启。

  `line-height: 1` 和 `white-space: nowrap` 从 `.dou-command__item` 挪到了默认的标签和说明上：`item` 插槽里的内容现在用继承的行高，长文字会换行；需要单行省略时在插槽内容上自己加 `white-space: nowrap`。 ([#411](https://github.com/daidr/dou-ui/pull/411))

- **@dou-ui/editor**：块编辑器选中整块（`Esc` 或把手）后，复制和剪切带走的是整块，而不是其中的文字；选中的块里有表格时，之前只会带走第一格的文字。表格块的把手现在可以拖动。 ([#416](https://github.com/daidr/dou-ui/pull/416))
- **@dou-ui/flow**：`updateMaps` 比较 `base` 和新流程时不再看对象里键的顺序：程序只是把 `data`、位置等对象的键换了顺序，不再被当成改动，冲掉别人同时做的修改。开发环境下传入的新流程就是 `base` 本身时会警告。 ([#418](https://github.com/daidr/dou-ui/pull/418))
- **dou-ui、@dou-ui/theme**：DouChatInput 的 `/` 和 `@` 菜单里，选项的 `label` 太长时不再超出菜单，而是先换到第二行，两行放不下再显示省略号。`description` 和 `label` 平分一行的空间：较短的（如类型）保持完整，较长的在有空间时完整显示，两者都长时各占一半。菜单不再能横向滚动，左侧图标始终完整。鼠标悬停在被截断的文字上时显示全文。 ([#420](https://github.com/daidr/dou-ui/pull/420))
- **dou-ui**：DouButton 的默认插槽、`leading` 或 `trailing` 没有渲染出内容时（比如里面只有一个 `v-if` 为假的数字），当作没有传这个插槽：有 `leading` 图标的按钮会变成和纯图标按钮一样的方形，也不再多出一个空的图标位。DouTag、DouCheckTag 和 DouLink 的 `leading` 插槽没有渲染出内容时，也不再留下空的图标位；DouLink 设了 `external` 而 `trailing` 没有渲染出内容时，仍显示外链箭头。 ([#421](https://github.com/daidr/dou-ui/pull/421))
- **@dou-ui/flow**：白板上选中较小的形状时，角上的手柄不再盖住各边中点的锚点，从锚点拖动能拉出连线，不会变成调整大小；从角上和角的外侧仍能调整大小。在触屏上，手指按在白板选中形状的角手柄或旋转手柄上时，就由这个手柄处理，不会被浏览器交给旁边的锚点；其他地方按偏一点仍和以前一样。 ([#423](https://github.com/daidr/dou-ui/pull/423))

## 0.1.0-alpha.12 · 2026-11-09

### 新增

- **@dou-ui/icons**：新增 13 个图标：`PinOffIcon`、`ThumbsUpDownIcon`、`McpServerIcon`（MCP 官方标志）、`ZapIcon`，试管、烧瓶、烧杯一组（`TestTubeIcon`、`TestTubeDiagonalIcon`、`TestTubeRackIcon`、`FlaskIcon`、`FlaskRoundIcon`、`BeakerIcon`），以及 `FitToScreenIcon`、`FitWidthIcon`、`FitHeightIcon`。 ([#406](https://github.com/daidr/dou-ui/pull/406))

### 改进

- **@dou-ui/icons**：`MessagesIcon` 的背景气泡改到右上角露出；`PinIcon` 改为斜放（针朝左下），和新增的 `PinOffIcon` 完全重合。 ([#406](https://github.com/daidr/dou-ui/pull/406))

### 修复

- **dou-ui**：轻提示堆叠时，新出现的一条和已有的高度不同，已有的几条不再在第一帧跳到新高度或新位置，而是平滑过渡过去。 ([#403](https://github.com/daidr/dou-ui/pull/403))
- **@dou-ui/code**：代码对比里新增、删除行的底色铺满整个行号栏，从最左一列一直连到代码，`inline` 和 `split` 两种视图一样，不再在 `+`/`−`、行号和代码之间断开，`gutters` 加的列也在底色里；`inline` 视图开了 `wrap` 时，换行折出的几行旁边的行号栏也一起着色。代码编辑器 `gutters` 的格子同样跟着换行后的整行变高，内容和焦点环留在第一行。 ([#408](https://github.com/daidr/dou-ui/pull/408))

## 0.1.0-alpha.11 · 2026-11-09

### 不兼容

- **dou-ui、@dou-ui/theme**：轻提示的内容包进了新的 `.dou-toast__body`，内边距和横向排列都在它上面；`.dou-toast__item` 改为绝对定位，高度由组件按内容计算并控制，超出部分会被裁掉。原来写在 `.dou-toast__item` 上的内边距、`gap`、对齐等样式请改到 `.dou-toast__body`；`.dou-toast__item` 上只保留外壳样式（边框、背景、圆角、阴影），不要再设置 `height`、`position` 或 `transform`。 ([#402](https://github.com/daidr/dou-ui/pull/402))

### 新增

- **dou-ui**：DouMarkdown、DouStreamText、DouChatMessage 新增 `trailing` 插槽：内容跟在正文最后一个字后面、和文字同一行，适合放“已编辑”这类常驻标记。在 Markdown 里位置和流式光标相同，最后一块是代码块或分隔线时单独占一行；在 ChatMessage 里跟在最后一个文字片段末尾，不受 `actionsVisible` 影响。 ([#400](https://github.com/daidr/dou-ui/pull/400))
- **dou-ui、@dou-ui/theme**：同一位置的多条轻提示默认叠在一起，指针悬停、焦点进入或在触屏上轻点时展开成一列，展开期间暂停倒计时；新增、关闭、展开和收起之间连贯过渡。`DouToastViewport` 新增 `stacked`，设为 `false` 时始终排成一列。 ([#402](https://github.com/daidr/dou-ui/pull/402))

### 修复

- **@dou-ui/theme**：DouDialog 没有标题栏（不传标题、`closable` 为 `false`、也没有 `fullscreenable`）时，正文四边都用 `--dou-dialog-padding`，不再在顶部多留 8px；有标题、关闭按钮或全屏按钮任一存在时显示标题栏，标题栏和正文之间仍是 8px。 ([#399](https://github.com/daidr/dou-ui/pull/399))

## 0.1.0-alpha.10 · 2026-11-09

### 不兼容

- **@dou-ui/editor**：`@dou-ui/editor/collaboration` 的 `fillMap` 和 `readMap` 改为用选项传扩展，和 `updateMap` 一致：`fillMap(map, doc, extensions)` 改成 `fillMap(map, doc, { extensions })`，`readMap(map, extensions)` 改成 `readMap(map, { extensions })`。`fillMap` 还可以传 `origin`。 ([#391](https://github.com/daidr/dou-ui/pull/391))
- **@dou-ui/flow**：扩展的 `press` 在 `readonly` 时也会被调用（白板的评论和移动画布工具要用）。自己写的 `press` 如果会修改文档，在开头判断 `ctx.readonly.value`，为 `true` 时直接返回。 ([#394](https://github.com/daidr/dou-ui/pull/394))

### 新增

- **@dou-ui/editor、@dou-ui/flow**：没有编辑器也能改正在协同编辑的文档，适合把文档交给 AI 改写后写回：`@dou-ui/editor/collaboration` 新增 `updateMap(map, doc, { base, extensions, origin })`，`@dou-ui/flow/collaboration` 新增 `readMaps` 和 `updateMaps(maps, doc, { base, origin })`。传入程序读到的那一份作为 `base`，只把 `base` 到新版本之间的差别写进共享文档，这期间其他人的输入、新加的块和节点都保留；块保留 id、文字按字符改，从 Markdown 读出的块按内容和文字相似度对应到原来的块，文字没变的地方评论也留着。`fillMaps` 也可以传 `origin`。 ([#391](https://github.com/daidr/dou-ui/pull/391))
- **dou-ui**：DouAutocomplete 新增 `hideOnSelect`：设为 `false` 时选中建议后列表保持打开，并按新值重新 `fetch`，可以逐级往下选（比如目录）。 ([#393](https://github.com/daidr/dou-ui/pull/393))
- **@dou-ui/flow**：Flow 的评论可以钉在节点里的一点上：`comment({ node, at: { x, y } })` 在那一点发起讨论（`x`、`y` 是节点宽高的 0–1 比例），每条钉住的讨论在那一点有一个带序号的钉子，随节点移动、缩放和旋转；位置保存在节点的 `commentPins` 里，`getCommentAnchors()` 返回的锚点带上 `at`。白板加了评论工具（M），点在节点上就在那一点发起讨论；`readonly` 时白板工具栏只留选择、移动画布和评论。 ([#394](https://github.com/daidr/dou-ui/pull/394))

### 改进

- **@dou-ui/editor**：`markdownToBlocks` 和 `htmlToBlocks` 新增 `domParser` 选项（类型 `DOMParserLike`），在 Node、Bun 等没有 `DOMParser` 的地方传入 happy-dom、linkedom 等 DOM 库的实现，就能读出块；读 HTML 时不再用到 `Element`、`Text`、`NodeFilter` 这些全局对象。 ([#391](https://github.com/daidr/dou-ui/pull/391))
- **dou-ui、@dou-ui/theme**：DouDock 的间距可以用 CSS 变量调整：`--dou-dock-group-padding-x`、`--dou-dock-group-padding-bottom`、`--dou-dock-panel-gap`；DouTabs 新增 `--dou-tabs-panel-gap`，控制标签行和面板之间的距离。 ([#392](https://github.com/daidr/dou-ui/pull/392))
- **@dou-ui/flow**：白板的评论工具在触屏上轻点发起讨论时，焦点不再进入回复框，手机上不会先弹出键盘再收起；`comment()` 新增 `{ focus: false }` 选项。钉子读出的名称改成“评论 1，矩形：方案一”，先读序号。 ([#396](https://github.com/daidr/dou-ui/pull/396))

### 修复

- **dou-ui**：DouTabs 选中标签自己变宽（比如 `label` 插槽的文字晚一步才出现）时，下划线会跟着重新测量，不再只剩一截。 ([#392](https://github.com/daidr/dou-ui/pull/392))
- **dou-ui、@dou-ui/theme**：DouAutocomplete 选中建议后，下次打开列表时按新值重新取建议，不再显示上一次的旧建议；`empty` 插槽里的长文字在列表宽度内换行，不再把列表撑得比输入框宽。 ([#393](https://github.com/daidr/dou-ui/pull/393))

## 0.1.0-alpha.9 · 2026-11-07

### 不兼容

- **dou-ui**：DouDock 的 `move`、`split` 事件里 `from` 可能为 `null`，表示从 Dock 外拖进来、新开的标签（类型 `DockLocation | null`）。读 `from.group`、`from.index` 的地方改成先判断，如 `event.from?.group`。 ([#382](https://github.com/daidr/dou-ui/pull/382))

### 新增

- **dou-ui**：DouDock 新增 `extra` 插槽，放在每组标签行的末尾，参数是这一组和它选中的标签；新增 `v-model:active-group`，记着最近用过的组：在某组里按下指针、焦点移进某组，或者把标签拖进某组、拆出新组时更新，这一组从布局里消失时变回 `undefined`。 ([#380](https://github.com/daidr/dou-ui/pull/380))
- **dou-ui**：DouDock 新增实例方法 `startDrop`：在列表项等外部元素的 `pointerdown` 里调用，就能把它当作标签拖进 Dock，放到标签行、中间或边缘的效果和拖标签相同。 ([#382](https://github.com/daidr/dou-ui/pull/382))

### 改进

- **dou-ui**：DouDock 的组放不下两个 `min` 时，拖到这个方向的边缘不再拆分，而是和拖到中间一样并入这一组；`min` 可以写成 `{ width, height }`，左右分割和上下分割分别用；新增实例方法 `canSplit(groupId, side)`，用按钮拆分时可以先判断放不放得下。 ([#381](https://github.com/daidr/dou-ui/pull/381))

## 0.1.0-alpha.8 · 2026-11-06

### 修复

- **@dou-ui/flow**：白板整理按连接线实际画的方向排：从上往下连的白板整理后仍然从上往下，不再被拉成一长排；连接线挪到两个形状相对的两边，不再从底边出发绕回另一个形状的顶边，节点上下也不再多出小弧线；跨层的直线连接线从中间各层的空隙穿过。没连线的笔迹、文字、便签不再被排走，贴着形状的跟着形状走；指回上层的连接线从外侧绕回。节点类型的 `ports` 可以写 `'sides'`，四边中点各一个起点和终点。 ([#374](https://github.com/daidr/dou-ui/pull/374))

## 0.1.0-alpha.7 · 2026-11-06

### 不兼容

- **dou-ui**：DouChatArtifact 在 `status="running"` 时，传了 `description` 就带扫光显示它（比如“找报表数据从哪来 · 1/3”），没传才显示“正在生成”。之前运行中会忽略 `description`。完成后请把 `description` 换成结果的说明。运行中想显示“正在生成”，就不要传 `description`。 ([#368](https://github.com/daidr/dou-ui/pull/368))
- **@dou-ui/theme**：DouChatContextMeter 的进度色变量 `--dou-chat-context-meter-color` 改名为 `--dou-chat-context-meter-tone`，和其他组件的 `-tone` 一致。覆盖过旧变量的地方请换成新名字。 ([#369](https://github.com/daidr/dou-ui/pull/369))

### 新增

- **dou-ui**：DouSplitter 新增 `minEnd`，限制第二个面板的最小尺寸，支持像素。像素限制在容器大小变化时也会保持，嵌套的 Splitter 会把自己的像素限制算进外层；容器放不下两边的最小尺寸时，按比例分配。 ([#370](https://github.com/daidr/dou-ui/pull/370))
- **dou-ui、@dou-ui/theme**：`DouTabs` 支持拖动排序：`draggable` 后可以用指针拖动标签（触屏先按住），也可以按 `Alt` 加方向键挪动；`group` 相同的几组标签之间可以互相拖，`name` 区分各组，统一发出 `move` 事件。新增 `DouDock` 停靠面板：`v-model` 是可以存成 JSON 的布局树，把标签拖到一组的边缘拆出新组、拖到中间并入，空组自动合并，没被拖动的组在拆分、合并时保持原样，尺寸用分隔线调整；另导出 `moveDockTab`、`splitDockTab`、`removeDockTab` 等函数用来做菜单。 ([#371](https://github.com/daidr/dou-ui/pull/371))

### 改进

- **dou-ui、@dou-ui/theme**：DouChatArtifact 选中（`active`）时不再用文字色加 1px 外阴影叠成的粗框，改为加深一档的边框和一层浅底色。 ([#368](https://github.com/daidr/dou-ui/pull/368))
- **@dou-ui/theme**：DouChatContextMeter 的底色轨道更清楚，进度两端改为平头，用量很低时不再像加载中的转圈。 ([#369](https://github.com/daidr/dou-ui/pull/369))

### 修复

- **dou-ui**：`DouTabs` 的面板顺序改变后（比如重排 `v-for` 的数据），标签的顺序会跟着变，之前只在面板挂载时排一次。 ([#371](https://github.com/daidr/dou-ui/pull/371))

## 0.1.0-alpha.6 · 2026-11-05

### 新增

- **@dou-ui/code**：DouCodeEditor 的 `CodeGutter` 和 DouCodeDiff 的 `CodeDiffGutter` 新增 `hoverMarker`：没有自己标记的每一行都显示这个标记，悬停时出现，适合“每一行都能点 + 写评论、加断点”这样的入口，不用再为每一行写一个标记。DouCodeDiff 里可以用 `side` 限定只显示在一侧，另一侧的空格子也不再响应点击。两者的 `markers` 都改为可选。`CodeGutter` 和 `CodeDiffGutter` 另加 `pressOn: 'markers'`，只让标记响应点击，空格子不显示手形光标。`hoverMarker.title` 可以写成函数，按行（DouCodeDiff 里还有一侧）给每个标记取名。 ([#361](https://github.com/daidr/dou-ui/pull/361))

### 改进

- **@dou-ui/code**：DouCodeEditor 和 DouCodeDiff 行号栏里可点的列，在触屏和触控笔上改为手指抬起且没有移动时才触发 `onPress`，从行号栏开始拖动只滚动，不会误触。点一个还看不见的悬停标记时，第一下先把光标移到这一行让标记出现，再点一下才触发。 ([#361](https://github.com/daidr/dou-ui/pull/361))

### 修复

- **@dou-ui/code**：DouCodeDiff：只在悬停时显示的 gutter 标记（`visible: 'hover'`）不再阻止未改动的行收起。之前给每一行都放一个悬停标记后，`collapseUnchanged` 就不再收起任何行。 ([#361](https://github.com/daidr/dou-ui/pull/361))

## 0.1.0-alpha.5 · 2026-11-05

### 不兼容

- **dou-ui、@dou-ui/theme**：DouChatContextMeter 收窄为纯圆环：去掉内置的提示和 `tabindex`，移除 `format`，根元素也不再有内边距和固定高度。提示和用量明细由应用用 DouTooltip、DouPopover 自己组合，通常把圆环放进 ghost 按钮里，写法见文档。新增从 `dou-ui` 导出的 `compactNumber` 和 `contextUsage`，写提示时可以得到和圆环一致的数字；`used`、`total` 为负数或不是有限数时按 0 处理。

  迁移：想保留原来的悬停提示，先用 `const u = contextUsage(used, total)` 算出用量，再把圆环包进 `<DouTooltip :content="t('chat.context', { used: compactNumber(u.used), total: compactNumber(u.total), percent: u.percent })">` 并加上 `tabindex="0"`；需要点击打开明细时，把圆环放进按钮。 ([#357](https://github.com/daidr/dou-ui/pull/357))

### 新增

- **@dou-ui/dashboard**：DouDashboard 新增 `widgetError` 事件：格子的内容或设置面板出错时触发，参数是 `{ widget, part, error }`，用来上报错误监控。`@dou-ui/dashboard/widgets` 导出 `textOf`、`textsOf`、`numberOf`、`flagOf`、`recordOf`，自定义格子可以用它们读取类型不可靠的 `props`。 ([#356](https://github.com/daidr/dou-ui/pull/356))

### 改进

- **dou-ui**：DouTooltip 的提示和触发器的 `aria-valuetext` 相同时（比如包着进度、上下文用量这类读出数值的元素），不再挂 `aria-describedby`，读屏不会把同一句话读两遍。 ([#357](https://github.com/daidr/dou-ui/pull/357))

### 修复

- **@dou-ui/dashboard**：内置格子和它们的设置面板遇到类型不对的 `props`（比如 `delta` 写成数字、`columns` 不是数组、透视表 `config.rows` 不是数组、开关写成 `'yes'`）时，按没有设置处理，不再抛错；统计数字的固定值写成 `'12'` 这样的文字时，和从数据读到的值一样按数字显示。格子的组件在初始化或渲染时抛出的错误只影响这个格子：它显示“无法显示”和“重试”，其他格子照常显示，`props` 或数据变化后重新渲染；设置面板出错时只在设置抽屉里提示。 ([#356](https://github.com/daidr/dou-ui/pull/356))
- **dou-ui**：DouPopover 打开时，焦点在触发器上按 `Tab` 而弹层里没有可聚焦的内容，或者按 `Shift+Tab` 往前离开时，弹层会关闭，不再留在页面上而焦点已经去了别处。 ([#358](https://github.com/daidr/dou-ui/pull/358))

## 0.1.0-alpha.4 · 2026-11-05

### 不兼容

- **dou-ui**：`DouChatInput` 的命令有 `label` 时不再按 `value` 匹配：`value` 用户看不到，常常只是 id。以前靠 `value` 找到的命令（如输入 `/sum` 找到 `{ value: 'summarize', label: '总结' }`），把这个词写进 `keywords`：`{ value: 'summarize', label: '总结', keywords: ['summarize'] }`。 ([#341](https://github.com/daidr/dou-ui/pull/341))
- **dou-ui**：移除 `setDialogContext` 和 `setToastContext`，改用 `setInstalledAppContext`：对话框、轻提示和其他在组件树之外渲染的内容共用同一个应用上下文。 ([#350](https://github.com/daidr/dou-ui/pull/350))

### 新增

- **@dou-ui/theme**：折叠面板内容的缩进改为 CSS 变量 `--dou-collapse-indent`，默认仍是箭头宽度加间距，和标题文字对齐。 ([#320](https://github.com/daidr/dou-ui/pull/320))
- **dou-ui、@dou-ui/theme**：Menu 的项支持 `description`：展开的竖向菜单和弹出的子菜单在名称下面多一行说明，折叠和水平菜单的顶层只读给读屏；新增 `description` 插槽。 ([#321](https://github.com/daidr/dou-ui/pull/321))
- **dou-ui、@dou-ui/theme**：`DouChatMessage` 新增 `actions-visible`，设置操作栏何时显示：`'always'` 始终显示，`'hover'` 悬停或聚焦时显示。默认和以前一样，用户消息悬停显示，助手消息始终显示；无法悬停的设备上始终显示。 ([#324](https://github.com/daidr/dou-ui/pull/324))
- **dou-ui**：`DouCommentThread` 新增 `resolvable`，设为 `false` 时只隐藏解决按钮，回复框和编辑、删除菜单保留，适合没有“已解决”状态的草稿批注。 ([#340](https://github.com/daidr/dou-ui/pull/340))
- **dou-ui**：`DouChatInput` 的命令和引用按用户看得到的文字匹配：`label`（没有时用 `value`）、引用的 `value` 和 `description`，选项新增 `keywords` 补充匹配词；新增 `filter`，可传函数自定义匹配、`false` 原样列出，也可以按触发符分开设置，如 `{ '@': false }`；新增 `search` 事件和 `searchDelay`，`/`、`@` 后的文字变化时触发，方便按输入去服务端查候选。 ([#341](https://github.com/daidr/dou-ui/pull/341))
- **dou-ui、@dou-ui/theme**：`DouLink` 新增 `variant="soft"`：带所在语气浅色底、默认无下划线的行内引用，悬停略深，换行时每行各有底色，图标和紧挨的字不会被分到两行，可用 `--dou-link-fill` 调整。所有链接都会去掉文字首尾的空白（模板里把文字单独写成一行时带上的），不会多出一截下划线或底色。悬停效果只在能悬停的设备上出现。 ([#343](https://github.com/daidr/dou-ui/pull/343))
- **dou-ui、@dou-ui/theme**：`DouMenu` 新增 `actions` 插槽，给某一项加上它自己的按钮：按钮放在项旁边而不是项里面，能用 Tab 聚焦，点击不会选中这一项；新增 `actions-visible`，`hover`（默认）在悬停、聚焦或当前项时显示，`always` 始终显示。 ([#344](https://github.com/daidr/dou-ui/pull/344))
- **dou-ui、@dou-ui/theme**：`DouImage` 新增 `max-width` 和 `max-height`，限制盒子的最大宽高。不传 `width` 和 `height` 时，图片按原始比例等比缩小到上限以内，不会被裁剪。加载中和加载失败时，盒子使用这两个上限作为尺寸。

  不传尺寸的 `DouImage` 现在默认不超过容器宽度，盒子大小与图片一致，不再被 flex 或 grid 父元素拉伸。 ([#345](https://github.com/daidr/dou-ui/pull/345))

- **dou-ui、@dou-ui/theme**：`DouChatMessage` 新增 `highlighted`，用主题色描边框住这条消息，并带 `aria-current="true"`；关掉后淡出，减少动效时很快消失。

  `DouChatList` 新增 `scrollToMessage`，直接跳到一条消息并停止跟随新内容，适合搜索定位。传了 `items` 时按键值定位，否则传元素或 DouChatMessage 的 `ref`。 ([#346](https://github.com/daidr/dou-ui/pull/346))

- **dou-ui、@dou-ui/theme**：新增 `DouChatQuestion` 选项提问：助手提一个问题，用户从几个选项里选一个回答。它有等待中、已回答、已撤回三种状态，回答或撤回后收起为一行，外观与 `DouChatConfirm` 一致。`DouChatMessage` 新增 `question` 片段和 `question` 事件。 ([#348](https://github.com/daidr/dou-ui/pull/348))
- **@dou-ui/code**：`DouCodeDiff` 新增 `gutters` 和 `widgets`：标记和行间小部件可以放在原文或修改后任一侧的行上，并排和 `inline` 两种视图都会放到对应的行；并排时另一侧留出同样高的空白保持对齐，`span: 'both'` 的小部件横跨两栏。带标记或小部件的行不会被收起。 ([#349](https://github.com/daidr/dou-ui/pull/349))
- **@dou-ui/flow**：新增 `renderFlowSVG(document, options?)` 和 `renderFlowPNG(document, options?)`：页面上不需要有编辑器，直接把文档画成和 `exportSVG`、`exportPNG` 一样的图片，可以用 `colorMode` 指定浅色或深色，默认沿用调用过 `app.use(DouUI)` 的应用的语言包，适合做缩略图。 ([#350](https://github.com/daidr/dou-ui/pull/350))
- **dou-ui**：新增 `installedAppContext()` 和 `setInstalledAppContext()`：记下配置了 DouUI 的应用（`app.use(DouUI)`、`provideGlobalConfig(config, app)`、Nuxt 模块），`dialog()`、`toast()` 和在组件树之外渲染的内容都从这里沿用应用的语言包和全局配置。`provideGlobalConfig` 传入 `app` 时，`dialog()` 和 `toast()` 也会沿用这份配置。 ([#350](https://github.com/daidr/dou-ui/pull/350))
- **@dou-ui/flow**：`DouFlowEditor` 新增评论：传入 `v-model:comments` 后可以对节点和连线发起讨论，讨论所在位置保存在节点和连线的 `comments` 字段，配合 `v-model:activeComment`、`commentAction` 事件和 `getCommentAnchors()` 做评论列表和保存。只读时选中节点或连线，工具栏上只显示评论按钮；工具栏按钮新增 `showWhenReadonly` 字段，写上的按钮只读时也显示。 ([#351](https://github.com/daidr/dou-ui/pull/351))
- **@dou-ui/dashboard**：`DouDashboard` 支持评论：传入 `v-model:comments` 和 `author` 后，格子标题栏出现评论按钮，显示讨论条数，点击或按 `Ctrl/⌘` + `Alt` + `M` 发起、查看讨论。讨论 id 保存在格子的 `comments` 字段，内容在 `v-model:comments` 里；不能编辑时也能评论，`v-model:activeComment` 可与侧栏联动，`getCommentAnchors()` 查询每条讨论所在的格子。 ([#352](https://github.com/daidr/dou-ui/pull/352))

### 改进

- **dou-ui、@dou-ui/theme**：`DouLink` 不传 `href` 时渲染为 `<button type="button">`，可以聚焦并用 Enter 或空格触发，适合一句话里的行内操作。放在 Checkbox 文字里时，点它不再顺带勾选复选框。 ([#322](https://github.com/daidr/dou-ui/pull/322))
- **@dou-ui/code**：`DouCodeEditor` 有 `onPress` 的行号栏列里，标记成为以 `title` 命名的按钮（这时 `title` 必填）：光标所在行的标记可以按 `Esc` 后 `Shift` + `Tab` 聚焦，按 `Enter` 或 `Space` 触发 `onPress`，第二个参数可能是 `KeyboardEvent`。标记新增 `visible: 'hover'`，平时不显示，指着这一行、光标在这一行或它有焦点时显示。修复按 `Esc` 后按 `Shift` + `Tab` 不能离开编辑区的问题。 ([#347](https://github.com/daidr/dou-ui/pull/347))
- **@dou-ui/flow**：文档里有没注册的节点类型时，`DouFlowEditor` 在开发环境提示一次，不再悄悄画成默认节点。 ([#350](https://github.com/daidr/dou-ui/pull/350))
- **dou-ui**：DouChatList 的 `scrollToMessage` 传 `null` 或 `undefined`（比如已经移除的消息的 `ref`）时直接忽略，不再提示“只有 `items` 时才能传键”；文档里默认插槽的写法补上了 `refs` 的定义和移除时的清理。参数类型从 `HTMLElement` 放宽为 `Element`，函数 `ref` 拿到的值可以直接传入，TypeScript 不再报错。 ([#354](https://github.com/daidr/dou-ui/pull/354))

### 修复

- **dou-ui**：Menu 的 `label` 插槽在折叠和水平菜单弹出的子菜单里不生效，仍显示原来的文字。 ([#321](https://github.com/daidr/dou-ui/pull/321))
- **dou-ui、@dou-ui/flow**：`layoutGraph` 里，长连线跨过一组并列节点、中间正好有空位时（节点数为偶数），会从正中直着穿过去，不再绕到扇形外侧；网格较粗时为了让它正好居中，图最多变宽一个网格步长，要宽更多、或节点宽度让它没法居中时，仍绕外侧，和节点镜像对称。节点较宽时整理后的图会更窄。流程编辑器整理时按端口吸附网格，两端节点宽度不同时长连线也不会在末端折一下。 ([#323](https://github.com/daidr/dou-ui/pull/323))
- **dou-ui、@dou-ui/theme**：`DouCard` 的 `as="button"` 不再带浏览器按钮的内边距、字体和居中，外观与其他卡片一致，自带悬停描边和焦点环，默认 `type="button"`；内部各部分改用 `span` 渲染，结构合法。 ([#339](https://github.com/daidr/dou-ui/pull/339))
- **dou-ui**：`DouChatConfirm` 的 `title` 插槽在组件渲染之后才传入时，现在也会显示，并用作卡片的名称。 ([#348](https://github.com/daidr/dou-ui/pull/348))
- **@dou-ui/editor、@dou-ui/sheet**：块编辑器和电子表格的评论卡片高度随可用空间收缩，在屏幕中间打开、内容又多时，卡片不再跑出屏幕。 ([#351](https://github.com/daidr/dou-ui/pull/351))
- **@dou-ui/sheet**：条件格式面板里样式预览的字号用了不存在的令牌，改为 `--dou-font-size-sm`。 ([#353](https://github.com/daidr/dou-ui/pull/353))

## 0.1.0-alpha.3 · 2026-11-04

### 不兼容

- **dou-ui、@dou-ui/theme、@dou-ui/flow、@dou-ui/form-builder**：Steps、NodeGraph 和流程编辑器默认节点的状态改用和聊天套件（ChatPlan、ChatToolCall、ChatConfirm）相同的词：`wait` → `pending`、`process` → `running`、`finish` → `done`，`error`、`blocked` 不变。迁移：

  - Steps：`status` 属性和 `items[].status` 里的旧值换成新值，`status` 的默认值随之变为 `running`；`title` / `description` 插槽里对 `status` 的判断改用新值；样式类 `.is-wait` / `.is-process` / `.is-finish` 换成 `.is-pending` / `.is-running` / `.is-done`；自定义语言包的 `steps.wait` / `steps.process` / `steps.finish` 换成 `steps.pending` / `steps.running` / `steps.done`。
  - NodeGraph：节点的 `status` 换成新值（不填时默认 `pending`）；DouNodeGraphLegend 自定义 `items` 里 `{ type: 'status', value }` 的 `value` 换成新值；样式类同上；CSS 变量 `--dou-node-graph-status-wait` / `-process` / `-finish` 换成 `-pending` / `-running` / `-done`；自定义语言包的 `nodeGraph.status.wait` / `process` / `finish` 换成 `pending` / `running` / `done`。
  - 流程编辑器默认节点：`data.status` 换成新值；样式类同上；CSS 变量 `--dou-flow-editor-status-wait` / `-process` / `-finish` 换成 `-pending` / `-running` / `-done`；自定义语言包的 `status.wait` / `process` / `finish` 换成 `pending` / `running` / `done`。未开始的状态点读作「未开始」，不再是「等待」。 ([#294](https://github.com/daidr/dou-ui/pull/294))

- **dou-ui、@dou-ui/theme**：聊天套件的状态名统一为和 ChatPlan 相同的一套：`pending` 未开始、`running` 进行中、`waiting` 等待别人（比如等用户确认）、`done` 已完成、`error` 出错。

  **先检查这一处，类型检查发现不了**：ChatToolCall 的 `pending` 仍然合法，但含义从“等待确认”变成了“未开始”。请搜索 `DouChatToolCall` 和 `type: 'tool'` 里的 `'pending'`，等待用户允许的调用改为 `'waiting'`。开发环境下，`pending` 的调用带 `actions` 插槽时会警告一次。

  | 组件                                              | 原来                    | 现在                         |
  | ------------------------------------------------- | ----------------------- | ---------------------------- |
  | ChatToolCall                                      | `pending`（等待确认）   | `waiting`                    |
  | ChatToolCall                                      | `success`（也是默认值） | `done`（默认值）             |
  | ChatToolCall                                      | —                       | 新增 `pending`，表示还没开始 |
  | ChatConfirm                                       | `pending`（也是默认值） | `waiting`（默认值）          |
  | ChatArtifact                                      | `generating`            | `running`                    |
  | ChatAttachments                                   | `uploading`、`success`  | `running`、`done`            |
  | ChatMessage 的 `tool`、`confirm`、`artifact` part | 同上对应组件            | 同上对应组件                 |
  - 样式类：`.dou-chat-tool-call--pending`、`--success` 改为 `--waiting`、`--done`；`.dou-chat-confirm.is-pending` 改为 `.is-waiting`；附件的 `.is-uploading`、`.is-success` 改为 `.is-running`、`.is-done`。
  - 语言包：`chat.toolSuccess` 改名为 `chat.toolDone`，新增 `chat.toolWaiting`，`chat.toolPending` 现在是“未开始”的文案。
  - 数据来自接口 JSON 等不经过类型检查的地方时，开发环境遇到不认识的 `status` 会警告一次，旧名字会提示对应的新名字。ChatConfirm 遇到不认识的值时不再显示为“已拒绝”。 ([#296](https://github.com/daidr/dou-ui/pull/296))

- **dou-ui、@dou-ui/theme**：Descriptions 原来把列表画成表格的 `bordered` 改为 `variant: 'plain' | 'table'`（默认 `'plain'`），`bordered` 现在和其他组件一样只表示外框：`table` 样式默认带外框，设为 `false` 时去掉外框，单元格之间的细线保留。迁移：把 `<DouDescriptions bordered>` 改成 `<DouDescriptions variant="table">`；对应的类名从 `is-bordered` 变为 `dou-descriptions--table`。新增 `--dou-descriptions-border` 调整外框颜色。 ([#301](https://github.com/daidr/dou-ui/pull/301))
- **@dou-ui/theme**：`--dou-layout-main-padding` 和 `--dou-layout-padding-x` 的默认值改为声明在 `.dou-layout-main` 和 `.dou-layout-header` / `.dou-layout-footer` 上，和其他组件变量一样；原来设在 `:root` 或外层容器上的，要改到这些类上。 ([#301](https://github.com/daidr/dou-ui/pull/301))
- **dou-ui、@dou-ui/theme**：Table 原来画列分隔线的 `bordered` 改名为 `columnDividers`，`bordered` 现在和其他组件一样表示外框（默认开）。迁移：把 `<DouTable bordered>` 改成 `<DouTable column-dividers>`；对应的类名从 `is-bordered` 变为 `is-column-dividers`。 ([#301](https://github.com/daidr/dou-ui/pull/301))
- **dou-ui**：ChatSteps 表示“是否还在进行”的 `running` 属性改名为 `live`，与 ChatPlan、ChatToolCall 一致；`title` 插槽的参数 `running` 也改为 `live`，ChatMessage 的 `steps` 片段同样改用 `live` 字段。请把 `:running="…"`、`{ type: 'steps', running }` 和插槽里的 `running` 改为 `live`。为 `false` 时，`running` 的步骤现在会换成静止的灰色圆点。 ([#305](https://github.com/daidr/dou-ui/pull/305))
- **@dou-ui/editor**：块编辑器的间距拆成两个：`--dou-editor-block-gap` 改为相邻两块之间的距离（原来是每块上下各留的距离，默认值从 `2px` 改为 `4px`，看起来不变；原来自定义了它的，把值乘以 2），新增 `--dou-editor-list-gap` 控制同一列表里相邻两项的距离，调大块间距时列表不再跟着变松。新增 `--dou-editor-reading-width` 限制正文宽度，编辑器更宽时正文居中、手柄显示在左侧边距里。代码块上下的距离也改为跟着块间距走。 ([#308](https://github.com/daidr/dou-ui/pull/308))

### 新增

- **dou-ui、@dou-ui/theme**：ChatPlan 新增 `collapsible`，设为 `false` 时是始终展开的纯面板，标题不能点击收起。 ([#293](https://github.com/daidr/dou-ui/pull/293))
- **dou-ui、@dou-ui/theme**：ChatPlan 的步骤新增 `waiting` 状态，表示这一步停下来等用户确认或外部任务完成，以警示色图标显示。 ([#293](https://github.com/daidr/dou-ui/pull/293))
- **dou-ui、@dou-ui/theme**：新增 Markdown 流式渲染组件 `DouMarkdown`：增量解析，已写完的块不再重新解析和渲染；写了一半的加粗、链接、表格、代码块直接以最终的样子显示；新内容逐步渐显，遵循减弱动态效果。每种元素都可以用同名插槽替换渲染，`:::名字` 写自定义块，`tip`、`warning` 等默认显示为 Alert。不解析 HTML，链接、图片和角标来源只允许安全协议，支持服务端渲染。同时导出 `parseMarkdown`、`createMarkdownParser` 和 `defaultSanitizeUrl`。

  ChatMessage 新增 `markdown`，文字和思考过程片段用 Markdown 渲染，正文中的 `[1]` 显示为消息来源的角标；可以传入选项对象，Markdown 的插槽加 `markdown-` 前缀使用。`text` 插槽的参数新增 `sources`。

  CodeBlock 新增 `streaming`，代码逐步到达时只高亮完整的行，新行逐行淡入；使用 `createCodeHighlighter` 时代码块的语法颜色现在能正确显示。 ([#297](https://github.com/daidr/dou-ui/pull/297))

- **dou-ui、@dou-ui/theme**：新增 StatusDot 状态点：五种语气色、三档尺寸，`ripple` 开启涟漪，减少动效时变为静止的光晕；涟漪只用 CSS 动画，大量使用也不影响性能。Timeline 当前步骤的涟漪改用它实现。 ([#300](https://github.com/daidr/dou-ui/pull/300))
- **dou-ui、@dou-ui/theme、@dou-ui/code、@dou-ui/flow、@dou-ui/gantt、@dou-ui/sheet、@dou-ui/pivot、@dou-ui/form-builder、@dou-ui/editor**：带外框的组件统一新增 `bordered`（默认 `true`），设为 `false` 时去掉边框和圆角，不留透明的 1px，聚焦时也不再画出边框，适合放进已经有边框的卡片或面板：FlowEditor、CodeEditor、CodeDiff、Gantt、Scheduler、Sheet、Pivot、FormBuilder、Table、CodeBlock、QRCode、CalendarView、LayoutFooter。边框颜色可以统一用 `--dou-<组件>-border` 调整，ColorPanel 新增 `--dou-color-panel-border`，LayoutHeader、LayoutAside、LayoutFooter 的分隔线分别新增 `--dou-layout-header-border`、`--dou-layout-aside-border`、`--dou-layout-footer-border`。 ([#301](https://github.com/daidr/dou-ui/pull/301))
- **@dou-ui/theme**：写死的内边距改为 CSS 变量：`--dou-layout-aside-padding`（侧栏正文和底部，默认 8px，设在 `.dou-layout-aside` 和窄屏抽屉 `.dou-layout-aside-drawer` 上）、`--dou-color-panel-padding`、`--dou-qrcode-padding`、`--dou-result-padding`。 ([#301](https://github.com/daidr/dou-ui/pull/301))
- **dou-ui**：Menu 新增 `itemContextmenu` 事件，参数是被右键的项和原生事件，配合 ContextMenu 可以知道右键点的是哪一项。 ([#303](https://github.com/daidr/dou-ui/pull/303))
- **dou-ui**：ChatPlan、ChatToolCall 新增 `live` 开关，默认 `true`。这一轮结束或被停止时设为 `false`：`running` 的步骤或调用仍是当前这一项，但转圈换成静止的灰色圆点、去掉扫光，不用再逐个改写状态。ChatMessage 的 `plan`、`tool` 片段也可以带 `live`。 ([#305](https://github.com/daidr/dou-ui/pull/305))
- **dou-ui、@dou-ui/theme**：ChatConfirm 和 ChatToolCall 新增 `withdrawn` 状态，表示用户回答之前助手已经不需要了，比如生成被停止或助手换了做法。ChatConfirm 收起为一行“已撤回”，图标和文字整体变淡，不再使用 `tone` 的颜色；ChatToolCall 显示“已撤回”。语言包新增 `chat.withdrawn` 和 `chat.toolWithdrawn`。

  ChatConfirm 回答或撤回后，如果焦点原本在它的按钮上，会留在卡片上而不是丢到页面；结果行一直挂载，读屏软件能播报新的结果。 ([#306](https://github.com/daidr/dou-ui/pull/306))

- **dou-ui、@dou-ui/theme**：Tabs 新增 `height`：设置后面板填满标签以外的空间并单独滚动，竖排时放不下的标签列也单独滚动、边缘渐隐。新增 `iconOnly` 和 TabPanel 的 `icon`，标签可以只显示图标，文字作为可读名称并在提示中显示。竖排时面板现在总是和标签列一样高。 ([#307](https://github.com/daidr/dou-ui/pull/307))
- **dou-ui**：ContextMenu 新增 `v-model:target` 和 `beforeOpen`：每次右键开始时先清空 `target`，由项的事件重新记下；`beforeOpen` 返回 `false` 时不打开，比如右键分组标题、表头或空隙时，右键交还给浏览器或外层的 ContextMenu。触发区域里的元素已经处理了这次右键（调用过 `preventDefault()`）时也不再打开，嵌套的 ContextMenu 只打开里面那个。 ([#309](https://github.com/daidr/dou-ui/pull/309))
- **dou-ui、@dou-ui/theme、@dou-ui/sheet、@dou-ui/form-builder**：菜单项新增 `description`，在文字下面显示一行说明：DropdownItem 的属性和插槽，以及 `ContextMenuItem`、`SheetMenuItem`、`FormBuilderMenuItem` 的字段。 ([#311](https://github.com/daidr/dou-ui/pull/311))
- **dou-ui、@dou-ui/theme**：ProgressGroup 新增 `legendDirection`：设为 `vertical` 时图例每项占一行，名称在前、数量靠右对齐，名称过长时以省略号截断，悬停可以看到全名；数量过长时换行，不会超出容器。默认的 `horizontal` 与之前一样并排显示。 ([#313](https://github.com/daidr/dou-ui/pull/313))
- **dou-ui、@dou-ui/theme**：Button 新增 `size="xs"`：高 24px，用于密集的行和工具栏里的次要操作，不用于主操作。在触屏上，`xs` 按钮和只有图标的按钮一样，可点击区域会扩展到约 40px。`xs` 是按钮独有的尺寸，表单和 FieldGroup 的 `size` 不会传成 `xs`。 ([#315](https://github.com/daidr/dou-ui/pull/315))
- **dou-ui、@dou-ui/theme**：菜单项可以分组并加小标题：新增 `DouDropdownGroup`，`DouDropdownRadioGroup` 也能写 `label` 和 `divided`；用数据写菜单项时写成 `{ type: 'group', label, children }`。 ([#316](https://github.com/daidr/dou-ui/pull/316))

### 改进

- **@dou-ui/flow、dou-ui**：流程图整理后更工整：一条直链上的节点上下（或左右）对齐，跨好几层的长连线从各层节点的空隙里绕过去，不再压在节点上，同一对节点之间的几条长连线错开并排；彼此不相连的几组节点分开排列，输出多于输入的节点排到靠近下游的位置，连线交叉也更少。长连线经过的点存在连线新增的 `points` 里。只移动一端或改变一端的大小时清掉，两端一起移动或复制粘贴时跟着平移。NodeGraph 同样把不相连的几组节点分开排列，输出多于输入的节点后移，交叉更少。 ([#312](https://github.com/daidr/dou-ui/pull/312))

### 修复

- **dou-ui**：ChatSources 和 ChatCitation 只把 http(s)、mailto、tel 和相对地址渲染成链接，`javascript:`、`data:` 这类地址不再可以点击，开发环境下会警告一次。 ([#298](https://github.com/daidr/dou-ui/pull/298))
- **dou-ui、@dou-ui/flow、@dou-ui/form-builder**：按需引入时，组件内部用到的其他组件也能读到 ConfigProvider `defaults` 里给它们的默认值，例如只引入 ChatMessage 时 `defaults.DouStreamText` 对消息里的文字同样生效；此前要先在别处引入过 StreamText 才有效。涉及 ChatMessage、Table、Pagination、ColorPicker、CommentThread、ContextMenu、白板的连接点、表单设计器的预览等所有嵌套使用其他组件的地方。 ([#299](https://github.com/daidr/dou-ui/pull/299))
- **dou-ui、@dou-ui/theme**：很长的标签不再撑出 InputTag、Select / TreeSelect / Cascader 多选的输入框，也不再超出 Tag 自身的宽度：放不下的文字以省略号结尾，用鼠标悬停时显示完整内容。这几个输入框放在网格或横向弹性布局里时，长内容也不会把它们撑宽。 ([#302](https://github.com/daidr/dou-ui/pull/302))
- **dou-ui**：Popover 的 `content` 插槽参数 `close` 与实例方法 `close()` 关闭时把焦点交还给触发元素；Popconfirm 点击取消或确定后同样如此。 ([#310](https://github.com/daidr/dou-ui/pull/310))
- **dou-ui**：`DouTooltip` 套在 `DouPopover`、`DouDropdown`、`DouPopconfirm`、`DouContextMenu` 外面（或反过来）时，两层的属性与事件都落到同一个触发元素上，点击不再失效，也不再需要额外包一层 `<span>`。弹出层打开后提示自动收起。提示文字与触发元素的 `aria-label` 相同时不再设置 `aria-describedby`，读屏不会把同一句话读两遍。 ([#314](https://github.com/daidr/dou-ui/pull/314))
- **dou-ui**：`trigger="hover"` 的 Dropdown、Popover 和 Menu 的弹出子菜单在手机上轻点打开后很快自己关上：轻点之后浏览器补发的鼠标事件被当成了指针离开。现在悬停只认鼠标，触屏和触控笔改为轻点打开、再点一下或点别处收起；触发元素是链接时，第一次轻点只打开弹出层。悬停的 Popover 也能用 `Enter` 打开，轻点或键盘打开时带上 `aria-expanded`。ChatCitation 的预览标题改为来源链接，键盘聚焦角标时会弹出预览。 ([#317](https://github.com/daidr/dou-ui/pull/317))

## 0.1.0-alpha.2 · 2026-11-04

### 不兼容

- **@dou-ui/theme**：`ToneTokens` 新增必填的 `soft`，手写完整 `ThemeTokens` 的主题要给每种语气补上：值用 `mixColors(DEFAULT, bg.surface, 0.07)` 算出，或者整组改用 `createTone(color, base)` 生成。用 `defineTheme` 在内置主题上覆盖的主题不受影响。 ([#289](https://github.com/daidr/dou-ui/pull/289))

### 新增

- **@dou-ui/theme**：每种语气色新增浅色底 `soft`（`--dou-color-primary-soft`、`--dou-color-warning-soft` 等），亮色和暗色主题各一套，等于语气色以 7% 混进表面色，和 soft 按钮、标签的底色一致，语气文字和正文在上面都不低于 4.5:1。`createTheme` / `createTone` 会一并生成。 ([#289](https://github.com/daidr/dou-ui/pull/289))

### 改进

- **dou-ui、@dou-ui/theme**：Alert 的 `action` 插槽放多个按钮时不再挤压正文：正文旁边放不下时，操作区换到正文下方，按钮之间也可以换行。新增 `--dou-alert-text-min` 控制正文至少保留的宽度。 ([#288](https://github.com/daidr/dou-ui/pull/288))
- **@dou-ui/flow**：白板图片上传失败时在屏幕下方显示错误提示，不再只有读屏能听到；新增 `onUploadError(file, error)` 选项，可以改用自己的方式提示。`upload` 没有返回 `src` 时也算失败，不再插入坏图。 ([#291](https://github.com/daidr/dou-ui/pull/291))

### 修复

- **@dou-ui/dashboard**：`deriveLayout` 推算较窄断点的布局时，同一行里原本一样宽的格子保持一样宽：例如 12 列里四个 3 列宽的格子在 6 列时排成两行、每行两个，不再变成 2/1/2/1；折不了行时留出空列。 ([#290](https://github.com/daidr/dou-ui/pull/290))
- **@dou-ui/flow、@dou-ui/dashboard**：`@dou-ui/flow/style` 和 `@dou-ui/dashboard/style` 也带上子路径（如 `@dou-ui/flow/whiteboard`、`@dou-ui/dashboard/widgets`）用到的组件样式，按需引入时白板的错误提示、仪表盘的小组件不再缺样式。 ([#291](https://github.com/daidr/dou-ui/pull/291))

## 0.1.0-alpha.1 · 2026-11-03

### 改进

- **@dou-ui/code**：触屏上的符号栏改为放在编辑器下方、随页面滚动，按住左端的拖动柄可以移到任意位置，不再贴着键盘；四个方向键换成一个摇杆，按下后放大，推得越远光标移动越快。 ([#285](https://github.com/daidr/dou-ui/pull/285))

### 修复

- **@dou-ui/code**：iOS Safari 上滚动页面时，代码编辑器的选区菜单不再越跑越远。 ([#285](https://github.com/daidr/dou-ui/pull/285))
- **@dou-ui/gantt**：设了 `range` 的甘特图和资源排期不能再无限往右滚动，滚到范围末端就停。 ([#286](https://github.com/daidr/dou-ui/pull/286))

## 0.1.0-alpha.0 · 2026-11-03

首个版本。

### dou-ui：组件

- **基础**：Button、Icon、Text、Ellipsis、Highlight、Link、Typography、CopyButton、Toggle / ToggleGroup、CodeBlock、RelativeTime
- **布局**：Divider、Space、Grid、Masonry、Splitter、Layout、Scrollbar、Affix、Toolbar
- **表单**：Form / FormItem、Input、Textarea、Editable、InputNumber、InputTag、InputOTP、Checkbox、Radio、Switch、Slider、Rate、Select、Listbox、Autocomplete、Cascader、TreeSelect、DatePicker、TimePicker、InputDate、InputTime、ColorPicker、ColorPanel、Transfer、SegmentedControl、CheckTag、Upload、ImageCropper、FieldGroup
- **浮层**：Tooltip、Popover、Dropdown（菜单项支持勾选、单选与快捷键显示，无论以哪种方式打开，点击菜单以外都会关闭）、DropdownButton、ContextMenu、Dialog、Drawer（可滑动关闭，支持停靠点）、Popconfirm、Tour
- **反馈**：Alert、Banner、Toast、Spinner、Loading、Progress、ProgressGroup、Skeleton、Result
- **数据展示**：Card、Avatar、User、Badge、Tag、Kbd、Empty、Statistic、Countdown、CalendarHeatmap、Sparkline、Image、Carousel、Marquee、QRCode、Watermark、Descriptions、Collapse、Timeline、NodeGraph、CalendarView、Table、Tree、VirtualList、InfiniteScroll、Sortable
- **导航**：Menu、Menubar、Tabs、Steps、Anchor、Breadcrumb、PageHeader、Pagination、Command、BackTop
- **AI 对话**：ChatMessage、ChatList、ChatInput、StreamText、ChatSteps、ChatPlan、ChatReasoning、ChatToolCall、ChatSources、ChatCitation、ChatArtifact、ChatConfirm、ChatSuggestions、ChatAttachments、ChatContextMeter、Shimmer、ChatBubble
- **配置**：ConfigProvider（含组件默认属性与浮层渲染位置）、ColorMode；内置 `zhCN`、`zhTW` 与 `en` 语言包，语言包的 `region` 决定每周第一天、日期格式与数字分隔符
- **表单校验**：规则与整表 `schema` 可以直接使用 Standard Schema
- **组合式函数**：`useFloating`、`useLayer`、`useFocusTrap`、`useScrollLock` 等，可用于编写自己的浮层；`useHotkey` 绑定快捷键，`mod` 按平台取 ⌘ 或 Ctrl，支持按键序列；`useBreakpoints` 读取当前断点，`useClipboard` 复制文本，`useRovingFocus` 让一组控件共用一个 `Tab` 位置并用方向键移动焦点，`useNow` 提供定时更新的当前时间，`useElementSize` / `useResizeObserver` 读取元素尺寸，`useIntersection` 判断元素是否可见

### @dou-ui/theme：主题

- 设计 Token 由 TypeScript 定义并生成 CSS 变量，内置亮色与暗色主题，可用 `defineTheme` 与 `themeToCss` 定制，`createTheme` 从品牌色生成亮暗两套主题
- 全局统一的断点（`sm` 640px、`md` 768px、`lg` 1024px、`xl` 1280px），从 `@dou-ui/theme` 导出为 `breakpoints`
- 所有样式位于 `dou.tokens`、`dou.base`、`dou.components` 三个级联层中，页面上不在级联层里的样式总能覆盖
- 语气色提供 `DEFAULT`、`on`、`text` 三个角色，文字对比度按 WCAG AA 取值
- 统一的动效 Token（时长、进退场曲线、位移、循环周期），`dou-fade`、`dou-zoom`、`dou-slide-*` 过渡预设，`DouCollapseTransition`；`ConfigProvider` 的 `motion` 可减少或关闭动画，`useReducedMotion` 供脚本动画使用

### @dou-ui/icons：图标

- 配套的线性图标，每个图标都是独立的组件，按需引入，也可以脱离 DouUI 单独使用

### @dou-ui/editor：块编辑器

- 文档由可以转换、拖动、嵌套的块组成，支持斜杠菜单、格式工具栏与 Markdown 快捷输入
- 内置标题、列表、引用、代码块（语法高亮、选择语言、复制）、折叠块与提示块；`image` 扩展提供图片块（上传、粘贴、拖入、链接嵌入，可调整宽度并填写说明），`mention` 扩展输入 `@` 提及某人
- 表格：行列菜单、列宽、对齐、表头行与表头列、合并单元格，拖动把手移动整行整列
- 导入导出 HTML 与 Markdown（`blocksToHTML`、`htmlToBlocks`、`@dou-ui/editor/markdown`），写法由各扩展声明
- 评论：选中文字发起讨论，讨论放在 `v-model:comments`，只读时也能评论；评论讨论组件 CommentThread 也可以单独使用
- 历史版本：`compare` 对比旧版本，`nextChange` / `previousChange` 跳转改动，`restore` 一步恢复；`diffBlocks`、`diffText` 比较文档
- 协同编辑 `@dou-ui/editor/collaboration`（Yjs）：显示其他人的光标与选区，表格的行、列、格子分开同步，评论一起同步，撤销只针对自己的修改

### @dou-ui/sheet：电子表格

- 横纵虚拟滚动、冻结行列、多区域选择、直接输入与输入法、数字与日期格式、命名样式、事务与撤销重做
- 复制粘贴与其他表格软件互通，填充柄，行列宽高拖动与自适应，插入、删除、隐藏、移动行列，可自定义的右键菜单；行列操作时公式引用与合并单元格随之改写
- 单元格类型 `date`、`select`、`checkbox`，多工作表与标签栏 `DouSheetTabs`，格式工具栏 `DouSheetToolbar`，CSV 读写
- 公式：自研解析与按需、增量计算，常用的数学、逻辑、文字、日期、统计、查找函数，`defineSheetFunction` 自定义函数；编辑栏、引用着色与函数补全；计算引擎 `@dou-ui/sheet/formula` 可单独使用
- 排序、筛选、条件格式、数据验证、分组折叠行列、批注、评论与历史版本
- 导出图片 `exportSVG` / `exportPNG`，按 A4 分页打印
- 扩展系统：`defineSheetExtension`、`defineSheetCommand`、`defineSheetExporter` / `defineSheetImporter`；不含组件的入口 `@dou-ui/sheet/core` 可在 Worker 或服务端使用
- 协同编辑 `@dou-ui/sheet/collaboration`：并发插删行列不错位，显示他人的选区和正在编辑的格子，只撤销自己的修改

### @dou-ui/sheet-xlsx：xlsx 导入导出

- 把 `@dou-ui/sheet` 的工作簿写成 `.xlsx`，或从 `.xlsx` 读入，不依赖第三方库；支持值、公式、格式、样式、合并、冻结、分组、批注、验证、条件格式与筛选，导入时列出放不下的内容

### @dou-ui/chart：图表

- 由外壳 `DouChart` 与系列、坐标轴组合而成；系列画在 canvas 上，刻度、图例等是可选中、可读屏的文字
- 折线、面积、柱状（堆叠、横向）、散点与气泡、饼图与环形图、组合图与双数值轴，以及热力图、雷达图、漏斗图、瀑布图、直方图、箱线图、仪表盘、矩形树图、旭日图；`defineChartSeries` 自定义系列
- 提示框与多图联动、图例开关、缩放与框选（`DouChartZoom`、`DouChartBrush`、`DouChartRange`）、参考线与标注、数据标签、数据表视图与键盘浏览
- 百万个点的抽稀、按列给出数据、实时追加；导出 SVG / PNG，服务端渲染时输出静态 SVG

### @dou-ui/flow：流程编辑器与白板

- `DouFlowEditor`：在可以平移、缩放的画布上摆放节点、连接端口；对齐参考线与吸附，框选，撤销重做，键盘操作与触屏手势
- 拖出与改接连线、端口类型与连接规则、拖入节点、右键与长按菜单、分组框、小地图与一键整理；贝塞尔、折线、直线三种连线，视口外不渲染
- 白板 `@dou-ui/flow/whiteboard`：形状、便签、文字、连接线、压感画笔、图片、缩放与旋转，导出 SVG / PNG
- 协同编辑 `@dou-ui/flow/collaboration`：按字段合并，显示他人的选中和拖动，只撤销自己的修改
- 用 `data-dou-nodrag` 标记不触发拖动的区域，与 `@dou-ui/dashboard` 相同

### @dou-ui/gantt：甘特图与资源排期

- `DouGantt`：任务表格与时间轴两栏，时间精确到分钟，工作日历（含调休），小时到年六级刻度与连续缩放，纵横虚拟渲染；汇总任务、里程碑与依赖线
- 拖动与调整任务条、拖进度、拉线建依赖、行拖动排序与缩进、行内编辑，事务与撤销重做；自动排期、拖动时预览被推动的任务、关键路径
- 资源排期 `@dou-ui/gantt/scheduler`：按人员或会议室分行，负载条与超载提示，跨行拖动
- 基线对比，导出 PNG / SVG / CSV，打印，`importCSV` 按 ID 更新任务
- 扩展 `defineGanttExtension`；协同编辑 `@dou-ui/gantt/collaboration`

### @dou-ui/code：代码编辑器

- `DouCodeEditor`：只绘制可见行，大文件流畅编辑，输入法内联组字，键盘与触控
- 内置轻量语言的增量分词（与 CodeBlock 共用语法色），自动缩进、括号闭合、注释；多光标、列选择、查找替换、折叠与自动换行
- 装饰、诊断、补全与代码片段、对比视图、可选的小地图；Yjs 协同与 Shiki 适配
- 语言服务 `@dou-ui/code/lsp`：补全、悬停、参数提示、问题与跳转定义

### @dou-ui/form-builder：表单设计器

- 用一份 JSON 描述表单，`DouFormRenderer` 渲染成 `DouForm` 并校验；栅格、分组、标签页、分步、可增删排序的列表字段，自定义字段类型
- 安全的表达式（不执行任意代码）控制显示、禁用、必填与公式联动；描述的结构校验与版本迁移
- 设计器 `DouFormBuilder`：字段面板、画布、属性面板与结构树，拖入、排序、调整宽度，可视化条件与校验规则编辑，多端预览，导入导出 JSON
- 只需要渲染时从 `@dou-ui/form-builder/renderer` 引入，不带设计器的代码；协同编辑 `@dou-ui/form-builder/collaboration`

### @dou-ui/pivot：数据透视表

- 按行列字段分组汇总明细记录：树形行头与多级列表头、小计与总计、展开折叠、排序与筛选，求和、计数、平均、最值、去重计数、中位数与 `defineAggregator` 自定义汇总；行列双向虚拟滚动
- 字段面板 `DouPivotFields`：拖动字段到筛选、列、行、值，日期与数值分组，表格式布局，调整列宽
- 值的显示方式（占比、差值、累计、排名）、计算值、数据条与色阶、前 N 项与按合计筛选
- 大数据：按列给出数据，在 worker 中汇总百万条记录（`@dou-ui/pivot/worker`），也可以接入服务端汇总；汇总内核 `@dou-ui/pivot/engine` 可脱离组件使用
- 选择与复制、导出 CSV、转成 `@dou-ui/sheet` 工作簿或 `@dou-ui/chart` 的数据、打印；读屏播报选中、复制与展开折叠

### @dou-ui/dashboard：仪表盘

- 网格布局 `DouGridLayout`：拖动换位置、拖动边角改大小，其他格子自动让开；按网格自身宽度切换断点并分别保存布局，手机上长按拖动，键盘操作并由读屏播报；布局计算 `@dou-ui/dashboard/layout` 可单独使用
- 仪表盘 `DouDashboard`：JSON 文档记录格子与位置，`defineDashboardWidget` 注册格子类型；编辑与查看模式、撤销重做、添加格子的面板 `DouDashboardPalette`
- 数据源按“数据源 + 筛选”去重请求并定时刷新，视口外的格子延迟加载；筛选栏与格子之间互相筛选
- 内置统计数字、文字、表格格子，`@dou-ui/dashboard/chart` 与 `@dou-ui/dashboard/pivot` 适配图表和透视表；导出图片与打印
- 协同编辑 `@dou-ui/dashboard/collaboration`（Yjs）：同时修改不同格子或同一格子的不同设置都会保留，显示他人所在的格子，只撤销自己的修改

### 集成与引入方式

- 组件从 `dou-ui` 具名导入；样式可以全量引入 `dou-ui/style.css`，也可以按组件引入 `dou-ui/components/<name>/style`
- `@dou-ui/resolver`：配合按需组件插件，自动导入组件和它的样式入口，覆盖 `dou-ui`、各生态包与图标
- `@dou-ui/nuxt`：Nuxt 模块，组件、指令与函数自动导入，样式与配色模式开箱即用，支持服务端渲染
