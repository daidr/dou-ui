<template>
  <DouSpace wrap>
    <DouPopover
      title="默认宽度"
      content="未设置 width 时按内容自然宽度展开，最多不超过 360px，并在视口两侧各留出 8px 间距。"
      placement="bottom-start"
    >
      <DouButton variant="outline">默认宽度（上限 360px）</DouButton>
    </DouPopover>

    <DouPopover title="构建日志摘要" :width="560" placement="bottom-start">
      <DouButton variant="outline">宽弹层（width="560"）</DouButton>
      <template #content>
        <div style="display: flex; flex-direction: column; gap: 6px; font-size: 13px">
          <div style="display: flex; justify-content: space-between; gap: 12px">
            <span>上海节点 · 生产环境部署 #482</span>
            <DouText variant="tertiary" size="sm">耗时 14.2s</DouText>
          </div>
          <pre
            style="
              margin: 0;
              padding: 8px 10px;
              border-radius: 6px;
              background: var(--dou-color-bg-muted);
              font-family: var(--dou-font-family-mono);
              font-size: 12px;
              line-height: 1.5;
              overflow-x: auto;
            "
          ><code>[14:22:01] bun run build --filter dou-ui
[14:22:09] dist/index.js 142.8 kB │ gzip: 38.4 kB
[14:22:15] 部署完成，已切换至最新静态资源（操作人：戴兜）</code></pre>
        </div>
      </template>
    </DouPopover>
  </DouSpace>
</template>
