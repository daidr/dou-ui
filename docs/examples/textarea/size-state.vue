<template>
  <DouSpace size="sm" align="start" block>
    <DouTextarea size="sm" :rows="1" placeholder="sm · 1 行" />
    <DouInput size="sm" placeholder="sm 输入框" />
  </DouSpace>
  <DouTextarea model-value="内容格式不正确" invalid :rows="2" />
  <DouTextarea model-value="只读内容" readonly :rows="2" />
  <DouTextarea placeholder="禁用" disabled :rows="2" />
</template>
