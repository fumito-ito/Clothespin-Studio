// 構造物全体のバウンディング寸法計算（FR-S3 / 視点フィットにも使用）。
// ドメイン座標系（Z-up, mm）。各ピンのローカル AABB の 8 頂点をワールド変換して集計する。

import { Vector3 } from 'three'
import type { Pin, Vec3 } from '../types'
import { DIMENSIONS } from './clothespin'
import { solveWorldTransforms } from './solve'

export interface Bounds {
  min: Vec3
  max: Vec3
  /** max - min（mm） */
  size: Vec3
  center: Vec3
}

const hx = DIMENSIONS.length / 2
const hy = DIMENSIONS.thickness / 2
const hz = DIMENSIONS.height / 2

const CORNERS: Vec3[] = []
for (const x of [-hx, hx])
  for (const y of [-hy, hy]) for (const z of [-hz, hz]) CORNERS.push([x, y, z])

/** 全ピンのバウンディングを計算する。ピンが無ければ null */
export function computeBounds(pins: readonly Pin[]): Bounds | null {
  const matrices = solveWorldTransforms(pins)
  if (matrices.size === 0) return null

  const min = new Vector3(Infinity, Infinity, Infinity)
  const max = new Vector3(-Infinity, -Infinity, -Infinity)
  const v = new Vector3()
  for (const m of matrices.values()) {
    for (const c of CORNERS) {
      v.set(c[0], c[1], c[2]).applyMatrix4(m)
      min.min(v)
      max.max(v)
    }
  }
  return {
    min: [min.x, min.y, min.z],
    max: [max.x, max.y, max.z],
    size: [max.x - min.x, max.y - min.y, max.z - min.z],
    center: [(min.x + max.x) / 2, (min.y + max.y) / 2, (min.z + max.z) / 2],
  }
}
