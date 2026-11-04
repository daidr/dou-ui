<script setup>
import { CopyIcon, GlobeIcon, LinkIcon, LockIcon, TrashIcon, UsersIcon } from '@dou-ui/icons'
import { ref } from 'vue'

const access = ref('team')
const last = ref('无')
</script>

<template>
  <div style="display: flex; flex-wrap: wrap; gap: 12px">
    <DouDropdown>
      <DouButton variant="outline">谁可以查看</DouButton>
      <template #menu>
        <DouDropdownRadioGroup v-model="access">
          <DouDropdownItem value="private" description="只有你能查看和编辑">
            <template #prefix>
              <DouIcon><LockIcon /></DouIcon>
            </template>
            仅自己
          </DouDropdownItem>
          <DouDropdownItem value="team" description="上海办公室的成员都能查看，可以评论">
            <template #prefix>
              <DouIcon><UsersIcon /></DouIcon>
            </template>
            团队成员
          </DouDropdownItem>
          <DouDropdownItem
            value="public"
            description="拿到链接的人都能查看，不用登录；链接会出现在浏览记录里，敏感内容不要选这一项"
          >
            <template #prefix>
              <DouIcon><GlobeIcon /></DouIcon>
            </template>
            知道链接的人
          </DouDropdownItem>
        </DouDropdownRadioGroup>
      </template>
    </DouDropdown>
    <DouDropdown @select="(value) => (last = value)">
      <DouButton variant="outline">更多</DouButton>
      <template #menu>
        <DouDropdownItem value="复制链接" shortcut="mod+shift+c" description="粘贴给别人即可打开">
          <template #prefix>
            <DouIcon><LinkIcon /></DouIcon>
          </template>
          复制链接
        </DouDropdownItem>
        <DouDropdownItem value="创建副本" shortcut="mod+d">
          <template #prefix>
            <DouIcon><CopyIcon /></DouIcon>
          </template>
          创建副本
        </DouDropdownItem>
        <DouDropdownItem
          value="删除"
          tone="danger"
          divided
          description="移到回收站，30 天后彻底删除"
        >
          <template #prefix>
            <DouIcon><TrashIcon /></DouIcon>
          </template>
          删除
        </DouDropdownItem>
      </template>
    </DouDropdown>
  </div>
  <DouText variant="tertiary" size="sm">最近的操作：{{ last }}</DouText>
</template>
