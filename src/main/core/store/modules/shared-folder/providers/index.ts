import { WebDavProvider } from './WebDavProvider'

export function createWebDavProvider(): WebDavProvider {
  return new WebDavProvider()
}

export type { WebDavProvider, WebDavProviderResult } from './types'
