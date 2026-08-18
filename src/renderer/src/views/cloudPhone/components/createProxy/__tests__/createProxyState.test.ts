import { describe, expect, it } from 'vitest'
import {
  applyProxyLocaleOwnership,
  createDefaultLocaleFields,
  resetProxyUiState,
  shouldHideLocaleSection
} from '../createProxyState'

describe('createProxyState', () => {
  it('hides locale fields and clears conflicting outer values when ip simulator owns locale', () => {
    const form = {
      bool_language_country_timezone: true,
      country: 'US',
      timezone: 'America/New_York',
      locale: 'en'
    }

    applyProxyLocaleOwnership(form, true)

    expect(shouldHideLocaleSection(true, true)).toBe(true)
    expect(form).toEqual({
      bool_language_country_timezone: false,
      country: '',
      timezone: '',
      locale: ''
    })
  })

  it('restores create dialog locale defaults when ip simulator is turned off', () => {
    const form = {
      bool_language_country_timezone: true,
      country: '',
      timezone: '',
      locale: ''
    }

    applyProxyLocaleOwnership(form, false)

    expect(form).toEqual(createDefaultLocaleFields())
  })

  it('clears proxy-only ui state when proxy is disabled', () => {
    expect(
      resetProxyUiState({
        enabled: true,
        testResult: { success: true },
        infoVisible: true
      })
    ).toEqual({
      enabled: false,
      testResult: null,
      infoVisible: false
    })
  })
})
