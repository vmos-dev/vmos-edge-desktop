export function parseCSV(text: string): Array<Record<string, string>> {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/).filter(Boolean)
  if (lines.length < 2) return []
  const headers = lines[0].split(',').map((h) => h.trim())
  return lines.slice(1).map((line) => {
    const values = line.split(',').map((v) => v.trim())
    const row: Record<string, string> = {}
    headers.forEach((h, i) => {
      row[h] = values[i] ?? ''
    })
    return row
  })
}

export function generateCSVTemplate(deviceNames: string[], variableNames: string[]): string {
  const headers = ['device_name', ...variableNames]
  const rows = deviceNames.map((name) => [name, ...variableNames.map(() => '')].join(','))
  return [headers.join(','), ...rows].join('\n')
}

export function downloadCSV(content: string, filename: string): void {
  const blob = new Blob(['﻿' + content], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
