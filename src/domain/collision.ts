// 干渉判定（OBB × 分離軸定理 / SAT）。docs/01 FR-P7 / docs/05 M5。
//
// 各ピンを向き付き直方体（OBB, 60×12×39mm）として扱い、重なりを判定する。
// 配置時フィードバック用途: 「新しく置く 1 個が既存構造に干渉するか」を返す。
//
// 既知の保守性: 洗濯バサミは OBB 内のほとんどが空隙（薄いレバー2本＋リング）。
// よって OBB 判定は実形状より過剰に当たりやすい。tolerance（半径方向の許容めり込み）と、
// 配置時は「親＋その兄弟（同じハブに集まる正当な近接）」を除外することで誤検出を抑える。
// より厳密にするならセグメント単位 OBB（将来拡張）。

import { Matrix4 } from 'three'
import type { Pin, Vec3 } from '../types'
import { DIMENSIONS, socketByIndex } from './clothespin'
import { childWorldMatrix, solveWorldTransforms } from './solve'

/** ピン OBB の半径（バウンディングボックスの半対角）。広域フェーズの球判定に使う */
const HALF: Vec3 = [DIMENSIONS.length / 2, DIMENSIONS.thickness / 2, DIMENSIONS.height / 2]
export const BOUNDING_RADIUS = Math.hypot(HALF[0], HALF[1], HALF[2]) // ≈ 36.3mm

/** 半径方向の許容めり込み（mm）。接合部の軽い接触や保守的 OBB の誤検出を吸収する */
export const COLLISION_TOLERANCE = 3

export interface Obb {
  /** 中心（ワールド） */
  c: Vec3
  /** 単位軸 ×3（直交） */
  u: [Vec3, Vec3, Vec3]
  /** 各軸方向の半寸法 */
  e: [number, number, number]
}

const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]

/** 剛体ワールド行列 → OBB（列ベクトルが直交軸） */
export function obbFromMatrix(m: Matrix4, half: Vec3 = HALF): Obb {
  const e = m.elements
  const col = (i: number): Vec3 => {
    const x = e[i * 4]
    const y = e[i * 4 + 1]
    const z = e[i * 4 + 2]
    const len = Math.hypot(x, y, z) || 1
    return [x / len, y / len, z / len]
  }
  return {
    c: [e[12], e[13], e[14]],
    u: [col(0), col(1), col(2)],
    e: [half[0], half[1], half[2]],
  }
}

/**
 * 2 つの OBB が重なるか（SAT, 15 軸）。
 * tolerance > 0 で両者の半寸法を縮め、その分のめり込みを許容する。
 */
export function obbIntersect(a: Obb, b: Obb, tolerance = 0): boolean {
  const ea: Vec3 = [
    Math.max(0, a.e[0] - tolerance),
    Math.max(0, a.e[1] - tolerance),
    Math.max(0, a.e[2] - tolerance),
  ]
  const eb: Vec3 = [
    Math.max(0, b.e[0] - tolerance),
    Math.max(0, b.e[1] - tolerance),
    Math.max(0, b.e[2] - tolerance),
  ]

  // 回転行列 R[i][j] = a.u[i]·b.u[j] と、平行辺対策の EPS 入り絶対値
  const R: number[][] = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ]
  const AbsR: number[][] = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ]
  const EPS = 1e-6
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      R[i][j] = dot(a.u[i], b.u[j])
      AbsR[i][j] = Math.abs(R[i][j]) + EPS
    }
  }

  // 中心間ベクトルを a の座標系へ
  const tw: Vec3 = [b.c[0] - a.c[0], b.c[1] - a.c[1], b.c[2] - a.c[2]]
  const t: Vec3 = [dot(tw, a.u[0]), dot(tw, a.u[1]), dot(tw, a.u[2])]

  // a の 3 軸
  for (let i = 0; i < 3; i++) {
    const ra = ea[i]
    const rb = eb[0] * AbsR[i][0] + eb[1] * AbsR[i][1] + eb[2] * AbsR[i][2]
    if (Math.abs(t[i]) > ra + rb) return false
  }
  // b の 3 軸
  for (let j = 0; j < 3; j++) {
    const ra = ea[0] * AbsR[0][j] + ea[1] * AbsR[1][j] + ea[2] * AbsR[2][j]
    const rb = eb[j]
    const tj = Math.abs(t[0] * R[0][j] + t[1] * R[1][j] + t[2] * R[2][j])
    if (tj > ra + rb) return false
  }

  // 9 つの外積軸 a.u[i] × b.u[j]
  // i=0
  if (
    Math.abs(t[2] * R[1][0] - t[1] * R[2][0]) >
    ea[1] * AbsR[2][0] + ea[2] * AbsR[1][0] + eb[1] * AbsR[0][2] + eb[2] * AbsR[0][1]
  )
    return false
  if (
    Math.abs(t[2] * R[1][1] - t[1] * R[2][1]) >
    ea[1] * AbsR[2][1] + ea[2] * AbsR[1][1] + eb[0] * AbsR[0][2] + eb[2] * AbsR[0][0]
  )
    return false
  if (
    Math.abs(t[2] * R[1][2] - t[1] * R[2][2]) >
    ea[1] * AbsR[2][2] + ea[2] * AbsR[1][2] + eb[0] * AbsR[0][1] + eb[1] * AbsR[0][0]
  )
    return false
  // i=1
  if (
    Math.abs(t[0] * R[2][0] - t[2] * R[0][0]) >
    ea[0] * AbsR[2][0] + ea[2] * AbsR[0][0] + eb[1] * AbsR[1][2] + eb[2] * AbsR[1][1]
  )
    return false
  if (
    Math.abs(t[0] * R[2][1] - t[2] * R[0][1]) >
    ea[0] * AbsR[2][1] + ea[2] * AbsR[0][1] + eb[0] * AbsR[1][2] + eb[2] * AbsR[1][0]
  )
    return false
  if (
    Math.abs(t[0] * R[2][2] - t[2] * R[0][2]) >
    ea[0] * AbsR[2][2] + ea[2] * AbsR[0][2] + eb[0] * AbsR[1][1] + eb[1] * AbsR[1][0]
  )
    return false
  // i=2
  if (
    Math.abs(t[1] * R[0][0] - t[0] * R[1][0]) >
    ea[0] * AbsR[1][0] + ea[1] * AbsR[0][0] + eb[1] * AbsR[2][2] + eb[2] * AbsR[2][1]
  )
    return false
  if (
    Math.abs(t[1] * R[0][1] - t[0] * R[1][1]) >
    ea[0] * AbsR[1][1] + ea[1] * AbsR[0][1] + eb[0] * AbsR[2][2] + eb[2] * AbsR[2][0]
  )
    return false
  if (
    Math.abs(t[1] * R[0][2] - t[0] * R[1][2]) >
    ea[0] * AbsR[1][2] + ea[1] * AbsR[0][2] + eb[0] * AbsR[2][1] + eb[1] * AbsR[2][0]
  )
    return false

  return true // どの軸でも分離できない = 重なっている
}

/**
 * candidate（ワールド行列）が matrices 内のいずれかと干渉する最初の id を返す（無ければ null）。
 * excludeIds は判定から除外する（親・兄弟など正当な近接）。広域フェーズに球判定を入れる。
 */
export function collidingPinId(
  candidate: Matrix4,
  matrices: Map<string, Matrix4>,
  excludeIds: ReadonlySet<string>,
  tolerance = COLLISION_TOLERANCE,
): string | null {
  const candObb = obbFromMatrix(candidate)
  const cc = candObb.c
  const maxDistSq = (2 * BOUNDING_RADIUS) ** 2
  for (const [id, m] of matrices) {
    if (excludeIds.has(id)) continue
    const e = m.elements
    const dx = e[12] - cc[0]
    const dy = e[13] - cc[1]
    const dz = e[14] - cc[2]
    if (dx * dx + dy * dy + dz * dz > maxDistSq) continue // 球で粗く除外
    if (obbIntersect(candObb, obbFromMatrix(m), tolerance)) return id
  }
  return null
}

/**
 * モデル全体をチェックし、干渉している（= 非除外ペアで重なっている）ピン id の集合を返す。
 * 除外ペア: 直接連結（親子）と、同じ親を持つ兄弟（ハブでの正当な近接）。
 * 広域フェーズに一様空間グリッド（セル = 2R）を使い、平均 O(n) で近傍のみ判定する。
 */
export function findCollidingPins(
  pins: readonly Pin[],
  tolerance = COLLISION_TOLERANCE,
): Set<string> {
  const matrices = solveWorldTransforms(pins)
  const parentOf = new Map<string, string | null>()
  for (const p of pins) parentOf.set(p.id, p.connection?.parentId ?? null)

  interface Item {
    id: string
    parentId: string | null
    obb: Obb
  }
  const items: Item[] = []
  for (const [id, m] of matrices) {
    items.push({ id, parentId: parentOf.get(id) ?? null, obb: obbFromMatrix(m) })
  }

  const cell = 2 * BOUNDING_RADIUS
  const cellOf = (v: number) => Math.floor(v / cell)
  const grid = new Map<string, number[]>()
  items.forEach((it, i) => {
    const key = `${cellOf(it.obb.c[0])},${cellOf(it.obb.c[1])},${cellOf(it.obb.c[2])}`
    const arr = grid.get(key)
    if (arr) arr.push(i)
    else grid.set(key, [i])
  })

  const exempt = (a: Item, b: Item) =>
    a.parentId === b.id || b.parentId === a.id || (a.parentId !== null && a.parentId === b.parentId)

  const result = new Set<string>()
  const maxDistSq = cell * cell
  items.forEach((a, i) => {
    const cx = cellOf(a.obb.c[0])
    const cy = cellOf(a.obb.c[1])
    const cz = cellOf(a.obb.c[2])
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        for (let dz = -1; dz <= 1; dz++) {
          const arr = grid.get(`${cx + dx},${cy + dy},${cz + dz}`)
          if (!arr) continue
          for (const j of arr) {
            if (j <= i) continue // 各ペアを 1 回だけ
            const b = items[j]
            if (exempt(a, b)) continue
            const ddx = a.obb.c[0] - b.obb.c[0]
            const ddy = a.obb.c[1] - b.obb.c[1]
            const ddz = a.obb.c[2] - b.obb.c[2]
            if (ddx * ddx + ddy * ddy + ddz * ddz > maxDistSq) continue
            if (obbIntersect(a.obb, b.obb, tolerance)) {
              result.add(a.id)
              result.add(b.id)
            }
          }
        }
      }
    }
  })
  return result
}

/**
 * 親 parentId のソケット gripIndex に既定姿勢（roll/pitch）で子を置いたとき、
 * 干渉する既存ピンの id を返す（無ければ null）。
 * 除外: 親自身と、親の既存の子（= 同じハブに集まる兄弟）。
 */
export function placementCollidingPinId(
  pins: readonly Pin[],
  parentId: string,
  gripIndex: number,
  roll = 0,
  pitch = 0,
): string | null {
  const socket = socketByIndex(gripIndex)
  if (!socket) return null
  const matrices = solveWorldTransforms(pins)
  const parentM = matrices.get(parentId)
  if (!parentM) return null
  const candidate = childWorldMatrix(parentM, socket, roll, pitch)
  const exclude = new Set<string>([parentId])
  for (const p of pins) {
    if (p.connection?.parentId === parentId) exclude.add(p.id)
  }
  return collidingPinId(candidate, matrices, exclude)
}
