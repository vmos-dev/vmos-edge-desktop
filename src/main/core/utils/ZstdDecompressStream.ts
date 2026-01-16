import { Decompress } from 'fzstd' // 高性能流式解压库
import { Transform, type TransformCallback } from 'stream'

export class ZstdDecompressStream extends Transform {
  private decoder: Decompress
  private processedBytes = 0
  private totalBytes = 0
  private onProgress?: (percent: number) => void

  constructor(totalBytes: number, onProgress?: (percent: number) => void) {
    super()
    this.totalBytes = totalBytes
    this.onProgress = onProgress

    this.decoder = new Decompress((chunk) => {
      this.push(chunk)
    })
  }

  _transform(chunk: any, _encoding: BufferEncoding, callback: TransformCallback) {
    try {
      // 累计原始压缩文件读取量（最准确的进度指标）
      this.processedBytes += chunk.length

      if (this.onProgress) {
        const percent = (this.processedBytes / this.totalBytes) * 100
        this.onProgress(Number(percent.toFixed(2)))
      }

      const data = chunk instanceof Uint8Array ? chunk : new Uint8Array(chunk)
      this.decoder.push(data, false)
      callback()
    } catch (err) {
      callback(err as Error)
    }
  }

  _flush(callback: TransformCallback) {
    this.decoder.push(new Uint8Array(0), true)
    this.onProgress?.(100)
    callback()
  }
}
