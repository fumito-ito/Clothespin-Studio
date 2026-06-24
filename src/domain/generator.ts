// 画像（高さ場）の量子化とボクセル目標化（ルールベース生成アセンブリ grow への入力, docs/07）。
// 縮小サンプリングされた画像セル（列・行・高さ・色）を、輝度→高さ / 最近傍パレット色に量子化し、
// 立体ボクセル目標（"i,j,k" → colorId）+ 種ボクセルへ変換する。

import type { PaletteColor } from '../types'

export interface ReliefCell {
  col: number
  row: number
  /** 高さ（段数）。0 = セルなし */
  height: number
  colorId: string
}

/**
 * 画像セル（高さ場）→ ボクセル目標（"i,j,k" → colorId）+ 種ボクセル。
 * ルールベース生成アセンブリ（grow, docs/07）の入力。col→i, row→j, 高さ→k。
 * 種は中心に最も近い充填セルの底（k=0）。
 */
export function cellsToVoxels(cells: readonly ReliefCell[]): {
  voxels: Map<string, string>
  seed: string | undefined
} {
  const active = cells.filter((c) => c.height > 0)
  const voxels = new Map<string, string>()
  for (const c of active) {
    for (let k = 0; k < c.height; k++) voxels.set(`${c.col},${c.row},${k}`, c.colorId)
  }
  if (active.length === 0) return { voxels, seed: undefined }

  const cx = (Math.min(...active.map((c) => c.col)) + Math.max(...active.map((c) => c.col))) / 2
  const cy = (Math.min(...active.map((c) => c.row)) + Math.max(...active.map((c) => c.row))) / 2
  let seedCell = active[0]
  let bestD = Infinity
  for (const c of active) {
    const d = (c.col - cx) ** 2 + (c.row - cy) ** 2
    if (d < bestD) {
      bestD = d
      seedCell = c
    }
  }
  return { voxels, seed: `${seedCell.col},${seedCell.row},0` }
}

/** sRGB 値の相対輝度（0–255） */
export function luminance(r: number, g: number, b: number): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/**
 * 輝度 → タワー段数。既定は「明るい = 高い」、invert で反転。
 * 不透明セルは最低 1 段（穴にしない）。
 */
export function luminanceToHeight(lum: number, maxHeight: number, invert: boolean): number {
  const v = invert ? 255 - lum : lum
  return Math.max(1, Math.round((v / 255) * maxHeight))
}

/** 最近傍のパレット色 id（重み付き RGB 距離） */
export function nearestColorId(
  r: number,
  g: number,
  b: number,
  palette: readonly PaletteColor[],
): string {
  let best = palette[0].id
  let bestDist = Infinity
  for (const c of palette) {
    const pr = parseInt(c.hex.slice(1, 3), 16)
    const pg = parseInt(c.hex.slice(3, 5), 16)
    const pb = parseInt(c.hex.slice(5, 7), 16)
    // 人間の知覚に寄せた重み（簡易）
    const d = 3 * (r - pr) ** 2 + 4 * (g - pg) ** 2 + 2 * (b - pb) ** 2
    if (d < bestDist) {
      bestDist = d
      best = c.id
    }
  }
  return best
}
