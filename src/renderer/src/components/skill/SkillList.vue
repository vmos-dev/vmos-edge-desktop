<template>
  <div class="skill-list">
    <div v-if="groupTitle" class="skill-group-title">{{ groupTitle }}</div>
    <div v-if="skills.length === 0" class="skill-empty">
      {{ t('skill.empty') }}
    </div>
    <div v-else class="skill-grid">
      <div
        v-for="skill in skills"
        :key="skill.name"
        class="skill-card"
        :class="{ active: activeId === skill.name }"
        @click="$emit('select', skill)"
      >
        <div class="skill-card-icon">
          <slot name="icon" :skill="skill">
            <div class="skill-card-icon-char">
              {{ (skill.display_name || skill.name).charAt(0) }}
            </div>
          </slot>
        </div>
        <div class="skill-card-body">
          <div class="skill-card-name">{{ skill.display_name || skill.name }}</div>
          <el-tooltip
            v-if="skill.description"
            :content="skill.description"
            placement="top"
            :show-after="500"
            :hide-after="0"
          >
            <div class="skill-card-desc">{{ skill.description }}</div>
          </el-tooltip>
        </div>
        <div class="skill-card-action" @click.stop>
          <slot
            name="action"
            :skill="skill"
            :toggle="(enabled: boolean) => $emit('toggle', skill, enabled)"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { SkillListItem } from './types'

const { t } = useI18n()

withDefaults(
  defineProps<{
    skills: SkillListItem[]
    activeId?: string | null
    groupTitle?: string
  }>(),
  {
    activeId: null,
    groupTitle: undefined
  }
)

defineEmits<{
  select: [skill: SkillListItem]
  toggle: [skill: SkillListItem, enabled: boolean]
}>()
</script>

<style scoped lang="scss">
.skill-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.skill-group-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--el-text-color-secondary);
  margin-bottom: 8px;
}

.skill-empty {
  text-align: center;
  padding: 40px 20px;
  font-size: 13px;
  color: var(--el-text-color-placeholder);
}

.skill-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.skill-card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 10px;
  background: var(--el-fill-color-light);
  cursor: pointer;
  transition: background-color 0.2s;
  min-width: 0;
  overflow: hidden;

  &:hover {
    background: var(--el-fill-color);
  }

  &.active {
    background: var(--el-color-primary-light-9);
  }
}

.skill-card-icon {
  flex-shrink: 0;
}

.skill-card-icon-char {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
  font-size: 18px;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
}

.skill-card-body {
  flex: 1;
  min-width: 0;
}

.skill-card-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.skill-card-desc {
  margin-top: 2px;
  font-size: 13px;
  color: var(--el-text-color-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.skill-card-action {
  flex-shrink: 0;
}
</style>
