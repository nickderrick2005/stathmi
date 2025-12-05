import type { FavoriteResponse, SuccessResponse } from '@opz-hub/shared';
import { apiClient } from './client';

export function listFavorites() {
  return apiClient<FavoriteResponse[]>('/favorites');
}

export function addFavorite(postId: string) {
  return apiClient<SuccessResponse>('/favorites', {
    method: 'POST',
    body: { postId },
  });
}

export function removeFavorite(postId: string) {
  return apiClient<SuccessResponse>(`/favorites/${postId}`, {
    method: 'DELETE',
  });
}
