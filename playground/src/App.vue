<script setup lang="ts">
import { onMounted, reactive, ref, useTemplateRef, watchEffect } from 'vue'
import { en, toast } from 'dou-ui'
import type {
  ButtonSize,
  ButtonTone,
  ButtonVariant,
  FormInstance,
  FormRules,
  TagVariant,
} from 'dou-ui'

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
