import { app, BrowserWindow, dialog, type OpenDialogOptions } from 'electron'
import { randomUUID } from 'crypto'
import path from 'path'
import fs from 'fs'
import type { FileHandle } from 'fs/promises'
import { handle } from '../IpcBus'
import { logger } from '../../logger'
import {
  BACKUP_ABORT_WRITER,
  BACKUP_CLOSE_WRITER,
  BACKUP_CREATE_WRITER,
  BACKUP_SELECT_DIRECTORY,
  BACKUP_WRITE_CHUNK,
  type BackupCreateWriterPayload,
  type BackupCreateWriterResult,
  type BackupSelectDirectoryResult,
  type BackupWriteChunkPayload,
  type BackupWriterActionPayload
} from '@shared/ipc'

interface WriterContext {
  handle: FileHandle
  partPath: string
  finalPath: string
}

const directoryTokenMap = new Map<string, string>()
const writerMap = new Map<string, WriterContext>()
let cleanupHookRegistered = false

function sanitizeFileName(rawName: string): string {
  const normalized = (rawName || '').trim().replace(/[\\/:*?"<>|\u0000-\u001F]+/g, '_')
  const noDots = normalized.replace(/^\.+/, '').replace(/\.+$/, '')
  return noDots || `backup-${Date.now()}.tar`
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fs.promises.access(targetPath, fs.constants.F_OK)
    return true
  } catch {
    return false
  }
}

async function ensureUniqueFileName(directory: string, rawName: string): Promise<string> {
  const safeName = sanitizeFileName(rawName)
  const parsed = path.parse(safeName)
  const base = parsed.name || 'backup'
  const ext = parsed.ext || '.tar'

  let seq = 0
  while (true) {
    const candidate = seq === 0 ? `${base}${ext}` : `${base} (${seq})${ext}`
    const finalPath = path.join(directory, candidate)
    const partPath = `${finalPath}.part`
    const finalExists = await pathExists(finalPath)
    const partExists = await pathExists(partPath)
    if (!finalExists && !partExists) {
      return candidate
    }
    seq++
  }
}

function normalizeChunk(chunk: unknown): Buffer {
  if (chunk instanceof Uint8Array) {
    return Buffer.from(chunk)
  }

  if (chunk instanceof ArrayBuffer) {
    return Buffer.from(chunk)
  }

  if (Array.isArray(chunk)) {
    return Buffer.from(chunk)
  }

  throw new Error('Invalid chunk data type')
}

async function safeAbortWriter(writerId: string): Promise<void> {
  const writer = writerMap.get(writerId)
  if (!writer) {
    return
  }

  writerMap.delete(writerId)

  try {
    await writer.handle.close()
  } catch {
    // ignore
  }

  try {
    await fs.promises.rm(writer.partPath, { force: true })
  } catch {
    // ignore
  }
}

async function cleanupAllWriters(): Promise<void> {
  const ids = Array.from(writerMap.keys())
  await Promise.all(ids.map((id) => safeAbortWriter(id)))
}

function ensureCleanupHookRegistered() {
  if (cleanupHookRegistered) return
  cleanupHookRegistered = true

  app.on('before-quit', () => {
    void cleanupAllWriters()
  })

  process.once('beforeExit', () => {
    void cleanupAllWriters()
  })
}

export function registerBackupHandlers() {
  ensureCleanupHookRegistered()

  handle<void, BackupSelectDirectoryResult | null>(BACKUP_SELECT_DIRECTORY, async () => {
    try {
      const dialogOptions: OpenDialogOptions = {
        title: '选择备份目录',
        properties: ['openDirectory', 'createDirectory']
      }

      const focusedWindow = BrowserWindow.getFocusedWindow()
      const result = focusedWindow
        ? await dialog.showOpenDialog(focusedWindow, dialogOptions)
        : await dialog.showOpenDialog(dialogOptions)

      if (result.canceled || !result.filePaths?.[0]) {
        return { success: true, data: null }
      }

      const resolvedPath = path.resolve(result.filePaths[0])
      const token = randomUUID()
      directoryTokenMap.set(token, resolvedPath)

      return {
        success: true,
        data: {
          token,
          path: resolvedPath
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to select directory'
      return { success: false, error: message }
    }
  })

  handle<BackupCreateWriterPayload, BackupCreateWriterResult>(
    BACKUP_CREATE_WRITER,
    async (payload) => {
      try {
        if (!payload?.token) {
          return { success: false, error: 'Directory token is required' }
        }

        const directory = directoryTokenMap.get(payload.token)
        if (!directory) {
          return { success: false, error: 'Directory token is invalid or expired' }
        }

        const finalFileName = await ensureUniqueFileName(directory, payload.fileName)
        const finalPath = path.join(directory, finalFileName)
        const partPath = `${finalPath}.part`

        const handleRef = await fs.promises.open(partPath, 'wx')
        const writerId = randomUUID()
        writerMap.set(writerId, {
          handle: handleRef,
          partPath,
          finalPath
        })

        return {
          success: true,
          data: {
            writerId,
            finalFileName
          }
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to create writer'
        return { success: false, error: message }
      }
    }
  )

  handle<BackupWriteChunkPayload, void>(BACKUP_WRITE_CHUNK, async (payload) => {
    try {
      if (!payload?.writerId) {
        return { success: false, error: 'writerId is required' }
      }

      const writer = writerMap.get(payload.writerId)
      if (!writer) {
        return { success: false, error: 'Writer does not exist or is already closed' }
      }

      const buffer = normalizeChunk(payload.chunk)
      await writer.handle.write(buffer, 0, buffer.byteLength)

      return { success: true }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to write chunk'
      return { success: false, error: message }
    }
  })

  handle<BackupWriterActionPayload, void>(BACKUP_CLOSE_WRITER, async (payload) => {
    try {
      if (!payload?.writerId) {
        return { success: false, error: 'writerId is required' }
      }

      const writer = writerMap.get(payload.writerId)
      if (!writer) {
        return { success: false, error: 'Writer does not exist or is already closed' }
      }

      await writer.handle.sync()
      await writer.handle.close()
      await fs.promises.rename(writer.partPath, writer.finalPath)
      writerMap.delete(payload.writerId)

      return { success: true }
    } catch (error) {
      if (payload?.writerId) {
        await safeAbortWriter(payload.writerId)
      }
      const message = error instanceof Error ? error.message : 'Failed to close writer'
      return { success: false, error: message }
    }
  })

  handle<BackupWriterActionPayload, void>(BACKUP_ABORT_WRITER, async (payload) => {
    try {
      if (payload?.writerId) {
        await safeAbortWriter(payload.writerId)
      }
      return { success: true }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to abort writer'
      return { success: false, error: message }
    }
  })

  logger.info('[BackupHandler] ✅ 备份写盘处理器已注册')
}
