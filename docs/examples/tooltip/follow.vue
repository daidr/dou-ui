<template>
  <DouTooltip content="戴兜 · 14:32 提交" follow-cursor placement="bottom-start">
    <div class="tooltip-follow-demo">在这块区域里移动鼠标</div>
  </DouTooltip>
  <DouTooltip content="移开鼠标就会关闭" :interactive="false">
    <DouButton variant="outline">不可移入</DouButton>
  </DouTooltip>
</template>

<style scoped>
.tooltip-follow-demo {
  display: grid;
  place-items: center;
  width: 280px;
  height: 120px;
  border: 1px dashed var(--dou-color-border-strong);
  border-radius: var(--dou-radius-container);
  color: var(--dou-color-text-tertiary);
}
</style>
