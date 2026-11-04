---
type: 不兼容
packages: [theme]
pr: 289
version: 0.1.0-alpha.2
---

`ToneTokens` 新增必填的 `soft`，手写完整 `ThemeTokens` 的主题要给每种语气补上：值用 `mixColors(DEFAULT, bg.surface, 0.07)` 算出，或者整组改用 `createTone(color, base)` 生成。用 `defineTheme` 在内置主题上覆盖的主题不受影响。
