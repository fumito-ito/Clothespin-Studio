import { describe, expect, it } from 'vitest'
import { Matrix4, Vector3 } from 'three'
import { childWorldMatrix, frameMatrix, solveWorldTransforms } from './solve'
import { GRIP_SOCKETS, JAW } from './clothespin'
import type { Pin } from '../types'

const IDENTITY = new Matrix4()
const g4 = GRIP_SOCKETS[4] // リング頂点: pos(0,0,10) n(0,0,1) t(1,0,0)

/** 方向ベクトルを行列の回転成分で変換 */
function xformDir(m: Matrix4, v: [number, number, number]): Vector3 {
  return new Vector3(...v).transformDirection(m)
}

function expectVec(actual: Vector3, expected: [number, number, number]) {
  expect(actual.x).toBeCloseTo(expected[0], 10)
  expect(actual.y).toBeCloseTo(expected[1], 10)
  expect(actual.z).toBeCloseTo(expected[2], 10)
}

describe('frameMatrix', () => {
  it('x=tangent / z=normal の右手系フレームを作る', () => {
    const m = frameMatrix(g4)
    expectVec(xformDir(m, [1, 0, 0]), [...g4.tangent])
    expectVec(xformDir(m, [0, 0, 1]), [...g4.normal])
  })
})

describe('childWorldMatrix', () => {
  it('roll=0: 子の JAW がソケット位置に一致し、法線が反平行・接線が平行になる', () => {
    const m = childWorldMatrix(IDENTITY, g4, 0, 0)
    // JAW 原点 → ソケット位置
    const jawPos = new Vector3(...JAW.position).applyMatrix4(m)
    expectVec(jawPos, [...g4.position])
    // JAW 法線 → ソケット法線の逆向き（噛み込み）
    expectVec(xformDir(m, [...JAW.normal]), [-g4.normal[0], -g4.normal[1], -g4.normal[2]])
    // JAW 接線 → ソケット接線（roll=0 基準）
    expectVec(xformDir(m, [...JAW.tangent]), [...g4.tangent])
  })

  it('roll=90: JAW 接線が法線まわりに 90° 回る（tangent → binormal）', () => {
    const m = childWorldMatrix(IDENTITY, g4, 90, 0)
    // g4: tangent(1,0,0) を normal(0,0,1) まわりに +90° → (0,1,0)
    expectVec(xformDir(m, [...JAW.tangent]), [0, 1, 0])
    // 位置は不変
    expectVec(new Vector3(...JAW.position).applyMatrix4(m), [...g4.position])
  })

  it('pitch=90: 接続点まわりに接線軸で回る（法線の向きが変わる）', () => {
    const m = childWorldMatrix(IDENTITY, g4, 0, 90)
    // JAW 法線(噛み込み軸)は tangent(1,0,0) まわりに 90° 回転:
    // roll=0 で (0,0,-1) だったものが → (0,1,0) 方向へ
    const n = xformDir(m, [...JAW.normal])
    expectVec(n, [0, 1, 0])
    // 位置は不変（接点固定）
    expectVec(new Vector3(...JAW.position).applyMatrix4(m), [...g4.position])
  })

  it('親の姿勢に追従する（平行移動）', () => {
    const parent = new Matrix4().setPosition(100, 50, 0)
    const m = childWorldMatrix(parent, g4, 0, 0)
    expectVec(new Vector3(...JAW.position).applyMatrix4(m), [100, 50, 10])
  })
})

describe('solveWorldTransforms', () => {
  const root: Pin = {
    id: 'root',
    colorId: 'blue',
    connection: null,
    transform: { position: [0, 0, 0], rotation: [0, 0, 0, 1] },
  }

  it('ルートは transform をそのまま使う', () => {
    const result = solveWorldTransforms([root])
    const m = result.get('root')!
    expectVec(new Vector3(0, 0, 0).applyMatrix4(m), [0, 0, 0])
  })

  it('チェーン（root → a → b）を配列順に依らず解決する', () => {
    const a: Pin = {
      id: 'a',
      colorId: 'blue',
      connection: { parentId: 'root', gripIndex: 4, roll: 0 },
    }
    const b: Pin = {
      id: 'b',
      colorId: 'blue',
      connection: { parentId: 'a', gripIndex: 4, roll: 0 },
    }
    // 子を先に並べても解決できること
    const result = solveWorldTransforms([b, a, root])
    expect(result.size).toBe(3)
    // a の JAW はルートの g4 位置 (0,0,10)
    expectVec(new Vector3(...JAW.position).applyMatrix4(result.get('a')!), [0, 0, 10])
  })

  it('親が存在しないピンは結果に含めない', () => {
    const orphan: Pin = {
      id: 'x',
      colorId: 'blue',
      connection: { parentId: 'nope', gripIndex: 0, roll: 0 },
    }
    const result = solveWorldTransforms([root, orphan])
    expect(result.has('x')).toBe(false)
    expect(result.has('root')).toBe(true)
  })
})
