import { ref, watch, type Ref } from 'vue';
import { useDebounceFn } from '@vueuse/core';
import type { AuthorAutocompleteItem } from '@opz-hub/shared';
import { searchAuthors } from '@/api/users';

export function useAuthorAutocomplete(queryRef: Ref<string>, enabled: Ref<boolean>) {
  const authors = ref<AuthorAutocompleteItem[]>([]);
  const loading = ref(false);
  const error = ref<Error | null>(null);

  const fetchAuthors = useDebounceFn(async (query: string) => {
    if (!query.trim() || !enabled.value) {
      authors.value = [];
      return;
    }

    loading.value = true;
    error.value = null;
    try {
      const response = await searchAuthors(query, 10);
      authors.value = response.authors;
    } catch (e) {
      error.value = e instanceof Error ? e : new Error('搜索作者失败');
      authors.value = [];
    } finally {
      loading.value = false;
    }
  }, 500);

  watch(
    [queryRef, enabled],
    ([query, isEnabled]) => {
      if (isEnabled && query) {
        void fetchAuthors(query);
      } else {
        authors.value = [];
      }
    },
    { immediate: true }
  );

  function clear() {
    authors.value = [];
    error.value = null;
  }

  return {
    authors,
    loading,
    error,
    clear,
  };
}
