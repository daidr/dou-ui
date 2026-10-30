<template>
  <DouChatMessage loading />
  <DouChatMessage :parts="[{ type: 'text', text: '正在整理上周的会议记录', streaming: true }]" />
</template>
