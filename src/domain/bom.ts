// 部品表（BOM）集計。docs/03 §3 / FR-S2 / FR-IO3。

import type { PaletteColor, Pin } from '../types'

export interface BomRow {
  colorId: string
  colorName: string
  hex: string
  count: number
}

export interface Bom {
  rows: BomRow[]
  total: number
}

/** 色別の使用数を集計する。行順はパレット順、パレット外の色は末尾に追加 */
export function buildBom(pins: readonly Pin[], palette: readonly PaletteColor[]): Bom {
  const counts = new Map<string, number>()
  for (const pin of pins) {
    counts.set(pin.colorId, (counts.get(pin.colorId) ?? 0) + 1)
  }

  const rows: BomRow[] = []
  for (const c of palette) {
    const count = counts.get(c.id) ?? 0
    if (count > 0) rows.push({ colorId: c.id, colorName: c.name, hex: c.hex, count })
    counts.delete(c.id)
  }
  // パレットに無い colorId（読込データ等）も失わず数える
  for (const [colorId, count] of counts) {
    rows.push({ colorId, colorName: colorId, hex: '#888888', count })
  }

  return { rows, total: pins.length }
}
