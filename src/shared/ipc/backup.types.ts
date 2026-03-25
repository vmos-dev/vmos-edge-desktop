export const BACKUP_SELECT_DIRECTORY = 'backup:selectDirectory'
export const BACKUP_CREATE_WRITER = 'backup:createWriter'
export const BACKUP_WRITE_CHUNK = 'backup:writeChunk'
export const BACKUP_CLOSE_WRITER = 'backup:closeWriter'
export const BACKUP_ABORT_WRITER = 'backup:abortWriter'

export interface BackupSelectDirectoryResult {
  token: string
  path: string
}

export interface BackupCreateWriterPayload {
  token: string
  fileName: string
}

export interface BackupCreateWriterResult {
  writerId: string
  finalFileName: string
}

export interface BackupWriteChunkPayload {
  writerId: string
  chunk: Uint8Array
}

export interface BackupWriterActionPayload {
  writerId: string
}
