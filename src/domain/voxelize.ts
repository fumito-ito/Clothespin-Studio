// 正規化済みメッシュ（MeshData, watertight 前提）のソリッドボクセル化（FR-M2, docs/07 §9 M1）。
// 方式は issue 0008 のスパイクで決定済み: ±X/±Y/±Z 6 方向の奇偶判定を多数決する内外判定。
// 自前の Möller–Trumbore レイ・三角形交差 + 三角形の一様グリッド索引で実装する（新規依存なし。
// three.js の Raycaster 等は経由しない）。
//
// スコープ外: 非 watertight メッシュの頑健化（issue 0013）・色割当（issue 0011）。
// 本モジュールは全充填ボクセルへ引数 colorId を一律に割り当てる。

import type { MeshData } from '../types'

export interface VoxelizeSolidResult {
  /** "i,j,k" → colorId。ボクセル(i,j,k)の中心はワールド座標 (i·voxelMm, j·voxelMm, k·voxelMm)（grow.ts と同じ規約） */
  voxels: Map<string, string>
  /** 充填ボクセルのうち k 最小層・(i,j) 重心最近傍（1 個も充填されなければ undefined） */
  seed: string | undefined
}

/** 軸番号: 0=X, 1=Y, 2=Z（positions 配列のオフセットにそのまま対応） */
type Axis = 0 | 1 | 2

interface Bounds {
  min: [number, number, number]
  max: [number, number, number]
}

/** 頂点座標の全体バウンディング */
function computeBounds(positions: Float32Array): Bounds {
  let minX = Infinity,
    minY = Infinity,
    minZ = Infinity
  let maxX = -Infinity,
    maxY = -Infinity,
    maxZ = -Infinity
  for (let i = 0; i < positions.length; i += 3) {
    const x = positions[i]
    const y = positions[i + 1]
    const z = positions[i + 2]
    if (x < minX) minX = x
    if (y < minY) minY = y
    if (z < minZ) minZ = z
    if (x > maxX) maxX = x
    if (y > maxY) maxY = y
    if (z > maxZ) maxZ = z
  }
  return { min: [minX, minY, minZ], max: [maxX, maxY, maxZ] }
}

/** 走査するボクセルインデックス範囲（bbox を包含し、境界誤差吸収のため前後 1 ボクセルの余白を持つ） */
function axisRange(
  bounds: Bounds,
  axis: Axis,
  voxelMm: number,
): { lo: number; hi: number; count: number } {
  const lo = Math.floor(bounds.min[axis] / voxelMm) - 1
  const hi = Math.ceil(bounds.max[axis] / voxelMm) + 1
  return { lo, hi, count: hi - lo + 1 }
}

/** 軸に垂直な平面へ投影したときの残り 2 軸（射影用）。0=X→(Y,Z), 1=Y→(X,Z), 2=Z→(X,Y) */
const PERP: readonly [Axis, Axis][] = [
  [1, 2],
  [0, 2],
  [0, 1],
]

/**
 * 三角形を、指定した軸に垂直な平面へ投影して一様グリッド（バケット）に登録する空間索引。
 * ±方向のレイキャストは軸が同じなら射影も同じになるため、1 つの索引を双方向で共有できる
 * （6 方向多数決に必要な索引は軸ごとに 1 つ、計 3 つで足りる）。
 */
class AxisGrid {
  private readonly cells = new Map<string, number[]>()
  private readonly cellSize: number
  private readonly originU: number
  private readonly originV: number
  private readonly axisU: Axis
  private readonly axisV: Axis

  constructor(
    positions: Float32Array,
    indices: Uint32Array,
    bounds: Bounds,
    axis: Axis,
    gridRes: number,
  ) {
    const [au, av] = PERP[axis]
    this.axisU = au
    this.axisV = av
    this.originU = bounds.min[au]
    this.originV = bounds.min[av]
    const spanU = bounds.max[au] - this.originU
    const spanV = bounds.max[av] - this.originV
    this.cellSize = Math.max(spanU, spanV, 1e-9) / gridRes

    const triCount = indices.length / 3
    for (let t = 0; t < triCount; t++) {
      const ia = indices[t * 3] * 3
      const ib = indices[t * 3 + 1] * 3
      const ic = indices[t * 3 + 2] * 3
      const u0 = positions[ia + au],
        u1 = positions[ib + au],
        u2 = positions[ic + au]
      const v0 = positions[ia + av],
        v1 = positions[ib + av],
        v2 = positions[ic + av]
      const uMin = this.cellIndex(Math.min(u0, u1, u2), this.originU)
      const uMax = this.cellIndex(Math.max(u0, u1, u2), this.originU)
      const vMin = this.cellIndex(Math.min(v0, v1, v2), this.originV)
      const vMax = this.cellIndex(Math.max(v0, v1, v2), this.originV)
      for (let u = uMin; u <= uMax; u++) {
        for (let v = vMin; v <= vMax; v++) {
          const key = `${u},${v}`
          const arr = this.cells.get(key)
          if (arr) arr.push(t)
          else this.cells.set(key, [t])
        }
      }
    }
  }

  private cellIndex(value: number, origin: number): number {
    return Math.floor((value - origin) / this.cellSize)
  }

  /** ワールド座標 (x,y,z) を通る柱（この軸の射影平面上のセル）に属する三角形インデックスを返す */
  triangleIndicesAt(x: number, y: number, z: number): number[] {
    const p: [number, number, number] = [x, y, z]
    const ui = this.cellIndex(p[this.axisU], this.originU)
    const vi = this.cellIndex(p[this.axisV], this.originV)
    return this.cells.get(`${ui},${vi}`) ?? []
  }
}

/**
 * Möller–Trumbore によるレイ・三角形交差判定（自前実装）。
 * レイ原点より前方（dist > EPS）で三角形と交差すれば true。
 */
function rayHitsTriangle(
  positions: Float32Array,
  indices: Uint32Array,
  t: number,
  ox: number,
  oy: number,
  oz: number,
  dx: number,
  dy: number,
  dz: number,
): boolean {
  const ia = indices[t * 3] * 3
  const ib = indices[t * 3 + 1] * 3
  const ic = indices[t * 3 + 2] * 3

  const v0x = positions[ia],
    v0y = positions[ia + 1],
    v0z = positions[ia + 2]
  const v1x = positions[ib],
    v1y = positions[ib + 1],
    v1z = positions[ib + 2]
  const v2x = positions[ic],
    v2y = positions[ic + 1],
    v2z = positions[ic + 2]

  const e1x = v1x - v0x,
    e1y = v1y - v0y,
    e1z = v1z - v0z
  const e2x = v2x - v0x,
    e2y = v2y - v0y,
    e2z = v2z - v0z

  // pvec = dir × e2
  const pvx = dy * e2z - dz * e2y
  const pvy = dz * e2x - dx * e2z
  const pvz = dx * e2y - dy * e2x

  const det = e1x * pvx + e1y * pvy + e1z * pvz
  const EPS = 1e-9
  if (Math.abs(det) < EPS) return false // レイと三角形が平行
  const invDet = 1 / det

  const tvx = ox - v0x,
    tvy = oy - v0y,
    tvz = oz - v0z
  const u = (tvx * pvx + tvy * pvy + tvz * pvz) * invDet
  if (u < 0 || u > 1) return false

  // qvec = tvec × e1
  const qvx = tvy * e1z - tvz * e1y
  const qvy = tvz * e1x - tvx * e1z
  const qvz = tvx * e1y - tvy * e1x
  const v = (dx * qvx + dy * qvy + dz * qvz) * invDet
  if (v < 0 || u + v > 1) return false

  const dist = (e2x * qvx + e2y * qvy + e2z * qvz) * invDet
  return dist > EPS // レイ原点より後ろの交差は無視
}

/** 点 (x,y,z) から方向 (dx,dy,dz) への 1 方向奇偶判定（交差回数が奇数 = 内側） */
function isInsideAxis(
  positions: Float32Array,
  indices: Uint32Array,
  grid: AxisGrid,
  x: number,
  y: number,
  z: number,
  dx: number,
  dy: number,
  dz: number,
): boolean {
  let count = 0
  for (const t of grid.triangleIndicesAt(x, y, z)) {
    if (rayHitsTriangle(positions, indices, t, x, y, z, dx, dy, dz)) count++
  }
  return count % 2 === 1
}

// 6 方向中 3 以上を「内側」とする（3-3 の同点は内側扱い。issue 0008 のスパイクで実測した基準を踏襲）
const MAJORITY = 3

/** ±X/±Y/±Z 6 方向の奇偶判定を多数決し、点 (x,y,z) が内側かどうかを返す */
function isInsideMajority(
  positions: Float32Array,
  indices: Uint32Array,
  grids: readonly [AxisGrid, AxisGrid, AxisGrid],
  x: number,
  y: number,
  z: number,
): boolean {
  let votes = 0
  if (isInsideAxis(positions, indices, grids[0], x, y, z, 1, 0, 0)) votes++
  if (isInsideAxis(positions, indices, grids[0], x, y, z, -1, 0, 0)) votes++
  if (isInsideAxis(positions, indices, grids[1], x, y, z, 0, 1, 0)) votes++
  if (isInsideAxis(positions, indices, grids[1], x, y, z, 0, -1, 0)) votes++
  if (isInsideAxis(positions, indices, grids[2], x, y, z, 0, 0, 1)) votes++
  if (isInsideAxis(positions, indices, grids[2], x, y, z, 0, 0, -1)) votes++
  return votes >= MAJORITY
}

/**
 * 充填ボクセルのうち「k 最小層・(i,j) の重心（bbox 中心）最近傍」を種として選ぶ。
 * generator.ts の cellsToVoxels と同じ選定方針（grow の慣行）。
 */
function pickSeed(minKCells: readonly [number, number][], minK: number): string | undefined {
  if (minKCells.length === 0) return undefined
  const is = minKCells.map((c) => c[0])
  const js = minKCells.map((c) => c[1])
  const cx = (Math.min(...is) + Math.max(...is)) / 2
  const cy = (Math.min(...js) + Math.max(...js)) / 2
  let best = minKCells[0]
  let bestD = Infinity
  for (const c of minKCells) {
    const d = (c[0] - cx) ** 2 + (c[1] - cy) ** 2
    if (d < bestD) {
      bestD = d
      best = c
    }
  }
  return `${best[0]},${best[1]},${minK}`
}

/**
 * watertight 前提のメッシュをソリッドボクセル目標へ変換する（内部も充填。単色）。
 * @param voxelMm ボクセル一辺 (mm)。voxel(i,j,k) の中心は (i,j,k)·voxelMm（grow.ts と同じ規約）
 * @param colorId 全充填ボクセルに割り当てる色（本 Issue のスコープでは固定。呼び出し側が既定色を渡す）
 */
export function voxelizeSolid(
  mesh: MeshData,
  voxelMm: number,
  colorId: string,
): VoxelizeSolidResult {
  const { positions, indices } = mesh
  const triCount = indices.length / 3
  if (triCount === 0) return { voxels: new Map(), seed: undefined }

  const bounds = computeBounds(positions)
  const iRange = axisRange(bounds, 0, voxelMm)
  const jRange = axisRange(bounds, 1, voxelMm)
  const kRange = axisRange(bounds, 2, voxelMm)

  // 空間索引の粒度: ボクセル走査の解像度に合わせる（bbox が概ね立方に近い前提の簡便な発見的取り決め）
  const gridRes = Math.max(iRange.count, jRange.count, kRange.count, 1)
  const grids: [AxisGrid, AxisGrid, AxisGrid] = [
    new AxisGrid(positions, indices, bounds, 0, gridRes),
    new AxisGrid(positions, indices, bounds, 1, gridRes),
    new AxisGrid(positions, indices, bounds, 2, gridRes),
  ]

  const voxels = new Map<string, string>()
  let minK = Infinity
  let minKCells: [number, number][] = []

  // k を昇順に走査するので、最初に充填が見つかった k がそのまま「k 最小層」になる
  for (let k = kRange.lo; k <= kRange.hi; k++) {
    const z = k * voxelMm
    for (let j = jRange.lo; j <= jRange.hi; j++) {
      const y = j * voxelMm
      for (let i = iRange.lo; i <= iRange.hi; i++) {
        const x = i * voxelMm
        if (!isInsideMajority(positions, indices, grids, x, y, z)) continue
        voxels.set(`${i},${j},${k}`, colorId)
        if (k < minK) {
          minK = k
          minKCells = [[i, j]]
        } else if (k === minK) {
          minKCells.push([i, j])
        }
      }
    }
  }

  return { voxels, seed: pickSeed(minKCells, minK) }
}
