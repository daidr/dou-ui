<script setup>
const sections = Array.from({ length: 40 }, (_, index) => ({
  id: index,
  file: `src/modules/feature-${String(index + 1).padStart(2, '0')}.ts`,
  lines: Array.from(
    { length: 12 + (index % 4) * 4 },
    (__, line) => `const value_${line + 1} = compute(${index}, ${line + 1})`,
  ),
}))
</script>

<template>
  <DouCard padding="none">
    <DouVirtualList :items="sections" item-key="id" :estimate-size="360" :height="320">
      <template #default="{ item }">
        <section class="vl-section">
          <header class="vl-section__head">
            <DouText mono weight="medium" size="sm">{{ item.file }}</DouText>
            <DouText variant="tertiary" size="sm">{{ item.lines.length }} 行</DouText>
          </header>
          <div class="vl-section__body">
            <div v-for="(line, at) in item.lines" :key="at" class="vl-section__line">
              <span class="vl-section__num">{{ at + 1 }}</span>
              <code>{{ line }}</code>
            </div>
          </div>
        </section>
      </template>
    </DouVirtualList>
  </DouCard>
</template>

<style>
.vl-section {
  border-bottom: 1px solid var(--dou-color-border-subtle);
}
.vl-section__head {
  position: sticky;
  top: 0;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px;
  border-bottom: 1px solid var(--dou-color-border-subtle);
  background: var(--dou-color-bg-muted);
}
.vl-section__body {
  padding: 6px 0;
  font-family: var(--dou-font-family-mono);
  font-size: 12px;
  line-height: 20px;
}
.vl-section__line {
  display: flex;
  gap: 12px;
  padding: 0 16px;
}
.vl-section__num {
  min-width: 24px;
  color: var(--dou-color-text-tertiary);
  text-align: right;
  user-select: none;
}
</style>
