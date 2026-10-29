<script setup>
function load(node) {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(
        node.key === 'root'
          ? [
              { key: 'root/a', label: 'logs' },
              { key: 'root/b', label: 'cache', isLeaf: true },
            ]
          : [
              { key: `${node.key}/1`, label: '2026-10-27.log', isLeaf: true },
              { key: `${node.key}/2`, label: '2026-10-28.log', isLeaf: true },
            ],
      )
    }, 800)
  })
}
const remote = [{ key: 'root', label: 'var' }]
</script>

<template>
  <DouTree :data="remote" :load="load" aria-label="目录" />
</template>
