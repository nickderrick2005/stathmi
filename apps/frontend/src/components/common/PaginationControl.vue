<script setup lang="ts">
/**
 * 分页控件 - 自定义设计，移动端适配
 * 放弃 Naive UI 默认样式，提供更精致的交互体验
 * 移动端：上一页 / 当前页(点击跳转) / 下一页 三按钮
 */
import { computed, ref, nextTick } from 'vue';
import { NInputNumber } from 'naive-ui';

const props = defineProps<{
  current: number;
  total: number;
  pageSize: number;
  disabled?: boolean;
  showSummary?: boolean;
  /** 紧凑模式，隐藏部分页码 */
  compact?: boolean;
}>();

const emit = defineEmits<{
  'page-change': [page: number];
}>();

// 跳转输入
const jumpInput = ref<number | null>(null);
const showJumper = ref(false);
// 移动端跳转弹出
const showMobileJumper = ref(false);
const mobileJumpInputRef = ref<InstanceType<typeof NInputNumber> | null>(null);

// 计算总页数，确保至少 1 页
const pageCount = computed(() => Math.max(1, Math.ceil((props.total ?? 0) / (props.pageSize || 1))));

// 安全的当前页码
const safeCurrent = computed(() => {
  const page = Number.isFinite(props.current) ? props.current : 1;
  if (page < 1) return 1;
  if (page > pageCount.value) return pageCount.value;
  return page;
});

// 生成页码序列（智能省略）- 桌面端使用
const pageNumbers = computed(() => {
  const total = pageCount.value;
  const current = safeCurrent.value;
  const pages: (number | 'ellipsis-left' | 'ellipsis-right')[] = [];

  if (total <= 7) {
    for (let i = 1; i <= total; i++) pages.push(i);
  } else {
    pages.push(1);

    if (current <= 4) {
      for (let i = 2; i <= 5; i++) pages.push(i);
      pages.push('ellipsis-right');
    } else if (current >= total - 3) {
      pages.push('ellipsis-left');
      for (let i = total - 4; i <= total - 1; i++) pages.push(i);
    } else {
      pages.push('ellipsis-left');
      for (let i = current - 1; i <= current + 1; i++) pages.push(i);
      pages.push('ellipsis-right');
    }

    pages.push(total);
  }

  return pages;
});

function goTo(page: number) {
  if (props.disabled) return;
  if (page < 1 || page > pageCount.value) return;
  if (page === safeCurrent.value) return;
  emit('page-change', page);
}

function goPrev() {
  goTo(safeCurrent.value - 1);
}

function goNext() {
  goTo(safeCurrent.value + 1);
}

// 桌面端跳转
function handleJump() {
  if (jumpInput.value && jumpInput.value >= 1 && jumpInput.value <= pageCount.value) {
    goTo(jumpInput.value);
    showJumper.value = false;
    jumpInput.value = null;
  }
}

function handleJumpKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter') {
    handleJump();
  } else if (e.key === 'Escape') {
    showJumper.value = false;
    jumpInput.value = null;
  }
}

// 移动端点击当前页触发跳转
function openMobileJumper() {
  if (props.disabled || pageCount.value <= 1) return;
  showMobileJumper.value = true;
  jumpInput.value = null;
  nextTick(() => {
    mobileJumpInputRef.value?.focus();
  });
}

function handleMobileJump() {
  if (jumpInput.value && jumpInput.value >= 1 && jumpInput.value <= pageCount.value) {
    goTo(jumpInput.value);
  }
  closeMobileJumper();
}

function closeMobileJumper() {
  showMobileJumper.value = false;
  jumpInput.value = null;
}

function handleMobileJumpKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter') {
    handleMobileJump();
  } else if (e.key === 'Escape') {
    closeMobileJumper();
  }
}
</script>

<template>
  <nav class="pagination" :class="{ disabled: props.disabled, compact: props.compact }" aria-label="分页导航">
    <!-- 摘要信息 -->
    <span v-if="props.showSummary" class="summary">
      <span class="summary-count">{{ props.total }}</span> 条
    </span>

    <!-- 桌面端完整分页 -->
    <div class="pagination-core desktop-only">
      <button
        class="page-btn nav-btn"
        :disabled="safeCurrent <= 1 || props.disabled"
        aria-label="上一页"
        @click="goPrev"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
          <path d="M15 18l-6-6 6-6" />
        </svg>
      </button>

      <div class="page-list">
        <template v-for="item in pageNumbers" :key="item">
          <span v-if="item === 'ellipsis-left' || item === 'ellipsis-right'" class="ellipsis">···</span>
          <button
            v-else
            class="page-btn"
            :class="{ active: item === safeCurrent }"
            :disabled="props.disabled"
            :aria-current="item === safeCurrent ? 'page' : undefined"
            @click="goTo(item as number)"
          >
            {{ item }}
          </button>
        </template>
      </div>

      <button
        class="page-btn nav-btn"
        :disabled="safeCurrent >= pageCount || props.disabled"
        aria-label="下一页"
        @click="goNext"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
          <path d="M9 18l6-6-6-6" />
        </svg>
      </button>

      <!-- 快速跳转 -->
      <div v-if="pageCount > 7" class="jumper">
        <template v-if="!showJumper">
          <button class="jump-trigger" :disabled="props.disabled" @click="showJumper = true">跳页</button>
        </template>
        <template v-else>
          <NInputNumber
            v-model:value="jumpInput"
            :min="1"
            :max="pageCount"
            :show-button="false"
            placeholder="页码"
            size="small"
            class="jump-input"
            autofocus
            @keydown="handleJumpKeydown"
            @blur="showJumper = false"
          />
        </template>
      </div>
    </div>

    <!-- 移动端极简分页：上一页 / 当前页 / 下一页 -->
    <div class="pagination-core mobile-only">
      <button
        class="page-btn nav-btn"
        :disabled="safeCurrent <= 1 || props.disabled"
        aria-label="上一页"
        @click="goPrev"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
          <path d="M15 18l-6-6 6-6" />
        </svg>
      </button>

      <!-- 当前页按钮，点击弹出跳转 -->
      <button
        class="page-btn current-page-btn"
        :class="{ 'jumper-open': showMobileJumper }"
        :disabled="props.disabled"
        @click="openMobileJumper"
      >
        <template v-if="!showMobileJumper">
          <span class="current-num">{{ safeCurrent }}</span>
          <span class="page-separator">/</span>
          <span class="total-num">{{ pageCount }}</span>
        </template>
        <NInputNumber
          v-else
          ref="mobileJumpInputRef"
          v-model:value="jumpInput"
          :min="1"
          :max="pageCount"
          :show-button="false"
          :placeholder="`1-${pageCount}`"
          size="small"
          class="mobile-jump-input"
          @keydown="handleMobileJumpKeydown"
          @blur="closeMobileJumper"
        />
      </button>

      <button
        class="page-btn nav-btn"
        :disabled="safeCurrent >= pageCount || props.disabled"
        aria-label="下一页"
        @click="goNext"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
          <path d="M9 18l6-6-6-6" />
        </svg>
      </button>
    </div>
  </nav>
</template>

<style scoped>
.pagination {
  --pg-btn-size: 36px;
  --pg-btn-radius: 10px;
  --pg-gap: 6px;
  --pg-accent: var(--opz-primary, #5865f2);
  --pg-accent-soft: color-mix(in srgb, var(--pg-accent) 12%, transparent);
  --pg-text: var(--opz-text-primary, #2c3e50);
  --pg-text-muted: var(--opz-text-secondary, rgba(60, 60, 60, 0.66));
  --pg-bg: var(--opz-bg-soft, #f8f8f8);
  --pg-bg-hover: var(--opz-bg-mute, #f2f2f2);
  --pg-border: var(--opz-border, rgba(60, 60, 60, 0.12));

  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  font-family: var(--opz-font-family, system-ui);
}

.pagination.disabled {
  opacity: 0.5;
  pointer-events: none;
}

.summary {
  font-size: 14px;
  color: var(--pg-text-muted);
  white-space: nowrap;
}

.summary-count {
  font-weight: 600;
  color: var(--pg-text);
  font-variant-numeric: tabular-nums;
}

.pagination-core {
  display: flex;
  align-items: center;
  gap: var(--pg-gap);
  background: var(--pg-bg);
  padding: 4px;
  border-radius: calc(var(--pg-btn-radius) + 4px);
  border: 1px solid var(--pg-border);
}

.page-list {
  display: flex;
  align-items: center;
  gap: var(--pg-gap);
}

.page-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: var(--pg-btn-size);
  height: var(--pg-btn-size);
  padding: 0 10px;
  border: none;
  border-radius: var(--pg-btn-radius);
  background: transparent;
  color: var(--pg-text);
  font-size: 14px;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
  cursor: pointer;
  transition:
    background-color 0.15s ease,
    color 0.15s ease,
    transform 0.1s ease,
    box-shadow 0.15s ease;
  user-select: none;
}

.page-btn:hover:not(:disabled):not(.active) {
  background: var(--pg-bg-hover);
}

.page-btn:active:not(:disabled) {
  transform: scale(0.95);
}

.page-btn.active {
  background: var(--pg-accent);
  color: #fff;
  font-weight: 600;
  box-shadow:
    0 2px 8px color-mix(in srgb, var(--pg-accent) 35%, transparent),
    inset 0 1px 0 rgba(255, 255, 255, 0.15);
}

.page-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.nav-btn {
  padding: 0;
}

.nav-btn svg {
  width: 18px;
  height: 18px;
}

.ellipsis {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 28px;
  height: var(--pg-btn-size);
  color: var(--pg-text-muted);
  font-size: 14px;
  letter-spacing: 2px;
  user-select: none;
}

/* 桌面端跳转器 */
.jumper {
  margin-left: 4px;
  padding-left: 8px;
  border-left: 1px solid var(--pg-border);
}

.jump-trigger {
  height: var(--pg-btn-size);
  padding: 0 12px;
  border: none;
  border-radius: var(--pg-btn-radius);
  background: transparent;
  color: var(--pg-text-muted);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition:
    background-color 0.15s ease,
    color 0.15s ease;
}

.jump-trigger:hover:not(:disabled) {
  background: var(--pg-bg-hover);
  color: var(--pg-text);
}

.jump-input {
  width: 64px;
}

.jump-input :deep(.n-input__input-el) {
  text-align: center;
  font-variant-numeric: tabular-nums;
}

/* 移动端当前页按钮 */
.current-page-btn {
  min-width: 80px;
  padding: 0 12px;
  gap: 4px;
  background: var(--pg-bg-hover);
}

.current-page-btn:hover:not(:disabled) {
  background: color-mix(in srgb, var(--pg-bg-hover) 80%, var(--pg-text) 5%);
}

.current-page-btn .current-num {
  font-weight: 600;
  color: var(--pg-text);
}

.current-page-btn .page-separator {
  color: var(--pg-text-muted);
  opacity: 0.5;
  margin: 0 2px;
}

.current-page-btn .total-num {
  color: var(--pg-text-muted);
}

.current-page-btn.jumper-open {
  padding: 0 4px;
  min-width: 90px;
  background: var(--pg-bg-hover);
}

.mobile-jump-input {
  width: 100%;
}

.mobile-jump-input :deep(.n-input) {
  background: transparent;
}

.mobile-jump-input :deep(.n-input__input-el) {
  text-align: center;
  font-variant-numeric: tabular-nums;
  font-size: 14px;
}

/* 响应式 */
.desktop-only {
  display: flex;
}

.mobile-only {
  display: none;
}

@media (max-width: 640px) {
  .pagination {
    --pg-btn-size: 42px;
    --pg-btn-radius: 12px;
    --pg-gap: 6px;
    justify-content: center;
  }

  .summary {
    width: 100%;
    text-align: center;
    margin-bottom: 4px;
  }

  .desktop-only {
    display: none;
  }

  .mobile-only {
    display: flex;
  }

  .pagination-core {
    padding: 4px;
  }

  .nav-btn svg {
    width: 20px;
    height: 20px;
  }

  .current-page-btn {
    flex: 1;
    max-width: 120px;
    min-width: 90px;
  }
}

/* 紧凑模式 */
.pagination.compact {
  --pg-btn-size: 32px;
  --pg-btn-radius: 8px;
  --pg-gap: 4px;
  gap: 8px;
}

.pagination.compact .pagination-core {
  padding: 2px;
}

.pagination.compact .page-btn {
  font-size: 13px;
  min-width: 32px;
  padding: 0 8px;
}

.pagination.compact .summary {
  font-size: 13px;
}

/* 紧凑模式移动端 */
@media (max-width: 640px) {
  .pagination.compact {
    --pg-btn-size: 32px;
    --pg-btn-radius: 8px;
    --pg-gap: 3px;
  }

  .pagination.compact .current-page-btn {
    min-width: 70px;
    max-width: 100px;
  }
}

/* 暗色主题适配 */
:root[data-theme='dark'] .pagination {
  --pg-bg: var(--opz-bg-soft, #222);
  --pg-bg-hover: var(--opz-bg-mute, #282828);
  --pg-text: var(--opz-text-primary, #fff);
  --pg-text-muted: var(--opz-text-secondary, rgba(235, 235, 235, 0.64));
  --pg-border: var(--opz-border, rgba(84, 84, 84, 0.48));
}

:root[data-theme='dark'] .page-btn.active {
  box-shadow:
    0 2px 12px color-mix(in srgb, var(--pg-accent) 40%, transparent),
    inset 0 1px 0 rgba(255, 255, 255, 0.1);
}

:root[data-theme='dark'] .current-page-btn {
  background: var(--pg-bg-hover);
}
</style>
