import { reactive, watch } from 'vue';
import type { SearchFilters } from '@/types/search';
import { useSearch } from './useSearch';

export function useSearchForm() {
  const { filters, applySearch } = useSearch();
  const formState = reactive<SearchFilters>({ ...filters.value });

  watch(
    filters,
    (next) => {
      Object.assign(formState, next);
    },
    { deep: true }
  );

  function updateForm(partial: Partial<SearchFilters>) {
    Object.assign(formState, partial);
  }

  async function submit(partial: Partial<SearchFilters> = {}) {
    updateForm(partial);
    await applySearch({ ...formState });
  }

  return {
    formState,
    updateForm,
    submit,
  };
}
