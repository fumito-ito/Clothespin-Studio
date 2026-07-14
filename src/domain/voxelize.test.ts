import { BoxGeometry, IcosahedronGeometry, type BufferGeometry } from 'three'
import { describe, expect, it } from 'vitest'
import type { MeshData } from '../types'
import { voxelizeSolid } from './voxelize'

const COLOR_ID = 'default'

/** three.js の BufferGeometry から MeshData（indices 有り）を作る（テスト専用ヘルパー） */
function meshFromGeometry(geo: BufferGeometry): MeshData {
  const posAttr = geo.getAttribute('position')
  const positions = new Float32Array(posAttr.array as ArrayLike<number>)
  const indices = geo.index
    ? new Uint32Array(geo.index.array as ArrayLike<number>)
    : Uint32Array.from({ length: positions.length / 3 }, (_, i) => i)
  return { positions, indices }
}

/** ボクセル走査に使う整数インデックス範囲（bbox 中心 0 の対称メッシュ前提） */
function symmetricRange(halfExtent: number, voxelMm: number): { lo: number; hi: number } {
  const n = Math.ceil(halfExtent / voxelMm) + 1
  return { lo: -n, hi: n }
}

/** メッシュの全頂点を平行移動する（テスト専用。原点中心の完全対称形状を意図的に崩すため） */
function translate(mesh: MeshData, dx: number, dy: number, dz: number): MeshData {
  const positions = mesh.positions.slice()
  for (let i = 0; i < positions.length; i += 3) {
    positions[i] += dx
    positions[i + 1] += dy
    positions[i + 2] += dz
  }
  return { ...mesh, positions }
}

describe('voxelizeSolid', () => {
  it('閉じた球: 解析解（中心距離 <= 半径）に対する誤判定率が2%以下', () => {
    const radius = 20
    const geo = new IcosahedronGeometry(radius, 3) // 1280面。実用モデル相当の分割数
    const mesh = meshFromGeometry(geo)
    const voxelMm = (radius * 2) / 40 // 40^3 相当の解像度で球全体を覆う

    const { voxels } = voxelizeSolid(mesh, voxelMm, COLOR_ID)
    const { lo, hi } = symmetricRange(radius, voxelMm)

    let mismatches = 0
    let total = 0
    for (let k = lo; k <= hi; k++) {
      for (let j = lo; j <= hi; j++) {
        for (let i = lo; i <= hi; i++) {
          const x = i * voxelMm
          const y = j * voxelMm
          const z = k * voxelMm
          const truth = Math.hypot(x, y, z) <= radius
          const got = voxels.has(`${i},${j},${k}`)
          if (truth !== got) mismatches++
          total++
        }
      }
    }
    const errorRate = mismatches / total
    expect(errorRate).toBeLessThanOrEqual(0.02)
  })

  it('直方体: 解析解（bbox 内判定）に対する誤判定率が2%以下', () => {
    const width = 50
    const height = 70
    const depth = 30
    const geo = new BoxGeometry(width, height, depth)
    const mesh = meshFromGeometry(geo)
    const voxelMm = 2

    const { voxels } = voxelizeSolid(mesh, voxelMm, COLOR_ID)
    const { lo: iLo, hi: iHi } = symmetricRange(width / 2, voxelMm)
    const { lo: jLo, hi: jHi } = symmetricRange(height / 2, voxelMm)
    const { lo: kLo, hi: kHi } = symmetricRange(depth / 2, voxelMm)

    let mismatches = 0
    let total = 0
    for (let k = kLo; k <= kHi; k++) {
      for (let j = jLo; j <= jHi; j++) {
        for (let i = iLo; i <= iHi; i++) {
          const x = i * voxelMm
          const y = j * voxelMm
          const z = k * voxelMm
          const truth =
            Math.abs(x) <= width / 2 && Math.abs(y) <= height / 2 && Math.abs(z) <= depth / 2
          const got = voxels.has(`${i},${j},${k}`)
          if (truth !== got) mismatches++
          total++
        }
      }
    }
    const errorRate = mismatches / total
    expect(errorRate).toBeLessThanOrEqual(0.02)
  })

  it('内部も充填される（シェルではない）', () => {
    // 球を原点からわずかにずらす: 完全対称な形状だと、軸に沿ったレイがちょうど辺・頂点を
    // かすめる縮退ケース（issue 0008 で計測済みの誤判定要因）に当たりやすいため、
    // 「内部充填」の確認という本題から外れないよう意図的に対称性を崩す
    const radius = 20
    const center: [number, number, number] = [3.4, -6.1, 9.7]
    const geo = new IcosahedronGeometry(radius, 3)
    const mesh = translate(meshFromGeometry(geo), ...center)
    const voxelMm = 5

    const { voxels } = voxelizeSolid(mesh, voxelMm, COLOR_ID)

    // 中心付近のボクセルを中心に 3x3x3 のブロックを見る（十分に内部で、表面から離れている）
    const [ci, cj, ck] = center.map((c) => Math.round(c / voxelMm))
    for (let dk = -1; dk <= 1; dk++) {
      for (let dj = -1; dj <= 1; dj++) {
        for (let di = -1; di <= 1; di++) {
          expect(voxels.has(`${ci + di},${cj + dj},${ck + dk}`)).toBe(true)
        }
      }
    }
  })

  it('seed は充填ボクセルのうち k 最小層・(i,j) 重心最近傍', () => {
    // 半端な寸法にして、ボクセル中心が面上や境界にちょうど乗らないようにする
    // (i,j) は -4..4 の 9x9 グリッド、k は -5..5 の 11 層。全て一様に充填される直方体。
    const geo = new BoxGeometry(91, 91, 101)
    const mesh = meshFromGeometry(geo)
    const voxelMm = 10

    const { voxels, seed } = voxelizeSolid(mesh, voxelMm, COLOR_ID)
    expect(seed).toBeDefined()

    // 実際に充填されているボクセルの中で k が最小であること
    let minK = Infinity
    for (const key of voxels.keys()) {
      const k = Number(key.split(',')[2])
      if (k < minK) minK = k
    }
    const [si, sj, sk] = seed!.split(',').map(Number)
    expect(sk).toBe(minK)
    expect(voxels.has(seed!)).toBe(true)

    // k=minK 層は i,j とも -4..4 の対称グリッドで全充填 → 重心 (0,0) に一致する (0,0) が最近傍
    expect(si).toBe(0)
    expect(sj).toBe(0)
  })

  it('40^3 相当の処理時間を計測してログ出力する（回帰の目安。ハード制限はしない）', () => {
    const radius = 20
    const geo = new IcosahedronGeometry(radius, 5) // 約20480面。実ダウンロードモデル相当の高解像度
    const mesh = meshFromGeometry(geo)
    const voxelMm = (radius * 2) / 40 // 40^3 相当の解像度

    const start = performance.now()
    const { voxels } = voxelizeSolid(mesh, voxelMm, COLOR_ID)
    const elapsedMs = performance.now() - start

    console.log(
      `[voxelizeSolid] 40^3相当・高解像度閉球(20480面): ${elapsedMs.toFixed(1)}ms, 充填ボクセル数=${voxels.size}`,
    )
    expect(voxels.size).toBeGreaterThan(0)
  })

  it('空メッシュ（三角形 0 枚）は空を返す', () => {
    const mesh: MeshData = { positions: new Float32Array(), indices: new Uint32Array() }
    const { voxels, seed } = voxelizeSolid(mesh, 5, COLOR_ID)
    expect(voxels.size).toBe(0)
    expect(seed).toBeUndefined()
  })
})
