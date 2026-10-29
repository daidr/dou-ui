<template>
  <DouTooltip
    v-for="placement in ['top', 'bottom', 'left', 'right', 'top-start', 'bottom-end']"
    :key="placement"
    :content="placement"
    :placement="placement"
  >
    <DouButton variant="outline" size="sm">{{ placement }}</DouButton>
  </DouTooltip>
</template>
