# @dou-ui/resolver

[DouUI](https://github.com/daidr/dou-ui) 的按需自动导入解析器。配合按需组件插件 `unplugin-vue-components` 与自动导入插件 `unplugin-auto-import`，模板里用到的组件会连同它的样式入口自动导入，包括 `dou-ui`、生态系统各个包（`@dou-ui/chart`、`@dou-ui/editor` 等）的组件和 `@dou-ui/icons` 的图标。

```sh
bun add -d @dou-ui/resolver unplugin-vue-components unplugin-auto-import
```

配置方法见 [Vite 集成](https://github.com/daidr/dou-ui/blob/main/docs/integrations/vite.md)。

许可证：MIT
