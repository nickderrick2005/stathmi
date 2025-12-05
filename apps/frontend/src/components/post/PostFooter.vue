<script setup lang="ts">
/**
 * 帖子底部信息栏
 * 左：时间 | 中：图片切换 | 右：统计数据
 */
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { useQuickConfirm } from '@/composables/useQuickConfirm';

const props = defineProps<{
  createdAt: string;
  updatedAt?: string | null;
  reactionCount: number;
  messageCount: number;
  imageCount: number;
  currentIndex: number;
}>();

const emit = defineEmits<{
  goToImage: [index: number];
  openImageViewer: [];
}>();

const router = useRouter();
const { confirm } = useQuickConfirm();

// 格式化时间
const displayTime = computed(() => {
  const format = (ts: string) => {
    const date = new Date(ts);
    const hours = (Date.now() - date.getTime()) / 3600000;
    if (hours < 24) return '今天';
    if (hours < 168) return `${Math.floor(hours / 24)}天前`;
    return date.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' });
  };

  if (!props.updatedAt) return format(props.createdAt);

  const created = new Date(props.createdAt).getTime();
  const updated = new Date(props.updatedAt).getTime();
  // 编辑过（差>1分钟）显示更新时间
  return updated - created > 60000 ? `${format(props.updatedAt)}↑` : format(props.createdAt);
});

// 格式化日期区间显示
function formatDateRange(from: Date, to: Date): string {
  const format = (d: Date) => d.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' });
  const fromStr = format(from);
  const toStr = format(to);
  return fromStr === toStr ? fromStr : `${fromStr} - ${toStr}`;
}

// 搜索该日期前后的内容（前一天开始，当天结束）
async function searchByDate(e: Event) {
  const date = new Date(props.updatedAt || props.createdAt);
  // 前一天 00:00:00
  const fromDate = new Date(date);
  fromDate.setDate(fromDate.getDate() - 1);
  fromDate.setHours(0, 0, 0, 0);
  // 当天 23:59:59.999
  const toDate = new Date(date);
  toDate.setHours(23, 59, 59, 999);

  const confirmed = await confirm(e, `搜索 ${formatDateRange(fromDate, toDate)} 的帖子？`);
  if (!confirmed) return;

  router.push({
    path: '/search',
    query: {
      time: 'custom',
      time_from: fromDate.toISOString(),
      time_to: toDate.toISOString(),
    },
  });
}

// 图片导航
const canPrev = computed(() => props.currentIndex > 0);
const canNext = computed(() => props.currentIndex < props.imageCount - 1);

// 格式化数字
const formatCount = (n: number, useShortFormat = false) => {
  // 评论数用 k 格式
  if (useShortFormat && n >= 1000) {
    return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  }
  return String(n);
};
</script>

<template>
  <div class="post-footer">
    <!-- 左：时间 -->
    <span class="date" @click.stop="searchByDate($event)">{{ displayTime }}</span>

    <!-- 中：图片切换器（或占位） -->
    <div class="center" @click.stop @touchstart.stop @touchend.stop>
      <template v-if="imageCount > 1">
        <button @click.stop="emit('goToImage', canPrev ? currentIndex - 1 : imageCount - 1)">‹</button>
        <span @click.stop="emit('openImageViewer')">{{ currentIndex + 1 }}/{{ imageCount }}</span>
        <button @click.stop="emit('goToImage', canNext ? currentIndex + 1 : 0)">›</button>
      </template>
    </div>

    <!-- 右：统计 -->
    <div class="stats">
      <span><img src="@/assets/icons/heart.svg" alt="" />{{ formatCount(reactionCount) }}</span>
      <span><img src="@/assets/icons/message.svg" alt="" />{{ formatCount(messageCount, true) }}</span>
    </div>
  </div>
</template>

<style scoped>
.post-footer {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  font-size: 12px;
  color: var(--opz-text-secondary);
}

.date {
  justify-self: start;
  cursor: pointer;
  white-space: nowrap;
}

.date:hover {
  color: var(--opz-text-primary);
  text-decoration: underline;
}

.center {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1px;
}

.center button {
  width: 18px;
  height: 18px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: inherit;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
}

.center button:hover {
  background: color-mix(in srgb, var(--opz-text-primary) 15%, transparent);
  color: var(--opz-text-primary);
}

.center span {
  min-width: 24px;
  text-align: center;
  cursor: pointer;
  padding: 0 4px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 500;
}

.center span:hover {
  background: color-mix(in srgb, var(--opz-text-primary) 15%, transparent);
  color: var(--opz-text-primary);
}

.stats {
  display: flex;
  align-items: center;
  justify-self: end;
  gap: 8px;
  white-space: nowrap;
}

.stats span {
  display: flex;
  align-items: center;
  gap: 3px;
  font-weight: 500;
}

.stats img {
  width: 14px;
  height: 14px;
  opacity: 0.7;
}

:root[data-theme='dark'] .stats img {
  filter: invert(1);
}

/* 移动端 */
@media (max-width: 768px) {
  .post-footer {
    font-size: 11px;
    grid-template-columns: auto 1fr auto;
  }

  .center {
    justify-self: center;
  }

  .stats {
    gap: 4px;
  }

  .stats span {
    gap: 1px;
  }

  .stats img {
    width: 10px;
    height: 10px;
  }

  .center button {
    width: 14px;
    height: 14px;
    font-size: 11px;
  }

  .center span {
    font-size: 10px;
    min-width: 18px;
    padding: 0 2px;
  }
}
</style>
