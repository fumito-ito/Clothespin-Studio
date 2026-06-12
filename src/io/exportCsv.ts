// 部品リスト（BOM）の CSV 生成。docs/03 §3。
// UTF-8 BOM 付き（Excel の文字化け回避）・CRLF・必要時 RFC 4180 クオート。

import type { Bom } from '../domain/bom'

function field(value: string | number): string {
  const s = String(value)
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function bomToCsv(bom: Bom): string {
  const lines = ['color_id,color_name,hex,count']
  for (const row of bom.rows) {
    lines.push([row.colorId, row.colorName, row.hex, row.count].map(field).join(','))
  }
  lines.push(`TOTAL,,,${bom.total}`)
  return '\uFEFF' + lines.join('\r\n') + '\r\n'
}
