# Timeline 时间线

按时间串起一组事件。小圆点挂在一条细线上，语气色只用在圆点上；时间在内容上方，用三级灰色和等宽数字。还在进行中的事件是空心圆点，通向它的线是虚线；正在处理的事件，圆点换成旋转的加载图标。

## 基础用法

<div class="demo demo--column">
  <DouTimeline>
    <DouTimelineItem time="10:42" title="部署成功" tone="success">生产环境 · 耗时 38 秒</DouTimelineItem>
    <DouTimelineItem time="10:41" title="构建完成">产物 1.2 MB</DouTimelineItem>
    <DouTimelineItem time="10:40" title="开始构建">由 daidr 推送触发</DouTimelineItem>
    <DouTimelineItem title="等待审核" pending />
  </DouTimeline>
</div>

```vue
<DouTimeline>
  <DouTimelineItem time="10:42" title="部署成功" tone="success">生产环境 · 耗时 38 秒</DouTimelineItem>
  <DouTimelineItem time="10:41" title="构建完成">产物 1.2 MB</DouTimelineItem>
  <DouTimelineItem title="等待审核" pending />
</DouTimeline>
```

## 语气与自定义圆点

`tone` 只给圆点上色。`dot` 插槽可以换成图标，图标取同样的语气色。

<div class="demo demo--column">
  <DouTimeline>
    <DouTimelineItem time="周一" title="创建项目" tone="primary" />
    <DouTimelineItem time="周二" title="配置域名" tone="warning">证书签发中，可能需要几分钟。</DouTimelineItem>
    <DouTimelineItem time="周三" title="部署失败" tone="danger">
      <template #dot>
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><circle cx="8" cy="8" r="6.25" /><path d="M6 6l4 4M10 6l-4 4" /></svg>
      </template>
      构建脚本退出码 1。
    </DouTimelineItem>
  </DouTimeline>
</div>

```vue
<DouTimelineItem time="周三" title="部署失败" tone="danger">
  <template #dot><svg>…</svg></template>
  构建脚本退出码 1。
</DouTimelineItem>
```

## 加载中

`loading` 表示这一步正在处理：圆点换成旋转的加载图标，取同样的语气色，通向它的线是虚线。`pending` 是还没轮到，`loading` 是正在做。

<div class="demo demo--column">
  <DouTimeline>
    <DouTimelineItem time="10:40" title="拉取代码" tone="success" />
    <DouTimelineItem time="10:41" title="安装依赖" tone="success" />
    <DouTimelineItem time="10:42" title="正在构建" tone="primary" loading>已用时 12 秒</DouTimelineItem>
    <DouTimelineItem title="部署到上海节点" pending />
  </DouTimeline>
</div>

```vue
<DouTimeline>
  <DouTimelineItem time="10:41" title="安装依赖" tone="success" />
  <DouTimelineItem time="10:42" title="正在构建" tone="primary" loading>已用时 12 秒</DouTimelineItem>
  <DouTimelineItem title="部署到上海节点" pending />
</DouTimeline>
```

## 倒序

`reverse` 把最新的事件显示在最上面，事件仍按时间先后书写。

<div class="demo demo--column">
  <DouTimeline reverse>
    <DouTimelineItem time="09:00" title="提交代码" />
    <DouTimelineItem time="09:05" title="通过检查" tone="success" />
    <DouTimelineItem title="等待合并" pending />
  </DouTimeline>
</div>

## 读屏

时间线是一个有序列表 `<ol>`，左侧的圆点与连线只是装饰（`aria-hidden`），含义写在时间、标题和内容里。`loading` 的事件带 `aria-busy="true"`。

## API

### Timeline Props

| 名称      | 说明                   | 类型      | 默认值  |
| --------- | ---------------------- | --------- | ------- |
| `reverse` | 最新的事件显示在最上面 | `boolean` | `false` |

### TimelineItem Props

| 名称      | 说明                                         | 类型                                                           | 默认值      |
| --------- | -------------------------------------------- | -------------------------------------------------------------- | ----------- |
| `time`    | 时间                                         | `string`                                                       | —           |
| `title`   | 标题，详情放在默认插槽                       | `string`                                                       | —           |
| `tone`    | 圆点的语气色                                 | `'neutral' \| 'primary' \| 'success' \| 'warning' \| 'danger'` | `'neutral'` |
| `pending` | 进行中：空心圆点，通向它的线为虚线           | `boolean`                                                      | `false`     |
| `loading` | 正在处理：圆点换成加载图标，通向它的线为虚线 | `boolean`                                                      | `false`     |

### TimelineItem Slots

| 名称      | 说明     |
| --------- | -------- |
| `default` | 详情     |
| `dot`     | 替换圆点 |
| `time`    | 替换时间 |
| `title`   | 替换标题 |

### CSS 变量

| 变量                      | 说明           |
| ------------------------- | -------------- |
| `--dou-timeline-dot-size` | 圆点直径       |
| `--dou-timeline-spacing`  | 事件之间的距离 |
| `--dou-timeline-line`     | 连线颜色       |
