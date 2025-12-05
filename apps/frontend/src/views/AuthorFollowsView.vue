<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { NSpin } from 'naive-ui';
import type { UserName } from '@opz-hub/shared';
import ViewShell from '@/components/layout/ViewShell.vue';
import AuthorFollowItem from '@/components/follows/AuthorFollowItem.vue';
import PaginationControl from '@/components/common/PaginationControl.vue';
import CountBadge from '@/components/common/CountBadge.vue';
import { useFollowsStore } from '@/stores/follows';
import { useBlocksStore } from '@/stores/blocks';
import { fetchUserNames } from '@/api/users';
import { notifyError, notifySuccess } from '@/utils/notifications';

const PAGE_SIZE = 20;

const router = useRouter();
const followsStore = useFollowsStore();
const blocksStore = useBlocksStore();

const loading = ref(false);
const pendingAuthors = ref(new Set<string>());

// 关注作者翻页
const followPage = ref(1);
// 屏蔽作者翻页
const blockPage = ref(1);
// 屏蔽区域折叠状态
const showBlockedSection = ref(false);
// 屏蔽作者详细信息
const blockedAuthorInfos = ref<UserName[]>([]);
const loadingBlocked = ref(false);

onMounted(async () => {
  loading.value = true;
  try {
    await followsStore.loadAuthorFollows();
  } finally {
    loading.value = false;
  }
});

const authorFollows = computed(() => followsStore.authorFollows);

// 关注作者翻页
const paginatedFollows = computed(() => {
  const start = (followPage.value - 1) * PAGE_SIZE;
  return authorFollows.value.slice(start, start + PAGE_SIZE);
});

// 屏蔽作者数量
const blockedCount = computed(() => blocksStore.blockedAuthors.length);

// 屏蔽作者翻页
const paginatedBlocked = computed(() => {
  const start = (blockPage.value - 1) * PAGE_SIZE;
  return blockedAuthorInfos.value.slice(start, start + PAGE_SIZE);
});

// 为已删除用户创建占位 UserName
function createDeletedUser(id: string): UserName {
  return {
    id,
    username: id,
    displayName: `已删除用户`,
    avatar: null,
    roles: [],
  };
}

// 加载屏蔽作者详细信息
async function loadBlockedAuthors() {
  const blockedIds = blocksStore.blockedAuthors;
  if (blockedIds.length === 0) {
    blockedAuthorInfos.value = [];
    return;
  }
  loadingBlocked.value = true;
  try {
    const result = await fetchUserNames(blockedIds);
    const userMap = new Map(result.users.map((u) => [u.id, u]));
    // 合并：有详情的显示详情，没有的标记为已删除
    blockedAuthorInfos.value = blockedIds.map((id) => userMap.get(id) ?? createDeletedUser(id));
  } catch (error) {
    console.error('[AuthorFollowsView] Failed to load blocked authors:', error);
    // 请求失败时，仍显示所有屏蔽作者（标记为已删除）
    blockedAuthorInfos.value = blockedIds.map(createDeletedUser);
  } finally {
    loadingBlocked.value = false;
  }
}

// 展开屏蔽区域时加载数据
watch(showBlockedSection, (show) => {
  if (show && blockedAuthorInfos.value.length === 0 && blocksStore.blockedAuthors.length > 0) {
    loadBlockedAuthors();
  }
});

// 监听屏蔽作者变化（仅处理新增的情况，移除由 handleUnblock 乐观处理）
watch(() => blocksStore.blockedAuthors, (newIds, oldIds) => {
  // 如果是新增屏蔽，重新加载
  if (newIds.length > (oldIds?.length ?? 0) && showBlockedSection.value) {
    loadBlockedAuthors();
  }
});

function handleNavigate(authorId: string) {
  router.push(`/user/${authorId}`);
}

async function handleUnfollow(authorId: string) {
  if (pendingAuthors.value.has(authorId)) return;
  pendingAuthors.value.add(authorId);
  try {
    await followsStore.removeAuthorFollow(authorId);
    notifySuccess('已取消关注');
  } catch {
    notifyError('操作失败，请重试');
  } finally {
    pendingAuthors.value.delete(authorId);
  }
}

async function handleUnblock(authorId: string) {
  if (pendingAuthors.value.has(authorId)) return;
  pendingAuthors.value.add(authorId);

  // 乐观更新：立即从列表中移除
  const prevInfos = blockedAuthorInfos.value;
  blockedAuthorInfos.value = prevInfos.filter((a) => a.id !== authorId);

  // 调整页码（如果当前页变空）
  const newTotal = blockedAuthorInfos.value.length;
  if (newTotal > 0 && blockPage.value > Math.ceil(newTotal / PAGE_SIZE)) {
    blockPage.value = Math.ceil(newTotal / PAGE_SIZE);
  }

  try {
    await blocksStore.unblockAuthor(authorId);
    notifySuccess('已取消屏蔽');
  } catch {
    // 回滚
    blockedAuthorInfos.value = prevInfos;
    notifyError('操作失败，请重试');
  } finally {
    pendingAuthors.value.delete(authorId);
  }
}
</script>

<template>
  <ViewShell title="作者偏好" description="管理关注和屏蔽的作者" show-back>
    <div v-if="loading" class="loading-container">
      <NSpin size="large" />
    </div>
    <template v-else>
      <!-- 关注的作者 -->
      <section class="author-section">
        <div v-if="authorFollows.length === 0" class="empty-state">
          <p class="empty-text">暂未关注任何作者</p>
          <p class="empty-hint">浏览帖子时可以关注喜欢的作者</p>
        </div>

        <template v-else>
          <div class="author-list">
            <AuthorFollowItem
              v-for="follow in paginatedFollows"
              :key="follow.authorId"
              :author="follow.author"
              :pending="pendingAuthors.has(follow.authorId)"
              @navigate="handleNavigate(follow.authorId)"
              @unfollow="handleUnfollow(follow.authorId)"
            />
          </div>
          <PaginationControl
            v-if="authorFollows.length > PAGE_SIZE"
            :current="followPage"
            :total="authorFollows.length"
            :page-size="PAGE_SIZE"
            compact
            class="pagination"
            @page-change="followPage = $event"
          />
        </template>
      </section>

      <!-- 屏蔽的作者（折叠） -->
      <section v-if="blockedCount > 0" class="blocked-section">
        <button type="button" class="collapse-header" @click="showBlockedSection = !showBlockedSection">
          <span class="collapse-title">
            <span>屏蔽的作者</span>
            <CountBadge :count="blockedCount" />
          </span>
          <span class="collapse-icon" :class="{ expanded: showBlockedSection }">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M4.22 6.22a.75.75 0 011.06 0L8 8.94l2.72-2.72a.75.75 0 111.06 1.06l-3.25 3.25a.75.75 0 01-1.06 0L4.22 7.28a.75.75 0 010-1.06z" />
            </svg>
          </span>
        </button>

        <div v-if="showBlockedSection" class="collapse-content">
          <div v-if="loadingBlocked" class="loading-container small">
            <NSpin size="small" />
          </div>
          <template v-else>
            <div class="author-list">
              <AuthorFollowItem
                v-for="author in paginatedBlocked"
                :key="author.id"
                :author="author"
                mode="block"
                :pending="pendingAuthors.has(author.id)"
                @navigate="handleNavigate(author.id)"
                @unblock="handleUnblock(author.id)"
              />
            </div>
            <PaginationControl
              v-if="blockedAuthorInfos.length > PAGE_SIZE"
              :current="blockPage"
              :total="blockedAuthorInfos.length"
              :page-size="PAGE_SIZE"
              compact
              class="pagination"
              @page-change="blockPage = $event"
            />
          </template>
        </div>
      </section>
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

.loading-container.small {
  min-height: 100px;
}

/* 空状态 */
.empty-state {
  text-align: center;
  padding: 3rem 1rem;
}

.empty-text {
  margin: 0;
  font-size: 1rem;
  color: var(--opz-text-secondary);
}

.empty-hint {
  margin: 0.5rem 0 0;
  font-size: 0.875rem;
  color: var(--opz-text-tertiary);
}

/* 作者分区 */
.author-section {
  margin-bottom: 1.5rem;
}

/* 作者列表 - 移动端单列 */
.author-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

/* 桌面端两列布局 + 居中 */
@media (min-width: 768px) {
  .author-list {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    align-items: start;
    gap: 0.75rem;
    max-width: 900px;
    margin: 0 auto;
  }
}

/* 翻页控件 */
.pagination {
  margin-top: 1rem;
}

/* 屏蔽区域 */
.blocked-section {
  border: 1px solid var(--opz-border);
  border-radius: 12px;
  background: var(--opz-bg-card);
  overflow: hidden;
  max-width: 900px;
}

/* 桌面端居中 */
@media (min-width: 768px) {
  .blocked-section {
    margin: 0 auto;
  }
}

.collapse-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 0.875rem 1rem;
  border: none;
  background: transparent;
  cursor: pointer;
  transition: background-color 0.15s ease;
}

.collapse-header:hover {
  background: var(--opz-bg-elevated);
}

.collapse-title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--opz-text-primary);
}

.collapse-icon {
  display: flex;
  align-items: center;
  color: var(--opz-text-tertiary);
  transition: transform 0.2s ease;
}

.collapse-icon.expanded {
  transform: rotate(180deg);
}

.collapse-content {
  padding: 1rem;
  border-top: 1px solid var(--opz-border);
}
</style>
