// レリーフ（高さマップ）ジェネレータの純ロジック。
// 画像のセル格子（列・行・高さ・色）から、連結タワー群のピン配列を生成する。
//
// タワー単位（実機計測で確定）:
//   ルートを鼻先下向きに立て（R_y(+90°): ローカル −X → +Z）、g0（上ハンドル先端）を
//   連続連結する。クロソピンの連結幾何では「完全な垂直スタック」は作れず、どの連結でも
//   高さに比例して横へドリフトする。連続 g0 は平面内（厚み Y≈12mm を保つ）で最も背が高く
//   ドリフトも比較的小さい、という計測結果からこれを採用。
//   ※ g0/g1 交互はドリフト増、g2/g3 は段が重なる、リング連結は面外に螺旋、で不可。
//
// 横ドリフトはあるが、全タワーが同じ向き・同量で傾く（平行）ため、隣接タワーの X 間隔は
// 全高さで一定（= pitchX）。よって衝突回避に必要なのは累積ドリフトではなく「各段 1 ピン分の幅」
// だけで、実測では pitchX ≥ 55mm / pitchY ≥ 18mm で高さに依らず干渉しない（余裕を見て既定値を採用）。

import type { PaletteColor, Pin, Quat } from '../types'

export interface ReliefCell {
  col: number
  row: number
  /** タワーの段数（ピン本数）。0 = タワーなし */
  height: number
  colorId: string
}

export interface ReliefParams {
  /** タワー間隔 X (mm)。ドリフト方向 */
  pitchX: number
  /** タワー間隔 Y (mm)。ピン厚み方向 */
  pitchY: number
}

/** 既定のタワー間隔（実測の最小 55/18mm に余裕を持たせた値）。隣接タワーは干渉しない */
export const DEFAULT_RELIEF_PARAMS: ReliefParams = { pitchX: 60, pitchY: 24 }

/** R_y(+90°): ルートの鼻先を下に向け、ハンドル延長（チェーン方向）を上に向ける */
const TOWER_ROOT_ROTATION: Quat = [0, Math.SQRT1_2, 0, Math.SQRT1_2]
/** 鼻先（ローカル +X=30mm）が接地する高さ */
const TOWER_ROOT_Z = 31
/** タワーを伸ばすソケット（上ハンドル先端） */
const TOWER_GRIP = 0

/** 指定位置・高さの 1 タワー分のピンを生成する（id 接頭辞 prefix） */
function towerPins(prefix: string, colorId: string, x: number, y: number, height: number): Pin[] {
  const pins: Pin[] = [
    {
      id: prefix,
      colorId,
      connection: null,
      transform: { position: [x, y, TOWER_ROOT_Z], rotation: TOWER_ROOT_ROTATION },
    },
  ]
  let parentId = prefix
  for (let i = 1; i < height; i++) {
    const id = `${prefix}-${i}`
    pins.push({ id, colorId, connection: { parentId, gripIndex: TOWER_GRIP, roll: 0 } })
    parentId = id
  }
  return pins
}

/**
 * セル格子から連結タワー群を生成する。
 * 画像座標（col→+X, row→−Y）でドメイン平面に配置し、全体を中心寄せする。
 * id は決定的（`t{col}x{row}` + 段番号）。生成結果はモデル全体を置き換える想定。
 */
export function buildReliefPins(
  cells: readonly ReliefCell[],
  params: ReliefParams = DEFAULT_RELIEF_PARAMS,
): Pin[] {
  const active = cells.filter((c) => c.height > 0)
  if (active.length === 0) return []

  const pitch = params

  const minCol = Math.min(...active.map((c) => c.col))
  const maxCol = Math.max(...active.map((c) => c.col))
  const minRow = Math.min(...active.map((c) => c.row))
  const maxRow = Math.max(...active.map((c) => c.row))
  const centerCol = (minCol + maxCol) / 2
  const centerRow = (minRow + maxRow) / 2

  const pins: Pin[] = []
  for (const cell of active) {
    const x = (cell.col - centerCol) * pitch.pitchX
    const y = -(cell.row - centerRow) * pitch.pitchY
    pins.push(...towerPins(`t${cell.col}x${cell.row}`, cell.colorId, x, y, cell.height))
  }
  return pins
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
