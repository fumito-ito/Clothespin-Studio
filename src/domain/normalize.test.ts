import { describe, expect, it } from 'vitest'
import { normalizeMesh } from './normalize'
import type { MeshData } from '../types'

/** 直方体（Y-up）の頂点座標を作る。中心はワールド原点からずれていてもよい */
function boxPositions(
  w: number,
  h: number,
  d: number,
  offset: [number, number, number],
): Float32Array {
  const [ox, oy, oz] = offset
  const hw = w / 2
  const hh = h / 2
  const hd = d / 2
  const corners: number[] = []
  for (const x of [-hw, hw])
    for (const y of [-hh, hh]) for (const z of [-hd, hd]) corners.push(ox + x, oy + y, oz + z)
  return new Float32Array(corners)
}

describe('normalizeMesh', () => {
  it('最長辺が目標 mm になる', () => {
    // Y-up で幅40×高さ100×奥行20（最長辺は Y=100）
    const mesh: MeshData = {
      positions: boxPositions(40, 100, 20, [0, 0, 0]),
      indices: new Uint32Array(),
    }
    const result = normalizeMesh(mesh, 200)

    let minX = Infinity,
      maxX = -Infinity
    let minY = Infinity,
      maxY = -Infinity
    let minZ = Infinity,
      maxZ = -Infinity
    for (let i = 0; i < result.positions.length; i += 3) {
      const x = result.positions[i]
      const y = result.positions[i + 1]
      const z = result.positions[i + 2]
      minX = Math.min(minX, x)
      maxX = Math.max(maxX, x)
      minY = Math.min(minY, y)
      maxY = Math.max(maxY, y)
      minZ = Math.min(minZ, z)
      maxZ = Math.max(maxZ, z)
    }
    const sizeX = maxX - minX
    const sizeY = maxY - minY
    const sizeZ = maxZ - minZ

    // Y-up の最長辺（Y=100）が Z-up 変換後は Z 軸に来て 200mm になる
    expect(Math.max(sizeX, sizeY, sizeZ)).toBeCloseTo(200, 6)
    expect(sizeZ).toBeCloseTo(200, 6)
    // 元の比率が維持される（40:100:20 → scale=2 → 80:200:40）。Y-up→Z-up で元 Z(20→40) が Y に写る
    expect(sizeX).toBeCloseTo(80, 6)
    expect(sizeY).toBeCloseTo(40, 6)
  })

  it('Y-up → Z-up 変換される（Y-up の高さ方向が Z-up の高さ方向になる）', () => {
    // 高さ方向（Y-up の Y）だけ突出した薄い板
    const mesh: MeshData = {
      positions: boxPositions(10, 100, 10, [0, 0, 0]),
      indices: new Uint32Array(),
    }
    const result = normalizeMesh(mesh, 100)

    let minZ = Infinity,
      maxZ = -Infinity
    let minY = Infinity,
      maxY = -Infinity
    for (let i = 0; i < result.positions.length; i += 3) {
      minZ = Math.min(minZ, result.positions[i + 2])
      maxZ = Math.max(maxZ, result.positions[i + 2])
      minY = Math.min(minY, result.positions[i + 1])
      maxY = Math.max(maxY, result.positions[i + 1])
    }
    // Y-up の高さ（Y）が Z-up の Z に写る
    expect(maxZ - minZ).toBeCloseTo(100, 6)
    // Y-up の奥行（Z, 元 10mm→scale=1→10mm）が Z-up の Y に写る
    expect(maxY - minY).toBeCloseTo(10, 6)
  })

  it('接地される（min.z = 0）', () => {
    // ワールド原点から離れた位置の直方体でも接地されること
    const mesh: MeshData = {
      positions: boxPositions(10, 10, 10, [50, 500, -30]),
      indices: new Uint32Array(),
    }
    const result = normalizeMesh(mesh, 10)

    let minZ = Infinity
    for (let i = 0; i < result.positions.length; i += 3) {
      minZ = Math.min(minZ, result.positions[i + 2])
    }
    expect(minZ).toBeCloseTo(0, 6)
  })

  it('indices と vertexColors は変更せずそのまま引き継ぐ', () => {
    const indices = new Uint32Array([0, 1, 2])
    const vertexColors = new Float32Array([1, 0, 0])
    const mesh: MeshData = {
      positions: boxPositions(10, 10, 10, [0, 0, 0]),
      indices,
      vertexColors,
    }
    const result = normalizeMesh(mesh, 10)
    expect(result.indices).toBe(indices)
    expect(result.vertexColors).toBe(vertexColors)
  })

  it('空メッシュはそのまま返す', () => {
    const mesh: MeshData = { positions: new Float32Array(), indices: new Uint32Array() }
    const result = normalizeMesh(mesh, 100)
    expect(result.positions.length).toBe(0)
  })

  it('入力の positions は変更しない（純関数）', () => {
    const original = boxPositions(10, 20, 30, [0, 0, 0])
    const copy = original.slice()
    const mesh: MeshData = { positions: original, indices: new Uint32Array() }
    normalizeMesh(mesh, 100)
    expect(original).toEqual(copy)
  })
})
