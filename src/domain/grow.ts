// ルールベース生成アセンブリの成長アルゴリズム（docs/07）。
// ボクセル目標を種から幅優先で充填し、1 つの連結・干渉なしのピン木を生成する。
//
// 各ピンは「自分が覆ったボクセルの色」を持つ。連結は木構造で常に保証され、
// 候補は OBB×SAT（collision.ts）で干渉を弾く。広域フェーズに空間グリッドを使い、
// 近傍のみ判定するので大規模目標でも実用的（O(P) 程度）。

import { Matrix4 } from 'three'
import type { Pin } from '../types'
import { socketByIndex } from './clothespin'
import { childWorldMatrix } from './solve'
import { BOUNDING_RADIUS, COLLISION_TOLERANCE, obbFromMatrix, obbIntersect, type Obb } from './collision'
import { CONNECTION_CATALOG } from './catalog'

export interface GrowResult {
  pins: Pin[]
  /** 覆えた目標ボクセル数 */
  covered: number
  /** 目標ボクセル総数 */
  target: number
}

interface Placed {
  m: Matrix4
  obb: Obb
  occupied: Set<number>
  id: string
}

const GRID_CELL = 2 * BOUNDING_RADIUS

/**
 * ボクセル目標 voxels（"i,j,k" → colorId）を種から成長充填する。
 * @param voxelMm ボクセル一辺 (mm)。voxel(i,j,k) の中心は (i,j,k)·voxelMm
 * @param seedKey 種ボクセル（省略時は最初の 1 つ）
 */
export function growAssembly(
  voxels: ReadonlyMap<string, string>,
  voxelMm: number,
  seedKey?: string,
  tolerance = COLLISION_TOLERANCE,
): GrowResult {
  if (voxels.size === 0) return { pins: [], covered: 0, target: 0 }
  const seed = seedKey && voxels.has(seedKey) ? seedKey : voxels.keys().next().value!
  const [si, sj, sk] = seed.split(',').map(Number)

  const placed: Placed[] = []
  const pins: Pin[] = []
  const covered = new Set<string>()
  const grid = new Map<string, number[]>()

  const gcell = (v: number) => Math.floor(v / GRID_CELL)
  const addToGrid = (i: number) => {
    const e = placed[i].m.elements
    const key = `${gcell(e[12])},${gcell(e[13])},${gcell(e[14])}`
    const arr = grid.get(key)
    if (arr) arr.push(i)
    else grid.set(key, [i])
  }
  const collidesNearby = (obb: Obb, parent: number): boolean => {
    const [cx, cy, cz] = obb.c
    const ci = gcell(cx)
    const cj = gcell(cy)
    const ck = gcell(cz)
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        for (let dz = -1; dz <= 1; dz++) {
          const arr = grid.get(`${ci + dx},${cj + dy},${ck + dz}`)
          if (!arr) continue
          for (const idx of arr) {
            if (idx === parent) continue // 親との接合部は除外
            if (obbIntersect(obb, placed[idx].obb, tolerance)) return true
          }
        }
      }
    }
    return false
  }
  const voxKeyOf = (m: Matrix4) => {
    const e = m.elements
    return `${Math.round(e[12] / voxelMm)},${Math.round(e[13] / voxelMm)},${Math.round(e[14] / voxelMm)}`
  }

  // 種ピン（ルート）
  const seedM = new Matrix4().makeTranslation(si * voxelMm, sj * voxelMm, sk * voxelMm)
  placed.push({ m: seedM, obb: obbFromMatrix(seedM), occupied: new Set(), id: 'g0' })
  pins.push({
    id: 'g0',
    colorId: voxels.get(seed)!,
    connection: null,
    transform: { position: [si * voxelMm, sj * voxelMm, sk * voxelMm], rotation: [0, 0, 0, 1] },
  })
  covered.add(seed)
  addToGrid(0)

  // 幅優先で各ピンを 1 回展開（全ソケット試行）
  const queue: number[] = [0]
  for (let head = 0; head < queue.length; head++) {
    const pi = queue[head]
    const parent = placed[pi]
    for (const move of CONNECTION_CATALOG) {
      if (parent.occupied.has(move.gripIndex)) continue
      const socket = socketByIndex(move.gripIndex)!
      const m = childWorldMatrix(parent.m, socket, move.roll, move.pitch)
      const vk = voxKeyOf(m)
      const colorId = voxels.get(vk)
      if (colorId === undefined || covered.has(vk)) continue
      const obb = obbFromMatrix(m)
      if (collidesNearby(obb, pi)) continue

      const idx = placed.length
      const id = `g${idx}`
      parent.occupied.add(move.gripIndex)
      placed.push({ m, obb, occupied: new Set(), id })
      pins.push({
        id,
        colorId,
        connection: {
          parentId: parent.id,
          gripIndex: move.gripIndex,
          roll: move.roll,
          ...(move.pitch !== 0 ? { pitch: move.pitch } : {}),
        },
      })
      covered.add(vk)
      addToGrid(idx)
      queue.push(idx)
    }
  }

  return { pins, covered: covered.size, target: voxels.size }
}
