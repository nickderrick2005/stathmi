<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { NSpin } from 'naive-ui';
import type { Channel, DisplayMode, PaginationStyle } from '@opz-hub/shared';
import { saveOnboardingPreferences } from '@/api/onboarding';
import { updateUserSettings } from '@/api/users';
import { useMetadataStore } from '@/stores/metadata';
import { useUserStore } from '@/stores/user';
import { useFollowsStore } from '@/stores/follows';
import { usePreferencesStore } from '@/stores/preferences';
import { notifyError, notifySuccess } from '@/utils/notifications';
import { ORIENTATION_OPTIONS } from '@/utils/constants';
import { getDefaultChannelsByOrientations } from '@/utils/onboarding-defaults';
import ChannelCard from '@/components/follows/ChannelCard.vue';
import { RadioGroup, DisplayModeSelector } from '@/components/settings';
import type { RadioOption } from '@/components/settings';

const userStore = useUserStore();
const metadataStore = useMetadataStore();
const followsStore = useFollowsStore();
const preferencesStore = usePreferencesStore();
const router = useRouter();
const route = useRoute();

// 性向偏好（多选）
const selectedOrientations = ref<string[]>([]);

// 频道选择
const selectedChannelIds = ref<string[]>([]);
const isLoadingChannels = ref(false);
const channels = computed<Channel[]>(() => metadataStore.cachedChannels || []);

// 标签选择（通过 ChannelCard 管理）
const selectedTagIds = ref<Set<string>>(new Set());

// 屏蔽的标签名（本地状态，onboarding 完成后不保存）
const blockedTagNames = ref<Set<string>>(new Set());

// 显示设置
const displayMode = ref<DisplayMode>('large');
const paginationStyle = ref<PaginationStyle>('scroll');
const discordLinkMode = ref<'app' | 'browser'>('browser');

const isSubmitting = ref(false);

// 当前步骤：1=性向，2=频道+标签，3=显示设置
const currentStep = ref(1);

const canProceed = computed(() => {
  if (currentStep.value === 1) {
    return selectedOrientations.value.length > 0;
  }
  return true;
});

// 设置选项配置
const paginationOptions: RadioOption<PaginationStyle>[] = [
  { value: 'scroll', label: '滚动式' },
  { value: 'pages', label: '页码式' },
];

const discordLinkOptions: RadioOption<'app' | 'browser'>[] = [
  { value: 'app', label: '打开 App', desc: '唤起 Discord 客户端' },
  { value: 'browser', label: '浏览器', desc: '在浏览器中打开' },
];

// 监听性向选择，自动选择对应的频道
watch(selectedOrientations, (newOrientations) => {
  if (newOrientations.length > 0 && channels.value.length > 0) {
    autoSelectChannels(newOrientations);
  }
});

// 监听频道加载完成，如果已选择性向则自动选择频道
watch(channels, (newChannels) => {
  if (newChannels.length > 0 && selectedOrientations.value.length > 0) {
    autoSelectChannels(selectedOrientations.value);
  }
});

onMounted(async () => {
  loadChannels();
});

async function loadChannels() {
  isLoadingChannels.value = true;
  try {
    await metadataStore.getChannels();
  } catch (error) {
    console.error('[Onboarding] Failed to load channels:', error);
  } finally {
    isLoadingChannels.value = false;
  }
}

/**
 * 根据选中的性向自动选择对应的频道
 */
function autoSelectChannels(orientations: string[]) {
  const defaultChannelNames = getDefaultChannelsByOrientations(orientations);
  const matchedChannels = channels.value.filter((channel) => defaultChannelNames.includes(channel.name));
  selectedChannelIds.value = matchedChannels.map((channel) => channel.id);
}

function toggleOrientation(value: string) {
  const index = selectedOrientations.value.indexOf(value);
  if (index > -1) {
    selectedOrientations.value.splice(index, 1);
  } else {
    selectedOrientations.value.push(value);
  }
}

function handleToggleChannel(channelId: string) {
  const index = selectedChannelIds.value.indexOf(channelId);
  if (index > -1) {
    selectedChannelIds.value.splice(index, 1);
  } else {
    selectedChannelIds.value.push(channelId);
  }
}

function handleToggleTag(tagId: string) {
  if (selectedTagIds.value.has(tagId)) {
    selectedTagIds.value.delete(tagId);
  } else {
    selectedTagIds.value.add(tagId);
  }
  // 触发响应式更新
  selectedTagIds.value = new Set(selectedTagIds.value);
}

function handleBlockTag(tagName: string) {
  blockedTagNames.value.add(tagName);
  blockedTagNames.value = new Set(blockedTagNames.value);
}

function handleUnblockTag(tagName: string) {
  blockedTagNames.value.delete(tagName);
  blockedTagNames.value = new Set(blockedTagNames.value);
}

async function nextStep() {
  if (currentStep.value === 1) {
    if (selectedOrientations.value.length > 0 && channels.value.length > 0) {
      autoSelectChannels(selectedOrientations.value);
    }
    currentStep.value = 2;
  } else if (currentStep.value === 2) {
    currentStep.value = 3;
  } else {
    await completeOnboarding();
  }
}

function prevStep() {
  if (currentStep.value > 1) {
    currentStep.value--;
  }
}

function isErrorWithMessage(error: unknown): error is { message: string } {
  return (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof (error as { message: unknown }).message === 'string'
  );
}

async function completeOnboarding() {
  if (selectedOrientations.value.length === 0) {
    notifyError('请至少选择一个兴趣方向');
    return;
  }

  isSubmitting.value = true;
  try {
    // 保存 onboarding 偏好（性向、频道、标签关注、屏蔽标签）
    await saveOnboardingPreferences({
      orientations: selectedOrientations.value,
      channelIds: selectedChannelIds.value,
      tagIds: [...selectedTagIds.value].filter((id) => /^\d+$/.test(id)),
      blockedTagNames: [...blockedTagNames.value],
    });

    // 保存显示设置
    await updateUserSettings({
      displayMode: displayMode.value,
      paginationStyle: paginationStyle.value,
      discordLinkMode: discordLinkMode.value,
    });

    // 更新前端状态
    userStore.setOrientation(selectedOrientations.value);
    await userStore.loadSettings(true);
    preferencesStore.loadFromUserSettings(userStore.settings);
    await followsStore.loadAll(true);

    notifySuccess('设置完成');

    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/following';
    router.replace(redirect);
  } catch (error: unknown) {
    console.error('[Onboarding] Failed to save preferences:', error);
    if (isErrorWithMessage(error)) {
      if (error.message === 'TAG_NOT_FOUND') {
        notifyError('部分标签不存在，请重新选择');
      } else {
        notifyError('保存失败，请稍后再试');
      }
    } else {
      notifyError('保存失败，请稍后再试');
    }
  } finally {
    isSubmitting.value = false;
  }
}
</script>

<template>
  <div class="onboarding-page">
    <div class="onboarding-container">
      <!-- 头部 -->
      <div class="onboarding-header">
        <h1 class="header-title">首次使用</h1>
        <!-- 步骤指示器 -->
        <div class="step-indicator">
          <span
            v-for="i in 3"
            :key="i"
            class="dot"
            :class="{ active: i === currentStep, done: i < currentStep }"
          ></span>
        </div>
      </div>

      <!-- 步骤内容 -->
      <div class="step-content">
        <!-- 步骤 1: 选择兴趣方向 -->
        <div v-if="currentStep === 1" class="step-container">
          <h3 class="step-title">选择你的兴趣方向</h3>
          <p class="step-hint">可多选，影响首页推荐内容</p>
          <div class="orientation-grid">
            <button
              v-for="option in ORIENTATION_OPTIONS"
              :key="option.value"
              type="button"
              class="orientation-card"
              :class="{ active: selectedOrientations.includes(option.value) }"
              @click="toggleOrientation(option.value)"
            >
              <span class="card-check">✓</span>
              <span class="card-label">{{ option.label }}</span>
              <span class="card-desc">{{ option.desc }}</span>
            </button>
          </div>
        </div>

        <!-- 步骤 2: 选择频道和标签 -->
        <div v-if="currentStep === 2" class="step-container">
          <h3 class="step-title">选择感兴趣的频道</h3>
          <p class="step-hint">点击√/+切换关注频道，展开后，选中关注，点X屏蔽标签</p>
          <div v-if="isLoadingChannels" class="loading">
            <NSpin size="small" />
            <span>加载中...</span>
          </div>
          <div v-else class="channel-cards">
            <ChannelCard
              v-for="channel in channels"
              :key="channel.id"
              :channel="channel"
              :is-followed="selectedChannelIds.includes(channel.id)"
              :followed-tag-ids="selectedTagIds"
              :blocked-tag-names="blockedTagNames"
              @toggle-channel="handleToggleChannel"
              @toggle-tag="handleToggleTag"
              @block-tag="handleBlockTag"
              @unblock-tag="(_, name) => handleUnblockTag(name)"
            />
          </div>
        </div>

        <!-- 步骤 3: 显示设置 -->
        <div v-if="currentStep === 3" class="step-container">
          <h3 class="step-title">设置浏览偏好</h3>
          <p class="step-hint">后续可以点击头像在浏览偏好页修改</p>

          <section class="setting-section">
            <h4 class="setting-label">展示模式</h4>
            <DisplayModeSelector v-model="displayMode" />
          </section>

          <section class="setting-section">
            <h4 class="setting-label">分页模式</h4>
            <p class="step-hint">移动设备滚动式可能卡顿</p>
            <RadioGroup
              :options="paginationOptions"
              :model-value="paginationStyle"
              @update:model-value="paginationStyle = $event"
            />
          </section>

          <section class="setting-section">
            <h4 class="setting-label">Discord 链接</h4>
            <RadioGroup
              :options="discordLinkOptions"
              :model-value="discordLinkMode"
              @update:model-value="discordLinkMode = $event"
            />
            <p v-if="discordLinkMode === 'app'" class="setting-tip warning">
              打开 Discord 客户端可能在某些浏览器上失效，如遇问题请改回浏览器模式
            </p>
          </section>
        </div>
      </div>

      <!-- 步骤导航按钮 -->
      <div class="button-group">
        <button v-if="currentStep > 1" type="button" class="nav-btn secondary" @click="prevStep">上一步</button>
        <button type="button" class="nav-btn primary" :disabled="!canProceed || isSubmitting" @click="nextStep">
          <template v-if="currentStep < 3">下一步</template>
          <template v-else>{{ isSubmitting ? '保存中...' : '完成设置' }}</template>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.onboarding-page {
  min-height: 100vh;
  min-height: 100dvh;
  padding: 2rem 1rem;
  background:
    radial-gradient(ellipse at 20% 0%, rgba(59, 130, 246, 0.08) 0%, transparent 50%),
    radial-gradient(ellipse at 80% 100%, rgba(235, 69, 158, 0.06) 0%, transparent 50%), var(--opz-bg-base);
  background-size: 200% 200%;
  background-attachment: fixed;
  animation: gradient-drift 20s ease-in-out infinite;
  overflow-y: auto;
}

@keyframes gradient-drift {
  0%,
  100% {
    background-position: 0% 0%;
  }
  50% {
    background-position: 100% 100%;
  }
}

.onboarding-container {
  width: 100%;
  max-width: 600px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

/* 桌面端加宽容器以适应两列布局 */
@media (min-width: 768px) {
  .onboarding-container {
    max-width: 900px;
  }
}

/* 头部 */
.onboarding-header {
  text-align: center;
}

.header-title {
  margin: 0;
  font-size: 1.75rem;
  font-weight: 700;
  color: var(--opz-text-primary);
}

.header-desc {
  margin: 0.375rem 0 0;
  font-size: 0.9375rem;
  color: var(--opz-text-tertiary);
}

/* 步骤指示器 */
.step-indicator {
  display: flex;
  justify-content: center;
  gap: 0.5rem;
  margin-top: 1rem;
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: var(--opz-border);
  transition: all 0.2s ease;
}

.dot.active {
  background-color: var(--opz-primary);
  width: 24px;
  border-radius: 4px;
}

.dot.done {
  background-color: var(--opz-primary);
}

/* 步骤内容 */
.step-content {
  background: var(--opz-bg-card);
  border: 1px solid var(--opz-border);
  border-radius: 16px;
  padding: 1.5rem;
}

.step-container {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.step-title {
  margin: 0;
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--opz-text-primary);
}

.step-hint {
  margin: -0.5rem 0 0;
  font-size: 0.8125rem;
  color: var(--opz-text-tertiary);
}

/* 兴趣方向卡片 */
.orientation-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.625rem;
}

@media (min-width: 480px) {
  .orientation-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}

.orientation-card {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.25rem;
  padding: 0.875rem;
  border-radius: 10px;
  border: 1.5px solid var(--opz-border);
  background: var(--opz-bg-base);
  cursor: pointer;
  transition: all 0.15s ease;
  text-align: left;
}

.orientation-card:hover {
  border-color: var(--opz-primary);
  background: var(--opz-bg-elevated);
}

.orientation-card.active {
  border-color: var(--opz-primary);
  background: color-mix(in srgb, var(--opz-primary) 10%, var(--opz-bg-base));
}

.card-check {
  position: absolute;
  top: 0.5rem;
  right: 0.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.125rem;
  height: 1.125rem;
  border-radius: 50%;
  border: 2px solid var(--opz-border);
  font-size: 0.5rem;
  color: transparent;
  background: transparent;
  transition: all 0.15s ease;
}

.orientation-card.active .card-check {
  border-color: var(--opz-primary);
  background: var(--opz-primary);
  color: #fff;
}

.card-label {
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--opz-text-primary);
}

.card-desc {
  font-size: 0.6875rem;
  color: var(--opz-text-tertiary);
  line-height: 1.3;
}

/* 频道卡片列表 - 移动端单列 */
.channel-cards {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

/* 桌面端两列布局 */
@media (min-width: 768px) {
  .channel-cards {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    grid-auto-rows: min-content;
    align-items: start;
    gap: 0.75rem;
  }
}

/* 设置分区 */
.setting-section {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.setting-section + .setting-section {
  margin-top: 1.25rem;
  padding-top: 1.25rem;
  border-top: 1px solid var(--opz-border);
}

.setting-label {
  margin: 0;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--opz-text-primary);
}

.setting-tip {
  margin: 0;
  font-size: 0.75rem;
  color: var(--opz-text-tertiary);
}

.setting-tip.warning {
  color: #ef4444;
}

/* 加载状态 */
.loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 2rem;
  color: var(--opz-text-tertiary);
  font-size: 0.875rem;
}

/* 导航按钮 */
.button-group {
  display: flex;
  gap: 0.75rem;
}

.nav-btn {
  padding: 0.75rem 1.5rem;
  border-radius: 10px;
  border: none;
  font-size: 0.9375rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
}

.nav-btn.primary {
  flex: 1;
  background: var(--opz-primary);
  color: #fff;
}

.nav-btn.primary:hover:not(:disabled) {
  opacity: 0.9;
}

.nav-btn.primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.nav-btn.secondary {
  background: transparent;
  color: var(--opz-text-primary);
  border: 1px solid var(--opz-border);
}

.nav-btn.secondary:hover {
  background: var(--opz-bg-elevated);
}

/* 移动端适配 */
@media (max-width: 480px) {
  .onboarding-page {
    padding: 1rem;
  }

  .header-title {
    font-size: 1.5rem;
  }

  .step-content {
    padding: 1.25rem;
  }

  .orientation-card {
    padding: 0.75rem;
  }

  .card-label {
    font-size: 0.875rem;
  }
}
</style>
