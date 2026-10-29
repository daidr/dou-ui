<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import {
  createTheme,
  dark,
  defineTheme,
  flattenTokens,
  light,
  parseColor,
  type DeepPartial,
  type ThemeTokens,
} from '@dou-ui/theme'
import { useColorMode } from 'dou-ui'
import { codeToHtml } from 'shiki'

type ToneName = 'primary' | 'success' | 'warning' | 'danger'
type Leaning = 'neutral' | 'warm' | 'cool'

const tones: { name: ToneName; label: string }[] = [
  { name: 'primary', label: '品牌色' },
  { name: 'success', label: '成功' },
  { name: 'warning', label: '警告' },
  { name: 'danger', label: '危险' },
]

const defaults = {
  colors: {
    primary: light.color.primary.DEFAULT,
    success: light.color.success.DEFAULT,
    warning: light.color.warning.DEFAULT,
    danger: light.color.danger.DEFAULT,
  } as Record<ToneName, string>,
  leaning: 'neutral' as Leaning,
  radius: Number.parseInt(light.radius.control),
  fontSize: Number.parseInt(light.font.size.md),
}

const state = reactive({
  colors: { ...defaults.colors },
  leaning: defaults.leaning,
  radius: defaults.radius,
  fontSize: defaults.fontSize,
})

const { isDark } = useColorMode()
const previewMode = ref<'light' | 'dark'>(isDark.value ? 'dark' : 'light')

function reset() {
  Object.assign(state, { ...defaults, colors: { ...defaults.colors } })
}

/* ---------------------------------------------------------------- */
/* neutral leaning: give every gray a little chroma at one hue       */
/* ---------------------------------------------------------------- */

const leanings: Record<Leaning, { label: string; hue: number; chroma: number }> = {
  neutral: { label: '中性', hue: 0, chroma: 0 },
  warm: { label: '偏暖', hue: 75, chroma: 0.008 },
  cool: { label: '偏冷', hue: 255, chroma: 0.01 },
}

const linear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
const gamma = (c: number) => (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055)

function tint(hex: string, hue: number, chroma: number): string {
  const [r, g, b] = parseColor(hex).map(linear) as [number, number, number]
  const L =
    0.2104542553 * Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b) +
    0.793617785 * Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b) -
    0.0040720468 * Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
  // fade the tint out toward white and black, where it would leave the gamut
  const c = chroma * Math.min(1, (1 - L) * 8, L * 4)
  const h = (hue * Math.PI) / 180
  const A = c * Math.cos(h)
  const B = c * Math.sin(h)
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3
  const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3
  const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3
  const rgb = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ]
  return `#${rgb
    .map((v) =>
      Math.round(Math.min(1, Math.max(0, gamma(v))) * 255)
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`
}

function tintGroup<T extends Record<string, string>>(group: T, leaning: Leaning): T {
  const { hue, chroma } = leanings[leaning]
  return Object.fromEntries(
    Object.entries(group).map(([key, value]) => [key, tint(value, hue, chroma)]),
  ) as T
}

/* ---------------------------------------------------------------- */
/* the theme                                                         */
/* ---------------------------------------------------------------- */

function overridesFor(base: ThemeTokens): DeepPartial<ThemeTokens> {
  const overrides: DeepPartial<ThemeTokens> = {}
  if (state.leaning !== 'neutral') {
    overrides.color = {
      bg: tintGroup(base.color.bg, state.leaning),
      text: tintGroup(base.color.text, state.leaning),
      border: tintGroup(base.color.border, state.leaning),
    }
  }
  if (state.radius !== defaults.radius) {
    overrides.radius = {
      control: `${state.radius}px`,
      container: `${state.radius === 0 ? 0 : state.radius + 6}px`,
    }
  }
  if (state.fontSize !== defaults.fontSize) {
    overrides.font = {
      size: {
        sm: `${state.fontSize - 1}px`,
        md: `${state.fontSize}px`,
        lg: `${state.fontSize + 2}px`,
      },
    }
  }
  return overrides
}

const changedColors = computed(() =>
  Object.fromEntries(
    tones
      .map(({ name }) => [name, state.colors[name].toLowerCase()] as const)
      // the brand color is always written out, the others only when changed
      .filter(
        ([name, value]) => name === 'primary' || value !== defaults.colors[name].toLowerCase(),
      ),
  ),
)

const lightOverrides = computed(() => overridesFor(light))
const darkOverrides = computed(() => overridesFor(dark))

const theme = computed(() =>
  createTheme(changedColors.value, {
    light: defineTheme(light, lightOverrides.value),
    dark: defineTheme(dark, darkOverrides.value),
  }),
)

const previewVars = computed(() =>
  Object.fromEntries(flattenTokens(theme.value[previewMode.value])),
)

/* ---------------------------------------------------------------- */
/* generated code                                                    */
/* ---------------------------------------------------------------- */

function literal(value: unknown, indent: string): string {
  if (typeof value === 'string') return `'${value}'`
  const entries = Object.entries(value as Record<string, unknown>)
  const inner = indent + '  '
  const flat = entries.every(([, v]) => typeof v === 'string')
  if (flat && entries.length <= 3)
    return `{ ${entries.map(([k, v]) => `${k}: '${v}'`).join(', ')} }`
  return `{\n${entries.map(([k, v]) => `${inner}${k}: ${literal(v, inner)},`).join('\n')}\n${indent}}`
}

const code = computed(() => {
  const colors = literal(changedColors.value, '')
  const hasOverrides = Object.keys(lightOverrides.value).length > 0
  const imports = hasOverrides
    ? 'createTheme, dark, defineTheme, light, themeToCss'
    : 'createTheme, themeToCss'
  const lines = [`import { ${imports} } from '@dou-ui/theme'`, '']
  if (hasOverrides) {
    lines.push(
      `const theme = createTheme(${colors}, {`,
      `  light: defineTheme(light, ${literal(lightOverrides.value, '  ')}),`,
      `  dark: defineTheme(dark, ${literal(darkOverrides.value, '  ')}),`,
      '})',
    )
  } else {
    lines.push(`const theme = createTheme(${colors})`)
  }
  lines.push(
    '',
    'export const css =',
    `  themeToCss(theme.light, ':root, [data-dou-theme="light"]') +`,
    `  themeToCss(theme.dark, '[data-dou-theme="dark"]')`,
  )
  return lines.join('\n')
})

const highlight = (source: string, lang: string) =>
  codeToHtml(source, {
    lang,
    themes: { light: 'github-light', dark: 'github-dark' },
    defaultColor: false,
  })

/* ---------------------------------------------------------------- */
/* preview content                                                   */
/* ---------------------------------------------------------------- */

const form = reactive({ name: '戴兜', notify: true, public: true, plan: 'team' })
const columns = [
  { key: 'name', title: '项目' },
  { key: 'region', title: '区域' },
  { key: 'status', title: '状态', width: 96 },
]
const rows = [
  { id: 1, name: 'dou-docs', region: '上海', status: '运行中' },
  { id: 2, name: 'dou-api', region: '新加坡', status: '部署中' },
  { id: 3, name: 'dou-cron', region: '法兰克福', status: '已停止' },
]
const statusTone: Record<string, 'success' | 'warning' | 'neutral'> = {
  运行中: 'success',
  部署中: 'warning',
  已停止: 'neutral',
}
</script>

<template>
  <div class="doc-theme-editor">
    <div class="doc-theme-editor__controls">
      <div v-for="tone in tones" :key="tone.name" class="doc-theme-editor__field">
        <span class="doc-theme-editor__label">{{ tone.label }}</span>
        <DouColorPicker v-model="state.colors[tone.name]" :aria-label="tone.label" />
      </div>
      <div class="doc-theme-editor__field">
        <span class="doc-theme-editor__label">中性色</span>
        <DouSegmentedControl
          v-model="state.leaning"
          :options="Object.entries(leanings).map(([value, { label }]) => ({ value, label }))"
          size="sm"
        />
      </div>
      <div class="doc-theme-editor__field">
        <span class="doc-theme-editor__label">字号</span>
        <DouSegmentedControl v-model="state.fontSize" :options="[13, 14, 15]" size="sm" />
      </div>
      <div class="doc-theme-editor__field doc-theme-editor__field--wide">
        <span class="doc-theme-editor__label">圆角 {{ state.radius }}px</span>
        <DouSlider v-model="state.radius" :min="0" :max="12" :step="2" aria-label="圆角" />
      </div>
      <div class="doc-theme-editor__field doc-theme-editor__actions">
        <DouSegmentedControl
          v-model="previewMode"
          :options="[
            { value: 'light', label: '亮色' },
            { value: 'dark', label: '暗色' },
          ]"
          size="sm"
        />
        <DouButton variant="ghost" size="sm" @click="reset">重置</DouButton>
      </div>
    </div>

    <div class="doc-theme-editor__preview" :data-dou-theme="previewMode" :style="previewVars">
      <DouSpace wrap>
        <DouButton tone="primary">发布</DouButton>
        <DouButton tone="primary" variant="soft">预览</DouButton>
        <DouButton variant="outline">保存草稿</DouButton>
        <DouButton variant="ghost">取消</DouButton>
        <DouButton tone="danger" variant="soft">删除</DouButton>
      </DouSpace>

      <div class="doc-theme-editor__grid">
        <DouCard title="项目设置" description="修改后对团队所有成员生效。">
          <div class="doc-theme-editor__form">
            <DouInput v-model="form.name" placeholder="负责人" />
            <DouRadioGroup v-model="form.plan">
              <DouRadio value="team">团队版</DouRadio>
              <DouRadio value="personal">个人版</DouRadio>
            </DouRadioGroup>
            <DouCheckbox v-model="form.notify">部署完成后通知我</DouCheckbox>
            <DouSpace align="center">
              <DouSwitch v-model="form.public" />
              <DouText size="sm" variant="secondary">公开访问</DouText>
            </DouSpace>
          </div>
          <template #footer>
            <DouButton variant="ghost" size="sm">取消</DouButton>
            <DouButton tone="primary" size="sm">保存</DouButton>
          </template>
        </DouCard>

        <div class="doc-theme-editor__stack">
          <DouAlert tone="warning" title="证书将在 7 天后过期" />
          <DouSpace wrap>
            <DouTag tone="primary">进行中</DouTag>
            <DouTag tone="success">已通过</DouTag>
            <DouTag tone="warning">待审核</DouTag>
            <DouTag tone="danger">已拒绝</DouTag>
            <DouTag>草稿</DouTag>
          </DouSpace>
          <DouProgress :value="64" tone="primary" show-value />
          <DouTable :columns="columns" :data="rows" row-key="id" size="sm">
            <template #cell-status="{ value }">
              <DouTag :tone="statusTone[value]" size="sm">{{ value }}</DouTag>
            </template>
          </DouTable>
        </div>
      </div>
    </div>

    <DouCodeBlock
      :code="code"
      lang="ts"
      filename="theme.ts"
      :highlight="highlight"
      :max-lines="24"
    />
  </div>
</template>

<style scoped>
.doc-theme-editor {
  display: grid;
  gap: 16px;
  margin-block: 16px;
}

.doc-theme-editor__controls {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 16px;
  align-items: start;
}

.doc-theme-editor__field {
  display: grid;
  gap: 6px;
  justify-items: start;
}

.doc-theme-editor__field--wide {
  justify-items: stretch;
}

.doc-theme-editor__actions {
  display: flex;
  grid-column: 1 / -1;
  justify-content: space-between;
}

.doc-theme-editor__label {
  color: var(--dou-color-text-secondary);
  font-size: var(--dou-font-size-sm);
}

.doc-theme-editor__preview {
  display: grid;
  gap: 16px;
  padding: 20px;
  border: 1px solid var(--dou-color-border);
  border-radius: 12px;
}

.doc-theme-editor__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 16px;
  align-items: start;
}

.doc-theme-editor__form,
.doc-theme-editor__stack {
  display: grid;
  gap: 12px;
  min-width: 0;
}
</style>
