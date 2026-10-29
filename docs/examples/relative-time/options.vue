<script setup>
const now = Date.now()
const day = 24 * 60 * 60_000
</script>

<template>
  <table class="options">
    <thead>
      <tr>
        <th>写法</th>
        <th>显示</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>默认</td>
        <td><DouRelativeTime :value="now - day" /></td>
      </tr>
      <tr>
        <td><code>numeric="always"</code></td>
        <td><DouRelativeTime :value="now - day" numeric="always" /></td>
      </tr>
      <tr>
        <td><code>short</code></td>
        <td><DouRelativeTime :value="now - 3 * 60 * 60_000" short /></td>
      </tr>
      <tr>
        <td><code>:absolute-after="7 * day"</code></td>
        <td><DouRelativeTime :value="now - 40 * day" :absolute-after="7 * day" /></td>
      </tr>
      <tr>
        <td><code>format="YYYY年MM月DD日"</code></td>
        <td>
          <DouRelativeTime
            :value="now - 40 * day"
            :absolute-after="7 * day"
            format="YYYY年MM月DD日"
          />
        </td>
      </tr>
    </tbody>
  </table>
</template>

<style scoped>
.options {
  border-collapse: collapse;
  font-size: var(--dou-font-size-md);
}
.options th,
.options td {
  padding: 6px 24px 6px 0;
  text-align: start;
}
.options th {
  color: var(--dou-color-text-secondary);
  font-weight: var(--dou-font-weight-medium);
}
.options code {
  font-family: var(--dou-font-family-mono);
  font-size: var(--dou-font-size-sm);
}
</style>
