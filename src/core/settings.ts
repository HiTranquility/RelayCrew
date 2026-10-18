export const numericSettings = {
  maxReviewRounds: { min: 1, max: 10, integer: true, label: 'Maximum code/review rounds', default: 3 },
  quotaThreshold: { min: 1, max: 100, integer: false, label: 'Quota threshold (%)', default: 95 },
  timeoutMinutes: { min: 1, max: 180, integer: true, label: 'CLI timeout (minutes)', default: 30 },
  maxChildTasks: { min: 0, max: 20, integer: true, label: 'Maximum repair tasks', default: 4 },
  quotaRefreshSeconds: { min: 15, max: 3600, integer: true, label: 'Quota refresh interval (seconds)', default: 30 },
  backupMaxMB: { min: 1, max: 1024, integer: true, label: 'Source snapshot cap (MB)', default: 100 },
  backupStorageMB: { min: 1, max: 102400, integer: true, label: 'Backup storage cap (MB)', default: 2048 },
} as const;
export function validateSettingsPatch(value: unknown): Partial<Record<keyof typeof numericSettings, number>> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid settings.');
  for (const [key, number] of Object.entries(value)) {
    if (!Object.hasOwn(numericSettings, key)) throw new Error('Unknown setting.');
    const rule = numericSettings[key as keyof typeof numericSettings];
    if (typeof number !== 'number' || !Number.isFinite(number) || number < rule.min || number > rule.max || rule.integer && !Number.isInteger(number)) throw new Error('Setting is outside its allowed range.');
  }
  return { ...value };
}
