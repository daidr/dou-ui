<script setup>
import {
  FileArchiveIcon,
  FileCodeIcon,
  FileIcon,
  FileImageIcon,
  FileSpreadsheetIcon,
  FileTextIcon,
  FileVideoIcon,
  FolderIcon,
  FolderPlusIcon,
  GridIcon,
  ListIcon,
  MenuIcon,
  MoreHorizontalIcon,
  UploadIcon,
} from '@dou-ui/icons'
import { dialog, toast, useElementSize } from 'dou-ui'
import { computed, nextTick, ref, useTemplateRef, watch } from 'vue'

// 示例数据：扁平的文件列表，parent 指向所在文件夹
const now = Date.now()
const hours = (n) => now - n * 3_600_000
let nextId = 100
const items = ref([
  { id: 1, name: '设计稿', folder: true, parent: 0, updated: hours(3) },
  { id: 2, name: '合同', folder: true, parent: 0, updated: hours(50) },
  { id: 3, name: '照片', folder: true, parent: 0, updated: hours(200) },
  { id: 4, name: '上海团建', folder: true, parent: 3, updated: hours(210) },
  { id: 5, name: '首页', folder: true, parent: 1, updated: hours(3) },
  { id: 11, name: '首页首屏.png', parent: 5, size: 2_480_000, updated: hours(3) },
  { id: 12, name: '组件墙.fig', parent: 5, size: 18_400_000, updated: hours(5) },
  { id: 13, name: '设计规范.pdf', parent: 1, size: 3_100_000, updated: hours(30) },
  { id: 14, name: '图标清单.xlsx', parent: 1, size: 86_000, updated: hours(72) },
  { id: 15, name: '演示录屏.mp4', parent: 1, size: 64_000_000, updated: hours(96) },
  { id: 21, name: '服务协议.pdf', parent: 2, size: 420_000, updated: hours(50) },
  { id: 31, name: '合影.jpg', parent: 4, size: 5_600_000, updated: hours(210) },
  { id: 32, name: '路线.png', parent: 4, size: 920_000, updated: hours(212) },
  { id: 41, name: '季度复盘.md', parent: 0, size: 12_000, updated: hours(1) },
  { id: 42, name: '备份.zip', parent: 0, size: 240_000_000, updated: hours(400) },
  { id: 43, name: 'deploy.ts', parent: 0, size: 3_200, updated: hours(8) },
])
const byId = (id) => items.value.find((item) => item.id === id)
const childrenOf = (id) => items.value.filter((item) => item.parent === id)

/* 目录树：只放文件夹 */
const buildTree = (parent) =>
  childrenOf(parent)
    .filter((item) => item.folder)
    .map((item) => ({ key: item.id, label: item.name, children: buildTree(item.id) }))
const tree = computed(() => [{ key: 0, label: '我的文件', children: buildTree(0) }])
const current = ref(0)
const expanded = ref([0, 1])
const path = computed(() => {
  const list = []
  for (let id = current.value; id; id = byId(id).parent) list.unshift(byId(id))
  return [{ id: 0, name: '我的文件' }, ...list]
})
function open(id) {
  current.value = id
  for (const step of path.value) if (!expanded.value.includes(step.id)) expanded.value.push(step.id)
  selected.value = []
  treeOpen.value = false
}

/* 当前文件夹的内容：文件夹在前 */
const view = ref('list')
const shown = computed(() =>
  // oxlint-disable-next-line unicorn/no-array-sort -- sorts a copy
  [...childrenOf(current.value)].sort((a, b) =>
    a.folder === b.folder ? a.name.localeCompare(b.name, 'zh-CN') : a.folder ? -1 : 1,
  ),
)
const selected = ref([])

const kinds = [
  { test: /\.(png|jpe?g|gif|webp|fig)$/i, icon: FileImageIcon },
  { test: /\.(xlsx|csv)$/i, icon: FileSpreadsheetIcon },
  { test: /\.(md|pdf|txt)$/i, icon: FileTextIcon },
  { test: /\.(ts|js|vue|json)$/i, icon: FileCodeIcon },
  { test: /\.(zip|tar|gz)$/i, icon: FileArchiveIcon },
  { test: /\.(mp4|mov)$/i, icon: FileVideoIcon },
]
const iconOf = (item) =>
  item.folder ? FolderIcon : (kinds.find((kind) => kind.test.test(item.name))?.icon ?? FileIcon)
const sizeOf = (item) => {
  if (item.folder) return `${childrenOf(item.id).length} 项`
  const units = ['B', 'KB', 'MB', 'GB']
  let value = item.size
  let unit = 0
  while (value >= 1000 && unit < units.length - 1) {
    value /= 1000
    unit++
  }
  return `${value < 10 && unit ? value.toFixed(1) : Math.round(value)} ${units[unit]}`
}

const columns = [
  { key: 'name', title: '名称', minWidth: 200 },
  { key: 'size', title: '大小', width: 96, align: 'end' },
  { key: 'updated', title: '修改时间', width: 120 },
  { key: 'actions', title: '', width: 56, align: 'end' },
]

/* 重命名 */
const renamingId = ref(null)
const validateName = (item) => (value) => {
  const name = value.trim()
  if (!name) return '名称不能为空'
  if (/[\\/]/.test(name)) return '名称不能包含 / 或 \\'
  const clash = childrenOf(item.parent).some((other) => other !== item && other.name === name)
  return clash ? '这里已有同名的文件' : true
}
function rename(item) {
  renamingId.value = item.id
}

/* 新建、移动、删除 */
async function newFolder() {
  let name = '新建文件夹'
  for (let n = 2; childrenOf(current.value).some((item) => item.name === name); n++)
    name = `新建文件夹 ${n}`
  const folder = { id: nextId++, name, folder: true, parent: current.value, updated: Date.now() }
  items.value.push(folder)
  await nextTick()
  rename(folder)
}

const isInside = (id, ancestor) => {
  for (let at = id; at; at = byId(at).parent) if (at === ancestor) return true
  return ancestor === 0
}
const folders = computed(() =>
  [{ id: 0, name: '我的文件' }, ...items.value.filter((item) => item.folder)].map((folder) => ({
    ...folder,
    // 不能移到自己或自己的子文件夹里
    disabled: selectedItems.value.some((item) => item.folder && isInside(folder.id, item.id)),
  })),
)
const selectedItems = computed(() => selected.value.map(byId).filter(Boolean))
function moveSelected(target) {
  for (const item of selectedItems.value) item.parent = target
  toast.success(`已移动 ${selected.value.length} 项`)
  selected.value = []
}
async function remove(list) {
  const ok = await dialog.confirm({
    title: list.length > 1 ? `删除 ${list.length} 项？` : `删除“${list[0].name}”？`,
    content: '文件夹会连同其中的内容一起删除。',
    tone: 'danger',
    confirmText: '删除',
  })
  if (!ok) return
  const doomed = new Set()
  const mark = (id) => {
    doomed.add(id)
    childrenOf(id).forEach((child) => mark(child.id))
  }
  list.forEach((item) => mark(item.id))
  items.value = items.value.filter((item) => !doomed.has(item.id))
  selected.value = selected.value.filter((id) => !doomed.has(id))
}

/* 右键菜单：记下按在了哪一项上 */
const target = ref(null)
function onItemMenu(item) {
  target.value = item
  if (!selected.value.includes(item.id)) selected.value = [item.id]
}
// 每次右键先清空，按在某一项上时由该项记下；表头、空状态和空白处都没有目标
function onAreaMenu() {
  if (!target.value) selected.value = []
}
function onMenu(value) {
  const item = target.value
  if (value === 'open') open(item.id)
  else if (value === 'rename') rename(item)
  else if (value === 'delete')
    void remove(item ? (selected.value.length > 1 ? selectedItems.value : [item]) : [])
  else if (value === 'folder') void newFolder()
  else if (value === 'upload') upload.value?.$el.querySelector('input')?.click()
}
function onRowAction(value, item) {
  target.value = item
  onMenu(value)
}
function onKeydown(event) {
  if (event.key !== 'F2' || selected.value.length !== 1 || renamingId.value) return
  event.preventDefault()
  rename(byId(selected.value[0]))
}
function activate(item) {
  if (item.folder) open(item.id)
  else toast(`打开“${item.name}”`)
}

/* 上传：按钮选择，或把文件拖进右侧区域 */
const upload = useTemplateRef('upload')
const picked = ref([])
watch(picked, (files) => {
  if (!files.length) return
  addFiles(files.map((file) => file.raw).filter(Boolean))
  picked.value = []
})
function addFiles(files) {
  for (const file of files)
    items.value.push({
      id: nextId++,
      name: file.name,
      parent: current.value,
      size: file.size,
      updated: Date.now(),
    })
  if (files.length) toast.success(`已上传 ${files.length} 个文件到“${path.value.at(-1).name}”`)
}
const dragging = ref(false)
let depth = 0
function onDragEnter(event) {
  if (!event.dataTransfer?.types.includes('Files')) return
  depth++
  dragging.value = true
}
function onDragLeave() {
  depth = Math.max(0, depth - 1)
  if (!depth) dragging.value = false
}
function onDrop(event) {
  depth = 0
  dragging.value = false
  addFiles([...(event.dataTransfer?.files ?? [])])
}

/* 窄时目录树放进抽屉 */
const root = useTemplateRef('root')
const { width } = useElementSize(root, { initial: { width: 1024, height: 0 } })
const narrow = computed(() => width.value < 640)
const treeOpen = ref(false)
watch(narrow, (value) => {
  if (!value) treeOpen.value = false
  if (value && view.value === 'list') view.value = 'grid'
})
</script>

<template>
  <div ref="root" class="files">
    <aside v-if="!narrow" class="side">
      <DouTree
        v-model:expanded="expanded"
        :selected="current"
        :data="tree"
        selectable
        size="sm"
        aria-label="文件夹"
        @select="(node) => open(node.key)"
      >
        <template #node="{ node }">
          <DouIcon class="tree-icon"><FolderIcon /></DouIcon>
          {{ node.label }}
        </template>
      </DouTree>
    </aside>

    <section
      class="main"
      @dragenter.prevent="onDragEnter"
      @dragover.prevent
      @dragleave="onDragLeave"
      @drop.prevent="onDrop"
    >
      <header class="bar">
        <DouButton
          v-if="narrow"
          variant="ghost"
          size="sm"
          aria-label="文件夹"
          @click="treeOpen = true"
        >
          <MenuIcon />
        </DouButton>
        <DouBreadcrumb
          class="crumbs"
          :items="path.map((step) => ({ label: step.name }))"
          :max-items="narrow ? 2 : 4"
          @navigate="(item, index) => open(path[index].id)"
        />
        <DouToggleGroup v-model="view" size="sm" aria-label="显示方式">
          <DouToggle value="list" aria-label="列表"><ListIcon /></DouToggle>
          <DouToggle value="grid" aria-label="网格"><GridIcon /></DouToggle>
        </DouToggleGroup>
      </header>

      <div class="actions">
        <DouUpload ref="upload" v-model="picked" multiple :auto-upload="false" :show-list="false">
          <DouButton size="sm">
            <template #leading><UploadIcon /></template>
            上传
          </DouButton>
        </DouUpload>
        <DouButton size="sm" variant="outline" @click="newFolder">
          <template #leading><FolderPlusIcon /></template>
          新建文件夹
        </DouButton>
        <div v-if="selected.length" class="bulk" role="status">
          <DouText size="sm" variant="secondary">已选择 {{ selected.length }} 项</DouText>
          <DouDropdown @select="moveSelected">
            <DouButton size="sm" variant="ghost">移动到</DouButton>
            <template #menu>
              <DouDropdownItem
                v-for="folder in folders"
                :key="folder.id"
                :value="folder.id"
                :disabled="folder.disabled || folder.id === current"
              >
                {{ folder.name }}
              </DouDropdownItem>
            </template>
          </DouDropdown>
          <DouButton size="sm" variant="ghost" tone="danger" @click="remove(selectedItems)">
            删除
          </DouButton>
        </div>
      </div>

      <DouContextMenu @select="onMenu">
        <div
          class="content"
          @contextmenu.capture="target = null"
          @contextmenu="onAreaMenu"
          @keydown="onKeydown"
        >
          <DouTable
            v-if="view === 'list'"
            v-model:selected="selected"
            :data="shown"
            :columns="columns"
            row-key="id"
            selectable
            size="sm"
            @row-dblclick="activate"
            @row-contextmenu="(row) => onItemMenu(row)"
          >
            <template #cell-name="{ row }">
              <span class="name-cell">
                <DouIcon class="file-icon" :class="{ folder: row.folder }">
                  <component :is="iconOf(row)" />
                </DouIcon>
                <DouEditable
                  v-if="renamingId === row.id"
                  :model-value="row.name"
                  editing
                  :validate="validateName(row)"
                  class="name"
                  @update:model-value="(name) => (row.name = name.trim())"
                  @update:editing="(on) => on || (renamingId = null)"
                />
                <button
                  v-else-if="row.folder"
                  type="button"
                  class="name-link"
                  @click.stop="open(row.id)"
                >
                  {{ row.name }}
                </button>
                <span v-else class="name">{{ row.name }}</span>
              </span>
            </template>
            <template #cell-size="{ row }">
              <DouText variant="tertiary" size="sm">{{ sizeOf(row) }}</DouText>
            </template>
            <template #cell-updated="{ value }">
              <DouText variant="tertiary" size="sm"><DouRelativeTime :value="value" /></DouText>
            </template>
            <template #cell-actions="{ row }">
              <DouDropdown placement="bottom-end" @select="onRowAction($event, row)">
                <DouButton variant="ghost" size="sm" :aria-label="`${row.name} 的更多操作`">
                  <MoreHorizontalIcon />
                </DouButton>
                <template #menu>
                  <DouDropdownItem v-if="row.folder" value="open">打开</DouDropdownItem>
                  <DouDropdownItem value="rename" shortcut="F2">重命名</DouDropdownItem>
                  <DouDropdownItem value="delete" tone="danger" divided>删除</DouDropdownItem>
                </template>
              </DouDropdown>
            </template>
            <template #empty>
              <DouEmpty description="文件夹是空的，把文件拖到这里上传" />
            </template>
          </DouTable>

          <div v-else-if="shown.length" class="grid" role="list" aria-label="文件">
            <div
              v-for="item in shown"
              :key="item.id"
              role="listitem"
              class="tile"
              :class="{ 'is-selected': selected.includes(item.id) }"
              @dblclick="activate(item)"
              @contextmenu="onItemMenu(item)"
            >
              <DouCheckbox
                class="tile-check"
                :model-value="selected.includes(item.id)"
                :aria-label="`选择 ${item.name}`"
                @update:model-value="
                  (on) =>
                    (selected = on
                      ? [...selected, item.id]
                      : selected.filter((id) => id !== item.id))
                "
              />
              <button
                type="button"
                class="tile-icon"
                :class="{ folder: item.folder }"
                :aria-label="item.folder ? `打开 ${item.name}` : item.name"
                @click="item.folder ? open(item.id) : activate(item)"
              >
                <component :is="iconOf(item)" />
              </button>
              <DouEditable
                v-if="renamingId === item.id"
                :model-value="item.name"
                editing
                :validate="validateName(item)"
                class="tile-name"
                @update:model-value="(name) => (item.name = name.trim())"
                @update:editing="(on) => on || (renamingId = null)"
              />
              <span v-else class="tile-name">{{ item.name }}</span>
              <DouText variant="tertiary" size="sm">{{ sizeOf(item) }}</DouText>
            </div>
          </div>
          <DouEmpty v-else description="文件夹是空的，把文件拖到这里上传" />

          <div v-if="dragging" class="dropping">
            <UploadIcon />
            松开以上传到“{{ path.at(-1).name }}”
          </div>
        </div>
        <template #menu>
          <template v-if="target">
            <DouDropdownItem v-if="target.folder" value="open">打开</DouDropdownItem>
            <DouDropdownItem value="rename" shortcut="F2">重命名</DouDropdownItem>
            <DouDropdownItem value="delete" tone="danger" divided>
              {{ selected.length > 1 ? `删除 ${selected.length} 项` : '删除' }}
            </DouDropdownItem>
          </template>
          <template v-else>
            <DouDropdownItem value="folder">新建文件夹</DouDropdownItem>
            <DouDropdownItem value="upload">上传文件</DouDropdownItem>
          </template>
        </template>
      </DouContextMenu>
    </section>

    <DouDrawer v-model:open="treeOpen" placement="left" :size="280" title="文件夹" swipeable>
      <DouTree
        v-model:expanded="expanded"
        :selected="current"
        :data="tree"
        selectable
        aria-label="文件夹"
        @select="(node) => open(node.key)"
      >
        <template #node="{ node }">
          <DouIcon class="tree-icon"><FolderIcon /></DouIcon>
          {{ node.label }}
        </template>
      </DouTree>
    </DouDrawer>
  </div>
</template>

<style scoped>
.files {
  display: flex;
  width: 100%;
  min-width: 0;
  min-height: 480px;
  border: 1px solid var(--dou-color-border);
  border-radius: var(--dou-radius-container);
  background-color: var(--dou-color-bg-surface);
  overflow: hidden;
}

.side {
  flex: 0 0 216px;
  padding: 12px 8px;
  border-right: 1px solid var(--dou-color-border);
  background-color: color-mix(in oklab, var(--dou-color-text) 2%, var(--dou-color-bg-surface));
  overflow: auto;
}
.tree-icon {
  color: var(--dou-color-text-tertiary);
}

.main {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  min-width: 0;
}

.bar {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 48px;
  padding: 0 12px 0 16px;
  border-bottom: 1px solid var(--dou-color-border);
}
.crumbs {
  flex: 1 1 auto;
  min-width: 0;
}

.actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
}
.actions :deep(.dou-upload) {
  width: auto;
}
.bulk {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-left: auto;
}

.content {
  position: relative;
  flex: 1 1 auto;
  min-height: 0;
  padding: 0 16px 16px;
  overflow: auto;
}

.name-cell {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.file-icon {
  flex-shrink: 0;
  color: var(--dou-color-text-tertiary);
}
.file-icon.folder,
.tile-icon.folder {
  color: var(--dou-color-text-secondary);
}
.name {
  flex: 1 1 auto;
  min-width: 0;
  overflow-wrap: anywhere;
}
.name-link {
  margin: 0;
  padding: 0;
  border: 0;
  background: none;
  color: inherit;
  font: inherit;
  cursor: pointer;

  &:hover {
    text-decoration: underline;
    text-decoration-color: var(--dou-color-border-strong);
    text-underline-offset: 3px;
  }
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(128px, 1fr));
  gap: 8px;
}
.tile {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 16px 8px 12px;
  border: 1px solid transparent;
  border-radius: var(--dou-radius-container);
  text-align: center;
  transition: background-color var(--dou-motion-duration-fast) var(--dou-motion-easing);

  &:hover {
    background-color: var(--dou-color-bg-muted);
  }
  &.is-selected {
    border-color: var(--dou-color-border-strong);
    background-color: var(--dou-color-bg-muted);
  }
}
.tile-check {
  position: absolute;
  top: 8px;
  left: 8px;
  opacity: 0;
  transition: opacity var(--dou-motion-duration-fast) var(--dou-motion-easing);

  .tile:hover &,
  .tile.is-selected &,
  &:focus-within {
    opacity: 1;
  }

  @media (hover: none) {
    opacity: 1;
  }
}
.tile-icon {
  display: grid;
  place-items: center;
  width: 48px;
  height: 48px;
  margin: 0 0 4px;
  padding: 0;
  border: 0;
  border-radius: var(--dou-radius-control);
  background: none;
  color: var(--dou-color-text-tertiary);
  font-size: 32px;
  cursor: pointer;

  &:focus-visible {
    outline: 2px solid var(--dou-color-focus);
    outline-offset: 2px;
  }
}
.tile-name {
  width: 100%;
  overflow-wrap: anywhere;
  color: var(--dou-color-text);
  font-size: var(--dou-font-size-sm);
}

.dropping {
  position: absolute;
  inset: 0 16px 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border: 1px dashed var(--dou-color-border-strong);
  border-radius: var(--dou-radius-container);
  background-color: color-mix(in oklab, var(--dou-color-bg-surface) 88%, transparent);
  color: var(--dou-color-text-secondary);
  font-size: var(--dou-font-size-sm);
  pointer-events: none;

  & svg {
    width: 24px;
    height: 24px;
  }
}
</style>
