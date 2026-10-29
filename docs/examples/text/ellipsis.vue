<template>
  <DouText truncate style="max-width: 240px">
    一段很长很长的文字，超出宽度之后会以省略号结尾，而不是撑破布局。
  </DouText>
  <DouText :truncate="2" style="max-width: 240px" variant="secondary">
    多行截断同理：这段文字最多显示两行，剩下的部分会被省略号替代，适合卡片中的描述。
  </DouText>
</template>
