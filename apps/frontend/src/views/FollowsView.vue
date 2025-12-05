<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { NSpin } from 'naive-ui';
import ViewShell from '@/components/layout/ViewShell.vue';
import ChannelCard from '@/components/follows/ChannelCard.vue';
import MultiChannelCard from '@/components/follows/MultiChannelCard.vue';
import OrientationCard from '@/components/follows/OrientationCard.vue';
import { useFollowsStore } from '@/stores/follows';
import { useUserStore } from '@/stores/user';
import { useMetadataStore } from '@/stores/metadata';
import { useBlocksStore } from '@/stores/blocks';
import { updateUserOrientations } from '@/api/users';
import { notifyError, notifySuccess } from '@/utils/notifications';

const followsStore = useFollowsStore();
const userStore = useUserStore();
const metadataStore = useMetadataStore();
const blocksStore = useBlocksStore();

const loading = ref(false);
const isSavingOrientation = ref(false);

// 性取向：直接从 userStore 读取作为基线
const currentOrientations = computed(() => userStore.session?.orientations || []);

// 防抖：追踪正在处理中的项目
const pendingChannels = ref(new Set<string>());
const pendingTags = ref(new Set<string>());
const pendingKeywords = ref(new Set<string>());

onMounted(async () => {
  loading.value = true;
  try {
    await Promise.all([followsStore.loadAll(), metadataStore.getChannels()]);
  } finally {
    loading.value = false;
  }
});

// 所有频道（保持原始顺序，避免关注/取消后位置移动）
const allChannels = computed(() => metadataStore.cachedChannels || []);

// 所有频道 ID（用于 MultiChannelCard）
const allChannelIds = computed(() => allChannels.value.map((c) => c.id));

// 关注的标签 ID Set
const followedTagIds = computed(() => followsStore.followedTagIds);

// 关注的热词 Set
const followedKeywords = computed(() => new Set(userStore.settings?.preferredKeywords || []));

// 屏蔽的标签名 Set
const blockedTagNames = computed(() => new Set(blocksStore.blockedTags));

// 屏蔽的关键词列表
const blockedKeywords = computed(() => blocksStore.blockedKeywords);

// 频道关注切换
async function handleToggleChannel(channelId: string) {
  if (pendingChannels.value.has(channelId)) return;
  pendingChannels.value.add(channelId);
  try {
    await followsStore.toggleChannelFollow(channelId);
  } catch {
    notifyError('操作失败，请重试');
  } finally {
    pendingChannels.value.delete(channelId);
  }
}

// 标签关注切换
async function handleToggleTag(tagId: string, tagName: string) {
  if (pendingTags.value.has(tagId)) return;
  pendingTags.value.add(tagId);
  const wasFollowing = followsStore.isFollowingTagById(tagId);
  try {
    await followsStore.toggleTagFollow(tagId, tagName);
    notifySuccess(wasFollowing ? '已取消关注标签' : '已关注标签');
  } catch {
    notifyError('操作失败，请重试');
  } finally {
    pendingTags.value.delete(tagId);
  }
}

// 热词关注切换
async function handleToggleKeyword(keyword: string) {
  if (pendingKeywords.value.has(keyword)) return;
  pendingKeywords.value.add(keyword);
  const keywords = [...(userStore.settings?.preferredKeywords || [])];
  const index = keywords.indexOf(keyword);
  const wasFollowing = index > -1;

  if (wasFollowing) {
    keywords.splice(index, 1);
  } else {
    keywords.push(keyword);
  }

  try {
    await userStore.updateSettings({ preferredKeywords: keywords });
    notifySuccess(wasFollowing ? '已取消关注热词' : '已关注热词');
  } catch {
    notifyError('操作失败，请重试');
  } finally {
    pendingKeywords.value.delete(keyword);
  }
}

// 屏蔽标签
async function handleBlockTag(tagName: string) {
  try {
    await blocksStore.blockTag(tagName);
    notifySuccess('已屏蔽标签');
  } catch {
    notifyError('操作失败，请重试');
  }
}

// 屏蔽关键词
async function handleBlockKeyword(keyword: string) {
  try {
    await blocksStore.blockKeyword(keyword);
    notifySuccess('已屏蔽关键词');
  } catch {
    notifyError('操作失败，请重试');
  }
}

// 取消屏蔽标签
async function handleUnblockTag(tagName: string) {
  try {
    await blocksStore.unblockTag(tagName);
    notifySuccess('已取消屏蔽');
  } catch {
    notifyError('操作失败，请重试');
  }
}

// 取消屏蔽关键词
async function handleUnblockKeyword(keyword: string) {
  try {
    await blocksStore.unblockKeyword(keyword);
    notifySuccess('已取消屏蔽');
  } catch {
    notifyError('操作失败，请重试');
  }
}

// 保存性取向
async function handleSaveOrientations(orientations: string[]) {
  if (orientations.length === 0) {
    notifyError('请至少选择一个兴趣方向');
    return;
  }
  if (isSavingOrientation.value) return;
  isSavingOrientation.value = true;
  try {
    await updateUserOrientations(orientations);
    userStore.setOrientation(orientations);
    notifySuccess('兴趣方向已更新');
  } catch {
    notifyError('保存失败，请稍后再试');
  } finally {
    isSavingOrientation.value = false;
  }
}
</script>

<template>
  <ViewShell title="浏览偏好" description="管理兴趣方向、频道、标签和热词" show-back>
    <div v-if="loading" class="loading-container">
      <NSpin size="large" />
    </div>
    <template v-else>
      <!-- 兴趣方向 -->
      <OrientationCard :model-value="currentOrientations" class="orientation-card" @save="handleSaveOrientations" />

      <!-- 多频道通用（标签 + 热词）- 占满整行 -->
      <MultiChannelCard
        :channel-ids="allChannelIds"
        :followed-tag-ids="followedTagIds"
        :followed-keywords="followedKeywords"
        :blocked-tags="blocksStore.blockedTags"
        :blocked-keywords="blockedKeywords"
        class="multi-channel-card"
        @toggle-tag="handleToggleTag"
        @toggle-keyword="handleToggleKeyword"
        @block-tag="handleBlockTag"
        @block-keyword="handleBlockKeyword"
        @unblock-tag="handleUnblockTag"
        @unblock-keyword="handleUnblockKeyword"
      />

      <!-- 频道卡片网格 -->
      <div class="channel-cards">
        <ChannelCard
          v-for="channel in allChannels"
          :key="channel.id"
          :channel="channel"
          :is-followed="followsStore.followedChannelIds.has(channel.id)"
          :followed-tag-ids="followedTagIds"
          :blocked-tag-names="blockedTagNames"
          @toggle-channel="handleToggleChannel"
          @toggle-tag="handleToggleTag"
          @block-tag="handleBlockTag"
          @unblock-tag="(_, name) => handleUnblockTag(name)"
        />
      </div>
    </template>
  </ViewShell>
</template>

<style scoped>
.loading-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 200px;
}

/* 兴趣方向卡片 */
.orientation-card {
  margin-bottom: 0.75rem;
  width: 100%;
  max-width: 900px;
}

/* 多频道通用卡片 */
.multi-channel-card {
  margin-bottom: 0.75rem;
  width: 100%;
  max-width: 900px;
}

/* 桌面端居中 */
@media (min-width: 768px) {
  .orientation-card,
  .multi-channel-card {
    margin-left: auto;
    margin-right: auto;
  }
}

/* 频道卡片列表 - 移动端单列 */
.channel-cards {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

/* 桌面端两列布局 + 居中 */
@media (min-width: 768px) {
  .channel-cards {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    grid-auto-rows: min-content;
    align-items: start;
    gap: 0.75rem;
    width: 100%;
    max-width: 900px;
    margin: 0 auto;
  }
}
</style>
