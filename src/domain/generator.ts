// レリーフ（高さマップ）ジェネレータの純ロジック。
// 画像のセル格子（列・行・高さ・色）から、連結タワー群のピン配列を生成する。
//
// タワー単位（実機検証済み）:
//   ルートを鼻先下向きに立て（R_y(+90°): ローカル −X → +Z）、
//   g0/g1（ハンドル先端）を交互に連結すると、±30° のジグザグで
//   ほぼ直立（約 58mm/段・厚み 12mm の平面内）のチェーンになる。
//   ※ g4 連続は回転が累積して螺旋になり、g2/g3 は口が一点に集まるため不可。

import type { PaletteColor, Pin, Quat } from '../types'

export interface ReliefCell {
  col: number
  row: number
  /** タワーの段数（ピン本数）。0 = タワーなし */
  height: number
  colorId: string
}

export interface ReliefParams {
  /** タワー間隔 X (mm)。ジグザグ面の方向 */
  pitchX: number
  /** タワー間隔 Y (mm)。ピン厚み方向 */
  pitchY: number
}

export const DEFAULT_RELIEF_PARAMS: ReliefParams = { pitchX: 65, pitchY: 20 }

/** R_y(+90°): ルートの鼻先を下に向け、ハンドル延長（チェーン方向）を上に向ける */
const TOWER_ROOT_ROTATION: Quat = [0, Math.SQRT1_2, 0, Math.SQRT1_2]
/** 鼻先（ローカル +X=30mm）が接地する高さ */
const TOWER_ROOT_Z = 31

/**
 * セル格子から連結タワー群を生成する。
 * 画像座標（col→+X, row→−Y）でドメイン平面に配置し、全体を中心寄せする。
 * id は決定的（`t{col}x{row}-{i}`）。生成結果はモデル全体を置き換える想定。
 */
export function buildReliefPins(
  cells: readonly ReliefCell[],
  params: ReliefParams = DEFAULT_RELIEF_PARAMS,
): Pin[] {
  const active = cells.filter((c) => c.height > 0)
  if (active.length === 0) return []

  const minCol = Math.min(...active.map((c) => c.col))
  const maxCol = Math.max(...active.map((c) => c.col))
  const minRow = Math.min(...active.map((c) => c.row))
  const maxRow = Math.max(...active.map((c) => c.row))
  const centerCol = (minCol + maxCol) / 2
  const centerRow = (minRow + maxRow) / 2

  const pins: Pin[] = []
  for (const cell of active) {
    const x = (cell.col - centerCol) * params.pitchX
    const y = -(cell.row - centerRow) * params.pitchY
    const rootId = `t${cell.col}x${cell.row}`
    pins.push({
      id: rootId,
      colorId: cell.colorId,
      connection: null,
      transform: { position: [x, y, TOWER_ROOT_Z], rotation: TOWER_ROOT_ROTATION },
    })
    let parentId = rootId
    for (let i = 1; i < cell.height; i++) {
      const id = `${rootId}-${i}`
      pins.push({
        id,
        colorId: cell.colorId,
        // g0/g1 交互で傾きを相殺する（直立チェーン）
        connection: { parentId, gripIndex: i % 2 === 1 ? 0 : 1, roll: 0 },
      })
      parentId = id
    }
  }
  return pins
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
