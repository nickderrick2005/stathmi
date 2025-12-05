import type { OnboardingPreferences, SuccessResponse } from '@opz-hub/shared';
import { apiClient } from './client';

export function saveOnboardingPreferences(payload: OnboardingPreferences) {
  return apiClient<SuccessResponse>('/onboarding/preferences', {
    method: 'POST',
    body: payload,
  });
}
