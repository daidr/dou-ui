<script setup lang="ts">
import { ref, watchEffect } from 'vue'
import type { ButtonSize, ButtonTone, ButtonVariant, TagVariant } from 'dou-ui'

const variants: ButtonVariant[] = ['solid', 'soft', 'outline', 'ghost']
const tones: ButtonTone[] = ['neutral', 'primary', 'success', 'warning', 'danger']
const sizes: ButtonSize[] = ['sm', 'md', 'lg']

const tagVariants: TagVariant[] = ['soft', 'outline', 'solid']

const theme = ref<'light' | 'dark'>(
  new URLSearchParams(location.search).get('theme') === 'dark' ? 'dark' : 'light',
)
const loading = ref(false)

const projectName = ref('dou-ui')
const domain = ref('')
const framework = ref('vue')
const previews = ref(true)
const protect = ref(false)
const notify = ref<string[]>(['deploy'])
const keywords = ref(['vue', 'bun', 'tokens'])

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

            <label class="field">
              <DouText size="sm" weight="medium">项目名称</DouText>
              <DouInput v-model="projectName" clearable />
            </label>

            <label class="field">
              <DouText size="sm" weight="medium">自定义域名</DouText>
              <DouInput v-model="domain" placeholder="example.com" invalid>
                <template #prefix>https://</template>
              </DouInput>
              <DouText size="sm" tone="danger">域名尚未完成解析验证</DouText>
            </label>

            <div class="field">
              <DouText size="sm" weight="medium">框架</DouText>
              <DouRadioGroup v-model="framework">
                <DouRadio value="vue">Vue</DouRadio>
                <DouRadio value="vite">Vite</DouRadio>
                <DouRadio value="static">静态站点</DouRadio>
              </DouRadioGroup>
            </div>

            <div class="field">
              <DouText size="sm" weight="medium">关键词</DouText>
              <DouSpace size="sm" wrap>
                <DouTag
                  v-for="word in keywords"
                  :key="word"
                  closable
                  @close="keywords = keywords.filter((item) => item !== word)"
                >
                  {{ word }}
                </DouTag>
              </DouSpace>
            </div>

            <DouDivider align="start">部署</DouDivider>

            <DouSpace direction="vertical" size="sm">
              <DouSwitch v-model="previews">为每个分支生成预览</DouSwitch>
              <DouSwitch v-model="protect">预览需要登录访问</DouSwitch>
            </DouSpace>

            <DouCheckboxGroup v-model="notify" direction="vertical">
              <DouCheckbox value="deploy">部署成功时通知我</DouCheckbox>
              <DouCheckbox value="fail">部署失败时通知我</DouCheckbox>
            </DouCheckboxGroup>
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
            <DouButton variant="ghost" size="sm">取消</DouButton>
            <DouButton size="sm">保存</DouButton>
          </DouSpace>
        </footer>
      </article>
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
.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
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
