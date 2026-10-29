---
wide: true
---

# 登录页

居中的登录卡片：邮箱和密码校验、显示密码、记住登录、提交时的加载状态，以及第三方登录入口。

<DocDemo src="blocks/login" column />

用到的组件：[Form](../components/form)、[Input](../components/input)、[Checkbox](../components/checkbox)、[Button](../components/button)、[Divider](../components/divider)、[Link](../components/link)、[Toast](../components/toast)。

- 提交按钮用 `native-type="submit"`，按 `Enter` 也能提交，校验通过后才触发 `submit`。
- 输入框带上 `autocomplete`，浏览器可以自动填充已保存的账号和密码。
