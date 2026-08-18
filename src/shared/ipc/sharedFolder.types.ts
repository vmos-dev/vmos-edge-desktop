export interface SharedFolderStatus {
  protocol: 'webdav'
  directory: string
  enabled: boolean
  running: boolean
  pathExists: boolean
  port: number
  username: string
  password: string
  accessUrl?: string
  lanAddress?: string
  lastError?: string
}

export interface StartSharedFolderOptions {
  directory?: string
}

export interface StopSharedFolderOptions {
  persistEnabled?: boolean
}

export const SHARED_FOLDER_EVENTS = {
  GET_STATUS: 'SHARED_FOLDER:GET_STATUS',
  START: 'SHARED_FOLDER:START',
  STOP: 'SHARED_FOLDER:STOP'
} as const
