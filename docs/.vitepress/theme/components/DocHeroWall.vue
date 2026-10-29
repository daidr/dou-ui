<script setup lang="ts">
import {
  BellIcon,
  CalendarDaysIcon,
  CloudUploadIcon,
  GitBranchIcon,
  SearchIcon,
  SparklesIcon,
  Volume1Icon,
} from '../icons'

/**
 * The home page backdrop: a slowly drifting wall of real DouUI components.
 * It is decoration only, so it is hidden from assistive technology and made
 * inert. Each column is rendered three times and drifts by one copy, so the
 * loop is seamless while two copies still cover the column.
 */
const columns = [
  ['switches', 'stat', 'tags', 'steps', 'command'],
  ['search', 'upload', 'user', 'segmented', 'tones'],
  ['alert', 'slider', 'buttons', 'rate', 'sync'],
  ['avatars', 'checks', 'branch', 'progress', 'event'],
] as const

const tones = ['neutral', 'primary', 'success', 'warning', 'danger'] as const
const steps = [{ title: '设计' }, { title: '开发' }, { title: '发布' }]
</script>

<template>
  <div class="doc-wall" aria-hidden="true" inert>
    <div class="doc-wall__plane">
      <div v-for="(column, c) in columns" :key="c" class="doc-wall__column">
        <div class="doc-wall__track">
          <template v-for="copy in 3" :key="copy">
            <div v-for="tile in column" :key="`${copy}-${tile}`" class="doc-wall__tile">
              <template v-if="tile === 'switches'">
                <div class="doc-wall__row">
                  <span>消息通知</span>
                  <DouSwitch :model-value="true" size="sm" />
                </div>
                <div class="doc-wall__row">
                  <span>自动保存</span>
                  <DouSwitch :model-value="false" size="sm" />
                </div>
              </template>

              <DouStatistic
                v-else-if="tile === 'stat'"
                title="本周访问"
                :value="128430"
                trend="up"
              />

              <div v-else-if="tile === 'tags'" class="doc-wall__wrap">
                <DouTag tone="primary">Vue 3</DouTag>
                <DouTag tone="success">TypeScript</DouTag>
                <DouTag variant="outline">Token</DouTag>
                <DouTag tone="warning" variant="outline">SSR</DouTag>
              </div>

              <DouSteps v-else-if="tile === 'steps'" :items="steps" :current="1" size="sm" />

              <DouInput v-else-if="tile === 'search'" placeholder="搜索组件">
                <template #prefix
                  ><DouIcon><SearchIcon /></DouIcon
                ></template>
                <template #suffix><DouKbd size="sm">/</DouKbd></template>
              </DouInput>

              <template v-else-if="tile === 'upload'">
                <div class="doc-wall__row">
                  <span class="doc-wall__label"
                    ><DouIcon><CloudUploadIcon /></DouIcon>tokens.css</span
                  >
                  <span class="doc-wall__muted">72%</span>
                </div>
                <DouProgress :value="72" size="sm" label="上传进度" />
              </template>

              <DouUser
                v-else-if="tile === 'user'"
                name="戴兜"
                description="前端工程师"
              />

              <DouSegmentedControl
                v-else-if="tile === 'segmented'"
                :model-value="'week'"
                :options="[
                  { value: 'day', label: '日' },
                  { value: 'week', label: '周' },
                  { value: 'month', label: '月' },
                ]"
                size="sm"
                block
              />

              <DouAlert v-else-if="tile === 'alert'" tone="success" title="已保存">
                主题变量已同步。
              </DouAlert>

              <template v-else-if="tile === 'slider'">
                <div class="doc-wall__row">
                  <span class="doc-wall__label"
                    ><DouIcon><Volume1Icon /></DouIcon>音量</span
                  >
                  <span class="doc-wall__muted">60</span>
                </div>
                <DouSlider :model-value="60" size="sm" />
              </template>

              <div v-else-if="tile === 'buttons'" class="doc-wall__wrap">
                <DouButton size="sm">确定</DouButton>
                <DouButton size="sm" variant="outline">取消</DouButton>
                <DouBadge dot tone="danger">
                  <DouButton size="sm" variant="ghost" aria-label="通知">
                    <template #leading
                      ><DouIcon><BellIcon /></DouIcon
                    ></template>
                  </DouButton>
                </DouBadge>
              </div>

              <div v-else-if="tile === 'rate'" class="doc-wall__row">
                <DouRate :model-value="4" readonly size="sm" />
                <span class="doc-wall__muted">4.0</span>
              </div>

              <div v-else-if="tile === 'avatars'" class="doc-wall__row">
                <DouAvatarGroup :max="4" size="sm">
                  <DouAvatar name="陈" />
                  <DouAvatar name="周" />
                  <DouAvatar name="吴" />
                  <DouAvatar name="郑" />
                  <DouAvatar name="王" />
                </DouAvatarGroup>
                <DouButton size="sm" variant="outline">邀请</DouButton>
              </div>

              <div v-else-if="tile === 'checks'" class="doc-wall__stack">
                <DouCheckbox :model-value="true" size="sm">键盘可达</DouCheckbox>
                <DouCheckbox :model-value="true" size="sm">深色模式</DouCheckbox>
                <DouCheckbox :model-value="false" size="sm">从头再来</DouCheckbox>
              </div>

              <div v-else-if="tile === 'branch'" class="doc-wall__row">
                <span class="doc-wall__label"
                  ><DouIcon><GitBranchIcon /></DouIcon>main</span
                >
                <DouTag size="sm" tone="success" round>
                  <template #leading
                    ><DouIcon><SparklesIcon /></DouIcon
                  ></template>
                  已部署
                </DouTag>
              </div>

              <div v-else-if="tile === 'command'" class="doc-wall__row">
                <span>命令面板</span>
                <span class="doc-wall__keys"
                  ><DouKbd size="sm">⌘</DouKbd><DouKbd size="sm">K</DouKbd></span
                >
              </div>

              <div v-else-if="tile === 'tones'" class="doc-wall__row">
                <span>色调</span>
                <span class="doc-wall__tones">
                  <span
                    v-for="tone in tones"
                    :key="tone"
                    class="doc-wall__tone"
                    :style="{ backgroundColor: `var(--dou-color-${tone})` }"
                  />
                </span>
              </div>

              <div v-else-if="tile === 'sync'" class="doc-wall__row">
                <span class="doc-wall__label"><DouSpinner size="sm" />正在同步</span>
                <span class="doc-wall__muted">3 / 8</span>
              </div>

              <template v-else-if="tile === 'event'">
                <div class="doc-wall__row">
                  <span class="doc-wall__label"
                    ><DouIcon><CalendarDaysIcon /></DouIcon>设计评审</span
                  >
                  <span class="doc-wall__muted">14:00</span>
                </div>
                <div class="doc-wall__wrap">
                  <DouTag size="sm">上海</DouTag>
                  <DouTag size="sm" tone="primary">进行中</DouTag>
                </div>
              </template>

              <template v-else-if="tile === 'progress'">
                <div class="doc-wall__row">
                  <span>类型检查</span>
                  <span class="doc-wall__muted">通过</span>
                </div>
                <DouProgress :value="100" tone="success" size="sm" label="类型检查" />
              </template>
            </div>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>
