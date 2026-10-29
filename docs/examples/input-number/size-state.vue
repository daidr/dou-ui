<template>
  <DouSpace size="sm">
    <DouInputNumber size="sm" :model-value="1" />
    <DouButton size="sm" variant="outline">应用</DouButton>
  </DouSpace>
  <DouSpace size="sm">
    <DouInputNumber :model-value="1" />
    <DouButton variant="outline">应用</DouButton>
  </DouSpace>
  <DouSpace size="sm">
    <DouInputNumber size="lg" :model-value="1" />
    <DouButton size="lg" variant="outline">应用</DouButton>
  </DouSpace>
  <DouSpace size="sm" wrap>
    <DouInputNumber :model-value="5" invalid />
    <DouInputNumber :model-value="5" readonly />
    <DouInputNumber :model-value="5" disabled />
  </DouSpace>
</template>
