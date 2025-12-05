<script setup lang="ts">
import { computed } from 'vue';
import { NDatePicker } from 'naive-ui';
import type { SearchTimeRange } from '@/types/search';
import ChipButton from '@/components/common/ChipButton.vue';
import FilterCard from '@/components/common/FilterCard.vue';
import { DEFAULT_TIME_FROM_TS, getDefaultTimeToTimestamp } from '@/utils/time-range';

const props = defineProps<{
  timeRange: SearchTimeRange;
  customFrom?: string | null;
  customTo?: string | null;
  label?: string;
  borderless?: boolean;
}>();

const emit = defineEmits<{
  change: [payload: { timeRange: SearchTimeRange; timeFrom?: string | null; timeTo?: string | null }];
}>();

const options: Array<{ value: SearchTimeRange; label: string }> = [
  { value: 'all', label: '不限' },
  { value: '7d', label: '一周内' },
  { value: '30d', label: '一月内' },
  { value: '90d', label: '三月内' },
  { value: 'custom', label: '自定义' },
];

// 用户是否已选择自定义日期
const hasCustomDates = computed(() => Boolean(props.customFrom || props.customTo));

// 日期选择器的值：用户已选则显示用户选择，否则显示默认值
const rangeValue = computed<[number, number] | null>(() => {
  if (props.timeRange !== 'custom') return null;

  const parsedStart = props.customFrom ? Date.parse(props.customFrom) : NaN;
  const parsedEnd = props.customTo ? Date.parse(props.customTo) : NaN;
  const start = Number.isNaN(parsedStart) ? null : parsedStart;
  const end = Number.isNaN(parsedEnd) ? null : parsedEnd;

  // 用户已选择了日期
  if (start !== null && end !== null) {
    return [start, end];
  }

  // 未选择日期时显示默认值
  return [DEFAULT_TIME_FROM_TS, getDefaultTimeToTimestamp()];
});

// 判断当前显示的是否为默认值
const isShowingDefaults = computed(() => props.timeRange === 'custom' && !hasCustomDates.value);

// 日期格式：同年不显示年份，跨年显示年份
const dateFormat = computed(() => {
  const currentYear = new Date().getFullYear();
  const range = rangeValue.value;
  if (!range) return 'M/d';

  const [startTs, endTs] = range;
  const startYear = new Date(startTs).getFullYear();
  const endYear = new Date(endTs).getFullYear();

  // 只要有一个日期不是当前年份，就显示年份
  if (startYear !== currentYear || endYear !== currentYear) {
    return 'yyyy/M/d';
  }
  return 'M/d';
});

function emitChange(payload: { timeRange: SearchTimeRange; timeFrom?: string | null; timeTo?: string | null }) {
  emit('change', {
    timeRange: payload.timeRange,
    timeFrom: payload.timeFrom ?? null,
    timeTo: payload.timeTo ?? null,
  });
}

function selectPreset(value: SearchTimeRange) {
  if (value === props.timeRange && value !== 'custom') return;
  if (value === 'custom' && props.timeRange === 'custom') return;
  emitChange({
    timeRange: value,
    timeFrom: value === 'custom' ? (props.customFrom ?? null) : null,
    timeTo: value === 'custom' ? (props.customTo ?? null) : null,
  });
}

function handleRangeChange(value: [number, number] | null) {
  if (!value) {
    emitChange({ timeRange: 'custom', timeFrom: null, timeTo: null });
    return;
  }
  const [start, end] = value;
  const toIso = (ts: number) => new Date(ts).toISOString();
  emitChange({ timeRange: 'custom', timeFrom: toIso(start), timeTo: toIso(end) });
}

function clearCustomRange() {
  emitChange({ timeRange: 'custom', timeFrom: null, timeTo: null });
}
</script>

<template>
  <FilterCard :title="label || '时间范围'" :borderless="props.borderless">
    <div class="chip-row">
      <ChipButton
        v-for="option in options"
        :key="option.value"
        size="small"
        :active="timeRange === option.value"
        @click="selectPreset(option.value)"
      >
        {{ option.label }}
      </ChipButton>
    </div>

    <div v-if="timeRange === 'custom'" class="custom-range">
      <div class="date-picker-wrapper">
        <NDatePicker
          type="daterange"
          clearable
          :value="rangeValue"
          :format="dateFormat"
          :is-date-disabled="(ts: number) => ts > Date.now()"
          @update:value="handleRangeChange"
        />
        <span v-if="isShowingDefaults" class="default-hint">（默认范围）</span>
      </div>
      <button v-if="hasCustomDates" type="button" class="reset-btn" @click="clearCustomRange">清空日期</button>
    </div>
  </FilterCard>
</template>

<style scoped>
.chip-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.custom-range {
  margin-top: 0.75rem;
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
  align-items: center;
}

.date-picker-wrapper {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.default-hint {
  color: var(--opz-text-tertiary);
  font-size: 0.75rem;
  white-space: nowrap;
}

.reset-btn {
  border: none;
  background: transparent;
  color: var(--opz-text-muted);
  cursor: pointer;
  font-weight: 600;
  font-size: 0.875rem;
  transition: color 0.2s;
}

.reset-btn:hover {
  color: var(--opz-text-primary);
}
</style>
