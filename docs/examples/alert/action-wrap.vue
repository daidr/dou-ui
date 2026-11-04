<script setup>
const log = () => {}
</script>

<template>
  <div class="alert-wrap-demo">
    <DouAlert tone="primary" title="戴兜邀请你加入「上海门店巡检」">
      接受后可以查看并编辑这个项目的巡检计划。
      <template #action>
        <DouButton size="sm" variant="ghost" @click="log">稍后</DouButton>
        <DouButton size="sm" variant="outline" @click="log">拒绝</DouButton>
        <DouButton size="sm" tone="primary" @click="log">接受</DouButton>
      </template>
    </DouAlert>
  </div>
</template>

<style scoped>
.alert-wrap-demo {
  min-width: 240px;
  max-width: 100%;
  resize: horizontal;
  overflow: auto;
  padding-bottom: 4px;
}
</style>
