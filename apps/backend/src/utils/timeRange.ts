import type { TimeRangePreset } from '@opz-hub/shared';

export const parseTimeRange = (query: Record<string, unknown>) => {
  const preset = typeof query?.timeRange === 'string' ? (query.timeRange as TimeRangePreset) : 'all';
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;

  const clampDate = (value?: string) => {
    if (!value) return undefined;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
    };

  if (preset === 'custom') {
    const from = clampDate(typeof query?.timeFrom === 'string' ? query.timeFrom : undefined);
    const to = clampDate(typeof query?.timeTo === 'string' ? query.timeTo : undefined);
    return { preset, from, to };
  }

  const map: Record<Exclude<TimeRangePreset, 'custom'>, { from?: string; to?: string }> = {
    all: {},
    '7d': { from: new Date(now - 7 * dayMs).toISOString() },
    '30d': { from: new Date(now - 30 * dayMs).toISOString() },
    '90d': { from: new Date(now - 90 * dayMs).toISOString() },
  };

  if (preset in map) {
    const { from, to } = map[preset as Exclude<TimeRangePreset, 'custom'>];
    return { preset, from, to };
  }

  return { preset: 'all' as TimeRangePreset, from: undefined, to: undefined };
};
