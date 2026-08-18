export interface CreateCloudLocaleFields {
  bool_language_country_timezone: boolean
  country: string
  timezone: string
  locale: string
}

export interface CreateProxyUiState {
  enabled: boolean
  testResult: unknown
  infoVisible: boolean
}

export const createDefaultLocaleFields = (): CreateCloudLocaleFields => ({
  bool_language_country_timezone: false,
  country: 'SG',
  timezone: 'Asia/Singapore',
  locale: 'zh'
})

export const shouldHideLocaleSection = (
  proxyEnabled: boolean,
  ipSimulatorEnabled: boolean
): boolean => proxyEnabled && ipSimulatorEnabled

export const applyProxyLocaleOwnership = (
  form: CreateCloudLocaleFields,
  ipSimulatorEnabled: boolean
): void => {
  Object.assign(
    form,
    ipSimulatorEnabled
      ? {
          bool_language_country_timezone: false,
          country: '',
          timezone: '',
          locale: ''
        }
      : createDefaultLocaleFields()
  )
}

export const resetProxyUiState = <T extends CreateProxyUiState>(state: T): T => ({
  ...state,
  enabled: false,
  testResult: null,
  infoVisible: false
})
