<template>
  <div class="row">
    <div class="item">
      <DouProgress type="dashboard" :value="38" show-value label="CPU" :width="112" />
      <DouText size="sm" variant="secondary">CPU</DouText>
    </div>
    <div class="item">
      <DouProgress
        type="dashboard"
        :value="72"
        tone="warning"
        show-value
        label="内存"
        :width="112"
      />
      <DouText size="sm" variant="secondary">内存</DouText>
    </div>
    <div class="item">
      <DouProgress
        type="dashboard"
        :value="13.6"
        :max="16"
        tone="danger"
        size="lg"
        show-value
        label="磁盘"
        :width="112"
      >
        <template #value="{ value }">{{ value }}<small> GB</small></template>
      </DouProgress>
      <DouText size="sm" variant="secondary">磁盘</DouText>
    </div>
  </div>
</template>

<style scoped>
.row {
  display: flex;
  flex-wrap: wrap;
  gap: 28px;
}
.item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}
small {
  color: var(--dou-color-text-tertiary);
  font-size: var(--dou-font-size-sm);
}
</style>
