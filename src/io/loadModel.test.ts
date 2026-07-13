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

  it('色あり・なしのメッシュが混在する場合、無色メッシュの頂点は白（glTF 既定色）で補完される', async () => {
    const glb = buildGlb([
      { positions: TRIANGLE_POSITIONS, materialColor: [0.2, 0.4, 0.6, 1] },
      { positions: TRIANGLE_POSITIONS, translation: [1000, 0, 0] }, // マテリアル未指定
    ])
    const result = await loadGlbModel(glb)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const colors = result.mesh.vertexColors!
    expect(colors).toBeDefined()
    // 前半 3 頂点 = マテリアル色、後半 3 頂点 = 白（0 埋め＝黒だと下流で誤った意味を持つ）
    for (let i = 0; i < 3; i++) {
      expect(colors[i * 3]).toBeCloseTo(0.2, 5)
      expect(colors[(3 + i) * 3]).toBe(1)
      expect(colors[(3 + i) * 3 + 1]).toBe(1)
      expect(colors[(3 + i) * 3 + 2]).toBe(1)
    }
  })

  it('頂点色・マテリアルどちらも無ければ vertexColors は undefined', async () => {
    const glb = buildGlb([{ positions: TRIANGLE_POSITIONS }])
    const result = await loadGlbModel(glb)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.mesh.vertexColors).toBeUndefined()
  })

  it('ノード名に日本語（非 ASCII）を含む GLB も正しくロードでき、JSON チャンク長が 4byte アラインする', async () => {
    // JSON チャンクの 4byte アラインが UTF-16 コードユニット数ではなく UTF-8 バイト長基準で
    // 計算されていることの確認（非 ASCII は 1 文字が UTF-8 で複数byte になるため、
    // 文字数基準でパディングすると glTF 仕様違反の GLB になる。three の GLTFLoader 自体は
    // 非アライン GLB も読めてしまうため、ロード成否だけでなく生成物の構造も直接検証する）
    for (const name of ['洗濯バサミ', 'あ', '洗', 'アイウエオカキクケコサシスセソ']) {
      const glb = buildGlb([{ positions: TRIANGLE_POSITIONS, nodeName: name }])
      const dv = new DataView(glb)
      const jsonChunkLength = dv.getUint32(12, true)
      expect(jsonChunkLength % 4).toBe(0)

      const result = await loadGlbModel(glb)
      expect(result.ok).toBe(true)
      if (!result.ok) continue
      expect(result.mesh.positions.length).toBe(9)
      expect(Array.from(result.mesh.indices)).toEqual([0, 1, 2])
    }
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
    if (result.ok) return
    expect(result.error).toContain('ヘッダが不足しています')
  })

  it('先頭チャンクが JSON でない GLB はエラー結果を返す', async () => {
    // 12byte ヘッダ + チャンクヘッダ(長さ0, 種別 'BIN\0') のみの不正な GLB
    const buf = new ArrayBuffer(20)
    const dv = new DataView(buf)
    dv.setUint32(0, 0x46546c67, true) // magic 'glTF'
    dv.setUint32(4, 2, true) // version
    dv.setUint32(8, 20, true) // 全長
    dv.setUint32(12, 0, true) // チャンク長 0
    dv.setUint32(16, 0x004e4942, true) // 種別 'BIN\0'（本来は 'JSON' のはず）
    const result = await loadGlbModel(buf)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toContain('JSON ではありません')
  })

  it('JSON チャンク長が全長を超える GLB はエラー結果を返す', async () => {
    const buf = new ArrayBuffer(20)
    const dv = new DataView(buf)
    dv.setUint32(0, 0x46546c67, true) // magic 'glTF'
    dv.setUint32(4, 2, true) // version
    dv.setUint32(8, 20, true) // 全長（実際は 20byte しか無い）
    dv.setUint32(12, 1000, true) // チャンク長が全長を大幅に超える不正値
    dv.setUint32(16, 0x4e4f534a, true) // 種別 'JSON'
    const result = await loadGlbModel(buf)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toContain('長さが不正です')
  })

  it('メッシュを含まない GLB はエラー結果を返す', async () => {
    const glb = buildGlb([])
    const result = await loadGlbModel(glb)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toContain('メッシュ')
  })
})
