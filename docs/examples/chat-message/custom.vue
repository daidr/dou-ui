<script setup>
const sources = [
  {
    title: '上海市气象局',
    url: 'https://weather.example.com',
    description: '今日最高 24 度，最低 18 度。',
  },
]
const parts = [
  { type: 'text', text: '今天上海最高 24 度[1]，下面是未来三天：' },
  {
    type: 'forecast',
    days: [
      { day: '周五', weather: '多云', range: '18–24°' },
      { day: '周六', weather: '晴', range: '17–25°' },
      { day: '周日', weather: '小雨', range: '16–21°' },
    ],
  },
  { type: 'sources', items: sources },
]

// Turns "[1]" in the text into citations.
function pieces(text) {
  return text.split(/(\[\d+\])/).map((piece) => {
    const match = /^\[(\d+)\]$/.exec(piece)
    return match ? { index: Number(match[1]) } : { text: piece }
  })
}
</script>

<template>
  <DouChatMessage :parts="parts">
    <template #text="{ text }">
      <template v-for="(piece, i) in pieces(text)" :key="i">
        <DouChatCitation
          v-if="piece.index"
          :index="piece.index"
          :source="sources[piece.index - 1]"
        />
        <template v-else>{{ piece.text }}</template>
      </template>
    </template>
    <template #part="{ part }">
      <div v-if="part.type === 'forecast'" class="forecast">
        <div v-for="day in part.days" :key="day.day" class="day">
          <strong>{{ day.day }}</strong>
          <span>{{ day.weather }}</span>
          <span class="range">{{ day.range }}</span>
        </div>
      </div>
    </template>
  </DouChatMessage>
</template>

<style scoped>
.forecast {
  display: flex;
  gap: 8px;
}

.day {
  display: flex;
  flex-direction: column;
  gap: 2px;
  width: 96px;
  padding: 10px 12px;
  border: 1px solid var(--dou-color-border);
  border-radius: var(--dou-radius-container);
  font-size: var(--dou-font-size-sm);
}

.range {
  color: var(--dou-color-text-tertiary);
}
</style>
