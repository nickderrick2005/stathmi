<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useMediaQuery } from '@vueuse/core';
import { NPopover } from 'naive-ui';
import { useMetadataStore } from '@/stores/metadata';
import { usePersistentFiltersStore } from '@/stores/filters';
import { useFollowsStore } from '@/stores/follows';
import { useScrollHideOnDown } from '@/composables/useScrollHideOnDown';
import type { Channel } from '@opz-hub/shared';

const router = useRouter();
const metadataStore = useMetadataStore();
const filtersStore = usePersistentFiltersStore();
const followsStore = useFollowsStore();
const isDesktop = useMediaQuery('(min-width: 768px)');
const showMorePopover = ref(false);

// 滚动交互：向下滚动时折叠，向上滚动时展开
const { isVisible } = useScrollHideOnDown();

onMounted(async () => {
  await Promise.all([metadataStore.getChannels(), followsStore.loadChannelFollows()]);
});

const allChannels = computed<Channel[]>(() => metadataStore.cachedChannels || []);

// 关注的频道（直接显示）
const followedChannels = computed<Channel[]>(() => {
  const followedIds = followsStore.followedChannelIds;
  return allChannels.value.filter((c) => followedIds.has(c.id));
});

// 未关注的频道（折叠到更多）
const unfollowedChannels = computed<Channel[]>(() => {
  const followedIds = followsStore.followedChannelIds;
  return allChannels.value.filter((c) => !followedIds.has(c.id));
});

const selectedChannels = computed(() => filtersStore.selectedChannels);

// 判断是否有选中的频道在未关注列表中
const hasSelectedUnfollowedChannel = computed(() => {
  return unfollowedChannels.value.some((c) => selectedChannels.value.includes(c.id));
});

function handleChannelClick(channelId: string) {
  if (selectedChannels.value.includes(channelId)) {
    filtersStore.updateSelectedChannels([]);
  } else {
    filtersStore.updateSelectedChannels([channelId]);
  }
  showMorePopover.value = false;
}

function handleAllClick() {
  filtersStore.updateSelectedChannels([]);
}

function goToFollowsPage() {
  showMorePopover.value = false;
  router.push('/follows');
}
</script>

<template>
  <div class="channel-bar-wrapper" :class="{ 'is-hidden': !isVisible }">
    <div class="channel-bar">
      <div class="scroll-container">
        <button class="channel-pill" :class="{ active: selectedChannels.length === 0 }" @click="handleAllClick">
          全部
        </button>

        <!-- 关注的频道（直接显示） -->
        <button
          v-for="channel in followedChannels"
          :key="channel.id"
          class="channel-pill"
          :class="{ active: selectedChannels.includes(channel.id) }"
          @click="handleChannelClick(channel.id)"
        >
          {{ channel.name }}
        </button>

        <!-- 桌面端：更多按钮在流式布局中 -->
        <NPopover
          v-if="isDesktop && unfollowedChannels.length > 0"
          trigger="click"
          placement="bottom-end"
          :show-arrow="false"
          v-model:show="showMorePopover"
          class="more-channels-popover"
        >
          <template #trigger>
            <button class="channel-pill more-btn" :class="{ active: hasSelectedUnfollowedChannel }">更多...</button>
          </template>

          <div class="popover-content">
            <div class="hidden-channels-grid">
              <button
                v-for="channel in unfollowedChannels"
                :key="channel.id"
                class="channel-pill small"
                :class="{ active: selectedChannels.includes(channel.id) }"
                @click="handleChannelClick(channel.id)"
              >
                {{ channel.name }}
              </button>
            </div>
            <button class="manage-link" @click="goToFollowsPage">管理关注频道 →</button>
          </div>
        </NPopover>
      </div>

      <!-- 移动端：更多按钮固定在右侧 -->
      <NPopover
        v-if="!isDesktop && unfollowedChannels.length > 0"
        trigger="click"
        placement="bottom-end"
        :show-arrow="false"
        v-model:show="showMorePopover"
        class="more-channels-popover"
      >
        <template #trigger>
          <button class="channel-pill more-btn fixed-more" :class="{ active: hasSelectedUnfollowedChannel }">
            ...
          </button>
        </template>

        <div class="popover-content">
          <div class="hidden-channels-grid">
            <button
              v-for="channel in unfollowedChannels"
              :key="channel.id"
              class="channel-pill small"
              :class="{ active: selectedChannels.includes(channel.id) }"
              @click="handleChannelClick(channel.id)"
            >
              {{ channel.name }}
            </button>
          </div>
          <button class="manage-link" @click="goToFollowsPage">管理关注频道 →</button>
        </div>
      </NPopover>
    </div>
  </div>
</template>

<style scoped>
.channel-bar-wrapper {
  position: sticky;
  top: var(--opz-header-height); /* 紧贴 Header */
  z-index: 19;
  background: var(--opz-bg-base);
  transition:
    transform 0.3s ease,
    opacity 0.3s ease;
  width: 100%;
  border-bottom: 1px solid var(--opz-border);
}

.channel-bar-wrapper.is-hidden {
  transform: translateY(-100%);
  opacity: 0;
  pointer-events: none;
}

.channel-bar {
  width: 100%;
  max-width: 2400px;
  margin: 0 auto;
  padding: 0.75rem 1.5rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.scroll-container {
  flex: 1;
  min-width: 0;
  display: flex;
  gap: 0.5rem;
  overflow-x: auto;
  scrollbar-width: none;
  -ms-overflow-style: none;
  padding-bottom: 0;
  /* 移动端右侧渐隐效果 */
  mask-image: linear-gradient(to right, black calc(100% - 24px), transparent 100%);
  -webkit-mask-image: linear-gradient(to right, black calc(100% - 24px), transparent 100%);
}

.scroll-container::-webkit-scrollbar {
  display: none;
}

/* 移动端固定的更多按钮 */
.fixed-more {
  flex-shrink: 0;
}

@media (min-width: 768px) {
  .scroll-container {
    flex-wrap: wrap;
    overflow-x: visible;
    mask-image: none;
    -webkit-mask-image: none;
  }
}

.channel-pill {
  white-space: nowrap;
  padding: 0.35rem 1rem;
  border-radius: 999px;
  border: 1px solid var(--opz-border);
  background: var(--opz-bg-soft);
  color: var(--opz-text-primary);
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  user-select: none;
  flex-shrink: 0;
}

.channel-pill:hover {
  background: var(--opz-bg-mute);
}

.channel-pill.active {
  background: var(--opz-text-primary);
  color: var(--opz-bg-base);
  border-color: var(--opz-text-primary);
}

.channel-pill.small {
  font-size: 0.8rem;
  padding: 0.25rem 0.75rem;
}

.more-btn {
  color: var(--opz-text-secondary);
}

.popover-content {
  max-width: 300px;
}

.hidden-channels-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  padding: 0.5rem;
}

.manage-link {
  display: block;
  width: 100%;
  padding: 0.5rem;
  border: none;
  border-top: 1px solid var(--opz-border);
  background: none;
  color: var(--opz-text-secondary);
  font-size: 0.8rem;
  text-align: center;
  cursor: pointer;
  transition: color 0.15s ease;
}

.manage-link:hover {
  color: var(--opz-primary);
}

/* 移动端优化：更紧凑的按钮 */
@media (max-width: 767px) {
  .channel-bar {
    padding: 0.5rem;
    gap: 0.35rem;
  }

  .scroll-container {
    gap: 0.35rem;
  }

  .channel-pill {
    padding: 0.3rem 0.65rem;
    font-size: 0.8rem;
  }

  .fixed-more {
    padding: 0.3rem 0.5rem;
    min-width: 32px;
  }
}
</style>
