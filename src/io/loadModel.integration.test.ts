// GLB ロード（io/loadModel）→ 正規化（domain/normalize）の結合テスト。
// 受入基準: プログラム生成した既知寸法の GLB を読み込み、正規化後の bbox が
// （最長辺 = 目標 mm・Z-up・min.z = 0）になることを数値検証する。

import { describe, expect, it } from 'vitest'
import { loadGlbModel } from './loadModel'
import { buildGlb } from './testUtils/buildGlb'
import { normalizeMesh } from '../domain/normalize'

/** 直方体（Y-up）の頂点座標と三角形インデックスを作る */
function boxSpec(w: number, h: number, d: number) {
  const hw = w / 2
  const hh = h / 2
  const hd = d / 2
  const positions: number[] = []
  for (const x of [-hw, hw])
    for (const y of [-hh, hh]) for (const z of [-hd, hd]) positions.push(x, y, z)
  // 頂点順: 0=(-,-,-) 1=(-,-,+) 2=(-,+,-) 3=(-,+,+) 4=(+,-,-) 5=(+,-,+) 6=(+,+,-) 7=(+,+,+)
  // 直方体の 12 三角形（6 面 × 2）
  const indices = [
    0,
    1,
    3,
    0,
    3,
    2, // -x
    4,
    6,
    7,
    4,
    7,
    5, // +x
    0,
    4,
    5,
    0,
    5,
    1, // -y
    2,
    3,
    7,
    2,
    7,
    6, // +y
    0,
    2,
    6,
    0,
    6,
    4, // -z
    1,
    5,
    7,
    1,
    7,
    3, // +z
  ]
  return { positions, indices }
}

function bboxOf(positions: Float32Array) {
  let minX = Infinity,
    minY = Infinity,
    minZ = Infinity
  let maxX = -Infinity,
    maxY = -Infinity,
    maxZ = -Infinity
  for (let i = 0; i < positions.length; i += 3) {
    minX = Math.min(minX, positions[i])
    maxX = Math.max(maxX, positions[i])
    minY = Math.min(minY, positions[i + 1])
    maxY = Math.max(maxY, positions[i + 1])
    minZ = Math.min(minZ, positions[i + 2])
    maxZ = Math.max(maxZ, positions[i + 2])
  }
  return { min: [minX, minY, minZ], max: [maxX, maxY, maxZ] }
}

describe('GLB ロード → 正規化（結合）', () => {
  it('既知寸法の直方体 GLB を読み込み、正規化後の bbox が期待通りになる', async () => {
    // Y-up で幅40(X) × 高さ100(Y) × 奥行20(Z)。最長辺は Y=100
    const { positions, indices } = boxSpec(40, 100, 20)
    const glb = buildGlb([{ positions, indices }])

    const loaded = await loadGlbModel(glb)
    expect(loaded.ok).toBe(true)
    if (!loaded.ok) return

    const targetMm = 150
    const normalized = normalizeMesh(loaded.mesh, targetMm)
    const bbox = bboxOf(normalized.positions)

    // 最長辺 = 目標 mm
    const size = [bbox.max[0] - bbox.min[0], bbox.max[1] - bbox.min[1], bbox.max[2] - bbox.min[2]]
    expect(Math.max(...size)).toBeCloseTo(targetMm, 6)
    // Y-up の高さ(Y=100)が最長辺 → Z-up 変換後は Z 軸に来る
    expect(size[2]).toBeCloseTo(targetMm, 6)
    // 接地: min.z = 0
    expect(bbox.min[2]).toBeCloseTo(0, 6)
  })

  it('マテリアル色ありの GLB を読み込み、正規化後も vertexColors が保持される', async () => {
    const { positions, indices } = boxSpec(10, 10, 10)
    const glb = buildGlb([{ positions, indices, materialColor: [0.1, 0.5, 0.9, 1] }])

    const loaded = await loadGlbModel(glb)
    expect(loaded.ok).toBe(true)
    if (!loaded.ok) return
    expect(loaded.mesh.vertexColors).toBeDefined()

    const normalized = normalizeMesh(loaded.mesh, 60)
    expect(normalized.vertexColors).toBe(loaded.mesh.vertexColors)
    expect(normalized.vertexColors![0]).toBeCloseTo(0.1, 5)
    expect(normalized.vertexColors![1]).toBeCloseTo(0.5, 5)
    expect(normalized.vertexColors![2]).toBeCloseTo(0.9, 5)
  })
})
