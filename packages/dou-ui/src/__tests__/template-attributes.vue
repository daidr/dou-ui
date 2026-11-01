<!-- @checkUnknownProps true -->
<!--
  类型测试：开启 checkUnknownProps 后，组件和元素上都能写 aria-* 与 data-*。
  由 `bun run typecheck` 检查，不参与运行。
-->
<script setup lang="ts">
import { SearchIcon } from '@dou-ui/icons'
import { DouButton, DouCheckTag, DouCheckTagGroup, DouSwitch } from '../index'

const label = '通知'
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
  <!-- 单独使用的图标 -->
  <SearchIcon aria-hidden="true" data-icon="search" />
  <!-- 普通元素 -->
  <div data-placement="top" :data-index="1" aria-description="说明" />
  <svg data-kind="mark" />

  <!-- @vue-expect-error 拼错的 aria 属性仍然报错 -->
  <DouButton aria-lable="通知" />
  <!-- @vue-expect-error aria 属性的取值仍然受检 -->
  <DouButton aria-hidden="maybe" />
  <!-- @vue-expect-error 只放过 data-*，不放过叫 data 的 prop -->
  <DouButton :data="[]" />
</template>
