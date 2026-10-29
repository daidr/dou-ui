<template>
  <DouText>
    <DouHighlight
      text="上海的仓库已发货，预计明天送达浦东新区。"
      :keywords="['上海', '浦东新区', '明天']"
    />
  </DouText>
  <DouText>
    <DouHighlight text="Cat, category and cats." keywords="cat" whole-word />
  </DouText>
</template>
