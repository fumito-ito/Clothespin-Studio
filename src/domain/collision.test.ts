import { describe, expect, it } from 'vitest'
import { Matrix4 } from 'three'
import {
  BOUNDING_RADIUS,
  collidingPinId,
  obbFromMatrix,
  obbIntersect,
  placementCollidingPinId,
} from './collision'
import { DIMENSIONS } from './clothespin'
import { childWorldMatrix, solveWorldTransforms } from './solve'
import { GRIP_SOCKETS } from './clothespin'
import type { Pin } from '../types'

const at = (x: number, y = 0, z = 0) => new Matrix4().makeTranslation(x, y, z)

describe('obbFromMatrix', () => {
  it('単位行列 → 中心原点・単位軸・半寸法 = 寸法/2', () => {
    const o = obbFromMatrix(new Matrix4())
    expect(o.c).toEqual([0, 0, 0])
    expect(o.u[0]).toEqual([1, 0, 0])
    expect(o.e).toEqual([DIMENSIONS.length / 2, DIMENSIONS.thickness / 2, DIMENSIONS.height / 2])
  })
})

describe('obbIntersect（軸並行）', () => {
  it('同一位置の箱は重なる', () => {
    expect(obbIntersect(obbFromMatrix(new Matrix4()), obbFromMatrix(new Matrix4()))).toBe(true)
  })

  it('長さ方向(X)に離すと、重なり→分離の境界が length で切り替わる', () => {
    const a = obbFromMatrix(new Matrix4())
    expect(obbIntersect(a, obbFromMatrix(at(DIMENSIONS.length - 2)))).toBe(true) // 58 < 60
    expect(obbIntersect(a, obbFromMatrix(at(DIMENSIONS.length + 2)))).toBe(false) // 62 > 60
  })

  it('厚み方向(Y)の薄さで分離できる', () => {
    const a = obbFromMatrix(new Matrix4())
    expect(obbIntersect(a, obbFromMatrix(at(0, DIMENSIONS.thickness + 1, 0)))).toBe(false)
  })
})

describe('obbIntersect（回転）', () => {
  it('原点で 45° 回した箱どうしは重なる', () => {
    const a = obbFromMatrix(new Matrix4())
    const b = obbFromMatrix(new Matrix4().makeRotationZ(Math.PI / 4))
    expect(obbIntersect(a, b)).toBe(true)
  })

  it('90° 回転で長軸を直交させ、長さ方向に逃がすと分離する', () => {
    const a = obbFromMatrix(new Matrix4())
    // b は Z まわり 90°（長軸が Y 方向）。X 方向に half_a(30)+half_b_y(6)=36 より離せば分離
    const b = obbFromMatrix(new Matrix4().makeRotationZ(Math.PI / 2).setPosition(40, 0, 0))
    expect(obbIntersect(a, b)).toBe(false)
  })
})

describe('obbIntersect（tolerance）', () => {
  it('わずかな重なりは tolerance で許容される', () => {
    const a = obbFromMatrix(new Matrix4())
    const b = obbFromMatrix(at(DIMENSIONS.length - 3)) // 3mm 重なる
    expect(obbIntersect(a, b, 0)).toBe(true)
    expect(obbIntersect(a, b, 4)).toBe(false) // 4mm 許容 → 干渉なし扱い
  })
})

describe('collidingPinId', () => {
  const matrices = new Map<string, Matrix4>([
    ['p1', at(0, 0, 0)],
    ['p2', at(1000, 0, 0)], // 遠い
  ])

  it('重なる相手の id を返す', () => {
    expect(collidingPinId(at(10, 0, 0), matrices, new Set())).toBe('p1')
  })

  it('除外 id はスキップする', () => {
    expect(collidingPinId(at(10, 0, 0), matrices, new Set(['p1']))).toBeNull()
  })

  it('遠方（球判定で除外）は干渉しない', () => {
    expect(collidingPinId(at(1000, 0, 0), matrices, new Set(['p2']))).toBeNull()
    // p2 を除外しなければ当たる
    expect(collidingPinId(at(1000, 0, 0), matrices, new Set())).toBe('p2')
  })

  it('球プレフィルタは重なりを取りこぼさない（2R より近ければ SAT へ）', () => {
    const near = at(2 * BOUNDING_RADIUS - 5, 0, 0)
    // 距離 < 2R だが OBB は長さ方向 60 で実際は分離（67 > 60）→ false で正しい
    expect(collidingPinId(near, matrices, new Set())).toBeNull()
  })
})

describe('placementCollidingPinId', () => {
  const root: Pin = {
    id: 'root',
    colorId: 'blue',
    connection: null,
    transform: { position: [0, 0, DIMENSIONS.height / 2], rotation: [0, 0, 0, 1] },
  }

  it('他に何も無ければ干渉なし', () => {
    expect(placementCollidingPinId([root], 'root', 4)).toBeNull()
  })

  it('子の既定姿勢と同じ位置に自由ピンがあれば干渉する', () => {
    // root の g4 子の既定ワールド姿勢を先回りで占有するピンを置く
    const g4 = GRIP_SOCKETS[4]
    const m = solveWorldTransforms([root]).get('root')!
    const childM = childWorldMatrix(m, g4, 0, 0)
    const pos = [childM.elements[12], childM.elements[13], childM.elements[14]] as [number, number, number]
    const blocker: Pin = {
      id: 'blocker',
      colorId: 'white',
      connection: null,
      transform: { position: pos, rotation: [0, 0, 0, 1] },
    }
    expect(placementCollidingPinId([root, blocker], 'root', 4)).toBe('blocker')
  })

  it('親は除外される（接合部の必然的な重なりを誤検出しない）', () => {
    // root だけに対して g4 へ置く → 親 root とは必ず接触するが除外され null
    expect(placementCollidingPinId([root], 'root', 4)).toBeNull()
  })

  it('存在しない親 / 不正ソケットは null', () => {
    expect(placementCollidingPinId([root], 'nope', 4)).toBeNull()
    expect(placementCollidingPinId([root], 'root', 99)).toBeNull()
  })
})
