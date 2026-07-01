// 画像 → レリーフセル格子への変換（Canvas API・クライアント完結, NFR-10）。
// 縮小サンプリング → 透明セル除外 → 輝度→高さ / 最近傍パレット色に量子化。

import type { PaletteColor } from '../types'
import { luminance, luminanceToHeight, nearestColorId, type ReliefCell } from '../domain/generator'

export interface ImageReliefOptions {
  /** 横方向のタワー数 */
  widthTowers: number
  /** タワーの最大段数 */
  maxHeight: number
  /** true = 暗いほど高い */
  invert: boolean
}

export interface ImageReliefResult {
  cells: ReliefCell[]
  cols: number
  rows: number
  pinTotal: number
}

/**
 * 画像ファイルをセル格子に変換する。
 * 行数は画像のアスペクト比から算出する（真上から見て歪まないように）。
 */
export async function imageToReliefCells(
  file: File,
  options: ImageReliefOptions,
  palette: readonly PaletteColor[],
): Promise<ImageReliefResult> {
  const bitmap = await createImageBitmap(file)
  try {
    const cols = Math.max(2, Math.round(options.widthTowers))
    // grow は立方ボクセル（X=Y 等間隔）で配置するので、行数は画像のアスペクト比そのまま
    const rows = Math.max(2, Math.round((bitmap.height / bitmap.width) * cols))

    const canvas = document.createElement('canvas')
    canvas.width = cols
    canvas.height = rows
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!
    ctx.drawImage(bitmap, 0, 0, cols, rows)
    const data = ctx.getImageData(0, 0, cols, rows).data

    const cells: ReliefCell[] = []
    let pinTotal = 0
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const i = (row * cols + col) * 4
        const [r, g, b, a] = [data[i], data[i + 1], data[i + 2], data[i + 3]]
        if (a < 128) continue // 透明 = タワーなし
        const height = luminanceToHeight(luminance(r, g, b), options.maxHeight, options.invert)
        cells.push({ col, row, height, colorId: nearestColorId(r, g, b, palette) })
        pinTotal += height
      }
    }
    return { cells, cols, rows, pinTotal }
  } finally {
    bitmap.close()
  }
}
