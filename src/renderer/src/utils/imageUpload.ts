import { Decompress } from 'fzstd'

export interface ExtractOptions {
  signal?: AbortSignal
  onProgress?: (percent: number) => void
}

export interface UploadOptions {
  url: string
  signal?: AbortSignal
  onProgress?: (percent: number) => void
}

// 向后兼容的组合接口
export interface UploadImageFromZstOptions extends UploadOptions {}

function concatU8(a: Uint8Array, b: Uint8Array): Uint8Array {
  const r = new Uint8Array(a.length + b.length)
  r.set(a)
  r.set(b as Uint8Array<ArrayBuffer>, a.length)
  return r
}

/**
 * 阶段 1：流式解压 .tar.zst，提取内部 .tar.gz → 返回 Blob
 *
 * 流程：file.stream() → fzstd 解压 → tar 解析 → 提取 .tar.gz bytes → Blob
 * 内存：流式读取压缩文件（不整体加载），只保留解压后的 .tar.gz 内容
 */
export async function extractTarGzFromZst(
  file: File,
  opts?: ExtractOptions
): Promise<{ blob: Blob; name: string }> {
  const { signal, onProgress } = opts ?? {}

  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')

  const reader = (file.stream() as ReadableStream<Uint8Array>).getReader()
  let totalRead = 0

  // tar 解析状态机
  let tarBuf: Uint8Array = new Uint8Array(0)
  type TarState = 'header' | 'skip' | 'collect' | 'done'
  let tarState: TarState = 'header'
  let tarRemaining = 0
  let entryName = 'image.tar.gz'
  const tarGzChunks: Uint8Array[] = []

  const processTarChunk = (chunk: Uint8Array) => {
    if (tarState === 'done') return
    tarBuf = concatU8(tarBuf, chunk)

    while (true) {
      if (tarState === 'header') {
        if (tarBuf.length < 512) break
        const hdr = tarBuf.subarray(0, 512)
        tarBuf = tarBuf.slice(512)

        if (hdr[0] === 0) {
          tarState = 'done'
          break
        }

        // 文件名（offset 0, 100 字节, null 结尾）
        let ne = 0
        while (ne < 100 && hdr[ne] !== 0) ne++
        const name = new TextDecoder().decode(hdr.subarray(0, ne))

        // 文件大小（offset 124, 12 字节, 八进制）
        let sizeStr = ''
        for (let i = 124; i < 136; i++) {
          if (hdr[i] === 0 || hdr[i] === 32) break
          sizeStr += String.fromCharCode(hdr[i])
        }
        const fileSize = parseInt(sizeStr, 8) || 0
        const paddedSize = fileSize > 0 ? Math.ceil(fileSize / 512) * 512 : 0

        if (name.endsWith('.tar.gz') || name.endsWith('.tar')) {
          entryName = name.split('/').pop() || 'image.tar.gz'
          tarRemaining = fileSize
          tarState = fileSize > 0 ? 'collect' : 'header'
        } else {
          tarRemaining = paddedSize
          tarState = tarRemaining > 0 ? 'skip' : 'header'
        }
      } else if (tarState === 'collect') {
        if (tarBuf.length === 0) break
        const take = Math.min(tarRemaining, tarBuf.length)
        tarGzChunks.push(tarBuf.slice(0, take))
        tarBuf = tarBuf.slice(take)
        tarRemaining -= take
        if (tarRemaining <= 0) {
          tarState = 'done'
          break
        }
      } else if (tarState === 'skip') {
        if (tarBuf.length === 0) break
        const take = Math.min(tarRemaining, tarBuf.length)
        tarBuf = tarBuf.slice(take)
        tarRemaining -= take
        if (tarRemaining <= 0) tarState = 'header'
      }
    }
  }

  const dec = new Decompress((chunk) => processTarChunk(chunk))

  try {
    while ((tarState as string) !== 'done') {
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
      const { value, done } = await reader.read()
      if (done) {
        dec.push(new Uint8Array(0), true)
        break
      }
      const data = value instanceof Uint8Array ? value : new Uint8Array(value)
      totalRead += data.length
      onProgress?.(totalRead / file.size) // 0 ~ 1
      dec.push(data, false)
    }
  } finally {
    reader.cancel().catch(() => {})
  }

  if (tarGzChunks.length === 0) {
    throw new Error('.tar.gz entry not found in archive')
  }

  const blob = new Blob(tarGzChunks as BlobPart[], { type: 'application/gzip' })
  tarGzChunks.length = 0 // 释放原始 chunk 引用，Blob 已持有副本

  return { blob, name: entryName }
}

/**
 * 阶段 2：通过 XHR 上传 Blob 到主机
 *
 * 使用 XHR + FormData，避免 fetch duplex:'half' 的兼容性问题
 */
export async function uploadTarGz(blob: Blob, name: string, opts: UploadOptions): Promise<void> {
  const { url, signal, onProgress } = opts

  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')

  const formData = new FormData()
  formData.append('file', blob, name)

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', url)
    xhr.setRequestHeader('X-Client-Type', 'vmos-edge-desktop')
    xhr.timeout = 0

    // 取消支持
    if (signal) {
      const onAbort = () => {
        xhr.abort()
        reject(new DOMException('Aborted', 'AbortError'))
      }
      signal.addEventListener('abort', onAbort)
      xhr.addEventListener('loadend', () => signal.removeEventListener('abort', onAbort))
    }

    // 上传进度（0 ~ 1）
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        onProgress?.(e.loaded / e.total)
      }
    }

    xhr.onload = () => {
      const ct = xhr.getResponseHeader('content-type') || ''
      if (ct.includes('application/json')) {
        let json: any = {}
        try {
          json = JSON.parse(xhr.responseText)
        } catch {
          /* ignore */
        }
        if (json.code !== undefined && json.code != 200) {
          reject(new Error(json.msg || json.message || `Upload failed (code ${json.code})`))
          return
        }
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve()
      } else {
        reject(new Error(`HTTP ${xhr.status}: ${xhr.responseText.slice(0, 200)}`))
      }
    }

    xhr.onerror = () => reject(new Error('Network error'))

    xhr.send(formData)
  })

  onProgress?.(1)
}

/**
 * 便捷封装：将 .tar.zst 在前端解压，提取内部 .tar.gz，通过 XHR 上传到主机
 * （单次调用，适合只上传到一台主机；多主机场景请用 extractTarGzFromZst + uploadTarGz）
 */
export async function uploadImageFromZst(
  file: File,
  opts: UploadImageFromZstOptions
): Promise<void> {
  const { url, signal, onProgress } = opts
  const { blob, name } = await extractTarGzFromZst(file, {
    signal,
    onProgress: onProgress ? (p) => onProgress(p * 0.5) : undefined
  })
  await uploadTarGz(blob, name, {
    url,
    signal,
    onProgress: onProgress ? (p) => onProgress(0.5 + p * 0.5) : undefined
  })
}
