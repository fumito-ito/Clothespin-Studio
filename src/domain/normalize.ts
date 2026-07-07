// 取り込みメッシュの正規化（FR-M1, docs/07 §9 M1）。
// glTF の慣例（Y-up・任意スケール）から、ドメインの慣例（Z-up・mm・接地）へ座標を合わせる。
// three の数学クラスのみに依存する純関数（DOM・React・R3F・zustand 禁止, domain ルール）。

import { Box3, Matrix4, Vector3 } from 'three'
import type { MeshData } from '../types'

// Y-up → Z-up: glTF エクスポート時の逆変換（exportGltf.ts の Z-up → Y-up と対）。
// X 軸まわり +90°: (x, y, z) → (x, -z, y)
const Y_UP_TO_Z_UP = new Matrix4().makeRotationX(Math.PI / 2)

/** xyz 連続の頂点座標から bbox を計算する（座標系に依存しない。変換前後どちらにも使う） */
function computeBoundsFromPositions(positions: Float32Array): Box3 {
  const box = new Box3()
  const v = new Vector3()
  for (let i = 0; i < positions.length; i += 3) {
    v.set(positions[i], positions[i + 1], positions[i + 2])
    box.expandByPoint(v)
  }
  return box
}

/**
 * メッシュを正規化する: 最長辺 = targetMm・Y-up → Z-up・接地（min.z = 0）。
 * positions を新しい Float32Array に書き換えた MeshData を返す（入力は変更しない）。
 * 頂点が無い（空メッシュ）場合はスケール計算不能のため、そのまま返す。
 */
export function normalizeMesh(mesh: MeshData, targetMm: number): MeshData {
  const { positions } = mesh
  if (positions.length === 0) return mesh

  const boundsBeforeRotation = computeBoundsFromPositions(positions)
  const sizeBefore = boundsBeforeRotation.getSize(new Vector3())
  const longestEdge = Math.max(sizeBefore.x, sizeBefore.y, sizeBefore.z)
  const scale = longestEdge > 0 ? targetMm / longestEdge : 1

  // スケール → Y-up→Z-up 回転 の順で頂点変換行列を組む（行列積は右から順に適用）
  const transform = Y_UP_TO_Z_UP.clone().multiply(new Matrix4().makeScale(scale, scale, scale))

  const out = new Float32Array(positions.length)
  const v = new Vector3()
  for (let i = 0; i < positions.length; i += 3) {
    v.set(positions[i], positions[i + 1], positions[i + 2]).applyMatrix4(transform)
    out[i] = v.x
    out[i + 1] = v.y
    out[i + 2] = v.z
  }

  // 変換後の bbox から接地（min.z = 0）への平行移動量を求める
  const boundsAfter = computeBoundsFromPositions(out)
  const dz = -boundsAfter.min.z
  for (let i = 2; i < out.length; i += 3) out[i] += dz

  return { ...mesh, positions: out }
}
