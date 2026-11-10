---
type: 不兼容
packages: [editor]
---

协同编辑时光标和选区改放在 awareness 的 `editor` 字段（原来是 `cursor`），和其他包按包名取字段一致。自己读写过 `cursor` 字段的代码改成 `editor`；各端要一起升级，否则新旧版本之间看不到对方的光标。
