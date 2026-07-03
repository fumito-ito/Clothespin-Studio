import { describe, expect, it } from 'vitest'
import { loadGlbModel } from './loadModel'
import { buildGlb } from './testUtils/buildGlb'

// Y-up の三角形（幅40 × 高さ100）
const TRIANGLE_POSITIONS = [0, 0, 0, 40, 0, 0, 0, 100, 0]

describe('loadGlbModel', () => {
  it('三角形メッシュを読み込み MeshData の positions/indices に変換する', async () => {
    const glb = buildGlb([{ positions: TRIANGLE_POSITIONS }])
    const result = await loadGlbModel(glb)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.mesh.positions.length).toBe(9)
    expect(Array.from(result.mesh.indices)).toEqual([0, 1, 2])
  })

  it('複数プリミティブ（ノード変換あり）を 1 つの MeshData に統合する', async () => {
    const glb = buildGlb([
      { positions: TRIANGLE_POSITIONS },
      { positions: TRIANGLE_POSITIONS, translation: [1000, 0, 0] },
    ])
    const result = await loadGlbModel(glb)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    // 頂点 6 個（3頂点 × 2プリミティブ）、インデックスは 2 つ目が 3 つずれる
    expect(result.mesh.positions.length).toBe(18)
    expect(Array.from(result.mesh.indices)).toEqual([0, 1, 2, 3, 4, 5])
    // 2つ目のノードの平行移動がワールド座標に反映されている
    const secondTriangleX = result.mesh.positions[3 * 3]
    expect(secondTriangleX).toBeCloseTo(1000, 6)
  })

  it('頂点色（COLOR_0）があれば vertexColors に入る', async () => {
    const glb = buildGlb([
      {
        positions: TRIANGLE_POSITIONS,
        colors: [1, 0, 0, 0, 1, 0, 0, 0, 1],
      },
    ])
    const result = await loadGlbModel(glb)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.mesh.vertexColors).toBeDefined()
    expect(Array.from(result.mesh.vertexColors!)).toEqual([1, 0, 0, 0, 1, 0, 0, 0, 1])
  })

  it('マテリアルの baseColorFactor があれば vertexColors に一様に入る', async () => {
    const glb = buildGlb([
      {
        positions: TRIANGLE_POSITIONS,
        materialColor: [0.2, 0.4, 0.6, 1],
      },
    ])
    const result = await loadGlbModel(glb)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.mesh.vertexColors).toBeDefined()
    const colors = result.mesh.vertexColors!
    for (let i = 0; i < 3; i++) {
      expect(colors[i * 3]).toBeCloseTo(0.2, 5)
      expect(colors[i * 3 + 1]).toBeCloseTo(0.4, 5)
      expect(colors[i * 3 + 2]).toBeCloseTo(0.6, 5)
    }
  })

  it('KHR_materials_unlit（MeshBasicMaterial）の baseColorFactor も vertexColors に入る', async () => {
    // KHR_materials_unlit 拡張付きマテリアルは GLTFLoader が MeshStandardMaterial ではなく
    // MeshBasicMaterial を生成する。.color を持つマテリアル全般が抽出対象になることの確認
    const glb = buildGlb([
      {
        positions: TRIANGLE_POSITIONS,
        materialColor: [0.3, 0.6, 0.9, 1],
        unlit: true,
      },
    ])
    const result = await loadGlbModel(glb)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.mesh.vertexColors).toBeDefined()
    const colors = result.mesh.vertexColors!
    for (let i = 0; i < 3; i++) {
      expect(colors[i * 3]).toBeCloseTo(0.3, 5)
      expect(colors[i * 3 + 1]).toBeCloseTo(0.6, 5)
      expect(colors[i * 3 + 2]).toBeCloseTo(0.9, 5)
    }
  })

  it('COLOR_0 が UNSIGNED_BYTE + normalized の場合も 0-1 の範囲で vertexColors に入る（回帰）', async () => {
    // glTF 仕様上 COLOR_0 の整数型は normalized 必須。GLTFLoader は accessor の normalized を
    // BufferAttribute に引き継ぎ、BufferAttribute#getX/Y/Z は normalized なら denormalize して返す
    // （three 0.184 の src/core/BufferAttribute.js）。0-1 契約を満たすことを数値で確認する。
    const glb = buildGlb([
      {
        positions: TRIANGLE_POSITIONS,
        // 頂点ごとに (255,0,0) (0,255,0) (0,128,255) の RGB を UNSIGNED_BYTE で格納
        colorsUnsignedByte: [255, 0, 0, 0, 255, 0, 0, 128, 255],
      },
    ])
    const result = await loadGlbModel(glb)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.mesh.vertexColors).toBeDefined()
    const colors = result.mesh.vertexColors!
    expect(colors[0]).toBeCloseTo(1.0, 5) // 255 → 1.0
    expect(colors[1]).toBeCloseTo(0, 5)
    expect(colors[2]).toBeCloseTo(0, 5)
    expect(colors[3]).toBeCloseTo(0, 5)
    expect(colors[4]).toBeCloseTo(1.0, 5)
    expect(colors[5]).toBeCloseTo(0, 5)
    expect(colors[6]).toBeCloseTo(0, 5)
    expect(colors[7]).toBeCloseTo(128 / 255, 3) // 128 → ≈0.502
    expect(colors[8]).toBeCloseTo(1.0, 5)
  })

  it('頂点色・マテリアルどちらも無ければ vertexColors は undefined', async () => {
    const glb = buildGlb([{ positions: TRIANGLE_POSITIONS }])
    const result = await loadGlbModel(glb)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.mesh.vertexColors).toBeUndefined()
  })

  it('非 GLB（マジックナンバー不一致）はエラー結果を返す（例外を投げない）', async () => {
    const bad = new TextEncoder().encode('not a glb file').buffer
    const result = await loadGlbModel(bad)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(typeof result.error).toBe('string')
    expect(result.error.length).toBeGreaterThan(0)
  })

  it('壊れた GLB（ヘッダのみ・チャンク欠落）はエラー結果を返す', async () => {
    const truncated = new ArrayBuffer(12)
    const dv = new DataView(truncated)
    dv.setUint32(0, 0x46546c67, true)
    dv.setUint32(4, 2, true)
    dv.setUint32(8, 12, true)
    const result = await loadGlbModel(truncated)
    expect(result.ok).toBe(false)
  })

  it('メッシュを含まない GLB はエラー結果を返す', async () => {
    const glb = buildGlb([])
    const result = await loadGlbModel(glb)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toContain('メッシュ')
  })
})
