// 連結 → ワールド姿勢の導出。docs/02 §5 の式を実装する:
//   T_child = T_parent · S(g_i) · R_normal(roll) · R_tangent(pitch) · FLIP · J⁻¹
//
// コネクタフレームの軸対応: x = tangent / y = normal×tangent / z = normal。
// FLIP = R_x(180°): JAW の normal をソケット normal の逆向きに合わせる
// （roll=0 で JAW.tangent とソケット tangent が一致する）。
//
// three/math のみに依存（描画非依存・ユニットテスト可能, docs/04 §2）。

import { Matrix4, Quaternion, Vector3 } from 'three'
import type { Pin } from '../types'
import { JAW, socketByIndex } from './clothespin'
import type { ConnectorFrame } from './clothespin'

const DEG2RAD = Math.PI / 180

/** コネクタフレーム（position/normal/tangent）→ ピンローカル変換行列 */
export function frameMatrix(f: ConnectorFrame): Matrix4 {
  const n = new Vector3(...f.normal)
  const t = new Vector3(...f.tangent)
  const b = new Vector3().crossVectors(n, t) // y = z × x
  return new Matrix4().makeBasis(t, b, n).setPosition(...f.position)
}

const FLIP = new Matrix4().makeRotationX(Math.PI)
const JAW_INV = frameMatrix(JAW).invert()

/** 親のワールド行列と接続パラメータから子のワールド行列を導出 */
export function childWorldMatrix(
  parentWorld: Matrix4,
  socket: ConnectorFrame,
  rollDeg: number,
  pitchDeg: number,
): Matrix4 {
  const m = new Matrix4().multiplyMatrices(parentWorld, frameMatrix(socket))
  m.multiply(new Matrix4().makeRotationZ(rollDeg * DEG2RAD)) // R_normal(roll)
  m.multiply(new Matrix4().makeRotationX(pitchDeg * DEG2RAD)) // R_tangent(pitch)
  m.multiply(FLIP)
  m.multiply(JAW_INV)
  return m
}

/** ルート/自由ピンの Transform → ワールド行列 */
export function rootWorldMatrix(pin: Pin): Matrix4 {
  const t = pin.transform
  if (!t) return new Matrix4()
  return new Matrix4()
    .makeRotationFromQuaternion(new Quaternion(...t.rotation))
    .setPosition(...t.position)
}

/**
 * 全ピンのワールド行列を解決する。フォレストをルートから幅優先で辿る。
 * 親が見つからない・ソケット不正のピンは結果に含めない（バリデーションは graph.ts）。
 */
export function solveWorldTransforms(pins: readonly Pin[]): Map<string, Matrix4> {
  const result = new Map<string, Matrix4>()
  const childrenOf = new Map<string, Pin[]>()
  const queue: Pin[] = []

  for (const pin of pins) {
    if (pin.connection === null) {
      result.set(pin.id, rootWorldMatrix(pin))
      queue.push(pin)
    } else {
      const list = childrenOf.get(pin.connection.parentId)
      if (list) list.push(pin)
      else childrenOf.set(pin.connection.parentId, [pin])
    }
  }

  while (queue.length > 0) {
    const parent = queue.shift()!
    const parentWorld = result.get(parent.id)!
    for (const child of childrenOf.get(parent.id) ?? []) {
      const conn = child.connection!
      const socket = socketByIndex(conn.gripIndex)
      if (!socket) continue
      result.set(child.id, childWorldMatrix(parentWorld, socket, conn.roll, conn.pitch ?? 0))
      queue.push(child)
    }
  }

  return result
}
