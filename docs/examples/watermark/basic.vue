<template>
  <DouWatermark :content="['戴兜', '内部资料 请勿外传']" style="width: 100%">
    <DouCard title="第三季度复盘">
      <DouText as="p" variant="secondary">
        本季度完成了组件库的首次发版准备，文档站迁移到自建主题，图标扩充到七百多个。下季度的重点是补齐长尾组件，并在两个内部项目中试用。
      </DouText>
      <DouText as="p" variant="secondary">
        遗留问题：表格在超过一万行时首次渲染偏慢；日期选择在部分移动端浏览器上弹出位置偏移，需要单独排查。
      </DouText>
    </DouCard>
  </DouWatermark>
</template>
