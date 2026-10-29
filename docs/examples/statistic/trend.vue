<template>
  <DouStatistic title="本月收入" :value="1284530.5" :precision="2" prefix="¥" trend="up">
    <template #footer>比上月 +12.4%</template>
  </DouStatistic>
  <DouStatistic title="平均响应" :value="182" suffix="ms" trend="up" :up-is-good="false">
    <template #footer>比上周 +18ms</template>
  </DouStatistic>
  <DouStatistic title="错误数" :value="3" trend="down" :up-is-good="false">
    <template #footer>比昨天 −9</template>
  </DouStatistic>
</template>
