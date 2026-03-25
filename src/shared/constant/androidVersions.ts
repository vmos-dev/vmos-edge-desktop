export const ANDROID_VERSION_OPTIONS = [
  { value: '10', label: 'Android 10' },
  { value: '13', label: 'Android 13' },
  { value: '14', label: 'Android 14' },
  { value: '15', label: 'Android 15' },
  { value: '16', label: 'Android 16' }
] as const

export const ANDROID_VERSION_DICT = Object.fromEntries(
  ANDROID_VERSION_OPTIONS.map((item) => [item.value, item])
) as Record<
  (typeof ANDROID_VERSION_OPTIONS)[number]['value'],
  (typeof ANDROID_VERSION_OPTIONS)[number]
>

export const formatAndroidVersionLabel = (value: string | number) => {
  const normalizedValue = String(value).trim()
  return normalizedValue ? `Android ${normalizedValue}` : ''
}
