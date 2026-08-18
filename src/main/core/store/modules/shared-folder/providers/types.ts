export interface WebDavProviderResult {
  lanAddress?: string
  accessUrl?: string
}

export interface WebDavProvider {
  validate(): Promise<void>
  start(directory: string): Promise<WebDavProviderResult>
  stop(): Promise<void>
}
