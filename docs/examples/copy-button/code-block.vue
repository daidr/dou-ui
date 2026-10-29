<template>
  <div class="copy-demo">
    <code>bun add dou-ui</code>
    <DouCopyButton text="bun add dou-ui" size="sm" />
  </div>
</template>

<style>
.copy-demo {
  display: flex;
  align-items: center;
  justify-content: space-between;
  max-width: 360px;
  padding: 6px 6px 6px 16px;
  border: 1px solid var(--dou-color-border-subtle);
  border-radius: var(--dou-radius-container);
  background-color: color-mix(in oklab, var(--dou-color-text) 2.5%, var(--dou-color-bg-surface));
}
.copy-demo code {
  padding: 0;
  background: none;
  font-size: 14px;
}
</style>
