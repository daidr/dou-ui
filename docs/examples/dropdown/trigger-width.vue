<template>
  <DouDropdown trigger="hover" same-width>
    <DouButton variant="outline" style="width: 180px">指向打开</DouButton>
    <template #menu>
      <DouDropdownItem>个人资料</DouDropdownItem>
      <DouDropdownItem>团队设置</DouDropdownItem>
      <DouDropdownItem divided>退出登录</DouDropdownItem>
    </template>
  </DouDropdown>
</template>
