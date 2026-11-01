<!-- @checkUnknownProps true -->
<!-- @checkUnknownEvents true -->
<!--
  类型测试：开启严格检查后，组件上能写 aria-*、data-* 和组件转交的原生属性、事件。
  由 `bun run typecheck` 检查，不参与运行。
-->
<script setup lang="ts">
import { SearchIcon } from '@dou-ui/icons'
import {
  DouButton,
  DouCard,
  DouCheckTag,
  DouCheckTagGroup,
  DouCheckbox,
  DouConfigProvider,
  DouInput,
  DouLink,
  DouSelect,
  DouSwitch,
  DouTable,
  DouTextarea,
} from '../index'

const label = '通知'
const text = ''
</script>

<template>
  <!-- 声明了 ariaLabel 的组件 -->
  <DouSwitch aria-label="通知" />
  <DouSwitch :aria-label="label" />
  <!-- 没有 ariaLabel 的组件 -->
  <DouButton aria-describedby="hint" aria-hidden="true" aria-description="提交表单" />
  <DouCheckTag aria-label="上海" />
  <DouCheckTagGroup :aria-label="label" />
  <!-- data-*：静态、动态、多段 -->
  <DouButton data-testid="submit" :data-state="label" data-dou-nodrag />
  <!-- 单独使用的图标：根元素是 <svg>，SVG 属性和事件都能写 -->
  <SearchIcon aria-hidden="true" data-icon="search" />
  <SearchIcon id="search" role="img" focusable="false" @click="(event: MouseEvent) => event" />
  <!-- 普通元素 -->
  <div data-placement="top" :data-index="1" aria-description="说明" />
  <svg data-kind="mark" />

  <!-- 组件转交的原生属性与事件 -->
  <DouInput
    v-model="text"
    placeholder="城市"
    maxlength="20"
    autocomplete="off"
    @keydown="(event: KeyboardEvent) => event.key"
    @clear="() => {}"
  />
  <DouTextarea placeholder="备注" :rows="3" spellcheck="false" />
  <DouButton id="submit" form="order" autofocus title="提交" @mousedown="() => {}" />
  <DouLink href="/" target="_blank" rel="noopener">首页</DouLink>
  <DouCard as="a" href="#card" title="卡片" />
  <DouSelect :model-value="null" :options="[]" id="city" tabindex="-1" />
  <!-- 泛型组件 -->
  <DouTable id="orders" :data="[]" :columns="[]" @keydown="() => {}" />
  <DouCheckbox name="agree" required @focus="(event: FocusEvent) => event" />
  <DouSwitch name="notify" autofocus />

  <!-- @vue-expect-error 拼错的 aria 属性仍然报错 -->
  <DouButton aria-lable="通知" />
  <!-- @vue-expect-error aria 属性的取值仍然受检 -->
  <DouButton aria-hidden="maybe" />
  <!-- @vue-expect-error 拼错的原生属性仍然报错 -->
  <DouInput placeholdr="城市" />
  <!-- @vue-expect-error 按钮类组件自己定类型，不接受原生 type（DouButton 用 nativeType） -->
  <DouButton type="submit" />
  <!-- @vue-expect-error -->
  <DouCheckTag type="submit" />
  <!-- @vue-expect-error 不转交的属性仍然报错：按钮没有 placeholder -->
  <DouButton maxlength="3" />
  <!-- @vue-expect-error 同名时以组件自己的为准：change 收到的是值，不是事件 -->
  <DouSelect :model-value="null" :options="[]" @change="(event: Event) => event" />
  <!-- @vue-expect-error 图标的 size 以图标的 prop 为准 -->
  <SearchIcon :size="{}" />
  <!-- @vue-expect-error 卡片换成按钮时也不接受原生 type -->
  <DouCard as="button" type="submit" />
  <!-- @vue-expect-error 不渲染元素的组件不接受原生属性 -->
  <DouConfigProvider id="config" />
</template>
