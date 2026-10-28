<script setup lang="ts">
import { computed, h, onMounted, reactive, ref, useTemplateRef, watchEffect } from 'vue'
import { en, toast } from 'dou-ui'
import type {
  ButtonSize,
  ButtonTone,
  ButtonVariant,
  FormInstance,
  FormRules,
  MenuOption,
  CommandItem,
  DateRange,
  TableColumn,
  TableRowKey,
  TableSort,
  TagVariant,
  TreeKey,
  TreeNodeData,
  UploadFile,
  UploadRequest,
} from 'dou-ui'

const navIcon = (d: string) => () =>
  h(
    'svg',
    {
      viewBox: '0 0 16 16',
      fill: 'none',
      stroke: 'currentColor',
      'stroke-width': 1.5,
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
    },
    [h('path', { d })],
  )
const navItems: MenuOption[] = [
  {
    key: 'overview',
    label: '概览',
    icon: navIcon('M2.5 2.5h4.5v4.5h-4.5zM9 2.5h4.5v4.5H9zM2.5 9h4.5v4.5h-4.5zM9 9h4.5v4.5H9z'),
  },
  {
    key: 'deployments',
    label: '部署',
    icon: navIcon('M8 2l5.5 3v6L8 14l-5.5-3V5zM8 8v6M8 8l5.5-3M8 8L2.5 5'),
    children: [
      { key: 'production', label: '生产环境' },
      { key: 'preview', label: '预览环境' },
      { key: 'rollback', label: '回滚记录', disabled: true },
    ],
  },
  { key: 'logs', label: '日志', icon: navIcon('M3 3.5h10M3 6.5h10M3 9.5h6M3 12.5h8') },
  {
    type: 'group',
    label: '设置',
    children: [
      {
        key: 'domains',
        label: '域名',
        icon: navIcon(
          'M8 2a6 6 0 1 0 0 12A6 6 0 0 0 8 2zM2 8h12M8 2c2 2 2 10 0 12M8 2c-2 2-2 10 0 12',
        ),
      },
      {
        key: 'members',
        label: '成员',
        icon: navIcon(
          'M6 7.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM1.5 13.5c0-2.5 2-4 4.5-4s4.5 1.5 4.5 4M11 3a2.5 2.5 0 0 1 0 4.5M12.5 9.6c1.3.5 2 1.8 2 3.9',
        ),
      },
    ],
  },
]
const nav = ref('production')
const navCollapsed = ref(false)
const step = ref(1)
const panels = ref(['build'])
const deploySteps = [
  { title: '拉取代码', description: '从 main 分支' },
  { title: '构建', description: '安装依赖并打包' },
  { title: '部署', description: '上传到边缘节点' },
  { title: '完成' },
]

const variants: ButtonVariant[] = ['solid', 'soft', 'outline', 'ghost']
const tones: ButtonTone[] = ['neutral', 'primary', 'success', 'warning', 'danger']
const sizes: ButtonSize[] = ['sm', 'md', 'lg']

const tagVariants: TagVariant[] = ['soft', 'outline', 'solid']

const theme = ref<'light' | 'dark'>(
  new URLSearchParams(location.search).get('theme') === 'dark' ? 'dark' : 'light',
)
const loading = ref(false)

const settingsForm = useTemplateRef<FormInstance>('settingsForm')
const settings = reactive({
  name: 'dou-ui',
  domain: 'dou ui.dev',
  framework: 'vue',
  previews: true,
  protect: false,
  notify: ['deploy'],
})
const settingsRules: FormRules = {
  name: [{ required: true }, { pattern: /^[\da-z-]+$/, message: '只能包含小写字母、数字和连字符' }],
  domain: {
    pattern: /^[\da-z.-]+\.[a-z]{2,}$/i,
    message: '域名格式不正确',
  },
  notify: { type: 'array', min: 1 },
}
const keywords = ref(['vue', 'bun', 'tokens'])

const account = reactive({ email: '', password: '', role: '', agree: false })
const accountRules: FormRules = {
  email: [{ required: true }, { type: 'email' }],
  password: [{ required: true }, { min: 8 }],
  role: { required: true, message: '请选择一个角色' },
  agree: { required: true, message: '需要同意服务条款' },
}
const accountForm = useTemplateRef<FormInstance>('accountForm')
const filters = reactive({ keyword: '', status: 'all' })

const instance = reactive({
  description: '自动扩缩容的边缘函数，部署在离用户最近的节点。',
  replicas: 3,
  memory: 512,
  budget: 120.5,
  cpu: 40,
  hours: [9, 18] as [number, number],
  region: 'hk',
})
const view = ref('list')

const popoverOpen = ref(false)
const menuOpen = ref(false)
const dialogOpen = ref(false)
const drawerOpen = ref(false)
const lastAction = ref('无')
const inviteEmail = ref('')
const inviteRole = ref('开发者')

const regionOptions = [
  { value: 'hk', label: '香港' },
  { value: 'sg', label: '新加坡' },
  { value: 'fra', label: '法兰克福' },
  { value: 'iad', label: '弗吉尼亚', disabled: true },
  { value: 'sfo', label: '旧金山' },
]
const selectRegion = ref<string | null>('hk')
const selectChannels = ref(['邮件', 'Webhook'])
const selectFramework = ref<string | null>(null)

const crumbs = [
  { label: '首页', href: '#' },
  { label: '项目', href: '#' },
  { label: 'dou-ui', href: '#' },
  { label: '实例' },
]
const tab = ref('instances')
const instanceColumns: TableColumn<Instance>[] = [
  { key: 'name', title: '名称', sortable: true },
  { key: 'region', title: '区域' },
  { key: 'status', title: '状态' },
  { key: 'replicas', title: '副本', align: 'end', sortable: true, width: 88 },
]
interface Instance {
  id: number
  name: string
  region: string
  status: string
  replicas: number
}
const instances: Instance[] = [
  { id: 1, name: 'edge-fn-hk', region: '香港', status: '运行中', replicas: 3 },
  { id: 2, name: 'api-sg', region: '新加坡', status: '运行中', replicas: 12 },
  { id: 3, name: 'cron-fra', region: '法兰克福', status: '已停止', replicas: 0 },
  { id: 4, name: 'image-iad', region: '弗吉尼亚', status: '部署中', replicas: 2 },
  { id: 5, name: 'auth-hk', region: '香港', status: '运行中', replicas: 6 },
  { id: 6, name: 'mail-sg', region: '新加坡', status: '运行中', replicas: 1 },
]
const tableSort = ref<TableSort | null>({ key: 'replicas', order: 'desc' })
const tableSelected = ref<TableRowKey[]>([2])
const tablePage = ref(1)
const pagedInstances = computed(() =>
  instances.slice((tablePage.value - 1) * 4, tablePage.value * 4),
)
const bigPage = ref(7)
function statusTone(status: string) {
  return status === '运行中' ? 'success' : status === '部署中' ? 'warning' : 'neutral'
}

const pickedDate = ref<string | null>('2026-10-28')
const pickedMonth = ref<string | null>('2026-10')
const pickedRange = ref<DateRange | null>(['2026-10-12', '2026-10-24'])
const commandItems: CommandItem[] = [
  { value: 'new', label: '新建项目', group: '操作', shortcut: ['⌘', 'N'] },
  {
    value: 'deploy',
    label: '部署到生产环境',
    group: '操作',
    keywords: ['deploy'],
    shortcut: ['⌘', 'D'],
  },
  { value: 'delete', label: '删除项目', group: '操作', disabled: true },
  { value: 'deployments', label: 'Deployments', group: '导航', description: '部署记录' },
  { value: 'settings', label: 'Settings', group: '导航', description: '域名、环境变量与权限' },
  { value: 'docs', label: 'Documentation', group: '帮助' },
]
const commandQuery = ref('de')
const commandOpen = ref(false)

const treeData: TreeNodeData[] = [
  {
    key: 'src',
    label: 'src',
    children: [
      {
        key: 'components',
        label: 'components',
        children: [
          { key: 'button.vue', label: 'button.vue' },
          { key: 'tree.vue', label: 'tree.vue' },
          { key: 'upload.vue', label: 'upload.vue' },
        ],
      },
      {
        key: 'composables',
        label: 'composables',
        children: [{ key: 'use-layer.ts', label: 'use-layer.ts' }],
      },
      { key: 'index.ts', label: 'index.ts' },
    ],
  },
  { key: 'docs', label: 'docs', children: [{ key: 'roadmap.md', label: 'roadmap.md' }] },
  { key: 'package.json', label: 'package.json', disabled: true },
]
const treeExpanded = ref<TreeKey[]>(['src', 'components'])
const treeSelected = ref<TreeKey | null>('tree.vue')
const treeChecked = ref<TreeKey[]>(['components', 'roadmap.md'])
const virtualRows = Array.from(
  { length: 10000 },
  (_, index) => `deploy-${String(index).padStart(5, '0')}`,
)

const uploadFiles = ref<UploadFile[]>([
  { uid: 'spec', name: '设计规范.pdf', size: 1843200, status: 'success' },
  { uid: 'cover', name: 'cover-fail.png', size: 238400, status: 'error' },
  { uid: 'video', name: '演示录屏.mp4', size: 48_300_000, status: 'uploading', percent: 62 },
])
const fakeUpload: UploadRequest = ({ raw, onProgress, signal }) =>
  new Promise((resolve, reject) => {
    let percent = 0
    const timer = setInterval(() => {
      percent += 10 + Math.random() * 15
      if (percent < 100) return onProgress(percent)
      clearInterval(timer)
      if (raw.name.includes('fail')) reject(new Error('rejected'))
      else resolve({ ok: true })
    }, 200)
    signal.addEventListener('abort', () => clearInterval(timer))
  })

onMounted(() => {
  void settingsForm.value?.validate()
  void accountForm.value?.validate(['email', 'role'])
})

watchEffect(() => {
  document.documentElement.dataset.douTheme = theme.value
})

function simulate() {
  loading.value = true
  setTimeout(() => (loading.value = false), 1500)
}
</script>

<template>
  <main class="page">
    <header class="row">
      <h1>DouUI Playground</h1>
      <DouButton variant="outline" size="sm" @click="theme = theme === 'light' ? 'dark' : 'light'">
        {{ theme === 'light' ? '深色' : '浅色' }}
      </DouButton>
    </header>

    <section>
      <h2>structure · navigation</h2>
      <DouMenu v-model="nav" :items="navItems" mode="horizontal" />
      <div class="nav-demo">
        <DouMenu v-model="nav" :items="navItems" :collapsed="navCollapsed" class="nav-demo__menu" />
        <div class="nav-demo__body">
          <DouSteps v-model:current="step" :items="deploySteps" clickable />
          <DouCollapse v-model="panels" bordered>
            <DouCollapseItem value="build" title="构建设置">
              构建命令 <code>bun run build</code>，输出目录 <code>dist</code>。
              <template #extra>已覆盖</template>
            </DouCollapseItem>
            <DouCollapseItem value="env" title="环境变量"
              >共 4 个变量，其中 1 个仅在生产环境可见。</DouCollapseItem
            >
            <DouCollapseItem value="danger" title="删除项目" disabled />
          </DouCollapse>
          <DouGrid :cols="{ base: 1, md: 2 }" gap="lg">
            <DouTimeline>
              <DouTimelineItem time="10:42" title="部署成功" tone="success"
                >生产环境 · 耗时 38 秒</DouTimelineItem
              >
              <DouTimelineItem time="10:41" title="构建完成">产物 1.2 MB</DouTimelineItem>
              <DouTimelineItem time="10:40" title="开始构建">由 daidr 推送触发</DouTimelineItem>
              <DouTimelineItem title="等待审核" pending />
            </DouTimeline>
            <DouSteps
              :items="deploySteps"
              :current="2"
              status="error"
              direction="vertical"
              size="sm"
            />
          </DouGrid>
          <DouSpace>
            <DouButton size="sm" variant="outline" @click="navCollapsed = !navCollapsed">
              {{ navCollapsed ? '展开菜单' : '折叠菜单' }}
            </DouButton>
          </DouSpace>
        </div>
      </div>
    </section>

    <section>
      <h2>date picker · command</h2>
      <div class="complex">
        <div class="stack-col">
          <DouSpace>
            <DouDatePicker v-model="pickedDate" clearable style="width: 180px" />
            <DouDatePicker v-model="pickedMonth" type="month" style="width: 140px" />
          </DouSpace>
          <DouDatePicker v-model="pickedRange" range style="width: 300px" />
          <div class="card card--flat cal">
            <DouCalendar v-model="pickedRange" range />
          </div>
        </div>
        <div class="card card--flat">
          <DouCommand v-model:query="commandQuery" :items="commandItems" />
        </div>
      </div>
      <DouCommandDialog v-model:open="commandOpen" :items="commandItems" />
    </section>

    <section>
      <h2>tree · upload · virtual list</h2>
      <div class="complex">
        <div class="card card--flat">
          <div class="card__body">
            <DouTree
              v-model:expanded="treeExpanded"
              v-model:selected="treeSelected"
              v-model:checked="treeChecked"
              :data="treeData"
              checkable
              guides
              aria-label="文件"
            />
          </div>
        </div>
        <div>
          <DouUpload
            v-model="uploadFiles"
            :request="fakeUpload"
            dropzone
            multiple
            hint="支持任意文件，单个不超过 50 MB"
          />
        </div>
        <div class="card card--flat">
          <DouVirtualList :items="virtualRows" :item-size="32" :height="192">
            <template #default="{ item, index }">
              <div class="vrow">
                <DouText mono size="sm">{{ item }}</DouText>
                <DouText variant="tertiary" size="sm">#{{ index }}</DouText>
              </div>
            </template>
          </DouVirtualList>
        </div>
        <DouUpload v-model="uploadFiles" :show-list="false" />
      </div>
    </section>

    <section>
      <h2>navigation · table</h2>
      <DouBreadcrumb :items="crumbs" />
      <DouTabs v-model="tab" style="margin-top: 16px">
        <DouTabPanel value="instances">
          <template #label>实例 <DouBadge :value="instances.length" /></template>
          <DouTable
            v-model:sort="tableSort"
            v-model:selected="tableSelected"
            :data="pagedInstances"
            :columns="instanceColumns"
            selectable
          >
            <template #cell-name="{ value }"
              ><DouText mono>{{ value }}</DouText></template
            >
            <template #cell-status="{ value }">
              <DouTag :tone="statusTone(String(value))" size="sm" round>{{ value }}</DouTag>
            </template>
          </DouTable>
          <div class="row row--between" style="margin-top: 12px">
            <DouText variant="tertiary" size="sm">已选 {{ tableSelected.length }} 项</DouText>
            <DouPagination
              v-model:page="tablePage"
              :page-size="4"
              :total="instances.length"
              show-total
            />
          </div>
        </DouTabPanel>
        <DouTabPanel value="logs" label="日志">暂无日志。</DouTabPanel>
        <DouTabPanel value="billing" label="账单" disabled />
        <DouTabPanel value="settings" label="设置">设置</DouTabPanel>
        <template #extra><DouButton size="sm" variant="outline">新建实例</DouButton></template>
      </DouTabs>
      <div style="margin-top: 16px">
        <DouPagination v-model:page="bigPage" :total="500" :page-sizes="[10, 20, 50]" />
      </div>
    </section>

    <section>
      <h2>data display</h2>
      <div class="grid">
        <DouCard title="dou-ui.dev" description="最近一次部署于 3 分钟前完成，所有检查均已通过。">
          <template #extra><DouTag tone="success" round size="sm">运行中</DouTag></template>
          <DouDescriptions :columns="2">
            <DouDescriptionsItem label="分支">main</DouDescriptionsItem>
            <DouDescriptionsItem label="提交">39dc86b</DouDescriptionsItem>
            <DouDescriptionsItem label="区域">香港</DouDescriptionsItem>
            <DouDescriptionsItem label="耗时">42 秒</DouDescriptionsItem>
          </DouDescriptions>
          <template #footer>
            <DouButton variant="ghost" size="sm">日志</DouButton>
            <DouButton variant="outline" size="sm">回滚</DouButton>
            <DouButton size="sm">访问</DouButton>
          </template>
        </DouCard>
        <DouCard raised padding="none">
          <DouEmpty title="还没有项目" description="从一个 Git 仓库导入，或从模板开始。">
            <DouButton size="sm">导入仓库</DouButton>
          </DouEmpty>
        </DouCard>
      </div>
      <div class="row" style="margin-top: 16px">
        <DouAvatarGroup :max="4">
          <DouAvatar name="Ada Lovelace" />
          <DouAvatar name="林小满" />
          <DouAvatar name="Grace Hopper" />
          <DouAvatar name="周以" />
          <DouAvatar name="Alan Turing" />
        </DouAvatarGroup>
        <DouAvatar size="sm" name="Ada Lovelace" />
        <DouAvatar size="lg" shape="square" name="Dou UI" />
        <DouAvatar />
        <DouBadge :value="5">
          <DouButton variant="outline" size="sm">消息</DouButton>
        </DouBadge>
        <DouBadge :value="128" tone="danger">
          <DouAvatar name="林小满" shape="square" />
        </DouBadge>
        <DouBadge dot tone="success" placement="bottom-end">
          <DouAvatar name="Grace Hopper" />
        </DouBadge>
        <DouText variant="secondary">收件箱 <DouBadge :value="12" /></DouText>
        <DouText variant="secondary">
          搜索 <DouKbd size="sm">⌘</DouKbd> <DouKbd size="sm">K</DouKbd>
        </DouText>
        <DouKbd>Shift</DouKbd>
        <DouKbd>Esc</DouKbd>
      </div>
      <div style="margin-top: 16px">
        <DouDescriptions bordered layout="horizontal" :columns="2" :label-width="72">
          <DouDescriptionsItem label="名称">edge-fn-hk</DouDescriptionsItem>
          <DouDescriptionsItem label="副本">3</DouDescriptionsItem>
          <DouDescriptionsItem label="规格">2 vCPU · 512 MB</DouDescriptionsItem>
          <DouDescriptionsItem label="状态">运行中</DouDescriptionsItem>
          <DouDescriptionsItem label="说明" span="fill"
            >自动扩缩容的边缘函数，部署在离用户最近的节点。</DouDescriptionsItem
          >
        </DouDescriptions>
      </div>
    </section>

    <section>
      <h2>composition</h2>
      <article class="card">
        <div class="card__body">
          <p class="card__eyebrow">Production</p>
          <h3 class="card__title">dou-ui.dev</h3>
          <p class="card__desc">最近一次部署于 3 分钟前完成，所有检查均已通过。</p>
        </div>
        <footer class="card__footer">
          <span class="card__meta">main · 39dc86b</span>
          <div class="row">
            <DouButton variant="ghost" size="sm">日志</DouButton>
            <DouButton variant="outline" size="sm">回滚</DouButton>
            <DouButton size="sm">访问</DouButton>
          </div>
        </footer>
      </article>
    </section>

    <section>
      <h2>overlays</h2>
      <div class="row">
        <DouTooltip content="复制部署地址">
          <DouButton variant="outline" size="sm">悬停提示</DouButton>
        </DouTooltip>
        <DouPopover v-model:open="popoverOpen" title="删除这个分支？" :width="260">
          <DouButton variant="outline" size="sm">气泡卡片</DouButton>
          <template #content="{ close }">
            <DouText as="p" variant="secondary" size="sm"
              >关联的预览部署也会一并移除，此操作无法撤销。</DouText
            >
            <div class="row row--end" style="margin-top: 12px">
              <DouButton variant="ghost" size="sm" @click="close">取消</DouButton>
              <DouButton tone="danger" size="sm" @click="close">删除</DouButton>
            </div>
          </template>
        </DouPopover>
        <DouDropdown v-model:open="menuOpen" @select="(value) => (lastAction = String(value))">
          <DouButton variant="outline" size="sm">更多操作</DouButton>
          <template #menu>
            <DouDropdownItem value="visit">
              访问
              <template #suffix>⌘O</template>
            </DouDropdownItem>
            <DouDropdownItem value="redeploy">重新部署</DouDropdownItem>
            <DouDropdownItem value="promote" disabled>提升为生产环境</DouDropdownItem>
            <DouDropdownItem value="logs">查看日志</DouDropdownItem>
            <DouDropdownItem value="delete" tone="danger" divided>删除部署</DouDropdownItem>
          </template>
        </DouDropdown>
        <DouButton variant="outline" size="sm" @click="dialogOpen = true">对话框</DouButton>
        <DouButton variant="outline" size="sm" @click="drawerOpen = true">抽屉</DouButton>
        <DouText variant="tertiary" size="sm">最近的操作：{{ lastAction }}</DouText>
      </div>
      <DouDialog v-model:open="dialogOpen" title="邀请成员">
        <DouText as="p" variant="secondary"
          >成员会收到一封邀请邮件，接受后即可访问这个项目。</DouText
        >
        <DouForm style="margin-top: 16px">
          <DouFormItem label="邮箱">
            <DouInput v-model="inviteEmail" placeholder="name@example.com" />
          </DouFormItem>
          <DouFormItem label="角色">
            <DouSegmentedControl v-model="inviteRole" :options="['查看者', '开发者', '管理员']" />
          </DouFormItem>
        </DouForm>
        <template #footer="{ close }">
          <DouButton variant="outline" @click="close">取消</DouButton>
          <DouButton @click="close">发送邀请</DouButton>
        </template>
      </DouDialog>
      <DouDrawer v-model:open="drawerOpen" title="部署详情" :size="380">
        <DouSpace direction="vertical" size="md" block>
          <DouText variant="secondary">main · 39dc86b，3 分钟前由 daidr 触发。</DouText>
          <DouDivider />
          <DouText variant="secondary">构建耗时 42 秒，产物 1.2 MB，已分发到 18 个节点。</DouText>
        </DouSpace>
        <template #footer="{ close }">
          <DouButton variant="outline" @click="close">关闭</DouButton>
          <DouButton @click="close">访问</DouButton>
        </template>
      </DouDrawer>
    </section>

    <section>
      <h2>select · feedback</h2>
      <article class="card card--wide">
        <div class="card__body">
          <DouSpace direction="vertical" size="lg" block>
            <DouForm layout="horizontal">
              <DouFormItem label="区域">
                <DouSelect v-model="selectRegion" :options="regionOptions" clearable />
              </DouFormItem>
              <DouFormItem label="通知渠道">
                <DouSelect
                  v-model="selectChannels"
                  multiple
                  :options="['邮件', '短信', 'Webhook', 'Slack']"
                />
              </DouFormItem>
              <DouFormItem label="框架">
                <DouSelect
                  v-model="selectFramework"
                  filterable
                  placeholder="搜索框架"
                  :options="['Vue', 'Vite', 'Nuxt', 'VitePress', 'Astro', '静态站点']"
                />
              </DouFormItem>
            </DouForm>
            <DouAlert tone="success" title="部署完成"
              >dou-ui.dev 已更新到 main · 39dc86b。</DouAlert
            >
            <DouAlert tone="warning" closable
              >构建缓存将在 3 天后过期，过期后的首次构建会变慢。</DouAlert
            >
            <DouAlert tone="danger" title="构建失败">
              类型检查未通过，详见构建日志。
              <template #action
                ><DouButton size="sm" variant="outline">查看日志</DouButton></template
              >
            </DouAlert>
            <DouAlert>预览部署会在分支合并 30 天后自动清理。</DouAlert>
            <div class="row">
              <DouButton variant="outline" size="sm" @click="toast('链接已复制')">轻提示</DouButton>
              <DouButton
                variant="outline"
                size="sm"
                @click="toast.success('dou-ui.dev 已上线', { title: '部署完成' })"
              >
                成功
              </DouButton>
              <DouButton
                variant="outline"
                size="sm"
                @click="
                  toast({
                    message: '已删除 3 个预览部署',
                    action: { label: '撤销', onClick: () => {} },
                  })
                "
              >
                带操作
              </DouButton>
              <DouButton
                variant="outline"
                size="sm"
                @click="toast.danger('网络连接已断开', { closable: true, duration: 0 })"
              >
                错误
              </DouButton>
            </div>
            <div class="row">
              <DouSpinner size="sm" />
              <DouSpinner />
              <DouSpinner size="lg" />
              <DouText variant="secondary" size="sm">正在构建…</DouText>
            </div>
            <DouProgress :value="64" show-value />
            <DouProgress :value="32" tone="primary" size="sm" />
            <DouProgress tone="success" label="上传中" />
            <div class="row" style="align-items: flex-start; flex-wrap: nowrap">
              <DouSkeleton variant="circle" :width="40" />
              <DouSkeleton :lines="3" style="flex: 1" />
            </div>
          </DouSpace>
        </div>
      </article>
    </section>

    <section>
      <h2>form</h2>
      <article class="card card--wide">
        <div class="card__body">
          <DouSpace direction="vertical" size="lg" block>
            <div>
              <DouText as="h3" size="lg" weight="bold" class="card__title">项目设置</DouText>
              <DouText as="p" variant="secondary">
                修改会在下一次部署时生效。了解
                <DouLink href="#">部署流程</DouLink>
                或查看
                <DouLink href="https://github.com/daidr/dou-ui" external>源码</DouLink>
              </DouText>
            </div>

            <DouForm ref="settingsForm" :model="settings" :rules="settingsRules">
              <DouFormItem label="项目名称" prop="name" help="只能包含小写字母、数字和连字符">
                <DouInput v-model="settings.name" clearable />
              </DouFormItem>

              <DouFormItem label="自定义域名" prop="domain">
                <DouInput v-model="settings.domain" placeholder="example.com">
                  <template #prefix>https://</template>
                </DouInput>
              </DouFormItem>

              <DouFormItem label="框架" prop="framework">
                <DouRadioGroup v-model="settings.framework">
                  <DouRadio value="vue">Vue</DouRadio>
                  <DouRadio value="vite">Vite</DouRadio>
                  <DouRadio value="static">静态站点</DouRadio>
                </DouRadioGroup>
              </DouFormItem>

              <DouFormItem label="关键词">
                <DouTag
                  v-for="word in keywords"
                  :key="word"
                  closable
                  @close="keywords = keywords.filter((item) => item !== word)"
                >
                  {{ word }}
                </DouTag>
              </DouFormItem>

              <DouDivider align="start">部署</DouDivider>

              <DouFormItem>
                <DouSpace direction="vertical" size="sm">
                  <DouSwitch v-model="settings.previews">为每个分支生成预览</DouSwitch>
                  <DouSwitch v-model="settings.protect">预览需要登录访问</DouSwitch>
                </DouSpace>
              </DouFormItem>

              <DouFormItem label="通知" prop="notify">
                <DouCheckboxGroup v-model="settings.notify" direction="vertical">
                  <DouCheckbox value="deploy">部署成功时通知我</DouCheckbox>
                  <DouCheckbox value="fail">部署失败时通知我</DouCheckbox>
                </DouCheckboxGroup>
              </DouFormItem>
            </DouForm>
          </DouSpace>
        </div>
        <footer class="card__footer">
          <DouSpace size="sm">
            <DouTag round variant="outline" tone="success">
              <template #leading><span class="dot" /></template>
              运行中
            </DouTag>
            <DouText mono variant="tertiary" size="sm">main · abc86a0</DouText>
          </DouSpace>
          <DouSpace size="sm">
            <DouButton variant="ghost" size="sm" @click="settingsForm?.resetFields()">
              重置
            </DouButton>
            <DouButton size="sm" @click="settingsForm?.validate()">保存</DouButton>
          </DouSpace>
        </footer>
      </article>
    </section>

    <section>
      <h2>form · horizontal</h2>
      <article class="card card--wide">
        <div class="card__body">
          <DouForm
            ref="accountForm"
            :model="account"
            :rules="accountRules"
            layout="horizontal"
            label-align="end"
            required-mark="optional"
          >
            <DouFormItem label="邮箱" prop="email">
              <DouInput v-model="account.email" placeholder="you@example.com" />
            </DouFormItem>
            <DouFormItem label="密码" prop="password" help="至少 8 位">
              <DouInput v-model="account.password" type="password" />
            </DouFormItem>
            <DouFormItem label="显示名称" prop="nickname">
              <DouInput placeholder="默认使用邮箱前缀" />
            </DouFormItem>
            <DouFormItem label="角色" prop="role">
              <DouRadioGroup v-model="account.role">
                <DouRadio value="dev">开发</DouRadio>
                <DouRadio value="design">设计</DouRadio>
                <DouRadio value="pm">产品</DouRadio>
              </DouRadioGroup>
            </DouFormItem>
            <DouFormItem prop="agree">
              <DouCheckbox v-model="account.agree">我已阅读并同意服务条款</DouCheckbox>
            </DouFormItem>
            <DouFormItem>
              <DouButton native-type="submit">创建账号</DouButton>
              <DouButton native-type="reset" variant="ghost">重置</DouButton>
            </DouFormItem>
          </DouForm>
        </div>
      </article>
    </section>

    <section>
      <h2>form · inline + config provider</h2>
      <DouConfigProvider size="sm" :locale="en">
        <DouForm :model="filters" layout="inline">
          <DouFormItem label="Keyword">
            <DouInput
              v-model="filters.keyword"
              clearable
              placeholder="Search"
              style="width: 200px"
            />
          </DouFormItem>
          <DouFormItem label="Status">
            <DouRadioGroup v-model="filters.status">
              <DouRadio value="all">All</DouRadio>
              <DouRadio value="ready">Ready</DouRadio>
              <DouRadio value="failed">Failed</DouRadio>
            </DouRadioGroup>
          </DouFormItem>
          <DouFormItem>
            <DouButton variant="outline">Filter</DouButton>
            <DouTag closable>branch: main</DouTag>
          </DouFormItem>
        </DouForm>
      </DouConfigProvider>
    </section>

    <section>
      <h2>form · advanced</h2>
      <article class="card card--wide">
        <div class="card__body">
          <DouForm :model="instance">
            <DouFormItem label="区域">
              <DouSegmentedControl
                v-model="instance.region"
                block
                :options="[
                  { value: 'hk', label: '香港' },
                  { value: 'sg', label: '新加坡' },
                  { value: 'fra', label: '法兰克福' },
                  { value: 'iad', label: '弗吉尼亚', disabled: true },
                ]"
              />
            </DouFormItem>
            <DouFormItem label="描述" help="会显示在项目列表中">
              <DouTextarea
                v-model="instance.description"
                :autosize="{ minRows: 2, maxRows: 5 }"
                show-count
                maxlength="80"
              />
            </DouFormItem>
            <DouSpace size="md" block>
              <DouFormItem label="副本数">
                <DouInputNumber v-model="instance.replicas" :min="1" :max="10" />
              </DouFormItem>
              <DouFormItem label="内存">
                <DouInputNumber v-model="instance.memory" :min="128" :max="4096" :step="128">
                  <template #suffix>MB</template>
                </DouInputNumber>
              </DouFormItem>
              <DouFormItem label="月预算">
                <DouInputNumber v-model="instance.budget" :min="0" :precision="2" :controls="false">
                  <template #prefix>¥</template>
                </DouInputNumber>
              </DouFormItem>
            </DouSpace>
            <DouFormItem label="CPU 上限" :help="`${instance.cpu}%`">
              <DouSlider
                v-model="instance.cpu"
                :step="5"
                :marks="{ 0: '0%', 50: '50%', 100: '100%' }"
                :format-value="(v: number) => `${v}%`"
              />
            </DouFormItem>
            <DouFormItem
              label="维护时段"
              :help="`${instance.hours[0]}:00 – ${instance.hours[1]}:00`"
            >
              <DouSlider v-model="instance.hours" range :max="24" />
            </DouFormItem>
          </DouForm>
        </div>
      </article>
    </section>

    <section>
      <h2>segmented · sizes</h2>
      <DouSpace direction="vertical" size="md">
        <DouSpace v-for="size in sizes" :key="size" size="sm">
          <DouSegmentedControl
            v-model="view"
            :size="size"
            :options="[
              { value: 'list', label: '列表' },
              { value: 'board', label: '看板' },
              { value: 'timeline', label: '时间线' },
            ]"
          />
          <DouInputNumber :size="size" :model-value="8" />
          <DouButton :size="size" variant="outline">应用</DouButton>
        </DouSpace>
        <DouSpace size="sm">
          <DouSegmentedControl disabled model-value="日" :options="['日', '周', '月']" />
          <DouInputNumber disabled :model-value="8" />
          <DouSlider disabled :model-value="30" style="width: 160px" />
        </DouSpace>
      </DouSpace>
    </section>

    <section>
      <h2>tag</h2>
      <DouSpace direction="vertical" size="sm">
        <DouSpace v-for="variant in tagVariants" :key="variant" size="sm" wrap>
          <DouTag v-for="tone in tones" :key="tone" :variant="variant" :tone="tone">
            {{ tone }}
          </DouTag>
        </DouSpace>
      </DouSpace>
    </section>

    <section>
      <h2>choice</h2>
      <DouSpace direction="vertical">
        <DouSpace size="lg" wrap>
          <DouCheckbox :model-value="false">未选</DouCheckbox>
          <DouCheckbox :model-value="true">选中</DouCheckbox>
          <DouCheckbox indeterminate>部分</DouCheckbox>
          <DouCheckbox disabled :model-value="true">禁用</DouCheckbox>
        </DouSpace>
        <DouSpace size="lg" wrap>
          <DouRadio value="a" model-value="b">未选</DouRadio>
          <DouRadio value="a" model-value="a">选中</DouRadio>
          <DouRadio value="a" model-value="a" disabled>禁用</DouRadio>
        </DouSpace>
        <DouSpace size="lg" wrap>
          <DouSwitch :model-value="false">关</DouSwitch>
          <DouSwitch :model-value="true">开</DouSwitch>
          <DouSwitch loading>加载中</DouSwitch>
          <DouSwitch disabled :model-value="true">禁用</DouSwitch>
        </DouSpace>
      </DouSpace>
    </section>

    <section>
      <h2>input</h2>
      <DouSpace direction="vertical" style="max-width: 360px">
        <DouSpace v-for="size in sizes" :key="size" size="sm">
          <DouInput :size="size" :placeholder="`size ${size}`" />
          <DouButton :size="size" variant="outline">搜索</DouButton>
        </DouSpace>
        <DouInput placeholder="禁用" disabled />
      </DouSpace>
    </section>

    <section>
      <h2>text</h2>
      <DouSpace direction="vertical" size="sm">
        <DouSpace size="lg">
          <DouText>default</DouText>
          <DouText variant="secondary">secondary</DouText>
          <DouText variant="tertiary">tertiary</DouText>
        </DouSpace>
        <DouSpace size="lg">
          <DouText v-for="tone in tones" :key="tone" :tone="tone">{{ tone }}</DouText>
        </DouSpace>
        <DouSpace size="lg">
          <DouLink href="#">always</DouLink>
          <DouLink href="#" underline="hover">hover</DouLink>
          <DouLink href="#" tone="primary">primary</DouLink>
          <DouLink href="#" disabled>disabled</DouLink>
        </DouSpace>
      </DouSpace>
    </section>

    <section v-for="variant in variants" :key="variant">
      <h2>{{ variant }}</h2>
      <div class="row">
        <DouButton v-for="tone in tones" :key="tone" :variant="variant" :tone="tone">
          {{ tone }}
        </DouButton>
        <DouButton :variant="variant" tone="primary" disabled>disabled</DouButton>
      </div>
    </section>

    <section>
      <h2>size</h2>
      <div class="row">
        <DouButton v-for="size in sizes" :key="size" :size="size">
          {{ size }}
        </DouButton>
      </div>
    </section>

    <section>
      <h2>loading</h2>
      <div class="row">
        <DouButton :loading="loading" @click="simulate">
          {{ loading ? '提交中…' : '点击提交' }}
        </DouButton>
      </div>
    </section>

    <section>
      <h2>block</h2>
      <DouButton block>block</DouButton>
    </section>
  </main>
</template>

<style>
body {
  margin: 0;
}
.page {
  max-width: 880px;
  margin: 0 auto;
  padding: 32px 24px;
}
.grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}
.row--between {
  justify-content: space-between;
}
.row--end {
  justify-content: flex-end;
}

.row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
}
header.row {
  justify-content: space-between;
}
.card {
  max-width: 480px;
  border: 1px solid var(--dou-color-border);
  border-radius: var(--dou-radius-container);
  background: var(--dou-color-bg-surface);
  box-shadow: var(--dou-shadow-md);
  overflow: hidden;
}
.complex {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  align-items: start;
}
.stack-col {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.cal {
  width: max-content;
  padding: 12px;
}
.card--flat {
  max-width: none;
  box-shadow: none;
}
.vrow {
  display: flex;
  align-items: center;
  justify-content: space-between;
  box-sizing: border-box;
  height: 100%;
  padding: 0 16px;
  border-bottom: 1px solid var(--dou-color-border-subtle);
}
.card--wide {
  max-width: 560px;
}
.card__body {
  padding: 20px 24px;
}
.dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
}
p {
  margin: 4px 0 0;
}
.card__eyebrow {
  margin: 0;
  color: var(--dou-color-text-tertiary);
  font-size: var(--dou-font-size-sm);
}
.card__title {
  margin: 4px 0 6px;
  font-size: var(--dou-font-size-lg);
  font-weight: var(--dou-font-weight-bold);
}
.card__desc {
  margin: 0;
  color: var(--dou-color-text-secondary);
}
.card__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 24px;
  border-top: 1px solid var(--dou-color-border-subtle);
  background: var(--dou-color-bg-canvas);
}
.card__meta {
  color: var(--dou-color-text-tertiary);
  font-family: var(--dou-font-family-mono);
  font-size: var(--dou-font-size-sm);
}
.nav-demo {
  display: flex;
  gap: 24px;
  margin-top: 16px;
}
.nav-demo__menu {
  flex-shrink: 0;
  width: 200px;
  padding-right: 16px;
  border-right: 1px solid var(--dou-color-border);
}
.nav-demo__menu.is-collapsed {
  width: auto;
}
.nav-demo__body {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  gap: 24px;
  min-width: 0;
}
h1 {
  margin: 0;
  font-size: 24px;
  font-weight: var(--dou-font-weight-bold);
  letter-spacing: -0.02em;
}
h2 {
  margin: 32px 0 12px;
  color: var(--dou-color-text-tertiary);
  font-family: var(--dou-font-family-mono);
  font-size: var(--dou-font-size-sm);
  font-weight: var(--dou-font-weight-regular);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
</style>
